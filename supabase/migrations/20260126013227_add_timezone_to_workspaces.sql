-- Agregar columna timezone a la tabla workspaces
-- Formato: IANA timezone (ej: "America/Mexico_City", "Europe/Madrid", "UTC")

ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Comentario para documentar la columna
COMMENT ON COLUMN public.workspaces.timezone IS 'Zona horaria del workspace en formato IANA (ej: America/Mexico_City). Se usa para notificaciones y fechas. Por defecto: UTC';

