import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Para recovery, Supabase puede enviar los parámetros en el hash o en query params
  // Intentamos ambos métodos
  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // El workspace se creará automáticamente cuando el usuario acceda a /protected
      // a través del componente WorkspaceEnsure o desde el callback de OAuth
      // No creamos el workspace aquí para evitar duplicados
      console.log("[Auth/Confirm] Email verificado exitosamente. El workspace se creará automáticamente al acceder a páginas protegidas.");

      // redirect user to specified redirect URL or root of app
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${encodeURIComponent(error?.message || "Error al verificar el token")}`);
    }
  }

  // Si no hay token_hash o type en query params, puede que estén en el hash
  // En ese caso, redirigimos a update-password y dejamos que el cliente maneje el hash
  // Supabase manejará automáticamente el token del hash cuando se cargue la página
  if (next.includes("update-password")) {
    redirect("/auth/update-password");
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=${encodeURIComponent("No se encontró el token de verificación. Por favor, usa el enlace del email.")}`);
}
