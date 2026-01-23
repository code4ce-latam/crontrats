"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type WorkspaceInvite, type PaginatedInvitations } from "@/lib/supabase/invitations";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { 
  UserPlus,
  Clock, 
  ChevronLeft,
  ChevronRight,
  Download,
  ChevronDown,
  Mail,
  Send,
  Copy,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { InviteUserDialog } from "./invite-user-dialog";

// Función para obtener el color del badge según el estado
function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case 'PENDING':
      return 'secondary'; // Amarillo/naranja
    case 'ACCEPTED':
      return 'default'; // Verde
    case 'EXPIRED':
      return 'outline'; // Gris
    case 'REVOKED':
      return 'destructive'; // Rojo
    default:
      return 'outline';
  }
}

// Función para traducir el estado
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'PENDING': 'Pendiente',
    'ACCEPTED': 'Aceptada',
    'EXPIRED': 'Expirada',
    'REVOKED': 'Revocada',
  };
  return labels[status] || status;
}

// Función para traducir el rol
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'EDITOR': 'Editor',
    'READER': 'Lector',
  };
  return labels[role] || role;
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

interface InvitationsListProps {
  initialData: PaginatedInvitations;
  invitedByNames?: Record<string, string>;
}

// Función para exportar a Excel (CSV)
function exportToExcel(invitations: WorkspaceInvite[]) {
  // Encabezados
  const headers = ['Fecha y Hora', 'Email', 'Nombre', 'Rol', 'Estado', 'Invitado por'];
  
  // Convertir invitaciones a filas CSV
  const rows = invitations.map(invite => [
    formatFullDate(invite.invited_at),
    invite.email,
    invite.display_name || '-',
    getRoleLabel(invite.role),
    getStatusLabel(invite.status),
    invite.invited_by_user_id || '-', // Por ahora solo el ID, luego se puede mejorar
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
  link.setAttribute('download', `invitaciones_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function InvitationsList({ initialData, invitedByNames: initialInvitedByNames = {} }: InvitationsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invitedByNames, setInvitedByNames] = useState<Record<string, string>>(initialInvitedByNames);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [confirmResendDialog, setConfirmResendDialog] = useState<{ open: boolean; invite: WorkspaceInvite | null }>({
    open: false,
    invite: null,
  });

  // Obtener nombres de usuarios que invitaron
  useEffect(() => {
    async function fetchInvitedByNames() {
      const supabase = createClient();
      const userIds = [...new Set(initialData.invitations.map(inv => inv.invited_by_user_id))];
      
      if (userIds.length === 0) return;

      // Obtener el workspace_id del usuario actual
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'ACTIVE')
        .limit(1)
        .maybeSingle();

      if (!membership?.workspace_id) return;

      // Obtener todos los miembros del workspace que son los que invitaron
      const { data: workspaceMembers, error } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', membership.workspace_id)
        .eq('status', 'ACTIVE')
        .in('user_id', userIds);

      if (error) {
        console.error("[InvitationsList] Error obteniendo miembros del workspace:", error);
        return;
      }

      const names: Record<string, string> = { ...invitedByNames };

      // Para cada usuario que invitó, obtener su información
      for (const userId of userIds) {
        // Si ya tenemos el nombre y no es un placeholder, no hacer nada
        if (names[userId] && !names[userId].endsWith('...')) {
          continue;
        }

        // Si es el usuario actual, usar su información directamente
        if (userId === currentUser.id) {
          const userName = 
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            `${currentUser.user_metadata?.first_name || ''} ${currentUser.user_metadata?.last_name || ''}`.trim() ||
            currentUser.email?.split("@")[0] ||
            "Usuario";
          names[userId] = userName;
          continue;
        }

        // Verificar si el usuario está en el workspace
        const isInWorkspace = workspaceMembers?.some(m => m.user_id === userId);
        
        if (isInWorkspace) {
          // Intentar obtener el nombre usando la función RPC
          try {
            const { data: userName, error: rpcError } = await supabase.rpc('get_user_display_name', {
              user_uuid: userId
            });

            if (!rpcError && userName) {
              names[userId] = userName;
            } else {
              // Si la función RPC falla, usar placeholder
              names[userId] = userId.substring(0, 8) + '...';
            }
          } catch (rpcError) {
            // Si la función RPC no existe o hay error, usar placeholder
            console.warn(`[InvitationsList] Error obteniendo nombre para usuario ${userId}:`, rpcError);
            names[userId] = userId.substring(0, 8) + '...';
          }
        } else {
          // Si no está en el workspace, usar placeholder
          names[userId] = userId.substring(0, 8) + '...';
        }
      }

      setInvitedByNames(names);
    }

    fetchInvitedByNames();
  }, [initialData.invitations]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', newPage.toString());
    }
    router.push(`/protected/configuracion/invitaciones?${params.toString()}`);
  };

  const handlePageSizeChange = (newSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', newSize.toString());
    params.delete('page'); // Reset to first page
    router.push(`/protected/configuracion/invitaciones?${params.toString()}`);
  };

  const handleExport = () => {
    exportToExcel(initialData.invitations);
  };

  const handleInviteUser = () => {
    setIsInviteDialogOpen(true);
  };

  const handleInviteSuccess = () => {
    // Refrescar la página para actualizar la lista
    router.refresh();
  };

  const handleConfirmResend = async () => {
    if (!confirmResendDialog.invite) return;
    
    const invite = confirmResendDialog.invite;
    setConfirmResendDialog({ open: false, invite: null });
    setResendingInviteId(invite.id);
    
    try {
      const response = await fetch("/api/invitations/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: invite.email,
          token: invite.token,
          displayName: invite.display_name,
          role: invite.role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al reenviar el correo");
      }

      // Refrescar la página para actualizar la lista
      router.refresh();
    } catch (err: any) {
      console.error('Error al reenviar invitación:', err);
      alert(err.message || "Error al reenviar el correo");
    } finally {
      setResendingInviteId(null);
    }
  };

  const { invitations, total, page, pageSize, totalPages } = initialData;

  // Calcular el rango de registros mostrados
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <Card className="border-none shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4 sm:gap-0">
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleInviteUser}
            className="h-8"
          >
            <UserPlus className="h-3.5 w-3.5 mr-2" />
            Invitar usuario
          </Button>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {invitations.length > 0 && (
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
        {invitations.length === 0 ? (
          <div className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No hay invitaciones registradas
            </p>
          </div>
        ) : (
          <>
            {/* Tabla de invitaciones */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Fecha y Hora
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Email
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground min-w-[150px]">
                      Nombre
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Rol
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Estado
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Invitado por
                    </th>
                    <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((invite) => {
                    const isPending = invite.status === 'PENDING';
                    const inviteUrl = typeof window !== 'undefined' 
                      ? `${window.location.origin}/auth/invite/${invite.token}`
                      : `/auth/invite/${invite.token}`;
                    
                    const handleCopyLink = async () => {
                      try {
                        await navigator.clipboard.writeText(inviteUrl);
                        setCopiedInviteId(invite.id);
                        setTimeout(() => setCopiedInviteId(null), 2000);
                      } catch (err) {
                        console.error('Error al copiar el enlace:', err);
                      }
                    };

                    const handleResendClick = () => {
                      // Abrir el diálogo de confirmación
                      setConfirmResendDialog({ open: true, invite });
                    };

                    return (
                      <tr
                        key={invite.id}
                        className="border-b border-border hover:bg-accent/50 transition-colors"
                      >
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatFullDate(invite.invited_at)}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-sm text-foreground">
                            {invite.email}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <span className="text-sm text-foreground">
                            {invite.display_name || '-'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <Badge 
                            variant="outline"
                            className="text-xs font-medium border-none"
                          >
                            {getRoleLabel(invite.role)}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <Badge 
                            variant={getStatusBadgeVariant(invite.status)}
                            className="text-xs font-medium"
                          >
                            {getStatusLabel(invite.status)}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">
                            {invitedByNames[invite.invited_by_user_id] || invite.invited_by_user_id.substring(0, 8) + '...'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          {isPending ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={handleResendClick}
                                  disabled={resendingInviteId === invite.id}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  {resendingInviteId === invite.id ? "Reenviando..." : "Reenviar"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCopyLink}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  {copiedInviteId === invite.id ? "¡Copiado!" : "Copiar link"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
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
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 px-4 pb-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startRecord} - {endRecord} de {total} invitaciones
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

      {/* Diálogo de Invitación */}
      <InviteUserDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onSuccess={handleInviteSuccess}
      />

      {/* Diálogo de Confirmación para Reenviar */}
      <Dialog 
        open={confirmResendDialog.open} 
        onOpenChange={(open) => setConfirmResendDialog({ open, invite: open ? confirmResendDialog.invite : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reenviar invitación?</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas reenviar la invitación a{" "}
              <strong>{confirmResendDialog.invite?.email}</strong>?
              <br />
              Se enviará un nuevo correo electrónico con el enlace de invitación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmResendDialog({ open: false, invite: null })}
              disabled={resendingInviteId === confirmResendDialog.invite?.id}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmResend}
              disabled={resendingInviteId === confirmResendDialog.invite?.id}
            >
              {resendingInviteId === confirmResendDialog.invite?.id ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

