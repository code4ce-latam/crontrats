import { SupabaseClient } from "@supabase/supabase-js";
import { createActivity } from "./activities";

/**
 * Crea automáticamente un workspace y membresía OWNER para un usuario
 * si no tiene registros previos en workspace_members (sin invitación).
 * 
 * @param supabase Cliente de Supabase
 * @param userId ID del usuario
 * @param userEmail Email del usuario (para generar el nombre del workspace)
 * @returns Promise con el workspace_id creado o null si ya tenía workspace
 */
export async function ensureUserWorkspace(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null
): Promise<string | null> {
  console.log("[Workspace] Iniciando ensureUserWorkspace", { userId, userEmail });
  
  try {
    // Verificar si el usuario ya tiene registros en workspace_members (fue invitado)
    console.log("[Workspace] Verificando membresías existentes para userId:", userId);
    const { data: existingMembership, error: checkError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error("[Workspace] Error verificando membresías existentes:", checkError);
      console.error("[Workspace] Detalles del error:", JSON.stringify(checkError, null, 2));
      return null;
    }

    console.log("[Workspace] Resultado de verificación de membresías:", existingMembership);

    // Si ya tiene una membresía, no crear nuevo workspace
    if (existingMembership) {
      console.log("[Workspace] Usuario ya tiene workspace, retornando workspace_id:", existingMembership.workspace_id);
      return existingMembership.workspace_id;
    }

    // Extraer el prefijo del email (parte antes del @)
    let emailPrefix: string;
    if (!userEmail || userEmail === '') {
      emailPrefix = 'Usuario';
    } else if (userEmail.includes('@')) {
      const parts = userEmail.split('@');
      emailPrefix = parts[0] || userEmail;
    } else {
      emailPrefix = userEmail;
    }

    // Generar el nombre del workspace
    const workspaceName = `Workspace de ${emailPrefix}`;
    console.log("[Workspace] Nombre del workspace a crear:", workspaceName);

    // Crear el workspace
    console.log("[Workspace] Intentando crear workspace...");
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({ name: workspaceName })
      .select('id')
      .single();

    if (workspaceError) {
      console.error("[Workspace] Error creando workspace:", workspaceError);
      console.error("[Workspace] Detalles del error:", JSON.stringify(workspaceError, null, 2));
      console.error("[Workspace] Código del error:", workspaceError.code);
      console.error("[Workspace] Mensaje del error:", workspaceError.message);
      console.error("[Workspace] Detalles adicionales:", workspaceError.details);
      console.error("[Workspace] Hint:", workspaceError.hint);
      return null;
    }

    if (!workspace) {
      console.error("[Workspace] No se recibió workspace después de insertar");
      return null;
    }

    console.log("[Workspace] Workspace creado exitosamente:", workspace.id);

    // Verificar nuevamente si el usuario ya tiene una membresía (protección contra condiciones de carrera)
    // Esto puede pasar si React Strict Mode ejecuta el efecto dos veces en desarrollo
    console.log("[Workspace] Verificando nuevamente membresías antes de crear membresía (protección contra race condition)...");
    const { data: doubleCheckMembership, error: doubleCheckError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (doubleCheckError) {
      console.error("[Workspace] Error en verificación doble:", doubleCheckError);
    }

    // Si otra ejecución paralela ya creó una membresía, retornar el existente sin eliminar nada
    if (doubleCheckMembership && doubleCheckMembership.workspace_id !== workspace.id) {
      console.warn("[Workspace] Se detectó una membresía existente creada por otra ejecución paralela.");
      console.warn("[Workspace] Workspace existente:", doubleCheckMembership.workspace_id);
      console.warn("[Workspace] Workspace duplicado creado:", workspace.id);
      console.warn("[Workspace] Retornando workspace existente sin eliminar registros.");
      
      // NO eliminamos el workspace duplicado - simplemente retornamos el existente
      return doubleCheckMembership.workspace_id;
    }

    // Crear la membresía con role OWNER y status ACTIVE
    console.log("[Workspace] Intentando crear membresía...", {
      workspace_id: workspace.id,
      user_id: userId,
      role: 'OWNER',
      status: 'ACTIVE',
      created_by_user_id: userId
    });

    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'OWNER',
        status: 'ACTIVE',
        created_by_user_id: userId, // Se auto-creó
      })
      .select('id')
      .single();

    if (membershipError) {
      // Si el error es por violación de restricción única, verificar si ya existe otra membresía
      if (membershipError.code === '23505') {
        console.warn("[Workspace] Violación de restricción única detectada. Verificando membresía existente...");
        const { data: existingMembership } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();
        
        if (existingMembership) {
          console.warn("[Workspace] Ya existe una membresía. Retornando workspace existente sin eliminar registros.");
          // NO eliminamos el workspace - simplemente retornamos el existente
          return existingMembership.workspace_id;
        }
      }
      
      console.error("[Workspace] Error creando membresía:", membershipError);
      console.error("[Workspace] Detalles del error:", JSON.stringify(membershipError, null, 2));
      console.error("[Workspace] Código del error:", membershipError.code);
      console.error("[Workspace] Mensaje del error:", membershipError.message);
      console.error("[Workspace] Detalles adicionales:", membershipError.details);
      console.error("[Workspace] Hint:", membershipError.hint);
      // NO eliminamos el workspace si falla la membresía - solo retornamos null
      console.warn("[Workspace] No se eliminó el workspace creado. Se mantiene en la base de datos.");
      return null;
    }

    console.log("[Workspace] Membresía creada exitosamente:", membership?.id);
    console.log("[Workspace] Proceso completado exitosamente. Workspace ID:", workspace.id);

    // Registrar actividad de creación de workspace
    try {
      await createActivity(supabase, {
        type: 'CREATE',
        description: `Creó el workspace "${workspaceName}"`,
        entity_type: 'workspace',
        entity_id: workspace.id,
        workspace_id: workspace.id,
        metadata: {
          workspace_name: workspaceName,
        },
      });
    } catch (activityError) {
      console.error("[Workspace] Error registrando actividad:", activityError);
    }

    return workspace.id;
  } catch (error) {
    console.error("[Workspace] Error inesperado en ensureUserWorkspace:", error);
    console.error("[Workspace] Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
    return null;
  }
}

