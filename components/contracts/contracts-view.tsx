"use client";

import { useState, useEffect } from "react";
import { type FolderTreeItem } from "@/lib/supabase/folders";
import { FolderTree } from "../folders/folder-tree";
import { ContractsList } from "./contracts-list";

interface ContractsViewProps {
  initialTree: FolderTreeItem[];
  workspaceId: string;
}

export function ContractsView({ initialTree, workspaceId }: ContractsViewProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [tree, setTree] = useState<FolderTreeItem[]>(initialTree);

  // Sincronizar el estado cuando cambia initialTree
  useEffect(() => {
    setTree(initialTree);
  }, [initialTree]);

  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const handleTreeRefresh = async () => {
    try {
      const response = await fetch(`/api/folders/tree?workspace_id=${workspaceId}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setTree(data.tree || []);
      }
    } catch (error) {
      console.error("[ContractsView] Error refrescando árbol:", error);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 min-h-[600px]">
        {/* Columna izquierda: Árbol de carpetas */}
        <div className="md:col-span-1 border-r border-border p-4 overflow-y-auto">
          <FolderTree
            initialTree={tree}
            selectedFolderId={selectedFolderId}
            onFolderSelect={handleFolderSelect}
            onTreeChange={setTree}
            workspaceId={workspaceId}
          />
        </div>

        {/* Columna derecha: Lista de contratos */}
        <div className="md:col-span-2 p-4 overflow-y-auto">
          {selectedFolderId ? (
            <ContractsList
              folderId={selectedFolderId}
              workspaceId={workspaceId}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">Selecciona una carpeta</p>
                <p className="text-sm mt-2">Elige una carpeta del árbol para ver sus contratos</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

