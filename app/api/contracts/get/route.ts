import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getContractWithDetails, getContractAccess } from "@/lib/supabase/contracts";

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
    const contract_id = searchParams.get('contract_id');

    if (!contract_id) {
      return NextResponse.json(
        { error: "contract_id es requerido" },
        { status: 400 }
      );
    }

    // Verificar acceso READ
    const access = await getContractAccess(supabase, contract_id);
    if (!access) {
      return NextResponse.json(
        { error: "No tienes acceso a este contrato" },
        { status: 403 }
      );
    }

    // Obtener contrato completo con detalles
    const contract = await getContractWithDetails(supabase, contract_id);

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    // Enriquecer file_versions con información del usuario que subió
    if (contract.file_versions && contract.file_versions.length > 0) {
      const userIds = [...new Set(contract.file_versions.map(v => v.uploaded_by_user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const usersMap = new Map(users?.map(u => [u.user_id, u]) || []);

      contract.file_versions = contract.file_versions.map(version => ({
        ...version,
        uploaded_by: usersMap.get(version.uploaded_by_user_id) || null,
      }));
    }

    // Enriquecer additional_files con información del usuario que subió
    if (contract.additional_files && contract.additional_files.length > 0) {
      const userIds = [...new Set(contract.additional_files.map(f => f.uploaded_by_user_id))];
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const usersMap = new Map(users?.map(u => [u.user_id, u]) || []);

      contract.additional_files = contract.additional_files.map(file => ({
        ...file,
        uploaded_by: usersMap.get(file.uploaded_by_user_id) || null,
      }));
    }

    return NextResponse.json({
      success: true,
      contract,
    });
  } catch (error: any) {
    console.error("[Contracts/Get] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener el contrato" },
      { status: 500 }
    );
  }
}

