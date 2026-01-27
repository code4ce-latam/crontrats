"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Save,
  X,
  ZoomIn,
  ZoomOut,
  Bell,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

export type ToolType = 'select' | 'highlight' | 'text' | 'comment';

interface AnnotationToolbarProps {
  selectedTool: ToolType;
  onToolChange: (tool: ToolType | 'zoom-in' | 'zoom-out') => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  mode: 'view' | 'annotate';
  currentColor: string;
  onColorChange: (color: string) => void;
  notifyParticipants: boolean;
  onNotifyChange: (notify: boolean) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
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
  onSave,
  onClose,
  isSaving,
  mode,
  currentColor,
  onColorChange,
  notifyParticipants,
  onNotifyChange,
  isMinimized = false,
  onToggleMinimize,
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
      <div className={`flex items-center justify-between border-b bg-background transition-all ${
        isMinimized ? 'p-2' : 'p-4'
      }`}>
        {isMinimized ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium text-muted-foreground">Herramientas minimizadas</span>
            {onToggleMinimize && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleMinimize}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Expandir herramientas</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium mr-2">Herramientas:</span>
              {onToggleMinimize && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onToggleMinimize}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Minimizar herramientas</p>
                  </TooltipContent>
                </Tooltip>
              )}
          
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
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border-r pr-3">
            <Checkbox
              id="notify-participants"
              checked={notifyParticipants}
              onCheckedChange={(checked) => onNotifyChange(checked === true)}
            />
            <label
              htmlFor="notify-participants"
              className="text-sm font-medium cursor-pointer flex items-center gap-1"
            >
              <Bell className="h-3.5 w-3.5" />
              Notificar a participantes
            </label>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>

          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

