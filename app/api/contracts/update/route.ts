import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { 
  getUserWorkspaceId, 
  validateContractPermissions,
  getContractAccess 
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
      contract_id,
      title, 
      folder_id,
      profile_id, 
      start_date, 
      end_date, 
      status,
      field_values 
    } = body;

    // Validaciones básicas
    if (!contract_id) {
      return NextResponse.json(
        { error: "contract_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener el contrato actual
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos: debe tener EDIT/OWNER en la carpeta actual
    const hasPermission = await validateContractPermissions(supabase, contract.folder_id, 'EDIT');
    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos para editar este contrato" },
        { status: 403 }
      );
    }


    // Verificar que el usuario es OWNER o EDITOR del workspace
    const workspaceId = await getUserWorkspaceId(supabase);
    if (!workspaceId || workspaceId !== contract.workspace_id) {
      return NextResponse.json(
        { error: "No perteneces a este workspace" },
        { status: 403 }
      );
    }

    // Paralelizar validaciones independientes
    const [membershipResult, folderValidation] = await Promise.all([
      // Verificar rol del usuario
      supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('workspace_id', workspaceId)
        .eq('status', 'ACTIVE')
        .single(),
      
      // Si se cambia la carpeta, validar en paralelo
      folder_id !== undefined && folder_id !== contract.folder_id && folder_id
        ? supabase
            .from('folders')
            .select('id, workspace_id')
            .eq('id', folder_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const { data: membership } = membershipResult;
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'EDITOR')) {
      return NextResponse.json(
        { error: "Solo los propietarios y editores pueden editar contratos" },
        { status: 403 }
      );
    }

    // Validar nueva carpeta si se cambió (ya se obtuvo en paralelo)
    if (folder_id !== undefined && folder_id !== contract.folder_id) {
      if (!folder_id) {
        return NextResponse.json(
          { error: "La carpeta es requerida" },
          { status: 400 }
        );
      }

      const { data: newFolder, error: folderError } = folderValidation;
      if (folderError || !newFolder) {
        return NextResponse.json(
          { error: "La carpeta seleccionada no existe" },
          { status: 404 }
        );
      }

      if (newFolder.workspace_id !== workspaceId) {
        return NextResponse.json(
          { error: "La carpeta no pertenece a tu workspace" },
          { status: 403 }
        );
      }

      // Verificar permisos EDIT/OWNER en la nueva carpeta
      const hasNewFolderPermission = await validateContractPermissions(supabase, folder_id, 'EDIT');
      if (!hasNewFolderPermission) {
        return NextResponse.json(
          { error: "No tienes permisos para mover el contrato a esa carpeta" },
          { status: 403 }
        );
      }
    }

    // Si se cambia el profile_id, validar
    if (profile_id !== undefined && profile_id !== contract.profile_id) {
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

        // Validar campos required del nuevo profile
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
    } else if (contract.profile_id && field_values && Array.isArray(field_values) && field_values.length > 0) {
      // Si no cambia el profile pero hay field_values, validar required
      const { data: profileFields } = await supabase
        .from('contract_profile_fields')
        .select('id, key, label, type, is_required')
        .eq('profile_id', contract.profile_id)
        .order('sort_order', { ascending: true });

      if (profileFields && profileFields.length > 0) {
        const requiredFields = profileFields.filter(f => f.is_required);
        const providedFieldIds = new Set(
          field_values.map((fv: any) => fv.profile_field_id)
        );

        for (const field of requiredFields) {
          if (!providedFieldIds.has(field.id)) {
            return NextResponse.json(
              { error: `El campo "${field.label}" es requerido` },
              { status: 400 }
            );
          }

          // Validar que el valor no esté vacío
          const fieldValue = field_values.find((fv: any) => fv.profile_field_id === field.id);
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

    // Preparar datos de actualización
    const updateData: any = {};
    if (title !== undefined && title.trim() !== contract.title) {
      updateData.title = title.trim();
    }
    if (folder_id !== undefined && folder_id !== contract.folder_id) {
      updateData.folder_id = folder_id;
    }
    if (profile_id !== undefined && profile_id !== contract.profile_id) {
      updateData.profile_id = profile_id || null;
    }
    if (start_date !== undefined && start_date !== contract.start_date) {
      updateData.start_date = start_date;
    }
    if (end_date !== undefined) {
      const newEndDate = end_date || null;
      const currentEndDate = contract.end_date || null;
      if (newEndDate !== currentEndDate) {
        updateData.end_date = newEndDate;
      }
    }
    if (status !== undefined && status !== contract.status) {
      updateData.status = status;
    }

    // Solo actualizar si hay cambios
    let updatedContract = contract;
    if (Object.keys(updateData).length > 0) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('contracts')
        .update(updateData)
        .eq('id', contract_id)
        .select()
        .single();

      if (updateError || !updated) {
        console.error("[Contracts/Update] Error actualizando contrato:", updateError);
        return NextResponse.json(
          { error: updateError?.message || "Error al actualizar el contrato" },
          { status: 500 }
        );
      }
      updatedContract = updated;
    }

    // Actualizar field_values si se proporcionan
    if (field_values && Array.isArray(field_values)) {
      // Obtener profile_id actual (puede haber cambiado)
      const currentProfileId = updatedContract.profile_id || contract.profile_id;
      
      // Si se quitó el perfil, eliminar todos los field_values
      if (!currentProfileId && contract.profile_id) {
        const { error: deleteError } = await supabaseAdmin
          .from('contract_field_values')
          .delete()
          .eq('contract_id', contract_id);

        if (deleteError) {
          console.error("[Contracts/Update] Error eliminando field_values:", deleteError);
        }
      } else if (currentProfileId) {
        // Obtener campos del perfil actual
        const { data: profileFields } = await supabase
          .from('contract_profile_fields')
          .select('id, type')
          .eq('profile_id', currentProfileId);

        if (profileFields && profileFields.length > 0) {
          // Si se cambió el perfil, eliminar field_values del perfil anterior
          if (contract.profile_id && contract.profile_id !== currentProfileId) {
            // Obtener IDs de campos del perfil anterior
            const { data: oldProfileFields } = await supabase
              .from('contract_profile_fields')
              .select('id')
              .eq('profile_id', contract.profile_id);

            if (oldProfileFields && oldProfileFields.length > 0) {
              const oldFieldIds = oldProfileFields.map(f => f.id);
              const { error: deleteError } = await supabaseAdmin
                .from('contract_field_values')
                .delete()
                .eq('contract_id', contract_id)
                .in('profile_field_id', oldFieldIds);

              if (deleteError) {
                console.error("[Contracts/Update] Error eliminando field_values del perfil anterior:", deleteError);
              }
            }
          }

          // Preparar batch upsert de field_values
          if (field_values.length > 0) {
            const profileFieldsMap = new Map(profileFields.map(f => [f.id, f]));
            const valueDataArray = field_values
              .map(fv => {
                const field = profileFieldsMap.get(fv.profile_field_id);
                if (!field) return null;

                const baseValue = {
                  workspace_id: workspaceId,
                  contract_id: contract_id,
                  profile_field_id: fv.profile_field_id,
                };

                // Mapear valor según tipo de campo
                let valueData: any = { ...baseValue };
                switch (field.type) {
                  case 'TEXT':
                    valueData.value_text = fv.value !== null && fv.value !== undefined ? String(fv.value) : null;
                    break;
                  case 'NUMBER':
                    valueData.value_number = fv.value !== null && fv.value !== undefined && fv.value !== '' ? parseFloat(String(fv.value)) : null;
                    break;
                  case 'DATE':
                    valueData.value_date = fv.value || null;
                    break;
                  case 'MONEY':
                    valueData.value_money = fv.value !== null && fv.value !== undefined && fv.value !== '' ? parseFloat(String(fv.value)) : null;
                    break;
                  case 'CHECKBOX':
                    valueData.value_bool = fv.value === true || fv.value === 'true' || fv.value === 1;
                    break;
                  case 'SELECT':
                    valueData.value_json = fv.value || null;
                    break;
                }
                return valueData;
              })
              .filter((v): v is any => v !== null);

            // Batch upsert usando ON CONFLICT
            if (valueDataArray.length > 0) {
              const { error: upsertError } = await supabaseAdmin
                .from('contract_field_values')
                .upsert(valueDataArray, {
                  onConflict: 'contract_id,profile_field_id',
                });

              if (upsertError) {
                console.error("[Contracts/Update] Error upserting field_values:", upsertError);
                throw new Error(`Error al actualizar los campos: ${upsertError.message}`);
              }
            }
          }
        }
      }
    }

    // Registrar actividad
    try {
      await createActivity(supabase, {
        type: 'CONTRACT_UPDATED',
        description: `Actualizó el contrato "${updatedContract.title}"`,
        entity_type: 'contract',
        entity_id: contract_id,
        workspace_id: workspaceId,
        metadata: {
          folder_id: updatedContract.folder_id || contract.folder_id,
          old_folder_id: folder_id !== undefined && folder_id !== contract.folder_id ? contract.folder_id : null,
          profile_id: updatedContract.profile_id || null,
          changes: Object.keys(updateData),
        },
      });
    } catch (activityError) {
      console.error("[Contracts/Update] Error registrando actividad:", activityError);
    }

    return NextResponse.json({ 
      success: true, 
      contract: updatedContract 
    });
  } catch (error: any) {
    console.error("[Contracts/Update] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar el contrato" },
      { status: 500 }
    );
  }
}

