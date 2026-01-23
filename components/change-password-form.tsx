"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { createClient } from "@/lib/supabase/client";
import { KeyRound } from "lucide-react";
import { createActivity } from "@/lib/supabase/activities";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    // Validaciones
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Por favor, completa todos los campos");
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

      // Registrar actividad de cambio de contraseña
      try {
        await createActivity(supabase, {
          type: 'UPDATE',
          description: `Cambió su contraseña`,
          entity_type: 'user',
          entity_id: userData.user.id,
        });
      } catch (activityError) {
        console.error("[ChangePasswordForm] Error registrando actividad:", activityError);
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Error al actualizar la contraseña");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {/* Current Password Field */}
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <div className="relative">
          <Input
            id="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Ingresa tu contraseña actual"
            required
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground"
          >
            {showCurrentPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {/* New Password Field */}
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Ingresa tu nueva contraseña"
            required
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground"
          >
            {showNewPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Vuelve a ingresar tu nueva contraseña"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground hover:text-foreground"
          >
            {showConfirmPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
          La contraseña se ha actualizado correctamente.
        </div>
      )}

      {/* Update Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Actualizando..." : "Actualizar contraseña"}
        </Button>
      </div>
    </form>
  );
}

