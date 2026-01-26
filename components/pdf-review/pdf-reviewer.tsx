"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { AnnotationOverlay } from "./annotation-overlay";
import { AnnotationToolbar, type ToolType } from "./annotation-toolbar";
import { AnnotationSidebar } from "./annotation-sidebar";
import type { Annotation, AnnotationDraft, AnnotationPublished } from "@/lib/annotations/types";
import { pixelsToNormalized, validateNormalizedRect } from "@/lib/annotations/normalize";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";

// Configurar worker de PDF.js solo en el cliente
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PdfReviewerProps {
  fileVersionId: string;
  storagePath: string;
  mode: 'view' | 'annotate';
  access: 'READ' | 'EDIT' | 'OWNER';
  onClose: () => void;
}

export function PdfReviewer({
  fileVersionId,
  storagePath,
  mode,
  access,
  onClose,
}: PdfReviewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageWidth, setPageWidth] = useState(800);
  const [pageHeight, setPageHeight] = useState(1000);
  const [scale, setScale] = useState(1);
  
  const [draft, setDraft] = useState<AnnotationDraft | null>(null);
  const [published, setPublished] = useState<AnnotationPublished[]>([]);
  const [draftAnnotations, setDraftAnnotations] = useState<Annotation[]>([]);
  const [showPublished, setShowPublished] = useState(true);
  
  const [selectedTool, setSelectedTool] = useState<ToolType>('select');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const pageRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Obtener user_id del usuario actual
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getUser();
  }, [supabase]);

  // Obtener URL firmada del PDF
  useEffect(() => {
    const loadPdfUrl = async () => {
      setPdfError(null);
      setPdfUrl(null);
      try {
        // Verificar que el archivo es PDF por extensión
        const fileExtension = storagePath.toLowerCase().split('.').pop();
        if (fileExtension !== 'pdf') {
          setPdfError(`El archivo no es un PDF (extensión: .${fileExtension}). Solo se pueden anotar archivos PDF.`);
          return;
        }

        const response = await fetch(`/api/contracts/file/signed-url?storage_path=${encodeURIComponent(storagePath)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.download_url) {
            setPdfUrl(data.download_url);
          } else {
            setPdfError("No se pudo obtener la URL del archivo");
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
          setPdfError(errorData.error || "Error al obtener el archivo");
        }
      } catch (error) {
        console.error("[PdfReviewer] Error cargando URL del PDF:", error);
        setPdfError("Error al cargar el archivo");
      }
    };
    loadPdfUrl();
  }, [storagePath]);

  // Cargar anotaciones
  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        const response = await fetch(`/api/contracts/annotations/list?file_version_id=${fileVersionId}`);
        if (response.ok) {
          const data = await response.json();
          setDraft(data.draft);
          setPublished(data.published || []);
          setDraftAnnotations(data.draft?.annotations_json || []);
        }
      } catch (error) {
        console.error("[PdfReviewer] Error cargando anotaciones:", error);
      }
    };
    loadAnnotations();
  }, [fileVersionId]);

  const handleDelete = useCallback((annotationToDelete?: Annotation) => {
    // Si se pasa una anotación específica, borrar esa
    if (annotationToDelete) {
      setDraftAnnotations(prev => prev.filter(ann => ann.id !== annotationToDelete.id));
      if (selectedAnnotationId === annotationToDelete.id) {
        setSelectedAnnotationId(null);
      }
      setHasUnsavedChanges(true);
      return;
    }

    // Si no, borrar la seleccionada
    if (!selectedAnnotationId) return;
    setDraftAnnotations(prev => prev.filter(ann => ann.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
    setHasUnsavedChanges(true);
  }, [selectedAnnotationId]);

  // Manejar atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // No ejecutar si el usuario está escribiendo en un input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
        case 'escape':
          setSelectedTool('select');
          break;
        case 'h':
          if (mode === 'annotate') setSelectedTool('highlight');
          break;
        case 't':
          if (mode === 'annotate') setSelectedTool('text');
          break;
        case 'c':
          if (mode === 'annotate') setSelectedTool('comment');
          break;
        case '+':
        case '=':
          setScale(prev => Math.min(prev + 0.1, 3));
          break;
        case '-':
          setScale(prev => Math.max(prev - 0.1, 0.5));
          break;
        case 'delete':
        case 'backspace':
          if (selectedAnnotationId) handleDelete();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedAnnotationId, handleDelete]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePageLoadSuccess = (page: any) => {
    setPageWidth(page.width);
    setPageHeight(page.height);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // No crear anotación si se hace clic en una anotación existente
    const target = e.target as HTMLElement;
    if (target.closest('[data-annotation]')) {
      return;
    }

    if (mode !== 'annotate' || selectedTool === 'select') return;
    if (!pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (selectedTool === 'highlight') {
      setIsDrawing(true);
      setDrawStart({ x, y });
    } else if (selectedTool === 'text' || selectedTool === 'comment') {
      // Crear anotación inmediatamente para text/comment
      const width = selectedTool === 'text' ? 200 : 150;
      const height = selectedTool === 'text' ? 30 : 60;
      const normalized = pixelsToNormalized(x, y, width, height, pageWidth, pageHeight);
      const newAnnotation: Annotation = {
        id: nanoid(),
        page: currentPage,
        type: selectedTool === 'text' ? 'TEXT' : 'COMMENT',
        rect: normalized,
        text: '',
        color: selectedTool === 'text' ? '#000' : '#FF5722',
        opacity: selectedTool === 'text' ? 1 : 0.9,
        createdAt: new Date().toISOString(),
        createdByUserId: currentUserId,
      };
      setDraftAnnotations(prev => [...prev, newAnnotation]);
      setHasUnsavedChanges(true);
      setSelectedAnnotationId(newAnnotation.id);
      
      // Cambiar automáticamente a modo selección después de agregar texto o comentario
      // Esto permite editar/mover inmediatamente la anotación creada
      setSelectedTool('select');
    }
  }, [mode, selectedTool, scale, pageWidth, pageHeight, currentPage, currentUserId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !pageRef.current) return;
    // Aquí se podría mostrar un preview del rectángulo
  }, [isDrawing, drawStart]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const endX = (e.clientX - rect.left) / scale;
    const endY = (e.clientY - rect.top) / scale;

    const x = Math.min(drawStart.x, endX);
    const y = Math.min(drawStart.y, endY);
    const w = Math.abs(endX - drawStart.x);
    const h = Math.abs(endY - drawStart.y);

    if (w > 5 && h > 5) {
      const normalized = pixelsToNormalized(x, y, w, h, pageWidth, pageHeight);
      if (validateNormalizedRect(normalized)) {
        const newAnnotation: Annotation = {
          id: nanoid(),
          page: currentPage,
          type: 'HIGHLIGHT',
          rect: normalized,
          color: '#FFEB3B',
          opacity: 0.3,
          createdAt: new Date().toISOString(),
          createdByUserId: '',
        };
        setDraftAnnotations(prev => [...prev, newAnnotation]);
        setHasUnsavedChanges(true);
      }
    }

    setIsDrawing(false);
    setDrawStart(null);
  }, [isDrawing, drawStart, scale, pageWidth, pageHeight, currentPage]);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/contracts/annotations/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_version_id: fileVersionId,
          annotations_json: draftAnnotations,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDraft(data.annotation);
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("[PdfReviewer] Error guardando borrador:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/contracts/annotations/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_version_id: fileVersionId,
          annotations_json: draftAnnotations,
          source_draft_id: draft?.id,
        }),
      });

      if (response.ok) {
        // Recargar anotaciones
        const listResponse = await fetch(`/api/contracts/annotations/list?file_version_id=${fileVersionId}`);
        if (listResponse.ok) {
          const data = await listResponse.json();
          setPublished(data.published || []);
          setDraftAnnotations([]);
          setHasUnsavedChanges(false);
        }
      }
    } catch (error) {
      console.error("[PdfReviewer] Error publicando:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnnotationUpdate = (updatedAnnotation: Annotation) => {
    setDraftAnnotations(prev => 
      prev.map(ann => ann.id === updatedAnnotation.id ? updatedAnnotation : ann)
    );
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm("Tienes cambios sin guardar. ¿Guardar borrador o salir?")) {
        handleSaveDraft().then(() => onClose());
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleToolChange = (tool: ToolType) => {
    if (tool === 'zoom-in') {
      setScale(prev => Math.min(prev + 0.1, 3));
    } else if (tool === 'zoom-out') {
      setScale(prev => Math.max(prev - 0.1, 0.5));
    } else {
      setSelectedTool(tool);
    }
  };

  const allAnnotations = showPublished
    ? [...draftAnnotations, ...published.flatMap(p => p.annotations_json)]
    : draftAnnotations;

  // Determinar el cursor según la herramienta seleccionada
  const getCursorStyle = () => {
    switch (selectedTool) {
      case 'highlight': return 'text';
      case 'text': return 'text';
      case 'comment': return 'copy';
      default: return 'default';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <AnnotationToolbar
        selectedTool={selectedTool}
        onToolChange={handleToolChange}
        onDelete={handleDelete}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onClose={handleClose}
        hasSelectedAnnotation={!!selectedAnnotationId}
        isSaving={isSaving}
        mode={mode}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4" style={{ minWidth: 0 }}>
          <div className="flex flex-col items-center gap-4">
            {pdfError ? (
              <div className="text-center py-8">
                <div className="text-destructive font-medium mb-2">Error</div>
                <div className="text-sm text-muted-foreground">{pdfError}</div>
              </div>
            ) : pdfUrl ? (
              <div
                ref={pageRef}
                data-pdf-container
                className="relative"
                style={{ cursor: getCursorStyle() }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <Document
                  file={pdfUrl}
                  onLoadSuccess={handleDocumentLoadSuccess}
                  onLoadError={(error) => {
                    console.error("[PdfReviewer] Error cargando PDF:", error);
                    if (error.message?.includes('Invalid PDF') || error.name === 'InvalidPDFException') {
                      setPdfError("El archivo no es un PDF válido o está corrupto. Verifica que el archivo sea un PDF válido.");
                    } else {
                      setPdfError(`Error al cargar el PDF: ${error.message || 'Error desconocido'}`);
                    }
                  }}
                  loading={<div className="text-center py-8 text-muted-foreground">Cargando PDF...</div>}
                  error={
                    <div className="text-center py-8">
                      <div className="text-destructive font-medium mb-2">Error al cargar PDF</div>
                      <div className="text-sm text-muted-foreground">
                        El archivo no es un PDF válido o está corrupto
                      </div>
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    onLoadSuccess={handlePageLoadSuccess}
                    scale={scale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
                <AnnotationOverlay
                  annotations={allAnnotations}
                  currentPage={currentPage}
                  pageWidth={pageWidth}
                  pageHeight={pageHeight}
                  scale={scale}
                  selectedAnnotationId={selectedAnnotationId}
                  onAnnotationClick={setSelectedAnnotationId}
                  onAnnotationUpdate={handleAnnotationUpdate}
                  onAnnotationDelete={handleDelete}
                  mode={mode}
                  currentTool={selectedTool}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Cargando URL del PDF...
              </div>
            )}
            
            {pdfUrl && !pdfError && numPages > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {currentPage} de {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
                  disabled={currentPage === numPages}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <AnnotationSidebar
          draft={draft}
          published={published}
          showPublished={showPublished}
          onTogglePublished={() => setShowPublished(!showPublished)}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onAnnotationClick={setSelectedAnnotationId}
          selectedAnnotationId={selectedAnnotationId}
          mode={mode}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}

