// Requiere "use client" porque usa hooks de React (useRouter)
// y maneja eventos onClick del botón
"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button onClick={logout} variant="outline" size="sm">
      Cerrar sesión
    </Button>
  );
}
