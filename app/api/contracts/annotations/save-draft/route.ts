import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";
import { getFileVersionContext, validateAnnotationPermissions } from "@/lib/supabase/annotations";
import { createActivity } from "@/lib/supabase/activities";
import type { Annotation } from "@/lib/annotations/types";

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
    const { file_version_id, annotations_json } = body;

    if (!file_version_id) {
      return NextResponse.json(
        { error: "file_version_id es requerido" },
        { status: 400 }
      );
    }

    if (!Array.isArray(annotations_json)) {
      return NextResponse.json(
        { error: "annotations_json debe ser un array" },
        { status: 400 }
      );
    }

    // Validar formato básico de anotaciones
    for (const ann of annotations_json) {
      if (!ann.id || !ann.page || !ann.type || !ann.rect) {
        return NextResponse.json(
          { error: "Formato de anotación inválido" },
          { status: 400 }
        );
      }
      // Permitir texto vacío en borradores (se puede completar después)
      // Solo validar que el campo text existe si es TEXT o COMMENT
      if (ann.type === 'TEXT' || ann.type === 'COMMENT') {
        if (ann.text === undefined || ann.text === null) {
          return NextResponse.json(
            { error: "Las anotaciones TEXT y COMMENT requieren el campo text (puede estar vacío)" },
            { status: 400 }
          );
        }
      }
    }

    // Obtener contexto (contract_id, workspace_id, folder_id)
    const context = await getFileVersionContext(supabase, file_version_id);
    if (!context) {
      return NextResponse.json(
        { error: "Versión de archivo no encontrada" },
        { status: 404 }
      );
    }

    // Validar permiso EDIT/OWNER
    const hasPermission = await validateAnnotationPermissions(supabase, context.folder_id, 'EDIT');
    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos para editar anotaciones" },
        { status: 403 }
      );
    }

    // Buscar draft existente
    const { data: existingDraft } = await supabase
      .from('contract_file_annotations')
      .select('id')
      .eq('file_version_id', file_version_id)
      .eq('created_by_user_id', user.id)
      .eq('status', 'DRAFT')
      .maybeSingle();

    if (existingDraft) {
      // UPDATE draft existente
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('contract_file_annotations')
        .update({
          annotations_json: annotations_json as Annotation[],
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDraft.id)
        .select()
        .single();

      if (updateError) {
        console.error("[Annotations/SaveDraft] Error actualizando draft:", updateError);
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      // Registrar actividad
      await createActivity(supabase, {
        type: 'ANNOTATION_DRAFT_SAVED',
        entity_type: 'contract_file_version',
        entity_id: file_version_id,
        description: `Borrador de anotaciones guardado (${annotations_json.length} anotaciones)`,
        metadata: { count: annotations_json.length },
        workspace_id: context.workspace_id,
      });

      return NextResponse.json({
        success: true,
        annotation: updated,
      });
    } else {
      // INSERT nuevo draft
      const { data: newDraft, error: insertError } = await supabaseAdmin
        .from('contract_file_annotations')
        .insert({
          workspace_id: context.workspace_id,
          contract_id: context.contract_id,
          file_version_id: file_version_id,
          status: 'DRAFT',
          annotations_json: annotations_json as Annotation[],
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[Annotations/SaveDraft] Error creando draft:", insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      // Registrar actividad
      await createActivity(supabase, {
        type: 'ANNOTATION_DRAFT_SAVED',
        entity_type: 'contract_file_version',
        entity_id: file_version_id,
        description: `Borrador de anotaciones creado (${annotations_json.length} anotaciones)`,
        metadata: { count: annotations_json.length },
        workspace_id: context.workspace_id,
      });

      return NextResponse.json({
        success: true,
        annotation: newDraft,
      });
    }
  } catch (error: any) {
    console.error("[Annotations/SaveDraft] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al guardar borrador" },
      { status: 500 }
    );
  }
}

