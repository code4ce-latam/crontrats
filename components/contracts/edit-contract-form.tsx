"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { ContractProfileFields } from "./contract-profile-fields";
import { UploadVersionDialog } from "./upload-version-dialog";
import { UploadAttachmentDialog } from "./upload-attachment-dialog";
import { createClient } from "@/lib/supabase/client";
import { getFolderAccess } from "@/lib/supabase/folders";
import { FileText, Download, Upload, Trash2, MessageSquare } from "lucide-react";

interface EditContractFormProps {
  contractId: string;
  workspaceId: string;
  initialContract: any;
}

interface ContractProfile {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface ProfileField {
  id: string;
  key: string;
  label: string;
  type: string;
  is_required: boolean;
  options?: { options: string[] } | null;
  sort_order: number;
}

export function EditContractForm({ contractId, workspaceId, initialContract }: EditContractFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialContract.title || "");
  const [folderId, setFolderId] = useState<string | null>(initialContract.folder_id || null);
  const [profileId, setProfileId] = useState<string | null>(initialContract.profile_id || null);
  const [startDate, setStartDate] = useState(initialContract.start_date || "");
  const [endDate, setEndDate] = useState(initialContract.end_date || "");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELED" | "ARCHIVED">(initialContract.status || "DRAFT");
  const [profiles, setProfiles] = useState<ContractProfile[]>([]);
  const [profileFields, setProfileFields] = useState<ProfileField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [availableFolders, setAvailableFolders] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileVersions, setFileVersions] = useState<any[]>(initialContract.file_versions || []);
  const [additionalFiles, setAdditionalFiles] = useState<any[]>(initialContract.additional_files || []);
  const [isUploadVersionOpen, setIsUploadVersionOpen] = useState(false);
  const [isUploadAttachmentOpen, setIsUploadAttachmentOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [basicInfoUpdated, setBasicInfoUpdated] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [access, setAccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadFieldValues();
    loadAccess();
  }, []);

  useEffect(() => {
    if (folderId) {
      loadAccess();
    }
  }, [folderId]);

  const loadAccess = async () => {
    try {
      const supabase = createClient();
      if (folderId) {
        const folderAccess = await getFolderAccess(supabase, folderId);
        setAccess(folderAccess);
      }
    } catch (error) {
      console.error("[EditContractForm] Error cargando acceso:", error);
    }
  };

  useEffect(() => {
    if (refreshKey > 0) {
      loadContractFiles();
    }
  }, [refreshKey]);

  // Resetear estado cuando cambia el contractId
  useEffect(() => {
    setBasicInfoUpdated(false);
    setSuccessMessage("");
    setErrors({});
  }, [contractId]);

  useEffect(() => {
    if (profileId) {
      loadProfileFields(profileId);
    } else {
      setProfileFields([]);
      setFieldValues({});
    }
  }, [profileId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Paralelizar carga de perfiles y carpetas
      const [profilesResult, foldersResult] = await Promise.all([
        supabase
          .from('contract_profiles')
          .select('id, name, description, is_active')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('folders')
          .select('id, name, path')
          .eq('workspace_id', workspaceId)
          .order('name'),
      ]);
      
      setProfiles(profilesResult.data || []);

      // Paralelizar verificaciones de acceso de carpetas
      const foldersData = foldersResult.data || [];
      if (foldersData.length > 0) {
        const accessPromises = foldersData.map(folder => 
          getFolderAccess(supabase, folder.id).then(access => ({ folder, access }))
        );
        
        const accessResults = await Promise.all(accessPromises);
        const accessibleFolders = accessResults
          .filter(({ access }) => access === 'EDIT' || access === 'OWNER')
          .map(({ folder }) => folder);
        
        setAvailableFolders(accessibleFolders);
      } else {
        setAvailableFolders([]);
      }
    } catch (error) {
      console.error("[EditContractForm] Error cargando datos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFieldValues = async () => {
    if (!initialContract.field_values || !Array.isArray(initialContract.field_values)) {
      return;
    }

    const values: Record<string, any> = {};
    for (const fv of initialContract.field_values) {
      const fieldId = fv.profile_field_id || fv.profile_field?.id;
      if (!fieldId) continue;

      // Extraer valor según el tipo
      if (fv.value_text !== null && fv.value_text !== undefined) {
        values[fieldId] = fv.value_text;
      } else if (fv.value_number !== null && fv.value_number !== undefined) {
        values[fieldId] = fv.value_number;
      } else if (fv.value_date !== null && fv.value_date !== undefined) {
        values[fieldId] = fv.value_date;
      } else if (fv.value_money !== null && fv.value_money !== undefined) {
        values[fieldId] = fv.value_money;
      } else if (fv.value_bool !== null && fv.value_bool !== undefined) {
        values[fieldId] = fv.value_bool;
      } else if (fv.value_json !== null && fv.value_json !== undefined) {
        values[fieldId] = fv.value_json;
      }
    }
    setFieldValues(values);
  };

  const loadProfileFields = async (profileId: string) => {
    try {
      const supabase = createClient();
      const { data: fields } = await supabase
        .from('contract_profile_fields')
        .select('*')
        .eq('profile_id', profileId)
        .order('sort_order');

      setProfileFields(fields || []);
      
      // Si ya hay valores cargados, mantenerlos
      // Si no, inicializar vacíos
      if (Object.keys(fieldValues).length === 0) {
        setFieldValues({});
      }
    } catch (error) {
      console.error("[EditContractForm] Error cargando campos del perfil:", error);
    }
  };

  const loadContractFiles = async () => {
    try {
      const response = await fetch(`/api/contracts/get?contract_id=${contractId}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.contract) {
          setFileVersions(data.contract.file_versions || []);
          setAdditionalFiles(data.contract.additional_files || []);
        }
      }
    } catch (error) {
      console.error("[EditContractForm] Error cargando archivos:", error);
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
      console.error("[EditContractForm] Error descargando versión:", error);
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
      console.error("[EditContractForm] Error descargando archivo:", error);
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
      }
    } catch (error) {
      console.error("[EditContractForm] Error eliminando archivo:", error);
    }
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

  const handleFieldChange = (fieldId: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value,
    }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "El título es requerido";
    }

    if (!folderId) {
      newErrors.folderId = "Debes seleccionar una carpeta";
    }

    if (!startDate) {
      newErrors.startDate = "La fecha de inicio es requerida";
    }

    if (profileId && profileFields.length > 0) {
      profileFields.forEach(field => {
        if (field.is_required) {
          const value = fieldValues[field.id];
          if (value === null || value === undefined || value === '' || 
              (Array.isArray(value) && value.length === 0)) {
            newErrors[field.id] = `El campo "${field.label}" es requerido`;
          }
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFinishEditing = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      // Cambiar el estado del contrato a ACTIVE
      const response = await fetch("/api/contracts/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contract_id: contractId,
          status: "ACTIVE",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al finalizar la edición");
      }

      // Redirigir a la página de detalles
      router.push(`/protected/contratos/${contractId}`);
    } catch (error: any) {
      console.error("[EditContractForm] Error finalizando edición:", error);
      setErrors({ submit: error.message || "Error al finalizar la edición" });
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage("");
    
    try {
      // Solo incluir field_values si hay un perfil y campos
      const fieldValuesArray = profileId && profileFields.length > 0
        ? profileFields.map(field => ({
            profile_field_id: field.id,
            value: fieldValues[field.id] ?? null,
          }))
        : [];

      console.log("[EditContractForm] Enviando field_values:", {
        profileId,
        profileFieldsCount: profileFields.length,
        fieldValuesArray,
        fieldValues
      });

      const response = await fetch("/api/contracts/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contract_id: contractId,
          title: title.trim(),
          folder_id: folderId,
          profile_id: profileId || null,
          start_date: startDate,
          end_date: endDate || null,
          status,
          field_values: fieldValuesArray,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al actualizar el contrato");
      }

      // Paso 1 completado: información básica actualizada
      setBasicInfoUpdated(true);
      setSuccessMessage("Información básica actualizada correctamente. Ahora puedes gestionar documentos y archivos adicionales.");
      
      // Cargar archivos para el paso 2
      loadContractFiles();
      
      // Scroll suave hacia las secciones de documentos
      setTimeout(() => {
        const documentsSection = document.querySelector('[data-documents-section]');
        if (documentsSection) {
          documentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error: any) {
      console.error("[EditContractForm] Error:", error);
      setErrors({ submit: error.message || "Error al actualizar el contrato" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información básica</CardTitle>
          <CardDescription>
            Actualiza la información básica del contrato
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Fila 1: Título y Carpeta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) {
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.title;
                      return newErrors;
                    });
                  }
                }}
              className={errors.title ? "border-destructive" : ""}
              disabled={isSubmitting || basicInfoUpdated}
              />
              {errors.title && (
                <p className="text-sm text-destructive mt-1">{errors.title}</p>
              )}
            </div>

            <div>
              <Label htmlFor="folderId">
                Carpeta <span className="text-destructive">*</span>
              </Label>
              <select
                id="folderId"
                value={folderId || ""}
                onChange={(e) => {
                  setFolderId(e.target.value || null);
                  if (errors.folderId) {
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.folderId;
                      return newErrors;
                    });
                  }
                }}
                className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${errors.folderId ? "border-destructive" : ""}`}
                disabled={isSubmitting || basicInfoUpdated}
              >
                <option value="">Selecciona una carpeta</option>
                {availableFolders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              {errors.folderId && (
                <p className="text-sm text-destructive mt-1">{errors.folderId}</p>
              )}
            </div>
          </div>

          {/* Fila 2: Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">
                Fecha de inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (errors.startDate) {
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.startDate;
                      return newErrors;
                    });
                  }
                }}
                className={errors.startDate ? "border-destructive" : ""}
                disabled={isSubmitting || basicInfoUpdated}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive mt-1">{errors.startDate}</p>
              )}
            </div>

            <div>
              <Label htmlFor="endDate">Fecha de fin (opcional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSubmitting || basicInfoUpdated}
              />
            </div>
          </div>

          {/* Fila 3: Perfil y Estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="profileId">Perfil (opcional)</Label>
              <select
                id="profileId"
                value={profileId || ""}
                onChange={(e) => setProfileId(e.target.value || null)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting || basicInfoUpdated}
              >
                <option value="">Sin perfil</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting || basicInfoUpdated}
              >
                <option value="DRAFT">Borrador</option>
                <option value="ACTIVE">Activo</option>
                <option value="EXPIRED">Expirado</option>
                <option value="CANCELED">Cancelado</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {profileId && profileFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campos del perfil</CardTitle>
            <CardDescription>
              Actualiza los campos definidos en el perfil seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ContractProfileFields
              fields={profileFields}
              values={fieldValues}
              onChange={handleFieldChange}
              errors={errors}
              readOnly={basicInfoUpdated}
            />
          </CardContent>
        </Card>
      )}

      {errors.submit && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {errors.submit}
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting || basicInfoUpdated}>
          {isSubmitting ? "Actualizando..." : basicInfoUpdated ? "✓ Información actualizada" : "Actualizar contrato"}
        </Button>
      </div>

      {/* Documento principal y Archivos adicionales en dos columnas - PASO 2 */}
      {basicInfoUpdated && (
        <>
          <div className="border-t border-border pt-6 mt-6" data-documents-section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-foreground">Paso 2: Gestión de documentos</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Administra las versiones del documento principal y los archivos adicionales del contrato.
              </p>
            </div>
          </div>
          
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUploadVersionOpen(true)}
                  disabled={isSubmitting}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir nueva versión
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {fileVersions.length > 0 ? (
              <div className="space-y-2">
                {fileVersions.map((version: any) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md"
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
                      {(access === "EDIT" || access === "OWNER") && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/protected/contratos/${contractId}/anotar/${version.id}`)}
                          className="h-8 px-2"
                          title="Anotar"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsUploadVersionOpen(true)}
                  disabled={isSubmitting}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir primera versión
                </Button>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUploadAttachmentOpen(true)}
                disabled={isSubmitting}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir archivo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {additionalFiles.length > 0 ? (
              <div className="space-y-2">
                {additionalFiles.map((file: any) => (
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
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadAttachment(file)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(file.id)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay archivos adicionales</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setIsUploadAttachmentOpen(true)}
                  disabled={isSubmitting}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir primer archivo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button
          type="button"
          variant="default"
          onClick={handleFinishEditing}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Finalizando..." : "Finalizar edición"}
        </Button>
      </div>
        </>
      )}

      <UploadVersionDialog
        open={isUploadVersionOpen}
        onOpenChange={setIsUploadVersionOpen}
        contractId={contractId}
        onSuccess={() => {
          setIsUploadVersionOpen(false);
          setRefreshKey(prev => prev + 1);
        }}
      />

      <UploadAttachmentDialog
        open={isUploadAttachmentOpen}
        onOpenChange={setIsUploadAttachmentOpen}
        contractId={contractId}
        onSuccess={() => {
          setIsUploadAttachmentOpen(false);
          setRefreshKey(prev => prev + 1);
        }}
      />
    </form>
  );
}

