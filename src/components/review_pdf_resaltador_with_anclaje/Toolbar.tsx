"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ToolMode } from "@/types/comments";
import { ZoomIn, ZoomOut, RotateCw, Hand } from "lucide-react";
import { useCallback, useMemo } from "react";

type ToolbarProps = {
  toolMode: ToolMode;
  commentsCount: number;
  onChangeMode: (mode: ToolMode) => void;
  onUploadPdf: (file: File | null) => void;
  highlightMode: boolean;
  onToggleHighlightMode: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
};

export function Toolbar({
  toolMode,
  commentsCount,
  onChangeMode,
  onUploadPdf,
  highlightMode,
  onToggleHighlightMode,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: ToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  
  // Memoizar el porcentaje de zoom para evitar re-renders innecesarios
  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);
  
  // Memoizar los handlers de zoom para evitar recrearlos
  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onZoomIn();
  }, [onZoomIn]);
  
  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onZoomOut();
  }, [onZoomOut]);
  
  const handleZoomReset = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onZoomReset();
  }, [onZoomReset]);

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 gap-3">
        <div className="flex items-center gap-2">
          {/* Controles de zoom a la izquierda */}
          <div className="flex items-center gap-1 border-r border-zinc-200 pr-3 mr-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 flex items-center justify-center"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              type="button"
            >
              <ZoomOut className="h-4 w-4 flex-shrink-0" />
            </Button>
            
            <span className="min-w-[60px] text-center text-xs font-medium text-zinc-700 select-none">
              {zoomPercentage}%
            </span>
            
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 flex items-center justify-center"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              type="button"
            >
              <ZoomIn className="h-4 w-4 flex-shrink-0" />
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 flex items-center justify-center"
              onClick={handleZoomReset}
              type="button"
            >
              <RotateCw className="h-4 w-4 flex-shrink-0" />
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={toolMode === "PAN" ? "default" : "outline"}
                  className={cn(
                    "h-7 w-7 p-0 flex items-center justify-center",
                    toolMode === "PAN" && "shadow-sm bg-blue-500 hover:bg-blue-600 text-white"
                  )}
                  onClick={() => onChangeMode(toolMode === "PAN" ? "SELECT" : "PAN")}
                >
                  <Hand className="h-4 w-4 flex-shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Activa el modo de desplazamiento para mover el documento cuando hay zoom
              </TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={highlightMode ? "default" : "outline"}
                className={cn(
                  "px-3 text-xs",
                  highlightMode && "shadow-sm bg-yellow-500 hover:bg-yellow-600 text-white"
                )}
                onClick={onToggleHighlightMode}
              >
                Resaltar texto
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Activa o desactiva el modo para resaltar texto en el documento (independiente de comentarios)
            </TooltipContent>
          </Tooltip>

          <Button
            size="sm"
            variant="secondary"
            className="px-3 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            Cargar PDF
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onUploadPdf(file);
              // permitir volver a seleccionar el mismo archivo
              e.target.value = "";
            }}
          />
        </div>

        <div className="text-xs text-zinc-600">
          Comentarios: <span className="font-semibold">{commentsCount}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
