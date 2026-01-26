import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUserWorkspaceId } from "@/lib/supabase/users";
import { WorkspaceSettingsContent } from "@/components/workspace-settings-content";

async function WorkspaceSettingsPageContent() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    redirect("/auth/login");
  }

  // Verificar que el usuario es OWNER
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!membership || membership.role !== 'OWNER') {
    redirect("/protected");
  }

  const workspaceId = membership.workspace_id;
  if (!workspaceId) {
    redirect("/auth/login");
  }

  // Obtener información del workspace
  // Intentar obtener con timezone, si falla intentar sin timezone (migración no aplicada)
  let workspace: { id: string; name: string; timezone?: string | null } | null = null;

  // Primero intentar con timezone
  const { data: workspaceWithTimezone, error: errorWithTimezone } = await supabase
    .from('workspaces')
    .select('id, name, timezone')
    .eq('id', workspaceId)
    .single();

  if (errorWithTimezone) {
    // Si falla, puede ser que la columna timezone no exista, intentar sin ella
    const { data: workspaceWithoutTimezone, error: errorWithoutTimezone } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .single();

    if (errorWithoutTimezone || !workspaceWithoutTimezone) {
      console.error("[ConfiguracionCuenta] Error obteniendo workspace:", errorWithoutTimezone || errorWithTimezone);
      redirect("/protected");
    }

    workspace = { ...workspaceWithoutTimezone, timezone: null };
  } else {
    workspace = workspaceWithTimezone;
  }

  if (!workspace) {
    console.error("[ConfiguracionCuenta] Workspace no encontrado");
    redirect("/protected");
  }

  return (
    <WorkspaceSettingsContent
      initialWorkspaceName={workspace.name || ""}
      initialTimezone={workspace.timezone || null}
      workspaceId={workspaceId}
    />
  );
}

export default async function ConfiguracionCuentaPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Configuración de la cuenta</h1>
        <p className="text-muted-foreground">
          Gestiona la configuración de tu workspace
        </p>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 bg-muted rounded mx-auto"></div>
              <div className="h-32 w-full bg-muted rounded"></div>
            </div>
          </div>
        }
      >
        <WorkspaceSettingsPageContent />
      </Suspense>
    </div>
  );
}

