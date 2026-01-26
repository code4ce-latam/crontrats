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
    const { contract_id, status } = body;

    // Validaciones básicas
    if (!contract_id || !status) {
      return NextResponse.json(
        { error: "contract_id y status son requeridos" },
        { status: 400 }
      );
    }

    const validStatuses = ['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status debe ser uno de: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Obtener el contrato actual
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
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
        { error: "No tienes permisos para cambiar el estado de este contrato" },
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

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .single();

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'EDITOR')) {
      return NextResponse.json(
        { error: "Solo los propietarios y editores pueden cambiar el estado de contratos" },
        { status: 403 }
      );
    }

    // Si el estado no cambia, retornar éxito sin hacer nada
    if (contract.status === status) {
      return NextResponse.json({ 
        success: true, 
        contract,
        message: "El estado ya es el mismo" 
      });
    }

    // Actualizar el estado
    const { data: updatedContract, error: updateError } = await supabaseAdmin
      .from('contracts')
      .update({ status })
      .eq('id', contract_id)
      .select()
      .single();

    if (updateError || !updatedContract) {
      console.error("[Contracts/ChangeStatus] Error actualizando estado:", updateError);
      return NextResponse.json(
        { error: updateError?.message || "Error al cambiar el estado del contrato" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      const statusLabels: Record<string, string> = {
        'DRAFT': 'Borrador',
        'ACTIVE': 'Activo',
        'EXPIRED': 'Expirado',
        'CANCELED': 'Cancelado',
        'ARCHIVED': 'Archivado',
      };

      await createActivity(supabase, {
        type: 'CONTRACT_STATUS_CHANGED',
        description: `Cambió el estado del contrato "${contract.title}" de ${statusLabels[contract.status] || contract.status} a ${statusLabels[status] || status}`,
        entity_type: 'contract',
        entity_id: contract_id,
        workspace_id: workspaceId,
        metadata: {
          folder_id: contract.folder_id,
          old_status: contract.status,
          new_status: status,
        },
      });
    } catch (activityError) {
      console.error("[Contracts/ChangeStatus] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ 
      success: true, 
      contract: updatedContract 
    });
  } catch (error: any) {
    console.error("[Contracts/ChangeStatus] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al cambiar el estado del contrato" },
      { status: 500 }
    );
  }
}

