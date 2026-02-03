"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ToolMode } from "@/types/document-annotations";
import { ZoomIn, ZoomOut, RotateCw, Hand, MessageSquare, Loader2 } from "lucide-react";
import { useCallback, useMemo } from "react";

type PdfAnnotatorToolbarProps = {
  toolMode: ToolMode;
  commentsCount: number;
  onChangeMode: (mode: ToolMode) => void;
  highlightMode: boolean;
  onToggleHighlightMode: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  isSaving?: boolean;
};

export function PdfAnnotatorToolbar({
  toolMode,
  commentsCount,
  onChangeMode,
  highlightMode,
  onToggleHighlightMode,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  isSaving = false,
}: PdfAnnotatorToolbarProps) {
  const zoomPercentage = useMemo(() => Math.round(zoom * 100), [zoom]);
  
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
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 md:px-8 py-2 gap-3">
        <div className="flex items-center gap-2">
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={toolMode === "ANCHOR" ? "default" : "outline"}
                className={cn(
                  "px-3 text-xs",
                  toolMode === "ANCHOR" && "shadow-sm bg-blue-500 hover:bg-blue-600 text-white"
                )}
                onClick={() => onChangeMode(toolMode === "ANCHOR" ? "SELECT" : "ANCHOR")}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Anclar comentario
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Activa el modo para crear comentarios anclados en el documento
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-3">
          {isSaving && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Guardando...</span>
            </div>
          )}
          <div className="text-xs text-zinc-600">
            Comentarios: <span className="font-semibold">{commentsCount}</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

