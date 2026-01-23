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
import { Mail, Lock, Eye, EyeOff, ArrowRight, FileText, LogOut } from "lucide-react";

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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const router = useRouter();

  // Verificar si hay una sesión activa al cargar
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setHasActiveSession(true);
        setError("Ya tienes una sesión activa. Por favor, cierra sesión primero si deseas crear una nueva cuenta.");
      }
      setIsCheckingSession(false);
    };

    checkSession();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setHasActiveSession(false);
    setError(null);
    router.refresh();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    // Verificar si hay sesión activa antes de registrar
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setError("Ya tienes una sesión activa. Por favor, cierra sesión primero si deseas crear una nueva cuenta.");
      setIsLoading(false);
      return;
    }

    if (password !== repeatPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    try {
      // Asegurarse de que no hay sesión activa antes de registrar
      await supabase.auth.signOut();
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/protected`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al crear la cuenta");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
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
      setError(error instanceof Error ? error.message : "Error al registrarse con Google");
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
            Crear Cuenta
          </h1>
          <p className="text-sm text-gray-500">
            Complete el formulario para registrarse en la plataforma
          </p>
        </div>

        {/* Mensaje de verificación de sesión */}
        {isCheckingSession && (
          <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              Verificando sesión...
            </p>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSignUp} className="space-y-3">
          {/* Campo Email */}
          <div className="space-y-1 group">
            <Label htmlFor="email" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600 text-sm">
              Email
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-blue-500" />
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
            <Label htmlFor="password" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600 text-sm">
              Contraseña
            </Label>
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

          {/* Campo Confirmar Contraseña */}
          <div className="space-y-1 group">
            <Label htmlFor="repeat-password" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600 text-sm">
              Confirmar Contraseña
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="repeat-password"
                type={showRepeatPassword ? "text" : "password"}
                placeholder="Confirme su contraseña"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="pl-9 pr-9 h-10 bg-gray-50/50 border-gray-200 focus:bg-white text-sm"
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showRepeatPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error o mensaje de sesión activa */}
          {error && (
            <div className="space-y-2">
              <p className="text-xs text-red-500 bg-red-50 p-2 rounded-md">
                {error}
              </p>
              {hasActiveSession && (
                <Button
                  type="button"
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full h-9 flex items-center justify-center gap-2 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión Actual
                </Button>
              )}
            </div>
          )}

          {/* Botón de Registro */}
          <Button
            type="submit"
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading || isLoadingGoogle || hasActiveSession}
          >
            {isLoading ? (
              "Creando cuenta..."
            ) : (
              <>
                Crear Cuenta
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
          onClick={handleGoogleSignUp}
          variant="outline"
          className="w-full h-10 border-2 border-gray-200 hover:border-gray-300 bg-white text-gray-700 text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          disabled={isLoading || isLoadingGoogle || hasActiveSession}
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

        {/* Enlace a Login */}
        <div className="mt-4 text-center text-xs">
          <p className="text-gray-600">
            ¿Ya tienes una cuenta?{" "}
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4 transition-colors"
            >
              Iniciar Sesión
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
