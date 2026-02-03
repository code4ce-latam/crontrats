import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivity } from "@/lib/supabase/activities";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Verificar que el usuario esté autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario actual tiene permisos (debe ser OWNER o EDITOR)
    const { data: currentMembership } = await supabase
      .from('workspace_members')
      .select('role, workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .single();

    if (!currentMembership) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del workspace" },
        { status: 400 }
      );
    }

    const currentUserRole = currentMembership.role;
    const workspaceId = currentMembership.workspace_id;

    // Verificar que el usuario tiene permisos (OWNER o EDITOR)
    if (currentUserRole !== 'OWNER' && currentUserRole !== 'EDITOR') {
      return NextResponse.json(
        { error: "No tienes permisos para resetear contraseñas" },
        { status: 403 }
      );
    }

    // Verificar que el usuario a resetear pertenece al mismo workspace
    const { data: targetMembership } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .single();

    if (!targetMembership) {
      return NextResponse.json(
        { error: "El usuario no pertenece a tu workspace" },
        { status: 403 }
      );
    }

    // Obtener información del usuario objetivo
    const { data: targetUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (getUserError || !targetUserData?.user) {
      console.error("[ResetPassword] Error obteniendo usuario:", getUserError);
      return NextResponse.json(
        { error: "Error al obtener la información del usuario" },
        { status: 500 }
      );
    }

    const targetUser = targetUserData.user;
    const targetUserEmail = targetUser.email;

    if (!targetUserEmail) {
      return NextResponse.json(
        { error: "El usuario no tiene un email válido" },
        { status: 400 }
      );
    }

    // Obtener información del workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    const workspaceName = workspace?.name || "el workspace";

    // Obtener nombre del usuario que resetea
    const adminName = 
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
      user.email?.split("@")[0] ||
      "Un administrador";

    // Obtener nombre del usuario objetivo
    const targetUserName = 
      targetUser.user_metadata?.full_name ||
      targetUser.user_metadata?.name ||
      `${targetUser.user_metadata?.first_name || ''} ${targetUser.user_metadata?.last_name || ''}`.trim() ||
      targetUserEmail.split("@")[0] ||
      "Usuario";

    // Generar enlace de recuperación usando Admin API
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || 'http://localhost:3000';
    const redirectTo = `${origin}/auth/update-password`;

    const { data: linkData, error: generateLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: targetUserEmail,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (generateLinkError || !linkData?.properties?.action_link) {
      console.error("[ResetPassword] Error generando enlace:", generateLinkError);
      return NextResponse.json(
        { error: "Error al generar el enlace de recuperación" },
        { status: 500 }
      );
    }

    const resetLink = linkData.properties.action_link;

    // Verificar que existe la API key de Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[ResetPassword] RESEND_API_KEY no está configurada");
      return NextResponse.json(
        { error: "Servicio de email no configurado" },
        { status: 500 }
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      console.error("[ResetPassword] RESEND_FROM_EMAIL no está configurada");
      return NextResponse.json(
        { 
          error: "RESEND_FROM_EMAIL no está configurada. Por favor, configura esta variable de entorno con un email de tu dominio verificado en Resend (ej: noreply@tudominio.com)."
        },
        { status: 500 }
      );
    }

    // Construir el contenido del email
    const subject = `Restablecer contraseña - ${workspaceName}`;
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #1a1a1a; margin-top: 0;">Restablecer contraseña</h2>
    
    <p>Hola${targetUserName ? ` <strong>${targetUserName}</strong>` : ''},</p>
    
    <p><strong>${adminName}</strong> ha solicitado restablecer tu contraseña en <strong>${workspaceName}</strong>.</p>
    
    <p>Haz clic en el botón siguiente para establecer una nueva contraseña:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
        Restablecer Contraseña
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      O copia y pega este enlace en tu navegador:<br>
      <a href="${resetLink}" style="color: #0070f3; word-break: break-all;">${resetLink}</a>
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      <strong>Importante:</strong> Este enlace expirará en 24 horas.<br>
      Si no solicitaste este restablecimiento, puedes ignorar este correo o contactar a tu administrador.
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
      
      const { data: resendData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: targetUserEmail,
        subject: subject,
        html: emailHtml,
      });

      if (resendError) {
        console.error("[ResetPassword] Error enviando email con Resend:", resendError);
        
        let errorMessage = resendError.message || "Error al enviar el correo";
        
        if (resendError.message?.includes("testing emails") || resendError.message?.includes("verify a domain")) {
          errorMessage = `No se puede enviar el correo: ${resendError.message}. Por favor, verifica un dominio en https://resend.com/domains y configura RESEND_FROM_EMAIL con un email de ese dominio (ej: noreply@tudominio.com).`;
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }

      console.log("[ResetPassword] Email enviado exitosamente:", resendData);

      // Registrar actividad de reset de contraseña
      try {
        await createActivity(supabase, {
          type: 'UPDATE',
          description: `Envió enlace de restablecimiento de contraseña a ${targetUserName || targetUserEmail}`,
          entity_type: 'user',
          entity_id: userId,
          workspace_id: workspaceId,
          metadata: {
            target_user_id: userId,
            target_user_email: targetUserEmail,
            target_user_name: targetUserName,
            action: 'password_reset_link_sent',
          },
        });
      } catch (activityError) {
        console.error("[ResetPassword] Error registrando actividad:", activityError);
        // No fallar si la actividad no se registra
      }

      return NextResponse.json({ 
        success: true,
        message: "Enlace de restablecimiento de contraseña enviado exitosamente"
      });
    } catch (error: any) {
      console.error("[ResetPassword] Error inesperado enviando email:", error);
      return NextResponse.json(
        { error: error.message || "Error al enviar el correo" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[ResetPassword] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

