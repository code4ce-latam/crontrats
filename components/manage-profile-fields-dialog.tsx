"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Settings,
  Text,
  Hash,
  Calendar,
  DollarSign,
  List,
  CheckSquare
} from "lucide-react";
import { type ContractProfile, type ContractProfileField, type ContractProfileFieldType } from "@/lib/supabase/contract-profiles";
import { ContractProfileFieldForm } from "./contract-profile-field-form";
import { createClient } from "@/lib/supabase/client";

interface ManageProfileFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ContractProfile;
  onSuccess?: () => void;
}

const FIELD_TYPE_ICONS: Record<ContractProfileFieldType, typeof Text> = {
  TEXT: Text,
  NUMBER: Hash,
  DATE: Calendar,
  MONEY: DollarSign,
  SELECT: List,
  CHECKBOX: CheckSquare,
};

const FIELD_TYPE_LABELS: Record<ContractProfileFieldType, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  DATE: 'Fecha',
  MONEY: 'Dinero',
  SELECT: 'Selección',
  CHECKBOX: 'Casilla',
};

export function ManageProfileFieldsDialog({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: ManageProfileFieldsDialogProps) {
  const router = useRouter();
  const [fields, setFields] = useState<ContractProfileField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingField, setEditingField] = useState<ContractProfileField | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cargar campos cuando se abre el diálogo
  useEffect(() => {
    if (open) {
      loadFields();
    } else {
      setFields([]);
      setIsFormOpen(false);
      setEditingField(null);
      setError(null);
    }
  }, [open, profile.id]);

  const loadFields = async () => {
    setIsLoadingFields(true);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('contract_profile_fields')
        .select('*')
        .eq('profile_id', profile.id)
        .order('sort_order', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setFields((data || []) as ContractProfileField[]);
    } catch (err: any) {
      console.error("[ManageFields] Error cargando campos:", err);
      setError(err.message || "Error al cargar los campos");
    } finally {
      setIsLoadingFields(false);
    }
  };

  const handleAddField = () => {
    setEditingField(null);
    setIsFormOpen(true);
  };

  const handleEditField = (field: ContractProfileField) => {
    setEditingField(field);
    setIsFormOpen(true);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este campo?")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/contract-profiles/fields/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fieldId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al eliminar el campo");
      }

      await loadFields();
    } catch (err: any) {
      setError(err.message || "Error al eliminar el campo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveField = async (fieldId: string, direction: 'up' | 'down') => {
    const currentIndex = fields.findIndex(f => f.id === fieldId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    // Intercambiar campos
    const newFields = [...fields];
    [newFields[currentIndex], newFields[newIndex]] = [newFields[newIndex], newFields[currentIndex]];

    // Actualizar sort_order
    const fieldIds = newFields.map(f => f.id);

    setIsLoading(true);
    try {
      const response = await fetch("/api/contract-profiles/fields/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fieldIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al reordenar los campos");
      }

      await loadFields();
    } catch (err: any) {
      setError(err.message || "Error al reordenar los campos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (data: {
    key: string;
    label: string;
    type: ContractProfileFieldType;
    is_required: boolean;
    options?: string[];
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = editingField
        ? "/api/contract-profiles/fields/update"
        : "/api/contract-profiles/fields/create";

      const body = editingField
        ? {
            fieldId: editingField.id,
            key: data.key,
            label: data.label,
            type: data.type,
            is_required: data.is_required,
            options: data.options,
          }
        : {
            profile_id: profile.id,
            key: data.key,
            label: data.label,
            type: data.type,
            is_required: data.is_required,
            options: data.options,
          };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al guardar el campo");
      }

      setIsFormOpen(false);
      setEditingField(null);
      await loadFields();
    } catch (err: any) {
      setError(err.message || "Error al guardar el campo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingField(null);
    setError(null);
  };

  const handleClose = () => {
    if (!isLoading) {
      setIsFormOpen(false);
      setEditingField(null);
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Campos - {profile.name}</DialogTitle>
          <DialogDescription>
            Agrega, edita o elimina campos para este perfil de contrato
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {isFormOpen ? (
          <div className="space-y-4">
            <ContractProfileFieldForm
              field={editingField}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              isLoading={isLoading}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {fields.length} {fields.length === 1 ? 'campo' : 'campos'} definido{fields.length !== 1 ? 's' : ''}
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={handleAddField}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Campo
              </Button>
            </div>

            {isLoadingFields ? (
              <div className="py-8 text-center">
                <Settings className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Cargando campos...</p>
              </div>
            ) : fields.length === 0 ? (
              <div className="py-8 text-center border border-dashed rounded-lg">
                <Settings className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No hay campos definidos para este perfil
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddField}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Primer Campo
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => {
                  const Icon = FIELD_TYPE_ICONS[field.type];
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{field.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {FIELD_TYPE_LABELS[field.type]}
                            </Badge>
                            {field.is_required && (
                              <Badge variant="secondary" className="text-xs">
                                Requerido
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {field.key}
                            {field.type === 'SELECT' && field.options?.options && (
                              <span className="ml-2">
                                ({field.options.options.length} opciones)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleMoveField(field.id, 'up')}
                          disabled={index === 0 || isLoading}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleMoveField(field.id, 'down')}
                          disabled={index === fields.length - 1 || isLoading}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEditField(field)}
                          disabled={isLoading}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteField(field.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

