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
  currentColor: string;
  onColorChange: (color: string) => void;
}

const COLORS = [
  { value: '#000000', label: 'Negro' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#eab308', label: 'Amarillo' },
];

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
  currentColor,
  onColorChange,
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

          <div className="flex items-center gap-2 border-l pl-4 ml-2 mr-2">
            <span className="text-sm font-medium mr-1">Color:</span>
            {COLORS.map((color) => (
              <Tooltip key={color.value}>
                <TooltipTrigger asChild>
                  <button
                    className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                      currentColor === color.value ? 'ring-2 ring-offset-2 ring-black dark:ring-white' : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => onColorChange(color.value)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{color.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

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

