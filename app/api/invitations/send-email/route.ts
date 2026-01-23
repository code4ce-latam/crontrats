import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

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
    const { email, token, displayName, role } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email y token son requeridos" },
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

    // Construir el enlace de invitación
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || 'http://localhost:3000';
    const inviteUrl = `${origin}/auth/invite/${token}`;

    // Traducir el rol
    const roleLabel = role === 'EDITOR' ? 'Editor' : 'Lector';

    // Verificar que existe la API key de Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[SendEmail] RESEND_API_KEY no está configurada");
      return NextResponse.json(
        { error: "Servicio de email no configurado" },
        { status: 500 }
      );
    }

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

    // Enviar el correo usando Resend
    try {
      const resend = new Resend(resendApiKey);
      
      // Obtener el email del remitente desde variables de entorno
      // IMPORTANTE: Para enviar a otros destinatarios, debes verificar un dominio en Resend
      // y usar un email de ese dominio (ej: noreply@tudominio.com)
      const fromEmail = process.env.RESEND_FROM_EMAIL;
      
      if (!fromEmail) {
        console.error("[SendEmail] RESEND_FROM_EMAIL no está configurada");
        return NextResponse.json(
          { 
            error: "RESEND_FROM_EMAIL no está configurada. Por favor, configura esta variable de entorno con un email de tu dominio verificado en Resend (ej: noreply@tudominio.com). Para más información, visita: https://resend.com/domains"
          },
          { status: 500 }
        );
      }
      
      const { data, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: subject,
        html: emailHtml,
      });

      if (resendError) {
        console.error("[SendEmail] Error enviando email con Resend:", resendError);
        
        // Mensaje de error más descriptivo para el caso común de dominio no verificado
        let errorMessage = resendError.message || "Error al enviar el correo";
        
        if (resendError.message?.includes("testing emails") || resendError.message?.includes("verify a domain")) {
          errorMessage = `No se puede enviar el correo: ${resendError.message}. Por favor, verifica un dominio en https://resend.com/domains y configura RESEND_FROM_EMAIL con un email de ese dominio (ej: noreply@tudominio.com).`;
        }
        
        throw new Error(errorMessage);
      }

      console.log("[SendEmail] Email enviado exitosamente:", data);

      return NextResponse.json({ 
        success: true,
        message: "Invitación creada y correo enviado exitosamente."
      });
    } catch (error: any) {
      console.error("[SendEmail] Error enviando email:", error);
      
      // Retornar el error con un mensaje claro
      return NextResponse.json(
        { 
          success: false,
          error: error.message || "Error al enviar el correo. La invitación fue creada pero el correo no se pudo enviar."
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[SendEmail] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

