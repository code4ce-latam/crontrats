"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UploadVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  onSuccess: () => void;
}

export function UploadVersionDialog({
  open,
  onOpenChange,
  contractId,
  onSuccess,
}: UploadVersionDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Por favor selecciona un archivo");
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Paso 1: Obtener signed URL
      const uploadUrlResponse = await fetch("/api/contracts/main/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contract_id: contractId,
          original_name: file.name,
          mime_type: file.type,
        }),
      });

      if (!uploadUrlResponse.ok) {
        const errorData = await uploadUrlResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al obtener URL de upload");
      }

      const { storage_path, signed_url, version } = await uploadUrlResponse.json();

      if (!storage_path) {
        throw new Error("No se recibió el storage_path correctamente");
      }

      // Paso 2: Subir archivo a Supabase Storage directamente
      // Usar el cliente de Supabase con las políticas RLS
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(storage_path, file, {
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error("[UploadVersionDialog] Error en upload:", uploadError);
        throw new Error(uploadError.message || "Error al subir el archivo");
      }

      setProgress(50);

      // Paso 3: Confirmar upload
      const confirmResponse = await fetch("/api/contracts/main/confirm-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contract_id: contractId,
          storage_path,
          version,
          size: file.size,
          mime_type: file.type,
          original_name: file.name,
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al confirmar el upload");
      }

      setProgress(100);

      // Limpiar y cerrar
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("[UploadVersionDialog] Error:", err);
      setError(err.message || "Error al subir el archivo");
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFile(null);
      setError(null);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subir nueva versión</DialogTitle>
          <DialogDescription>
            Selecciona el archivo del documento principal del contrato
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Archivo</Label>
            <div className="mt-2">
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={isUploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx"
              />
            </div>
            {file && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subiendo...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
          >
            {isUploading ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Subir versión
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

