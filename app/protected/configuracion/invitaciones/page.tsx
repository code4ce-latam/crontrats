import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getWorkspaceInvitationsPaginated } from "@/lib/supabase/invitations";
import { InvitationsList } from "@/components/invitations-list";

interface PageProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}

// Obtener el tamaño de página desde la variable de entorno o searchParams
function getPageSize(searchParamSize?: string): number {
  // Si viene en la URL, tiene prioridad
  if (searchParamSize) {
    const parsed = parseInt(searchParamSize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Si no, usar variable de entorno (reutilizar ACTIVITIES_LIMIT o usar default)
  const limit = process.env.NEXT_PUBLIC_ACTIVITIES_LIMIT;
  if (limit) {
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 20; // Default fallback
}

async function InvitationsContent({ page, pageSizeParam }: { page: number; pageSizeParam?: string }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    redirect("/auth/login");
  }

  const pageSize = getPageSize(pageSizeParam);
  
  // Obtener workspace_id una sola vez y reutilizarlo
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();

  if (!membership?.workspace_id) {
    redirect("/auth/login");
  }

  // Obtener invitaciones pasando el workspace_id para evitar consulta duplicada
  const paginatedData = await getWorkspaceInvitationsPaginated(supabase, page, pageSize, membership.workspace_id);

  // Obtener nombres de los usuarios que invitaron (optimizado: llamadas en paralelo)
  const userIds = [...new Set(paginatedData.invitations.map(inv => inv.invited_by_user_id))];
  const invitedByNames: Record<string, string> = {};

  if (userIds.length > 0) {
    // Obtener todos los nombres en paralelo usando Promise.all
    const namePromises = userIds.map(async (userId) => {
      // Si es el usuario actual, usar su información directamente
      if (userId === user.id) {
        const userName = 
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
          user.email?.split("@")[0] ||
          "Usuario";
        return { userId, userName };
      }

      // Intentar obtener información del usuario usando la función SQL
      try {
        const { data: userName, error: rpcError } = await supabase.rpc('get_user_display_name', {
          user_uuid: userId
        });

        if (!rpcError && userName) {
          return { userId, userName };
        } else {
          // Si la función RPC falla, usar placeholder
          return { userId, userName: userId.substring(0, 8) + '...' };
        }
      } catch (rpcError) {
        // Si la función RPC no existe o hay error, usar placeholder
        console.warn(`[Invitations] Error obteniendo nombre para usuario ${userId}:`, rpcError);
        return { userId, userName: userId.substring(0, 8) + '...' };
      }
    });

    // Ejecutar todas las llamadas en paralelo
    const results = await Promise.all(namePromises);
    results.forEach(({ userId, userName }) => {
      invitedByNames[userId] = userName;
    });
  }

  return (
    <InvitationsList 
      initialData={paginatedData}
      invitedByNames={invitedByNames}
    />
  );
}

export default async function InvitacionesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const validPage = page > 0 ? page : 1;

  return (
    <div className="flex-1 w-full flex flex-col gap-4">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Invitaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona las invitaciones de usuarios a tu workspace.
        </p>
      </div>

      {/* Invitations List */}
      <Suspense
        fallback={
          <div className="bg-card border border-border rounded-lg shadow-sm p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        }
      >
        <InvitationsContent page={validPage} pageSizeParam={params.pageSize} />
      </Suspense>
    </div>
  );
}

