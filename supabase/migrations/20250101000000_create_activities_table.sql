-- Tabla de actividades del usuario
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  type text NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', etc.
  entity_type text, -- 'contract', 'folder', 'user', 'workspace', etc.
  entity_id uuid, -- ID del recurso afectado
  description text NOT NULL, -- Descripción legible de la actividad
  metadata jsonb, -- Datos adicionales en formato JSON
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver sus propias actividades
CREATE POLICY "Users can view own activities"
  ON public.activities FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios pueden insertar sus propias actividades
CREATE POLICY "Users can insert own activities"
  ON public.activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar sus propias actividades (opcional, para marcar como leídas)
CREATE POLICY "Users can update own activities"
  ON public.activities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_activities_user_id ON public.activities (user_id);
CREATE INDEX idx_activities_created_at ON public.activities (created_at DESC);
CREATE INDEX idx_activities_workspace_id ON public.activities (workspace_id);
CREATE INDEX idx_activities_type ON public.activities (type);
CREATE INDEX idx_activities_entity ON public.activities (entity_type, entity_id);

