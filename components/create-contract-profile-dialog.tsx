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
import { FileText } from "lucide-react";

interface CreateContractProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateContractProfileDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateContractProfileDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones
    if (!name || !name.trim()) {
      setError("El nombre es requerido");
      setIsLoading(false);
      return;
    }

    if (name.length > 255) {
      setError("El nombre no puede exceder 255 caracteres");
      setIsLoading(false);
      return;
    }

    if (description && description.length > 1000) {
      setError("La descripción no puede exceder 1000 caracteres");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/contract-profiles/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al crear el perfil");
      }

      // Limpiar el formulario
      setName("");
      setDescription("");

      // Cerrar el diálogo
      onOpenChange(false);

      // Llamar callback de éxito
      if (onSuccess) {
        onSuccess();
      }

      // Refrescar la página para actualizar la lista
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al crear el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setName("");
      setDescription("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Perfil de Contrato</DialogTitle>
          <DialogDescription>
            Crea un nuevo perfil de contrato para tu workspace
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Servicios, Arriendo"
                required
                maxLength={255}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nombre único del perfil (máx. 255 caracteres)
            </p>
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Descripción <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del perfil de contrato"
              maxLength={1000}
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Descripción opcional del perfil (máx. 1000 caracteres)
            </p>
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
              {isLoading ? "Creando..." : "Crear Perfil"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

