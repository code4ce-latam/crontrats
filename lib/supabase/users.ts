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
 * @param supabase - Cliente de Supabase
 * @param userId - (Opcional) ID del usuario. Si no se proporciona, se obtiene del token actual
 */
export async function getUserWorkspaceId(
  supabase: SupabaseClient,
  userId?: string
): Promise<string | null> {
  try {
    let targetUserId = userId;
    
    // Si no se proporciona userId, obtenerlo del token actual
    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }
      targetUserId = user.id;
    }

    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', targetUserId)
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
 * OPTIMIZADO: Usa paginación en la base de datos en lugar de traer todos los registros
 */
export async function getWorkspaceUsersPaginated(
  supabase: SupabaseClient,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedUsers> {
  try {
    // Obtener usuario y workspace_id en una sola llamada optimizada
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

    // Obtener el workspace_id del usuario (reutilizar la llamada de auth.getUser)
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      console.error("[Users] Error obteniendo workspace_id:", membershipError);
      return {
        users: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const workspaceId = membership.workspace_id;

    // Calcular el offset para la paginación
    const offset = (page - 1) * pageSize;

    // Obtener el total de registros (en paralelo con la consulta de datos)
    const countPromise = supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE');

    // Obtener usuarios paginados directamente desde la base de datos
    const usersPromise = supabase.rpc('get_workspace_users', {
      workspace_uuid: workspaceId,
      p_limit: pageSize,
      p_offset: offset,
    });

    // Ejecutar ambas consultas en paralelo
    const [countResult, usersResult] = await Promise.all([
      countPromise,
      usersPromise,
    ]);

    if (countResult.error) {
      console.error("[Users] Error obteniendo el total de usuarios:", countResult.error);
      return {
        users: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const total = countResult.count || 0;
    const totalPages = Math.ceil(total / pageSize);

    if (usersResult.error) {
      console.error("[Users] Error obteniendo usuarios con RPC:", usersResult.error);
      return {
        users: [],
        total,
        page,
        pageSize,
        totalPages,
      };
    }

    // Mapear los resultados a WorkspaceUser
    const users: WorkspaceUser[] = (usersResult.data || []).map((row: any) => {
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

