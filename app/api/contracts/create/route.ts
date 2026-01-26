import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  getUserWorkspaceId, 
  validateContractPermissions,
  getCurrentUserMemberId 
} from "@/lib/supabase/contracts";
import { createActivity } from "@/lib/supabase/activities";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      folder_id, 
      title, 
      profile_id, 
      start_date, 
      end_date, 
      status,
      field_values 
    } = body;

    // Validaciones básicas
    if (!folder_id || !title || !title.trim()) {
      return NextResponse.json(
        { error: "folder_id y title son requeridos" },
        { status: 400 }
      );
    }

    if (!start_date) {
      return NextResponse.json(
        { error: "start_date es requerido" },
        { status: 400 }
      );
    }

    // Obtener workspace_id
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No se pudo obtener la información del workspace" },
        { status: 400 }
      );
    }

    // Verificar que el usuario es OWNER o EDITOR del workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('status', 'ACTIVE')
      .single();

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'EDITOR')) {
      return NextResponse.json(
        { error: "Solo los propietarios y editores pueden crear contratos" },
        { status: 403 }
      );
    }

    // Validar permisos: debe tener EDIT/OWNER en la carpeta
    const hasPermission = await validateContractPermissions(supabase, folder_id, 'EDIT');
    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos para crear contratos en esta carpeta" },
        { status: 403 }
      );
    }

    // Verificar que la carpeta pertenece al workspace
    const { data: folder } = await supabase
      .from('folders')
      .select('workspace_id')
      .eq('id', folder_id)
      .single();

    if (!folder || folder.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "La carpeta no pertenece a tu workspace" },
        { status: 400 }
      );
    }

    // Si hay profile_id, validar que pertenece al workspace
    if (profile_id) {
      const { data: profile } = await supabase
        .from('contract_profiles')
        .select('workspace_id, is_active')
        .eq('id', profile_id)
        .single();

      if (!profile || profile.workspace_id !== workspaceId) {
        return NextResponse.json(
          { error: "El perfil no pertenece a tu workspace" },
          { status: 400 }
        );
      }

      if (!profile.is_active) {
        return NextResponse.json(
          { error: "El perfil seleccionado no está activo" },
          { status: 400 }
        );
      }

      // Validar campos required del profile
      const { data: profileFields } = await supabase
        .from('contract_profile_fields')
        .select('id, key, label, type, is_required')
        .eq('profile_id', profile_id)
        .order('sort_order', { ascending: true });

      if (profileFields) {
        const requiredFields = profileFields.filter(f => f.is_required);
        const providedFieldIds = new Set(
          (field_values || []).map((fv: any) => fv.profile_field_id)
        );

        for (const field of requiredFields) {
          if (!providedFieldIds.has(field.id)) {
            return NextResponse.json(
              { error: `El campo "${field.label}" es requerido` },
              { status: 400 }
            );
          }

          // Validar que el valor no esté vacío
          const fieldValue = (field_values || []).find((fv: any) => fv.profile_field_id === field.id);
          if (fieldValue) {
            const value = fieldValue.value;
            if (value === null || value === undefined || value === '' || 
                (Array.isArray(value) && value.length === 0)) {
              return NextResponse.json(
                { error: `El campo "${field.label}" no puede estar vacío` },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // Crear el contrato
    const contractStatus = status || 'DRAFT';
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .insert({
        workspace_id: workspaceId,
        folder_id,
        profile_id: profile_id || null,
        title: title.trim(),
        start_date,
        end_date: end_date || null,
        status: contractStatus,
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (contractError || !contract) {
      console.error("[Contracts/Create] Error creando contrato:", contractError);
      return NextResponse.json(
        { error: contractError?.message || "Error al crear el contrato" },
        { status: 500 }
      );
    }

    // Crear field_values si hay profile y field_values
    if (profile_id && field_values && Array.isArray(field_values) && field_values.length > 0) {
      const { data: profileFields } = await supabase
        .from('contract_profile_fields')
        .select('id, type')
        .eq('profile_id', profile_id);

      if (profileFields) {
        const fieldValuesToInsert = field_values.map((fv: any) => {
          const field = profileFields.find(f => f.id === fv.profile_field_id);
          if (!field) return null;

          const baseValue = {
            workspace_id: workspaceId,
            contract_id: contract.id,
            profile_field_id: fv.profile_field_id,
          };

          // Mapear valor según tipo de campo
          switch (field.type) {
            case 'TEXT':
              return { ...baseValue, value_text: fv.value || null };
            case 'NUMBER':
              return { ...baseValue, value_number: fv.value ? parseFloat(fv.value) : null };
            case 'DATE':
              return { ...baseValue, value_date: fv.value || null };
            case 'MONEY':
              return { ...baseValue, value_money: fv.value ? parseFloat(fv.value) : null };
            case 'CHECKBOX':
              return { ...baseValue, value_bool: fv.value === true || fv.value === 'true' };
            case 'SELECT':
              return { ...baseValue, value_json: fv.value || null };
            default:
              return null;
          }
        }).filter(Boolean);

        if (fieldValuesToInsert.length > 0) {
          const { error: valuesError } = await supabaseAdmin
            .from('contract_field_values')
            .insert(fieldValuesToInsert);

          if (valuesError) {
            console.error("[Contracts/Create] Error creando field_values:", valuesError);
            // No fallar, solo loggear el error
          }
        }
      }
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'CONTRACT_CREATED',
        description: `Creó el contrato "${contract.title}"`,
        entity_type: 'contract',
        entity_id: contract.id,
        workspace_id: workspaceId,
        metadata: {
          folder_id,
          profile_id: profile_id || null,
          status: contractStatus,
        },
      });
    } catch (activityError) {
      console.error("[Contracts/Create] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ 
      success: true, 
      contract 
    });
  } catch (error: any) {
    console.error("[Contracts/Create] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear el contrato" },
      { status: 500 }
    );
  }
}

