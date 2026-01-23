import { SupabaseClient } from "@supabase/supabase-js";

export type ContractProfileFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'MONEY' | 'SELECT' | 'CHECKBOX';

export interface ContractProfile {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by_user_id: string;
}

export interface ContractProfileField {
  id: string;
  workspace_id: string;
  profile_id: string;
  key: string;
  label: string;
  type: ContractProfileFieldType;
  is_required: boolean;
  options: { options: string[] } | null;
  sort_order: number;
  created_at: string;
}

export interface PaginatedProfiles {
  profiles: ContractProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateContractProfileParams {
  name: string;
  description?: string | null;
}

export interface UpdateContractProfileParams {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface CreateContractProfileFieldParams {
  profile_id: string;
  key: string;
  label: string;
  type: ContractProfileFieldType;
  is_required?: boolean;
  options?: { options: string[] } | null;
  sort_order?: number;
}

export interface UpdateContractProfileFieldParams {
  key?: string;
  label?: string;
  type?: ContractProfileFieldType;
  is_required?: boolean;
  options?: { options: string[] } | null;
  sort_order?: number;
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
      console.error("[ContractProfiles] Error obteniendo workspace_id:", error);
      return null;
    }

    return membership?.workspace_id || null;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado obteniendo workspace_id:", error);
    return null;
  }
}

/**
 * Obtiene los perfiles de contratos del workspace del usuario actual con paginación
 */
export async function getWorkspaceContractProfilesPaginated(
  supabase: SupabaseClient,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedProfiles> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        profiles: [],
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
        profiles: [],
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
      .from('contract_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (countError) {
      console.error("[ContractProfiles] Error obteniendo el total de perfiles:", countError);
      return {
        profiles: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Obtener los perfiles paginados
    const { data, error } = await supabase
      .from('contract_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[ContractProfiles] Error obteniendo perfiles paginados:", error);
      return {
        profiles: [],
        total,
        page,
        pageSize,
        totalPages,
      };
    }

    return {
      profiles: (data || []) as ContractProfile[],
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado obteniendo perfiles paginados:", error);
    return {
      profiles: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

/**
 * Obtiene los campos de un perfil de contrato
 */
export async function getContractProfileFields(
  supabase: SupabaseClient,
  profileId: string
): Promise<ContractProfileField[]> {
  try {
    const { data, error } = await supabase
      .from('contract_profile_fields')
      .select('*')
      .eq('profile_id', profileId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error("[ContractProfiles] Error obteniendo campos del perfil:", error);
      return [];
    }

    return (data || []) as ContractProfileField[];
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado obteniendo campos del perfil:", error);
    return [];
  }
}

/**
 * Crea un nuevo perfil de contrato
 */
export async function createContractProfile(
  supabase: SupabaseClient,
  params: CreateContractProfileParams
): Promise<ContractProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[ContractProfiles] No se pudo obtener el usuario para crear perfil");
      return null;
    }

    // Obtener el workspace_id del usuario
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      console.error("[ContractProfiles] No se pudo obtener el workspace_id del usuario");
      return null;
    }

    // Insertar el perfil
    const { data, error } = await supabase
      .from('contract_profiles')
      .insert({
        workspace_id: workspaceId,
        name: params.name.trim(),
        description: params.description?.trim() || null,
        is_active: true,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      // Si el error es por violación de restricción única (nombre duplicado)
      if (error.code === '23505') {
        console.error("[ContractProfiles] Ya existe un perfil activo con este nombre");
        throw new Error("Ya existe un perfil activo con este nombre");
      }
      console.error("[ContractProfiles] Error creando perfil:", error);
      throw error;
    }

    return data as ContractProfile;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado creando perfil:", error);
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

/**
 * Actualiza un perfil de contrato
 */
export async function updateContractProfile(
  supabase: SupabaseClient,
  profileId: string,
  params: UpdateContractProfileParams
): Promise<ContractProfile | null> {
  try {
    const updateData: any = {};
    
    if (params.name !== undefined) {
      updateData.name = params.name.trim();
    }
    if (params.description !== undefined) {
      updateData.description = params.description?.trim() || null;
    }
    if (params.is_active !== undefined) {
      updateData.is_active = params.is_active;
    }

    const { data, error } = await supabase
      .from('contract_profiles')
      .update(updateData)
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      // Si el error es por violación de restricción única (nombre duplicado)
      if (error.code === '23505') {
        console.error("[ContractProfiles] Ya existe un perfil activo con este nombre");
        throw new Error("Ya existe un perfil activo con este nombre");
      }
      console.error("[ContractProfiles] Error actualizando perfil:", error);
      throw error;
    }

    return data as ContractProfile;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado actualizando perfil:", error);
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

/**
 * Elimina un perfil de contrato (soft delete - marca is_active = false)
 */
export async function deleteContractProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('contract_profiles')
      .update({ is_active: false })
      .eq('id', profileId);

    if (error) {
      console.error("[ContractProfiles] Error eliminando perfil:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado eliminando perfil:", error);
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
}

/**
 * Crea un nuevo campo en un perfil de contrato
 */
export async function createContractProfileField(
  supabase: SupabaseClient,
  params: CreateContractProfileFieldParams
): Promise<ContractProfileField | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[ContractProfiles] No se pudo obtener el usuario para crear campo");
      return null;
    }

    // Obtener el workspace_id del usuario
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      console.error("[ContractProfiles] No se pudo obtener el workspace_id del usuario");
      return null;
    }

    // Obtener el máximo sort_order para este perfil
    const { data: existingFields } = await supabase
      .from('contract_profile_fields')
      .select('sort_order')
      .eq('profile_id', params.profile_id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = existingFields && existingFields.length > 0
      ? (existingFields[0].sort_order || 0) + 1
      : (params.sort_order || 0);

    // Preparar options según el tipo
    let options = null;
    if (params.type === 'SELECT' && params.options) {
      options = params.options;
    }

    // Insertar el campo
    const { data, error } = await supabase
      .from('contract_profile_fields')
      .insert({
        workspace_id: workspaceId,
        profile_id: params.profile_id,
        key: params.key.trim(),
        label: params.label.trim(),
        type: params.type,
        is_required: params.is_required || false,
        options: options,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) {
      // Si el error es por violación de restricción única (key duplicado)
      if (error.code === '23505') {
        console.error("[ContractProfiles] Ya existe un campo con este key en este perfil");
        throw new Error("Ya existe un campo con este key en este perfil");
      }
      console.error("[ContractProfiles] Error creando campo:", error);
      throw error;
    }

    return data as ContractProfileField;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado creando campo:", error);
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

/**
 * Actualiza un campo de un perfil de contrato
 */
export async function updateContractProfileField(
  supabase: SupabaseClient,
  fieldId: string,
  params: UpdateContractProfileFieldParams
): Promise<ContractProfileField | null> {
  try {
    const updateData: any = {};
    
    if (params.key !== undefined) {
      updateData.key = params.key.trim();
    }
    if (params.label !== undefined) {
      updateData.label = params.label.trim();
    }
    if (params.type !== undefined) {
      updateData.type = params.type;
      // Si cambia de SELECT a otro tipo, limpiar options
      if (params.type !== 'SELECT') {
        updateData.options = null;
      }
    }
    if (params.is_required !== undefined) {
      updateData.is_required = params.is_required;
    }
    if (params.options !== undefined) {
      // Si el tipo es SELECT, usar las opciones; si no, null
      updateData.options = params.type === 'SELECT' ? params.options : null;
    }
    if (params.sort_order !== undefined) {
      updateData.sort_order = params.sort_order;
    }

    const { data, error } = await supabase
      .from('contract_profile_fields')
      .update(updateData)
      .eq('id', fieldId)
      .select()
      .single();

    if (error) {
      // Si el error es por violación de restricción única (key duplicado)
      if (error.code === '23505') {
        console.error("[ContractProfiles] Ya existe un campo con este key en este perfil");
        throw new Error("Ya existe un campo con este key en este perfil");
      }
      console.error("[ContractProfiles] Error actualizando campo:", error);
      throw error;
    }

    return data as ContractProfileField;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado actualizando campo:", error);
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

/**
 * Elimina un campo de un perfil de contrato
 */
export async function deleteContractProfileField(
  supabase: SupabaseClient,
  fieldId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('contract_profile_fields')
      .delete()
      .eq('id', fieldId);

    if (error) {
      console.error("[ContractProfiles] Error eliminando campo:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado eliminando campo:", error);
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
}

/**
 * Reordena los campos de un perfil (actualiza sort_order)
 */
export async function reorderProfileFields(
  supabase: SupabaseClient,
  fieldIds: string[]
): Promise<boolean> {
  try {
    // Actualizar cada campo con su nuevo sort_order
    const updates = fieldIds.map((fieldId, index) => 
      supabase
        .from('contract_profile_fields')
        .update({ sort_order: index })
        .eq('id', fieldId)
    );

    const results = await Promise.all(updates);
    
    // Verificar si hubo algún error
    const hasError = results.some(result => result.error);
    if (hasError) {
      console.error("[ContractProfiles] Error reordenando campos");
      throw new Error("Error al reordenar los campos");
    }

    return true;
  } catch (error) {
    console.error("[ContractProfiles] Error inesperado reordenando campos:", error);
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
}

