"use client";

import * as React from "react";
import type { TextHighlight } from "@/types/document-annotations";

type WordAnnotatorHighlightLayerProps = {
  page: number;
  highlights: TextHighlight[];
  containerSelector: string;
  onDeleteHighlight: (id: string) => void;
  orderMap: Record<string, number>;
};

export function WordAnnotatorHighlightLayer({
  page,
  highlights,
  containerSelector,
  onDeleteHighlight,
  orderMap,
}: WordAnnotatorHighlightLayerProps) {
  const [highlightRects, setHighlightRects] = React.useState<
    Array<{
      id: string;
      rectId: string;
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
        id: string;
        rectId: string;
        rect: DOMRect;
        color: string;
      }> = [];

      highlights.forEach((highlight) => {
        try {
          const containerText = container.textContent || "";
          
          if (
            highlight.rangeStart === undefined ||
            highlight.rangeEnd === undefined ||
            highlight.rangeStart < 0 ||
            highlight.rangeEnd > containerText.length ||
            highlight.rangeStart >= highlight.rangeEnd
          ) {
            return;
          }

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

          while ((node = walker.nextNode())) {
            const nodeLength = node.textContent?.length || 0;
            const nodeStart = currentOffset;
            const nodeEnd = currentOffset + nodeLength;

            if (!startNode && nodeEnd > highlight.rangeStart!) {
              startNode = node;
              startOffset = Math.max(0, Math.min(highlight.rangeStart! - nodeStart, nodeLength));
            }
            
            if (nodeEnd >= highlight.rangeEnd!) {
              endNode = node;
              endOffset = Math.max(0, Math.min(highlight.rangeEnd! - nodeStart, nodeLength));
              break;
            }
            
            currentOffset = nodeEnd;
          }

          if (!startNode || !endNode) {
            return;
          }

          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);

          const rects = Array.from(range.getClientRects());
          
          const parentContainer = container.parentElement;
          if (!parentContainer) return;
          
          const parentRect = parentContainer.getBoundingClientRect();

          rects.forEach((rect, rectIndex) => {
            if (rect.width > 0 && rect.height > 0) {
              const relativeTop = rect.top - parentRect.top;
              const relativeLeft = rect.left - parentRect.left;

              newRects.push({
                id: highlight.id,
                rectId: `${highlight.id}-${rectIndex}-${rect.top.toFixed(2)}-${rect.left.toFixed(2)}`,
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

  const rectsByHighlight = new Map<string, typeof highlightRects>();
  highlightRects.forEach((rect) => {
    if (!rectsByHighlight.has(rect.id)) {
      rectsByHighlight.set(rect.id, []);
    }
    rectsByHighlight.get(rect.id)!.push(rect);
  });

  const isFirstRect = (rectId: string, highlightId: string) => {
    const rects = rectsByHighlight.get(highlightId) || [];
    return rects.length > 0 && rects[0].rectId === rectId;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {highlightRects.map((h) => {
        const isHovered = hoveredHighlightId === h.id;
        const showDeleteButton = isHovered && isFirstRect(h.rectId, h.id);
        
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
            {isFirstRect(h.rectId, h.id) && (
              <div 
                className="absolute -top-2 -left-2 flex items-center gap-1"
                style={{
                  zIndex: 50,
                }}
              >
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

