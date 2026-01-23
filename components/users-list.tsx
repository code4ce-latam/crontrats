"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type WorkspaceUser, type PaginatedUsers } from "@/lib/supabase/users";
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
  Users as UsersIcon,
  Edit,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditUserDialog } from "./edit-user-dialog";
import { useState } from "react";

// Función para traducir el rol
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'OWNER': 'Propietario',
    'EDITOR': 'Editor',
    'READER': 'Lector',
  };
  return labels[role] || role;
}

// Función para obtener el color del badge según el rol
function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case 'OWNER':
      return 'default';
    case 'EDITOR':
      return 'secondary';
    case 'READER':
      return 'outline';
    default:
      return 'outline';
  }
}

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

interface UsersListProps {
  initialData: PaginatedUsers;
}

// Función para exportar a Excel (CSV)
function exportToExcel(users: WorkspaceUser[]) {
  // Encabezados
  const headers = ['Nombre', 'Email', 'Rol', 'Fecha de Registro'];
  
  // Convertir usuarios a filas CSV
  const rows = users.map(user => [
    user.display_name || user.email || '-',
    user.email || '-',
    getRoleLabel(user.role),
    formatFullDate(user.created_at),
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
  link.setAttribute('download', `usuarios_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function UsersList({ initialData }: UsersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WorkspaceUser | null>(null);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', newPage.toString());
    }
    router.push(`/protected/configuracion/usuarios?${params.toString()}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', newSize.toString());
    params.delete('page'); // Reset to first page
    router.push(`/protected/configuracion/usuarios?${params.toString()}`);
  };

  const handleExport = () => {
    exportToExcel(initialData.users);
  };

  const handleEditUser = (user: WorkspaceUser) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedUser(null);
    router.refresh();
  };

  const { users, total, page, pageSize, totalPages } = initialData;

  // Calcular el rango de registros mostrados
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <Card className="border-none shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4 sm:gap-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Total: {total} {total === 1 ? 'usuario' : 'usuarios'}
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {users.length > 0 && (
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
        {users.length === 0 ? (
          <div className="py-12 text-center">
            <UsersIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No hay usuarios registrados
            </p>
          </div>
        ) : (
          <>
            {/* Tabla de usuarios */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Nombre
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Email
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Rol
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Fecha de Registro
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.display_name || 'Usuario'}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-semibold text-primary">
                                {(user.display_name || user.email || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-sm text-foreground font-medium">
                            {user.display_name || user.email || 'Usuario'}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="text-sm text-foreground">
                          {user.email || '-'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <Badge 
                          variant={getRoleBadgeVariant(user.role)}
                          className="text-xs font-medium"
                        >
                          {getRoleLabel(user.role)}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                          {formatFullDate(user.created_at)}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => handleEditUser(user)}
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

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 px-4 pb-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startRecord} - {endRecord} de {total} usuarios
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

      {/* Diálogo de Edición */}
      {selectedUser && (
        <EditUserDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              setSelectedUser(null);
            }
          }}
          user={selectedUser}
          onSuccess={handleEditSuccess}
        />
      )}
    </Card>
  );
}

