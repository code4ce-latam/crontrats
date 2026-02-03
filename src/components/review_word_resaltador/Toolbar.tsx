"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ToolMode } from "@/types/comments";

type ToolbarProps = {
  toolMode: ToolMode;
  commentsCount: number;
  onChangeMode: (mode: ToolMode) => void;
  onUploadWord: (file: File | null) => void;
  highlightMode: boolean;
  onToggleHighlightMode: () => void;
};

export function Toolbar({
  toolMode,
  commentsCount,
  onChangeMode,
  onUploadWord,
  highlightMode,
  onToggleHighlightMode,
}: ToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 gap-3">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="sm"
                variant={toolMode === "ANCHOR" ? "default" : "outline"}
                className={cn(
                  "px-3 text-xs",
                  toolMode === "ANCHOR" && "shadow-sm"
                )}
                onClick={() =>
                  onChangeMode(toolMode === "ANCHOR" ? "SELECT" : "ANCHOR")
                }
              >
                Anclar comentario
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Activa o desactiva el modo para crear nuevos anclajes en el documento
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
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
        </TooltipProvider>

        <Button
          size="sm"
          variant="secondary"
          className="px-3 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          Cargar Word (.docx)
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onUploadWord(file);
            // permitir volver a seleccionar el mismo archivo
            e.target.value = "";
          }}
        />
      </div>

      <div className="text-xs text-zinc-600">
        Comentarios: <span className="font-semibold">{commentsCount}</span>
      </div>
    </div>
  );
}

