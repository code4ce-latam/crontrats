"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ContractProfile, type PaginatedProfiles } from "@/lib/supabase/contract-profiles";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { 
  ChevronLeft,
  ChevronRight,
  Download,
  ChevronDown,
  FileText,
  Edit,
  Settings,
  Trash2,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditContractProfileDialog } from "./edit-contract-profile-dialog";
import { CreateContractProfileDialog } from "./create-contract-profile-dialog";
import { ManageProfileFieldsDialog } from "./manage-profile-fields-dialog";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Función para formatear la fecha completa
function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface ContractProfilesListProps {
  initialData: PaginatedProfiles;
}

// Función para exportar a Excel (CSV)
function exportToExcel(profiles: ContractProfile[]) {
  // Encabezados
  const headers = ['Nombre', 'Descripción', 'Estado', 'Fecha de Creación'];
  
  // Convertir perfiles a filas CSV
  const rows = profiles.map(profile => [
    profile.name || '-',
    profile.description || '-',
    profile.is_active ? 'Activo' : 'Inactivo',
    formatFullDate(profile.created_at),
  ]);
  
  // Combinar encabezados y filas
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // Crear blob y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `perfiles_contratos_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ContractProfilesList({ initialData }: ContractProfilesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageFieldsDialogOpen, setIsManageFieldsDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ContractProfile | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'EDITOR' | 'READER' | null>(null);

  // Obtener el rol del usuario actual
  useEffect(() => {
    async function getCurrentUserRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .single();

        if (membership) {
          setCurrentUserRole(membership.role as 'OWNER' | 'EDITOR' | 'READER');
        }
      }
    }
    getCurrentUserRole();
  }, []);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', newPage.toString());
    }
    router.push(`/protected/configuracion/perfiles?${params.toString()}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', newSize.toString());
    params.delete('page'); // Reset to first page
    router.push(`/protected/configuracion/perfiles?${params.toString()}`);
  };

  const handleExport = () => {
    exportToExcel(initialData.profiles);
  };

  const handleCreateProfile = () => {
    setIsCreateDialogOpen(true);
  };

  const handleEditProfile = (profile: ContractProfile) => {
    setSelectedProfile(profile);
    setIsEditDialogOpen(true);
  };

  const handleManageFields = (profile: ContractProfile) => {
    setSelectedProfile(profile);
    setIsManageFieldsDialogOpen(true);
  };

  const handleDeleteProfile = async (profile: ContractProfile) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el perfil "${profile.name}"?`)) {
      return;
    }

    try {
      const response = await fetch("/api/contract-profiles/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileId: profile.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al eliminar el perfil");
      }

      router.refresh();
    } catch (error: any) {
      alert(error.message || "Error al eliminar el perfil");
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    router.refresh();
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedProfile(null);
    router.refresh();
  };

  const handleManageFieldsSuccess = () => {
    setIsManageFieldsDialogOpen(false);
    setSelectedProfile(null);
    router.refresh();
  };

  const { profiles, total, page, pageSize, totalPages } = initialData;

  // Calcular el rango de registros mostrados
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  const canCreate = currentUserRole === 'OWNER' || currentUserRole === 'EDITOR';
  const canDelete = currentUserRole === 'OWNER';

  return (
    <Card className="border-none shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4 sm:gap-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Total: {total} {total === 1 ? 'perfil' : 'perfiles'}
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {canCreate && (
            <Button
              variant="default"
              size="sm"
              className="h-8"
              onClick={handleCreateProfile}
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Perfil
            </Button>
          )}
          {profiles.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    {pageSize} registros
                    <ChevronDown className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[10, 25, 50, 100].map((size) => (
                    <DropdownMenuItem 
                      key={size} 
                      onClick={() => handlePageSizeChange(size)}
                      className={cn(size === pageSize && "bg-accent")}
                    >
                      {size} registros
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8"
              >
                <Download className="h-3.5 w-3.5 mr-2" />
                Exportar
              </Button>
            </>
          )}
        </div>
      </div>
      <CardContent className="p-0">
        {profiles.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              No hay perfiles de contratos registrados
            </p>
            {canCreate && (
              <Button
                variant="default"
                size="sm"
                onClick={handleCreateProfile}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Perfil
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Grid de perfiles como etiquetas/cards */}
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {profiles.map((profile) => (
                  <Card
                    key={profile.id}
                    className="relative hover:shadow-md transition-shadow border-2"
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
                        {/* Header con nombre y estado */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground truncate">
                              {profile.name}
                            </h3>
                          </div>
                          <Badge 
                            variant={profile.is_active ? "default" : "secondary"}
                            className="text-xs font-medium flex-shrink-0"
                          >
                            {profile.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </div>

                        {/* Descripción */}
                        {profile.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {profile.description}
                          </p>
                        )}

                        {/* Fecha de creación */}
                        <div className="text-xs text-muted-foreground">
                          Creado: {new Date(profile.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          {canCreate && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 flex-1"
                                onClick={() => handleEditProfile(profile)}
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 flex-1"
                                onClick={() => handleManageFields(profile)}
                              >
                                <Settings className="h-3.5 w-3.5 mr-1.5" />
                                Campos
                              </Button>
                            </>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteProfile(profile)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 px-4 pb-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startRecord} - {endRecord} de {total} perfiles
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="min-w-[2.5rem]"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Diálogos */}
      <CreateContractProfileDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
        }}
        onSuccess={handleCreateSuccess}
      />

      {selectedProfile && (
        <>
          <EditContractProfileDialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) {
                setSelectedProfile(null);
              }
            }}
            profile={selectedProfile}
            onSuccess={handleEditSuccess}
          />

          <ManageProfileFieldsDialog
            open={isManageFieldsDialogOpen}
            onOpenChange={(open) => {
              setIsManageFieldsDialogOpen(open);
              if (!open) {
                setSelectedProfile(null);
              }
            }}
            profile={selectedProfile}
            onSuccess={handleManageFieldsSuccess}
          />
        </>
      )}
    </Card>
  );
}

