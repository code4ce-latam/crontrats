import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUserWorkspaceId, getWorkspaceFoldersTree } from "@/lib/supabase/folders";
import { FoldersView } from "@/components/folders/folders-view";

async function FoldersContent() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    redirect("/auth/login");
  }

  const workspaceId = await getUserWorkspaceId(supabase);
  if (!workspaceId) {
    redirect("/auth/login");
  }

  // Obtener árbol inicial de carpetas
  const initialTree = await getWorkspaceFoldersTree(supabase, workspaceId);

  return (
    <FoldersView 
      initialTree={initialTree}
      workspaceId={workspaceId}
    />
  );
}

export default async function CarpetasPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-4">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Carpetas
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestiona las carpetas de tu workspace y sus permisos.
        </p>
      </div>

      {/* Folders View */}
      <Suspense
        fallback={
          <div className="bg-card border border-border rounded-lg shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <div className="h-64 bg-muted rounded-lg animate-pulse" />
              </div>
              <div className="md:col-span-2">
                <div className="h-64 bg-muted rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        }
      >
        <FoldersContent />
      </Suspense>
    </div>
  );
}

