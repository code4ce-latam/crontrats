import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { deleteContractProfile, getUserWorkspaceId } from "@/lib/supabase/contract-profiles";
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
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario tiene permisos (solo OWNER)
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

    if (membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: "Solo los propietarios pueden eliminar perfiles" },
        { status: 403 }
      );
    }

    // Verificar que el perfil pertenece al mismo workspace y obtener nombre
    const { data: profile } = await supabase
      .from('contract_profiles')
      .select('workspace_id, name')
      .eq('id', profileId)
      .single();

    if (!profile || profile.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "El perfil no pertenece a tu workspace" },
        { status: 403 }
      );
    }

    // Eliminar el perfil (soft delete)
    const success = await deleteContractProfile(supabase, profileId);

    if (!success) {
      return NextResponse.json(
        { error: "Error al eliminar el perfil" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'DELETE',
        description: `Eliminó el perfil de contrato "${profile.name}"`,
        entity_type: 'contract_profile',
        entity_id: profileId,
        workspace_id: workspaceId,
        metadata: {
          profile_id: profileId,
          profile_name: profile.name,
        },
      });
    } catch (activityError) {
      console.error("[DeleteContractProfile] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[DeleteContractProfile] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar el perfil" },
      { status: 500 }
    );
  }
}

