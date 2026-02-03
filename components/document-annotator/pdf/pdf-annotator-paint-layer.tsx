"use client";

import * as React from "react";
import type { TextHighlight } from "@/types/document-annotations";

type PdfAnnotatorPaintLayerProps = {
  page: number;
  highlights: TextHighlight[];
  containerWidth: number;
  containerHeight: number;
  onDeleteHighlight: (id: string) => void;
  orderMap: Record<string, number>;
};

export function PdfAnnotatorPaintLayer({
  page,
  highlights,
  containerWidth,
  containerHeight,
  onDeleteHighlight,
  orderMap,
}: PdfAnnotatorPaintLayerProps) {
  const [hoveredHighlightId, setHoveredHighlightId] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth === 0 || containerHeight === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    highlights.forEach((highlight) => {
      if (!highlight.paintPaths || highlight.paintPaths.length === 0) return;

      const color = highlight.color || "#fef08a";
      const commentId = highlight.commentId;
      const commentNumber = commentId ? orderMap[commentId] : null;

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = highlight.paintWidth || 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

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

      highlight.paintPaths.forEach((point) => {
        ctx.beginPath();
        ctx.arc(
          point.x * containerWidth,
          point.y * containerHeight,
          (highlight.paintWidth || 4) / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      if (highlight.paintPaths.length > 0) {
        const firstPoint = highlight.paintPaths[0];
        const isHovered = hoveredHighlightId === highlight.id;
        
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestHighlight: TextHighlight | null = null;
    let minDistance = Infinity;

    highlights.forEach((highlight) => {
      if (!highlight.paintPaths || highlight.paintPaths.length === 0) return;

      const firstPoint = highlight.paintPaths[0];
      const commentNumber = highlight.commentId ? orderMap[highlight.commentId] : null;
      
      const btnX = firstPoint.x * containerWidth + (commentNumber ? 20 : 0);
      const btnY = firstPoint.y * containerHeight - 15;
      
      const distanceToButton = Math.sqrt(
        Math.pow(btnX - mouseX, 2) + Math.pow(btnY - mouseY, 2)
      );
      
      let distanceToNumber = Infinity;
      if (commentNumber) {
        const numX = firstPoint.x * containerWidth;
        const numY = firstPoint.y * containerHeight - 15;
        distanceToNumber = Math.sqrt(
          Math.pow(numX - mouseX, 2) + Math.pow(numY - mouseY, 2)
        );
      }
      
      const minDist = Math.min(distanceToButton, distanceToNumber);
      const threshold = 25;
      
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

  const isClickOnDeleteButton = (x: number, y: number, highlight: TextHighlight): boolean => {
    if (!highlight.paintPaths || highlight.paintPaths.length === 0) return false;
    
    const firstPoint = highlight.paintPaths[0];
    const commentNumber = highlight.commentId ? orderMap[highlight.commentId] : null;
    
    const btnX = firstPoint.x * containerWidth + (commentNumber ? 20 : 0);
    const btnY = firstPoint.y * containerHeight - 15;
    
    const distance = Math.sqrt(
      Math.pow(btnX - x, 2) + Math.pow(btnY - y, 2)
    );
    
    return distance < 15;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredHighlightId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const highlight = highlights.find((h) => h.id === hoveredHighlightId);
    if (highlight && isClickOnDeleteButton(clickX, clickY, highlight)) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hoveredHighlightId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const highlight = highlights.find((h) => h.id === hoveredHighlightId);
    if (highlight && isClickOnDeleteButton(clickX, clickY, highlight)) {
      e.stopPropagation();
      e.preventDefault();
      onDeleteHighlight(hoveredHighlightId);
      setHoveredHighlightId(null);
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
        zIndex: 20,
        cursor: hoveredHighlightId ? "pointer" : "default",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    />
  );
}

