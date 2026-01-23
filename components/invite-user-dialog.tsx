"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { createWorkspaceInvitation } from "@/lib/supabase/invitations";
import { Mail, User, UserPlus } from "lucide-react";
import { useEffect } from "react";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"EDITOR" | "READER">("READER");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Obtener el email del usuario actual
  useEffect(() => {
    async function getCurrentUserEmail() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentUserEmail(user.email.toLowerCase().trim());
      }
    }
    getCurrentUserEmail();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones
    if (!email || !email.trim()) {
      setError("El email es requerido");
      setIsLoading(false);
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("El email no tiene un formato válido");
      setIsLoading(false);
      return;
    }

    // Validar que el usuario no se invite a sí mismo
    const inviteEmailNormalized = email.trim().toLowerCase();
    if (currentUserEmail && currentUserEmail === inviteEmailNormalized) {
      setError("No puedes enviarte una invitación a ti mismo");
      setIsLoading(false);
      return;
    }

    // Validar longitud de nombre y apellido
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
      const supabase = createClient();

      const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

      // Primero intentar enviar el correo (esto creará la invitación solo si el correo se envía exitosamente)
      const response = await fetch("/api/invitations/create-and-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          displayName,
          role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || "Error al crear y enviar la invitación";
        
        // Mostrar mensaje más descriptivo si es un error de dominio no verificado
        if (errorMessage.includes("verify a domain") || errorMessage.includes("testing emails")) {
          throw new Error(
            "No se puede enviar el correo porque el dominio no está verificado en Resend. " +
            "Por favor, verifica un dominio en https://resend.com/domains y configura RESEND_FROM_EMAIL en las variables de entorno."
          );
        }
        
        throw new Error(errorMessage);
      }

      // Limpiar el formulario
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("READER");

      // Cerrar el diálogo
      onOpenChange(false);

      // Llamar callback de éxito
      if (onSuccess) {
        onSuccess();
      }

      // Refrescar la página para actualizar la lista
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al invitar al usuario");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("READER");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invitar Usuario</DialogTitle>
          <DialogDescription>
            Invita a un nuevo usuario a tu workspace
          </DialogDescription>
        </DialogHeader>

        {/* Leyendas en español en la parte superior */}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Ingresa los detalles</h3>
            <p className="text-sm text-muted-foreground">
              Ingresa el email del usuario que deseas invitar. Opcionalmente puedes agregar su nombre y apellido. 
              Se enviará un correo electrónico para crear la cuenta. La cuenta se crea cuando el usuario acepta la invitación.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Acceso Global</h3>
            <p className="text-sm text-muted-foreground">
              Esta sección es para establecer los permisos de acceso del usuario invitado. 
              Selecciona el rol que tendrá el usuario en el workspace.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                required
                className="pl-10"
                disabled={isLoading}
              />
            </div>
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

          {/* Rol */}
          <div className="space-y-2">
            <Label htmlFor="role">
              Rol <span className="text-destructive">*</span>
            </Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "EDITOR" | "READER")}
              className="flex h-9 w-full rounded-md border border-gray-200 bg-transparent px-3 py-1 text-base shadow-sm transition-all duration-200 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm hover:border-blue-300"
              required
              disabled={isLoading}
            >
              <option value="READER">Lector</option>
              <option value="EDITOR">Editor</option>
            </select>
          </div>

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
              {isLoading ? (
                <>
                  <span className="mr-2">Enviando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invitar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

