"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Componente que limpia automáticamente avatares guardados como base64
 * en user_metadata para evitar cookies demasiado grandes
 */
export function AvatarCleanup() {
  const router = useRouter();

  useEffect(() => {
    async function cleanupAvatar() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        // Limpiar localStorage de avatares antiguos
        if (typeof window !== "undefined") {
          try {
            // Eliminar cualquier avatar guardado en localStorage
            localStorage.removeItem(`avatar_${user.id}`);
            // También eliminar cualquier otro formato que pueda existir
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('avatar_')) {
                localStorage.removeItem(key);
              }
            });
          } catch (err) {
            console.warn("Error limpiando localStorage:", err);
          }
        }

        const avatarUrl = user.user_metadata?.avatar_url;

        // Si hay CUALQUIER avatar_url en user_metadata, eliminarlo
        // El avatar ahora se guarda en la tabla profiles, no en user_metadata
        // Esto previene que se cargue en las cookies
        if (avatarUrl) {
          // Verificar si existe en la tabla profiles antes de eliminar
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('user_id', user.id)
            .single();

          // Si no existe en profiles pero sí en user_metadata, migrar a profiles
          // Solo si es una URL válida (no base64 ni local:)
          if (!profile?.avatar_url && avatarUrl && 
              !avatarUrl.startsWith("data:image") && 
              !avatarUrl.startsWith("local:") &&
              avatarUrl.length < 1000) {
            // Insertar o actualizar en profiles solo si es una URL válida de storage
            const { error: upsertError } = await supabase
              .from('profiles')
              .upsert({ 
                user_id: user.id, 
                avatar_url: avatarUrl 
              }, {
                onConflict: 'user_id'
              });

            if (upsertError) {
              console.error("Error migrando avatar a profiles:", upsertError);
            }
          }

          // Eliminar avatar_url de user_metadata en cualquier caso
          // Esto previene que se cargue en las cookies del JWT
          const { error } = await supabase.auth.updateUser({
            data: {
              avatar_url: null, // Eliminar de user_metadata siempre
            },
          });

          if (!error) {
            console.log("Avatar limpiado de user_metadata exitosamente");
            // Refrescar la sesión para generar un nuevo JWT sin avatar_url
            await supabase.auth.refreshSession();
            // Refrescar la página para actualizar la sesión
            router.refresh();
          }
        }
      } catch (error) {
        console.error("Error en cleanup de avatar:", error);
      }
    }

    // Ejecutar cleanup inmediatamente para evitar que las cookies se llenen
    // No usar timeout, ejecutar de inmediato
    cleanupAvatar();
  }, [router]);

  return null; // Este componente no renderiza nada
}

