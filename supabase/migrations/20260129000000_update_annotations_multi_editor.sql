-- ============================================
-- Actualización: Anotaciones Multi-Editor
-- Eliminar concepto de Draft/Publish
-- ============================================

-- Eliminar índices que dependen de status
DROP INDEX IF EXISTS public.idx_contract_file_annotations_status;
DROP INDEX IF EXISTS public.idx_contract_file_annotations_created_by;

-- Agregar constraint UNIQUE para garantizar 1 set de anotaciones por editor por versión
ALTER TABLE public.contract_file_annotations
  ADD CONSTRAINT unique_file_version_user 
  UNIQUE (file_version_id, created_by_user_id);

-- Crear nuevo índice para performance (sin status)
CREATE INDEX idx_contract_file_annotations_file_version_user 
  ON public.contract_file_annotations (file_version_id, created_by_user_id);

-- Índice para obtener todas las anotaciones de una versión
CREATE INDEX idx_contract_file_annotations_file_version 
  ON public.contract_file_annotations (file_version_id, updated_at DESC);

-- Comentario actualizado
COMMENT ON TABLE public.contract_file_annotations IS 'Anotaciones sobre versiones de documentos PDF. Cada editor puede tener un set de anotaciones por versión.';
COMMENT ON COLUMN public.contract_file_annotations.annotations_json IS 'Array JSON con las anotaciones. Formato: [{id, page, type, rect, text, color, opacity, createdAt, createdByUserId}]';
-- NOTA: La columna status se mantiene por compatibilidad pero NO se usa en la lógica

