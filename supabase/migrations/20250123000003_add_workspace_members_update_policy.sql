-- Política para permitir que los OWNER actualicen roles de miembros del workspace
CREATE POLICY "Owners can update workspace member roles"
  ON public.workspace_members FOR UPDATE
  USING (
    -- Solo permitir si el usuario actual es OWNER del mismo workspace
    workspace_id = get_user_active_workspace_id()
    AND EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = workspace_members.workspace_id
        AND wm.status = 'ACTIVE'
        AND wm.role = 'OWNER'
    )
  )
  WITH CHECK (
    -- Verificar que después del update, el usuario sigue siendo OWNER
    workspace_id = get_user_active_workspace_id()
    AND EXISTS (
      SELECT 1 
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = workspace_members.workspace_id
        AND wm.status = 'ACTIVE'
        AND wm.role = 'OWNER'
    )
  );

-- Comentario
COMMENT ON POLICY "Owners can update workspace member roles" ON public.workspace_members IS 'Permite que los OWNER actualicen roles de otros miembros del mismo workspace';

