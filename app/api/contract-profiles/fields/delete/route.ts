import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { deleteContractProfileField, getUserWorkspaceId } from "@/lib/supabase/contract-profiles";
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
    const { fieldId } = body;

    if (!fieldId) {
      return NextResponse.json(
        { error: "fieldId es requerido" },
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
        { error: "No tienes permisos para eliminar campos" },
        { status: 403 }
      );
    }

    // Verificar que el campo pertenece al mismo workspace y obtener datos
    const { data: field } = await supabase
      .from('contract_profile_fields')
      .select('workspace_id, label, profile_id, contract_profiles(name)')
      .eq('id', fieldId)
      .single();

    if (!field || field.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "El campo no pertenece a tu workspace" },
        { status: 403 }
      );
    }

    const profileName = (field.contract_profiles as any)?.name || 'desconocido';

    // Eliminar el campo
    const success = await deleteContractProfileField(supabase, fieldId);

    if (!success) {
      return NextResponse.json(
        { error: "Error al eliminar el campo" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'DELETE',
        description: `Eliminó el campo "${field.label}" del perfil "${profileName}"`,
        entity_type: 'contract_profile_field',
        entity_id: fieldId,
        workspace_id: workspaceId,
        metadata: {
          field_id: fieldId,
          field_label: field.label,
          profile_id: field.profile_id,
          profile_name: profileName,
        },
      });
    } catch (activityError) {
      console.error("[DeleteContractProfileField] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DeleteContractProfileField] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el campo" },
      { status: 500 }
    );
  }
}

