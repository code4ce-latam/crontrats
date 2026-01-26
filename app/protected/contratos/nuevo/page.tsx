import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CreateContractForm } from "@/components/contracts/create-contract-form";
import { getUserWorkspaceId } from "@/lib/supabase/folders";

async function CreateContractPageContent({ searchParams }: { searchParams: { folder_id?: string } }) {
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

  const folderId = searchParams.folder_id || null;

  return <CreateContractForm workspaceId={workspaceId} initialFolderId={folderId} />;
}

export default async function NuevoContratoPage({
  searchParams,
}: {
  searchParams: { folder_id?: string };
}) {
  return (
    <div className="flex-1 w-full flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Nuevo contrato</h1>
        <p className="text-muted-foreground">
          Crea un nuevo contrato en tu workspace
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
        <CreateContractPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

