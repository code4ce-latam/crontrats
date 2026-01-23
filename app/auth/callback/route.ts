import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { ensureUserWorkspace } from "@/lib/supabase/workspace";
import { createActivity } from "@/lib/supabase/activities";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/protected";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Auto-crear workspace si el usuario no tiene uno (signup sin invitación)
          console.log("[Auth/Callback] Usuario obtenido después de exchangeCodeForSession:", { id: user.id, email: user.email });
          console.log("[Auth/Callback] Llamando a ensureUserWorkspace...");
          const workspaceId = await ensureUserWorkspace(supabase, user.id, user.email);
          console.log("[Auth/Callback] Resultado de ensureUserWorkspace:", workspaceId);

          // Limpiar avatar_url de user_metadata inmediatamente después del login
          // Esto previene que se cargue en las cookies
          if (user?.user_metadata?.avatar_url) {
            // Migrar a profiles si no existe
            const { data: profile } = await supabase
              .from('profiles')
              .select('avatar_url')
              .eq('user_id', user.id)
              .single();

            if (!profile?.avatar_url && user.user_metadata.avatar_url) {
              await supabase
                .from('profiles')
                .upsert({ 
                  user_id: user.id, 
                  avatar_url: user.user_metadata.avatar_url 
                }, {
                  onConflict: 'user_id'
                });
            }

            // Eliminar de user_metadata
            await supabase.auth.updateUser({
              data: {
                avatar_url: null,
              },
            });

            // Refrescar la sesión para generar un nuevo JWT sin avatar_url
            await supabase.auth.refreshSession();
          }

          // Registrar actividad de login (OAuth)
          try {
            await createActivity(supabase, {
              type: 'LOGIN',
              description: `Inició sesión con OAuth en la plataforma`,
              entity_type: 'user',
              entity_id: user.id,
            });
          } catch (activityError) {
            console.error("[Auth/Callback] Error registrando actividad:", activityError);
          }
        }
      } catch (cleanupError) {
        // Continuar aunque falle el cleanup
        console.error("Error en cleanup después del login:", cleanupError);
      }

      // Redirigir a la página protegida después de autenticación exitosa
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Si hay error o no hay código, redirigir al login con mensaje de error
  return NextResponse.redirect(
    new URL("/auth/login?error=oauth_error", requestUrl.origin)
  );
}

