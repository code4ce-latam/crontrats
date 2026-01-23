"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureUserWorkspace } from "@/lib/supabase/workspace";

/**
 * Componente que asegura que el usuario tenga un workspace.
 * Se ejecuta automáticamente cuando el usuario accede a páginas protegidas.
 * Útil para casos donde el usuario se registró sin pasar por el flujo de confirmación de email.
 */
export function WorkspaceEnsure() {
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Protección contra ejecuciones duplicadas en React Strict Mode (modo desarrollo)
    if (hasRunRef.current) {
      console.log("[WorkspaceEnsure] Ya se ejecutó anteriormente, omitiendo ejecución duplicada");
      return;
    }

    const ensureWorkspace = async () => {
      try {
        console.log("[WorkspaceEnsure] Iniciando verificación de workspace...");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log("[WorkspaceEnsure] Usuario obtenido:", user ? { id: user.id, email: user.email } : "null");
        
        if (user) {
          // Verificar si el usuario ya tiene un workspace
          console.log("[WorkspaceEnsure] Verificando membresías existentes...");
          const { data: existingMembership, error: checkError } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (checkError) {
            console.error("[WorkspaceEnsure] Error verificando membresías:", checkError);
          }

          console.log("[WorkspaceEnsure] Resultado de verificación:", existingMembership);

          // Si no tiene workspace, crearlo automáticamente
          if (!existingMembership) {
            console.log("[WorkspaceEnsure] No se encontró workspace, creando uno nuevo...");
            const workspaceId = await ensureUserWorkspace(supabase, user.id, user.email);
            console.log("[WorkspaceEnsure] Resultado de ensureUserWorkspace:", workspaceId);
          } else {
            console.log("[WorkspaceEnsure] Usuario ya tiene workspace:", existingMembership.workspace_id);
          }
        } else {
          console.warn("[WorkspaceEnsure] No se pudo obtener el usuario");
        }
      } catch (error) {
        // Silenciosamente fallar - no queremos interrumpir la experiencia del usuario
        console.error("[WorkspaceEnsure] Error asegurando workspace:", error);
        console.error("[WorkspaceEnsure] Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      } finally {
        hasRunRef.current = true;
      }
    };

    ensureWorkspace();
  }, []);

  // Este componente no renderiza nada
  return null;
}

