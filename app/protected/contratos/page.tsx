import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AllContractsList } from "@/components/contracts/all-contracts-list";
import { getUserWorkspaceId } from "@/lib/supabase/folders";

async function ContractsPageContent() {
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

  return <AllContractsList workspaceId={workspaceId} />;
}

export default function ContratosPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Contratos</h1>
        <p className="text-muted-foreground">
          Listado completo de todos tus contratos accesibles
        </p>
      </div>
      <Suspense
        fallback={
          <div className="text-center py-8 text-muted-foreground">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-64 bg-muted rounded mx-auto"></div>
              <div className="h-96 w-full bg-muted rounded"></div>
            </div>
          </div>
        }
      >
        <ContractsPageContent />
      </Suspense>
    </div>
  );
}

