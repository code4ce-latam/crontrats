"use client";

import { useMemo, useState, useRef } from "react";
import type { Annotation } from "@/lib/annotations/types";
import { normalizedToPixels } from "@/lib/annotations/normalize";
import { DraggableAnnotation } from "./draggable-annotation";

interface AnnotationOverlayProps {
  annotations: Annotation[];
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  selectedAnnotationId: string | null;
  onAnnotationClick?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotation: Annotation) => void;
  mode: 'view' | 'annotate';
  currentTool?: string;
  currentUserId: string;
}

export function AnnotationOverlay({
  annotations,
  currentPage,
  pageWidth,
  pageHeight,
  scale,
  selectedAnnotationId,
  onAnnotationClick,
  onAnnotationUpdate,
  onAnnotationDelete,
  mode,
  currentTool,
  currentUserId,
}: AnnotationOverlayProps) {
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const pageAnnotations = useMemo(() => {
    return annotations.filter(ann => ann.page === currentPage);
  }, [annotations, currentPage]);

  const handleAnnotationClick = (annotation: Annotation, e: React.MouseEvent) => {
    e.stopPropagation();
    // Solo permitir selección si es modo annotate y la anotación es propia
    if (onAnnotationClick && mode === 'annotate' && annotation.createdByUserId === currentUserId) {
      onAnnotationClick(annotation);
      // Si es un cuadro de texto nuevo (sin texto), activar edición inmediatamente
      if ((annotation.type === 'TEXT' || annotation.type === 'COMMENT') && !annotation.text) {
        setEditingAnnotationId(annotation.id);
        setEditingText('');
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleTextChange = (annotation: Annotation, newText: string) => {
    setEditingText(newText);
    if (onAnnotationUpdate) {
      onAnnotationUpdate({
        ...annotation,
        text: newText,
      });
    }
  };

  const handleTextBlur = (annotation: Annotation) => {
    if (onAnnotationUpdate) {
      onAnnotationUpdate({
        ...annotation,
        text: editingText,
      });
    }
    setEditingAnnotationId(null);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent, annotation: Annotation) => {
    // Permitir Enter normal para nueva línea.
    // Usar Ctrl + Enter para guardar y salir.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTextBlur(annotation);
    } else if (e.key === 'Escape') {
      setEditingAnnotationId(null);
      setEditingText(annotation.text || '');
    }
  };

  const handleDoubleClick = (annotation: Annotation, e: React.MouseEvent) => {
    if (mode === 'annotate' && (annotation.type === 'TEXT' || annotation.type === 'COMMENT')) {
      e.stopPropagation();
      setEditingAnnotationId(annotation.id);
      setEditingText(annotation.text || '');
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div 
      className="absolute inset-0" 
      style={{ 
        transform: `scale(${scale})`, 
        transformOrigin: 'top left',
        pointerEvents: 'none',
        touchAction: 'none', // Importante para Pointer Events en móviles
        zIndex: 20, // Asegurar que esté sobre el PDF y el overlay de eventos
      }}
    >
      {pageAnnotations.map((annotation) => {
        const isSelected = selectedAnnotationId === annotation.id;
        const isEditing = editingAnnotationId === annotation.id;

        // Usar DraggableAnnotation para TEXT y COMMENT
        if (annotation.type === 'TEXT' || annotation.type === 'COMMENT') {
          return (
            <DraggableAnnotation
              key={annotation.id}
              annotation={annotation}
              pageWidth={pageWidth}
              pageHeight={pageHeight}
              scale={scale}
              isSelected={isSelected}
              isEditing={isEditing}
              editingText={isEditing ? editingText : ''}
              onSelect={handleAnnotationClick}
              onUpdate={(updated) => {
                if (onAnnotationUpdate) {
                  onAnnotationUpdate(updated);
                }
              }}
              onDelete={(ann) => {
                if (onAnnotationDelete) {
                  onAnnotationDelete(ann);
                }
              }}
              onDoubleClick={handleDoubleClick}
              onTextChange={handleTextChange}
              onTextBlur={handleTextBlur}
              onTextKeyDown={handleTextKeyDown}
              mode={mode}
              currentTool={currentTool}
              textInputRef={textInputRef}
            />
          );
        }

        // HIGHLIGHT
        // Si tiene points, es dibujo libre
        if (annotation.points && annotation.points.length > 0) {
          const pointsString = annotation.points
            .map(p => `${p.x * pageWidth},${p.y * pageHeight}`)
            .join(' ');
            
          return (
            <svg
              key={annotation.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none', // Permitir clic a través del SVG
                zIndex: isSelected ? 10 : 1,
              }}
            >
              <polyline
                points={pointsString}
                fill="none"
                stroke={annotation.color || '#FFEB3B'}
                strokeWidth={20} // Grosor fijo por ahora, o relativo si se guardó
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={annotation.opacity || 0.5}
                style={{ cursor: mode === 'annotate' ? 'pointer' : 'default', pointerEvents: 'auto' }} // Permitir eventos en el trazo
                onClick={(e) => handleAnnotationClick(annotation, e as any)}
              />
              {isSelected && (
                <polyline
                  points={pointsString}
                  fill="none"
                  stroke="#2196F3"
                  strokeWidth={1}
                  opacity={1}
                />
              )}
            </svg>
          );
        }

        // HIGHLIGHT rectangular (legacy o creado de otra forma)
        const pixels = normalizedToPixels(annotation.rect, pageWidth, pageHeight);
        return (
          <div
            key={annotation.id}
            onClick={(e) => handleAnnotationClick(annotation, e)}
            style={{
              position: 'absolute',
              left: `${pixels.x}px`,
              top: `${pixels.y}px`,
              width: `${pixels.width}px`,
              height: `${pixels.height}px`,
              backgroundColor: annotation.color || '#FFEB3B',
              opacity: annotation.opacity || 0.5,
              border: isSelected ? '2px solid #2196F3' : 'none',
              pointerEvents: mode === 'annotate' ? 'auto' : 'none',
              cursor: mode === 'annotate' ? 'pointer' : 'default',
              zIndex: isSelected ? 10 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

