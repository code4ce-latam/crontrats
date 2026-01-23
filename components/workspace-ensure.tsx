"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Componente que asegura que el usuario tenga un workspace.
 * Se ejecuta automáticamente cuando el usuario accede a páginas protegidas.
 * Llama a una API route del servidor para crear el workspace de forma segura.
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
        
        if (!user) {
          console.warn("[WorkspaceEnsure] No se pudo obtener el usuario");
          return;
        }

        // Verificar si el usuario ya tiene un workspace (verificación rápida en el cliente)
        const { data: existingMembership, error: checkError } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .limit(1)
          .maybeSingle();

        if (checkError) {
          console.error("[WorkspaceEnsure] Error verificando membresías:", checkError);
          // Continuar intentando crear el workspace a través de la API
        }

        console.log("[WorkspaceEnsure] Resultado de verificación:", existingMembership);

        // Si no tiene workspace, llamar a la API route del servidor para crearlo
        if (!existingMembership) {
          console.log("[WorkspaceEnsure] No se encontró workspace, llamando a API para crear uno nuevo...");
          
          const response = await fetch('/api/workspace/ensure', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();

          if (response.ok) {
            console.log("[WorkspaceEnsure] Workspace creado/verificado exitosamente:", data.workspace_id);
          } else {
            console.error("[WorkspaceEnsure] Error creando workspace:", data.error);
          }
        } else {
          console.log("[WorkspaceEnsure] Usuario ya tiene workspace:", existingMembership.workspace_id);
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

