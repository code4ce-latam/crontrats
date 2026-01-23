import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getUserWorkspaceId, getFolderAccess } from "@/lib/supabase/folders";
import { createActivity } from "@/lib/supabase/activities";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { folder_id } = body;

    if (!folder_id) {
      return NextResponse.json(
        { error: "folder_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener información de la carpeta primero
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, name, workspace_id, path, parent_id')
      .eq('id', folder_id)
      .single();

    if (folderError || !folder) {
      return NextResponse.json(
        { error: "Carpeta no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que pertenece al workspace del usuario
    const userWorkspaceId = await getUserWorkspaceId(supabase);
    if (userWorkspaceId !== folder.workspace_id) {
      return NextResponse.json(
        { error: "No perteneces a este workspace" },
        { status: 403 }
      );
    }

    // Verificar permisos: OWNER del workspace puede eliminar carpetas raíz,
    // o debe tener permiso OWNER en la carpeta específica
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', folder.workspace_id)
      .eq('status', 'ACTIVE')
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No se pudo verificar tu membresía" },
        { status: 403 }
      );
    }

    // Si es carpeta raíz y el usuario es OWNER del workspace, permitir
    const isWorkspaceOwner = membership.role === 'OWNER';
    const isRootFolder = folder.parent_id === null;

    if (!isRootFolder || !isWorkspaceOwner) {
      // Si no es raíz o no es OWNER del workspace, verificar permiso en la carpeta
      const access = await getFolderAccess(supabase, folder_id);
      if (access !== 'OWNER') {
        return NextResponse.json(
          { error: "Solo los propietarios pueden eliminar carpetas" },
          { status: 403 }
        );
      }
    }

    // Bloquear si tiene subcarpetas
    const { data: children, error: childrenError } = await supabase
      .from('folders')
      .select('id')
      .like('path', `${folder.path}.%`)
      .limit(1);

    if (childrenError) {
      console.error("[Folders/Delete] Error verificando subcarpetas:", childrenError);
      return NextResponse.json(
        { error: "Error al verificar subcarpetas" },
        { status: 500 }
      );
    }

    if (children && children.length > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar una carpeta que contiene subcarpetas. Elimina primero las subcarpetas." },
        { status: 400 }
      );
    }

    const folderName = folder.name;

    // Eliminar la carpeta (cascade elimina permisos automáticamente)
    const { error: deleteError } = await supabase
      .from('folders')
      .delete()
      .eq('id', folder_id);

    if (deleteError) {
      console.error("[Folders/Delete] Error eliminando carpeta:", deleteError);
      return NextResponse.json(
        { error: `Error al eliminar la carpeta: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'DELETE',
        description: `Eliminó la carpeta "${folderName}"`,
        entity_type: 'folder',
        entity_id: folder_id,
        workspace_id: folder.workspace_id,
        metadata: {
          folder_name: folderName,
          was_root: folder.parent_id === null,
        },
      });
    } catch (activityError) {
      console.error("[Folders/Delete] Error registrando actividad:", activityError);
    }

    return NextResponse.json({
      success: true,
      message: "Carpeta eliminada exitosamente",
    });
  } catch (error: any) {
    console.error("[Folders/Delete] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al eliminar la carpeta" },
      { status: 500 }
    );
  }
}

