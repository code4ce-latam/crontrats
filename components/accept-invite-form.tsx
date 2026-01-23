"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Mail, Lock, Eye, EyeOff, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface AcceptInviteFormProps {
  token: string;
  inviteEmail: string;
  inviteDisplayName: string | null;
}

export function AcceptInviteForm({ token, inviteEmail, inviteDisplayName }: AcceptInviteFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    if (password !== repeatPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear la cuenta");
      }

      // Redirigir al login con mensaje de éxito
      router.push("/auth/login?message=Cuenta creada exitosamente. Ya puedes iniciar sesión.");
    } catch (err: any) {
      setError(err.message || "Error al crear la cuenta");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-md")}>
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
        {/* Logo y Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">CODE4CE</h2>
            <p className="text-xs text-gray-500 font-medium">Management Platform</p>
          </div>
        </div>

        {/* Título e Instrucciones */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
            Crear tu Cuenta
          </h1>
          <p className="text-gray-500">
            {inviteDisplayName ? (
              <>
                Hola <strong>{inviteDisplayName}</strong>, has sido invitado a unirte al workspace.
              </>
            ) : (
              <>Has sido invitado a unirte al workspace.</>
            )}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Email: <span className="font-medium">{inviteEmail}</span>
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Contraseña */}
          <div className="space-y-2 group">
            <Label htmlFor="password" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
              Contraseña
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Ingrese su contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
          </div>

          {/* Campo Confirmar Contraseña */}
          <div className="space-y-2 group">
            <Label htmlFor="repeat-password" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
              Confirmar Contraseña
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="repeat-password"
                type={showRepeatPassword ? "text" : "password"}
                placeholder="Confirme su contraseña"
                required
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showRepeatPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Botón de envío */}
          <Button
            type="submit"
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-600/20 transition-all duration-200 hover:shadow-xl hover:shadow-blue-600/30"
            disabled={isLoading}
          >
            {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
          </Button>
        </form>
      </div>
    </div>
  );
}

