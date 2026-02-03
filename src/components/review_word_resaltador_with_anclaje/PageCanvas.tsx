"use client";

import * as React from "react";
import type { AnchorComment, ToolMode, TextHighlight } from "@/types/comments";
import { PinsLayer } from "./PinsLayer";
import { HighlightLayer } from "./HighlightLayer";

type DocumentViewerPagesProps = {
  pages: number;
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  orderMap: Record<string, number>;
  documentHtmlPages: string[] | null;
  highlightMode: boolean;
  highlights: TextHighlight[];
  onCreateHighlight: (
    page: number,
    selectedText: string,
    rangeStart: number,
    rangeEnd: number,
    containerSelector: string,
    x?: number,
    y?: number
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
  documentHtmlPages,
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
            documentHtml={
              documentHtmlPages ? documentHtmlPages[pageNumber - 1] ?? null : null
            }
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
  documentHtml: string | null;
  highlightMode: boolean;
  highlights: TextHighlight[];
  onCreateHighlight: (
    page: number,
    selectedText: string,
    rangeStart: number,
    rangeEnd: number,
    containerSelector: string,
    x?: number,
    y?: number
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
      documentHtml,
      highlightMode,
      highlights,
      onCreateHighlight,
      onDeleteHighlight,
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    // Detectar selección de texto cuando highlightMode está activo
    React.useEffect(() => {
      const handleMouseUp = () => {
        if (!highlightMode || !contentRef.current || !containerRef.current) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();

        if (!selectedText) return;

        // Validar que la selección esté dentro del contenido del documento
        if (!contentRef.current.contains(range.commonAncestorContainer)) return;

        // Función helper para calcular offset preciso basado solo en nodos de texto
        // Usa textContent (no innerText) para consistencia
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
            
            // Si encontramos el nodo objetivo
            if (node === targetNode) {
              return offset + Math.min(targetOffset, nodeLength);
            }
            
            offset += nodeLength;
          }

          return offset;
        };

        const container = contentRef.current;
        
        // Calcular offsets usando solo nodos de texto (textContent, no innerText)
        const rangeStart = getTextOffset(container, range.startContainer, range.startOffset);
        const rangeEnd = getTextOffset(container, range.endContainer, range.endOffset);

        // Validar que los offsets sean válidos
        // Usar textContent (no innerText) para consistencia
        const containerText = container.textContent || "";
        if (rangeStart < 0 || rangeEnd > containerText.length || rangeStart >= rangeEnd) {
          console.warn("Offsets inválidos:", { rangeStart, rangeEnd, containerLength: containerText.length });
          return;
        }

        // Validar que el texto extraído coincida con el seleccionado
        // Usar textContent para extraer, pero comparar sin espacios al inicio/fin
        const extractedText = containerText.slice(rangeStart, rangeEnd);
        const normalizedSelected = selectedText.replace(/\s+/g, ' ').trim();
        const normalizedExtracted = extractedText.replace(/\s+/g, ' ').trim();
        
        if (normalizedExtracted !== normalizedSelected) {
          console.warn("El texto extraído no coincide con el seleccionado:", {
            selected: normalizedSelected,
            extracted: normalizedExtracted,
            rawSelected: selectedText,
            rawExtracted: extractedText,
            rangeStart,
            rangeEnd,
          });
          // Continuar de todas formas, pero registrar la discrepancia
        }

        // Crear selector único para el contenedor
        const containerSelector = `page-${page}-content`;

        // Calcular coordenadas (x, y) del inicio del texto resaltado para crear el comentario
        const rangeRect = range.getBoundingClientRect();
        const pageContainer = containerRef.current;
        if (pageContainer) {
          const pageRect = pageContainer.getBoundingClientRect();
          // Calcular posición relativa al contenedor de la página (0-1)
          const x = (rangeRect.left - pageRect.left) / pageRect.width;
          const y = (rangeRect.top - pageRect.top) / pageRect.height;
          
          // Asegurar que las coordenadas estén dentro del rango válido
          const normalizedX = Math.max(0, Math.min(1, x));
          const normalizedY = Math.max(0, Math.min(1, y));
          
          onCreateHighlight(page, selectedText, rangeStart, rangeEnd, containerSelector, normalizedX, normalizedY);
        } else {
          onCreateHighlight(page, selectedText, rangeStart, rangeEnd, containerSelector);
        }

        // Limpiar selección
        selection.removeAllRanges();
      };

      if (highlightMode) {
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [highlightMode, page, onCreateHighlight]);


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
          className={
            documentHtml
              ? "relative w-full min-h-[842px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
              : "relative aspect-[210/297] w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
          }
          style={{
            userSelect: highlightMode ? "text" : "none",
            cursor: highlightMode ? "text" : "default",
          }}
        >
          {documentHtml ? (
            <div className="relative h-full w-full p-6 text-sm leading-relaxed text-zinc-800">
              <div
                ref={contentRef}
                id={`page-${page}-content`}
                className={`prose max-w-none ${highlightMode ? "select-text" : "select-none"}`}
                dangerouslySetInnerHTML={{ __html: documentHtml }}
              />
              <HighlightLayer
                page={page}
                highlights={highlights}
                containerSelector={`page-${page}-content`}
                onDeleteHighlight={onDeleteHighlight}
                orderMap={orderMap}
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-6 text-xs text-zinc-400">
              <span>Carga un documento de Word (.docx) con el botón superior para verlo aquí.</span>
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

