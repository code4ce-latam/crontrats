import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import { validateAnnotationPermissions } from "@/lib/supabase/annotations";
import { createActivity } from "@/lib/supabase/activities";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { annotation_id } = body;

    if (!annotation_id) {
      return NextResponse.json(
        { error: "annotation_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener anotación
    const { data: annotation, error: fetchError } = await supabase
      .from('contract_file_annotations')
      .select(`
        id,
        file_version_id,
        status,
        created_by_user_id,
        contract_file_versions!inner (
          contracts!inner (
            folder_id
          )
        )
      `)
      .eq('id', annotation_id)
      .single();

    if (fetchError || !annotation) {
      return NextResponse.json(
        { error: "Anotación no encontrada" },
        { status: 404 }
      );
    }

    // Validar que es DRAFT del usuario actual
    if (annotation.status !== 'DRAFT' || annotation.created_by_user_id !== user.id) {
      return NextResponse.json(
        { error: "Solo puedes eliminar tus propios borradores" },
        { status: 403 }
      );
    }

    // Obtener folder_id desde la relación
    const folderId = annotation.contract_file_versions?.contracts?.folder_id;
    if (!folderId) {
      return NextResponse.json(
        { error: "No se pudo obtener la carpeta del contrato" },
        { status: 500 }
      );
    }

    // Validar permiso EDIT/OWNER
    const hasPermission = await validateAnnotationPermissions(supabase, folderId, 'EDIT');
    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos para eliminar anotaciones" },
        { status: 403 }
      );
    }

    // Obtener workspace_id antes de eliminar (para actividad)
    const { data: fileVersion } = await supabase
      .from('contract_file_versions')
      .select('contracts!inner(workspace_id)')
      .eq('id', annotation.file_version_id)
      .single();

    const workspaceId = fileVersion?.contracts?.workspace_id;

    // DELETE
    const { error: deleteError } = await supabaseAdmin
      .from('contract_file_annotations')
      .delete()
      .eq('id', annotation_id);

    if (deleteError) {
      console.error("[Annotations/Delete] Error eliminando:", deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Registrar actividad
    if (workspaceId) {
      await createActivity(supabase, {
        type: 'ANNOTATION_DELETED',
        entity_type: 'contract_file_version',
        entity_id: annotation.file_version_id,
        description: "Borrador de anotaciones eliminado",
        metadata: {},
        workspace_id: workspaceId,
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[Annotations/Delete] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar anotación" },
      { status: 500 }
    );
  }
}

