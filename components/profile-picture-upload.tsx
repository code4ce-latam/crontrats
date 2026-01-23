"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ImageCropper } from "./image-cropper";
import { createActivity } from "@/lib/supabase/activities";

interface ProfilePictureUploadProps {
  currentAvatarUrl?: string | null;
}

// Función para comprimir y redimensionar imagen
function compressImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calcular nuevas dimensiones
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Crear canvas para redimensionar
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto del canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a blob con calidad reducida
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Error al comprimir la imagen"));
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Error al cargar la imagen"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsDataURL(file);
  });
}

// Función para obtener la URL del avatar (solo storage)
async function getAvatarUrl(avatarUrl: string | null | undefined): Promise<string | null> {
  if (!avatarUrl) return null;
  
  // Retornar la URL directamente (siempre será una URL de storage)
  return avatarUrl;
}

export function ProfilePictureUpload({
  currentAvatarUrl,
}: ProfilePictureUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Cargar preview inicial
  useEffect(() => {
    if (currentAvatarUrl) {
      getAvatarUrl(currentAvatarUrl).then((url) => {
        setPreview(url);
      });
    }
  }, [currentAvatarUrl]);

  const validateImage = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    // Validar tipo de archivo
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return { valid: false, error: "El archivo debe ser PNG, JPG o GIF" };
    }

    // Validar tamaño del archivo (max 10MB para permitir imágenes más grandes)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { valid: false, error: "El archivo no debe exceder 10MB" };
    }

    // No validar dimensiones aquí, se hará en el cropper
    return { valid: true };
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setSuccess(false);

    // Validar imagen
    const validation = await validateImage(file);
    if (!validation.valid) {
      setError(validation.error || "Error de validación");
      return;
    }

    // Crear preview y abrir cropper
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setImageToCrop(imageUrl);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    
    // Resetear input para permitir seleccionar el mismo archivo si el usuario cancela
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleCropComplete = useCallback(async (croppedFile: File) => {
    setError(null);
    setSuccess(false);
    setCropperOpen(false);
    setIsUploading(true);

    // Mostrar preview del recorte
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(croppedFile);

    try {
      const supabase = createClient();

      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No se pudo obtener la información del usuario");
      }

      // El archivo ya viene recortado del cropper (512×512px), solo necesitamos subirlo
      // Usar siempre el mismo nombre de archivo para este usuario para que se reemplace
      const fileName = `${user.id}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Subir nueva imagen a storage con upsert para reemplazar si existe
      // Esto reemplazará el archivo existente con el mismo nombre
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedFile, {
          cacheControl: '3600',
          upsert: true // Reemplaza el archivo si ya existe
        });

      if (uploadError) {
        throw new Error(`Error al subir la imagen a Storage: ${uploadError.message}`);
      }

      // Obtener URL pública de la imagen
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // Agregar timestamp a la URL para forzar la recarga del navegador y evitar cache
      const timestamp = Date.now();
      const avatarUrl = `${urlData.publicUrl}?t=${timestamp}`;

      // Guardar la URL en la tabla profiles (no en user_metadata)
      // Usar upsert para insertar o actualizar en una sola operación
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ 
          user_id: user.id, 
          avatar_url: avatarUrl 
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        throw upsertError;
      }

      // Registrar actividad de subida de avatar
      try {
        await createActivity(supabase, {
          type: 'UPLOAD',
          description: `Actualizó su foto de perfil`,
          entity_type: 'avatar',
          entity_id: user.id,
        });
      } catch (activityError) {
        console.error("[ProfilePictureUpload] Error registrando actividad:", activityError);
      }

      // Actualizar el preview con la nueva URL (con timestamp)
      setPreview(avatarUrl);
      
      setSuccess(true);
      
      // Pequeño delay antes de refrescar para asegurar que el archivo se haya procesado
      setTimeout(() => {
        router.refresh();
      }, 500);

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Error al subir la imagen");
      // Si hay error, mantener el preview actual
      if (currentAvatarUrl) {
        getAvatarUrl(currentAvatarUrl).then((url) => {
          setPreview(url);
        });
      } else {
        setPreview(null);
      }
    } finally {
      setIsUploading(false);
    }
  }, [currentAvatarUrl, router]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleAreaClick = () => {
    // Resetear el valor del input para permitir seleccionar el mismo archivo nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  };

  const handleRemoveImage = async () => {
    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();
      
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No se pudo obtener la información del usuario");
      }

      // Limpiar localStorage de avatares antiguos
      if (typeof window !== "undefined") {
        try {
          // Eliminar cualquier avatar guardado en localStorage con este user_id
          localStorage.removeItem(`avatar_${user.id}`);
          // También eliminar cualquier otro formato que pueda existir
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('avatar_')) {
              localStorage.removeItem(key);
            }
          });
        } catch (err) {
          console.warn("Error limpiando localStorage:", err);
        }
      }

      // Eliminar imagen de storage - usar nombre fijo del usuario
      const filePath = `avatars/${user.id}.jpg`;
      
      try {
        // Intentar eliminar el archivo con nombre fijo (formato nuevo)
        const { error: removeError } = await supabase.storage
          .from('avatars')
          .remove([filePath]);

        // Si hay error y es porque no existe, intentar con formato antiguo
        if (removeError) {
          // Buscar todos los archivos del usuario y eliminarlos
          const { data: files } = await supabase.storage
            .from('avatars')
            .list('avatars', {
              search: user.id
            });

          if (files && files.length > 0) {
            const filesToDelete = files
              .filter(file => file.name.startsWith(user.id))
              .map(file => `avatars/${file.name}`);
            
            if (filesToDelete.length > 0) {
              await supabase.storage.from('avatars').remove(filesToDelete);
            }
          }
        }
      } catch (err) {
        // Continuar aunque falle la eliminación del storage
        console.warn("Error eliminando avatar de storage:", err);
      }

      // Eliminar avatar_url de la tabla profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

          if (updateError) {
            throw updateError;
          }

          // Registrar actividad de eliminación de avatar
          try {
            await createActivity(supabase, {
              type: 'DELETE',
              description: `Eliminó su foto de perfil`,
              entity_type: 'avatar',
              entity_id: user.id,
            });
          } catch (activityError) {
            console.error("[ProfilePictureUpload] Error registrando actividad:", activityError);
          }

          setPreview(null);
          setSuccess(true);
          router.refresh();

          setTimeout(() => {
            setSuccess(false);
          }, 3000);
    } catch (err: any) {
      setError(err.message || "Error al eliminar la imagen");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Área de carga */}
      <div
        onClick={handleAreaClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
      >
        {preview ? (
          <div className="relative group">
            <img
              key={preview}
              src={preview}
              alt="Preview"
              className="mx-auto max-h-64 max-w-full rounded-lg object-contain"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage();
                }}
                className="z-10"
              >
                <X className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-accent">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Subir imagen</p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG o GIF (hasta 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
          La imagen se ha actualizado correctamente.
        </div>
      )}

      {isUploading && (
        <div className="mt-4 p-3 rounded-md bg-muted text-sm text-center">
          Subiendo imagen...
        </div>
      )}

      {/* Cropper Modal */}
      {imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          isOpen={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setImageToCrop(null);
          }}
          onCrop={handleCropComplete}
          aspectRatio={1}
          outputSize={{ width: 512, height: 512 }}
        />
      )}
    </div>
  );
}

