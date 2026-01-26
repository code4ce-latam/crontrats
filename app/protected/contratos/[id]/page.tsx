import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContractDetails } from "@/components/contracts/contract-details";
import { BreadcrumbsWrapper } from "@/components/breadcrumbs-wrapper";
import { getContractWithDetails, getUserWorkspaceId } from "@/lib/supabase/contracts";

async function ContractDetailPageContent({ contractId }: { contractId: string }) {
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

  // Verificar acceso READ/EDIT/OWNER
  if (!contract.access) {
    redirect("/protected/contratos");
  }

  return <ContractDetails contract={contract} workspaceId={workspaceId} />;
}

export default async function ContratoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  // Obtener el título del contrato para el breadcrumb (solo título básico)
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from('contracts')
    .select('title')
    .eq('id', id)
    .single();
  const contractTitle = contract?.title;

  return (
    <BreadcrumbsWrapper title={contractTitle}>
      <div className="flex-1 w-full flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Detalle del contrato</h1>
          <p className="text-muted-foreground">
            Información completa del contrato
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
          <ContractDetailPageContent contractId={id} />
        </Suspense>
      </div>
    </BreadcrumbsWrapper>
  );
}

