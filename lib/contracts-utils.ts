import type { ContractStatus } from "./supabase/contracts";
import type { ContractProfileFieldType } from "./supabase/contract-profiles";

/**
 * Traduce el status del contrato a español
 */
export function getStatusLabel(status: ContractStatus): string {
  const labels: Record<ContractStatus, string> = {
    DRAFT: 'Borrador',
    ACTIVE: 'Activo',
    EXPIRED: 'Expirado',
    CANCELED: 'Cancelado',
    ARCHIVED: 'Archivado',
  };
  return labels[status] || status;
}

/**
 * Obtiene la variante del badge según el status
 */
export function getStatusBadgeVariant(status: ContractStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<ContractStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    DRAFT: 'secondary',
    ACTIVE: 'default',
    EXPIRED: 'destructive',
    CANCELED: 'destructive',
    ARCHIVED: 'outline',
  };
  return variants[status] || 'secondary';
}

/**
 * Formatea un valor según el tipo de campo
 */
export function formatContractValue(
  fieldType: ContractProfileFieldType,
  value: any
): string {
  if (value === null || value === undefined) {
    return '-';
  }

  switch (fieldType) {
    case 'TEXT':
      return String(value);
    
    case 'NUMBER':
      return typeof value === 'number' ? value.toLocaleString('es-ES') : String(value);
    
    case 'DATE':
      if (typeof value === 'string') {
        try {
          const date = new Date(value);
          return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch {
          return String(value);
        }
      }
      return String(value);
    
    case 'MONEY':
      if (typeof value === 'number') {
        return new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: 'USD', // Por ahora USD, podría ser configurable
        }).format(value);
      }
      return String(value);
    
    case 'CHECKBOX':
      return value === true || value === 'true' ? 'Sí' : 'No';
    
    case 'SELECT':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      if (typeof value === 'object' && value !== null) {
        // Si es un objeto con estructura { value: '...' }
        if ('value' in value) {
          return String(value.value);
        }
        return JSON.stringify(value);
      }
      return String(value);
    
    default:
      return String(value);
  }
}

/**
 * Valida un valor según el tipo de campo y si es requerido
 */
export function validateFieldValue(
  field: {
    type: ContractProfileFieldType;
    is_required: boolean;
    options?: { options: string[] } | null;
  },
  value: any
): { valid: boolean; error?: string } {
  // Si es requerido y está vacío
  if (field.is_required) {
    if (value === null || value === undefined || value === '') {
      return { valid: false, error: 'Este campo es requerido' };
    }
    if (Array.isArray(value) && value.length === 0) {
      return { valid: false, error: 'Este campo es requerido' };
    }
  }

  // Si no es requerido y está vacío, es válido
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  // Validaciones según tipo
  switch (field.type) {
    case 'NUMBER':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'Debe ser un número válido' };
      }
      break;

    case 'DATE':
      if (typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, error: 'Debe ser una fecha válida' };
        }
      }
      break;

    case 'MONEY':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'Debe ser un valor monetario válido' };
      }
      break;

    case 'SELECT':
      if (field.options && field.options.options) {
        const validOptions = field.options.options;
        if (Array.isArray(value)) {
          // Si es múltiple, verificar que todos los valores sean válidos
          const invalidValues = value.filter(v => !validOptions.includes(v));
          if (invalidValues.length > 0) {
            return { valid: false, error: `Valores inválidos: ${invalidValues.join(', ')}` };
          }
        } else {
          // Si es simple, verificar que el valor sea válido
          if (!validOptions.includes(value)) {
            return { valid: false, error: `El valor debe ser uno de: ${validOptions.join(', ')}` };
          }
        }
      }
      break;

    case 'CHECKBOX':
      // Checkbox siempre es válido (true/false)
      break;

    case 'TEXT':
      // Text siempre es válido (cualquier string)
      break;
  }

  return { valid: true };
}

