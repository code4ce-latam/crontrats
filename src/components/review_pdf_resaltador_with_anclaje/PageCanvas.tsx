"use client";

import * as React from "react";
import type { AnchorComment, ToolMode, TextHighlight } from "@/types/comments";
import { PinsLayer } from "./PinsLayer";
import { HighlightLayer } from "./HighlightLayer";
import { PaintLayer } from "./PaintLayer";
import { PdfPageRenderer } from "./PdfPageRenderer";

// Wrapper para PaintLayer que obtiene las dimensiones del contenedor
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
        // Obtener el canvas del PDF para las dimensiones reales
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

    // Observar cambios en el canvas también
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
    <PaintLayer
      page={page}
      highlights={highlights}
      containerWidth={dimensions.width}
      containerHeight={dimensions.height}
      onDeleteHighlight={onDeleteHighlight}
      orderMap={orderMap}
    />
  );
}

type DocumentViewerPagesProps = {
  pages: number;
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
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

export function DocumentViewerPages({
  pages,
  comments,
  selectedId,
  toolMode,
  onSelect,
  onUpdatePosition,
  pageRefs,
  orderMap,
  pdfDocument,
  zoom,
  highlightMode,
  highlights,
  onCreateHighlight,
  onDeleteHighlight,
}: DocumentViewerPagesProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      {Array.from({ length: pages }).map((_, index) => {
        const pageNumber = index + 1;
        const pageComments = comments.filter((c) => c.page === pageNumber);
        const pageHighlights = highlights.filter((h) => h.page === pageNumber);
        return (
          <PageCanvas
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

type PageCanvasProps = {
  page: number;
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
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

export const PageCanvas = React.forwardRef<HTMLDivElement, PageCanvasProps>(
  (
    {
      page,
      comments,
      selectedId,
      toolMode,
      onSelect,
      onUpdatePosition,
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

    // Modo de pintura cuando highlightMode está activo
    const [isPainting, setIsPainting] = React.useState(false);
    const [currentPaintPath, setCurrentPaintPath] = React.useState<Array<{ x: number; y: number }>>([]);
    const paintCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    
    // Estado para el pan (arrastrar) - declarado antes de los useEffects que lo usan
    const [isPanning, setIsPanning] = React.useState(false);
    const [panOffset, setPanOffset] = React.useState({ x: 0, y: 0 });
    const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

    // Manejar inicio de pintura
    const handlePaintStart = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!highlightMode || toolMode === "PAN") return;
      if (!contentRef.current) return;

      e.preventDefault();
      e.stopPropagation();
      setIsPainting(true);

      // Obtener el canvas del PDF para calcular coordenadas relativas
      const canvas = contentRef.current.querySelector("canvas");
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      
      // Calcular coordenadas relativas al canvas (0-1)
      const x = (e.clientX - canvasRect.left) / canvasRect.width;
      const y = (e.clientY - canvasRect.top) / canvasRect.height;

      // Validar que estén dentro del rango
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        setCurrentPaintPath([{ x, y }]);
        
        // Inicializar preview canvas con las dimensiones del canvas del PDF
        // Inicializar inmediatamente y también en el siguiente frame para asegurar
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
        
        // También intentar en el siguiente frame por si acaso
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

    // Manejar movimiento durante la pintura
    const paintPathRef = React.useRef<Array<{ x: number; y: number }>>([]);
    
    React.useEffect(() => {
      paintPathRef.current = currentPaintPath;
    }, [currentPaintPath]);

    // Aplicar cursor de lápiz a todos los elementos cuando highlightMode está activo
    React.useEffect(() => {
      const pencilCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14L3 17l3 3 3-3-3-3z' fill='%23000'/%3E%3C/svg%3E") 0 24, auto`;

      const applyCursorToChildren = () => {
        // Aplicar al contenedor principal también
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
        
        // Aplicar a todos los elementos hijos
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
          
          // Aplicar también al contenedor de contenido
          if (highlightMode && toolMode !== "PAN") {
            contentRef.current.style.setProperty("cursor", pencilCursor, "important");
          } else {
            contentRef.current.style.removeProperty("cursor");
          }
        }
        
        // Aplicar también al scrollContainerRef si existe
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

      // Aplicar inmediatamente
      applyCursorToChildren();

      // También aplicar después de pequeños delays para asegurar que los elementos estén disponibles
      // Esto es especialmente importante cuando highlightMode cambia de false a true
      const timeoutId1 = setTimeout(applyCursorToChildren, 0);
      const timeoutId2 = setTimeout(applyCursorToChildren, 50);
      const timeoutId3 = setTimeout(applyCursorToChildren, 100);

      // Observar cambios en el DOM para aplicar cursor a nuevos elementos
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
        // Limpiar cursores al desmontar
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
    }, [highlightMode, toolMode, isPanning]);

    React.useEffect(() => {
      if (!isPainting || !highlightMode || !containerRef.current) return;

      const handlePaintMove = (e: MouseEvent) => {
        if (!contentRef.current) return;

        // Obtener el canvas del PDF
        const canvas = contentRef.current.querySelector("canvas");
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();
        
        // Calcular coordenadas relativas al canvas (0-1)
        const x = (e.clientX - canvasRect.left) / canvasRect.width;
        const y = (e.clientY - canvasRect.top) / canvasRect.height;

        // Solo agregar si está dentro del rango y es diferente al último punto
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          const lastPoint = paintPathRef.current[paintPathRef.current.length - 1];
          // Solo agregar si hay suficiente distancia (para suavizar)
          if (!lastPoint || 
              Math.abs(lastPoint.x - x) > 0.001 || 
              Math.abs(lastPoint.y - y) > 0.001) {
            paintPathRef.current = [...paintPathRef.current, { x, y }];
            setCurrentPaintPath(paintPathRef.current);
            
            // Renderizar preview en tiempo real
            if (previewCanvasRef.current) {
              const previewCanvas = previewCanvasRef.current;
              const ctx = previewCanvas.getContext("2d");
              if (ctx) {
                // Limpiar y redibujar
                ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                
                if (paintPathRef.current.length > 0) {
                  ctx.globalAlpha = 0.6;
                  ctx.strokeStyle = "#FFFF66";
                  ctx.fillStyle = "#FFFF66";
                  ctx.lineWidth = 8;
                  ctx.lineCap = "round";
                  ctx.lineJoin = "round";
                  
                  // Dibujar línea
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
                  
                  // Dibujar círculos en cada punto
                  paintPathRef.current.forEach((point) => {
                    ctx.beginPath();
                    ctx.arc(
                      point.x * previewCanvas.width,
                      point.y * previewCanvas.height,
                      4,
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
        
        // Limpiar preview canvas
        if (previewCanvasRef.current) {
          const ctx = previewCanvasRef.current.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
          }
        }
        
        if (finalPath.length > 0) {
          // Crear highlight con el path de pintura
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
            8, // paintWidth (más fino)
            8  // paintHeight
          );
        }

        // Resetear estado de pintura
        setIsPainting(false);
        setCurrentPaintPath([]);
        paintPathRef.current = [];
        
        // Forzar re-render del cursor asegurando que highlightMode sigue activo
        // El cursor debería seguir mostrándose porque highlightMode no cambia
      };

      document.addEventListener("mousemove", handlePaintMove);
      document.addEventListener("mouseup", handlePaintEnd);

      return () => {
        document.removeEventListener("mousemove", handlePaintMove);
        document.removeEventListener("mouseup", handlePaintEnd);
      };
    }, [isPainting, highlightMode, page, onCreateHighlight]);

    // Manejar inicio del pan
    const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
      if (toolMode !== "PAN") return;
      e.preventDefault();
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
    };

    // Manejar movimiento del pan
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

    // Resetear pan cuando cambia el modo
    React.useEffect(() => {
      if (toolMode !== "PAN") {
        setPanOffset({ x: 0, y: 0 });
        setIsPanning(false);
      }
    }, [toolMode]);


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
            // Altura proporcional a A4: 794px (ancho) * (297/210) = 1123px
            height: "1123px",
            maxHeight: "1123px",
            userSelect: toolMode === "PAN" ? "none" : highlightMode ? "none" : "none",
            cursor: toolMode === "PAN" 
              ? (isPanning ? "grabbing" : "grab") 
              : highlightMode 
                ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14L3 17l3 3 3-3-3-3z' fill='%23000'/%3E%3C/svg%3E") 0 24, auto`
                : "default",
          }}
          onMouseDown={(e) => {
            if (highlightMode && toolMode !== "PAN") {
              handlePaintStart(e);
            } else {
              handlePanStart(e);
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
                    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14L3 17l3 3 3-3-3-3z' fill='%23000'/%3E%3C/svg%3E") 0 24, auto`
                    : "default",
              }}
            >
              <div
                ref={contentRef}
                id={`page-${page}-content`}
                className="relative"
                style={{
                  userSelect: "none",
                  minWidth: "fit-content",
                  minHeight: "fit-content",
                  cursor: highlightMode 
                    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14L3 17l3 3 3-3-3-3z' fill='%23000'/%3E%3C/svg%3E") 0 24, auto`
                    : "default",
                }}
              >
                <PdfPageRenderer
                  pdfDocument={pdfDocument}
                  pageNumber={page}
                  containerSelector={`page-${page}-content`}
                  zoom={zoom}
                />
                {/* Canvas de preview para mostrar la línea mientras se pinta */}
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
                  highlights={highlights.filter((h) => h.paintPaths && h.paintPaths.length > 0)}
                  containerRef={contentRef}
                  onDeleteHighlight={onDeleteHighlight}
                  orderMap={orderMap}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-xs text-zinc-400">
              <span>Carga un documento PDF con el botón superior para verlo aquí.</span>
            </div>
          )}

          <PinsLayer
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

PageCanvas.displayName = "PageCanvas";
