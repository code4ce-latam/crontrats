import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { type UserRole } from "@/lib/supabase/users";
import { createActivity } from "@/lib/supabase/activities";

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
    const { userId, firstName, lastName, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario actual tiene permisos (debe ser OWNER para editar roles)
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

    const currentUserRole = currentMembership.role as UserRole;
    const workspaceId = currentMembership.workspace_id;

    // Verificar que el usuario a editar pertenece al mismo workspace
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

    // Si se intenta cambiar el rol, verificar que el usuario actual es OWNER
    if (role && role !== targetMembership.role) {
      if (currentUserRole !== 'OWNER') {
        return NextResponse.json(
          { error: "Solo los propietarios pueden cambiar roles" },
          { status: 403 }
        );
      }

      // Actualizar el rol en workspace_members
      console.log("[UpdateUser] Intentando actualizar rol:", {
        membershipId: targetMembership.id,
        oldRole: targetMembership.role,
        newRole: role,
        currentUserRole: currentUserRole
      });

      const { data: updatedMembership, error: roleUpdateError } = await supabase
        .from('workspace_members')
        .update({ role: role as UserRole })
        .eq('id', targetMembership.id)
        .select()
        .single();

      if (roleUpdateError) {
        console.error("[UpdateUser] Error actualizando rol:", roleUpdateError);
        return NextResponse.json(
          { error: `Error al actualizar el rol: ${roleUpdateError.message}` },
          { status: 500 }
        );
      }

      console.log("[UpdateUser] Rol actualizado exitosamente:", {
        membershipId: updatedMembership?.id,
        newRole: updatedMembership?.role
      });
    }

    // Obtener información del usuario objetivo UNA SOLA VEZ si se necesita (para rol o nombres)
    // Esto evita llamadas duplicadas a getUserById
    let targetUserInfo: any = null;
    let targetUserEmail = userId;
    let targetUserName = null;
    
    if ((role && role !== targetMembership.role) || firstName !== undefined || lastName !== undefined) {
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userData?.user) {
          targetUserInfo = userData.user;
          targetUserEmail = userData.user.email || userId;
          targetUserName = 
            userData.user.user_metadata?.full_name ||
            userData.user.user_metadata?.name ||
            `${userData.user.user_metadata?.first_name || ''} ${userData.user.user_metadata?.last_name || ''}`.trim() ||
            null;
        }
      } catch (err) {
        console.warn("[UpdateUser] No se pudo obtener información del usuario objetivo:", err);
      }
    }

    // Registrar actividad de actualización de rol (si se actualizó)
    if (role && role !== targetMembership.role) {
      try {
        const roleLabels: Record<string, string> = {
          'OWNER': 'Propietario',
          'EDITOR': 'Editor',
          'READER': 'Lector',
        };
        const oldRoleLabel = roleLabels[targetMembership.role] || targetMembership.role;
        const newRoleLabel = roleLabels[role] || role;
        
        await createActivity(supabase, {
          type: 'UPDATE',
          description: `Actualizó el rol de ${targetUserName || targetUserEmail} de ${oldRoleLabel} a ${newRoleLabel}`,
          entity_type: 'workspace_member',
          entity_id: targetMembership.id,
          workspace_id: workspaceId,
          metadata: {
            target_user_id: userId,
            target_user_email: targetUserEmail,
            target_user_name: targetUserName,
            old_role: targetMembership.role,
            new_role: role,
            old_role_label: oldRoleLabel,
            new_role_label: newRoleLabel,
          },
        });
      } catch (activityError) {
        console.error("[UpdateUser] Error registrando actividad de rol:", activityError);
      }
    }

    // Actualizar nombres en auth.users usando admin client
    const updateData: any = {};
    if (firstName !== undefined) {
      updateData.first_name = firstName;
    }
    if (lastName !== undefined) {
      updateData.last_name = lastName;
    }

    if (firstName !== undefined || lastName !== undefined) {
      // Construir full_name si hay nombres
      if (firstName || lastName) {
        updateData.full_name = `${firstName || ''} ${lastName || ''}`.trim();
      }

      // targetUserInfo ya debería estar disponible si se actualizó el rol
      // Si no, significa que solo se actualizan nombres y no se obtuvo antes
      if (!targetUserInfo) {
        console.error("[UpdateUser] targetUserInfo no disponible para actualizar nombres");
        return NextResponse.json(
          { error: "Error: información del usuario no disponible" },
          { status: 500 }
        );
      }

      // Guardar valores anteriores para la actividad
      const previousFirstName = targetUserInfo.user_metadata?.first_name || null;
      const previousLastName = targetUserInfo.user_metadata?.last_name || null;

      // Actualizar user_metadata usando admin client
      const currentMetadata = targetUserInfo.user_metadata || {};
      const newMetadata = {
        ...currentMetadata,
        ...updateData,
      };

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: newMetadata,
      });

      if (updateError) {
        console.error("[UpdateUser] Error actualizando usuario:", updateError);
        return NextResponse.json(
          { error: "Error al actualizar la información del usuario" },
          { status: 500 }
        );
      }

      // Registrar actividad de actualización de información del usuario
      try {
        
        const changes: string[] = [];
        if (firstName !== undefined && firstName !== previousFirstName) {
          changes.push(`nombre: "${previousFirstName || '(vacío)'}" → "${firstName || '(vacío)'}"`);
        }
        if (lastName !== undefined && lastName !== previousLastName) {
          changes.push(`apellido: "${previousLastName || '(vacío)'}" → "${lastName || '(vacío)'}"`);
        }

        const description = changes.length > 0
          ? `Actualizó la información de ${targetUserName || targetUserEmail}: ${changes.join(', ')}`
          : `Actualizó la información de ${targetUserName || targetUserEmail}`;

        await createActivity(supabase, {
          type: 'UPDATE',
          description: description,
          entity_type: 'user',
          entity_id: userId,
          workspace_id: workspaceId,
          metadata: {
            target_user_id: userId,
            target_user_email: targetUserEmail,
            target_user_name: targetUserName,
            first_name: firstName,
            last_name: lastName,
            previous_first_name: previousFirstName,
            previous_last_name: previousLastName,
          },
        });
      } catch (activityError) {
        console.error("[UpdateUser] Error registrando actividad de información:", activityError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Usuario actualizado exitosamente"
    });
  } catch (error: any) {
    console.error("[UpdateUser] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

