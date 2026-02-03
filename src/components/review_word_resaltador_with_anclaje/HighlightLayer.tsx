"use client";

import * as React from "react";
import type { TextHighlight } from "@/types/comments";

type HighlightLayerProps = {
  page: number;
  highlights: TextHighlight[];
  containerSelector: string;
  onDeleteHighlight: (id: string) => void;
  orderMap: Record<string, number>;
};

export function HighlightLayer({
  page,
  highlights,
  containerSelector,
  onDeleteHighlight,
  orderMap,
}: HighlightLayerProps) {
  const [highlightRects, setHighlightRects] = React.useState<
    Array<{
      id: string; // ID del highlight original
      rectId: string; // ID único para cada rectángulo
      rect: DOMRect;
      color: string;
    }>
  >([]);
  const [hoveredHighlightId, setHoveredHighlightId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const container = document.getElementById(containerSelector);
    if (!container) {
      setHighlightRects([]);
      return;
    }

    const updateHighlights = () => {
      const newRects: Array<{
        id: string; // ID del highlight original
        rectId: string; // ID único para cada rectángulo
        rect: DOMRect;
        color: string;
      }> = [];

      highlights.forEach((highlight) => {
        try {
          // Usar textContent (no innerText) para consistencia con el cálculo de offsets
          const containerText = container.textContent || "";
          
          // Validar que los offsets estén dentro del rango válido
          if (
            highlight.rangeStart < 0 ||
            highlight.rangeEnd > containerText.length ||
            highlight.rangeStart >= highlight.rangeEnd
          ) {
            return;
          }

          // Recrear el rango exacto usando los offsets guardados
          const range = document.createRange();
          let startNode: Node | null = null;
          let endNode: Node | null = null;
          let startOffset = 0;
          let endOffset = 0;

          const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null
          );

          let currentOffset = 0;
          let node: Node | null;

          // Encontrar los nodos de inicio y fin usando el mismo método que al guardar
          while ((node = walker.nextNode())) {
            const nodeLength = node.textContent?.length || 0;
            const nodeStart = currentOffset;
            const nodeEnd = currentOffset + nodeLength;

            // Encontrar el nodo de inicio
            if (!startNode && nodeEnd > highlight.rangeStart) {
              startNode = node;
              startOffset = Math.max(0, Math.min(highlight.rangeStart - nodeStart, nodeLength));
            }
            
            // Encontrar el nodo de fin
            if (nodeEnd >= highlight.rangeEnd) {
              endNode = node;
              endOffset = Math.max(0, Math.min(highlight.rangeEnd - nodeStart, nodeLength));
              break;
            }
            
            currentOffset = nodeEnd;
          }

          // Validar que encontramos ambos nodos
          if (!startNode || !endNode) {
            console.warn(`No se pudieron encontrar los nodos para highlight ${highlight.id}`);
            return;
          }

          // Configurar el rango
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);

          // Validar que el rango recreado tenga el texto correcto (normalizado)
          const recreatedText = range.toString();
          const normalizedRecreated = recreatedText.replace(/\s+/g, ' ').trim();
          const normalizedSelected = highlight.selectedText.replace(/\s+/g, ' ').trim();
          
          if (normalizedRecreated !== normalizedSelected) {
            console.warn(`Texto recreado no coincide: "${normalizedRecreated}" vs "${normalizedSelected}"`);
            // No retornar aquí, intentar renderizar de todas formas
          }

          // Obtener todos los rectángulos del rango (puede haber múltiples si el texto está en varias líneas)
          const rects = Array.from(range.getClientRects());
          
          // Obtener el contenedor padre que tiene el padding (el div con "relative h-full w-full p-6")
          // Este es el contenedor donde está posicionado el HighlightLayer con absolute inset-0
          const parentContainer = container.parentElement;
          if (!parentContainer) return;
          
          const parentRect = parentContainer.getBoundingClientRect();

          // Crear un rectángulo para cada parte del texto resaltado
          rects.forEach((rect) => {
            if (rect.width > 0 && rect.height > 0) {
              // Calcular posición relativa al contenedor padre (que tiene el padding)
              // El HighlightLayer está posicionado de forma absoluta dentro del parentContainer
              // No necesitamos scrollTop/scrollLeft porque el parentContainer no tiene scroll
              const relativeTop = rect.top - parentRect.top;
              const relativeLeft = rect.left - parentRect.left;

              newRects.push({
                id: highlight.id, // ID del highlight original
                rectId: `${highlight.id}-${rect.top}-${rect.left}`, // ID único para cada rectángulo
                rect: {
                  top: relativeTop,
                  left: relativeLeft,
                  width: rect.width,
                  height: rect.height,
                  right: relativeLeft + rect.width,
                  bottom: relativeTop + rect.height,
                } as DOMRect,
                color: highlight.color || "yellow",
              });
            }
          });
        } catch (err) {
          console.warn("Error calculating highlight rect for", highlight.id, err);
        }
      });

      setHighlightRects(newRects);
    };

    updateHighlights();

    // Recalcular cuando cambia el contenido o el scroll
    const observer = new MutationObserver(updateHighlights);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const handleScroll = () => updateHighlights();
    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateHighlights);

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateHighlights);
    };
  }, [highlights, containerSelector]);

  if (highlightRects.length === 0) return null;

  // Agrupar rectángulos por highlight ID para determinar cuál es el primero
  const rectsByHighlight = new Map<string, typeof highlightRects>();
  highlightRects.forEach((rect) => {
    if (!rectsByHighlight.has(rect.id)) {
      rectsByHighlight.set(rect.id, []);
    }
    rectsByHighlight.get(rect.id)!.push(rect);
  });

  // Función para determinar si este es el primer rectángulo del highlight
  const isFirstRect = (rectId: string, highlightId: string) => {
    const rects = rectsByHighlight.get(highlightId) || [];
    return rects.length > 0 && rects[0].rectId === rectId;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {highlightRects.map((h) => {
        const isHovered = hoveredHighlightId === h.id;
        const showDeleteButton = isHovered && isFirstRect(h.rectId, h.id);
        
        // Buscar el highlight completo para obtener el commentId
        const highlight = highlights.find((hl) => hl.id === h.id);
        const commentId = highlight?.commentId;
        const commentNumber = commentId ? orderMap[commentId] : null;

        return (
          <div
            key={h.rectId}
            className="absolute rounded-sm opacity-60 transition-all"
            style={{
              top: `${h.rect.top}px`,
              left: `${h.rect.left}px`,
              width: `${h.rect.width}px`,
              height: `${h.rect.height}px`,
              backgroundColor: h.color === "yellow" ? "#fef08a" : h.color,
              pointerEvents: "auto",
              cursor: "pointer",
              zIndex: 10,
            }}
            onMouseEnter={() => setHoveredHighlightId(h.id)}
            onMouseLeave={() => setHoveredHighlightId(null)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDeleteHighlight(h.id);
            }}
            title="Doble clic para eliminar"
          >
            {/* Mostrar número del comentario asociado si existe y botón de eliminar */}
            {isFirstRect(h.rectId, h.id) && (
              <div 
                className="absolute -top-2 -left-2 flex items-center gap-1"
                style={{
                  zIndex: 50,
                }}
              >
                {/* Número del comentario (primero) */}
                {commentNumber && (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-blue-600 text-xs font-bold text-white shadow-md"
                    style={{
                      fontSize: "11px",
                    }}
                    title={`Comentario #${commentNumber}`}
                  >
                    {commentNumber}
                  </div>
                )}
                
                {/* Botón de eliminar (a lado del número) */}
                {showDeleteButton && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHighlight(h.id);
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-all hover:bg-red-700 hover:scale-110"
                    style={{
                      fontSize: "14px",
                      lineHeight: "1",
                      fontWeight: "bold",
                    }}
                    title="Eliminar resaltado"
                    aria-label="Eliminar resaltado"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

