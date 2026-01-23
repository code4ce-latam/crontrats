import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createContractProfile, getUserWorkspaceId } from "@/lib/supabase/contract-profiles";
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
    const { name, description } = body;

    // Validaciones
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    if (name.length > 255) {
      return NextResponse.json(
        { error: "El nombre no puede exceder 255 caracteres" },
        { status: 400 }
      );
    }

    if (description && description.length > 1000) {
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
        { error: "No tienes permisos para crear perfiles" },
        { status: 403 }
      );
    }

    // Crear el perfil
    const profile = await createContractProfile(supabase, {
      name: name.trim(),
      description: description?.trim() || null,
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Error al crear el perfil" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'CREATE',
        description: `Creó el perfil de contrato "${profile.name}"`,
        entity_type: 'contract_profile',
        entity_id: profile.id,
        workspace_id: workspaceId,
        metadata: {
          profile_id: profile.id,
          profile_name: profile.name,
          profile_description: profile.description,
        },
      });
    } catch (activityError) {
      console.error("[CreateContractProfile] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("[CreateContractProfile] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear el perfil" },
      { status: 500 }
    );
  }
}

