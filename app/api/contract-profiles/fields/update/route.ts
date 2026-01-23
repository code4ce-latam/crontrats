import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { updateContractProfileField, getUserWorkspaceId } from "@/lib/supabase/contract-profiles";
import { createActivity } from "@/lib/supabase/activities";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar que el usuario esté autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fieldId, key, label, type, is_required, options, sort_order } = body;

    if (!fieldId) {
      return NextResponse.json(
        { error: "fieldId es requerido" },
        { status: 400 }
      );
    }

    // Validaciones
    if (key !== undefined) {
      if (!key || !key.trim()) {
        return NextResponse.json(
          { error: "El key no puede estar vacío" },
          { status: 400 }
        );
      }
      if (key.length > 255) {
        return NextResponse.json(
          { error: "El key no puede exceder 255 caracteres" },
          { status: 400 }
        );
      }
    }

    if (label !== undefined) {
      if (!label || !label.trim()) {
        return NextResponse.json(
          { error: "El label no puede estar vacío" },
          { status: 400 }
        );
      }
      if (label.length > 255) {
        return NextResponse.json(
          { error: "El label no puede exceder 255 caracteres" },
          { status: 400 }
        );
      }
    }

    if (type !== undefined) {
      const validTypes = ['TEXT', 'NUMBER', 'DATE', 'MONEY', 'SELECT', 'CHECKBOX'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: "El tipo debe ser uno de: TEXT, NUMBER, DATE, MONEY, SELECT, CHECKBOX" },
          { status: 400 }
        );
      }
    }

    // Validar opciones si el tipo es SELECT
    let parsedOptions = null;
    if (type === 'SELECT' && options !== undefined) {
      if (!options || !Array.isArray(options) || options.length === 0) {
        return NextResponse.json(
          { error: "Las opciones son requeridas para campos de tipo SELECT" },
          { status: 400 }
        );
      }
      // Validar que todas las opciones sean strings
      if (!options.every((opt: any) => typeof opt === 'string' && opt.trim())) {
        return NextResponse.json(
          { error: "Todas las opciones deben ser texto válido" },
          { status: 400 }
        );
      }
      parsedOptions = { options: options.map((opt: string) => opt.trim()) };
    }

    // Verificar que el usuario tiene permisos (OWNER o EDITOR)
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del workspace" },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del workspace" },
        { status: 400 }
      );
    }

    if (membership.role !== 'OWNER' && membership.role !== 'EDITOR') {
      return NextResponse.json(
        { error: "No tienes permisos para editar campos" },
        { status: 403 }
      );
    }

    // Verificar que el campo pertenece al mismo workspace y obtener datos originales
    const { data: originalField } = await supabase
      .from('contract_profile_fields')
      .select('*, contract_profiles(name)')
      .eq('id', fieldId)
      .single();

    if (!originalField || originalField.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "El campo no pertenece a tu workspace" },
        { status: 403 }
      );
    }

    const profileName = (originalField.contract_profiles as any)?.name || 'desconocido';

    // Actualizar el campo
    const updatedField = await updateContractProfileField(supabase, fieldId, {
      key: key?.trim(),
      label: label?.trim(),
      type,
      is_required,
      options: parsedOptions,
      sort_order,
    });

    if (!updatedField) {
      return NextResponse.json(
        { error: "Error al actualizar el campo" },
        { status: 500 }
      );
    }

    // Registrar actividad
    try {
      const typeLabels: Record<string, string> = {
        'TEXT': 'Texto',
        'NUMBER': 'Número',
        'DATE': 'Fecha',
        'MONEY': 'Dinero',
        'SELECT': 'Selección',
        'CHECKBOX': 'Casilla',
      };

      const changes: string[] = [];
      if (key !== undefined && key.trim() !== originalField.key) {
        changes.push(`key: "${originalField.key}" → "${key.trim()}"`);
      }
      if (label !== undefined && label.trim() !== originalField.label) {
        changes.push(`etiqueta: "${originalField.label}" → "${label.trim()}"`);
      }
      if (type !== undefined && type !== originalField.type) {
        const oldTypeLabel = typeLabels[originalField.type] || originalField.type;
        const newTypeLabel = typeLabels[type] || type;
        changes.push(`tipo: "${oldTypeLabel}" → "${newTypeLabel}"`);
      }
      if (is_required !== undefined && is_required !== originalField.is_required) {
        changes.push(`requerido: "${originalField.is_required ? 'Sí' : 'No'}" → "${is_required ? 'Sí' : 'No'}"`);
      }

      const description = changes.length > 0
        ? `Actualizó el campo "${updatedField.label}" del perfil "${profileName}": ${changes.join(', ')}`
        : `Actualizó el campo "${updatedField.label}" del perfil "${profileName}"`;

      await createActivity(supabase, {
        type: 'UPDATE',
        description: description,
        entity_type: 'contract_profile_field',
        entity_id: fieldId,
        workspace_id: workspaceId,
        metadata: {
          field_id: fieldId,
          field_key: updatedField.key,
          field_label: updatedField.label,
          old_key: originalField.key,
          new_key: key?.trim(),
          old_label: originalField.label,
          new_label: label?.trim(),
          old_type: originalField.type,
          new_type: type || originalField.type,
          old_is_required: originalField.is_required,
          new_is_required: is_required,
          profile_id: originalField.profile_id,
          profile_name: profileName,
          changes: changes,
        },
      });
    } catch (activityError) {
      console.error("[UpdateContractProfileField] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ success: true, field: updatedField });
  } catch (error: any) {
    console.error("[UpdateContractProfileField] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el campo" },
      { status: 500 }
    );
  }
}

