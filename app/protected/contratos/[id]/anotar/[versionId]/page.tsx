import { createClient } from "@/lib/supabase/server";
import { getContractAccess } from "@/lib/supabase/contracts";
import { redirect } from "next/navigation";
import { WordAnnotatorViewer } from "@/components/document-annotator/word/word-annotator-viewer";
import { PdfAnnotatorViewer } from "@/components/document-annotator/pdf/pdf-annotator-viewer";
import { loadAnnotations } from "@/lib/document-annotator/annotations";
import { BreadcrumbsWrapper } from "@/components/breadcrumbs-wrapper";

type PageProps = {
  params: Promise<{
    id: string;
    versionId: string;
  }>;
};

export default async function AnotarContratoPage({ params }: PageProps) {
  const { id: contractId, versionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Verificar acceso al contrato
  const access = await getContractAccess(supabase, contractId);
  if (!access) {
    redirect(`/protected/contratos/${contractId}/editar`);
  }

  // Obtener información del contrato para el breadcrumb
  const { data: contract } = await supabase
    .from("contracts")
    .select("title")
    .eq("id", contractId)
    .single();
  const contractTitle = contract?.title;

  // Obtener información de la versión del archivo
  const { data: fileVersion, error: versionError } = await supabase
    .from("contract_file_versions")
    .select("id, contract_id, storage_path, original_name, mime_type")
    .eq("id", versionId)
    .eq("contract_id", contractId)
    .maybeSingle();

  if (versionError || !fileVersion) {
    redirect(`/protected/contratos/${contractId}/editar`);
  }

  // Cargar anotaciones existentes
  const { comments, highlights } = await loadAnnotations(fileVersion.id);

  // Detectar tipo de archivo según extensión
  const fileName = fileVersion.original_name || "";
  const isWord = fileName.toLowerCase().endsWith(".docx");
  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  if (!isWord && !isPdf) {
    redirect(`/protected/contratos/${contractId}/editar`);
  }

  return (
    <BreadcrumbsWrapper title={contractTitle}>
      <div className="absolute inset-0 overflow-hidden -mx-4 md:-mx-5 -mb-4 md:-mb-5">
        {isWord ? (
          <WordAnnotatorViewer
            fileVersionId={fileVersion.id}
            contractId={contractId}
            storagePath={fileVersion.storage_path}
            fileName={fileName}
            initialComments={comments}
            initialHighlights={highlights}
          />
        ) : (
          <PdfAnnotatorViewer
            fileVersionId={fileVersion.id}
            contractId={contractId}
            storagePath={fileVersion.storage_path}
            fileName={fileName}
            initialComments={comments}
            initialHighlights={highlights}
          />
        )}
      </div>
    </BreadcrumbsWrapper>
  );
}

