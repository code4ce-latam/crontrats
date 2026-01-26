-- ENUM para estados de contratos
CREATE TYPE public.contract_status AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELED', 'ARCHIVED');

-- ============================================
-- TABLA: contracts
-- ============================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  profile_id uuid NULL REFERENCES public.contract_profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NULL,
  status public.contract_status NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Constraint: profile_id debe pertenecer al mismo workspace_id
  CONSTRAINT contracts_profile_workspace_check CHECK (
    profile_id IS NULL OR EXISTS (
      SELECT 1 FROM public.contract_profiles cp
      WHERE cp.id = contracts.profile_id
        AND cp.workspace_id = contracts.workspace_id
    )
  )
);

-- ============================================
-- TABLA: contract_field_values
-- Valores dinámicos por campo de perfil
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  profile_field_id uuid NOT NULL REFERENCES public.contract_profile_fields(id) ON DELETE CASCADE,
  value_text text NULL,
  value_number numeric NULL,
  value_date date NULL,
  value_money numeric NULL,
  value_bool boolean NULL,
  value_json jsonb NULL, -- Para SELECT/multi y casos complejos
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Unique: un contrato solo puede tener un valor por campo de perfil
  UNIQUE (contract_id, profile_field_id)
);

-- ============================================
-- TABLA: contract_file_versions
-- Versiones del documento principal
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  version int NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  storage_path text NOT NULL,
  original_name text NOT NULL,
  mime_type text NULL,
  size int NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Unique: un contrato solo puede tener una versión con el mismo número
  UNIQUE (contract_id, version)
);

-- ============================================
-- TABLA: contract_additional_files
-- Archivos adicionales adjuntos
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_additional_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_name text NOT NULL,
  mime_type text NULL,
  size int NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  uploaded_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

-- ============================================
-- TRIGGER PARA updated_at
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para contracts
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para contract_field_values
CREATE TRIGGER contract_field_values_updated_at
  BEFORE UPDATE ON public.contract_field_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ÍNDICES PARA contracts
-- ============================================
CREATE INDEX idx_contracts_workspace_id ON public.contracts (workspace_id);
CREATE INDEX idx_contracts_folder_id ON public.contracts (folder_id);
CREATE INDEX idx_contracts_profile_id ON public.contracts (profile_id);
CREATE INDEX idx_contracts_status ON public.contracts (status);
CREATE INDEX idx_contracts_created_at ON public.contracts (created_at DESC);
CREATE INDEX idx_contracts_start_date ON public.contracts (start_date);
CREATE INDEX idx_contracts_end_date ON public.contracts (end_date);
CREATE INDEX idx_contracts_created_by_user_id ON public.contracts (created_by_user_id);

-- ============================================
-- ÍNDICES PARA contract_field_values
-- ============================================
CREATE INDEX idx_contract_field_values_workspace_id ON public.contract_field_values (workspace_id);
CREATE INDEX idx_contract_field_values_contract_id ON public.contract_field_values (contract_id);
CREATE INDEX idx_contract_field_values_profile_field_id ON public.contract_field_values (profile_field_id);

-- ============================================
-- ÍNDICES PARA contract_file_versions
-- ============================================
CREATE INDEX idx_contract_file_versions_workspace_id ON public.contract_file_versions (workspace_id);
CREATE INDEX idx_contract_file_versions_contract_id ON public.contract_file_versions (contract_id);
CREATE INDEX idx_contract_file_versions_is_current ON public.contract_file_versions (contract_id, is_current) WHERE is_current = true;
CREATE INDEX idx_contract_file_versions_version ON public.contract_file_versions (contract_id, version DESC);

-- ============================================
-- ÍNDICES PARA contract_additional_files
-- ============================================
CREATE INDEX idx_contract_additional_files_workspace_id ON public.contract_additional_files (workspace_id);
CREATE INDEX idx_contract_additional_files_contract_id ON public.contract_additional_files (contract_id);
CREATE INDEX idx_contract_additional_files_uploaded_at ON public.contract_additional_files (contract_id, uploaded_at DESC);

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE public.contracts IS 'Contratos vinculados a carpetas. Cada contrato pertenece a una carpeta y puede tener un perfil asignado.';
COMMENT ON TABLE public.contract_field_values IS 'Valores dinámicos de campos de perfil para cada contrato. Los valores se almacenan según el tipo de campo.';
COMMENT ON TABLE public.contract_file_versions IS 'Versiones del documento principal del contrato. Solo una versión puede ser current=true por contrato.';
COMMENT ON TABLE public.contract_additional_files IS 'Archivos adicionales adjuntos al contrato (no versionados).';
COMMENT ON COLUMN public.contract_field_values.value_json IS 'Almacena valores complejos como arrays para campos SELECT o estructuras JSON personalizadas.';

