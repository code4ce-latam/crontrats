"use client";

import { useState, useEffect } from "react";
import { type FolderAccess } from "@/lib/supabase/folders";
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

export function FolderDetails({ folderId, workspaceId, onRefresh }: FolderDetailsProps) {
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPathItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isPermissionsDrawerOpen, setIsPermissionsDrawerOpen] = useState(false);
  const [isCreateSubfolderDialogOpen, setIsCreateSubfolderDialogOpen] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  useEffect(() => {
    async function loadFolder() {
      setIsLoading(true);
      try {
        // Verificar si el usuario es OWNER del workspace
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

        // Obtener información de la carpeta desde el árbol
        const response = await fetch(`/api/folders/tree?workspace_id=${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Función recursiva para encontrar carpeta y construir mapa de todas las carpetas
          const folderMap = new Map<string, any>();
          const buildFolderMap = (items: any[]) => {
            items.forEach(item => {
              folderMap.set(item.id, item);
              if (item.children) {
                buildFolderMap(item.children);
              }
            });
          };
          buildFolderMap(data.tree || []);
          
          const findFolder = (items: any[]): any => {
            for (const item of items) {
              if (item.id === folderId) return item;
              if (item.children) {
                const found = findFolder(item.children);
                if (found) return found;
              }
            }
            return null;
          };
          
          const found = findFolder(data.tree || []);
          if (found) {
            setFolder({
              id: found.id,
              name: found.name,
              path: found.path,
              created_at: found.created_at,
              parent_id: found.parent_id,
              access: found.access,
            });

            // Construir ruta jerárquica desde el path
            // El path tiene formato: "uuid1" o "uuid1.uuid2.uuid3"
            const pathIds = found.path.split('.');
            const pathItems: FolderPathItem[] = [];
            
            for (const pathId of pathIds) {
              const pathFolder = folderMap.get(pathId);
              if (pathFolder) {
                pathItems.push({
                  id: pathFolder.id,
                  name: pathFolder.name,
                });
              }
            }
            
            setFolderPath(pathItems);
            
            // Cargar participantes
            loadParticipants(found.id);
          }
        }
      } catch (error) {
        console.error("[FolderDetails] Error cargando carpeta:", error);
      } finally {
        setIsLoading(false);
      }
    }

    async function loadParticipants(id: string) {
      setIsLoadingParticipants(true);
      try {
        const response = await fetch(`/api/folders/permissions?folder_id=${id}`);
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
    }

    if (folderId) {
      loadFolder();
    }
  }, [folderId, workspaceId]);

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

