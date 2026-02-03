// Requiere "use client" porque usa hooks de React (useState)
// y maneja estado local del formulario con interacciones del usuario
"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // Limpiar campos y estado al montar el componente
  useEffect(() => {
    setEmail("");
    setError(null);
    setSuccess(false);
    setIsLoading(false);

    // Verificar si hay un error en la URL (por ejemplo, sesión expirada)
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
    console.log("[ForgotPasswordForm] ===== INICIO handleForgotPassword =====");
    console.log("[ForgotPasswordForm] Email:", email);
    setIsLoading(true);
    setError(null);

    try {
      const url = "/api/users/send-temporary-password";
      const bodyData = {
        email: email.trim(),
      };
      
      console.log("[ForgotPasswordForm] Preparando fetch:", {
        url,
        method: "POST",
        body: bodyData,
      });
      
      console.log("[ForgotPasswordForm] Ejecutando fetch ahora...");
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      console.log("[ForgotPasswordForm] ===== Fetch completado =====");
      console.log("[ForgotPasswordForm] Response status:", response.status);
      console.log("[ForgotPasswordForm] Response statusText:", response.statusText);
      console.log("[ForgotPasswordForm] Response headers:", Object.fromEntries(response.headers.entries()));

      console.log("[ForgotPasswordForm] Respuesta recibida:", {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        ok: response.ok,
      });

      // Verificar el Content-Type antes de parsear JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("[ForgotPasswordForm] Respuesta no es JSON:", text.substring(0, 500));
        throw new Error("El servidor devolvió una respuesta inesperada. Por favor, revisa la consola del navegador para más detalles.");
      }

      const data = await response.json();
      console.log("[ForgotPasswordForm] Datos recibidos:", data);

      if (!response.ok) {
        const errorMessage = data.error || data.message || "Error al enviar la contraseña temporal";
        console.error("[ForgotPasswordForm] Error en respuesta:", errorMessage);
        throw new Error(errorMessage);
      }

      console.log("[ForgotPasswordForm] Éxito, estableciendo estado de éxito");
      // Limpiar el email después de éxito
      setEmail("");
      setSuccess(true);
    } catch (error: unknown) {
      console.error("[ForgotPasswordForm] Error capturado:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Error al enviar la contraseña temporal. Por favor, intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
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

        {success ? (
          <>
            {/* Estado de éxito */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-fadeIn">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
            </div>

            <div className="mb-4 text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight animate-fadeIn">
                Revisa tu Email
              </h1>
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-3">
                <Mail className="w-4 h-4 text-blue-600" />
                <p className="text-base font-medium">Instrucciones enviadas</p>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Te hemos enviado una contraseña temporal por correo. Por favor,
                revisa tu bandeja de entrada y usa esa contraseña para iniciar sesión.
              </p>
            </div>

            {/* Información adicional */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-800">
                <strong>Importante:</strong> Por seguridad, te recomendamos cambiar la contraseña temporal después de iniciar sesión. Si no encuentras el email, revisa tu carpeta de spam o correo no deseado.
              </p>
            </div>

            {/* Botón para volver al login */}
            <Button
              onClick={() => {
                setSuccess(false);
                setEmail("");
                setError(null);
                router.push("/auth/login");
              }}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Iniciar Sesión
            </Button>
          </>
        ) : (
          <>
            {/* Título e Instrucciones */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">
                Recuperar Contraseña
              </h1>
              <p className="text-sm text-gray-500">
                Ingresa tu email y te enviaremos una contraseña temporal para restablecer tu acceso
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleForgotPassword} className="space-y-3">
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

              {/* Error */}
              {error && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded-md">
                  {error}
                </p>
              )}

              {/* Botón de Enviar */}
              <Button
                type="submit"
                className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Enviando..."
                ) : (
                  <>
                    Enviar Contraseña Temporal
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Enlace a Login */}
            <div className="mt-4 text-center text-xs">
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
