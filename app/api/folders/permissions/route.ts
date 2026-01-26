import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getUserWorkspaceId, getFolderAccess, getFolderPermissions, getFolderParticipants } from "@/lib/supabase/folders";

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

    // Verificar que el usuario tiene acceso a esta carpeta (OWNER, EDIT, READ)
    const access = await getFolderAccess(supabase, folder_id);
    if (!access) {
      return NextResponse.json(
        { error: "No tienes acceso a esta carpeta" },
        { status: 403 }
      );
    }

    // Obtener participantes (cualquier usuario con acceso puede ver)
    // Si es OWNER, también puede usar getFolderPermissions para gestión
    const permissions = access === 'OWNER' 
      ? await getFolderPermissions(supabase, folder_id)
      : await getFolderParticipants(supabase, folder_id);

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

