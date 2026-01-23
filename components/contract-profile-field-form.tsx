"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { 
  Text, 
  Hash, 
  Calendar, 
  DollarSign, 
  List, 
  CheckSquare,
  Plus,
  X
} from "lucide-react";
import { type ContractProfileFieldType, type ContractProfileField } from "@/lib/supabase/contract-profiles";

interface ContractProfileFieldFormProps {
  field?: ContractProfileField | null;
  onSubmit: (data: {
    key: string;
    label: string;
    type: ContractProfileFieldType;
    is_required: boolean;
    options?: string[];
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const FIELD_TYPES: { value: ContractProfileFieldType; label: string; icon: typeof Text }[] = [
  { value: 'TEXT', label: 'Texto', icon: Text },
  { value: 'NUMBER', label: 'Número', icon: Hash },
  { value: 'DATE', label: 'Fecha', icon: Calendar },
  { value: 'MONEY', label: 'Dinero', icon: DollarSign },
  { value: 'SELECT', label: 'Selección', icon: List },
  { value: 'CHECKBOX', label: 'Casilla', icon: CheckSquare },
];

export function ContractProfileFieldForm({
  field,
  onSubmit,
  onCancel,
  isLoading = false,
}: ContractProfileFieldFormProps) {
  const [key, setKey] = useState(field?.key || "");
  const [label, setLabel] = useState(field?.label || "");
  const [type, setType] = useState<ContractProfileFieldType>(field?.type || 'TEXT');
  const [isRequired, setIsRequired] = useState(field?.is_required || false);
  const [options, setOptions] = useState<string[]>(
    field?.options?.options || []
  );
  const [newOption, setNewOption] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Limpiar opciones si cambia de SELECT a otro tipo
  useEffect(() => {
    if (type !== 'SELECT') {
      setOptions([]);
    }
  }, [type]);

  // Actualizar estado cuando cambia el field
  useEffect(() => {
    if (field) {
      setKey(field.key || "");
      setLabel(field.label || "");
      setType(field.type || 'TEXT');
      setIsRequired(field.is_required || false);
      setOptions(field.options?.options || []);
    } else {
      setKey("");
      setLabel("");
      setType('TEXT');
      setIsRequired(false);
      setOptions([]);
    }
    setError(null);
  }, [field]);

  const handleAddOption = () => {
    if (newOption.trim()) {
      setOptions([...options, newOption.trim()]);
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!key || !key.trim()) {
      setError("El key es requerido");
      return;
    }

    if (key.length > 255) {
      setError("El key no puede exceder 255 caracteres");
      return;
    }

    if (!label || !label.trim()) {
      setError("El label es requerido");
      return;
    }

    if (label.length > 255) {
      setError("El label no puede exceder 255 caracteres");
      return;
    }

    // Validar opciones si es SELECT
    if (type === 'SELECT') {
      if (options.length === 0) {
        setError("Debes agregar al menos una opción para campos de tipo SELECT");
        return;
      }
    }

    onSubmit({
      key: key.trim(),
      label: label.trim(),
      type,
      is_required: isRequired,
      options: type === 'SELECT' ? options : undefined,
    });
  };

  const selectedTypeInfo = FIELD_TYPES.find(t => t.value === type);
  const TypeIcon = selectedTypeInfo?.icon || Text;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Key */}
      <div className="space-y-2">
        <Label htmlFor="key">
          Key <span className="text-destructive">*</span>
        </Label>
        <Input
          id="key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Ej: sla_hours, monthly_fee"
          required
          maxLength={255}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          Identificador único del campo (snake_case recomendado)
        </p>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="label">
          Etiqueta <span className="text-destructive">*</span>
        </Label>
        <Input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej: SLA (horas), Tarifa mensual"
          required
          maxLength={255}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          Etiqueta legible del campo
        </p>
      </div>

      {/* Tipo */}
      <div className="space-y-2">
        <Label htmlFor="type">
          Tipo <span className="text-destructive">*</span>
        </Label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as ContractProfileFieldType)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          required
          disabled={isLoading}
        >
          {FIELD_TYPES.map((fieldType) => {
            const Icon = fieldType.icon;
            return (
              <option key={fieldType.value} value={fieldType.value}>
                {fieldType.label}
              </option>
            );
          })}
        </select>
        <p className="text-xs text-muted-foreground">
          Tipo de dato que almacenará este campo
        </p>
      </div>

      {/* Hints contextuales según el tipo */}
      {type === 'NUMBER' && (
        <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
          <Hash className="h-4 w-4 inline mr-2" />
          Solo números enteros o decimales
        </div>
      )}

      {type === 'MONEY' && (
        <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
          <DollarSign className="h-4 w-4 inline mr-2" />
          Formato: 1234.56
        </div>
      )}

      {type === 'DATE' && (
        <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 inline mr-2" />
          Formato: YYYY-MM-DD
        </div>
      )}

      {/* Opciones para SELECT */}
      {type === 'SELECT' && (
        <div className="space-y-2">
          <Label>
            Opciones <span className="text-destructive">*</span>
          </Label>
          <div className="space-y-2">
            {options.length > 0 && (
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...options];
                        newOptions[index] = e.target.value;
                        setOptions(newOptions);
                      }}
                      placeholder="Opción"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOption(index)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Agregar nueva opción"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                disabled={isLoading || !newOption.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Agrega al menos una opción. Los usuarios podrán seleccionar una de estas opciones.
          </p>
        </div>
      )}

      {/* Is Required */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isRequired"
          checked={isRequired}
          onCheckedChange={(checked) => setIsRequired(checked === true)}
          disabled={isLoading}
        />
        <Label
          htmlFor="isRequired"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Campo requerido
        </Label>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Guardando..." : field ? "Guardar Cambios" : "Crear Campo"}
        </Button>
      </div>
    </form>
  );
}

