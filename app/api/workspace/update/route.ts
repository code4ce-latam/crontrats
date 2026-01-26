import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActivity } from "@/lib/supabase/activities";
import { isValidTimezone } from "@/lib/timezones";

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
    const { workspace_id, name, timezone } = body;

    if (!workspace_id) {
      return NextResponse.json(
        { error: "workspace_id es requerido" },
        { status: 400 }
      );
    }

    // Al menos uno de name o timezone debe estar presente
    if (!name && !timezone) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos 'name' o 'timezone' para actualizar" },
        { status: 400 }
      );
    }

    // Validar name si se proporciona
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json(
        { error: "El nombre del workspace no puede estar vacío" },
        { status: 400 }
      );
    }

    // Validar timezone si se proporciona
    if (timezone !== undefined && !isValidTimezone(timezone)) {
      return NextResponse.json(
        { error: "La zona horaria proporcionada no es válida" },
        { status: 400 }
      );
    }

    // Verificar que el usuario es OWNER del workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role, workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .eq('status', 'ACTIVE')
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "No se pudo verificar tu membresía en el workspace" },
        { status: 403 }
      );
    }

    if (membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: "Solo los propietarios pueden actualizar la configuración del workspace" },
        { status: 403 }
      );
    }

    // Verificar que el workspace existe
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, timezone')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace no encontrado" },
        { status: 404 }
      );
    }

    // Construir objeto de actualización solo con los campos proporcionados
    const updateData: { name?: string; timezone?: string } = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    // Actualizar el workspace
    const { error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update(updateData)
      .eq('id', workspace_id);

    if (updateError) {
      console.error("[Workspace/Update] Error actualizando workspace:", updateError);
      return NextResponse.json(
        { error: `Error al actualizar el workspace: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      const activityDescriptions: string[] = [];
      
      if (name !== undefined && name.trim() !== workspace.name) {
        activityDescriptions.push(`actualizó el nombre del workspace de "${workspace.name}" a "${name.trim()}"`);
      }
      
      if (timezone !== undefined && timezone !== (workspace.timezone || 'UTC')) {
        const oldTimezone = workspace.timezone || 'UTC';
        activityDescriptions.push(`actualizó la zona horaria del workspace de "${oldTimezone}" a "${timezone}"`);
      }

      if (activityDescriptions.length > 0) {
        await createActivity(supabase, {
          type: 'UPDATE',
          description: activityDescriptions.join(' y '),
          entity_type: 'workspace',
          entity_id: workspace_id,
        });
      }
    } catch (activityError) {
      console.error("[Workspace/Update] Error registrando actividad:", activityError);
      // No fallar si hay error en la actividad
    }

    return NextResponse.json({
      success: true,
      message: "Workspace actualizado correctamente",
    });
  } catch (error: any) {
    console.error("[Workspace/Update] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el workspace" },
      { status: 500 }
    );
  }
}

