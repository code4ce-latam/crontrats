import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getContractsByFolder } from "@/lib/supabase/contracts";

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
    const folder_id = searchParams.get('folder_id');

    if (!folder_id) {
      return NextResponse.json(
        { error: "folder_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener contratos accesibles de la carpeta (RLS filtra automáticamente)
    const contracts = await getContractsByFolder(supabase, folder_id);

    // Enriquecer con información del profile
    const contractsWithProfile = await Promise.all(
      contracts.map(async (contract) => {
        let profile = null;
        if (contract.profile_id) {
          const { data: profileData } = await supabase
            .from('contract_profiles')
            .select('id, name')
            .eq('id', contract.profile_id)
            .single();
          profile = profileData;
        }

        return {
          ...contract,
          profile: profile || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      contracts: contractsWithProfile,
    });
  } catch (error: any) {
    console.error("[Contracts/List] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al listar contratos" },
      { status: 500 }
    );
  }
}

