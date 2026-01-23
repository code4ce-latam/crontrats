"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Users } from "lucide-react";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { FolderPermissionsDrawer } from "./folder-permissions-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface FolderActionsMenuProps {
  folderId: string;
  folderName: string;
  onRename: () => void;
  onDelete: () => void;
  onPermissions: () => void;
}

export function FolderActionsMenu({
  folderId,
  folderName,
  onRename,
  onDelete,
  onPermissions,
}: FolderActionsMenuProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/folders/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_id: folderId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al eliminar la carpeta");
      }

      setIsDeleteDialogOpen(false);
      onDelete();
    } catch (err: any) {
      alert(err.message || "Error al eliminar la carpeta");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>
            <Edit className="h-4 w-4 mr-2" />
            Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPermissions}>
            <Users className="h-4 w-4 mr-2" />
            Permisos
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar carpeta?</DialogTitle>
            <DialogDescription>
              Estás a punto de eliminar la carpeta "{folderName}". Esta acción no se puede deshacer.
              {folderName === "Home" && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ No puedes eliminar la carpeta Home.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting || folderName === "Home"}
              variant="destructive"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

