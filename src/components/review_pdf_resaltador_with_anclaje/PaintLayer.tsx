"use client";

import * as React from "react";
import type { TextHighlight } from "@/types/comments";

type PaintLayerProps = {
  page: number;
  highlights: TextHighlight[];
  containerWidth: number;
  containerHeight: number;
  onDeleteHighlight: (id: string) => void;
  orderMap: Record<string, number>;
};

export function PaintLayer({
  page,
  highlights,
  containerWidth,
  containerHeight,
  onDeleteHighlight,
  orderMap,
}: PaintLayerProps) {
  const [hoveredHighlightId, setHoveredHighlightId] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Renderizar los paths de pintura en el canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0 || containerHeight === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Establecer tamaño del canvas
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Renderizar cada highlight
    highlights.forEach((highlight) => {
      if (!highlight.paintPaths || highlight.paintPaths.length === 0) return;

      const color = highlight.color || "#fef08a";
      const commentId = highlight.commentId;
      const commentNumber = commentId ? orderMap[commentId] : null;

      // Configurar estilo de pintura
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = highlight.paintWidth || 8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Dibujar el path de pintura
      if (highlight.paintPaths.length > 0) {
        ctx.beginPath();
        const firstPoint = highlight.paintPaths[0];
        ctx.moveTo(firstPoint.x * containerWidth, firstPoint.y * containerHeight);

        for (let i = 1; i < highlight.paintPaths.length; i++) {
          const point = highlight.paintPaths[i];
          ctx.lineTo(point.x * containerWidth, point.y * containerHeight);
        }

        ctx.stroke();
      }

      // Dibujar círculos en cada punto para un efecto más suave
      highlight.paintPaths.forEach((point) => {
        ctx.beginPath();
        ctx.arc(
          point.x * containerWidth,
          point.y * containerHeight,
          (highlight.paintWidth || 8) / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      // Dibujar número de comentario y botón de eliminar si existe
      if (highlight.paintPaths.length > 0) {
        const firstPoint = highlight.paintPaths[0];
        const isHovered = hoveredHighlightId === highlight.id;
        
        // Número de comentario
        if (commentNumber) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#2563eb";
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            firstPoint.x * containerWidth,
            firstPoint.y * containerHeight - 15,
            12,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.stroke();

          // Texto del número
          ctx.fillStyle = "white";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            commentNumber.toString(),
            firstPoint.x * containerWidth,
            firstPoint.y * containerHeight - 15
          );
        }
        
        // Botón de eliminar (solo en hover)
        if (isHovered) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#dc2626";
          ctx.beginPath();
          ctx.arc(
            firstPoint.x * containerWidth + (commentNumber ? 20 : 0),
            firstPoint.y * containerHeight - 15,
            10,
            0,
            Math.PI * 2
          );
          ctx.fill();
          
          // Icono X
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2;
          ctx.beginPath();
          const btnX = firstPoint.x * containerWidth + (commentNumber ? 20 : 0);
          const btnY = firstPoint.y * containerHeight - 15;
          ctx.moveTo(btnX - 5, btnY - 5);
          ctx.lineTo(btnX + 5, btnY + 5);
          ctx.moveTo(btnX + 5, btnY - 5);
          ctx.lineTo(btnX - 5, btnY + 5);
          ctx.stroke();
        }
      }
    });
  }, [highlights, containerWidth, containerHeight, orderMap, hoveredHighlightId]);

  // Encontrar el highlight bajo el mouse y manejar clicks
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Coordenadas en píxeles del canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Buscar el highlight más cercano
    let closestHighlight: TextHighlight | null = null;
    let minDistance = Infinity;

    highlights.forEach((highlight) => {
      if (!highlight.paintPaths || highlight.paintPaths.length === 0) return;

      const firstPoint = highlight.paintPaths[0];
      const commentNumber = highlight.commentId ? orderMap[highlight.commentId] : null;
      
      // Calcular posición del botón de eliminar en píxeles
      const btnX = firstPoint.x * containerWidth + (commentNumber ? 20 : 0);
      const btnY = firstPoint.y * containerHeight - 15;
      
      // Verificar si está cerca del botón de eliminar o del número de comentario
      const distanceToButton = Math.sqrt(
        Math.pow(btnX - mouseX, 2) + Math.pow(btnY - mouseY, 2)
      );
      
      // También verificar distancia al número de comentario si existe
      let distanceToNumber = Infinity;
      if (commentNumber) {
        const numX = firstPoint.x * containerWidth;
        const numY = firstPoint.y * containerHeight - 15;
        distanceToNumber = Math.sqrt(
          Math.pow(numX - mouseX, 2) + Math.pow(numY - mouseY, 2)
        );
      }
      
      // Usar la distancia mínima entre el botón y el número
      const minDist = Math.min(distanceToButton, distanceToNumber);
      const threshold = 25; // Radio de detección en píxeles (suficiente para el botón de 10px + número de 12px)
      
      if (minDist < threshold && minDist < minDistance) {
        minDistance = minDist;
        closestHighlight = highlight;
      }
    });

    setHoveredHighlightId(closestHighlight?.id || null);
  };

  const handleMouseLeave = () => {
    setHoveredHighlightId(null);
  };

  // Función helper para verificar si el click está en el botón de eliminar
  const isClickOnDeleteButton = (x: number, y: number, highlight: TextHighlight): boolean => {
    if (!highlight.paintPaths || highlight.paintPaths.length === 0) return false;
    
    const firstPoint = highlight.paintPaths[0];
    const commentNumber = highlight.commentId ? orderMap[highlight.commentId] : null;
    
    // Calcular posición del botón en píxeles (igual que en el render)
    const btnX = firstPoint.x * containerWidth + (commentNumber ? 20 : 0);
    const btnY = firstPoint.y * containerHeight - 15; // Offset de -15 píxeles como en el render
    
    // Calcular distancia en píxeles
    const distance = Math.sqrt(
      Math.pow(btnX - x, 2) + Math.pow(btnY - y, 2)
    );
    
    // Radio del botón es 10 píxeles, usar un umbral un poco mayor para facilitar el click
    return distance < 15; // Dentro del área del botón (radio 10 + margen)
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredHighlightId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Coordenadas en píxeles del canvas
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Verificar si se hizo clic en el botón de eliminar
    const highlight = highlights.find((h) => h.id === hoveredHighlightId);
    if (highlight && isClickOnDeleteButton(clickX, clickY, highlight)) {
      e.stopPropagation();
      e.preventDefault();
      // No eliminar aquí, solo prevenir la propagación
      // La eliminación se hará en handleClick
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredHighlightId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Coordenadas en píxeles del canvas
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Verificar si se hizo clic en el botón de eliminar
    const highlight = highlights.find((h) => h.id === hoveredHighlightId);
    if (highlight && isClickOnDeleteButton(clickX, clickY, highlight)) {
      e.stopPropagation();
      e.preventDefault();
      onDeleteHighlight(hoveredHighlightId);
      setHoveredHighlightId(null); // Limpiar hover después de eliminar
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-auto"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: `${containerWidth}px`,
        height: `${containerHeight}px`,
        zIndex: 20, // Mayor que el contenedor padre para capturar eventos primero
        cursor: hoveredHighlightId ? "pointer" : "default",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    />
  );
}

