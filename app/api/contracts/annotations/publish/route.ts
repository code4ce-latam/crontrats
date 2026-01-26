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
    const { file_version_id, annotations_json, source_draft_id } = body;

    if (!file_version_id) {
      return NextResponse.json(
        { error: "file_version_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener contexto
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
        { error: "No tienes permisos para publicar anotaciones" },
        { status: 403 }
      );
    }

    let finalAnnotations: Annotation[] = [];

    if (source_draft_id) {
      // Obtener draft y validar que pertenece al usuario actual
      const { data: draft, error: draftError } = await supabase
        .from('contract_file_annotations')
        .select('annotations_json, created_by_user_id')
        .eq('id', source_draft_id)
        .eq('status', 'DRAFT')
        .single();

      if (draftError || !draft) {
        return NextResponse.json(
          { error: "Borrador no encontrado" },
          { status: 404 }
        );
      }

      if (draft.created_by_user_id !== user.id) {
        return NextResponse.json(
          { error: "No puedes publicar un borrador de otro usuario" },
          { status: 403 }
        );
      }

      finalAnnotations = draft.annotations_json as Annotation[];
    } else if (annotations_json && Array.isArray(annotations_json)) {
      finalAnnotations = annotations_json as Annotation[];
    } else {
      return NextResponse.json(
        { error: "annotations_json o source_draft_id es requerido" },
        { status: 400 }
      );
    }

    // Validar formato básico
    for (const ann of finalAnnotations) {
      if (!ann.id || !ann.page || !ann.type || !ann.rect) {
        return NextResponse.json(
          { error: "Formato de anotación inválido" },
          { status: 400 }
        );
      }
    }

    // INSERT nuevo registro PUBLISHED
    const { data: published, error: insertError } = await supabaseAdmin
      .from('contract_file_annotations')
      .insert({
        workspace_id: context.workspace_id,
        contract_id: context.contract_id,
        file_version_id: file_version_id,
        status: 'PUBLISHED',
        annotations_json: finalAnnotations,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Annotations/Publish] Error publicando:", insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Registrar actividad
    await createActivity(supabase, {
      type: 'ANNOTATION_PUBLISHED',
      entity_type: 'contract_file_version',
      entity_id: file_version_id,
      description: `Anotaciones publicadas (${finalAnnotations.length} anotaciones)`,
      metadata: { count: finalAnnotations.length },
      workspace_id: context.workspace_id,
    });

    return NextResponse.json({
      success: true,
      annotation: published,
    });
  } catch (error: any) {
    console.error("[Annotations/Publish] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al publicar anotaciones" },
      { status: 500 }
    );
  }
}

