import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createActivity } from "@/lib/supabase/activities";
import { Resend } from "resend";

// Función para generar contraseña temporal
function generateTemporaryPassword(length: number = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function POST(request: NextRequest) {
  console.log("[SendTemporaryPassword] ===== POST handler EJECUTÁNDOSE =====");
  
  try {
    // Validar variables de entorno críticas al inicio
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const passwordLength = parseInt(process.env.TEMPORARY_PASSWORD_LENGTH || "12", 10);

    if (!resendApiKey) {
      console.error("[SendTemporaryPassword] RESEND_API_KEY no está configurada");
      return NextResponse.json(
        { error: "Servicio de email no configurado. RESEND_API_KEY no está configurada." },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    if (!fromEmail) {
      console.error("[SendTemporaryPassword] RESEND_FROM_EMAIL no está configurada");
      return NextResponse.json(
        { 
          error: "RESEND_FROM_EMAIL no está configurada. Por favor, configura esta variable de entorno con un email de tu dominio verificado en Resend (ej: noreply@tudominio.com)."
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    if (!supabaseServiceRoleKey || !supabaseUrl) {
      console.error("[SendTemporaryPassword] Variables de Supabase no configuradas");
      return NextResponse.json(
        { error: "Configuración de base de datos incompleta" },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    // Parsear el body
    const body = await request.json();
    const { email } = body;

    console.log("[SendTemporaryPassword] Email recibido:", email);

    if (!email || !email.trim()) {
      console.log("[SendTemporaryPassword] Email vacío, devolviendo error 400");
      return NextResponse.json(
        { error: "El email es requerido" },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    // Crear cliente admin de Supabase
    const supabaseAdmin = createAdminClient();

    // Buscar usuario por email
    console.log("[SendTemporaryPassword] Buscando usuario con email:", email.trim());
    const { data: usersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listUsersError) {
      console.error("[SendTemporaryPassword] Error listando usuarios:", listUsersError);
      return NextResponse.json(
        { error: "Error al buscar el usuario" },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    // Buscar usuario por email (case-insensitive)
    const user = usersData?.users?.find(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (!user) {
      console.log("[SendTemporaryPassword] Usuario no encontrado con email:", email.trim());
      // Por seguridad, no revelamos si el email existe o no
      return NextResponse.json(
        { 
          success: true,
          message: "Si el email existe en nuestro sistema, recibirás una contraseña temporal."
        },
        { 
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    console.log("[SendTemporaryPassword] Usuario encontrado:", user.id);

    // Generar contraseña temporal
    const temporaryPassword = generateTemporaryPassword(passwordLength);
    console.log("[SendTemporaryPassword] Contraseña temporal generada (longitud:", passwordLength + ")");

    // Actualizar contraseña del usuario
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        password: temporaryPassword,
        user_metadata: {
          ...user.user_metadata,
          requires_password_change: true,
          temporary_password_set_at: new Date().toISOString(),
        }
      }
    );

    if (updateError) {
      console.error("[SendTemporaryPassword] Error actualizando contraseña:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar la contraseña del usuario" },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }

    console.log("[SendTemporaryPassword] Contraseña actualizada exitosamente");

    // Obtener nombre del usuario
    const userName = 
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
      user.email?.split("@")[0] ||
      "Usuario";

    // Construir el contenido del email
    const subject = "Contraseña temporal - CODE4CE";
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #1a1a1a; margin-top: 0;">Contraseña temporal</h2>
    
    <p>Hola${userName ? ` <strong>${userName}</strong>` : ''},</p>
    
    <p>Has solicitado una contraseña temporal para recuperar el acceso a tu cuenta.</p>
    
    <div style="background-color: #f5f5f5; border-left: 4px solid #0070f3; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">
        Tu contraseña temporal es:
      </p>
      <p style="margin: 10px 0 0 0; font-size: 24px; font-family: monospace; letter-spacing: 2px; color: #0070f3;">
        ${temporaryPassword}
      </p>
    </div>
    
    <p><strong>Importante:</strong> Por seguridad, deberás cambiar esta contraseña temporal después de iniciar sesión.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/login" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
        Iniciar Sesión
      </a>
    </div>
    
    <p style="font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
      <strong>Nota de seguridad:</strong> Si no solicitaste esta contraseña temporal, por favor contacta al administrador inmediatamente.
    </p>
    
    <p style="font-size: 12px; color: #999; margin-top: 20px;">
      Saludos,<br>
      El equipo de CODE4CE
    </p>
  </div>
</body>
</html>
    `.trim();

    // Enviar el correo usando Resend
    try {
      console.log("[SendTemporaryPassword] Enviando email con Resend a:", email.trim());
      const resend = new Resend(resendApiKey);
      
      const { data: resendData, error: resendError } = await resend.emails.send({
        from: fromEmail,
        to: email.trim(),
        subject: subject,
        html: emailHtml,
      });

      if (resendError) {
        console.error("[SendTemporaryPassword] Error enviando email con Resend:", resendError);
        
        let errorMessage = resendError.message || "Error al enviar el correo";
        
        if (resendError.message?.includes("testing emails") || resendError.message?.includes("verify a domain")) {
          errorMessage = `No se puede enviar el correo: ${resendError.message}. Por favor, verifica un dominio en https://resend.com/domains y configura RESEND_FROM_EMAIL con un email de ese dominio (ej: noreply@tudominio.com).`;
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { 
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );
      }

      console.log("[SendTemporaryPassword] Email enviado exitosamente:", resendData);

      // Registrar actividad de envío de contraseña temporal
      try {
        const supabase = await createClient();
        
        // Obtener información del workspace del usuario actual
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data: membership } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', currentUser.id)
            .eq('status', 'ACTIVE')
            .limit(1)
            .maybeSingle();

          const workspaceId = membership?.workspace_id || null;

          // Obtener nombre del usuario objetivo
          const targetUserName = 
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
            user.email?.split("@")[0] ||
            "Usuario";

          await createActivity(supabase, {
            type: 'UPDATE',
            description: `Envió contraseña temporal a ${targetUserName || user.email}`,
            entity_type: 'user',
            entity_id: user.id,
            workspace_id: workspaceId,
            metadata: {
              target_user_id: user.id,
              target_user_email: user.email,
              target_user_name: targetUserName,
              action: 'temporary_password_sent',
            },
          });
        }
      } catch (activityError) {
        console.error("[SendTemporaryPassword] Error registrando actividad:", activityError);
        // No fallar si la actividad no se registra
      }

      return NextResponse.json({ 
        success: true,
        message: "Contraseña temporal enviada exitosamente por correo"
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } catch (error: any) {
      console.error("[SendTemporaryPassword] Error inesperado enviando email:", error);
      console.error("[SendTemporaryPassword] Stack:", error?.stack);
      return NextResponse.json(
        { error: error.message || "Error al enviar el correo" },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
  } catch (error: any) {
    console.error("[SendTemporaryPassword] ===== ERROR CAPTURADO =====");
    console.error("[SendTemporaryPassword] Error:", error);
    console.error("[SendTemporaryPassword] Stack:", error?.stack);
    
    return NextResponse.json(
      { 
        error: error.message || "Error al procesar la solicitud" 
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}
