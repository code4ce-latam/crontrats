import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId, getFolderAccess } from "@/lib/supabase/folders";
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
    const { workspace_id, parent_id, name } = body;

    if (!workspace_id || !name || !name.trim()) {
      return NextResponse.json(
        { error: "workspace_id y name son requeridos" },
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

    // Validar permisos según si es raíz o subcarpeta
    if (parent_id) {
      // Si tiene padre: verificar que usuario tiene OWNER en el padre
      const parentAccess = await getFolderAccess(supabase, parent_id);
      if (parentAccess !== 'OWNER') {
        return NextResponse.json(
          { error: "Solo los propietarios de la carpeta padre pueden crear subcarpetas" },
          { status: 403 }
        );
      }
    } else {
      // Si es raíz: verificar que usuario es OWNER del workspace
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('workspace_id', workspace_id)
        .eq('status', 'ACTIVE')
        .single();

      if (!membership || membership.role !== 'OWNER') {
        return NextResponse.json(
          { error: "Solo los propietarios del workspace pueden crear carpetas raíz" },
          { status: 403 }
        );
      }
    }

    // Obtener el member_id del usuario actual
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .eq('status', 'ACTIVE')
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No se pudo obtener la información de membresía" },
        { status: 400 }
      );
    }

    // Validar duplicados: verificar si ya existe una carpeta con el mismo nombre en el mismo nivel
    let duplicateQuery = supabaseAdmin
      .from('folders')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('name', name.trim());

    if (parent_id) {
      duplicateQuery = duplicateQuery.eq('parent_id', parent_id);
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

    // Crear la carpeta usando admin client después de validar permisos con RLS
    // Esto evita problemas con políticas RLS durante la inserción
    const { data: newFolder, error: folderError } = await supabaseAdmin
      .from('folders')
      .insert({
        workspace_id,
        parent_id: parent_id || null,
        name: name.trim(),
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (folderError) {
      console.error("[Folders/Create] Error creando carpeta:", folderError);
      return NextResponse.json(
        { error: `Error al crear la carpeta: ${folderError.message}` },
        { status: 500 }
      );
    }

    // Copiar permisos del padre si existe (herencia materializada)
    if (parent_id) {
      const { data: parentPermissions, error: permsError } = await supabaseAdmin
        .from('folder_permissions')
        .select('member_id, access')
        .eq('folder_id', parent_id);

      if (permsError) {
        console.error("[Folders/Create] Error obteniendo permisos del padre:", permsError);
        // Continuar aunque falle, al menos crear el permiso OWNER para el creador
      } else if (parentPermissions && parentPermissions.length > 0) {
        // Insertar los mismos permisos en la nueva carpeta
        const permissionsToInsert = parentPermissions.map(p => ({
          workspace_id,
          folder_id: newFolder.id,
          member_id: p.member_id,
          access: p.access,
          created_by_user_id: user.id,
        }));

        const { error: insertPermsError } = await supabaseAdmin
          .from('folder_permissions')
          .insert(permissionsToInsert);

        if (insertPermsError) {
          console.error("[Folders/Create] Error copiando permisos:", insertPermsError);
          // No fallar, pero registrar el error
        }
      }
    } else {
      // Si es raíz, crear permiso OWNER para el usuario actual
      const { error: permError } = await supabaseAdmin
        .from('folder_permissions')
        .insert({
          workspace_id,
          folder_id: newFolder.id,
          member_id: membership.id,
          access: 'OWNER',
          created_by_user_id: user.id,
        });

      if (permError) {
        console.error("[Folders/Create] Error creando permiso OWNER:", permError);
        return NextResponse.json(
          { error: "Error al crear permisos de la carpeta" },
          { status: 500 }
        );
      }
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'CREATE',
        description: `Creó la carpeta "${name.trim()}"${parent_id ? ' en la carpeta padre' : ' (raíz)'}`,
        entity_type: 'folder',
        entity_id: newFolder.id,
        workspace_id,
        metadata: {
          folder_name: name.trim(),
          parent_id: parent_id || null,
          is_root: !parent_id,
        },
      });
    } catch (activityError) {
      console.error("[Folders/Create] Error registrando actividad:", activityError);
    }

    return NextResponse.json({
      success: true,
      folder: newFolder,
      message: "Carpeta creada exitosamente",
    });
  } catch (error: any) {
    console.error("[Folders/Create] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear la carpeta" },
      { status: 500 }
    );
  }
}

