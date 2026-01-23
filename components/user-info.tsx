import { createClient } from "@/lib/supabase/server";
import { Bell } from "lucide-react";
import { UserAvatarMenu } from "./user-avatar-menu";

export async function UserInfo() {
  try {
    const supabase = await createClient();
    
    // Primero intentar con getClaims (más rápido)
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;

    let email = "";
    let displayName = "";
    let avatarUrl = null;

    if (claims?.email) {
      // Si hay claims, obtener el email
      email = claims.email;
      
      // Intentar obtener usuario completo para metadatos
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (user) {
        displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          email.split("@")[0] ||
          "Usuario";
        
        // Obtener avatar_url de la tabla profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', user.id)
          .single();
        
        avatarUrl = profile?.avatar_url || null;
      } else {
        displayName = email.split("@")[0] || "Usuario";
      }
    } else {
      // Si no hay claims, intentar con getUser
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        // Si no hay usuario, no mostrar nada
        return null;
      }

      email = user.email || "";
      displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        email.split("@")[0] ||
        "Usuario";
      
      // Obtener avatar_url de la tabla profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .single();
      
      avatarUrl = profile?.avatar_url || null;
    }

    // Si no hay email, no hay usuario autenticado
    if (!email) {
      return null;
    }

    const firstLetter = displayName.charAt(0).toUpperCase();

    return (
      <div className="flex items-center gap-2 md:gap-4">
        {/* Ícono de notificaciones */}
        <button
          type="button"
          className="relative p-2 hover:bg-accent rounded-full transition-colors flex-shrink-0"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5 text-foreground" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Nombre del usuario */}
        <span className="text-xs md:text-sm font-semibold text-foreground whitespace-nowrap hidden sm:inline">
          {displayName}
        </span>

        {/* Avatar con menú dropdown */}
        <UserAvatarMenu
          avatarUrl={avatarUrl}
          displayName={displayName}
          firstLetter={firstLetter}
        />
      </div>
    );
  } catch (error) {
    // Si hay un error, no mostrar nada
    console.error("Error obteniendo información del usuario:", error);
    return null;
  }
}

