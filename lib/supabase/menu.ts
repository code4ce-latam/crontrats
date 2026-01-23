import { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "OWNER" | "EDITOR" | "READER";

/**
 * Obtiene el rol del usuario actual desde workspace_members
 * @param supabase - Cliente de Supabase
 * @returns El rol del usuario o null si no se encuentra
 */
export async function getUserRole(
  supabase: SupabaseClient
): Promise<UserRole | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    // Obtener el rol del usuario desde workspace_members
    const { data: membership, error } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .single();

    if (error || !membership) {
      console.error("[Menu] Error obteniendo rol del usuario:", error);
      return null;
    }

    const role = membership.role as UserRole;
    
    // Validar que el rol sea uno de los valores esperados
    if (role === "OWNER" || role === "EDITOR" || role === "READER") {
      return role;
    }

    console.warn("[Menu] Rol no reconocido:", role);
    return null;
  } catch (error) {
    console.error("[Menu] Error inesperado obteniendo rol:", error);
    return null;
  }
}

