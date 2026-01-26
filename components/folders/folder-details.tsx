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
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/contracts-utils";
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
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const router = useRouter();

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

  // Función para cargar contratos
  const loadContracts = useCallback(async (id: string) => {
    setIsLoadingContracts(true);
    try {
      const response = await fetch(`/api/contracts/list?folder_id=${id}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error("[FolderDetails] Error cargando contratos:", error);
      setContracts([]);
    } finally {
      setIsLoadingContracts(false);
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
    
    // Cargar participantes y contratos (no bloquea la UI, se ejecuta en paralelo)
    loadParticipants(foundFolder.id);
    loadContracts(foundFolder.id);
  }, [foundFolder, folderMap, loadParticipants, loadContracts]);

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
    <div className="h-full flex flex-col">
      <Card className="flex flex-col flex-1 overflow-hidden border-none shadow-none rounded-none">
        <div className="px-6 py-3 border-b shrink-0 flex flex-col gap-2">
          {/* Fila 1: Ruta */}
          <div className="flex items-center text-xs text-muted-foreground">
            <Folder className="h-3 w-3 mr-1" />
            {folderPath.length > 0 ? (
              <div className="flex items-center flex-wrap gap-1">
                {folderPath.map((item, index) => (
                  <span key={item.id} className="flex items-center">
                    <span className={`hover:text-foreground transition-colors ${index === folderPath.length - 1 ? "font-semibold text-foreground" : ""}`}>
                      {item.name}
                    </span>
                    {index < folderPath.length - 1 && (
                      <span className="mx-1">/</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="font-semibold text-foreground">{folder.path}</span>
            )}
          </div>
          
          {/* Fila 2: Info y Acciones */}
          <div className="flex items-center justify-between">
            {/* Izquierda: Metadata (Fecha y Participantes) */}
            <div className="flex items-center gap-4 text-sm">
              <div className="text-muted-foreground whitespace-nowrap text-xs">
                Creada el {formatDate(folder.created_at)}
              </div>
              
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-muted-foreground whitespace-nowrap text-xs">Participantes:</span>
                {isLoadingParticipants ? (
                  <span className="text-muted-foreground animate-pulse text-xs">...</span>
                ) : participants.length > 0 ? (
                  <div className="flex -space-x-2 overflow-hidden hover:space-x-1 transition-all duration-200">
                    {participants.slice(0, 5).map((participant) => (
                      <div 
                        key={participant.member_id}
                        className="relative z-0 hover:z-10 transition-all"
                        title={`${participant.display_name || participant.email} (${getRoleLabel(participant.access)})`}
                      >
                        {participant.avatar_url ? (
                          <img
                            src={participant.avatar_url}
                            alt={participant.display_name || 'Usuario'}
                            className="h-6 w-6 rounded-full object-cover border-2 border-background ring-1 ring-border"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background ring-1 ring-border flex items-center justify-center">
                            <span className="text-[9px] font-bold text-primary">
                              {(participant.display_name || participant.email || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {participants.length > 5 && (
                      <div className="h-6 w-6 rounded-full bg-muted border-2 border-background ring-1 ring-border flex items-center justify-center relative z-0">
                        <span className="text-[9px] font-medium text-muted-foreground">+{participants.length - 5}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic text-xs">Ninguno</span>
                )}
              </div>
            </div>

            {/* Derecha: Acciones */}
            <div className="flex items-center gap-2">
              {(access === 'EDIT' || access === 'OWNER') && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/protected/contratos/nuevo?folder_id=${folder.id}`)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo contrato
                </Button>
              )}
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
          </div>
        </div>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-muted/5">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoadingContracts ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm text-muted-foreground">Cargando contratos...</p>
              </div>
            ) : contracts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                        Título
                      </th>
                      <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                        Estado
                      </th>
                      <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                        Fecha Inicio
                      </th>
                      <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                        Fecha Fin
                      </th>
                      <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                        Actualizado
                      </th>
                      <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((contract) => (
                      <tr
                        key={contract.id}
                        className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/protected/contratos/${contract.id}`)}
                      >
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm text-foreground font-medium">
                              {contract.title}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <Badge
                            variant={getStatusBadgeVariant(contract.status)}
                            className="text-xs font-medium"
                          >
                            {getStatusLabel(contract.status)}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">
                            {contract.start_date ? new Date(contract.start_date).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            }) : '-'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">
                            {contract.end_date ? new Date(contract.end_date).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            }) : '-'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">
                            {contract.updated_at ? new Date(contract.updated_at).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }) : '-'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/protected/contratos/${contract.id}/editar`);
                            }}
                            title="Editar contrato"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-8 border-2 border-dashed border-muted rounded-lg bg-background/50">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium mb-1">No hay contratos</h3>
                <p className="text-xs text-muted-foreground max-w-xs mb-4">
                  Esta carpeta está vacía. Comienza creando un nuevo contrato aquí.
                </p>
                {(access === 'EDIT' || access === 'OWNER') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/protected/contratos/nuevo?folder_id=${folder.id}`)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primer contrato
                  </Button>
                )}
              </div>
            )}
          </div>
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

