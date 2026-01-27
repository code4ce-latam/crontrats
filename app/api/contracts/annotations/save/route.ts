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
    const { file_version_id, annotations_json, notify = false } = body;

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

    // Upsert: buscar anotaciones existentes del usuario para esta versión
    const { data: existing } = await supabase
      .from('contract_file_annotations')
      .select('id')
      .eq('file_version_id', file_version_id)
      .eq('created_by_user_id', user.id)
      .maybeSingle();

    let result;
    if (existing) {
      // UPDATE
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('contract_file_annotations')
        .update({
          annotations_json: annotations_json as Annotation[],
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("[Annotations/Save] Error actualizando:", updateError);
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }
      result = updated;
    } else {
      // INSERT
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('contract_file_annotations')
        .insert({
          workspace_id: context.workspace_id,
          contract_id: context.contract_id,
          file_version_id: file_version_id,
          annotations_json: annotations_json as Annotation[],
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[Annotations/Save] Error creando:", insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
      result = inserted;
    }

    // Registrar actividad
    await createActivity(supabase, {
      type: 'ANNOTATIONS_SAVED',
      entity_type: 'contract_file_version',
      entity_id: file_version_id,
      description: `Anotaciones guardadas (${annotations_json.length} anotaciones)`,
      metadata: { count: annotations_json.length },
      workspace_id: context.workspace_id,
    });

    // Si notify=true, determinar participantes y registrar actividad de notificación
    if (notify) {
      // Obtener participantes (Owners/Editors con acceso al contrato/carpeta)
      const { data: participants } = await supabase
        .from('folder_permissions')
        .select(`
          workspace_members!inner (
            user_id,
            workspace_id
          )
        `)
        .eq('folder_id', context.folder_id)
        .in('access', ['EDIT', 'OWNER'])
        .neq('workspace_members.user_id', user.id); // Excluir al autor

      // Por ahora, solo registramos en activity. En el futuro se puede implementar sistema de notificaciones
      if (participants && participants.length > 0) {
        const participantIds = participants
          .map(p => p.workspace_members?.user_id)
          .filter(Boolean) as string[];

        await createActivity(supabase, {
          type: 'ANNOTATIONS_SAVED',
          entity_type: 'contract_file_version',
          entity_id: file_version_id,
          description: `Anotaciones guardadas y notificadas a ${participantIds.length} participante(s)`,
          metadata: { 
            count: annotations_json.length,
            notify: true,
            participant_count: participantIds.length,
          },
          workspace_id: context.workspace_id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      annotation: result,
    });
  } catch (error: any) {
    console.error("[Annotations/Save] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al guardar anotaciones" },
      { status: 500 }
    );
  }
}

