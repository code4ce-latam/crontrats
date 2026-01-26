"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Annotation } from "@/lib/annotations/types";
import { normalizedToPixels, pixelsToNormalized } from "@/lib/annotations/normalize";

interface DraggableAnnotationProps {
  annotation: Annotation;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  isSelected: boolean;
  isEditing: boolean;
  editingText: string;
  onSelect: (annotation: Annotation, e: React.MouseEvent) => void;
  onUpdate: (updated: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
  onDoubleClick: (annotation: Annotation, e: React.MouseEvent) => void;
  onTextChange: (annotation: Annotation, text: string) => void;
  onTextBlur: (annotation: Annotation) => void;
  onTextKeyDown: (e: React.KeyboardEvent, annotation: Annotation) => void;
  mode: 'view' | 'annotate';
  currentTool?: string;
  textInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

const DraggableAnnotation = React.memo(function DraggableAnnotation({
  annotation,
  pageWidth,
  pageHeight,
  scale,
  isSelected,
  isEditing,
  editingText,
  onSelect,
  onUpdate,
  onDelete,
  onDoubleClick,
  onTextChange,
  onTextBlur,
  onTextKeyDown,
  mode,
  currentTool,
  textInputRef,
}: DraggableAnnotationProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
    offsetX: number; // Offset del cursor dentro del elemento
    offsetY: number; // Offset del cursor dentro del elemento
    pointerId: number | null;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    offsetX: 0,
    offsetY: 0,
    pointerId: null,
  });
  
  // Refs para almacenar los handlers y evitar dependencias circulares
  const handlersRef = useRef<{
    move: ((e: PointerEvent) => void) | null;
    up: ((e: PointerEvent) => void) | null;
  }>({
    move: null,
    up: null,
  });

  const pixels = normalizedToPixels(annotation.rect, pageWidth, pageHeight);
  
  // Ref para tener acceso a los pixels actuales dentro de los callbacks sin recrearlos
  const pixelsRef = useRef(pixels);
  pixelsRef.current = pixels;

  // Actualizar posición cuando cambia la anotación (desde fuera)
  // Solo en el cliente después de la hidratación
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (elementRef.current && !dragRef.current.isDragging) {
      elementRef.current.style.left = `${pixels.x}px`;
      elementRef.current.style.top = `${pixels.y}px`;
      elementRef.current.style.transform = '';
    }
  }, [pixels.x, pixels.y]);

  // Definir handlers antes de usarlos
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current.isDragging || !elementRef.current) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    e.preventDefault();

    requestAnimationFrame(() => {
      if (!elementRef.current) return;

      // Obtener el contenedor padre con scale
      const container = elementRef.current.closest('[style*="transform: scale"]') as HTMLElement;
      const containerRect = container?.getBoundingClientRect();
      
      if (!containerRect) return;

      // Calcular la posición del cursor relativa al contenedor escalado
      const containerX = (e.clientX - containerRect.left) / scale;
      const containerY = (e.clientY - containerRect.top) / scale;

      // Calcular nueva posición restando el offset del cursor dentro del elemento
      let targetX = containerX - dragRef.current.offsetX;
      let targetY = containerY - dragRef.current.offsetY;

      // Clamping a los límites
      const maxX = pageWidth - pixelsRef.current.width;
      const maxY = pageHeight - pixelsRef.current.height;

      targetX = Math.max(0, Math.min(targetX, maxX));
      targetY = Math.max(0, Math.min(targetY, maxY));

      // El transform es relativo a la posición base (pixels.x, pixels.y)
      const translateX = targetX - pixelsRef.current.x;
      const translateY = targetY - pixelsRef.current.y;

      // Aplicar transform directamente al DOM (sin re-renders)
      elementRef.current.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    });
  }, [scale, pageWidth, pageHeight, pixels.width, pixels.height]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!dragRef.current.isDragging || !elementRef.current) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    elementRef.current.releasePointerCapture(e.pointerId);
    
    // Remover listeners globales usando las referencias almacenadas
    if (handlersRef.current.move) {
      window.removeEventListener('pointermove', handlersRef.current.move);
    }
    if (handlersRef.current.up) {
      window.removeEventListener('pointerup', handlersRef.current.up);
      window.removeEventListener('pointercancel', handlersRef.current.up);
    }
    
    // Restaurar estilos
    elementRef.current.style.transition = '';
    elementRef.current.style.cursor = '';
    elementRef.current.style.transform = '';

    // Calcular posición final usando el mismo método que en handlePointerMove
    const container = elementRef.current.closest('[style*="transform: scale"]') as HTMLElement;
    const containerRect = container?.getBoundingClientRect();
    
    if (!containerRect) return;

    const containerX = (e.clientX - containerRect.left) / scale;
    const containerY = (e.clientY - containerRect.top) / scale;

    let targetX = containerX - dragRef.current.offsetX;
    let targetY = containerY - dragRef.current.offsetY;

    const maxX = pageWidth - pixelsRef.current.width;
    const maxY = pageHeight - pixelsRef.current.height;

    targetX = Math.max(0, Math.min(targetX, maxX));
    targetY = Math.max(0, Math.min(targetY, maxY));

    // Calcular delta usando la posición visual inicial guardada
    const deltaX = targetX - dragRef.current.initialLeft;
    const deltaY = targetY - dragRef.current.initialTop;
    const deltaXAbs = Math.abs(deltaX);
    const deltaYAbs = Math.abs(deltaY);
    
    if (deltaXAbs > 1 || deltaYAbs > 1) {
      const normalized = pixelsToNormalized(
        targetX,
        targetY,
        pixelsRef.current.width,
        pixelsRef.current.height,
        pageWidth,
        pageHeight
      );

      onUpdate({
        ...annotation,
        rect: normalized,
      });
    }

    dragRef.current.isDragging = false;
    dragRef.current.pointerId = null;
  }, [scale, pageWidth, pageHeight, pixels.width, pixels.height, annotation, onUpdate]);
  
  // Actualizar refs cuando cambien los handlers
  useEffect(() => {
    handlersRef.current.move = handlePointerMove;
    handlersRef.current.up = handlePointerUp;
  }, [handlePointerMove, handlePointerUp]);
  
  // Definir handlePointerDown después de los otros handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'annotate' || isEditing) return;
    
    // No arrastrar si se hace clic en el textarea
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.closest('textarea')) {
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    element.setPointerCapture(e.pointerId);
    
    // Obtener el contenedor padre con scale
    const container = element.closest('[style*="transform: scale"]') as HTMLElement;
    const containerRect = container?.getBoundingClientRect();
    
    if (!containerRect) return;

    // Calcular la posición del cursor relativa al contenedor escalado (coordenadas lógicas)
    const containerX = (e.clientX - containerRect.left) / scale;
    const containerY = (e.clientY - containerRect.top) / scale;

    // Obtener la posición visual actual del elemento en coordenadas lógicas del contenedor
    // Usamos getBoundingClientRect para tener la posición visual exacta (incluyendo transformaciones previas)
    const elementRect = element.getBoundingClientRect();
    const elementVisualX = (elementRect.left - containerRect.left) / scale;
    const elementVisualY = (elementRect.top - containerRect.top) / scale;

    // Calcular el offset del cursor dentro del elemento (en coordenadas lógicas del contenedor)
    // El offset es la distancia desde la esquina superior izquierda visual del elemento hasta el cursor
    const offsetX = containerX - elementVisualX;
    const offsetY = containerY - elementVisualY;
    
    // Guardar la posición inicial antes de aplicar cualquier transform nuevo
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: elementVisualX, // Posición visual inicial
      initialTop: elementVisualY,  // Posición visual inicial
      offsetX: offsetX,
      offsetY: offsetY,
      pointerId: e.pointerId,
    };

    element.style.transition = 'none';
    element.style.cursor = 'grabbing';

    // Agregar listeners globales usando las referencias almacenadas
    if (handlersRef.current.move) {
      window.addEventListener('pointermove', handlersRef.current.move);
    }
    if (handlersRef.current.up) {
      window.addEventListener('pointerup', handlersRef.current.up);
      window.addEventListener('pointercancel', handlersRef.current.up);
    }
  }, [mode, isEditing, pixels.x, pixels.y]);

  // Cleanup de listeners al desmontar
  useEffect(() => {
    return () => {
      if (handlersRef.current.move) {
        window.removeEventListener('pointermove', handlersRef.current.move);
      }
      if (handlersRef.current.up) {
        window.removeEventListener('pointerup', handlersRef.current.up);
        window.removeEventListener('pointercancel', handlersRef.current.up);
      }
    };
  }, []);

  const canDrag = mode === 'annotate' && !isEditing;
  const isComment = annotation.type === 'COMMENT';

  // Estilos base
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${pixels.x}px`,
    top: `${pixels.y}px`,
    width: `${pixels.width}px`,
    height: `${pixels.height}px`,
    pointerEvents: mode === 'annotate' ? 'auto' : 'none',
    cursor: isEditing ? 'text' : (currentTool === 'text' ? 'text' : (canDrag ? 'grab' : 'default')),
    zIndex: isSelected || isEditing ? 10 : 1,
    userSelect: 'none',
    touchAction: 'none',
    transition: 'all 0.1s ease-out', // Siempre usar transición, se desactiva durante drag vía style directo
  };

  // Estilos específicos por tipo
  const contentStyle: React.CSSProperties = isComment ? {
    width: isEditing ? `${Math.max(pixels.width, 200)}px` : '20px',
    height: isEditing ? 'auto' : '20px',
    minHeight: isEditing ? '60px' : '20px',
    borderRadius: isEditing ? '4px' : '50%',
    backgroundColor: annotation.color || '#FF5722',
    border: isSelected || isEditing ? '2px solid #2196F3' : '2px solid #fff',
    display: 'flex',
    alignItems: isEditing ? 'flex-start' : 'center',
    justifyContent: isEditing ? 'flex-start' : 'center',
    fontSize: '12px',
    color: '#fff',
    fontWeight: 'bold',
    padding: isEditing ? '4px' : '0',
    width: '100%',
    height: '100%',
  } : {
    // TEXT
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: `2px solid ${isSelected || isEditing ? '#2196F3' : annotation.color || '#000'}`,
    padding: '4px',
    fontSize: '12px',
    minHeight: '24px',
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
    height: '100%',
  };

  return (
    <div
      ref={elementRef}
      style={containerStyle}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        if (!dragRef.current.isDragging && !isEditing) {
          onSelect(annotation, e);
        }
      }}
      onDoubleClick={(e) => {
        onDoubleClick(annotation, e);
      }}
      title={annotation.text || annotation.type}
    >
      {/* Borde de selección */}
      {(isSelected || isEditing) && (
        <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
      )}

      <div style={contentStyle}>
        {isComment ? (
          isEditing ? (
            <textarea
              ref={textInputRef}
              value={editingText}
              onChange={(e) => onTextChange(annotation, e.target.value)}
              onBlur={() => onTextBlur(annotation)}
              onKeyDown={(e) => onTextKeyDown(e, annotation)}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full bg-transparent border-none outline-none resize-none text-white text-xs p-1"
              style={{ minHeight: '50px', fontFamily: 'inherit' }}
              placeholder="Escribe tu comentario..."
              autoFocus
            />
          ) : (
            <span className="text-xs pointer-events-none select-none">!</span>
          )
        ) : (
          // TEXT
          isEditing ? (
            <textarea
              ref={textInputRef}
              value={editingText}
              onChange={(e) => onTextChange(annotation, e.target.value)}
              onBlur={() => onTextBlur(annotation)}
              onKeyDown={(e) => onTextKeyDown(e, annotation)}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full bg-transparent border-none outline-none resize-none text-black text-xs p-1"
              style={{ minHeight: '36px', fontFamily: 'inherit' }}
              autoFocus
              placeholder="Escribe tu texto..."
            />
          ) : (
            <span className="truncate w-full block pointer-events-none select-none">
              {annotation.text || 'Click para editar'}
            </span>
          )
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparación personalizada para evitar re-renders innecesarios
  return (
    prevProps.annotation.id === nextProps.annotation.id &&
    prevProps.annotation.rect.x === nextProps.annotation.rect.x &&
    prevProps.annotation.rect.y === nextProps.annotation.rect.y &&
    prevProps.annotation.rect.w === nextProps.annotation.rect.w &&
    prevProps.annotation.rect.h === nextProps.annotation.rect.h &&
    prevProps.annotation.text === nextProps.annotation.text &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editingText === nextProps.editingText &&
    prevProps.mode === nextProps.mode &&
    prevProps.currentTool === nextProps.currentTool &&
    prevProps.pageWidth === nextProps.pageWidth &&
    prevProps.pageHeight === nextProps.pageHeight &&
    prevProps.scale === nextProps.scale
  );
});

DraggableAnnotation.displayName = 'DraggableAnnotation';

export { DraggableAnnotation };
