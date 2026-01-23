"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { FileText } from "lucide-react";
import { type ContractProfile } from "@/lib/supabase/contract-profiles";

interface EditContractProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ContractProfile;
  onSuccess?: () => void;
}

export function EditContractProfileDialog({
  open,
  onOpenChange,
  profile,
  onSuccess,
}: EditContractProfileDialogProps) {
  const [name, setName] = useState(profile.name || "");
  const [description, setDescription] = useState(profile.description || "");
  const [isActive, setIsActive] = useState(profile.is_active);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Actualizar estado cuando cambia el perfil
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setDescription(profile.description || "");
      setIsActive(profile.is_active);
      setError(null);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validaciones
    if (!name || !name.trim()) {
      setError("El nombre no puede estar vacío");
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
      const response = await fetch("/api/contract-profiles/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: profile.id,
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al actualizar el perfil");
      }

      // Cerrar el diálogo
      onOpenChange(false);

      // Llamar callback de éxito
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Error al actualizar el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setName(profile.name || "");
      setDescription(profile.description || "");
      setIsActive(profile.is_active);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Perfil de Contrato</DialogTitle>
          <DialogDescription>
            Actualiza la información del perfil de contrato
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

          {/* Estado Activo */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
              disabled={isLoading}
            />
            <Label
              htmlFor="isActive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Perfil activo
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Los perfiles inactivos no estarán disponibles para nuevos contratos
          </p>

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

