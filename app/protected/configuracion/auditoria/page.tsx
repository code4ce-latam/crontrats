import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FileSearch } from "lucide-react";
import { getUserActivitiesPaginated } from "@/lib/supabase/activities";
import { AuditActivitiesList } from "@/components/audit-activities-list";

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

  // Si no, usar variable de entorno
  const limit = process.env.NEXT_PUBLIC_ACTIVITIES_LIMIT;
  if (limit) {
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 20; // Default fallback
}

// Obtener los días de retención desde la variable de entorno
function getRetentionDays(): number {
  const days = process.env.NEXT_PUBLIC_ACTIVITIES_RETENTION_DAYS;
  if (days) {
    const parsed = parseInt(days, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 90; // Default
}

async function ActivitiesContent({ page, pageSizeParam, retentionDays }: { page: number; pageSizeParam?: string; retentionDays: number }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    redirect("/auth/login");
  }

  // Obtener información del usuario para mostrar en la tabla
  const userEmail = user.email || "";
  const userName = 
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
    userEmail.split("@")[0] ||
    "Usuario";

  const pageSize = getPageSize(pageSizeParam);
  const paginatedData = await getUserActivitiesPaginated(supabase, page, pageSize, retentionDays);

  return (
    <AuditActivitiesList 
      initialData={paginatedData} 
      retentionDays={retentionDays}
      userName={userName}
      userEmail={userEmail}
    />
  );
}

export default async function AuditoriaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const validPage = page > 0 ? page : 1;
  const retentionDays = getRetentionDays();

  return (
    <div className="flex-1 w-full flex flex-col gap-4">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Registros de Auditoría
        </h1>
        <p className="text-sm text-muted-foreground">
          Visualiza el historial completo de todas tus actividades en la plataforma.
        </p>
      </div>

      {/* Activities List */}
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
        <ActivitiesContent page={validPage} pageSizeParam={params.pageSize} retentionDays={retentionDays} />
      </Suspense>
    </div>
  );
}

