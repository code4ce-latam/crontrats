import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getContractAccess } from "@/lib/supabase/contracts";
import { loadAnnotations } from "@/lib/document-annotator/annotations";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const fileVersionId = searchParams.get("file_version_id");

    if (!fileVersionId) {
      return NextResponse.json(
        { error: "file_version_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener información de la versión para verificar acceso
    const { data: fileVersion, error: versionError } = await supabase
      .from("contract_file_versions")
      .select("contract_id")
      .eq("id", fileVersionId)
      .maybeSingle();

    if (versionError || !fileVersion) {
      return NextResponse.json(
        { error: "Versión de archivo no encontrada" },
        { status: 404 }
      );
    }

    // Verificar acceso al contrato
    const access = await getContractAccess(supabase, fileVersion.contract_id);
    if (!access) {
      return NextResponse.json(
        { error: "No tienes acceso a este contrato" },
        { status: 403 }
      );
    }

    // Cargar anotaciones
    const { comments, highlights } = await loadAnnotations(fileVersionId);

    return NextResponse.json({
      success: true,
      comments,
      highlights,
    });
  } catch (error: any) {
    console.error("[Annotations/Load] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al cargar anotaciones" },
      { status: 500 }
    );
  }
}

