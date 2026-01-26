"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type FolderAccess, type FolderTreeItem } from "@/lib/supabase/folders";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { 
  Folder,
  Edit,
  Trash2,
  Users,
  Plus,
} from "lucide-react";
import { RenameFolderDialog } from "./rename-folder-dialog";
import { FolderPermissionsDrawer } from "./folder-permissions-drawer";
import { FolderActionsMenu } from "./folder-actions-menu";
import { CreateFolderDialog } from "./create-folder-dialog";

interface FolderDetailsProps {
  folderId: string;
  workspaceId: string;
  tree: FolderTreeItem[];
  onRefresh: () => void;
}

interface FolderInfo {
  id: string;
  name: string;
  path: string;
  created_at: string;
  parent_id: string | null;
  access: FolderAccess | null;
}

interface FolderPathItem {
  id: string;
  name: string;
}

interface Participant {
  member_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  access: FolderAccess;
}

export function FolderDetails({ folderId, workspaceId, tree, onRefresh }: FolderDetailsProps) {
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPathItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isPermissionsDrawerOpen, setIsPermissionsDrawerOpen] = useState(false);
  const [isCreateSubfolderDialogOpen, setIsCreateSubfolderDialogOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  // Memoizar el mapa de carpetas y la carpeta encontrada para evitar recalcular
  const { folderMap, foundFolder } = useMemo(() => {
    const map = new Map<string, FolderTreeItem>();
    const buildFolderMap = (items: FolderTreeItem[]) => {
      items.forEach(item => {
        map.set(item.id, item);
        if (item.children) {
          buildFolderMap(item.children);
        }
      });
    };
    buildFolderMap(tree);
    
    const findFolder = (items: FolderTreeItem[]): FolderTreeItem | null => {
      for (const item of items) {
        if (item.id === folderId) return item;
        if (item.children) {
          const found = findFolder(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return { folderMap: map, foundFolder: findFolder(tree) };
  }, [tree, folderId]);

  // Cargar información de workspace owner solo una vez (no cambia entre carpetas)
  useEffect(() => {
    async function loadWorkspaceOwner() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: membership } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('workspace_id', workspaceId)
            .eq('status', 'ACTIVE')
            .maybeSingle();
          
          setIsWorkspaceOwner(membership?.role === 'OWNER');
        }
      } catch (error) {
        console.error("[FolderDetails] Error verificando workspace owner:", error);
      }
    }
    loadWorkspaceOwner();
  }, [workspaceId]);

  // Función para cargar participantes (memoizada para evitar recrearla)
  const loadParticipants = useCallback(async (id: string) => {
    setIsLoadingParticipants(true);
    try {
      const response = await fetch(`/api/folders/permissions?folder_id=${id}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        const allParticipants: Participant[] = [
          ...data.permissions.OWNER,
          ...data.permissions.EDIT,
          ...data.permissions.READ
        ];
        // Eliminar duplicados si los hubiera (aunque el backend ya lo maneja)
        const uniqueParticipants = Array.from(new Map(allParticipants.map(p => [p.member_id, p])).values());
        setParticipants(uniqueParticipants);
      }
    } catch (error) {
      console.error("[FolderDetails] Error cargando participantes:", error);
    } finally {
      setIsLoadingParticipants(false);
    }
  }, []);

  // Cargar información de la carpeta cuando cambia folderId
  useEffect(() => {
    if (!foundFolder) {
      setFolder(null);
      setFolderPath([]);
      setParticipants([]);
      setIsLoading(false);
      return;
    }

    // La información de la carpeta ya está en memoria, no necesita fetch
    setIsLoading(true);
    
    setFolder({
      id: foundFolder.id,
      name: foundFolder.name,
      path: foundFolder.path,
      created_at: foundFolder.created_at,
      parent_id: foundFolder.parent_id,
      access: foundFolder.access,
    });

    // Construir ruta jerárquica desde el path
    // El path tiene formato: "uuid1" o "uuid1.uuid2.uuid3"
    // IMPORTANTE: Solo mostramos carpetas que están en folderMap (accesibles al usuario)
    // Si el usuario solo tiene acceso a una subcarpeta, solo verá esa subcarpeta en la ruta
    // Si tiene acceso a múltiples niveles consecutivos, verá desde el primer nivel accesible
    const pathIds = foundFolder.path.split('.');
    const pathItems: FolderPathItem[] = [];
    
    for (const pathId of pathIds) {
      const pathFolder = folderMap.get(pathId);
      // Solo agregar carpetas accesibles (que están en folderMap)
      // Las carpetas no accesibles no estarán en folderMap debido a RLS
      if (pathFolder) {
        pathItems.push({
          id: pathFolder.id,
          name: pathFolder.name,
        });
      }
    }
    
    setFolderPath(pathItems);
    setIsLoading(false);
    
    // Cargar participantes (no bloquea la UI, se ejecuta en paralelo)
    loadParticipants(foundFolder.id);
  }, [foundFolder, folderMap, loadParticipants]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Carpeta no encontrada</p>
          <p className="text-sm mt-2">No tienes acceso a esta carpeta o no existe</p>
        </div>
      </div>
    );
  }

  const access = folder.access;
  // Puede gestionar si tiene permiso OWNER en la carpeta, o si es OWNER del workspace (especialmente para carpetas raíz)
  const canManage = access === 'OWNER' || (isWorkspaceOwner && folder.parent_id === null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleLabel = (access: FolderAccess) => {
    const labels = {
      OWNER: 'Propietario',
      EDIT: 'Editor',
      READ: 'Lector',
    };
    return labels[access];
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Folder className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle className="text-xl">{folder.name}</CardTitle>
              </div>
            </div>
            {canManage && (
              <FolderActionsMenu
                folderId={folder.id}
                folderName={folder.name}
                onRename={() => setIsRenameDialogOpen(true)}
                onDelete={onRefresh}
                onPermissions={() => setIsPermissionsDrawerOpen(true)}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Ruta</p>
            {folderPath.length > 0 ? (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {folderPath.map((item, index) => (
                  <span key={item.id} className="flex items-center gap-1">
                    <span className="text-sm text-foreground">{item.name}</span>
                    {index < folderPath.length - 1 && (
                      <span className="text-muted-foreground">/</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-mono mt-1 text-muted-foreground">{folder.path}</p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Creada</p>
            <p className="text-sm mt-1">{formatDate(folder.created_at)}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Participantes</p>
            {isLoadingParticipants ? (
              <p className="text-sm text-muted-foreground">Cargando participantes...</p>
            ) : participants.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {participants.map((participant) => (
                  <div 
                    key={participant.member_id} 
                    className="flex items-center gap-2 p-1 pr-2 bg-background rounded-full border shadow-sm"
                    title={`${participant.display_name || participant.email} (${participant.access})`}
                  >
                    {participant.avatar_url ? (
                      <img
                        src={participant.avatar_url}
                        alt={participant.display_name || 'Usuario'}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-primary">
                          {(participant.display_name || participant.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-medium max-w-[150px] truncate leading-tight">
                        {participant.display_name || participant.email}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {getRoleLabel(participant.access)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay participantes asignados</p>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateSubfolderDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear subcarpeta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRenameDialogOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Renombrar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPermissionsDrawerOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Permisos
              </Button>
            </div>
          )}

          {!canManage && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {access === 'EDIT' 
                  ? 'Tienes permisos de edición en esta carpeta'
                  : 'Tienes permisos de solo lectura en esta carpeta'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <RenameFolderDialog
        open={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        folderId={folder.id}
        currentName={folder.name}
        onSuccess={() => {
          setIsRenameDialogOpen(false);
          onRefresh();
        }}
      />

      <FolderPermissionsDrawer
        open={isPermissionsDrawerOpen}
        onOpenChange={setIsPermissionsDrawerOpen}
        folderId={folder.id}
        workspaceId={workspaceId}
        tree={tree}
        onSuccess={onRefresh}
      />

      <CreateFolderDialog
        open={isCreateSubfolderDialogOpen}
        onOpenChange={setIsCreateSubfolderDialogOpen}
        parentId={folder.id}
        workspaceId={workspaceId}
        onSuccess={() => {
          setIsCreateSubfolderDialogOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}

