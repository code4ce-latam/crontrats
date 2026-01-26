import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUserWorkspaceId } from "@/lib/supabase/contracts";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No perteneces a ningún workspace" },
        { status: 403 }
      );
    }

    // Obtener TODOS los contratos accesibles al usuario en el workspace
    // RLS filtra automáticamente según los permisos de carpetas
    const { data: contracts, error: contractsError } = await supabase
      .from('contracts')
      .select(`
        id,
        title,
        status,
        start_date,
        end_date,
        created_at,
        updated_at,
        profile_id,
        folder_id,
        folders!inner(
          id,
          name,
          path
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (contractsError) {
      console.error("[Contracts/All] Error obteniendo contratos:", contractsError);
      return NextResponse.json(
        { error: contractsError.message },
        { status: 500 }
      );
    }

    // Enriquecer con información del profile
    const contractsWithProfile = await Promise.all(
      (contracts || []).map(async (contract) => {
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
          id: contract.id,
          title: contract.title,
          status: contract.status,
          start_date: contract.start_date,
          end_date: contract.end_date,
          created_at: contract.created_at,
          updated_at: contract.updated_at,
          profile: profile || null,
          folder: contract.folders || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      contracts: contractsWithProfile,
    });
  } catch (error: any) {
    console.error("[Contracts/All] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al listar contratos" },
      { status: 500 }
    );
  }
}

