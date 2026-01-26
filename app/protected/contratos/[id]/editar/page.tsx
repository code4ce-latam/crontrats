import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditContractForm } from "@/components/contracts/edit-contract-form";
import { BreadcrumbsWrapper } from "@/components/breadcrumbs-wrapper";
import { getContractWithDetails, getUserWorkspaceId } from "@/lib/supabase/contracts";

async function EditContractPageContent({ contractId, contract }: { contractId: string; contract: any }) {
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
  
  // Obtener contrato completo una sola vez (se reutiliza en EditContractPageContent)
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

  const contract = await getContractWithDetails(supabase, id);

  if (!contract) {
    redirect("/protected/contratos");
  }

  const contractTitle = contract?.title;

  return (
    <BreadcrumbsWrapper title={contractTitle}>
      <div className="flex-1 w-full flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Editar contrato</h1>
          <p className="text-muted-foreground">
            Actualiza la información del contrato
          </p>
        </div>
        <EditContractPageContent contractId={id} contract={contract} />
      </div>
    </BreadcrumbsWrapper>
  );
}

