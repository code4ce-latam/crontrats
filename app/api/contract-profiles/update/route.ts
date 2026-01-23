import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { updateContractProfile, getUserWorkspaceId } from "@/lib/supabase/contract-profiles";
import { createActivity } from "@/lib/supabase/activities";

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
    const { profileId, name, description, is_active } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId es requerido" },
        { status: 400 }
      );
    }

    // Validaciones
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: "El nombre no puede estar vacío" },
          { status: 400 }
        );
      }
      if (name.length > 255) {
        return NextResponse.json(
          { error: "El nombre no puede exceder 255 caracteres" },
          { status: 400 }
        );
      }
    }

    if (description !== undefined && description && description.length > 1000) {
      return NextResponse.json(
        { error: "La descripción no puede exceder 1000 caracteres" },
        { status: 400 }
      );
    }

    // Verificar que el usuario tiene permisos (OWNER o EDITOR)
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del workspace" },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del workspace" },
        { status: 400 }
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'EDITOR') {
      return NextResponse.json(
        { error: "No tienes permisos para editar perfiles" },
        { status: 403 }
      );
    }

    // Verificar que el perfil pertenece al mismo workspace y obtener datos originales
    const { data: originalProfile } = await supabase
      .from('contract_profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (!originalProfile || originalProfile.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "El perfil no pertenece a tu workspace" },
        { status: 403 }
      );
    }

    // Actualizar el perfil
    const updatedProfile = await updateContractProfile(supabase, profileId, {
      name: name?.trim(),
      description: description?.trim() || null,
      is_active,
    });

    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Error al actualizar el perfil" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      const changes: string[] = [];
      if (name !== undefined && name.trim() !== originalProfile.name) {
        changes.push(`nombre: "${originalProfile.name}" → "${name.trim()}"`);
      }
      if (description !== undefined && (description?.trim() || null) !== originalProfile.description) {
        changes.push(`descripción: "${originalProfile.description || '(vacío)'}" → "${description?.trim() || '(vacío)'}"`);
      }
      if (is_active !== undefined && is_active !== originalProfile.is_active) {
        changes.push(`estado: "${originalProfile.is_active ? 'Activo' : 'Inactivo'}" → "${is_active ? 'Activo' : 'Inactivo'}"`);
      }

      const activityDescription = changes.length > 0
        ? `Actualizó el perfil de contrato "${updatedProfile.name}": ${changes.join(', ')}`
        : `Actualizó el perfil de contrato "${updatedProfile.name}"`;

      await createActivity(supabase, {
        type: 'UPDATE',
        description: activityDescription,
        entity_type: 'contract_profile',
        entity_id: profileId,
        workspace_id: workspaceId,
        metadata: {
          profile_id: profileId,
          profile_name: updatedProfile.name,
          old_name: originalProfile.name,
          new_name: name?.trim(),
          old_description: originalProfile.description,
          new_description: description?.trim() || null,
          old_is_active: originalProfile.is_active,
          new_is_active: is_active,
          changes: changes,
        },
      });
    } catch (activityError) {
      console.error("[UpdateContractProfile] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error("[UpdateContractProfile] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el perfil" },
      { status: 500 }
    );
  }
}

