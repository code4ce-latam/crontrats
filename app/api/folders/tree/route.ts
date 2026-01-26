import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getUserWorkspaceId, getWorkspaceFoldersTree } from "@/lib/supabase/folders";

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
    const workspace_id = searchParams.get('workspace_id');

    if (!workspace_id) {
      return NextResponse.json(
        { error: "workspace_id es requerido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario pertenece al workspace
    const userWorkspaceId = await getUserWorkspaceId(supabase);
    if (userWorkspaceId !== workspace_id) {
      return NextResponse.json(
        { error: "No perteneces a este workspace" },
        { status: 403 }
      );
    }

    // Obtener árbol de carpetas (RLS filtra automáticamente las no accesibles)
    const tree = await getWorkspaceFoldersTree(supabase, workspace_id);

    return NextResponse.json({
      success: true,
      tree,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error("[Folders/Tree] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener el árbol de carpetas" },
      { status: 500 }
    );
  }
}

