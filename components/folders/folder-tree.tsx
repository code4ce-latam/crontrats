"use client";

import { useState } from "react";
import { type FolderTreeItem, type FolderAccess } from "@/lib/supabase/folders";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { 
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Users,
  Edit,
} from "lucide-react";
import { CreateFolderDialog } from "./create-folder-dialog";
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

interface FolderTreeProps {
  initialTree: FolderTreeItem[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onTreeChange: (tree: FolderTreeItem[]) => void;
  workspaceId: string;
}

interface FolderTreeNodeProps {
  folder: FolderTreeItem;
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  onTreeChange: (tree: FolderTreeItem[]) => void;
  level?: number;
}

function FolderTreeNode({ 
  folder, 
  selectedFolderId, 
  onSelect,
  onTreeChange,
  workspaceId,
  level = 0 
}: FolderTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0); // Expandir raíz por defecto
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPermissionsDrawerOpen, setIsPermissionsDrawerOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;
  const access = folder.access;

  const getAccessIcon = (access: FolderAccess | null) => {
    if (!access) return null;
    const colors = {
      OWNER: "text-yellow-500",
      EDIT: "text-blue-500",
      READ: "text-gray-500",
    };
    return (
      <span className={cn("text-xs font-medium", colors[access])}>
        {access}
      </span>
    );
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(folder.id);
  };

  const handleCreateSubfolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreateDialogOpen(true);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenameDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const handlePermissionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPermissionsDrawerOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("/api/folders/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folder_id: folder.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al eliminar la carpeta");
      }

      setIsDeleteDialogOpen(false);
      // Refrescar árbol
      fetch(`/api/folders/tree?workspace_id=${folder.workspace_id}`)
        .then(res => res.json())
        .then(data => onTreeChange(data.tree || []))
        .catch(err => console.error("Error refrescando árbol:", err));
        
      // Si la carpeta eliminada estaba seleccionada, deseleccionar
      if (isSelected) {
        onSelect(''); // Usar string vacío o null si el tipo lo permite, pero onSelect espera string
      }
    } catch (err: any) {
      alert(err.message || "Error al eliminar la carpeta");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group",
          "hover:bg-accent",
          isSelected && "bg-accent text-accent-foreground font-medium"
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
        onClick={handleSelect}
      >
        <button
          onClick={handleToggle}
          className={cn(
            "flex items-center justify-center w-4 h-4 rounded hover:bg-accent-foreground/10",
            !hasChildren && "invisible"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground" />
        )}

        <span className="flex-1 text-sm truncate">{folder.name}</span>

        {getAccessIcon(access)}

        {access === 'OWNER' && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCreateSubfolder}
              title="Crear subcarpeta"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleRenameClick}
              title="Renombrar"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePermissionsClick}
              title="Permisos"
            >
              <Users className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDeleteClick}
              title="Eliminar carpeta"
              disabled={folder.name === "Home"}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onTreeChange={onTreeChange}
              workspaceId={workspaceId}
              level={level + 1}
            />
          ))}
        </div>
      )}

      <CreateFolderDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        parentId={folder.id}
        workspaceId={folder.workspace_id}
        onSuccess={() => {
          setIsCreateDialogOpen(false);
          // Refrescar árbol
          fetch(`/api/folders/tree?workspace_id=${folder.workspace_id}`)
            .then(res => res.json())
            .then(data => onTreeChange(data.tree || []))
            .catch(err => console.error("Error refrescando árbol:", err));
        }}
      />

      <RenameFolderDialog
        open={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        folderId={folder.id}
        currentName={folder.name}
        onSuccess={() => {
          setIsRenameDialogOpen(false);
          // Refrescar árbol
          fetch(`/api/folders/tree?workspace_id=${folder.workspace_id}`)
            .then(res => res.json())
            .then(data => onTreeChange(data.tree || []))
            .catch(err => console.error("Error refrescando árbol:", err));
        }}
      />

      <FolderPermissionsDrawer
        open={isPermissionsDrawerOpen}
        onOpenChange={setIsPermissionsDrawerOpen}
        folderId={folder.id}
        workspaceId={folder.workspace_id}
        onSuccess={() => {
          // Refrescar árbol para actualizar iconos de acceso si cambiaron
          fetch(`/api/folders/tree?workspace_id=${folder.workspace_id}`)
            .then(res => res.json())
            .then(data => onTreeChange(data.tree || []))
            .catch(err => console.error("Error refrescando árbol:", err));
        }}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar carpeta?</DialogTitle>
            <DialogDescription>
              Estás a punto de eliminar la carpeta "{folder.name}". Esta acción no se puede deshacer.
              {folder.name === "Home" && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ No puedes eliminar la carpeta Home.
                </span>
              )}
              {hasChildren && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ No puedes eliminar una carpeta que contiene subcarpetas. Elimina primero el contenido.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteDialogOpen(false);
              }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              disabled={isDeleting || folder.name === "Home" || hasChildren}
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

export function FolderTree({ 
  initialTree, 
  selectedFolderId, 
  onFolderSelect,
  onTreeChange,
  workspaceId
}: FolderTreeProps) {
  const [isCreateRootDialogOpen, setIsCreateRootDialogOpen] = useState(false);

  // Función helper para encontrar una carpeta en el árbol
  const findFolderInTree = (tree: FolderTreeItem[], folderId: string): FolderTreeItem | null => {
    for (const item of tree) {
      if (item.id === folderId) return item;
      if (item.children) {
        const found = findFolderInTree(item.children, folderId);
        if (found) return found;
      }
    }
    return null;
  };

  // Determinar el parentId basado en la carpeta seleccionada
  const getParentIdForNewFolder = (): string | null => {
    if (!selectedFolderId) return null;
    const selectedFolder = findFolderInTree(initialTree, selectedFolderId);
    return selectedFolder ? selectedFolder.id : null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Carpetas</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreateRootDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nueva carpeta
        </Button>
      </div>

      <div 
        className="flex-1 overflow-y-auto"
        onClick={(e) => {
          // Si se hace clic en el fondo (no en un nodo), deseleccionar
          onFolderSelect(null);
        }}
      >
        {initialTree.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">No hay carpetas disponibles</p>
            <p className="text-xs mt-2">Crea una carpeta para comenzar</p>
          </div>
        ) : (
          <div className="space-y-1">
          {initialTree.map((folder) => (
            <FolderTreeNode
              key={folder.id}
              folder={folder}
              selectedFolderId={selectedFolderId}
              onSelect={onFolderSelect}
              onTreeChange={onTreeChange}
              workspaceId={workspaceId}
            />
          ))}
          </div>
        )}
      </div>

      <CreateFolderDialog
        open={isCreateRootDialogOpen}
        onOpenChange={setIsCreateRootDialogOpen}
        parentId={getParentIdForNewFolder()}
        workspaceId={workspaceId}
        onSuccess={() => {
          setIsCreateRootDialogOpen(false);
          // Refrescar árbol
          fetch(`/api/folders/tree?workspace_id=${workspaceId}`)
            .then(res => res.json())
            .then(data => onTreeChange(data.tree || []))
            .catch(err => console.error("Error refrescando árbol:", err));
        }}
      />
    </div>
  );
}

