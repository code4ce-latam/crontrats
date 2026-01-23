"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Folder } from "lucide-react";
import { type FolderTreeItem } from "@/lib/supabase/folders";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  workspaceId: string;
  onSuccess?: () => void;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentId,
  workspaceId,
  onSuccess,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string | null>(null);

  useEffect(() => {
    if (open && parentId) {
      // Obtener nombre del padre
      fetch(`/api/folders/tree?workspace_id=${workspaceId}`)
        .then(res => res.json())
        .then(data => {
          const findFolder = (items: FolderTreeItem[]): FolderTreeItem | null => {
            for (const item of items) {
              if (item.id === parentId) return item;
              if (item.children) {
                const found = findFolder(item.children);
                if (found) return found;
              }
            }
            return null;
          };
          const found = findFolder(data.tree || []);
          if (found) {
            setParentName(found.name);
          }
        })
        .catch(() => setParentName(null));
    } else {
      setParentName(null);
    }
  }, [open, parentId, workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!name || !name.trim()) {
      setError("El nombre es requerido");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/folders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          parent_id: parentId,
          name: name.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al crear la carpeta");
      }

      setName("");
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Error al crear la carpeta");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {parentId ? "Crear Subcarpeta" : "Crear Carpeta Raíz"}
          </DialogTitle>
          <DialogDescription>
            {parentId 
              ? `Crea una nueva subcarpeta dentro de "${parentName || 'la carpeta seleccionada'}"`
              : "Crea una nueva carpeta raíz en tu workspace"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Legal, RRHH, Compras"
                required
                className="pl-10"
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

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
              {isLoading ? "Creando..." : "Crear Carpeta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

