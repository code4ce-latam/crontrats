import { createClient } from "@supabase/supabase-js";

/**
 * Crea un cliente de Supabase con permisos de administrador (service role key)
 * ⚠️ SOLO usar en server-side (API routes, Server Actions, etc.)
 * NUNCA exponer la service role key en el cliente
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configuradas"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

