-- ============================================
-- SPRINT 2.1: Anotaciones sobre PDF
-- ============================================
-- Crear ENUM para estado de anotaciones
-- ============================================

CREATE TYPE annotation_status AS ENUM ('DRAFT', 'PUBLISHED');

-- ============================================
-- TABLA: contract_file_annotations
-- Anotaciones sobre versiones de documentos PDF
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_file_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_version_id uuid NOT NULL REFERENCES public.contract_file_versions(id) ON DELETE CASCADE,
  status annotation_status NOT NULL DEFAULT 'DRAFT',
  annotations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_contract_file_annotations_file_version_id ON public.contract_file_annotations (file_version_id);
CREATE INDEX idx_contract_file_annotations_contract_id ON public.contract_file_annotations (contract_id);
CREATE INDEX idx_contract_file_annotations_status ON public.contract_file_annotations (file_version_id, status);
CREATE INDEX idx_contract_file_annotations_created_by ON public.contract_file_annotations (file_version_id, created_by_user_id, status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_contract_file_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contract_file_annotations_updated_at
  BEFORE UPDATE ON public.contract_file_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_file_annotations_updated_at();

-- Comentarios
COMMENT ON TABLE public.contract_file_annotations IS 'Anotaciones (correcciones) sobre versiones de documentos PDF. Permite DRAFT (borrador) y PUBLISHED (publicado).';
COMMENT ON COLUMN public.contract_file_annotations.annotations_json IS 'Array JSON con las anotaciones. Formato: [{id, page, type, rect, text, color, opacity, createdAt, createdByUserId}]';
COMMENT ON COLUMN public.contract_file_annotations.status IS 'Estado: DRAFT (borrador del usuario) o PUBLISHED (correcciones publicadas)';

