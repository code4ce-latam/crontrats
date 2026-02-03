"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChangePasswordRequiredForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Limpiar campos al montar el componente
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setIsLoading(false);

    // Verificar que el usuario esté autenticado y tenga el flag de contraseña temporal
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/auth/login");
        return;
      }

      // Si no tiene el flag de contraseña temporal, redirigir a protected
      if (!user.user_metadata?.requires_password_change) {
        router.push("/protected");
        return;
      }
    };

    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones
    if (!currentPassword) {
      setError("La contraseña actual es requerida");
      setIsLoading(false);
      return;
    }

    if (!newPassword) {
      setError("La nueva contraseña es requerida");
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);
      return;
    }

    if (currentPassword === newPassword) {
      setError("La nueva contraseña debe ser diferente a la actual");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // Verificar la contraseña actual intentando iniciar sesión
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.email) {
        throw new Error("No se pudo obtener la información del usuario");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("La contraseña actual es incorrecta");
      }

      // Actualizar la contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Remover el flag de contraseña temporal de user_metadata
      const currentMetadata = userData.user.user_metadata || {};
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          requires_password_change: false,
          temporary_password_set_at: null,
        },
      });

      if (metadataError) {
        console.error("[ChangePasswordRequired] Error actualizando metadata:", metadataError);
        // No fallar si no se puede actualizar el metadata, la contraseña ya se cambió
      }

      // Obtener el email antes de cerrar sesión
      const userEmail = userData.user.email || "";

      // Limpiar campos antes de cerrar sesión
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);

      // Cerrar sesión después de cambiar la contraseña
      console.log("[ChangePasswordRequired] Cerrando sesión después de cambiar contraseña");
      await supabase.auth.signOut();

      // Redirigir a login después de cerrar sesión con el email y mensaje
      const loginUrl = `/auth/login?message=password_updated${userEmail ? `&email=${encodeURIComponent(userEmail)}` : ''}`;
      router.push(loginUrl);
    } catch (err: any) {
      setError(err.message || "Error al actualizar la contraseña");
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

        {/* Alerta de cambio obligatorio */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900 mb-1">
                Cambio de Contraseña Requerido
              </p>
              <p className="text-xs text-amber-800">
                Has iniciado sesión con una contraseña temporal. Por seguridad, debes cambiar tu contraseña antes de continuar.
              </p>
            </div>
          </div>
        </div>

        {/* Título e Instrucciones */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
            Cambiar Contraseña
          </h1>
          <p className="text-gray-500">
            Ingresa tu contraseña temporal actual y establece una nueva contraseña
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo Contraseña Actual */}
          <div className="space-y-2 group">
            <Label htmlFor="currentPassword" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
              Contraseña Temporal Actual
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Ingresa tu contraseña temporal"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Campo Nueva Contraseña */}
          <div className="space-y-2 group">
            <Label htmlFor="newPassword" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
              Nueva Contraseña
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Campo Confirmar Nueva Contraseña */}
          <div className="space-y-2 group">
            <Label htmlFor="confirmPassword" className="text-gray-700 font-medium transition-colors group-focus-within:text-blue-600">
              Confirmar Nueva Contraseña
            </Label>
            <div className="relative transition-transform duration-200 focus-within:scale-[1.01]">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repite tu nueva contraseña"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 h-12 bg-gray-50/50 border-gray-200 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Botón de Guardar */}
          <Button
            type="submit"
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? "Cambiando..." : "Cambiar Contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
}

