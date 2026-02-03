import { SupabaseClient } from "@supabase/supabase-js";
import { createActivity } from "./activities";

/**
 * Crea automáticamente un workspace y membresía OWNER para un usuario
 * si no tiene registros previos en workspace_members (sin invitación).
 * ññ
 * Usa una función SQL atómica para evitar condiciones de carrera y duplicados.
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
    // Usar la función SQL atómica para crear el workspace y membresía
    // Esta función maneja automáticamente las condiciones de carrera
    const { data: workspaceId, error: rpcError } = await supabase
      .rpc('ensure_user_workspace', {
        p_user_id: userId,
        p_user_email: userEmail || null,
      });

    if (rpcError) {
      console.error("[Workspace] Error llamando a ensure_user_workspace:", rpcError);
      console.error("[Workspace] Detalles del error:", JSON.stringify(rpcError, null, 2));
      return null;
    }

    if (!workspaceId) {
      console.warn("[Workspace] La función SQL no retornó un workspace_id");
      return null;
    }

    console.log("[Workspace] Workspace ID retornado por la función SQL:", workspaceId);

    // Verificar si el workspace es nuevo o ya existía
    // Si es nuevo, registrar la actividad
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .eq('id', workspaceId)
      .single();

    if (workspaceError) {
      console.error("[Workspace] Error obteniendo información del workspace:", workspaceError);
      // Aún así retornar el workspace_id si la función SQL lo retornó
      return workspaceId;
    }

    // Verificar si el workspace fue creado recientemente (en los últimos 5 segundos)
    // Esto nos ayuda a determinar si es un workspace nuevo o uno existente
    const now = new Date();
    const createdAt = new Date(workspace.created_at);
    const secondsDiff = (now.getTime() - createdAt.getTime()) / 1000;

    if (secondsDiff < 5) {
      // Es un workspace nuevo, registrar la actividad
      console.log("[Workspace] Workspace nuevo detectado, registrando actividad...");
      try {
        await createActivity(supabase, {
          type: 'CREATE',
          description: `Creó el workspace "${workspace.name}"`,
          entity_type: 'workspace',
          entity_id: workspace.id,
          workspace_id: workspace.id,
          metadata: {
            workspace_name: workspace.name,
          },
        });
      } catch (activityError) {
        console.error("[Workspace] Error registrando actividad:", activityError);
      }
    } else {
      console.log("[Workspace] Workspace existente, no se registra actividad de creación");
    }

    return workspaceId;
  } catch (error) {
    console.error("[Workspace] Error inesperado en ensureUserWorkspace:", error);
    console.error("[Workspace] Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
    return null;
  }
}

