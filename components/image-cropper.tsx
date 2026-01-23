"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Minus, Plus, Move } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface ImageCropperProps {
  image: string;
  isOpen: boolean;
  onClose: () => void;
  onCrop: (croppedImage: File) => void;
  aspectRatio?: number; // 1 para cuadrado
  outputSize?: { width: number; height: number };
}

export function ImageCropper({
  image,
  isOpen,
  onClose,
  onCrop,
  aspectRatio = 1,
  outputSize = { width: 512, height: 512 },
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(null);
  
  // Tamaño del área visible de recorte (viewport)
  const CROP_AREA_SIZE = 300;

  // Resetear estado cuando el dialog se abre/cierra o cambia la imagen
  useEffect(() => {
    if (isOpen && image) {
      // Si la imagen cambió, resetear todo el estado
      if (currentImageSrc !== image) {
        setCurrentImageSrc(image);
        setPosition({ x: 0, y: 0 });
        setZoom(1);
        setMinZoom(1);
        setImageSize({ width: 0, height: 0 });
        setIsDragging(false);
        setDragStart({ x: 0, y: 0 });
      }
    } else if (!isOpen) {
      // Limpiar cuando se cierra
      setCurrentImageSrc(null);
    }
  }, [isOpen, image, currentImageSrc]); 

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImageSize({ width: naturalWidth, height: naturalHeight });
    
    // Calcular zoom mínimo para cubrir el área
    // La imagen debe cubrir al menos el área de recorte (300px)
    const minZoomWidth = CROP_AREA_SIZE / naturalWidth;
    const minZoomHeight = CROP_AREA_SIZE / naturalHeight;
    const newMinZoom = Math.max(minZoomWidth, minZoomHeight);
    
    setMinZoom(newMinZoom);
    setZoom(newMinZoom); // Iniciar con el zoom mínimo para ver toda la imagen posible
    
    // Centrar imagen
    setPosition({
      x: (CROP_AREA_SIZE - naturalWidth * newMinZoom) / 2,
      y: (CROP_AREA_SIZE - naturalHeight * newMinZoom) / 2
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Restricciones para no dejar áreas vacías
    const width = imageSize.width * zoom;
    const height = imageSize.height * zoom;
    
    // La imagen no puede moverse más allá de sus bordes dentro del viewport
    // x no puede ser mayor que 0 (borde izquierdo)
    // x no puede ser menor que CROP_AREA_SIZE - width (borde derecho)
    const boundedX = Math.min(0, Math.max(newX, CROP_AREA_SIZE - width));
    const boundedY = Math.min(0, Math.max(newY, CROP_AREA_SIZE - height));

    setPosition({ x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (value: number) => {
    const newZoom = value;
    setZoom(newZoom);
    
    // Ajustar posición para mantener el centro (aproximado) o restringir bordes
    // Para simplificar, simplemente reaplicamos las restricciones con el nuevo zoom
    // en el próximo movimiento o render, pero mejor hacerlo aquí:
    
    const width = imageSize.width * newZoom;
    const height = imageSize.height * newZoom;
    
    // Recalcular posición para mantener la imagen dentro del marco
    setPosition(prev => ({
      x: Math.min(0, Math.max(prev.x, CROP_AREA_SIZE - width)),
      y: Math.min(0, Math.max(prev.y, CROP_AREA_SIZE - height))
    }));
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageSize.width || !imageSize.height || !image) {
      console.error("No se puede recortar: faltan datos", {
        canvas: !!canvas,
        imageSize,
        image: !!image
      });
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("No se pudo obtener el contexto del canvas");
      return;
    }

    // Configurar canvas de salida
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;

    // Usar la imagen actual que se está mostrando (asegurarse de usar la imagen correcta)
    const img = new Image();
    img.crossOrigin = "anonymous";
    // Usar la imagen que se pasó como prop (asegurarse de que sea la correcta)
    img.src = image;
    
    img.onload = () => {
      // Verificar que las dimensiones coincidan con imageSize
      if (img.naturalWidth !== imageSize.width || img.naturalHeight !== imageSize.height) {
        console.warn("Las dimensiones de la imagen no coinciden", {
          actual: { width: img.naturalWidth, height: img.naturalHeight },
          expected: imageSize
        });
        // Actualizar imageSize con las dimensiones reales
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
      // Calcular correctamente las coordenadas de recorte
      // La imagen está escalada por zoom, entonces:
      // - El tamaño visible de la imagen es: imageSize.width * zoom x imageSize.height * zoom
      // - El área de recorte visible es: CROP_AREA_SIZE x CROP_AREA_SIZE (300x300)
      // - position.x y position.y son los desplazamientos desde el origen (0,0)
      
      // Calcular el tamaño de la imagen escalada
      const scaledWidth = imageSize.width * zoom;
      const scaledHeight = imageSize.height * zoom;
      
      // Calcular la posición del área de recorte relativa a la imagen escalada
      // position.x es negativo cuando la imagen está desplazada a la izquierda
      // Necesitamos la posición relativa al origen de la imagen escalada
      const cropAreaXInScaledImage = -position.x;
      const cropAreaYInScaledImage = -position.y;
      
      // Convertir las coordenadas del área de recorte a coordenadas de la imagen original
      // Dividimos por zoom porque necesitamos coordenadas en la imagen original
      const sourceX = (cropAreaXInScaledImage / zoom);
      const sourceY = (cropAreaYInScaledImage / zoom);
      const sourceWidth = CROP_AREA_SIZE / zoom;
      const sourceHeight = CROP_AREA_SIZE / zoom;
      
      // Asegurarse de que las coordenadas estén dentro de los límites de la imagen original
      const finalSourceX = Math.max(0, Math.min(sourceX, imageSize.width - sourceWidth));
      const finalSourceY = Math.max(0, Math.min(sourceY, imageSize.height - sourceHeight));
      const finalSourceWidth = Math.min(sourceWidth, imageSize.width - finalSourceX);
      const finalSourceHeight = Math.min(sourceHeight, imageSize.height - finalSourceY);

      // Dibujar en el canvas redimensionando
      ctx.drawImage(
        img,
        finalSourceX,
        finalSourceY,
        finalSourceWidth,
        finalSourceHeight,
        0,
        0,
        outputSize.width,
        outputSize.height
      );

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "avatar.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          onCrop(file);
          onClose();
        }
      }, "image/jpeg", 0.9);
    };
    
    img.onerror = () => {
      console.error("Error al cargar la imagen para recortar");
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
          <DialogDescription>
            Arrastra para mover y usa el control deslizante para hacer zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4 select-none">
          {/* Área de recorte con máscara */}
          <div 
            className="relative overflow-hidden bg-black rounded-full shadow-xl border-4 border-white"
            style={{ 
              width: CROP_AREA_SIZE, 
              height: CROP_AREA_SIZE,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              key={image} // Forzar re-render cuando cambia la imagen
              src={image}
              alt="Crop preview"
              onLoad={(e) => {
                imgRef.current = e.currentTarget;
                handleImageLoad(e);
              }}
              draggable={false}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'top left',
                width: imageSize.width || 'auto',
                height: imageSize.height || 'auto',
                maxWidth: 'none',
                maxHeight: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />
            
            {/* Guía visual (opcional) */}
            <div className="absolute inset-0 pointer-events-none rounded-full border border-white/20"></div>
          </div>

          {/* Controles */}
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <Minus className="h-4 w-4" onClick={() => handleZoomChange(Math.max(minZoom, zoom - 0.1))} />
              <span>Zoom</span>
              <Plus className="h-4 w-4" onClick={() => handleZoomChange(Math.min(minZoom * 3, zoom + 0.1))} />
            </div>
            <input 
              type="range"
              min={minZoom}
              max={minZoom * 3}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCrop}>Guardar foto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
