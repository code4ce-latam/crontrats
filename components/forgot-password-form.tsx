// Requiere "use client" porque usa hooks de React (useState)
// y maneja estado local del formulario con interacciones del usuario
"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Mail, ArrowRight, FileText, CheckCircle2, ArrowLeft } from "lucide-react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar si hay un error en la URL (por ejemplo, sesión expirada)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");
      if (urlError === "session_expired") {
        setError("El enlace de recuperación ha expirado. Por favor, solicita uno nuevo.");
      }
    }
  }, []);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      // Para recovery, Supabase incluye el token en el hash de la URL (#access_token=...)
      // El cliente de Supabase procesará automáticamente este hash cuando se cargue la página
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al enviar el email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-md", className)} {...props}>
      <div className="bg-white rounded-2xl shadow-xl p-8">
        {/* Logo y Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">CODE4CE</h2>
            <p className="text-sm text-gray-500 font-medium">Management Platform</p>
          </div>
        </div>

        {success ? (
          <>
            {/* Estado de éxito */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-fadeIn">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight animate-fadeIn">
                Revisa tu Email
              </h1>
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
                <Mail className="w-5 h-5 text-blue-600" />
                <p className="text-lg font-medium">Instrucciones enviadas</p>
              </div>
              <p className="text-gray-500 leading-relaxed">
                Te hemos enviado un enlace para restablecer tu contraseña. Por favor,
                revisa tu bandeja de entrada y sigue las instrucciones del email.
              </p>
            </div>

            {/* Información adicional */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Si no encuentras el email, revisa tu carpeta de
                spam o correo no deseado.
              </p>
            </div>

            {/* Botón para volver al login */}
            <Button
              asChild
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Link href="/auth/login">
                <ArrowLeft className="w-5 h-5" />
                Volver a Iniciar Sesión
              </Link>
            </Button>
          </>
        ) : (
          <>
            {/* Título e Instrucciones */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                Recuperar Contraseña
              </h1>
              <p className="text-gray-500">
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleForgotPassword} className="space-y-6">
              {/* Campo Email */}
              <div className="space-y-2 group">
                <Label htmlFor="email" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
                  Email
                </Label>
                <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ingrese su email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                  {error}
                </p>
              )}

              {/* Botón de Enviar */}
              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Enviando..."
                ) : (
                  <>
                    Enviar Enlace de Recuperación
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Enlace a Login */}
            <div className="mt-6 text-center text-sm">
              <p className="text-gray-600">
                ¿Recordaste tu contraseña?{" "}
                <Link
                  href="/auth/login"
                  className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4 transition-colors"
                >
                  Iniciar Sesión
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
