import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateInviteToken } from "@/lib/supabase/invitations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Validar el token
    const invite = await validateInviteToken(supabase, token);
    if (!invite) {
      return NextResponse.json(
        { error: "Token de invitación inválido o expirado" },
        { status: 400 }
      );
    }

    // Verificar si el usuario ya existe
    // En Supabase v2, getUserByEmail no existe, usamos listUsers y filtramos manualmente
    let existingUser;
    try {
      console.log("[AcceptInvite] Verificando si el usuario ya existe con email:", invite.email);
      const { data: usersData, error: listUsersError } = await supabase.auth.admin.listUsers();
      
      console.log("[AcceptInvite] Resultado de listUsers:", {
        hasError: !!listUsersError,
        error: listUsersError,
        usersCount: usersData?.users?.length || 0,
        allUsers: usersData?.users?.map(u => ({ id: u.id, email: u.email })),
      });
      
      if (!listUsersError && usersData?.users) {
        // Filtrar manualmente por email (el filtro de listUsers puede no funcionar correctamente)
        existingUser = usersData.users.find(user => 
          user.email?.toLowerCase() === invite.email.toLowerCase()
        );
        
        if (existingUser) {
          console.log("[AcceptInvite] Usuario existente encontrado:", {
            id: existingUser.id,
            email: existingUser.email,
          });
        } else {
          console.log("[AcceptInvite] Usuario no existe, se creará uno nuevo");
        }
      } else {
        console.log("[AcceptInvite] Error al listar usuarios o no hay usuarios, se creará uno nuevo");
      }
    } catch (error) {
      // Si el usuario no existe, continuamos con la creación del usuario
      console.error("[AcceptInvite] Error verificando usuario existente:", error);
      console.log("[AcceptInvite] Continuando con creación de nuevo usuario");
    }

    if (existingUser) {
      // El usuario ya existe, solo agregarlo al workspace si no está ya agregado
      const userId = existingUser.id;
      
      // Verificar si ya está en el workspace
      const { data: existingMembership } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', invite.workspace_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingMembership) {
        // Agregar al workspace
        const { error: membershipError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: invite.workspace_id,
            user_id: userId,
            role: invite.role,
            status: 'ACTIVE',
            created_by_user_id: invite.invited_by_user_id,
          });

        if (membershipError) {
          console.error("[AcceptInvite] Error agregando usuario al workspace:", membershipError);
          return NextResponse.json(
            { error: "Error al agregar usuario al workspace" },
            { status: 500 }
          );
        }
      }

      // Actualizar la invitación
      const { error: updateError } = await supabase
        .from('workspace_invites')
        .update({
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: userId,
        })
        .eq('id', invite.id);

      if (updateError) {
        console.error("[AcceptInvite] Error actualizando invitación:", updateError);
        return NextResponse.json(
          { error: "Error al actualizar la invitación" },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true,
        message: "Invitación aceptada. El usuario ya existía y fue agregado al workspace."
      });
    }

    // Crear el nuevo usuario usando Admin API
    console.log("[AcceptInvite] Intentando crear usuario con email:", invite.email);
    const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
      email: invite.email,
      password: password,
      email_confirm: true, // Confirmar el email automáticamente
      user_metadata: {
        full_name: invite.display_name || null,
        first_name: invite.display_name?.split(' ')[0] || null,
        last_name: invite.display_name?.split(' ').slice(1).join(' ') || null,
      },
    });

    console.log("[AcceptInvite] Respuesta de createUser:", {
      hasData: !!newUser,
      hasUser: !!newUser?.user,
      userId: newUser?.user?.id,
      email: newUser?.user?.email,
      error: signUpError,
      errorMessage: signUpError?.message,
      errorStatus: signUpError?.status,
    });

    if (signUpError) {
      console.error("[AcceptInvite] Error creando usuario:", {
        message: signUpError.message,
        status: signUpError.status,
        name: signUpError.name,
        error: signUpError,
      });
      return NextResponse.json(
        { 
          error: signUpError.message || "Error al crear el usuario",
          details: signUpError.status ? `Status: ${signUpError.status}` : undefined,
        },
        { status: 500 }
      );
    }

    if (!newUser?.user) {
      console.error("[AcceptInvite] createUser no retornó usuario:", { newUser });
      return NextResponse.json(
        { error: "Error al crear el usuario: No se recibió respuesta del servidor" },
        { status: 500 }
      );
    }

    const userId = newUser.user.id;
    console.log("[AcceptInvite] Usuario creado exitosamente con ID:", userId);

    // ACTUALIZACIÓN: Forzar actualización de contraseña para asegurar que funcione con signInWithPassword
    // Esto es necesario porque algunas versiones de Supabase requieren actualizar la contraseña
    // explícitamente después de crearla con Admin API para que funcione correctamente con signInWithPassword
    const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updatePasswordError) {
      console.error("[AcceptInvite] Error actualizando contraseña:", updatePasswordError);
      // No fallar aquí, pero registrar el error para debugging
      // El usuario ya fue creado, así que continuamos con el flujo
    }

    // Agregar al workspace
    const { error: membershipError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: userId,
        role: invite.role,
        status: 'ACTIVE',
        created_by_user_id: invite.invited_by_user_id,
      });

    if (membershipError) {
      console.error("[AcceptInvite] Error agregando usuario al workspace:", membershipError);
      // Intentar eliminar el usuario creado si falla agregarlo al workspace
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Error al agregar usuario al workspace" },
        { status: 500 }
      );
    }

    // Actualizar la invitación
    const { error: updateError } = await supabase
      .from('workspace_invites')
      .update({
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId,
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error("[AcceptInvite] Error actualizando invitación:", updateError);
      return NextResponse.json(
        { error: "Error al actualizar la invitación" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "Cuenta creada exitosamente. Ya puedes iniciar sesión."
    });
  } catch (error: any) {
    console.error("[AcceptInvite] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error inesperado al aceptar la invitación" },
      { status: 500 }
    );
  }
}

