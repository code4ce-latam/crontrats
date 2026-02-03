"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ToolMode } from "@/types/document-annotations";
import { MessageSquare, Loader2 } from "lucide-react";

type WordAnnotatorToolbarProps = {
  toolMode: ToolMode;
  commentsCount: number;
  onChangeMode: (mode: ToolMode) => void;
  highlightMode: boolean;
  onToggleHighlightMode: () => void;
  isSaving?: boolean;
};

export function WordAnnotatorToolbar({
  toolMode,
  commentsCount,
  onChangeMode,
  highlightMode,
  onToggleHighlightMode,
  isSaving = false,
}: WordAnnotatorToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 md:px-8 py-2 gap-3">
      <div className="flex items-center gap-2">
        <TooltipProvider>
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
        </TooltipProvider>
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
  );
}

