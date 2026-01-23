"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type Activity, type PaginatedActivities } from "@/lib/supabase/activities";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { 
  Activity as ActivityIcon, 
  Clock, 
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Download,
  Info,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

// Función para obtener el color del badge según el tipo de actividad
function getActivityTypeColor(type: string): "default" | "secondary" | "destructive" | "outline" {
  // Ahora todos usan outline para no tener background sólido
  return 'outline';
}

// Función para traducir el tipo de actividad
function getActivityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'CREATE': 'Crear',
    'UPDATE': 'Actualizar',
    'DELETE': 'Eliminar',
    'VIEW': 'Ver',
    'LOGIN': 'Inicio de sesión',
    'LOGOUT': 'Cierre de sesión',
    'UPLOAD': 'Subir',
    'DOWNLOAD': 'Descargar',
    'SHARE': 'Compartir',
    'COMMENT': 'Comentar',
  };
  return labels[type] || type;
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

interface AuditActivitiesListProps {
  initialData: PaginatedActivities;
  retentionDays: number;
  userName: string;
  userEmail: string;
}

// Función para exportar a Excel (CSV)
function exportToExcel(activities: Activity[], userName: string, userEmail: string) {
  // Encabezados (orden: Fecha y Hora, Usuario, Descripción, Acción, Entidad)
  const headers = ['Fecha y Hora', 'Usuario', 'Descripción', 'Acción', 'Entidad'];
  
  // Convertir actividades a filas CSV
  const rows = activities.map(activity => [
    formatFullDate(activity.created_at),
    userName || userEmail || 'Usuario',
    activity.description,
    getActivityTypeLabel(activity.type),
    activity.entity_type || '-',
  ]);

  // Crear contenido CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Crear BOM para UTF-8 (Excel lo necesita)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Crear enlace de descarga
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `actividades_auditoria_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function AuditActivitiesList({ initialData, retentionDays, userName, userEmail }: AuditActivitiesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', newPage.toString());
    }
    router.push(`/protected/configuracion/auditoria?${params.toString()}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', newSize.toString());
    params.delete('page'); // Reset to first page
    router.push(`/protected/configuracion/auditoria?${params.toString()}`);
  };

  const handleExport = () => {
    exportToExcel(initialData.activities, userName, userEmail);
  };

  const { activities, total, page, pageSize, totalPages } = initialData;

  // Calcular el rango de registros mostrados
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <Card className="border-none shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4 sm:gap-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Retención de logs: {retentionDays} días</span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {activities.length > 0 && (
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

        {activities.length === 0 ? (
          <div className="py-12 text-center">
            <ActivityIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No hay actividades registradas
            </p>
          </div>
        ) : (
          <>
            {/* Tabla de actividades */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Fecha y Hora
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Usuario
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground min-w-[200px]">
                      Descripción
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Acción
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Entidad
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => {
                    return (
                      <tr
                        key={activity.id}
                        className="border-b border-border hover:bg-accent/50 transition-colors"
                      >
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatFullDate(activity.created_at)}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-sm text-foreground">
                            {userName || 'Usuario'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <p className="text-sm text-foreground">
                            {activity.description}
                          </p>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <Badge 
                            variant={getActivityTypeColor(activity.type)}
                            className="text-xs border-none font-medium px-0"
                          >
                            {getActivityTypeLabel(activity.type)}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          {activity.entity_type ? (
                            <span className="text-sm text-muted-foreground capitalize">
                              {activity.entity_type}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startRecord} - {endRecord} de {total} actividades
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
    </Card>
  );
}

