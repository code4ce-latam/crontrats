"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Plus, FileText, Edit } from "lucide-react";
import { getStatusLabel, getStatusBadgeVariant } from "@/lib/contracts-utils";
import { Badge } from "../ui/badge";
import { getFolderAccess } from "@/lib/supabase/folders";
import { createClient } from "@/lib/supabase/client";

interface Contract {
  id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string | null;
  profile: {
    id: string;
    name: string;
  } | null;
}

interface ContractsListProps {
  folderId: string;
  workspaceId: string;
}

export function ContractsList({ folderId, workspaceId }: ContractsListProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    loadContracts();
    checkPermissions();
  }, [folderId]);

  const loadContracts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/contracts/list?folder_id=${folderId}`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts || []);
      }
    } catch (error) {
      console.error("[ContractsList] Error cargando contratos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const supabase = createClient();
      const access = await getFolderAccess(supabase, folderId);
      setCanCreate(access === 'EDIT' || access === 'OWNER');
    } catch (error) {
      console.error("[ContractsList] Error verificando permisos:", error);
      setCanCreate(false);
    }
  };

  const handleCreateContract = () => {
    router.push(`/protected/contratos/nuevo?folder_id=${folderId}`);
  };

  const handleViewContract = (contractId: string) => {
    router.push(`/protected/contratos/${contractId}`);
  };

  const handleEditContract = (contractId: string) => {
    router.push(`/protected/contratos/${contractId}/editar`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Cargando contratos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Contratos</h2>
        {canCreate && (
          <Button onClick={handleCreateContract} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo contrato
          </Button>
        )}
      </div>

      {contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No hay contratos en esta carpeta
          </p>
          {canCreate && (
            <Button onClick={handleCreateContract} className="mt-4" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Crear primer contrato
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleViewContract(contract.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{contract.title}</h3>
                    <Badge variant={getStatusBadgeVariant(contract.status as any)}>
                      {getStatusLabel(contract.status as any)}
                    </Badge>
                  </div>
                  {contract.profile && (
                    <p className="text-sm text-muted-foreground mb-1">
                      Perfil: {contract.profile.name}
                    </p>
                  )}
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>
                      Inicio: {new Date(contract.start_date).toLocaleDateString('es-ES')}
                    </span>
                    {contract.end_date && (
                      <span>
                        Fin: {new Date(contract.end_date).toLocaleDateString('es-ES')}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditContract(contract.id);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

