import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Obtiene el contexto (contract_id, workspace_id, folder_id) desde un file_version_id
 * IMPORTANTE: No confiar en datos del cliente, siempre obtener desde BD
 */
export async function getFileVersionContext(
  supabase: SupabaseClient,
  fileVersionId: string
): Promise<{
  contract_id: string;
  workspace_id: string;
  folder_id: string;
} | null> {
  const { data, error } = await supabase
    .from('contract_file_versions')
    .select(`
      contract_id,
      contracts!inner (
        id,
        workspace_id,
        folder_id
      )
    `)
    .eq('id', fileVersionId)
    .single();

  if (error || !data) {
    console.error("[Annotations] Error obteniendo contexto de file_version:", error);
    return null;
  }

  return {
    contract_id: data.contract_id,
    workspace_id: data.contracts.workspace_id,
    folder_id: data.contracts.folder_id,
  };
}

/**
 * Valida que el usuario tiene acceso EDIT/OWNER a la carpeta del contrato
 */
export async function validateAnnotationPermissions(
  supabase: SupabaseClient,
  folderId: string,
  requiredAccess: 'EDIT' | 'OWNER' = 'EDIT'
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('id, workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single();

  if (!membership) return false;

  const { data: permission } = await supabase
    .from('folder_permissions')
    .select('access')
    .eq('folder_id', folderId)
    .eq('member_id', membership.id)
    .single();

  if (!permission) return false;

  if (requiredAccess === 'OWNER') {
    return permission.access === 'OWNER';
  }

  return permission.access === 'EDIT' || permission.access === 'OWNER';
}

