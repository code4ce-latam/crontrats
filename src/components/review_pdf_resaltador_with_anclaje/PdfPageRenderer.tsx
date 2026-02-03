"use client";

import * as React from "react";

type PdfPageRendererProps = {
  pdfDocument: any;
  pageNumber: number;
  containerSelector: string;
  zoom: number;
  onRenderComplete?: () => void;
};

export function PdfPageRenderer({
  pdfDocument,
  pageNumber,
  containerSelector,
  zoom,
  onRenderComplete,
}: PdfPageRendererProps) {
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

        // Calcular el scale base para ajustar al ancho del contenedor
        const container = containerRef.current;
        if (!container) return;
        
        // Obtener el ancho del contenedor scrollable (el que tiene overflow-auto)
        // Este es el contenedor que no cambia de tamaño con el zoom
        let scrollableContainer = container.parentElement;
        while (scrollableContainer && 
               !scrollableContainer.classList.contains('overflow-auto') && 
               scrollableContainer !== document.body) {
          scrollableContainer = scrollableContainer.parentElement;
        }
        
        // Usar el ancho del contenedor scrollable si existe, sino el del contenedor actual
        // Restar el padding (p-6 = 24px * 2 = 48px)
        const containerWidth = scrollableContainer 
          ? scrollableContainer.clientWidth - 48
          : (container.clientWidth > 0 ? container.clientWidth - 48 : 794 - 48); // fallback a ancho A4
        
        // Obtener viewport base para calcular el scale inicial
        const baseScale = 1.5;
        const viewportBase = page.getViewport({ scale: baseScale });
        
        // Asegurar que containerWidth sea válido
        if (containerWidth <= 0) {
          console.warn("Container width is invalid, using default");
          return;
        }
        
        const scaleFactor = containerWidth / viewportBase.width;
        
        // Aplicar zoom al scale final
        // Cuando zoom === 1, finalScale debería ser exactamente baseScale * scaleFactor
        const finalScale = baseScale * scaleFactor * zoom;
        const scaledViewport = page.getViewport({ scale: finalScale });
        
        // Establecer el tamaño del canvas (en píxeles)
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        // Establecer estilos del canvas para mantener el tamaño pero permitir scroll si es necesario
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;
        canvas.style.display = "block";
        canvas.style.maxWidth = "none"; // No limitar el ancho para que el zoom funcione
        
        const renderContext = {
          canvasContext: context,
          viewport: scaledViewport,
        };

        await page.render(renderContext).promise;

        // Renderizar capa de texto para selección
        if (textLayerRef.current && isMounted) {
          const textContent = await page.getTextContent();
          const textLayerDiv = textLayerRef.current;
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${scaledViewport.width}px`;
          textLayerDiv.style.height = `${scaledViewport.height}px`;

          // Verificar si hay texto extraíble
          const textItems = textContent.items || [];
          
          if (textItems.length === 0) {
            console.warn(`Página ${pageNumber}: No se encontró texto extraíble. Este PDF puede ser una imagen escaneada o no tener capa de texto.`);
            // Mostrar un indicador visual de que no hay texto seleccionable
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
            // Calcular el factor de escala para el texto
            const textScaleFactor = finalScale;

            // Crear elementos de texto para cada item
            textItems.forEach((item: any) => {
              const tx = item.transform;
              const textDiv = document.createElement("span");
              textDiv.style.position = "absolute";
              // Usar el viewport escalado para las posiciones
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

