// Requiere "use client" porque usa hooks de React (useState, useRouter)
// y maneja estado local del formulario con interacciones del usuario
"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, FileText, CheckCircle2 } from "lucide-react";
import { createActivity } from "@/lib/supabase/activities";

// Icono de Google SVG
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  // Verificar si hay un mensaje de éxito en la URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const message = params.get("message");
      if (message === "password_updated") {
        setSuccessMessage("Tu contraseña ha sido actualizada exitosamente. Por favor, inicia sesión con tu nueva contraseña.");
        // Limpiar la URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (message) {
        // Mostrar cualquier otro mensaje (como el de cuenta creada)
        setSuccessMessage(decodeURIComponent(message));
        // Limpiar la URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Limpiar avatar_url de user_metadata inmediatamente después del login
      // Esto previene que se cargue en las cookies
      try {
        const { data: { user } } = await supabase.auth.getUser();
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

        // Registrar actividad de login
        if (user) {
          await createActivity(supabase, {
            type: 'LOGIN',
            description: `Inició sesión en la plataforma`,
            entity_type: 'user',
            entity_id: user.id,
          });
        }
      } catch (cleanupError) {
        // Continuar aunque falle el cleanup
        console.error("Error en cleanup de avatar después del login:", cleanupError);
      }

      router.push("/protected");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    setIsLoadingGoogle(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/protected`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al iniciar sesión con Google");
      setIsLoadingGoogle(false);
    }
  };

  return (
    <div className={cn("w-full max-w-md", className)} {...props}>
      <div className="bg-white rounded-2xl shadow-xl p-5 md:p-6">
        {/* Logo y Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">CODE4CE</h2>
            <p className="text-xs text-gray-500 font-medium">Management Platform</p>
          </div>
        </div>

        {/* Título e Instrucciones */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">
            Iniciar Sesión
          </h1>
          <p className="text-sm text-gray-500">
            Ingrese sus credenciales para acceder a la plataforma
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-3">
          {/* Campo Email */}
          <div className="space-y-1 group">
            <Label htmlFor="email" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600 text-sm">
              Email
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="email"
                type="email"
                placeholder="Ingrese su email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white text-sm"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div className="space-y-1 group">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600 text-sm">
                Contraseña
              </Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Ingrese su contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Mensaje de éxito */}
          {successMessage && (
            <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-800">
                  {successMessage}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 p-2 rounded-md">
              {error}
            </p>
          )}

          {/* Botón de Login */}
          <Button
            type="submit"
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading || isLoadingGoogle}
          >
            {isLoading ? (
              "Iniciando sesión..."
            ) : (
              <>
                Iniciar Sesión
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Divisor */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300"></span>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-white px-2 text-gray-500">O continúa con</span>
          </div>
        </div>

        {/* Botón de Google */}
        <Button
          type="button"
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full h-10 border-2 border-gray-200 hover:border-gray-300 bg-white text-gray-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={isLoading || isLoadingGoogle}
        >
          {isLoadingGoogle ? (
            "Conectando..."
          ) : (
            <>
              <GoogleIcon />
              Google
            </>
          )}
        </Button>

        {/* Enlace a Sign Up */}
        <div className="mt-4 text-center text-xs">
          <p className="text-gray-600">
            ¿No tienes una cuenta?{" "}
            <Link
              href="/auth/sign-up"
              className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4 transition-colors"
            >
              Crear Cuenta
            </Link>
          </p>
        </div>

        {/* Copyright */}
        <div className="mt-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Code4ce. All rights reserved.
        </div>
      </div>
    </div>
  );
}
