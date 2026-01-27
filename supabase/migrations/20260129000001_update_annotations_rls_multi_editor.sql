-- ============================================
-- Actualización RLS: Anotaciones Multi-Editor
-- Eliminar referencias a status
-- ============================================

-- Eliminar políticas antiguas
DROP POLICY IF EXISTS "Users can view annotations if they can view contract" ON public.contract_file_annotations;
DROP POLICY IF EXISTS "Users can create annotations if they can edit contract" ON public.contract_file_annotations;
DROP POLICY IF EXISTS "Users can update annotations if they can edit contract" ON public.contract_file_annotations;
DROP POLICY IF EXISTS "Users can delete annotations if they can edit contract" ON public.contract_file_annotations;

-- ============================================
-- POLÍTICA SELECT
-- Permitir si el usuario tiene acceso READ/EDIT/OWNER a la carpeta del contrato
-- ============================================
CREATE POLICY "Users can view annotations if they can view contract"
  ON public.contract_file_annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('READ', 'EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
    )
  );

-- ============================================
-- POLÍTICA INSERT
-- Permitir si created_by_user_id = auth.uid() y usuario tiene EDIT/OWNER
-- ============================================
CREATE POLICY "Users can create annotations if they can edit contract"
  ON public.contract_file_annotations FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
    )
  );

-- ============================================
-- POLÍTICA UPDATE
-- Permitir solo si el usuario es el creador y tiene EDIT/OWNER
-- ============================================
CREATE POLICY "Users can update their own annotations if they can edit contract"
  ON public.contract_file_annotations FOR UPDATE
  USING (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
    )
  );

-- ============================================
-- POLÍTICA DELETE
-- Permitir solo si el usuario es el creador y tiene EDIT/OWNER
-- ============================================
CREATE POLICY "Users can delete their own annotations if they can edit contract"
  ON public.contract_file_annotations FOR DELETE
  USING (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
    )
  );

