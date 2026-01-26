import { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";

export type FolderAccess = 'OWNER' | 'EDIT' | 'READ';

export interface Folder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  sort_order: number | null;
  created_at: string;
  created_by_user_id: string;
}

export interface FolderPermission {
  id: string;
  workspace_id: string;
  folder_id: string;
  member_id: string;
  access: FolderAccess;
  created_at: string;
  created_by_user_id: string;
}

export interface FolderWithAccess extends Folder {
  access: FolderAccess | null; // Access del usuario actual
}

export interface FolderTreeItem extends FolderWithAccess {
  children?: FolderTreeItem[];
}

export interface FolderPermissionsWithMember {
  id: string;
  folder_id: string;
  member_id: string;
  access: FolderAccess;
  // Información del miembro
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Obtiene el workspace_id del usuario actual desde workspace_members
 */
export async function getUserWorkspaceId(
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[Folders] Error obteniendo workspace_id:", error);
      return null;
    }

    return membership?.workspace_id || null;
  } catch (error) {
    console.error("[Folders] Error inesperado obteniendo workspace_id:", error);
    return null;
  }
}

/**
 * Obtiene el access del usuario actual en una carpeta
 * @returns 'OWNER' | 'EDIT' | 'READ' | null si no tiene acceso
 */
export async function getFolderAccess(
  supabase: SupabaseClient,
  folderId: string
): Promise<FolderAccess | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    // Obtener el member_id del usuario actual
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return null;
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!membership) {
      return null;
    }

    // Obtener el permiso
    const { data: permission, error } = await supabase
      .from('folder_permissions')
      .select('access')
      .eq('folder_id', folderId)
      .eq('member_id', membership.id)
      .maybeSingle();

    if (error || !permission) {
      return null;
    }

    return permission.access as FolderAccess;
  } catch (error) {
    console.error("[Folders] Error obteniendo access de carpeta:", error);
    return null;
  }
}

/**
 * Obtiene los descendientes de una carpeta usando el campo path
 * @returns Array de IDs de carpetas descendientes (incluyendo la carpeta misma)
 */
export async function getFolderDescendants(
  supabase: SupabaseClient,
  folderId: string
): Promise<string[]> {
  try {
    // Primero obtener el path de la carpeta
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('path')
      .eq('id', folderId)
      .single();

    if (folderError || !folder) {
      console.error("[Folders] Error obteniendo path de carpeta:", folderError);
      return [folderId]; // Retornar solo la carpeta misma si hay error
    }

    // Buscar todas las carpetas cuyo path comienza con el path de esta carpeta
    // Esto incluye la carpeta misma y todas sus subcarpetas
    const { data: descendants, error } = await supabase
      .from('folders')
      .select('id')
      .or(`path.eq.${folder.path},path.like.${folder.path}.%`);

    if (error) {
      console.error("[Folders] Error obteniendo descendientes:", error);
      return [folderId];
    }

    return (descendants || []).map(f => f.id);
  } catch (error) {
    console.error("[Folders] Error inesperado obteniendo descendientes:", error);
    return [folderId];
  }
}

/**
 * Obtiene el árbol de carpetas accesibles para un workspace
 * Incluye el access del usuario actual en cada carpeta
 */
export async function getWorkspaceFoldersTree(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<FolderTreeItem[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    // Obtener todas las carpetas accesibles (RLS filtra automáticamente)
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true, nullsFirst: true })
      .order('name', { ascending: true });

    if (foldersError) {
      console.error("[Folders] Error obteniendo carpetas:", foldersError);
      return [];
    }

    if (!folders || folders.length === 0) {
      return [];
    }

    // Obtener el member_id del usuario actual
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!membership) {
      return [];
    }

    // Obtener todos los permisos del usuario para estas carpetas
    const folderIds = folders.map(f => f.id);
    let permissions: any[] = [];
    
    if (folderIds.length > 0) {
      const { data: permsData, error: permsError } = await supabase
        .from('folder_permissions')
        .select('folder_id, access')
        .eq('member_id', membership.id)
        .in('folder_id', folderIds);

      if (permsError) {
        console.error("[Folders] Error obteniendo permisos:", permsError);
      } else {
        permissions = permsData || [];
      }
    }

    // Crear mapa de folder_id -> access
    const accessMap = new Map<string, FolderAccess>();
    permissions.forEach(p => {
      accessMap.set(p.folder_id, p.access as FolderAccess);
    });

    // Agregar access a cada carpeta
    const foldersWithAccess: FolderWithAccess[] = folders.map(f => ({
      ...f,
      access: accessMap.get(f.id) || null,
    }));

    // Construir árbol (padre -> hijos)
    const folderMap = new Map<string, FolderTreeItem>();
    const roots: FolderTreeItem[] = [];

    // Primero crear todos los nodos
    foldersWithAccess.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Luego construir la jerarquía
    foldersWithAccess.forEach(folder => {
      const node = folderMap.get(folder.id)!;
      if (folder.parent_id && folderMap.has(folder.parent_id)) {
        const parent = folderMap.get(folder.parent_id)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  } catch (error) {
    console.error("[Folders] Error inesperado obteniendo árbol:", error);
    return [];
  }
}

/**
 * Obtiene los participantes de una carpeta (cualquier usuario con acceso puede ver)
 * Incluye información de los miembros
 * Nota: Usa admin client para usuarios READ/EDIT ya que RLS solo permite ver permisos propios o si eres OWNER
 */
export async function getFolderParticipants(
  supabase: SupabaseClient,
  folderId: string
): Promise<FolderPermissionsWithMember[]> {
  try {
    // Verificar que el usuario tiene acceso a esta carpeta (OWNER, EDIT o READ)
    const access = await getFolderAccess(supabase, folderId);
    if (!access) {
      console.error("[Folders] Usuario no tiene acceso a esta carpeta");
      return [];
    }

    // Si el usuario es OWNER, puede usar el cliente normal (RLS lo permite)
    // Si es READ o EDIT, necesitamos usar admin client (RLS no permite ver permisos de otros)
    const clientToUse = access === 'OWNER' ? supabase : createAdminClient();

    // Obtener permisos
    const { data: permissions, error } = await clientToUse
      .from('folder_permissions')
      .select('id, folder_id, member_id, access')
      .eq('folder_id', folderId);

    if (error) {
      console.error("[Folders] Error obteniendo permisos:", error);
      return [];
    }

    if (!permissions || permissions.length === 0) {
      return [];
    }

    // Obtener información de miembros
    const memberIds = permissions.map(p => p.member_id);
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select('id, user_id')
      .in('id', memberIds);

    if (membersError || !members) {
      console.error("[Folders] Error obteniendo miembros:", membersError);
      return [];
    }

    // Crear mapa de member_id -> user_id
    const memberToUserMap = new Map<string, string>();
    members.forEach(m => {
      memberToUserMap.set(m.id, m.user_id);
    });

    // Obtener información de usuarios usando la función RPC existente
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return [];
    }

    const { data: users } = await supabase.rpc('get_workspace_users', {
      workspace_uuid: workspaceId,
    });

    // Crear mapa de user_id -> información de usuario
    const userMap = new Map<string, any>();
    (users || []).forEach((u: any) => {
      userMap.set(u.user_id, {
        email: u.email,
        display_name: u.full_name || u.email?.split("@")[0] || `Usuario ${u.user_id.substring(0, 8)}`,
        avatar_url: u.avatar_url,
      });
    });

    // Combinar permisos con información de miembros
    const result: FolderPermissionsWithMember[] = permissions.map((p: any) => {
      const userId = memberToUserMap.get(p.member_id);
      const userInfo = userId ? (userMap.get(userId) || {
        email: null,
        display_name: `Usuario ${userId.substring(0, 8)}`,
        avatar_url: null,
      }) : {
        email: null,
        display_name: `Miembro ${p.member_id.substring(0, 8)}`,
        avatar_url: null,
      };

      return {
        id: p.id,
        folder_id: p.folder_id,
        member_id: p.member_id,
        access: p.access as FolderAccess,
        user_id: userId || '',
        email: userInfo.email,
        display_name: userInfo.display_name,
        avatar_url: userInfo.avatar_url,
      };
    });

    return result;
  } catch (error) {
    console.error("[Folders] Error inesperado obteniendo participantes:", error);
    return [];
  }
}

/**
 * Obtiene los permisos de una carpeta (solo si el usuario es OWNER)
 * Incluye información de los miembros
 */
export async function getFolderPermissions(
  supabase: SupabaseClient,
  folderId: string
): Promise<FolderPermissionsWithMember[]> {
  try {
    // Verificar que el usuario tiene OWNER en esta carpeta
    const access = await getFolderAccess(supabase, folderId);
    if (access !== 'OWNER') {
      console.error("[Folders] Usuario no tiene permisos OWNER para ver permisos");
      return [];
    }

    // Obtener permisos
    const { data: permissions, error } = await supabase
      .from('folder_permissions')
      .select('id, folder_id, member_id, access')
      .eq('folder_id', folderId);

    if (error) {
      console.error("[Folders] Error obteniendo permisos:", error);
      return [];
    }

    if (!permissions || permissions.length === 0) {
      return [];
    }

    // Obtener información de miembros
    const memberIds = permissions.map(p => p.member_id);
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select('id, user_id')
      .in('id', memberIds);

    if (membersError || !members) {
      console.error("[Folders] Error obteniendo miembros:", membersError);
      return [];
    }

    // Crear mapa de member_id -> user_id
    const memberToUserMap = new Map<string, string>();
    members.forEach(m => {
      memberToUserMap.set(m.id, m.user_id);
    });

    // Obtener información de usuarios usando la función RPC existente
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return [];
    }

    const { data: users } = await supabase.rpc('get_workspace_users', {
      workspace_uuid: workspaceId,
    });

    // Crear mapa de user_id -> información de usuario
    const userMap = new Map<string, any>();
    (users || []).forEach((u: any) => {
      userMap.set(u.user_id, {
        email: u.email,
        display_name: u.full_name || u.email?.split("@")[0] || `Usuario ${u.user_id.substring(0, 8)}`,
        avatar_url: u.avatar_url,
      });
    });

    // Combinar permisos con información de miembros
    const result: FolderPermissionsWithMember[] = permissions.map((p: any) => {
      const userId = memberToUserMap.get(p.member_id);
      const userInfo = userId ? (userMap.get(userId) || {
        email: null,
        display_name: `Usuario ${userId.substring(0, 8)}`,
        avatar_url: null,
      }) : {
        email: null,
        display_name: `Miembro ${p.member_id.substring(0, 8)}`,
        avatar_url: null,
      };

      return {
        id: p.id,
        folder_id: p.folder_id,
        member_id: p.member_id,
        access: p.access as FolderAccess,
        user_id: userId || '',
        email: userInfo.email,
        display_name: userInfo.display_name,
        avatar_url: userInfo.avatar_url,
      };
    });

    return result;
  } catch (error) {
    console.error("[Folders] Error inesperado obteniendo permisos:", error);
    return [];
  }
}

