import { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = 'OWNER' | 'EDITOR' | 'READER';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface WorkspaceUser {
  id: string; // user_id de workspace_members
  user_id: string; // auth.users.id
  workspace_id: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  created_by_user_id: string | null;
  // Información del usuario desde auth.users y profiles
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface PaginatedUsers {
  users: WorkspaceUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
      console.error("[Users] Error obteniendo workspace_id:", error);
      return null;
    }

    return membership?.workspace_id || null;
  } catch (error) {
    console.error("[Users] Error inesperado obteniendo workspace_id:", error);
    return null;
  }
}

/**
 * Obtiene los usuarios del workspace del usuario actual con paginación
 * Incluye información de auth.users y profiles
 */
export async function getWorkspaceUsersPaginated(
  supabase: SupabaseClient,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedUsers> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        users: [],
        total: 0,
        page: 1,
        pageSize,
        totalPages: 0,
      };
    }

    // Obtener el workspace_id del usuario
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return {
        users: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    // Calcular el rango para la paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Obtener el total de registros
    const { count, error: countError } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE');

    if (countError) {
      console.error("[Users] Error obteniendo el total de usuarios:", countError);
      return {
        users: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Obtener todos los usuarios del workspace usando la función RPC que hace JOIN completo
    const { data: allUsers, error: rpcError } = await supabase.rpc('get_workspace_users', {
      workspace_uuid: workspaceId
    });

    if (rpcError) {
      console.error("[Users] Error obteniendo usuarios con RPC:", rpcError);
      return {
        users: [],
        total,
        page,
        pageSize,
        totalPages,
      };
    }

    console.log(`[Users] Usuarios obtenidos de la función RPC: ${allUsers?.length || 0}`);

    // Aplicar paginación manualmente después de obtener todos los usuarios
    const paginatedUsers = (allUsers || []).slice(from, to + 1);

    // Mapear los resultados a WorkspaceUser
    const users: WorkspaceUser[] = paginatedUsers.map((row: any) => {
      const displayName = row.full_name || row.email?.split("@")[0] || `Usuario ${row.user_id.substring(0, 8)}`;
      
      return {
        id: row.membership_id,
        user_id: row.user_id,
        workspace_id: row.workspace_id,
        role: row.role as UserRole,
        status: row.status as UserStatus,
        created_at: row.created_at,
        created_by_user_id: row.created_by_user_id,
        email: row.email || null,
        display_name: displayName,
        avatar_url: row.avatar_url || null,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
      };
    });

    console.log(`[Users] Total de usuarios procesados después de paginación: ${users.length}`);

    return {
      users,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("[Users] Error inesperado obteniendo usuarios:", error);
    return {
      users: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

