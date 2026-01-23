import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWorkspaceId, getFolderAccess, getFolderDescendants, type FolderAccess } from "@/lib/supabase/folders";
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
    const { folder_id, permissions } = body;

    if (!folder_id || !permissions) {
      return NextResponse.json(
        { error: "folder_id y permissions son requeridos" },
        { status: 400 }
      );
    }

    // Validar formato de permissions
    if (typeof permissions !== 'object' || !permissions.OWNER || !permissions.EDIT || !permissions.READ) {
      return NextResponse.json(
        { error: "permissions debe ser un objeto con OWNER, EDIT y READ (arrays de member_id)" },
        { status: 400 }
      );
    }

    // Obtener información de la carpeta primero
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, name, workspace_id, parent_id')
      .eq('id', folder_id)
      .single();

    if (folderError || !folder) {
      return NextResponse.json(
        { error: "Carpeta no encontrada" },
        { status: 404 }
      );
    }

    // Validar que pertenece al workspace del usuario
    const userWorkspaceId = await getUserWorkspaceId(supabase);
    if (userWorkspaceId !== folder.workspace_id) {
      return NextResponse.json(
        { error: "No perteneces a este workspace" },
        { status: 403 }
      );
    }

    // Verificar permisos: OWNER del workspace puede gestionar carpetas raíz,
    // o debe tener permiso OWNER explícito en la carpeta
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
    
    if (isRootFolder && isWorkspaceOwner) {
      // Permitir: es OWNER del workspace y la carpeta es raíz
    } else {
      // Verificar que el usuario tiene OWNER en esta carpeta (usando RLS)
      const access = await getFolderAccess(supabase, folder_id);
      if (access !== 'OWNER') {
        return NextResponse.json(
          { error: "Solo los propietarios pueden actualizar permisos" },
          { status: 403 }
        );
      }
    }

    // Obtener el member_id del usuario actual
    const { data: currentMembership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', folder.workspace_id)
      .eq('status', 'ACTIVE')
      .single();

    if (!currentMembership) {
      return NextResponse.json(
        { error: "No se pudo obtener la información de membresía" },
        { status: 400 }
      );
    }

    // Validaciones de seguridad (aplican a TODAS las carpetas):
    // 1. La carpeta SIEMPRE debe tener al menos 1 OWNER
    // 2. No permitir que el usuario actual se quite a sí mismo si es el ÚLTIMO OWNER
    const ownerIds = Array.isArray(permissions.OWNER) ? permissions.OWNER : [];
    
    // Validación 1: Debe haber al menos 1 propietario
    if (ownerIds.length === 0) {
      return NextResponse.json(
        { 
          error: "FOLDER_MUST_HAVE_OWNER",
          message: "La carpeta debe tener al menos un propietario." 
        },
        { status: 409 }
      );
    }

    // Validación 2: Verificar que no se esté eliminando el último OWNER
    // Obtener OWNERs actuales antes del cambio
    const { data: currentOwners } = await supabase
      .from('folder_permissions')
      .select('member_id')
      .eq('folder_id', folder_id)
      .eq('access', 'OWNER');

    const currentOwnerIds = (currentOwners || []).map(p => p.member_id);
    
    // Si actualmente hay solo 1 OWNER y en el nuevo estado no está incluido, bloquear
    if (currentOwnerIds.length === 1) {
      const lastOwnerId = currentOwnerIds[0];
      if (!ownerIds.includes(lastOwnerId)) {
        return NextResponse.json(
          { 
            error: "CANNOT_REMOVE_LAST_OWNER",
            message: "No puedes quitar al último propietario. Agrega otro propietario primero." 
          },
          { status: 409 }
        );
      }
    }

    // Obtener descendientes de esta carpeta
    const descendantIds = await getFolderDescendants(supabase, folder_id);
    const allFolderIds = [folder_id, ...descendantIds];

    // Preparar todos los permisos a insertar
    const allPermissions: Array<{
      workspace_id: string;
      folder_id: string;
      member_id: string;
      access: FolderAccess;
      created_by_user_id: string;
    }> = [];

    // Para cada carpeta (actual + descendientes)
    for (const targetFolderId of allFolderIds) {
      // Mapa para evitar duplicados: member_id -> access (prioridad: OWNER > EDIT > READ)
      const permissionMap = new Map<string, FolderAccess>();
      
      // Procesar en orden de prioridad: OWNER primero, luego EDIT, luego READ
      // Si un usuario está en múltiples niveles, se toma el de mayor prioridad
      (['OWNER', 'EDIT', 'READ'] as FolderAccess[]).forEach(accessLevel => {
        const memberIds = Array.isArray(permissions[accessLevel]) ? permissions[accessLevel] : [];
        // Filtrar valores null/undefined y validar que sean strings válidos
        memberIds
          .filter((memberId: any): memberId is string => 
            typeof memberId === 'string' && memberId.trim().length > 0
          )
          .forEach((memberId: string) => {
            // Solo agregar si no existe (OWNER tiene prioridad por procesarse primero)
            if (!permissionMap.has(memberId)) {
              permissionMap.set(memberId, accessLevel);
            }
          });
      });
      
      // Convertir el mapa a array de permisos para esta carpeta
      permissionMap.forEach((accessLevel, memberId) => {
        allPermissions.push({
          workspace_id: folder.workspace_id,
          folder_id: targetFolderId,
          member_id: memberId,
          access: accessLevel,
          created_by_user_id: user.id,
        });
      });
    }

    // Usar admin client para propagar permisos (ya validamos con RLS antes)
    // Primero eliminar todos los permisos existentes de estas carpetas
    const { error: deleteError } = await supabaseAdmin
      .from('folder_permissions')
      .delete()
      .in('folder_id', allFolderIds);

    if (deleteError) {
      console.error("[Folders/Permissions/Update] Error eliminando permisos:", deleteError);
      return NextResponse.json(
        { error: "Error al actualizar permisos" },
        { status: 500 }
      );
    }

    // Insertar nuevos permisos (eliminar duplicados finales por si acaso)
    if (allPermissions.length > 0) {
      // Eliminar duplicados basados en folder_id + member_id (último gana)
      const uniquePermissionsMap = new Map<string, typeof allPermissions[0]>();
      allPermissions.forEach(perm => {
        const key = `${perm.folder_id}:${perm.member_id}`;
        uniquePermissionsMap.set(key, perm);
      });
      
      const uniquePermissions = Array.from(uniquePermissionsMap.values());
      
      const { error: insertError } = await supabaseAdmin
        .from('folder_permissions')
        .insert(uniquePermissions);

      if (insertError) {
        console.error("[Folders/Permissions/Update] Error insertando permisos:", insertError);
        return NextResponse.json(
          { error: insertError.message || "Error al actualizar permisos" },
          { status: 500 }
        );
      }
    }

    // Calcular resumen de cambios para la actividad
    const changes = {
      OWNER: permissions.OWNER.length,
      EDIT: permissions.EDIT.length,
      READ: permissions.READ.length,
      propagated_to: descendantIds.length,
    };

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'UPDATE',
        description: `Actualizó los permisos de la carpeta "${folder.name}"${descendantIds.length > 0 ? ` y ${descendantIds.length} subcarpeta(s)` : ''}`,
        entity_type: 'folder',
        entity_id: folder_id,
        workspace_id: folder.workspace_id,
        metadata: {
          folder_name: folder.name,
          changes,
          permissions: {
            OWNER: permissions.OWNER,
            EDIT: permissions.EDIT,
            READ: permissions.READ,
          },
        },
      });
    } catch (activityError) {
      console.error("[Folders/Permissions/Update] Error registrando actividad:", activityError);
    }

    return NextResponse.json({
      success: true,
      message: `Permisos actualizados exitosamente${descendantIds.length > 0 ? ` y propagados a ${descendantIds.length} subcarpeta(s)` : ''}`,
      changes,
    });
  } catch (error: any) {
    console.error("[Folders/Permissions/Update] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar los permisos" },
      { status: 500 }
    );
  }
}

