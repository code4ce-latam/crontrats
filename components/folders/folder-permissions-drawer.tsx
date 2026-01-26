"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
// Avatar component inline
import { X, Users, Search, Plus } from "lucide-react";
import { type FolderPermissionsWithMember, type FolderTreeItem } from "@/lib/supabase/folders";
import { createClient } from "@/lib/supabase/client";
import { type WorkspaceUser } from "@/lib/supabase/users";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface FolderPermissionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  workspaceId: string;
  tree?: FolderTreeItem[]; // Pasar el árbol para evitar fetch redundante
  onSuccess?: () => void;
}

export function FolderPermissionsDrawer({
  open,
  onOpenChange,
  folderId,
  workspaceId,
  tree,
  onSuccess,
}: FolderPermissionsDrawerProps) {
  const [permissions, setPermissions] = useState<{
    OWNER: FolderPermissionsWithMember[];
    EDIT: FolderPermissionsWithMember[];
    READ: FolderPermissionsWithMember[];
  }>({ OWNER: [], EDIT: [], READ: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableUsers, setAvailableUsers] = useState<WorkspaceUser[]>([]);
  const [showUserPicker, setShowUserPicker] = useState<"OWNER" | "EDIT" | "READ" | null>(null);
  const [currentUserMemberId, setCurrentUserMemberId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([]);

  // Memoizar el cálculo de la ruta de la carpeta desde el árbol
  const computedFolderPath = useMemo(() => {
    if (!tree || tree.length === 0) return [];

    // Construir mapa de carpetas
    const folderMap = new Map<string, FolderTreeItem>();
    const buildFolderMap = (items: FolderTreeItem[]) => {
      items.forEach(item => {
        folderMap.set(item.id, item);
        if (item.children) {
          buildFolderMap(item.children);
        }
      });
    };
    buildFolderMap(tree);

    // Encontrar la carpeta
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

    const found = findFolder(tree);
    if (!found) return [];

    // Construir ruta jerárquica desde el path
    const pathIds = found.path.split('.');
    const pathItems: Array<{ id: string; name: string }> = [];
    
    for (const pathId of pathIds) {
      const pathFolder = folderMap.get(pathId);
      if (pathFolder) {
        pathItems.push({
          id: pathFolder.id,
          name: pathFolder.name,
        });
      }
    }
    
    return pathItems;
  }, [tree, folderId]);

  // Definir funciones de carga antes del useEffect que las usa
  const loadCurrentUserMemberId = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .eq('status', 'ACTIVE')
          .maybeSingle();
        setCurrentUserMemberId(membership?.id || null);
      }
    } catch (err) {
      console.error("[FolderPermissions] Error cargando member_id del usuario:", err);
    }
  }, [workspaceId]);

  const loadPermissions = useCallback(async () => {
    try {
      const response = await fetch(`/api/folders/permissions?folder_id=${folderId}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || { OWNER: [], EDIT: [], READ: [] });
      }
    } catch (err) {
      console.error("[FolderPermissions] Error cargando permisos:", err);
    }
  }, [folderId]);

  const loadAvailableUsers = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: usersData, error } = await supabase.rpc('get_workspace_users', {
        workspace_uuid: workspaceId,
      });
      
      if (error) {
        console.error("[FolderPermissions] Error cargando usuarios:", error);
        return;
      }

      // Mapear los datos de la RPC a WorkspaceUser
      // La RPC devuelve membership_id, pero WorkspaceUser espera id
      const mappedUsers: WorkspaceUser[] = (usersData || []).map((row: any) => {
        const displayName = row.full_name || row.email?.split("@")[0] || `Usuario ${row.user_id?.substring(0, 8) || ''}`;
        
        return {
          id: row.membership_id, // El membership_id es el id de workspace_members (member_id)
          user_id: row.user_id,
          workspace_id: row.workspace_id,
          role: row.role as 'OWNER' | 'EDITOR' | 'READER',
          status: row.status as 'ACTIVE' | 'DISABLED',
          created_at: row.created_at,
          created_by_user_id: row.created_by_user_id,
          email: row.email || null,
          display_name: displayName,
          avatar_url: row.avatar_url || null,
          first_name: row.first_name || null,
          last_name: row.last_name || null,
        };
      });
      
      setAvailableUsers(mappedUsers);
    } catch (err) {
      console.error("[FolderPermissions] Error cargando usuarios:", err);
    }
  }, [workspaceId]);

  const loadFolderPath = useCallback(async () => {
    try {
      const response = await fetch(`/api/folders/tree?workspace_id=${workspaceId}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        
        // Construir mapa de carpetas
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
        
        // Encontrar la carpeta
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
          // Construir ruta jerárquica desde el path
          const pathIds = found.path.split('.');
          const pathItems: Array<{ id: string; name: string }> = [];
          
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
        }
      }
    } catch (err) {
      console.error("[FolderPermissions] Error cargando ruta de carpeta:", err);
    }
  }, [workspaceId, folderId]);

  // useEffect para cargar datos cuando se abre el drawer
  useEffect(() => {
    if (!open) {
      // Limpiar estado al cerrar
      setSearchQuery("");
      setShowUserPicker(null);
      setError(null);
      return;
    }

    // Verificar que las funciones estén definidas antes de usarlas
    if (!loadPermissions || !loadAvailableUsers || !loadCurrentUserMemberId || !loadFolderPath) {
      return;
    }

    // Ejecutar todas las cargas en paralelo para mejorar rendimiento
    setIsLoading(true);
    Promise.all([
      loadPermissions(),
      loadAvailableUsers(),
      loadCurrentUserMemberId(),
      // Solo cargar path si no tenemos el árbol
      tree && tree.length > 0 ? Promise.resolve() : loadFolderPath(),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, [open, folderId, workspaceId, tree, loadPermissions, loadAvailableUsers, loadCurrentUserMemberId, loadFolderPath]);

  // Memoizar los member IDs para evitar recalcular
  const memberIds = useMemo(() => {
    return new Set([
      ...permissions.OWNER.map(p => p.member_id),
      ...permissions.EDIT.map(p => p.member_id),
      ...permissions.READ.map(p => p.member_id),
    ]);
  }, [permissions]);

  // Memoizar usuarios disponibles para el picker
  const availableUsersForPicker = useMemo(() => {
    return availableUsers.filter(u => !memberIds.has(u.id));
  }, [availableUsers, memberIds]);

  const handleAddUser = (user: WorkspaceUser, access: "OWNER" | "EDIT" | "READ") => {
    setError(null); // Limpiar error al agregar usuario

    // Validar que user.id existe y no es null/undefined
    if (!user.id || !user.user_id) {
      setError("Error: información del usuario incompleta");
      return;
    }

    // Validar que el usuario no esté ya en ese nivel
    const alreadyInLevel = permissions[access].some(p => p.member_id === user.id);
    if (alreadyInLevel) {
      setError("Este usuario ya tiene este nivel de acceso");
      return;
    }

    const newPermission: FolderPermissionsWithMember = {
      id: `temp-${Date.now()}`,
      folder_id: folderId,
      member_id: user.id,
      access,
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    };

    // Remover de otros niveles primero (para evitar duplicados)
    setPermissions(prev => {
      const updated = {
        OWNER: access === "OWNER" ? prev.OWNER : prev.OWNER.filter(p => p.member_id !== user.id),
        EDIT: access === "EDIT" ? prev.EDIT : prev.EDIT.filter(p => p.member_id !== user.id),
        READ: access === "READ" ? prev.READ : prev.READ.filter(p => p.member_id !== user.id),
      };
      
      // Agregar al nuevo nivel
      updated[access] = [...updated[access], newPermission];
      
      return updated;
    });

    setShowUserPicker(null);
  };

  const handleRemoveUser = (memberId: string, access: "OWNER" | "EDIT" | "READ") => {
    // Validación CRÍTICA: No permitir quitar el último OWNER
    // Verificar si el usuario que se está eliminando es un OWNER
    const isOwner = access === "OWNER";
    const isLastOwner = isOwner && permissions.OWNER.length === 1;
    
    if (isLastOwner) {
      setError("No puedes quitar al último propietario. Agrega otro propietario primero.");
      return;
    }

    // Validación adicional: verificar que el memberId específico es el único OWNER
    if (isOwner && permissions.OWNER.length === 1 && permissions.OWNER[0].member_id === memberId) {
      setError("No puedes quitar al último propietario. Agrega otro propietario primero.");
      return;
    }

    setPermissions(prev => ({
      OWNER: prev.OWNER.filter(p => p.member_id !== memberId),
      EDIT: prev.EDIT.filter(p => p.member_id !== memberId),
      READ: prev.READ.filter(p => p.member_id !== memberId),
    }));
  };


  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Validar y filtrar member_ids válidos antes de enviar
      const ownerIds = permissions.OWNER
        .map(p => p.member_id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
      
      const editIds = permissions.EDIT
        .map(p => p.member_id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
      
      const readIds = permissions.READ
        .map(p => p.member_id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

      // Validar que no haya duplicados dentro de cada nivel
      const ownerIdsUnique = [...new Set(ownerIds)];
      const editIdsUnique = [...new Set(editIds)];
      const readIdsUnique = [...new Set(readIds)];

      if (ownerIds.length !== ownerIdsUnique.length || 
          editIds.length !== editIdsUnique.length || 
          readIds.length !== readIdsUnique.length) {
        setError("Error: se detectaron duplicados en los permisos. Por favor, recarga la página.");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/folders/permissions/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_id: folderId,
          permissions: {
            OWNER: ownerIdsUnique,
            EDIT: editIdsUnique,
            READ: readIdsUnique,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || "Error al actualizar permisos";
        throw new Error(errorMessage);
      }

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Error al actualizar permisos");
    } finally {
      setIsSaving(false);
    }
  };

  // Memoizar usuarios filtrados por búsqueda
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableUsersForPicker;
    }
    
    const query = searchQuery.toLowerCase();
    return availableUsersForPicker.filter(u => {
      return (
        u.email?.toLowerCase().includes(query) ||
        u.display_name?.toLowerCase().includes(query) ||
        u.first_name?.toLowerCase().includes(query) ||
        u.last_name?.toLowerCase().includes(query)
      );
    });
  }, [availableUsersForPicker, searchQuery]);

  const renderPermissionSection = (
    title: string,
    access: "OWNER" | "EDIT" | "READ",
    members: FolderPermissionsWithMember[]
  ) => {
    const colors = {
      OWNER: "bg-yellow-50 border-yellow-200",
      EDIT: "bg-blue-50 border-blue-200",
      READ: "bg-gray-50 border-gray-200",
    };

    // Validación: Si es OWNER y solo hay 1 miembro, deshabilitar acciones
    const isLastOwner = access === "OWNER" && members.length === 1;

    return (
      <div className={`border rounded-lg p-4 ${colors[access]}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <DropdownMenu 
            open={showUserPicker === access} 
            onOpenChange={(isOpen) => {
              if (isOpen) {
                setSearchQuery("");
                setShowUserPicker(access);
              } else {
                setShowUserPicker(null);
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
              >
                <Plus className="h-3 w-3 mr-1" />
                <span className="text-xs">Agregar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 p-0" align="end">
              <div className="p-3">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuario..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      {searchQuery ? "No se encontraron usuarios" : "No hay usuarios disponibles"}
                    </p>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <button
                        key={`${access}-user-${user.id || user.user_id || index}`}
                        onClick={() => handleAddUser(user, access)}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent text-left transition-colors"
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name || 'Usuario'}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {(user.display_name || user.email || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm flex-1 truncate">
                          {user.display_name || user.email}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap gap-2">
          {members.map((permission, index) => (
            <div
              key={`${access}-permission-${permission.member_id}-${permission.id || index}`}
              className="flex items-center gap-2 p-1 pr-2 bg-background rounded-full border shadow-sm group hover:border-primary/50 transition-colors"
            >
              {permission.avatar_url ? (
                <img
                  src={permission.avatar_url}
                  alt={permission.display_name || 'Usuario'}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-primary">
                    {(permission.display_name || permission.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              <span className="text-xs font-medium max-w-[150px] truncate" title={permission.email || ''}>
                {permission.display_name || permission.email}
              </span>

              <button
                onClick={() => handleRemoveUser(permission.member_id, permission.access)}
                disabled={isLastOwner && permission.access === 'OWNER'}
                className="ml-1 h-4 w-4 flex items-center justify-center rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isLastOwner && permission.access === 'OWNER' ? "Debe existir al menos un propietario. Agrega otro propietario primero." : "Eliminar usuario"}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permisos de Carpeta</DialogTitle>
          <DialogDescription>
            Gestiona los permisos de acceso a esta carpeta. Los cambios se aplicarán también a las subcarpetas.
          </DialogDescription>
          {folderPath.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">Ruta:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {folderPath.map((item, index) => (
                  <span key={item.id} className="flex items-center gap-1">
                    <span className="text-sm font-bold text-foreground">{item.name}</span>
                    {index < folderPath.length - 1 && (
                      <span className="text-muted-foreground font-bold">/</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando permisos...
          </div>
        ) : (
          <div className="space-y-4">
            {renderPermissionSection("Propietarios", "OWNER", permissions.OWNER)}
            {renderPermissionSection("Editores", "EDIT", permissions.EDIT)}
            {renderPermissionSection("Lectores", "READ", permissions.READ)}

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

