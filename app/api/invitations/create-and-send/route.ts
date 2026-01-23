import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { createWorkspaceInvitation } from "@/lib/supabase/invitations";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar que el usuario esté autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, displayName, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email y rol son requeridos" },
        { status: 400 }
      );
    }

    // Obtener información del workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del workspace" },
        { status: 400 }
      );
    }

    const workspaceName = (membership.workspaces as any)?.name || "el workspace";

    // Obtener nombre del usuario que invita
    const inviterName = 
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
      user.email?.split("@")[0] ||
      "Un usuario";

    // Verificar que existe la API key de Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY no está configurada. Por favor, configura esta variable de entorno." },
        { status: 500 }
      );
    }

    // Obtener el email del remitente desde variables de entorno
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      return NextResponse.json(
        { error: "RESEND_FROM_EMAIL no está configurada. Por favor, configura esta variable de entorno con un email de tu dominio verificado en Resend (ej: noreply@tudominio.com)." },
        { status: 500 }
      );
    }

    // Generar token único ANTES de crear la invitación
    const token = crypto.randomUUID();

    // Construir el enlace de invitación
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || 'http://localhost:3000';
    const inviteUrl = `${origin}/auth/invite/${token}`;

    // Traducir el rol
    const roleLabel = role === 'EDITOR' ? 'Editor' : 'Lector';

    // Construir el contenido del email
    const subject = `Invitación a ${workspaceName}`;
    
    // Email HTML con diseño profesional
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #1a1a1a; margin-top: 0;">Invitación a ${workspaceName}</h2>
    
    <p>Hola${displayName ? ` <strong>${displayName}</strong>` : ''},</p>
    
    <p><strong>${inviterName}</strong> te ha invitado a unirte a <strong>${workspaceName}</strong> con el rol de <strong>${roleLabel}</strong>.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
        Aceptar Invitación
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      O copia y pega este enlace en tu navegador:<br>
      <a href="${inviteUrl}" style="color: #0070f3; word-break: break-all;">${inviteUrl}</a>
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      <strong>Importante:</strong> Este enlace expirará en 7 días.<br>
      Si no solicitaste esta invitación, puedes ignorar este correo.
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      Saludos,<br>
      El equipo de ${workspaceName}
    </p>
  </div>
</body>
</html>
    `.trim();

    // PRIMERO: Intentar enviar el correo usando Resend
    // Si esto falla, no crearemos la invitación en la BD
    try {
      const resend = new Resend(resendApiKey);
      
      const { data: resendData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: subject,
        html: emailHtml,
      });

      if (resendError) {
        console.error("[CreateAndSend] Error enviando email con Resend:", resendError);
        
        // Mensaje de error más descriptivo para el caso común de dominio no verificado
        let errorMessage = resendError.message || "Error al enviar el correo";
        
        if (resendError.message?.includes("testing emails") || resendError.message?.includes("verify a domain")) {
          errorMessage = `No se puede enviar el correo: ${resendError.message}. Por favor, verifica un dominio en https://resend.com/domains y configura RESEND_FROM_EMAIL con un email de ese dominio (ej: noreply@tudominio.com).`;
        } else if (resendError.message?.includes("API key")) {
          errorMessage = `Error de autenticación con Resend: ${resendError.message}. Por favor, verifica que RESEND_API_KEY esté configurada correctamente.`;
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }

      console.log("[CreateAndSend] Email enviado exitosamente:", resendData);
    } catch (error: any) {
      console.error("[CreateAndSend] Error inesperado enviando email:", error);
      return NextResponse.json(
        { error: error.message || "Error al enviar el correo. La invitación no se creó." },
        { status: 500 }
      );
    }

    // SOLO SI EL CORREO SE ENVIÓ EXITOSAMENTE: Crear la invitación en la BD
    // Usamos el mismo token que se usó en el correo
    try {
      const invitation = await createWorkspaceInvitation(supabase, {
        email: email.trim(),
        displayName,
        role,
        token, // Pasar el token generado para que coincida con el del correo
      });

      if (!invitation) {
        // Si no se pudo crear la invitación pero el correo ya se envió,
        // esto es un problema pero no podemos hacer rollback del correo
        console.error("[CreateAndSend] Error: El correo se envió pero no se pudo crear la invitación en la BD");
        return NextResponse.json(
          { error: "El correo se envió pero no se pudo crear la invitación en la base de datos. Por favor, contacta al administrador." },
          { status: 500 }
        );
      }

      // Verificar que el token generado coincida (debería ser el mismo)
      // Si no coincide, algo salió mal
      if (invitation.token !== token) {
        console.warn("[CreateAndSend] Advertencia: El token generado no coincide con el esperado");
      }

      return NextResponse.json({ 
        success: true,
        message: "Invitación creada y correo enviado exitosamente.",
        invitation: {
          id: invitation.id,
          email: invitation.email,
        }
      });
    } catch (error: any) {
      console.error("[CreateAndSend] Error creando invitación después de enviar correo:", error);
      // El correo ya se envió, pero no se pudo crear la invitación
      // Esto es un estado inconsistente, pero informamos al usuario
      return NextResponse.json(
        { error: "El correo se envió pero hubo un error al guardar la invitación. Por favor, contacta al administrador." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[CreateAndSend] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error inesperado al crear y enviar la invitación" },
      { status: 500 }
    );
  }
}

