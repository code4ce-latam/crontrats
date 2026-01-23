import { SupabaseClient } from "@supabase/supabase-js";

export type ActivityType = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'VIEW' 
  | 'LOGIN' 
  | 'LOGOUT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SHARE'
  | 'COMMENT';

export type EntityType = 
  | 'contract' 
  | 'folder' 
  | 'user' 
  | 'workspace' 
  | 'profile'
  | 'document'
  | 'avatar'
  | 'workspace_member'
  | 'workspace_invite'
  | 'contract_profile'
  | 'contract_profile_field';

export interface Activity {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: ActivityType;
  entity_type: EntityType | null;
  entity_id: string | null;
  description: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface CreateActivityParams {
  type: ActivityType;
  entity_type?: EntityType;
  entity_id?: string;
  description: string;
  metadata?: Record<string, any>;
  workspace_id?: string | null;
}

export interface PaginatedActivities {
  activities: Activity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Crea una nueva actividad para el usuario actual
 */
export async function createActivity(
  supabase: SupabaseClient,
  params: CreateActivityParams
): Promise<Activity | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[Activities] No se pudo obtener el usuario para crear actividad");
      return null;
    }

    // Si no se proporciona workspace_id, intentar obtenerlo de las membresías del usuario
    let workspaceId = params.workspace_id;
    if (!workspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();
      
      workspaceId = membership?.workspace_id || null;
    }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        type: params.type,
        entity_type: params.entity_type || null,
        entity_id: params.entity_id || null,
        description: params.description,
        metadata: params.metadata || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Activities] Error creando actividad:", error);
      return null;
    }

    return data as Activity;
  } catch (error) {
    console.error("[Activities] Error inesperado creando actividad:", error);
    return null;
  }
}

/**
 * Obtiene las actividades recientes del usuario actual
 */
export async function getUserActivities(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<Activity[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Activities] Error obteniendo actividades:", error);
      return [];
    }

    return (data || []) as Activity[];
  } catch (error) {
    console.error("[Activities] Error inesperado obteniendo actividades:", error);
    return [];
  }
}

/**
 * Obtiene las actividades de un workspace específico
 */
export async function getWorkspaceActivities(
  supabase: SupabaseClient,
  workspaceId: string,
  limit: number = 50
): Promise<Activity[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Activities] Error obteniendo actividades del workspace:", error);
      return [];
    }

    return (data || []) as Activity[];
  } catch (error) {
    console.error("[Activities] Error inesperado obteniendo actividades del workspace:", error);
    return [];
  }
}

/**
 * Obtiene las actividades del usuario actual con paginación
 * Filtra por antigüedad según retentionDays
 */
export async function getUserActivitiesPaginated(
  supabase: SupabaseClient,
  page: number = 1,
  pageSize: number = 20,
  retentionDays: number = 90
): Promise<PaginatedActivities> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        activities: [],
        total: 0,
        page: 1,
        pageSize,
        totalPages: 0,
      };
    }

    // Calcular la fecha límite (retentionDays días atrás)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - retentionDays);
    const retentionDateISO = retentionDate.toISOString();

    // Calcular el rango para la paginación
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Obtener el total de registros (solo los últimos retentionDays días)
    const { count, error: countError } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', retentionDateISO);

    if (countError) {
      console.error("[Activities] Error obteniendo el total de actividades:", countError);
      return {
        activities: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Obtener las actividades paginadas (solo los últimos retentionDays días)
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', retentionDateISO)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[Activities] Error obteniendo actividades paginadas:", error);
      return {
        activities: [],
        total,
        page,
        pageSize,
        totalPages,
      };
    }

    return {
      activities: (data || []) as Activity[],
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("[Activities] Error inesperado obteniendo actividades paginadas:", error);
    return {
      activities: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

