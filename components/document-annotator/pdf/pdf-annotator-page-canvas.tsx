"use client";

import * as React from "react";
import type { AnchorComment, ToolMode, TextHighlight } from "@/types/document-annotations";
import { PdfAnnotatorPinsLayer } from "./pdf-annotator-pins-layer";
import { PdfAnnotatorHighlightLayer } from "./pdf-annotator-highlight-layer";
import { PdfAnnotatorPaintLayer } from "./pdf-annotator-paint-layer";
import { PdfAnnotatorPageRenderer } from "./pdf-annotator-page-renderer";

function PaintLayerWrapper({
  page,
  highlights,
  containerRef,
  onDeleteHighlight,
  orderMap,
}: {
  page: number;
  highlights: TextHighlight[];
  containerRef: React.RefObject<HTMLDivElement>;
  onDeleteHighlight: (id: string) => void;
  orderMap: Record<string, number>;
}) {
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const canvas = containerRef.current.querySelector("canvas");
        if (canvas) {
          setDimensions({
            width: canvas.width,
            height: canvas.height,
          });
        } else {
          setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    const canvas = containerRef.current.querySelector("canvas");
    if (canvas) {
      resizeObserver.observe(canvas);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  if (dimensions.width === 0 || dimensions.height === 0 || highlights.length === 0) return null;

  return (
    <PdfAnnotatorPaintLayer
      page={page}
      highlights={highlights}
      containerWidth={dimensions.width}
      containerHeight={dimensions.height}
      onDeleteHighlight={onDeleteHighlight}
      orderMap={orderMap}
    />
  );
}

type PdfAnnotatorPageCanvasProps = {
  pages: number;
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
  onCreateComment: (page: number, x: number, y: number) => void;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  orderMap: Record<string, number>;
  pdfDocument: any | null;
  zoom: number;
  highlightMode: boolean;
  highlights: TextHighlight[];
  onCreateHighlight: (
    page: number,
    selectedText?: string,
    rangeStart?: number,
    rangeEnd?: number,
    containerSelector?: string,
    x?: number,
    y?: number,
    paintPaths?: Array<{ x: number; y: number }>,
    paintWidth?: number,
    paintHeight?: number
  ) => void;
  onDeleteHighlight: (id: string) => void;
};

export function PdfAnnotatorPageCanvas({
  pages,
  comments,
  selectedId,
  toolMode,
  onSelect,
  onUpdatePosition,
  onCreateComment,
  pageRefs,
  orderMap,
  pdfDocument,
  zoom,
  highlightMode,
  highlights,
  onCreateHighlight,
  onDeleteHighlight,
}: PdfAnnotatorPageCanvasProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      {Array.from({ length: pages }).map((_, index) => {
        const pageNumber = index + 1;
        const pageComments = comments.filter((c) => c.page === pageNumber);
        const pageHighlights = highlights.filter((h) => h.page === pageNumber);
        return (
          <PdfAnnotatorPageCanvasItem
            key={pageNumber}
            ref={(el) => {
              pageRefs.current[index] = el;
            }}
            page={pageNumber}
            comments={pageComments}
            selectedId={selectedId}
            toolMode={toolMode}
            onSelect={onSelect}
            onUpdatePosition={onUpdatePosition}
            onCreateComment={onCreateComment}
            orderMap={orderMap}
            pdfDocument={pdfDocument}
            zoom={zoom}
            highlightMode={highlightMode}
            highlights={pageHighlights}
            onCreateHighlight={onCreateHighlight}
            onDeleteHighlight={onDeleteHighlight}
          />
        );
      })}
    </div>
  );
}

type PdfAnnotatorPageCanvasItemProps = {
  page: number;
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
  onCreateComment: (page: number, x: number, y: number) => void;
  orderMap: Record<string, number>;
  pdfDocument: any | null;
  zoom: number;
  highlightMode: boolean;
  highlights: TextHighlight[];
  onCreateHighlight: (
    page: number,
    selectedText?: string,
    rangeStart?: number,
    rangeEnd?: number,
    containerSelector?: string,
    x?: number,
    y?: number,
    paintPaths?: Array<{ x: number; y: number }>,
    paintWidth?: number,
    paintHeight?: number
  ) => void;
  onDeleteHighlight: (id: string) => void;
};

export const PdfAnnotatorPageCanvasItem = React.forwardRef<HTMLDivElement, PdfAnnotatorPageCanvasItemProps>(
  (
    {
      page,
      comments,
      selectedId,
      toolMode,
      onSelect,
      onUpdatePosition,
      onCreateComment,
      orderMap,
      pdfDocument,
      zoom,
      highlightMode,
      highlights,
      onCreateHighlight,
      onDeleteHighlight,
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    const [isPainting, setIsPainting] = React.useState(false);
    const [currentPaintPath, setCurrentPaintPath] = React.useState<Array<{ x: number; y: number }>>([]);
    const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    
    const [isPanning, setIsPanning] = React.useState(false);
    const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
    const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

    const handlePaintStart = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!highlightMode || toolMode === "PAN") return;
      if (!contentRef.current) return;

      e.preventDefault();
      e.stopPropagation();
      setIsPainting(true);

      const canvas = contentRef.current.querySelector("canvas");
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      
      const x = (e.clientX - canvasRect.left) / canvasRect.width;
      const y = (e.clientY - canvasRect.top) / canvasRect.height;

      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        setCurrentPaintPath([{ x, y }]);
        
        if (previewCanvasRef.current && canvas) {
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          if (canvasWidth > 0 && canvasHeight > 0) {
            previewCanvasRef.current.width = canvasWidth;
            previewCanvasRef.current.height = canvasHeight;
            previewCanvasRef.current.style.width = `${canvasWidth}px`;
            previewCanvasRef.current.style.height = `${canvasHeight}px`;
          }
        }
        
        setTimeout(() => {
          if (previewCanvasRef.current && canvas) {
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            if (canvasWidth > 0 && canvasHeight > 0 && 
                (previewCanvasRef.current.width !== canvasWidth || 
                 previewCanvasRef.current.height !== canvasHeight)) {
              previewCanvasRef.current.width = canvasWidth;
              previewCanvasRef.current.height = canvasHeight;
              previewCanvasRef.current.style.width = `${canvasWidth}px`;
              previewCanvasRef.current.style.height = `${canvasHeight}px`;
            }
          }
        }, 0);
      }
    };

    const paintPathRef = React.useRef<Array<{ x: number; y: number }>>([]);
    
    React.useEffect(() => {
      paintPathRef.current = currentPaintPath;
    }, [currentPaintPath]);

    const pencilCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14L3 17l3 3 3-3-3-3z' fill='%23000'/%3E%3C/svg%3E") 0 24, auto`;

    React.useEffect(() => {
      const applyCursorToChildren = () => {
        if (containerRef.current) {
          if (highlightMode && toolMode !== "PAN") {
            containerRef.current.style.setProperty("cursor", pencilCursor, "important");
          } else if (toolMode === "PAN") {
            containerRef.current.style.setProperty("cursor", isPanning ? "grabbing" : "grab", "important");
          } else {
            containerRef.current.style.removeProperty("cursor");
            containerRef.current.style.cursor = "default";
          }
        }
        
        if (contentRef.current) {
          const allElements = contentRef.current.querySelectorAll("*");
          allElements.forEach((el) => {
            if (el instanceof HTMLElement) {
              if (highlightMode && toolMode !== "PAN") {
                el.style.setProperty("cursor", pencilCursor, "important");
              } else {
                el.style.removeProperty("cursor");
              }
            }
          });
          
          if (highlightMode && toolMode !== "PAN") {
            contentRef.current.style.setProperty("cursor", pencilCursor, "important");
          } else {
            contentRef.current.style.removeProperty("cursor");
          }
        }
        
        if (scrollContainerRef.current) {
          if (highlightMode && toolMode !== "PAN") {
            scrollContainerRef.current.style.setProperty("cursor", pencilCursor, "important");
          } else if (toolMode === "PAN") {
            scrollContainerRef.current.style.setProperty("cursor", isPanning ? "grabbing" : "grab", "important");
          } else {
            scrollContainerRef.current.style.removeProperty("cursor");
            scrollContainerRef.current.style.cursor = "default";
          }
        }
      };

      applyCursorToChildren();

      const timeoutId1 = setTimeout(applyCursorToChildren, 0);
      const timeoutId2 = setTimeout(applyCursorToChildren, 50);
      const timeoutId3 = setTimeout(applyCursorToChildren, 100);

      let observer: MutationObserver | null = null;
      if (contentRef.current) {
        observer = new MutationObserver(applyCursorToChildren);
        observer.observe(contentRef.current, {
          childList: true,
          subtree: true,
        });
      }

      return () => {
        clearTimeout(timeoutId1);
        clearTimeout(timeoutId2);
        clearTimeout(timeoutId3);
        if (observer) {
          observer.disconnect();
        }
        if (containerRef.current) {
          containerRef.current.style.removeProperty("cursor");
        }
        if (contentRef.current) {
          contentRef.current.style.removeProperty("cursor");
          const allElements = contentRef.current.querySelectorAll("*");
          allElements.forEach((el) => {
            if (el instanceof HTMLElement) {
              el.style.removeProperty("cursor");
            }
          });
        }
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.removeProperty("cursor");
        }
      };
    }, [highlightMode, toolMode, isPanning, pencilCursor]);

    React.useEffect(() => {
      if (!isPainting || !highlightMode || !containerRef.current) return;

      const handlePaintMove = (e: MouseEvent) => {
        if (!contentRef.current) return;

        const canvas = contentRef.current.querySelector("canvas");
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();
        
        const x = (e.clientX - canvasRect.left) / canvasRect.width;
        const y = (e.clientY - canvasRect.top) / canvasRect.height;

        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          const lastPoint = paintPathRef.current[paintPathRef.current.length - 1];
          if (!lastPoint || 
              Math.abs(lastPoint.x - x) > 0.001 || 
              Math.abs(lastPoint.y - y) > 0.001) {
            paintPathRef.current = [...paintPathRef.current, { x, y }];
            setCurrentPaintPath(paintPathRef.current);
            
            if (previewCanvasRef.current) {
              const previewCanvas = previewCanvasRef.current;
              const ctx = previewCanvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                
                if (paintPathRef.current.length > 0) {
                  ctx.globalAlpha = 0.6;
                  ctx.strokeStyle = "#FFFF66";
                  ctx.fillStyle = "#FFFF66";
                  ctx.lineWidth = 4;
                  ctx.lineCap = "round";
                  ctx.lineJoin = "round";
                  
                  if (paintPathRef.current.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(
                      paintPathRef.current[0].x * previewCanvas.width,
                      paintPathRef.current[0].y * previewCanvas.height
                    );
                    for (let i = 1; i < paintPathRef.current.length; i++) {
                      ctx.lineTo(
                        paintPathRef.current[i].x * previewCanvas.width,
                        paintPathRef.current[i].y * previewCanvas.height
                      );
                    }
                    ctx.stroke();
                  }
                  
                  paintPathRef.current.forEach((point) => {
                    ctx.beginPath();
                    ctx.arc(
                      point.x * previewCanvas.width,
                      point.y * previewCanvas.height,
                      2,
                      0,
                      Math.PI * 2
                    );
                    ctx.fill();
                  });
                }
              }
            }
          }
        }
      };

      const handlePaintEnd = () => {
        const finalPath = paintPathRef.current;
        
        if (previewCanvasRef.current) {
          const ctx = previewCanvasRef.current.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
          }
        }
        
        if (finalPath.length > 0) {
          const firstPoint = finalPath[0];
          const normalizedX = firstPoint.x;
          const normalizedY = firstPoint.y;

          onCreateHighlight(
            page,
            undefined,
            undefined,
            undefined,
            undefined,
            normalizedX,
            normalizedY,
            finalPath,
            4,
            4
          );
        }

        setIsPainting(false);
        setCurrentPaintPath([]);
        paintPathRef.current = [];
      };

      document.addEventListener("mousemove", handlePaintMove);
      document.addEventListener("mouseup", handlePaintEnd);

      return () => {
        document.removeEventListener("mousemove", handlePaintMove);
        document.removeEventListener("mouseup", handlePaintEnd);
      };
    }, [isPainting, highlightMode, page, onCreateHighlight]);

    const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
      if (toolMode !== "PAN") return;
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
    };

    React.useEffect(() => {
      if (!isPanning || toolMode !== "PAN") return;

      const handlePanMove = (e: MouseEvent) => {
        if (!scrollContainerRef.current) return;
        const newOffset = {
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        };
        setPanOffset(newOffset);
        scrollContainerRef.current.scrollLeft = -newOffset.x;
        scrollContainerRef.current.scrollTop = -newOffset.y;
      };

      const handlePanEnd = () => {
        setIsPanning(false);
      };

      document.addEventListener("mousemove", handlePanMove);
      document.addEventListener("mouseup", handlePanEnd);

      return () => {
        document.removeEventListener("mousemove", handlePanMove);
        document.removeEventListener("mouseup", handlePanEnd);
      };
    }, [isPanning, panStart, toolMode]);

    React.useEffect(() => {
      if (toolMode !== "PAN") {
        setPanOffset({ x: 0, y: 0 });
        setIsPanning(false);
      }
    }, [toolMode]);

    // Detectar selección de texto cuando highlightMode está activo
    React.useEffect(() => {
      const handleMouseUp = () => {
        if (!highlightMode || !contentRef.current || toolMode === "PAN") return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();

        if (!selectedText) return;

        if (!contentRef.current.contains(range.commonAncestorContainer)) return;

        const container = contentRef.current;
        const containerText = container.textContent || "";
        
        const getTextOffset = (container: Node, targetNode: Node, targetOffset: number): number => {
          const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null
          );

          let offset = 0;
          let node: Node | null;

          while ((node = walker.nextNode())) {
            const nodeLength = node.textContent?.length || 0;
            
            if (node === targetNode) {
              return offset + Math.min(targetOffset, nodeLength);
            }
            
            offset += nodeLength;
          }

          return offset;
        };

        const rangeStart = getTextOffset(container, range.startContainer, range.startOffset);
        const rangeEnd = getTextOffset(container, range.endContainer, range.endOffset);

        if (rangeStart < 0 || rangeEnd > containerText.length || rangeStart >= rangeEnd) {
          return;
        }

        const containerSelector = `page-${page}-content`;

        const rangeRect = range.getBoundingClientRect();
        const pageContainer = containerRef.current;
        if (pageContainer) {
          const pageRect = pageContainer.getBoundingClientRect();
          const x = (rangeRect.left - pageRect.left) / pageRect.width;
          const y = (rangeRect.top - pageRect.top) / pageRect.height;
          
          const normalizedX = Math.max(0, Math.min(1, x));
          const normalizedY = Math.max(0, Math.min(1, y));
          
          onCreateHighlight(page, selectedText, rangeStart, rangeEnd, containerSelector, normalizedX, normalizedY);
        } else {
          onCreateHighlight(page, selectedText, rangeStart, rangeEnd, containerSelector);
        }

        selection.removeAllRanges();
      };

      if (highlightMode && toolMode !== "PAN") {
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [highlightMode, page, onCreateHighlight, toolMode]);

    const handleClick = (e: React.MouseEvent) => {
      if (toolMode !== "ANCHOR" || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      if (x < 0 || x > 1 || y < 0 || y > 1) return;

      onCreateComment(page, x, y);
    };

    const textHighlights = highlights.filter((h) => h.rangeStart !== undefined && h.rangeEnd !== undefined);
    const paintHighlights = highlights.filter((h) => h.paintPaths && h.paintPaths.length > 0);

    return (
      <div className="w-full max-w-[794px]">
        <div className="mb-2 text-xs font-medium text-zinc-500">
          Página {page}
        </div>
        <div
          ref={(el) => {
            containerRef.current = el;
            if (typeof ref === "function") {
              ref(el);
            } else if (ref) {
              ref.current = el;
            }
          }}
          className="relative w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
          style={{
            height: "1123px",
            maxHeight: "1123px",
            userSelect: toolMode === "PAN" ? "none" : highlightMode ? "none" : "none",
            cursor: toolMode === "PAN" 
              ? (isPanning ? "grabbing" : "grab") 
              : highlightMode 
                ? pencilCursor
                : "default",
          }}
          onMouseDown={(e) => {
            if (highlightMode && toolMode !== "PAN") {
              handlePaintStart(e);
            } else if (toolMode === "PAN") {
              handlePanStart(e);
            } else if (toolMode === "ANCHOR") {
              handleClick(e);
            }
          }}
        >
          {pdfDocument ? (
            <div 
              ref={scrollContainerRef}
              className="relative w-full h-full p-6 overflow-auto"
              style={{
                cursor: toolMode === "PAN" 
                  ? (isPanning ? "grabbing" : "grab") 
                  : highlightMode 
                    ? pencilCursor
                    : "default",
              }}
            >
              <div
                ref={contentRef}
                id={`page-${page}-content`}
                className="relative"
                style={{
                  userSelect: highlightMode && toolMode !== "PAN" ? "text" : "none",
                  minWidth: "fit-content",
                  minHeight: "fit-content",
                  cursor: highlightMode && toolMode !== "PAN"
                    ? pencilCursor
                    : "default",
                }}
              >
                <PdfAnnotatorPageRenderer
                  pdfDocument={pdfDocument}
                  pageNumber={page}
                  containerSelector={`page-${page}-content`}
                  zoom={zoom}
                />
                <canvas
                  ref={previewCanvasRef}
                  className="absolute pointer-events-none"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    zIndex: 15,
                    display: isPainting ? "block" : "none",
                  }}
                />
                <PaintLayerWrapper
                  page={page}
                  highlights={paintHighlights}
                  containerRef={contentRef}
                  onDeleteHighlight={onDeleteHighlight}
                  orderMap={orderMap}
                />
                <PdfAnnotatorHighlightLayer
                  page={page}
                  highlights={textHighlights}
                  containerSelector={`page-${page}-content`}
                  onDeleteHighlight={onDeleteHighlight}
                  orderMap={orderMap}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-xs text-zinc-400">
              <span>Cargando documento...</span>
            </div>
          )}

          <PdfAnnotatorPinsLayer
            page={page}
            comments={comments}
            selectedId={selectedId}
            toolMode={toolMode}
            onSelect={onSelect}
            onUpdatePosition={onUpdatePosition}
            orderMap={orderMap}
            highlights={highlights}
          />
        </div>
      </div>
    );
  }
);

PdfAnnotatorPageCanvasItem.displayName = "PdfAnnotatorPageCanvasItem";

