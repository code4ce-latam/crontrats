import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    redirect("/auth/login");
  }

  // Obtener el rol del usuario en el workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single();

  const role = membership?.role;

  // Redirigir a la primera opción disponible según el rol
  // OWNER tiene acceso a todas las opciones, empezamos con Usuarios
  if (role === 'OWNER') {
    redirect("/protected/configuracion/usuarios");
  }
  
  // EDITOR tiene acceso a Perfiles, Recordatorios, Flujos, Estado
  // Redirigir a Perfiles como primera opción
  if (role === 'EDITOR') {
    redirect("/protected/configuracion/perfiles");
  }

  // READER no debería tener acceso a configuración, pero por si acaso redirigir a inicio
  redirect("/protected");
}

