"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { 
  FileText, 
  Edit, 
  Download, 
  Upload, 
  Trash2, 
  Users,
  Folder,
  Calendar,
  Tag,
} from "lucide-react";
import { getStatusLabel, getStatusBadgeVariant, formatContractValue } from "@/lib/contracts-utils";
import { ContractProfileFields } from "./contract-profile-fields";
import { UploadVersionDialog } from "./upload-version-dialog";
import { UploadAttachmentDialog } from "./upload-attachment-dialog";
import { getFolderAccess } from "@/lib/supabase/folders";
import { createClient } from "@/lib/supabase/client";

interface ContractDetailsProps {
  contract: any;
  workspaceId: string;
}

export function ContractDetails({ contract, workspaceId }: ContractDetailsProps) {
  const router = useRouter();
  const [access, setAccess] = useState<string | null>(null);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [isUploadVersionOpen, setIsUploadVersionOpen] = useState(false);
  const [isUploadAttachmentOpen, setIsUploadAttachmentOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadAccess();
  }, [contract.folder_id]);

  const loadAccess = async () => {
    setIsLoadingAccess(true);
    try {
      const supabase = createClient();
      const folderAccess = await getFolderAccess(supabase, contract.folder_id);
      setAccess(folderAccess);
    } catch (error) {
      console.error("[ContractDetails] Error cargando acceso:", error);
    } finally {
      setIsLoadingAccess(false);
    }
  };

  const handleDownloadVersion = async (version: any) => {
    try {
      const response = await fetch(`/api/contracts/file/signed-url?storage_path=${encodeURIComponent(version.storage_path)}`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.download_url, '_blank');
      }
    } catch (error) {
      console.error("[ContractDetails] Error descargando versión:", error);
    }
  };

  const handleDownloadAttachment = async (file: any) => {
    try {
      const response = await fetch(`/api/contracts/file/signed-url?storage_path=${encodeURIComponent(file.storage_path)}`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.download_url, '_blank');
      }
    } catch (error) {
      console.error("[ContractDetails] Error descargando archivo:", error);
    }
  };

  const handleDeleteAttachment = async (fileId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este archivo?")) {
      return;
    }

    try {
      const response = await fetch("/api/contracts/attachment/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file_id: fileId }),
      });

      if (response.ok) {
        setRefreshKey(prev => prev + 1);
        // Recargar la página para actualizar los datos
        router.refresh();
      }
    } catch (error) {
      console.error("[ContractDetails] Error eliminando archivo:", error);
    }
  };


    const canEdit = access === 'EDIT' || access === 'OWNER';
    const canView = access === 'READ' || access === 'EDIT' || access === 'OWNER';
    
    // Bloquear subida de archivos si el contrato no está en estado DRAFT
    const canUploadFiles = canEdit && contract.status === 'DRAFT';

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Preparar field values para ContractProfileFields
  const fieldValues: Record<string, any> = {};
  if (contract.field_values && Array.isArray(contract.field_values)) {
    contract.field_values.forEach((fv: any) => {
      const fieldId = fv.profile_field_id || fv.profile_field?.id;
      if (!fieldId) return;

      if (fv.value_text !== null && fv.value_text !== undefined) {
        fieldValues[fieldId] = fv.value_text;
      } else if (fv.value_number !== null && fv.value_number !== undefined) {
        fieldValues[fieldId] = fv.value_number;
      } else if (fv.value_date !== null && fv.value_date !== undefined) {
        fieldValues[fieldId] = fv.value_date;
      } else if (fv.value_money !== null && fv.value_money !== undefined) {
        fieldValues[fieldId] = fv.value_money;
      } else if (fv.value_bool !== null && fv.value_bool !== undefined) {
        fieldValues[fieldId] = fv.value_bool;
      } else if (fv.value_json !== null && fv.value_json !== undefined) {
        fieldValues[fieldId] = fv.value_json;
      }
    });
  }

  // Preparar profile fields
  const profileFields = contract.field_values?.map((fv: any) => ({
    id: fv.profile_field_id || fv.profile_field?.id,
    key: fv.profile_field?.key || '',
    label: fv.profile_field?.label || '',
    type: fv.profile_field?.type || 'TEXT',
    is_required: fv.profile_field?.is_required || false,
    options: fv.profile_field?.options || null,
    sort_order: 0,
  })).filter((f: any) => f.id) || [];

  return (
    <div className="space-y-6">
      {/* Datos del contrato */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-2xl">{contract.title}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(contract.status)} className="text-xs">
                  {getStatusLabel(contract.status)}
                </Badge>
                {contract.profile && (
                  <Badge variant="outline" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {contract.profile.name}
                  </Badge>
                )}
              </div>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/protected/contratos/${contract.id}/editar`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna izquierda */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Carpeta</p>
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{contract.folder?.name || 'N/A'}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fecha de inicio</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{formatDate(contract.start_date)}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acceso</p>
                <p className="text-sm text-muted-foreground">
                  Heredado de carpeta: <strong className="text-foreground">{contract.folder?.name || 'N/A'}</strong>
                </p>
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Estado</p>
                <Badge variant={getStatusBadgeVariant(contract.status)} className="text-xs">
                  {getStatusLabel(contract.status)}
                </Badge>
              </div>
              {contract.end_date && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fecha de fin</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{formatDate(contract.end_date)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campos del perfil */}
      {contract.profile && profileFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campos del perfil</CardTitle>
            <CardDescription>
              {contract.profile.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileFields.map((field: any) => {
                const value = fieldValues[field.id];
                return (
                  <div key={field.id} className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {field.label}
                    </p>
                    <p className="text-sm font-medium">
                      {formatContractValue(field.type, value) || '-'}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documento principal y Archivos adicionales en dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Documento principal - Columna izquierda */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documento principal</CardTitle>
                <CardDescription>
                  Versiones del documento principal del contrato
                </CardDescription>
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadVersionOpen(true)}
                  disabled={!canUploadFiles}
                  title={!canUploadFiles ? "Solo se pueden subir archivos mientras el contrato esté en borrador" : ""}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir nueva versión
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {contract.file_versions && contract.file_versions.length > 0 ? (
              <div className="space-y-2">
                {contract.file_versions.map((version: any) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Versión {version.version}</span>
                          {version.is_current && (
                            <Badge variant="default" className="text-xs">Actual</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {version.original_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(version.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadVersion(version)}
                        className="h-8 px-2"
                        title="Descargar"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay versiones del documento principal</p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setIsUploadVersionOpen(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Subir primera versión
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Archivos adicionales - Columna derecha */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Archivos adicionales</CardTitle>
                <CardDescription>
                  Documentos y archivos adjuntos al contrato
                </CardDescription>
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadAttachmentOpen(true)}
                  disabled={!canUploadFiles}
                  title={!canUploadFiles ? "Solo se pueden subir archivos mientras el contrato esté en borrador" : ""}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir archivo
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {contract.additional_files && contract.additional_files.length > 0 ? (
              <div className="space-y-2">
                {contract.additional_files.map((file: any) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.original_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(file.uploaded_at)}
                          {file.size && ` • ${(file.size / 1024).toFixed(2)} KB`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadAttachment(file)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttachment(file.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay archivos adicionales</p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setIsUploadAttachmentOpen(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Subir primer archivo
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <UploadVersionDialog
        open={isUploadVersionOpen}
        onOpenChange={setIsUploadVersionOpen}
        contractId={contract.id}
        onSuccess={() => {
          setIsUploadVersionOpen(false);
          router.refresh();
        }}
      />

      <UploadAttachmentDialog
        open={isUploadAttachmentOpen}
        onOpenChange={setIsUploadAttachmentOpen}
        contractId={contract.id}
        onSuccess={() => {
          setIsUploadAttachmentOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

