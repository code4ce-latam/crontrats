"use client";

import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  MousePointer2, 
  Highlighter, 
  Type, 
  MessageSquare, 
  Trash2,
  Save,
  Send,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type ToolType = 'select' | 'highlight' | 'text' | 'comment';

interface AnnotationToolbarProps {
  selectedTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onDelete: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onClose: () => void;
  hasSelectedAnnotation: boolean;
  isSaving: boolean;
  mode: 'view' | 'annotate';
}

export function AnnotationToolbar({
  selectedTool,
  onToolChange,
  onDelete,
  onSaveDraft,
  onPublish,
  onClose,
  hasSelectedAnnotation,
  isSaving,
  mode,
}: AnnotationToolbarProps) {
  if (mode === 'view') {
    return (
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Modo visualización</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-2" />
          Cerrar
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium mr-2">Herramientas:</span>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === 'select' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToolChange('select')}
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Seleccionar (V)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === 'highlight' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToolChange('highlight')}
              >
                <Highlighter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Resaltar texto (H)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToolChange('text')}
              >
                <Type className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Agregar texto (T)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === 'comment' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToolChange('comment')}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Agregar comentario (C)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === 'zoom-in' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToolChange('zoom-in')}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Acercar (+)</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectedTool === 'zoom-out' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onToolChange('zoom-out')}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Alejar (-)</p>
            </TooltipContent>
          </Tooltip>

          {hasSelectedAnnotation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Eliminar selección (Supr)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveDraft}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar borrador
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Guardar cambios sin publicar</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onPublish}
                disabled={isSaving}
              >
                <Send className="h-4 w-4 mr-2" />
                Publicar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Publicar anotaciones para que otros las vean</p>
            </TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

