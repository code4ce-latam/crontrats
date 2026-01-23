import { SupabaseClient } from "@supabase/supabase-js";

export type InviteRole = 'EDITOR' | 'READER';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  display_name: string | null;
  role: InviteRole;
  status: InviteStatus;
  token: string;
  invited_by_user_id: string;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
}

export interface PaginatedInvitations {
  invitations: WorkspaceInvite[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateInvitationParams {
  email: string;
  displayName?: string | null;
  role: InviteRole;
  token?: string; // Token opcional (si se proporciona, se usará en lugar de generar uno nuevo)
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
      console.error("[Invitations] Error obteniendo workspace_id:", error);
      return null;
    }

    return membership?.workspace_id || null;
  } catch (error) {
    console.error("[Invitations] Error inesperado obteniendo workspace_id:", error);
    return null;
  }
}

/**
 * Obtiene las invitaciones del workspace del usuario actual con paginación
 */
export async function getWorkspaceInvitationsPaginated(
  supabase: SupabaseClient,
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedInvitations> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        invitations: [],
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
        invitations: [],
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
      .from('workspace_invites')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (countError) {
      console.error("[Invitations] Error obteniendo el total de invitaciones:", countError);
      return {
        invitations: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    // Obtener las invitaciones paginadas
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('invited_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[Invitations] Error obteniendo invitaciones paginadas:", error);
      return {
        invitations: [],
        total,
        page,
        pageSize,
        totalPages,
      };
    }

    return {
      invitations: (data || []) as WorkspaceInvite[],
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    console.error("[Invitations] Error inesperado obteniendo invitaciones paginadas:", error);
    return {
      invitations: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }
}

/**
 * Crea una nueva invitación para el workspace del usuario actual
 */
export async function createWorkspaceInvitation(
  supabase: SupabaseClient,
  params: CreateInvitationParams
): Promise<WorkspaceInvite | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[Invitations] No se pudo obtener el usuario para crear invitación");
      return null;
    }

    // Obtener el workspace_id del usuario
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      console.error("[Invitations] No se pudo obtener el workspace_id del usuario");
      return null;
    }

    // Validar que el usuario no se invite a sí mismo
    const userEmail = user.email?.toLowerCase().trim();
    const inviteEmail = params.email.trim().toLowerCase();
    
    if (userEmail && userEmail === inviteEmail) {
      console.error("[Invitations] El usuario no puede enviarse una invitación a sí mismo");
      throw new Error("No puedes enviarte una invitación a ti mismo");
    }

    // Verificar que el usuario tenga permisos (OWNER o EDITOR)
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .single();

    if (membershipError || !membership) {
      console.error("[Invitations] Error verificando membresía:", membershipError);
      return null;
    }

    if (membership.role !== 'OWNER' && membership.role !== 'EDITOR') {
      console.error("[Invitations] El usuario no tiene permisos para crear invitaciones");
      return null;
    }

    // Generar token único
    // Si se proporciona un token, usarlo; de lo contrario, generar uno nuevo
    const token = (params as any).token || crypto.randomUUID();

    // Calcular fecha de expiración (7 días desde ahora)
    const invitedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insertar la invitación
    const { data, error } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: workspaceId,
        email: params.email.trim().toLowerCase(),
        display_name: params.displayName || null,
        role: params.role,
        status: 'PENDING',
        token: token,
        invited_by_user_id: user.id,
        invited_at: invitedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Si el error es por violación de restricción única (invitación pendiente duplicada)
      if (error.code === '23505') {
        console.error("[Invitations] Ya existe una invitación pendiente para este email");
        throw new Error("Ya existe una invitación pendiente para este email");
      }
      console.error("[Invitations] Error creando invitación:", error);
      throw error;
    }

    return data as WorkspaceInvite;
  } catch (error) {
    console.error("[Invitations] Error inesperado creando invitación:", error);
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

/**
 * Valida un token de invitación y retorna la información de la invitación
 */
export async function validateInviteToken(
  supabase: SupabaseClient,
  token: string
): Promise<WorkspaceInvite | null> {
  try {
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'PENDING')
      .single();

    if (error || !data) {
      console.error("[Invitations] Error validando token:", error);
      return null;
    }

    // Verificar que no haya expirado
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now > expiresAt) {
      console.error("[Invitations] La invitación ha expirado");
      // Actualizar el estado a EXPIRED
      await supabase
        .from('workspace_invites')
        .update({ status: 'EXPIRED' })
        .eq('id', data.id);
      return null;
    }

    return data as WorkspaceInvite;
  } catch (error) {
    console.error("[Invitations] Error inesperado validando token:", error);
    return null;
  }
}

