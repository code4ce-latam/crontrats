import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EditContractForm } from "@/components/contracts/edit-contract-form";
import { getContractWithDetails, getUserWorkspaceId } from "@/lib/supabase/contracts";

async function EditContractPageContent({ contractId }: { contractId: string }) {
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

  // Obtener contrato completo
  const contract = await getContractWithDetails(supabase, contractId);

  if (!contract) {
    redirect("/protected/contratos");
  }

  // Verificar acceso EDIT/OWNER
  if (!contract.access || (contract.access !== 'EDIT' && contract.access !== 'OWNER')) {
    redirect("/protected/contratos");
  }

  return <EditContractForm key={contractId} contractId={contractId} workspaceId={workspaceId} initialContract={contract} />;
}

export default async function EditarContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Editar contrato</h1>
        <p className="text-muted-foreground">
          Actualiza la información del contrato
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
        <EditContractPageContent contractId={id} />
      </Suspense>
    </div>
  );
}

