import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { reorderProfileFields, getUserWorkspaceId } from "@/lib/supabase/contract-profiles";
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
    const { fieldIds } = body;

    if (!fieldIds || !Array.isArray(fieldIds) || fieldIds.length === 0) {
      return NextResponse.json(
        { error: "fieldIds es requerido y debe ser un array" },
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
        { error: "No tienes permisos para reordenar campos" },
        { status: 403 }
      );
    }

    // Verificar que todos los campos pertenecen al mismo workspace y obtener datos del perfil
    const { data: fields } = await supabase
      .from('contract_profile_fields')
      .select('id, workspace_id, profile_id, contract_profiles(name)')
      .in('id', fieldIds);

    if (!fields || fields.length !== fieldIds.length) {
      return NextResponse.json(
        { error: "Algunos campos no fueron encontrados" },
        { status: 400 }
      );
    }

    const allBelongToWorkspace = fields.every(field => field.workspace_id === workspaceId);
    if (!allBelongToWorkspace) {
      return NextResponse.json(
        { error: "Algunos campos no pertenecen a tu workspace" },
        { status: 403 }
      );
    }

    // Obtener nombre del perfil (todos los campos deben ser del mismo perfil)
    const profileId = fields[0]?.profile_id;
    const profileName = (fields[0] as any)?.contract_profiles?.name || 'desconocido';

    // Reordenar los campos
    const success = await reorderProfileFields(supabase, fieldIds);

    if (!success) {
      return NextResponse.json(
        { error: "Error al reordenar los campos" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'UPDATE',
        description: `Reordenó ${fieldIds.length} ${fieldIds.length === 1 ? 'campo' : 'campos'} del perfil "${profileName}"`,
        entity_type: 'contract_profile_field',
        entity_id: profileId, // Usar profile_id ya que es una operación sobre múltiples campos
        workspace_id: workspaceId,
        metadata: {
          profile_id: profileId,
          profile_name: profileName,
          field_ids: fieldIds,
          fields_count: fieldIds.length,
          action: 'reorder',
        },
      });
    } catch (activityError) {
      console.error("[ReorderProfileFields] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ReorderProfileFields] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al reordenar los campos" },
      { status: 500 }
    );
  }
}

