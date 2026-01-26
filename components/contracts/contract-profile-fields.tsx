"use client";

import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import type { ContractProfileFieldType } from "@/lib/supabase/contract-profiles";
import { validateFieldValue } from "@/lib/contracts-utils";

interface ProfileField {
  id: string;
  key: string;
  label: string;
  type: ContractProfileFieldType;
  is_required: boolean;
  options?: { options: string[] } | null;
  sort_order: number;
}

interface ContractProfileFieldsProps {
  fields: ProfileField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  readOnly?: boolean;
  errors?: Record<string, string>;
}

export function ContractProfileFields({
  fields,
  values,
  onChange,
  readOnly = false,
  errors = {},
}: ContractProfileFieldsProps) {
  const sortedFields = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  const renderField = (field: ProfileField) => {
    const value = values[field.id] ?? null;
    const error = errors[field.id];
    const fieldId = `field-${field.id}`;

    switch (field.type) {
      case 'TEXT':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="text"
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value)}
              disabled={readOnly}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'NUMBER':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="number"
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value ? parseFloat(e.target.value) : null)}
              disabled={readOnly}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'DATE':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="date"
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value || null)}
              disabled={readOnly}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'MONEY':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={fieldId}
              type="number"
              step="0.01"
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value ? parseFloat(e.target.value) : null)}
              disabled={readOnly}
              className={error ? "border-destructive" : ""}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'CHECKBOX':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={fieldId}
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => onChange(field.id, checked === true)}
              disabled={readOnly}
            />
            <Label htmlFor={fieldId} className="cursor-pointer">
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'SELECT':
        const options = field.options?.options || [];
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={fieldId}>
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <select
              id={fieldId}
              value={value || ''}
              onChange={(e) => onChange(field.id, e.target.value || null)}
              disabled={readOnly}
              className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-destructive" : ""}`}
            >
              <option value="">Selecciona una opción</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (sortedFields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Este perfil no tiene campos definidos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedFields.map(renderField)}
    </div>
  );
}

