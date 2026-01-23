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
    let existingUser;
    try {
      const { data: userData, error: getUserError } = await supabase.auth.admin.getUserByEmail(invite.email);
      if (!getUserError && userData?.user) {
        existingUser = userData.user;
      }
    } catch (error) {
      // Si el usuario no existe, getUserByEmail puede lanzar un error
      // Esto es normal, continuamos con la creación del usuario
      console.log("[AcceptInvite] Usuario no existe, se creará uno nuevo");
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

    if (signUpError || !newUser?.user) {
      console.error("[AcceptInvite] Error creando usuario:", signUpError);
      return NextResponse.json(
        { error: signUpError?.message || "Error al crear el usuario" },
        { status: 500 }
      );
    }

    const userId = newUser.user.id;

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

