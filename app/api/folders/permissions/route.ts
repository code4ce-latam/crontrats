import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getUserWorkspaceId, getFolderAccess, getFolderPermissions } from "@/lib/supabase/folders";

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

    // Verificar que el usuario tiene OWNER en esta carpeta
    const access = await getFolderAccess(supabase, folder_id);
    // Permitir ver permisos a cualquier usuario con acceso (OWNER, EDIT, READ)
    if (!access) {
      return NextResponse.json(
        { error: "No tienes acceso a esta carpeta" },
        { status: 403 }
      );
    }

    // Obtener permisos con información de miembros
    const permissions = await getFolderPermissions(supabase, folder_id);

    // Agrupar por access
    const grouped = {
      OWNER: permissions.filter(p => p.access === 'OWNER'),
      EDIT: permissions.filter(p => p.access === 'EDIT'),
      READ: permissions.filter(p => p.access === 'READ'),
    };

    return NextResponse.json({
      success: true,
      permissions: grouped,
    });
  } catch (error: any) {
    console.error("[Folders/Permissions] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener los permisos" },
      { status: 500 }
    );
  }
}

