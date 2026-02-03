import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getContractAccess, getUserWorkspaceId } from "@/lib/supabase/contracts";
import { annotationsToJsonb } from "@/lib/document-annotator/annotations";
import type { AnchorComment, TextHighlight } from "@/types/document-annotations";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      file_version_id,
      contract_id,
      comments,
      highlights,
      status = "DRAFT",
    } = body;

    if (!file_version_id) {
      return NextResponse.json(
        { error: "file_version_id es requerido" },
        { status: 400 }
      );
    }

    if (!contract_id) {
      return NextResponse.json(
        { error: "contract_id es requerido" },
        { status: 400 }
      );
    }

    if (!Array.isArray(comments) || !Array.isArray(highlights)) {
      return NextResponse.json(
        { error: "comments y highlights deben ser arrays" },
        { status: 400 }
      );
    }

    // Verificar acceso al contrato (debe tener permisos de edición para guardar)
    const access = await getContractAccess(supabase, contract_id);
    if (!access || (access !== "OWNER" && access !== "EDIT")) {
      return NextResponse.json(
        { error: "No tienes permisos para guardar anotaciones en este contrato" },
        { status: 403 }
      );
    }

    // Verificar que el file_version_id pertenece al contract_id
    const { data: fileVersion, error: versionError } = await supabase
      .from("contract_file_versions")
      .select("contract_id")
      .eq("id", file_version_id)
      .maybeSingle();

    if (versionError || !fileVersion) {
      return NextResponse.json(
        { error: "Versión de archivo no encontrada" },
        { status: 404 }
      );
    }

    if (fileVersion.contract_id !== contract_id) {
      return NextResponse.json(
        { error: "La versión de archivo no pertenece al contrato especificado" },
        { status: 400 }
      );
    }

    // Obtener workspace_id
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No se pudo obtener el workspace" },
        { status: 500 }
      );
    }

    // Convertir anotaciones a formato JSONB
    const annotationsJson = annotationsToJsonb(
      comments as AnchorComment[],
      highlights as TextHighlight[]
    );

    // Verificar si ya existe un registro de anotaciones para esta versión
    const { data: existing } = await supabase
      .from("contract_file_annotations")
      .select("id")
      .eq("file_version_id", file_version_id)
      .eq("status", status)
      .maybeSingle();

    let result;
    if (existing) {
      // Actualizar registro existente
      result = await supabase
        .from("contract_file_annotations")
        .update({
          annotations_json: annotationsJson,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Crear nuevo registro
      result = await supabase
        .from("contract_file_annotations")
        .insert({
          file_version_id,
          contract_id,
          workspace_id: workspaceId,
          annotations_json: annotationsJson,
          status,
          created_by_user_id: user.id,
        });
    }

    if (result.error) {
      console.error("[Annotations/Save] Error guardando en DB:", result.error);
      return NextResponse.json(
        { error: "Error al guardar las anotaciones en la base de datos" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Anotaciones guardadas exitosamente",
    });
  } catch (error: any) {
    console.error("[Annotations/Save] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al guardar anotaciones" },
      { status: 500 }
    );
  }
}

