-- ENUM para tipos de acceso a carpetas
CREATE TYPE public.folder_access AS ENUM ('OWNER', 'EDIT', 'READ');

-- Tabla: folders - Carpetas del workspace
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id uuid NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  path text NOT NULL, -- Generado por trigger: 'id' o 'parent.path.id'
  sort_order integer NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT
);

-- Tabla: folder_permissions - Permisos por carpeta y miembro
CREATE TABLE IF NOT EXISTS public.folder_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  access public.folder_access NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  UNIQUE (folder_id, member_id)
);

-- ============================================
-- TRIGGER PARA GENERAR PATH AUTOMÁTICAMENTE
-- ============================================

-- Función que calcula el path después de INSERT
CREATE OR REPLACE FUNCTION public.generate_folder_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_path text;
BEGIN
  IF NEW.parent_id IS NULL THEN
    -- Si es raíz, path = id
    NEW.path := NEW.id::text;
  ELSE
    -- Si tiene padre, obtener path del padre y concatenar
    SELECT path INTO parent_path
    FROM public.folders
    WHERE id = NEW.parent_id;
    
    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Parent folder not found';
    END IF;
    
    NEW.path := parent_path || '.' || NEW.id::text;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que ejecuta la función antes de INSERT
CREATE TRIGGER folder_path_trigger
  BEFORE INSERT ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_folder_path();

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX idx_folders_workspace_id ON public.folders (workspace_id);
CREATE INDEX idx_folders_parent_id ON public.folders (parent_id);
CREATE INDEX idx_folders_path ON public.folders (path); -- Para búsquedas de descendientes
CREATE INDEX idx_folders_created_at ON public.folders (created_at DESC);

CREATE INDEX idx_folder_permissions_workspace_id ON public.folder_permissions (workspace_id);
CREATE INDEX idx_folder_permissions_folder_id ON public.folder_permissions (folder_id);
CREATE INDEX idx_folder_permissions_member_id ON public.folder_permissions (member_id);
CREATE INDEX idx_folder_permissions_access ON public.folder_permissions (access);

-- ============================================
-- HABILITAR RLS
-- ============================================

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS PARA folders
-- ============================================

-- Política: Los usuarios solo pueden ver carpetas donde tienen permiso (READ/EDIT/OWNER)
CREATE POLICY "Users can view folders with permission"
  ON public.folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folders.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
  );

-- Política: Solo pueden crear carpetas si:
-- - Son miembro activo del workspace
-- - Si es raíz: deben ser OWNER del workspace
-- - Si tiene padre: deben ser OWNER del folder padre
CREATE POLICY "Users can create folders with proper permissions"
  ON public.folders FOR INSERT
  WITH CHECK (
    -- Usuario es miembro activo del workspace
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE user_id = auth.uid() 
        AND workspace_id = folders.workspace_id 
        AND status = 'ACTIVE'
    )
    AND created_by_user_id = auth.uid()
    AND (
      -- Si es raíz: debe ser OWNER del workspace
      (parent_id IS NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE user_id = auth.uid() 
          AND workspace_id = folders.workspace_id 
          AND status = 'ACTIVE' 
          AND role = 'OWNER'
      ))
      OR
      -- Si tiene padre: debe ser OWNER del folder padre
      (parent_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.folder_permissions fp
        INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
        WHERE fp.folder_id = folders.parent_id
          AND wm.user_id = auth.uid()
          AND wm.status = 'ACTIVE'
          AND fp.access = 'OWNER'
      ))
    )
  );

-- Política: Solo OWNER puede actualizar carpetas
CREATE POLICY "Owners can update folders"
  ON public.folders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folders.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folders.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
  );

-- Política: Solo OWNER puede eliminar carpetas
CREATE POLICY "Owners can delete folders"
  ON public.folders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folders.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
  );

-- ============================================
-- POLÍTICAS RLS PARA folder_permissions
-- ============================================

-- Política: Los usuarios pueden ver:
-- - Sus propios permisos
-- - O si son OWNER de esa carpeta (para administrar)
CREATE POLICY "Users can view folder permissions"
  ON public.folder_permissions FOR SELECT
  USING (
    -- Ver tus propios permisos
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.id = folder_permissions.member_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
    )
    OR
    -- O si eres OWNER de esa carpeta
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folder_permissions.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
  );

-- Política: Solo OWNER de la carpeta puede insertar permisos
CREATE POLICY "Owners can insert folder permissions"
  ON public.folder_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folder_permissions.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
    AND created_by_user_id = auth.uid()
  );

-- Política: Solo OWNER de la carpeta puede actualizar permisos
CREATE POLICY "Owners can update folder permissions"
  ON public.folder_permissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folder_permissions.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folder_permissions.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
  );

-- Política: Solo OWNER de la carpeta puede eliminar permisos
CREATE POLICY "Owners can delete folder permissions"
  ON public.folder_permissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.folder_permissions fp
      INNER JOIN public.workspace_members wm ON fp.member_id = wm.id
      WHERE fp.folder_id = folder_permissions.folder_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access = 'OWNER'
    )
  );

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE public.folders IS 'Carpetas del workspace. Soporta estructura jerárquica con herencia de permisos materializada.';
COMMENT ON COLUMN public.folders.path IS 'Path jerárquico generado automáticamente. Formato: "id" para raíz, "parent.path.id" para subcarpetas. Usado para búsquedas de descendientes.';
COMMENT ON TABLE public.folder_permissions IS 'Permisos granulares por carpeta y miembro. Soporta OWNER, EDIT, READ.';
COMMENT ON COLUMN public.folder_permissions.access IS 'Nivel de acceso: OWNER (administración completa), EDIT (edición), READ (solo lectura)';

