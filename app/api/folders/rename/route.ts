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
    const { folder_id, name } = body;

    if (!folder_id || !name || !name.trim()) {
      return NextResponse.json(
        { error: "folder_id y name son requeridos" },
        { status: 400 }
      );
    }

    // Verificar que el usuario tiene OWNER en esta carpeta
    const access = await getFolderAccess(supabase, folder_id);
    if (access !== 'OWNER') {
      return NextResponse.json(
        { error: "Solo los propietarios pueden renombrar carpetas" },
        { status: 403 }
      );
    }

    // Obtener información de la carpeta antes de actualizar
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, name, workspace_id')
      .eq('id', folder_id)
      .single();

    if (folderError || !folder) {
      return NextResponse.json(
        { error: "Carpeta no encontrada" },
        { status: 404 }
      );
    }

    const oldName = folder.name;
    const newName = name.trim();

    // Verificar que pertenece al workspace del usuario
    const userWorkspaceId = await getUserWorkspaceId(supabase);
    if (userWorkspaceId !== folder.workspace_id) {
      return NextResponse.json(
        { error: "No perteneces a este workspace" },
        { status: 403 }
      );
    }

    // Validar duplicados: verificar si ya existe otra carpeta con el mismo nombre en el mismo nivel
    const { data: parentFolder } = await supabase
      .from('folders')
      .select('parent_id')
      .eq('id', folder_id)
      .single();

    let duplicateQuery = supabase
      .from('folders')
      .select('id')
      .eq('workspace_id', folder.workspace_id)
      .eq('name', newName)
      .neq('id', folder_id); // Excluir la carpeta actual

    if (parentFolder?.parent_id) {
      duplicateQuery = duplicateQuery.eq('parent_id', parentFolder.parent_id);
    } else {
      duplicateQuery = duplicateQuery.is('parent_id', null);
    }

    const { data: existingFolder } = await duplicateQuery.maybeSingle();

    if (existingFolder) {
      return NextResponse.json(
        { error: "Ya existe una carpeta con este nombre en esta ubicación" },
        { status: 409 }
      );
    }

    // Actualizar el nombre
    const { data: updatedFolder, error: updateError } = await supabase
      .from('folders')
      .update({ name: newName })
      .eq('id', folder_id)
      .select()
      .single();

    if (updateError) {
      console.error("[Folders/Rename] Error renombrando carpeta:", updateError);
      return NextResponse.json(
        { error: `Error al renombrar la carpeta: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'UPDATE',
        description: `Renombró la carpeta "${oldName}" a "${newName}"`,
        entity_type: 'folder',
        entity_id: folder_id,
        workspace_id: folder.workspace_id,
        metadata: {
          old_name: oldName,
          new_name: newName,
        },
      });
    } catch (activityError) {
      console.error("[Folders/Rename] Error registrando actividad:", activityError);
    }

    return NextResponse.json({
      success: true,
      folder: updatedFolder,
      message: "Carpeta renombrada exitosamente",
    });
  } catch (error: any) {
    console.error("[Folders/Rename] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al renombrar la carpeta" },
      { status: 500 }
    );
  }
}

