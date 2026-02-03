import { createClient } from "@/lib/supabase/server";
import type { AnchorComment, TextHighlight } from "@/types/document-annotations";

/**
 * Formato de anotaciones almacenado en la base de datos
 */
export type AnnotationsData = {
  comments: AnchorComment[];
  highlights: TextHighlight[];
  version: number;
};

/**
 * Convierte el formato del prototipo a formato JSONB para la base de datos
 */
export function annotationsToJsonb(
  comments: AnchorComment[],
  highlights: TextHighlight[]
): AnnotationsData {
  return {
    comments,
    highlights,
    version: 1,
  };
}

/**
 * Convierte el formato JSONB de la base de datos al formato del prototipo
 */
export function jsonbToAnnotations(
  jsonb: any
): { comments: AnchorComment[]; highlights: TextHighlight[] } {
  // Si es null o undefined, retornar arrays vacíos
  if (!jsonb) {
    return { comments: [], highlights: [] };
  }

  // Si ya tiene la estructura esperada
  if (jsonb.comments && Array.isArray(jsonb.comments)) {
    return {
      comments: jsonb.comments as AnchorComment[],
      highlights: (jsonb.highlights || []) as TextHighlight[],
    };
  }

  // Si es un array (formato antiguo), intentar parsearlo
  if (Array.isArray(jsonb)) {
    // Intentar separar comentarios y highlights
    const comments: AnchorComment[] = [];
    const highlights: TextHighlight[] = [];

    jsonb.forEach((item: any) => {
      if (item.type === "comment" || item.page !== undefined && item.x !== undefined) {
        comments.push(item as AnchorComment);
      } else if (item.type === "highlight" || item.selectedText !== undefined || item.paintPaths !== undefined) {
        highlights.push(item as TextHighlight);
      }
    });

    return { comments, highlights };
  }

  // Si no coincide con ningún formato conocido, retornar vacío
  return { comments: [], highlights: [] };
}

/**
 * Carga las anotaciones de una versión de archivo desde la base de datos
 */
export async function loadAnnotations(
  fileVersionId: string
): Promise<{ comments: AnchorComment[]; highlights: TextHighlight[] }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contract_file_annotations")
    .select("annotations_json")
    .eq("file_version_id", fileVersionId)
    .eq("status", "DRAFT")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Annotations] Error cargando anotaciones:", error);
    return { comments: [], highlights: [] };
  }

  if (!data || !data.annotations_json) {
    return { comments: [], highlights: [] };
  }

  return jsonbToAnnotations(data.annotations_json);
}

/**
 * Guarda las anotaciones de una versión de archivo en la base de datos
 * NOTA: Esta función está deprecada. Las anotaciones se guardan a través de la API route /api/contracts/annotations/save
 * @deprecated Use la API route /api/contracts/annotations/save desde el cliente
 */
export async function saveAnnotations(
  fileVersionId: string,
  contractId: string,
  workspaceId: string,
  comments: AnchorComment[],
  highlights: TextHighlight[],
  status: "DRAFT" | "PUBLISHED" = "DRAFT"
): Promise<void> {
  throw new Error("saveAnnotations está deprecada. Use la API route /api/contracts/annotations/save desde el cliente");
}

