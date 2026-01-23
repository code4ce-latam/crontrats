import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createContractProfileField, getUserWorkspaceId } from "@/lib/supabase/contract-profiles";
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
    const { profile_id, key, label, type, is_required, options } = body;

    // Validaciones
    if (!profile_id) {
      return NextResponse.json(
        { error: "profile_id es requerido" },
        { status: 400 }
      );
    }

    if (!key || !key.trim()) {
      return NextResponse.json(
        { error: "El key es requerido" },
        { status: 400 }
      );
    }

    if (!label || !label.trim()) {
      return NextResponse.json(
        { error: "El label es requerido" },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: "El tipo es requerido" },
        { status: 400 }
      );
    }

    const validTypes = ['TEXT', 'NUMBER', 'DATE', 'MONEY', 'SELECT', 'CHECKBOX'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "El tipo debe ser uno de: TEXT, NUMBER, DATE, MONEY, SELECT, CHECKBOX" },
        { status: 400 }
      );
    }

    if (key.length > 255) {
      return NextResponse.json(
        { error: "El key no puede exceder 255 caracteres" },
        { status: 400 }
      );
    }

    if (label.length > 255) {
      return NextResponse.json(
        { error: "El label no puede exceder 255 caracteres" },
        { status: 400 }
      );
    }

    // Validar opciones si el tipo es SELECT
    let parsedOptions = null;
    if (type === 'SELECT') {
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
        { error: "No tienes permisos para crear campos" },
        { status: 403 }
      );
    }

    // Verificar que el perfil pertenece al mismo workspace
    const { data: profile } = await supabase
      .from('contract_profiles')
      .select('workspace_id')
      .eq('id', profile_id)
      .single();

    if (!profile || profile.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "El perfil no pertenece a tu workspace" },
        { status: 403 }
      );
    }

    // Obtener nombre del perfil para la actividad
    const { data: profileData } = await supabase
      .from('contract_profiles')
      .select('name')
      .eq('id', profile_id)
      .single();

    // Crear el campo
    const field = await createContractProfileField(supabase, {
      profile_id,
      key: key.trim(),
      label: label.trim(),
      type,
      is_required: is_required || false,
      options: parsedOptions,
    });

    if (!field) {
      return NextResponse.json(
        { error: "Error al crear el campo" },
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
      const typeLabel = typeLabels[type] || type;

      await createActivity(supabase, {
        type: 'CREATE',
        description: `Agregó el campo "${field.label}" (${typeLabel}) al perfil "${profileData?.name || 'desconocido'}"`,
        entity_type: 'contract_profile_field',
        entity_id: field.id,
        workspace_id: workspaceId,
        metadata: {
          field_id: field.id,
          field_key: field.key,
          field_label: field.label,
          field_type: type,
          field_type_label: typeLabel,
          profile_id: profile_id,
          profile_name: profileData?.name,
          is_required: field.is_required,
          options_count: parsedOptions?.options?.length || 0,
        },
      });
    } catch (activityError) {
      console.error("[CreateContractProfileField] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ success: true, field });
  } catch (error: any) {
    console.error("[CreateContractProfileField] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear el campo" },
      { status: 500 }
    );
  }
}

