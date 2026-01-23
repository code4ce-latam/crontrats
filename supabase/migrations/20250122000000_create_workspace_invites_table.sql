-- Tipos ENUM para roles y estados de invitaciones
CREATE TYPE public.invite_role AS ENUM ('EDITOR', 'READER');
CREATE TYPE public.invite_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- Tabla de invitaciones a workspaces
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  role public.invite_role NOT NULL DEFAULT 'READER',
  status public.invite_status NOT NULL DEFAULT 'PENDING',
  token text NOT NULL UNIQUE,
  invited_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Habilitar RLS
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo pueden ver invitaciones de sus workspaces
CREATE POLICY "Users can view workspace invitations"
  ON public.workspace_invites FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() AND status = 'ACTIVE'
    )
  );

-- Política: Solo OWNER o EDITOR pueden crear invitaciones
CREATE POLICY "Owners and editors can create invitations"
  ON public.workspace_invites FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role IN ('OWNER', 'EDITOR')
    )
    AND invited_by_user_id = auth.uid()
  );

-- Política: Solo OWNER puede actualizar/revocar invitaciones
CREATE POLICY "Owners can update invitations"
  ON public.workspace_invites FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role = 'OWNER'
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role = 'OWNER'
    )
  );

-- Política: Solo OWNER puede eliminar invitaciones
CREATE POLICY "Owners can delete invitations"
  ON public.workspace_invites FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM public.workspace_members 
      WHERE user_id = auth.uid() 
        AND status = 'ACTIVE' 
        AND role = 'OWNER'
    )
  );

-- Índices para mejorar el rendimiento
CREATE INDEX idx_workspace_invites_workspace_id ON public.workspace_invites (workspace_id);
CREATE INDEX idx_workspace_invites_email ON public.workspace_invites (email);
CREATE INDEX idx_workspace_invites_token ON public.workspace_invites (token);
CREATE INDEX idx_workspace_invites_status ON public.workspace_invites (status);
CREATE INDEX idx_workspace_invites_invited_at ON public.workspace_invites (invited_at DESC);
CREATE INDEX idx_workspace_invites_expires_at ON public.workspace_invites (expires_at);

-- Índice único parcial para evitar duplicar invitaciones pendientes del mismo email en el mismo workspace
CREATE UNIQUE INDEX idx_workspace_invites_workspace_email_pending 
  ON public.workspace_invites (workspace_id, email) 
  WHERE status = 'PENDING';

