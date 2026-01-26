import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  getUserWorkspaceId, 
  validateContractPermissions 
} from "@/lib/supabase/contracts";
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
    const { contract_id, storage_path, size, mime_type, original_name } = body;

    // Validaciones básicas
    if (!contract_id || !storage_path || !original_name) {
      return NextResponse.json(
        { error: "contract_id, storage_path y original_name son requeridos" },
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
        { error: "No tienes permisos para confirmar uploads de este contrato" },
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

    // Insertar archivo adicional
    const { data: newFile, error: insertError } = await supabaseAdmin
      .from('contract_additional_files')
      .insert({
        workspace_id: workspaceId,
        contract_id,
        storage_path,
        original_name,
        mime_type: mime_type || null,
        size: size || null,
        uploaded_by_user_id: user.id,
      })
      .select()
      .single();

    if (insertError || !newFile) {
      console.error("[Contracts/Attachment/ConfirmUpload] Error insertando archivo:", insertError);
      return NextResponse.json(
        { error: insertError?.message || "Error al confirmar el upload" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'CONTRACT_ATTACHMENT_UPLOADED',
        description: `Subió el archivo adicional "${original_name}" al contrato`,
        entity_type: 'contract',
        entity_id: contract_id,
        workspace_id: workspaceId,
        metadata: {
          folder_id: contract.folder_id,
          original_name,
          storage_path,
        },
      });
    } catch (activityError) {
      console.error("[Contracts/Attachment/ConfirmUpload] Error registrando actividad:", activityError);
    }

    return NextResponse.json({
      success: true,
      file: newFile,
    });
  } catch (error: any) {
    console.error("[Contracts/Attachment/ConfirmUpload] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al confirmar el upload" },
      { status: 500 }
    );
  }
}

