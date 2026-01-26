-- ============================================
-- SPRINT 2.1: RLS Policies para Anotaciones
-- ============================================

-- Habilitar RLS
ALTER TABLE public.contract_file_annotations ENABLE ROW LEVEL SECURITY;

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
-- Permitir si usuario tiene EDIT/OWNER
-- Si es DRAFT, solo el creador puede editar
-- ============================================
CREATE POLICY "Users can update annotations if they can edit contract"
  ON public.contract_file_annotations FOR UPDATE
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
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
        AND (
          contract_file_annotations.status = 'PUBLISHED'
          OR contract_file_annotations.created_by_user_id = auth.uid()
        )
    )
  );

-- ============================================
-- POLÍTICA DELETE
-- Permitir si usuario tiene EDIT/OWNER
-- Solo borrar drafts del propio usuario (o si es OWNER)
-- ============================================
CREATE POLICY "Users can delete annotations if they can edit contract"
  ON public.contract_file_annotations FOR DELETE
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
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
        AND (
          contract_file_annotations.status = 'DRAFT'
          AND contract_file_annotations.created_by_user_id = auth.uid()
        )
    )
  );

