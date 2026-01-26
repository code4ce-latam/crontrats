"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, Download, Edit } from "lucide-react";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/contracts-utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface Contract {
  id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string | null;
  updated_at: string;
  profile: {
    id: string;
    name: string;
  } | null;
  folder: {
    id: string;
    name: string;
    path: string;
  } | null;
}

interface AllContractsListProps {
  workspaceId: string;
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
  });
}

// Función para formatear fecha corta
function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Función para exportar a Excel (CSV)
function exportToExcel(contracts: Contract[]) {
  const headers = ['Título', 'Carpeta', 'Estado', 'Fecha Inicio', 'Fecha Fin', 'Última Actualización'];
  
  const rows = contracts.map(contract => [
    contract.title,
    contract.folder?.name || '-',
    getStatusLabel(contract.status as any),
    formatShortDate(contract.start_date),
    contract.end_date ? formatShortDate(contract.end_date) : '-',
    formatFullDate(contract.updated_at),
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `contratos_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function AllContractsList({ workspaceId }: AllContractsListProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/contracts/all', {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error("[AllContractsList] Error cargando contratos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewContract = (contractId: string) => {
    router.push(`/protected/contratos/${contractId}`);
  };

  const handleEditContract = (e: React.MouseEvent, contractId: string) => {
    e.stopPropagation();
    router.push(`/protected/contratos/${contractId}/editar`);
  };

  const handleExport = () => {
    exportToExcel(contracts);
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-none">
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4 sm:gap-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Total: {contracts.length} {contracts.length === 1 ? 'contrato' : 'contratos'}
          </span>
        </div>
        {contracts.length > 0 && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8"
            >
              <Download className="h-3.5 w-3.5 mr-2" />
              Exportar
            </Button>
          </div>
        )}
      </div>
      <CardContent className="p-0">
        {contracts.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No tienes acceso a ningún contrato
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                    Título
                  </th>
                  <th className="text-left py-1.5 px-3 text-sm font-semibold text-foreground whitespace-nowrap">
                    Carpeta
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
                    onClick={() => handleViewContract(contract.id)}
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
                      <span className="text-sm text-foreground">
                        {contract.folder?.name || '-'}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <Badge 
                        variant={getStatusBadgeVariant(contract.status as any)}
                        className="text-xs font-medium"
                      >
                        {getStatusLabel(contract.status as any)}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">
                        {formatShortDate(contract.start_date)}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">
                        {contract.end_date ? formatShortDate(contract.end_date) : '-'}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <span className="text-sm text-muted-foreground">
                        {formatFullDate(contract.updated_at)}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={(e) => handleEditContract(e, contract.id)}
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
        )}
      </CardContent>
    </Card>
  );
}

