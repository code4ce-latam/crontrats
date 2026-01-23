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
import { User, Mail } from "lucide-react";
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

  const canEditRole = currentUserRole === 'OWNER';

  return (
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
  );
}

