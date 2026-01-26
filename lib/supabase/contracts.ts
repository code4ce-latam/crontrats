import { SupabaseClient } from "@supabase/supabase-js";
import { getUserWorkspaceId as getUserWorkspaceIdFromFolders, getFolderAccess, type FolderAccess } from "./folders";

// Re-exportar getUserWorkspaceId para facilitar las importaciones
export { getUserWorkspaceIdFromFolders as getUserWorkspaceId };

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'ARCHIVED';

export interface Contract {
  id: string;
  workspace_id: string;
  folder_id: string;
  profile_id: string | null;
  title: string;
  start_date: string;
  end_date: string | null;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
}

export interface ContractFieldValue {
  id: string;
  workspace_id: string;
  contract_id: string;
  profile_field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_money: number | null;
  value_bool: boolean | null;
  value_json: any | null;
  created_at: string;
  updated_at: string;
}

export interface ContractFileVersion {
  id: string;
  workspace_id: string;
  contract_id: string;
  version: number;
  is_current: boolean;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size: number | null;
  uploaded_at: string;
  uploaded_by_user_id: string;
}

export interface ContractAdditionalFile {
  id: string;
  workspace_id: string;
  contract_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size: number | null;
  uploaded_at: string;
  uploaded_by_user_id: string;
}

export interface ContractWithDetails extends Contract {
  profile?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  folder?: {
    id: string;
    name: string;
    path: string;
  } | null;
  field_values?: Array<ContractFieldValue & {
    profile_field: {
      id: string;
      key: string;
      label: string;
      type: string;
      is_required: boolean;
      options: any | null;
    };
  }>;
  file_versions?: ContractFileVersion[];
  additional_files?: ContractAdditionalFile[];
  access?: FolderAccess | null; // Acceso del usuario actual
}

/**
 * Obtiene el acceso del usuario actual a un contrato (basado en permisos de carpeta)
 * @returns 'OWNER' | 'EDIT' | 'READ' | null si no tiene acceso
 */
export async function getContractAccess(
  supabase: SupabaseClient,
  contractId: string
): Promise<FolderAccess | null> {
  try {
    // Obtener el folder_id del contrato
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('folder_id')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      return null;
    }

    // Obtener acceso a la carpeta
    return await getFolderAccess(supabase, contract.folder_id);
  } catch (error) {
    console.error("[Contracts] Error obteniendo access de contrato:", error);
    return null;
  }
}

/**
 * Valida que el usuario tiene el permiso requerido en la carpeta
 * @param folderId - ID de la carpeta
 * @param requiredAccess - Acceso mínimo requerido ('READ' | 'EDIT' | 'OWNER')
 * @returns true si tiene el permiso, false si no
 */
export async function validateContractPermissions(
  supabase: SupabaseClient,
  folderId: string,
  requiredAccess: FolderAccess
): Promise<boolean> {
  try {
    const access = await getFolderAccess(supabase, folderId);
    if (!access) {
      return false;
    }

    // Jerarquía de permisos: READ < EDIT < OWNER
    const accessLevels: Record<FolderAccess, number> = {
      READ: 1,
      EDIT: 2,
      OWNER: 3,
    };

    return accessLevels[access] >= accessLevels[requiredAccess];
  } catch (error) {
    console.error("[Contracts] Error validando permisos:", error);
    return false;
  }
}

/**
 * Obtiene un contrato completo con todos sus detalles
 */
export async function getContractWithDetails(
  supabase: SupabaseClient,
  contractId: string
): Promise<ContractWithDetails | null> {
  try {
    // Obtener contrato básico
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      return null;
    }

    // Paralelizar consultas independientes
    const [
      profileResult,
      folderResult,
      fieldValuesResult,
      fileVersionsResult,
      additionalFilesResult,
    ] = await Promise.all([
      // Obtener profile si existe
      contract.profile_id
        ? supabase
            .from('contract_profiles')
            .select('id, name, description')
            .eq('id', contract.profile_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      
      // Obtener folder
      supabase
        .from('folders')
        .select('id, name, path')
        .eq('id', contract.folder_id)
        .single(),

      // Obtener field values con profile fields
      supabase
        .from('contract_field_values')
        .select(`
          *,
          profile_field:contract_profile_fields (
            id,
            key,
            label,
            type,
            is_required,
            options
          )
        `)
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true }),

      // Obtener file versions
      supabase
        .from('contract_file_versions')
        .select('*')
        .eq('contract_id', contractId)
        .order('version', { ascending: false }),

      // Obtener additional files
      supabase
        .from('contract_additional_files')
        .select('*')
        .eq('contract_id', contractId)
        .order('uploaded_at', { ascending: false }),
    ]);

    const profile = profileResult.data;
    const folder = folderResult.data;
    const fieldValues = fieldValuesResult.data;
    const fileVersions = fileVersionsResult.data;
    const additionalFiles = additionalFilesResult.data;

    // Obtener acceso del usuario actual (depende del contrato, debe ser después)
    const access = await getContractAccess(supabase, contractId);

    return {
      ...contract,
      profile: profile || null,
      folder: folder || null,
      field_values: fieldValues || [],
      file_versions: fileVersions || [],
      additional_files: additionalFiles || [],
      access,
    } as ContractWithDetails;
  } catch (error) {
    console.error("[Contracts] Error obteniendo contrato con detalles:", error);
    return null;
  }
}

/**
 * Lista contratos accesibles de una carpeta
 */
export async function getContractsByFolder(
  supabase: SupabaseClient,
  folderId: string
): Promise<Contract[]> {
  try {
    // Verificar que el usuario tiene acceso a la carpeta
    const access = await getFolderAccess(supabase, folderId);
    if (!access) {
      return []; // No tiene acceso, retornar array vacío
    }

    // Obtener contratos (RLS filtra automáticamente)
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[Contracts] Error obteniendo contratos:", error);
      return [];
    }

    return contracts || [];
  } catch (error) {
    console.error("[Contracts] Error inesperado obteniendo contratos:", error);
    return [];
  }
}

/**
 * Obtiene el member_id del usuario actual en el workspace
 */
export async function getCurrentUserMemberId(
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    const workspaceId = await getUserWorkspaceIdFromFolders(supabase);
    if (!workspaceId) {
      return null;
    }

    const { data: membership, error } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error || !membership) {
      return null;
    }

    return membership.id;
  } catch (error) {
    console.error("[Contracts] Error obteniendo member_id:", error);
    return null;
  }
}

/**
 * Obtiene el siguiente número de versión para un contrato
 */
export async function getNextVersionNumber(
  supabase: SupabaseClient,
  contractId: string
): Promise<number> {
  try {
    const { data: versions, error } = await supabase
      .from('contract_file_versions')
      .select('version')
      .eq('contract_id', contractId)
      .order('version', { ascending: false })
      .limit(1);

    if (error || !versions || versions.length === 0) {
      return 1; // Primera versión
    }

    return versions[0].version + 1;
  } catch (error) {
    console.error("[Contracts] Error obteniendo siguiente versión:", error);
    return 1;
  }
}

