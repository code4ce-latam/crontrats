import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  getUserWorkspaceId, 
  getContractAccess 
} from "@/lib/supabase/contracts";

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const storage_path = searchParams.get('storage_path');

    if (!storage_path) {
      return NextResponse.json(
        { error: "storage_path es requerido" },
        { status: 400 }
      );
    }

    // Extraer contract_id del storage_path
    // Formato: contracts/{workspace_id}/{contract_id}/main/v{n}/{filename}
    // o: contracts/{workspace_id}/{contract_id}/attachments/{filename}
    const pathParts = storage_path.split('/');
    if (pathParts.length < 3 || pathParts[0] !== 'contracts') {
      return NextResponse.json(
        { error: "storage_path inválido" },
        { status: 400 }
      );
    }

    const contractId = pathParts[2];

    // Verificar acceso READ al contrato
    const access = await getContractAccess(supabase, contractId);
    if (!access) {
      return NextResponse.json(
        { error: "No tienes acceso a este archivo" },
        { status: 403 }
      );
    }

    // Verificar que el archivo existe en la base de datos
    // (para versiones principales)
    const { data: version } = await supabase
      .from('contract_file_versions')
      .select('contract_id')
      .eq('storage_path', storage_path)
      .maybeSingle();

    // (para archivos adicionales)
    const { data: additionalFile } = await supabase
      .from('contract_additional_files')
      .select('contract_id')
      .eq('storage_path', storage_path)
      .maybeSingle();

    if (!version && !additionalFile) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que el contract_id coincide
    const fileContractId = version?.contract_id || additionalFile?.contract_id;
    if (fileContractId !== contractId) {
      return NextResponse.json(
        { error: "Archivo no encontrado" },
        { status: 404 }
      );
    }

    // Generar signed download URL (válida por 1 hora)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('contracts')
      .createSignedUrl(storage_path, 3600); // 1 hora

    if (signedUrlError || !signedUrlData) {
      console.error("[Contracts/File/SignedUrl] Error generando signed URL:", signedUrlError);
      return NextResponse.json(
        { error: signedUrlError?.message || "Error al generar URL de descarga" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      download_url: signedUrlData.signedUrl,
    });
  } catch (error: any) {
    console.error("[Contracts/File/SignedUrl] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al generar URL de descarga" },
      { status: 500 }
    );
  }
}

