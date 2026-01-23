-- Tipo ENUM para tipos de campo en perfiles de contratos
CREATE TYPE public.contract_profile_field_type AS ENUM (
  'TEXT',
  'NUMBER',
  'DATE',
  'MONEY',
  'SELECT',
  'CHECKBOX'
);

-- Tabla: contract_profiles - Maestro de perfiles de contratos
CREATE TABLE IF NOT EXISTS public.contract_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

-- Tabla: contract_profile_fields - Define qué campos existen en cada perfil
CREATE TABLE IF NOT EXISTS public.contract_profile_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.contract_profiles(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  type public.contract_profile_field_type NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  options jsonb, -- Para campos de tipo SELECT
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS en ambas tablas
ALTER TABLE public.contract_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_profile_fields ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS PARA contract_profiles
-- ============================================

-- Política: Los usuarios solo pueden ver perfiles de sus workspaces
CREATE POLICY "Users can view contract profiles from their workspace"
  ON public.contract_profiles FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

-- Política: Solo OWNER o EDITOR pueden crear perfiles
CREATE POLICY "Owners and editors can create contract profiles"
  ON public.contract_profiles FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
    AND created_by_user_id = auth.uid()
  );

-- Política: Solo OWNER o EDITOR pueden actualizar perfiles
CREATE POLICY "Owners and editors can update contract profiles"
  ON public.contract_profiles FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
  );

-- Política: Solo OWNER puede eliminar perfiles
CREATE POLICY "Owners can delete contract profiles"
  ON public.contract_profiles FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role = 'OWNER'
    )
  );

-- ============================================
-- POLÍTICAS RLS PARA contract_profile_fields
-- ============================================

-- Política: Los usuarios solo pueden ver campos de perfiles de sus workspaces
CREATE POLICY "Users can view contract profile fields from their workspace"
  ON public.contract_profile_fields FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

-- Política: Solo OWNER o EDITOR pueden crear campos
CREATE POLICY "Owners and editors can create contract profile fields"
  ON public.contract_profile_fields FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
    -- Verificar que el profile_id pertenece al mismo workspace
    AND profile_id IN (
      SELECT id 
      FROM public.contract_profiles 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() 
          AND status = 'ACTIVE' 
          AND role IN ('OWNER', 'EDITOR')
      )
    )
  );

-- Política: Solo OWNER o EDITOR pueden actualizar campos
CREATE POLICY "Owners and editors can update contract profile fields"
  ON public.contract_profile_fields FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
    -- Verificar que el profile_id no cambió o sigue siendo válido
    AND profile_id IN (
      SELECT id 
      FROM public.contract_profiles 
      WHERE workspace_id IN (
        SELECT workspace_id 
        FROM public.workspace_members 
        WHERE user_id = auth.uid() 
          AND status = 'ACTIVE' 
          AND role IN ('OWNER', 'EDITOR')
      )
    )
  );

-- Política: Solo OWNER o EDITOR pueden eliminar campos
CREATE POLICY "Owners and editors can delete contract profile fields"
  ON public.contract_profile_fields FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
  );

-- ============================================
-- ÍNDICES PARA contract_profiles
-- ============================================

CREATE INDEX idx_contract_profiles_workspace_id ON public.contract_profiles (workspace_id);
CREATE INDEX idx_contract_profiles_is_active ON public.contract_profiles (is_active);
CREATE INDEX idx_contract_profiles_created_at ON public.contract_profiles (created_at DESC);
CREATE INDEX idx_contract_profiles_created_by_user_id ON public.contract_profiles (created_by_user_id);

-- Índice único para evitar nombres duplicados en el mismo workspace
CREATE UNIQUE INDEX idx_contract_profiles_workspace_name_unique 
  ON public.contract_profiles (workspace_id, name) 
  WHERE is_active = true;

-- ============================================
-- ÍNDICES PARA contract_profile_fields
-- ============================================

CREATE INDEX idx_contract_profile_fields_workspace_id ON public.contract_profile_fields (workspace_id);
CREATE INDEX idx_contract_profile_fields_profile_id ON public.contract_profile_fields (profile_id);
CREATE INDEX idx_contract_profile_fields_key ON public.contract_profile_fields (key);
CREATE INDEX idx_contract_profile_fields_sort_order ON public.contract_profile_fields (profile_id, sort_order);

-- Índice único para evitar keys duplicados en el mismo perfil
CREATE UNIQUE INDEX idx_contract_profile_fields_profile_key_unique 
  ON public.contract_profile_fields (profile_id, key);

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE public.contract_profiles IS 'Maestro de perfiles de contratos. Define tipos de contratos (ej: Servicios, Arriendo)';
COMMENT ON TABLE public.contract_profile_fields IS 'Define qué campos existen en cada perfil de contrato';
COMMENT ON COLUMN public.contract_profile_fields.options IS 'JSONB con opciones para campos de tipo SELECT. Ej: {"options": ["Opción 1", "Opción 2"]}';
COMMENT ON COLUMN public.contract_profile_fields.key IS 'Identificador único del campo dentro del perfil (ej: sla_hours, monthly_fee)';
COMMENT ON COLUMN public.contract_profile_fields.label IS 'Etiqueta legible del campo (ej: "SLA (horas)", "Tarifa mensual")';

