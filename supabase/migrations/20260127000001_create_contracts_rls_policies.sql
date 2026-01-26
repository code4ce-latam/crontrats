-- ============================================
-- HABILITAR RLS EN TABLAS DE CONTRATOS
-- ============================================

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_additional_files ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS PARA contracts
-- ============================================

-- Política SELECT: Usuario puede ver contratos si tiene READ/EDIT/OWNER en la carpeta
CREATE POLICY "Users can view contracts with folder permission"
  ON public.contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = contracts.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('READ', 'EDIT', 'OWNER')
    )
  );

-- Política INSERT: Usuario puede crear contratos si:
-- - Es miembro activo del workspace
-- - created_by_user_id = auth.uid()
-- - Tiene EDIT/OWNER en folder_id
-- - Y workspace_members.role in ('OWNER','EDITOR')
CREATE POLICY "Users can create contracts with proper permissions"
  ON public.contracts FOR INSERT
  WITH CHECK (
    -- Usuario es miembro activo del workspace
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contracts.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND created_by_user_id = auth.uid()
    AND (
      -- Tiene EDIT/OWNER en la carpeta
      EXISTS (
        SELECT 1 FROM public.folder_permissions fp
        INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
        WHERE fp.folder_id = contracts.folder_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'ACTIVE'
          AND fp.access IN ('EDIT', 'OWNER')
      )
    )
  );

-- Política UPDATE: Usuario puede actualizar contratos si:
-- - Tiene EDIT/OWNER en folder_id
-- - Y workspace_members.role in ('OWNER','EDITOR')
CREATE POLICY "Users can update contracts with folder permission"
  ON public.contracts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contracts.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = contracts.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contracts.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = contracts.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  );

-- ============================================
-- POLÍTICAS RLS PARA contract_field_values
-- ============================================

-- Política SELECT: Usuario puede ver valores si puede ver el contrato
CREATE POLICY "Users can view contract field values if they can view contract"
  ON public.contract_field_values FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_field_values.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('READ', 'EDIT', 'OWNER')
    )
  );

-- Política INSERT: Usuario puede insertar valores si puede EDIT el contrato
CREATE POLICY "Users can insert contract field values if they can edit contract"
  ON public.contract_field_values FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_field_values.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_field_values.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  );

-- Política UPDATE: Usuario puede actualizar valores si puede EDIT el contrato
CREATE POLICY "Users can update contract field values if they can edit contract"
  ON public.contract_field_values FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_field_values.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_field_values.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_field_values.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_field_values.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  );

-- Política DELETE: Usuario puede eliminar valores si puede EDIT el contrato
CREATE POLICY "Users can delete contract field values if they can edit contract"
  ON public.contract_field_values FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_field_values.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_field_values.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  );

-- ============================================
-- POLÍTICAS RLS PARA contract_file_versions
-- ============================================

-- Política SELECT: Usuario puede ver versiones si puede READ el contrato
CREATE POLICY "Users can view contract file versions if they can view contract"
  ON public.contract_file_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_file_versions.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('READ', 'EDIT', 'OWNER')
    )
  );

-- Política INSERT: Usuario puede insertar versiones si puede EDIT el contrato
CREATE POLICY "Users can insert contract file versions if they can edit contract"
  ON public.contract_file_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_file_versions.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_file_versions.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
    AND uploaded_by_user_id = auth.uid()
  );

-- Política DELETE: Usuario puede eliminar versiones si puede EDIT el contrato
CREATE POLICY "Users can delete contract file versions if they can edit contract"
  ON public.contract_file_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_file_versions.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_file_versions.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  );

-- ============================================
-- POLÍTICAS RLS PARA contract_additional_files
-- ============================================

-- Política SELECT: Usuario puede ver archivos adicionales si puede READ el contrato
CREATE POLICY "Users can view contract additional files if they can view contract"
  ON public.contract_additional_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_additional_files.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('READ', 'EDIT', 'OWNER')
    )
  );

-- Política INSERT: Usuario puede insertar archivos adicionales si puede EDIT el contrato
CREATE POLICY "Users can insert contract additional files if they can edit contract"
  ON public.contract_additional_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_additional_files.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_additional_files.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
    AND uploaded_by_user_id = auth.uid()
  );

-- Política DELETE: Usuario puede eliminar archivos adicionales si puede EDIT el contrato
CREATE POLICY "Users can delete contract additional files if they can edit contract"
  ON public.contract_additional_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = contract_additional_files.workspace_id 
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'EDITOR')
    )
    AND EXISTS (
      SELECT 1 FROM public.contracts c
      INNER JOIN public.folder_permissions fp ON c.folder_id = fp.folder_id
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE c.id = contract_additional_files.contract_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
    )
  );

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON POLICY "Users can view contracts with folder permission" ON public.contracts IS 'Los usuarios solo pueden ver contratos de carpetas donde tienen permiso READ/EDIT/OWNER';
COMMENT ON POLICY "Users can create contracts with proper permissions" ON public.contracts IS 'Los usuarios pueden crear contratos si tienen EDIT/OWNER en la carpeta y son OWNER/EDITOR del workspace';
COMMENT ON POLICY "Users can update contracts with folder permission" ON public.contracts IS 'Los usuarios pueden actualizar contratos si tienen EDIT/OWNER en la carpeta y son OWNER/EDITOR del workspace';

