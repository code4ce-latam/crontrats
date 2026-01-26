"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { createActivity } from "@/lib/supabase/activities";

interface UserAvatarMenuProps {
  avatarUrl?: string | null;
  displayName: string;
  firstLetter: string;
}

// Función para obtener la URL del avatar (solo storage)
async function getAvatarUrl(avatarUrl: string | null | undefined): Promise<string | null> {
  if (!avatarUrl) return null;
  
  // Retornar la URL directamente (siempre será una URL de storage)
  return avatarUrl;
}

export function UserAvatarMenu({
  avatarUrl,
  displayName,
  firstLetter,
}: UserAvatarMenuProps) {
  const router = useRouter();
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (avatarUrl) {
      // La URL siempre será de storage ahora, no hay localStorage
      getAvatarUrl(avatarUrl).then((url) => {
        setResolvedAvatarUrl(url);
      });
    } else {
      setResolvedAvatarUrl(null);
    }
  }, [avatarUrl]);

  // Verificar si el usuario es OWNER
  useEffect(() => {
    async function checkUserRole() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: membership } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('status', 'ACTIVE')
            .maybeSingle();
          
          setIsOwner(membership?.role === 'OWNER');
        }
      } catch (error) {
        console.error("[UserAvatarMenu] Error verificando rol:", error);
        setIsOwner(false);
      }
    }
    checkUserRole();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    
    // Registrar actividad de logout antes de cerrar sesión
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createActivity(supabase, {
          type: 'LOGOUT',
          description: `Cerró sesión en la plataforma`,
          entity_type: 'user',
          entity_id: user.id,
        });
      }
    } catch (error) {
      console.error("[UserAvatarMenu] Error registrando actividad de logout:", error);
    }
    
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full"
        >
          {resolvedAvatarUrl ? (
            <img
              key={resolvedAvatarUrl}
              src={resolvedAvatarUrl}
              alt={displayName}
              className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity"
            />
          ) : (
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm md:text-base border border-border cursor-pointer hover:opacity-80 transition-opacity">
              {firstLetter}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/protected/perfil" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </Link>
        </DropdownMenuItem>
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/protected/configuracion-cuenta" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración de la cuenta</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

