"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { User, Mail, Key } from "lucide-react";
import { type WorkspaceUser, type UserRole } from "@/lib/supabase/users";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: WorkspaceUser;
  onSuccess?: () => void;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EditUserDialogProps) {
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [lastName, setLastName] = useState(user.last_name || "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);
  const [showTemporaryPasswordDialog, setShowTemporaryPasswordDialog] = useState(false);
  const [temporaryPasswordLoading, setTemporaryPasswordLoading] = useState(false);
  const [temporaryPasswordError, setTemporaryPasswordError] = useState<string | null>(null);
  const [temporaryPasswordSuccess, setTemporaryPasswordSuccess] = useState(false);

  // Actualizar estado cuando cambia el usuario
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setRole(user.role);
      setError(null);
    }
  }, [user]);

  // Obtener el rol del usuario actual
  useEffect(() => {
    async function getCurrentUserRole() {
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', currentUser.id)
          .eq('status', 'ACTIVE')
          .single();

        if (membership) {
          setCurrentUserRole(membership.role as UserRole);
        }
      }
    }
    if (open) {
      getCurrentUserRole();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones
    if (firstName && firstName.length > 100) {
      setError("El nombre no puede exceder 100 caracteres");
      setIsLoading(false);
      return;
    }

    if (lastName && lastName.length > 100) {
      setError("El apellido no puede exceder 100 caracteres");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/users/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.user_id,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          role: role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al actualizar el usuario");
      }

      // Cerrar el diálogo
      onOpenChange(false);

      // Llamar callback de éxito
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Error al actualizar el usuario");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setRole(user.role);
      onOpenChange(false);
    }
  };

  const handleResetPassword = async () => {
    setResetPasswordLoading(true);
    setResetPasswordError(null);
    setResetPasswordSuccess(false);

    try {
      const response = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.user_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar el enlace de restablecimiento");
      }

      setResetPasswordSuccess(true);
      
      // Cerrar el diálogo de confirmación después de 2 segundos
      setTimeout(() => {
        setShowResetPasswordDialog(false);
        setResetPasswordSuccess(false);
      }, 2000);
    } catch (err: any) {
      setResetPasswordError(err.message || "Error al enviar el enlace de restablecimiento");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleSendTemporaryPassword = async () => {
    setTemporaryPasswordLoading(true);
    setTemporaryPasswordError(null);
    setTemporaryPasswordSuccess(false);

    try {
      const response = await fetch("/api/users/send-temporary-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al enviar la contraseña temporal");
      }

      setTemporaryPasswordSuccess(true);
      
      // Cerrar el diálogo de confirmación después de 2 segundos
      setTimeout(() => {
        setShowTemporaryPasswordDialog(false);
        setTemporaryPasswordSuccess(false);
      }, 2000);
    } catch (err: any) {
      setTemporaryPasswordError(err.message || "Error al enviar la contraseña temporal");
    } finally {
      setTemporaryPasswordLoading(false);
    }
  };

  const canEditRole = currentUserRole === 'OWNER';
  const canResetPassword = currentUserRole === 'OWNER' || currentUserRole === 'EDITOR';

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Actualiza la información del usuario
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (solo lectura) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={user.email || ''}
                disabled
                className="pl-10 bg-muted cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              El email no se puede modificar
            </p>
          </div>

          {/* Nombre y Apellido en fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                Nombre <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ingresa el nombre"
                  maxLength={100}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">
                Apellido <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ingresa el apellido"
                  maxLength={100}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Rol (solo si el usuario actual es OWNER) */}
          {canEditRole && (
            <div className="space-y-2">
              <Label htmlFor="role">
                Rol <span className="text-destructive">*</span>
              </Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="flex h-9 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-base shadow-sm transition-all duration-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-blue-300"
                required
                disabled={isLoading}
              >
                <option value="OWNER">Propietario</option>
                <option value="EDITOR">Editor</option>
                <option value="READER">Lector</option>
              </select>
            </div>
          )}

          {/* Botones de contraseña */}
          {canResetPassword && (
            <div className="space-y-3 pt-2 border-t">
              <Label>Contraseña</Label>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetPasswordDialog(true)}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Enviar enlace para restablecer contraseña
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTemporaryPasswordDialog(true)}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Enviar contraseña temporal
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Se enviará un enlace al email del usuario para que pueda establecer una nueva contraseña, o una contraseña temporal que deberá cambiar en el primer inicio de sesión
              </p>
            </div>
          )}

          {/* Mensaje de error */}
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Diálogo de confirmación para resetear contraseña */}
    <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Restablecer Contraseña</DialogTitle>
          <DialogDescription>
            Se enviará un enlace al email del usuario para que pueda establecer una nueva contraseña
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">Usuario:</p>
            <p className="text-sm text-muted-foreground">{user.email || user.display_name || 'Usuario'}</p>
          </div>

          {resetPasswordSuccess && (
            <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
              ✓ Enlace de restablecimiento enviado exitosamente al email del usuario
            </div>
          )}

          {resetPasswordError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {resetPasswordError}
            </div>
          )}

          {!resetPasswordSuccess && (
            <p className="text-sm text-muted-foreground">
              El usuario recibirá un email con un enlace para restablecer su contraseña. El enlace expirará en 24 horas.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowResetPasswordDialog(false);
              setResetPasswordError(null);
              setResetPasswordSuccess(false);
            }}
            disabled={resetPasswordLoading}
          >
            {resetPasswordSuccess ? "Cerrar" : "Cancelar"}
          </Button>
          {!resetPasswordSuccess && (
            <Button
              type="button"
              onClick={handleResetPassword}
              disabled={resetPasswordLoading}
            >
              {resetPasswordLoading ? "Enviando..." : "Enviar Enlace"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Diálogo de confirmación para enviar contraseña temporal */}
    <Dialog open={showTemporaryPasswordDialog} onOpenChange={setShowTemporaryPasswordDialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Contraseña Temporal</DialogTitle>
          <DialogDescription>
            Se enviará una contraseña temporal al email del usuario. El usuario deberá cambiarla en el primer inicio de sesión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">Usuario:</p>
            <p className="text-sm text-muted-foreground">{user.email || user.display_name || 'Usuario'}</p>
          </div>

          {temporaryPasswordSuccess && (
            <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
              ✓ Contraseña temporal enviada exitosamente al email del usuario
            </div>
          )}

          {temporaryPasswordError && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {temporaryPasswordError}
            </div>
          )}

          {!temporaryPasswordSuccess && (
            <p className="text-sm text-muted-foreground">
              El usuario recibirá un email con una contraseña temporal. Deberá iniciar sesión con esta contraseña y cambiarla inmediatamente por seguridad.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowTemporaryPasswordDialog(false);
              setTemporaryPasswordError(null);
              setTemporaryPasswordSuccess(false);
            }}
            disabled={temporaryPasswordLoading}
          >
            {temporaryPasswordSuccess ? "Cerrar" : "Cancelar"}
          </Button>
          {!temporaryPasswordSuccess && (
            <Button
              type="button"
              onClick={handleSendTemporaryPassword}
              disabled={temporaryPasswordLoading}
            >
              {temporaryPasswordLoading ? "Enviando..." : "Enviar Contraseña Temporal"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

