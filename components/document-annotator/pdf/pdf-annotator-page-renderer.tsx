"use client";

import * as React from "react";

type PdfAnnotatorPageRendererProps = {
  pdfDocument: any;
  pageNumber: number;
  containerSelector: string;
  zoom: number;
  onRenderComplete?: () => void;
};

export function PdfAnnotatorPageRenderer({
  pdfDocument,
  pageNumber,
  containerSelector,
  zoom,
  onRenderComplete,
}: PdfAnnotatorPageRendererProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [isRendering, setIsRendering] = React.useState(true);

  React.useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    let isMounted = true;

    const renderPage = async () => {
      try {
        setIsRendering(true);
        const pdfjsLib = await import("pdfjs-dist");
        
        const page = await pdfDocument.getPage(pageNumber);
        
        if (!isMounted || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        const container = containerRef.current;
        if (!container) return;
        
        let scrollableContainer = container.parentElement;
        while (scrollableContainer && 
               !scrollableContainer.classList.contains('overflow-auto') && 
               scrollableContainer !== document.body) {
          scrollableContainer = scrollableContainer.parentElement;
        }
        
        const containerWidth = scrollableContainer 
          ? scrollableContainer.clientWidth - 48
          : (container.clientWidth > 0 ? container.clientWidth - 48 : 794 - 48);
        
        if (containerWidth <= 0) {
          console.warn("Container width is invalid, using default");
          return;
        }
        
        const baseScale = 1.5;
        const viewportBase = page.getViewport({ scale: baseScale });
        
        const scaleFactor = containerWidth / viewportBase.width;
        const finalScale = baseScale * scaleFactor * zoom;
        const scaledViewport = page.getViewport({ scale: finalScale });
        
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;
        canvas.style.display = "block";
        canvas.style.maxWidth = "none";
        
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
        };

        await page.render(renderContext).promise;

        if (textLayerRef.current && isMounted) {
          const textContent = await page.getTextContent();
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${scaledViewport.width}px`;
          textLayerDiv.style.height = `${scaledViewport.height}px`;

          const textItems = textContent.items || [];
          
          if (textItems.length === 0) {
            console.warn(`Página ${pageNumber}: No se encontró texto extraíble.`);
            const noTextIndicator = document.createElement("div");
            noTextIndicator.style.position = "absolute";
            noTextIndicator.style.top = "10px";
            noTextIndicator.style.right = "10px";
            noTextIndicator.style.padding = "4px 8px";
            noTextIndicator.style.backgroundColor = "rgba(255, 193, 7, 0.9)";
            noTextIndicator.style.color = "black";
            noTextIndicator.style.fontSize = "11px";
            noTextIndicator.style.borderRadius = "4px";
            noTextIndicator.style.zIndex = "1000";
            noTextIndicator.textContent = "⚠️ Sin texto seleccionable";
            noTextIndicator.title = "Este PDF no tiene texto extraíble. Puede ser una imagen escaneada.";
            textLayerDiv.appendChild(noTextIndicator);
          } else {
            const textScaleFactor = finalScale;

            textItems.forEach((item: any) => {
              const tx = item.transform;
              const textDiv = document.createElement("span");
              textDiv.style.position = "absolute";
              textDiv.style.left = `${tx[4] * textScaleFactor}px`;
              textDiv.style.top = `${tx[5] * textScaleFactor}px`;
              textDiv.style.fontSize = `${Math.abs(tx[0]) * textScaleFactor}px`;
              textDiv.style.fontFamily = item.fontName || "sans-serif";
              textDiv.style.color = "transparent";
              textDiv.style.userSelect = "text";
              textDiv.style.cursor = "text";
              textDiv.style.whiteSpace = "pre";
              textDiv.textContent = item.str;
              textLayerDiv.appendChild(textDiv);
            });
          }
        }

        if (isMounted) {
          setIsRendering(false);
          onRenderComplete?.();
        }
      } catch (error) {
        console.error("Error rendering PDF page:", error);
        if (isMounted) {
          setIsRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
    };
  }, [pdfDocument, pageNumber, zoom, onRenderComplete]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        className="block"
        style={{ 
          display: "block", 
          maxWidth: "100%", 
          height: "auto",
        }}
      />
      <div
        ref={textLayerRef}
        id={containerSelector}
        className="absolute"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          opacity: isRendering ? 0 : 1,
          userSelect: "text",
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}

