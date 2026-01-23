import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getWorkspaceUsersPaginated } from "@/lib/supabase/users";
import { UsersList } from "@/components/users-list";

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

async function UsersContent({ page, pageSizeParam }: { page: number; pageSizeParam?: string }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    redirect("/auth/login");
  }

  const pageSize = getPageSize(pageSizeParam);
  const paginatedData = await getWorkspaceUsersPaginated(supabase, page, pageSize);

  return (
    <UsersList 
      initialData={paginatedData}
    />
  );
}

export default async function UsuariosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const validPage = page > 0 ? page : 1;

  return (
    <div className="flex-1 w-full flex flex-col gap-4">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Usuarios
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona los usuarios de tu workspace.
        </p>
      </div>

      {/* Users List */}
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
        <UsersContent page={validPage} pageSizeParam={params.pageSize} />
      </Suspense>
    </div>
  );
}

