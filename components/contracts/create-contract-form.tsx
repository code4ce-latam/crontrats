"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { ContractProfileFields } from "./contract-profile-fields";
import { createClient } from "@/lib/supabase/client";
import { getFolderAccess } from "@/lib/supabase/folders";

interface CreateContractFormProps {
  workspaceId: string;
  initialFolderId?: string | null;
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

export function CreateContractForm({ workspaceId, initialFolderId }: CreateContractFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(initialFolderId || null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [profiles, setProfiles] = useState<ContractProfile[]>([]);
  const [profileFields, setProfileFields] = useState<ProfileField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [availableFolders, setAvailableFolders] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

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
      
      // Cargar perfiles activos
      const { data: profilesData } = await supabase
        .from('contract_profiles')
        .select('id, name, description, is_active')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('name');
      
      setProfiles(profilesData || []);

      // Cargar carpetas accesibles (simplificado - solo las que tienen permisos EDIT/OWNER)
      const { data: foldersData } = await supabase
        .from('folders')
        .select('id, name, path')
        .eq('workspace_id', workspaceId)
        .order('name');
      
      // Filtrar carpetas donde el usuario tiene EDIT/OWNER
      const accessibleFolders = [];
      if (foldersData) {
        for (const folder of foldersData) {
          const access = await getFolderAccess(supabase, folder.id);
          if (access === 'EDIT' || access === 'OWNER') {
            accessibleFolders.push(folder);
          }
        }
      }
      setAvailableFolders(accessibleFolders);

      // Si hay initialFolderId, verificar que es accesible
      if (initialFolderId) {
        const access = await getFolderAccess(supabase, initialFolderId);
        if (access === 'EDIT' || access === 'OWNER') {
          setFolderId(initialFolderId);
        }
      }
    } catch (error) {
      console.error("[CreateContractForm] Error cargando datos:", error);
    } finally {
      setIsLoading(false);
    }
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
      setFieldValues({});
    } catch (error) {
      console.error("[CreateContractForm] Error cargando campos del perfil:", error);
    }
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value,
    }));
    // Limpiar error del campo
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

    // Validar campos requeridos del perfil
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const fieldValuesArray = profileFields.map(field => ({
        profile_field_id: field.id,
        value: fieldValues[field.id] ?? null,
      }));

      const response = await fetch("/api/contracts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_id: folderId,
          title: title.trim(),
          profile_id: profileId || null,
          start_date: startDate,
          end_date: endDate || null,
          status,
          field_values: fieldValuesArray,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al crear el contrato");
      }

      const data = await response.json();
      router.push(`/protected/contratos/${data.contract.id}`);
    } catch (error: any) {
      console.error("[CreateContractForm] Error:", error);
      setErrors({ submit: error.message || "Error al crear el contrato" });
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
            Completa la información básica del contrato
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              disabled={isSubmitting}
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
              disabled={isSubmitting || !!initialFolderId}
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

          <div className="grid grid-cols-2 gap-4">
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="profileId">Perfil (opcional)</Label>
            <select
              id="profileId"
              value={profileId || ""}
              onChange={(e) => setProfileId(e.target.value || null)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
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
              onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
            >
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activo</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {profileId && profileFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campos del perfil</CardTitle>
            <CardDescription>
              Completa los campos definidos en el perfil seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContractProfileFields
              fields={profileFields}
              values={fieldValues}
              onChange={handleFieldChange}
              errors={errors}
            />
          </CardContent>
        </Card>
      )}

      {errors.submit && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {errors.submit}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando..." : "Crear contrato"}
        </Button>
      </div>
    </form>
  );
}

