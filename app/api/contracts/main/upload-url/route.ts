import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  getUserWorkspaceId, 
  validateContractPermissions,
  getNextVersionNumber 
} from "@/lib/supabase/contracts";

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
    const { contract_id, original_name, mime_type } = body;

    // Validaciones básicas
    if (!contract_id || !original_name) {
      return NextResponse.json(
        { error: "contract_id y original_name son requeridos" },
        { status: 400 }
      );
    }

    // Obtener el contrato
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('workspace_id, folder_id')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos: debe tener EDIT/OWNER en la carpeta
    const hasPermission = await validateContractPermissions(supabase, contract.folder_id, 'EDIT');
    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos para subir versiones de este contrato" },
        { status: 403 }
      );
    }

    // Verificar que el usuario es OWNER o EDITOR del workspace
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId || workspaceId !== contract.workspace_id) {
      return NextResponse.json(
        { error: "No perteneces a este workspace" },
        { status: 403 }
      );
    }

    // Calcular siguiente versión
    const nextVersion = await getNextVersionNumber(supabase, contract_id);

    // Construir storage_path
    const sanitizedFileName = original_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `contracts/${workspaceId}/${contract_id}/main/v${nextVersion}/${sanitizedFileName}`;

    // Generar signed upload URL (válida por 1 hora)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('contracts')
      .createSignedUploadUrl(storagePath, {
        upsert: false, // No permitir sobrescribir
      });

    if (signedUrlError || !signedUrlData) {
      console.error("[Contracts/Main/UploadUrl] Error generando signed URL:", signedUrlError);
      return NextResponse.json(
        { error: signedUrlError?.message || "Error al generar URL de upload" },
        { status: 500 }
      );
    }

    // La respuesta puede tener 'signedUrl' o 'token' dependiendo de la versión de Supabase
    const signedUrl = signedUrlData.signedUrl || signedUrlData.path;
    
    if (!signedUrl) {
      console.error("[Contracts/Main/UploadUrl] Respuesta inesperada:", signedUrlData);
      return NextResponse.json(
        { error: "Error: estructura de respuesta inesperada" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signed_url: signedUrl,
      storage_path: storagePath,
      version: nextVersion,
    });
  } catch (error: any) {
    console.error("[Contracts/Main/UploadUrl] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al generar URL de upload" },
      { status: 500 }
    );
  }
}

