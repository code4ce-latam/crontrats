"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AnnotationOverlay } from "./annotation-overlay";
import { AnnotationToolbar, type ToolType } from "./annotation-toolbar";
import { AnnotationSidebar } from "./annotation-sidebar";
import type { Annotation, AnnotationSet } from "@/lib/annotations/types";
import { pixelsToNormalized, validateNormalizedRect, normalizedToPixels } from "@/lib/annotations/normalize";
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
  
  const [my, setMy] = useState<AnnotationSet | null>(null);
  const [others, setOthers] = useState<AnnotationSet[]>([]);
  const [authors, setAuthors] = useState<Array<{ user_id: string; display_name: string; avatar_url: string | null }>>([]);
  const [myAnnotations, setMyAnnotations] = useState<Annotation[]>([]);
  const [notifyParticipants, setNotifyParticipants] = useState(false);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  
  const [selectedTool, setSelectedTool] = useState<ToolType>('select');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [deletingAnnotationId, setDeletingAnnotationId] = useState<string | null>(null);
  const [isToolbarMinimized, setIsToolbarMinimized] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  
  const [isPanning, setIsPanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number; scrollTop: number; scrollLeft: number } | null>(null);
  const dragThreshold = 5; // Píxeles mínimos para considerar un arrastre

  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [pagesReady, setPagesReady] = useState(false);
  const creatingAnnotationRef = useRef(false); // Prevenir creación múltiple
  const supabase = useMemo(() => createClient(), []);
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
          setMy(data.my);
          setOthers(data.others || []);
          setAuthors(data.authors || []);
          setMyAnnotations(data.my?.annotations_json || []);
        }
      } catch (error) {
        console.error("[PdfReviewer] Error cargando anotaciones:", error);
      }
    };
    loadAnnotations();
  }, [fileVersionId]);

  const handleDelete = useCallback(async (annotationToDelete?: Annotation) => {
    // Determinar qué anotación eliminar
    const annotationToRemove = annotationToDelete || 
      (selectedAnnotationId ? myAnnotations.find(ann => ann.id === selectedAnnotationId) : null);
    
    if (!annotationToRemove) return;

    // Marcar como eliminando
    setDeletingAnnotationId(annotationToRemove.id);

    // Verificar si la anotación está guardada antes de eliminarla del estado
    const isSaved = my && my.annotations_json.some(ann => ann.id === annotationToRemove.id);
    
    // Obtener las anotaciones actualizadas (sin la eliminada) usando función de actualización
    let updatedAnnotations: Annotation[] = [];
    setMyAnnotations(prev => {
      updatedAnnotations = prev.filter(ann => ann.id !== annotationToRemove.id);
      return updatedAnnotations;
    });
    
    if (selectedAnnotationId === annotationToRemove.id) {
      setSelectedAnnotationId(null);
    }
    setHasUnsavedChanges(true);

    // Si la anotación está guardada, actualizar en el servidor
    if (isSaved) {
      try {
        // Guardar en el servidor con las anotaciones actualizadas
        const response = await fetch('/api/contracts/annotations/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_version_id: fileVersionId,
            annotations_json: updatedAnnotations,
            notify: false,
          }),
        });

        if (response.ok) {
          // Recargar anotaciones para sincronizar
          const listResponse = await fetch(`/api/contracts/annotations/list?file_version_id=${fileVersionId}`);
          if (listResponse.ok) {
            const listData = await listResponse.json();
            setMy(listData.my);
            setOthers(listData.others || []);
            setAuthors(listData.authors || []);
            
            // Actualizar myAnnotations con las anotaciones del servidor
            const savedAnnotations = listData.my?.annotations_json || [];
            const savedIds = new Set(savedAnnotations.map((a: Annotation) => a.id));
            const newLocalAnnotations = updatedAnnotations.filter(ann => !savedIds.has(ann.id));
            setMyAnnotations([...savedAnnotations, ...newLocalAnnotations]);
          }
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error("[PdfReviewer] Error eliminando anotación del servidor:", error);
        // Si falla, mantener el estado local (la anotación ya fue eliminada localmente)
      } finally {
        setDeletingAnnotationId(null);
      }
    } else {
      // Si no está guardada, solo eliminar localmente (más rápido)
      setDeletingAnnotationId(null);
    }
  }, [selectedAnnotationId, myAnnotations, my, fileVersionId]);

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

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    // No crear anotación si se hace clic en una anotación existente
    const target = e.target as HTMLElement;
    if (target.closest('[data-annotation]')) {
      return;
    }

    // Solo procesar si estamos en modo anotación y la herramienta es text, comment o highlight
    if (mode !== 'annotate' || selectedTool === 'select') {
      return;
    }
    
    // Debug: verificar que el evento llegue
    console.log('[PdfReviewer] handleMouseDown - selectedTool:', selectedTool, 'pageNum:', pageNum);

    // Obtener la referencia de la página específica
    const pageElement = e.currentTarget;
    if (!pageElement) return;

    const rect = pageElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setDrawingPage(pageNum);

    if (selectedTool === 'highlight') {
      setIsDrawing(true);
      const startPoint = { x, y };
      setDrawStart(startPoint);
      setCurrentPath([startPoint]);
    } else if (selectedTool === 'text' || selectedTool === 'comment') {
      console.log('[PdfReviewer] Creando anotación de texto/comentario');
      // Crear anotación inmediatamente para text/comment
      const width = selectedTool === 'text' ? 200 : 150;
      const height = selectedTool === 'text' ? 30 : 60;
      const normalized = pixelsToNormalized(x, y, width, height, pageWidth, pageHeight);
      const newAnnotation: Annotation = {
        id: nanoid(),
        page: pageNum,
        type: selectedTool === 'text' ? 'TEXT' : 'COMMENT',
        rect: normalized,
        text: '',
        color: selectedTool === 'text' ? currentColor : '#FF5722',
        opacity: selectedTool === 'text' ? 1 : 0.9,
        createdAt: new Date().toISOString(),
        createdByUserId: currentUserId,
      };
      console.log('[PdfReviewer] Anotación creada:', newAnnotation);
      setMyAnnotations(prev => {
        const updated = [...prev, newAnnotation];
        console.log('[PdfReviewer] Total anotaciones:', updated.length);
        return updated;
      });
      setHasUnsavedChanges(true);
      setSelectedAnnotationId(newAnnotation.id);
      
      // NO cambiar automáticamente a modo selección - dejar que el usuario edite inmediatamente
      // El AnnotationOverlay detectará la selección y activará el modo edición
      setDrawingPage(null);
    }
  }, [mode, selectedTool, scale, pageWidth, pageHeight, currentColor, currentUserId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || drawingPage === null) return;
    
    // Usar e.currentTarget que es el contenedor de la página sobre el que se mueve el mouse
    const pageElement = e.currentTarget;
    if (!pageElement) return;
    
    const rect = pageElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (selectedTool === 'highlight') {
      setCurrentPath(prev => [...prev, { x, y }]);
    } else {
      setCurrentMousePos({ x, y });
    }
  }, [isDrawing, drawingPage, selectedTool, scale]);

  // Manejar tanto MouseEvent como PointerEvent
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || drawingPage === null) return;
    
    // Obtener elemento de la página usando drawingPage para asegurar consistencia
    // O usar e.currentTarget si el evento se dispara en el mismo elemento
    const pageElement = e.currentTarget;
    if (!pageElement) return;

    if (selectedTool === 'highlight' && currentPath.length > 1) {
      // Calcular bounding box
      const xs = currentPath.map(p => p.x);
      const ys = currentPath.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      
      const width = maxX - minX;
      const height = maxY - minY;

      const normalizedRect = pixelsToNormalized(minX, minY, width, height, pageWidth, pageHeight);
      
      const normalizedPoints = currentPath.map(p => ({
        x: p.x / pageWidth,
        y: p.y / pageHeight
      }));

      const newAnnotation: Annotation = {
        id: nanoid(),
        page: drawingPage, // Usar la página donde se inició el dibujo
        type: 'HIGHLIGHT',
        rect: normalizedRect,
        points: normalizedPoints,
        strokeWidth: 20 / Math.max(pageWidth, pageHeight),
        color: '#FFEB3B',
        opacity: 0.5,
        createdAt: new Date().toISOString(),
        createdByUserId: '',
      };
      setMyAnnotations(prev => [...prev, newAnnotation]);
      setHasUnsavedChanges(true);
    }

    setIsDrawing(false);
    setDrawingPage(null);
    setDrawStart(null);
    setCurrentPath([]);
    setCurrentMousePos(null);
  }, [isDrawing, drawingPage, currentPath, selectedTool, scale, pageWidth, pageHeight]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Guardar las anotaciones actuales
      const response = await fetch('/api/contracts/annotations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_version_id: fileVersionId,
          annotations_json: myAnnotations,
          notify: notifyParticipants,
        }),
      });

      if (response.ok) {
        // Recargar anotaciones desde el servidor
        const listResponse = await fetch(`/api/contracts/annotations/list?file_version_id=${fileVersionId}`);
        if (listResponse.ok) {
          const listData = await listResponse.json();
          setMy(listData.my);
          setOthers(listData.others || []);
          setAuthors(listData.authors || []);
          
          // MERGE: Combinar anotaciones guardadas con nuevas locales
          // Esto preserva las anotaciones nuevas que se crearon después de guardar
          const savedAnnotations = listData.my?.annotations_json || [];
          const savedIds = new Set(savedAnnotations.map((a: Annotation) => a.id));
          
          // Preservar anotaciones nuevas que no están en el servidor (creadas localmente después de guardar)
          const newLocalAnnotations = myAnnotations.filter(ann => !savedIds.has(ann.id));
          
          // Combinar: guardadas + nuevas locales (sin duplicados)
          setMyAnnotations([...savedAnnotations, ...newLocalAnnotations]);
        }
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("[PdfReviewer] Error guardando:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnnotationUpdate = (updatedAnnotation: Annotation) => {
    setMyAnnotations(prev => 
      prev.map(ann => ann.id === updatedAnnotation.id ? updatedAnnotation : ann)
    );
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      onClose();
    }
  };

  const handleSaveAndClose = async () => {
    setShowUnsavedChangesDialog(false);
    await handleSave();
    onClose();
  };

  const handleCloseWithoutSaving = () => {
    setShowUnsavedChangesDialog(false);
    onClose();
  };

  const handleToolChange = (tool: ToolType | 'zoom-in' | 'zoom-out') => {
    if (tool === 'zoom-in') {
      setScale(prev => Math.min(prev + 0.1, 3));
    } else if (tool === 'zoom-out') {
      setScale(prev => Math.max(prev - 0.1, 0.5));
    } else {
      setSelectedTool(tool as ToolType);
    }
  };

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    if (selectedAnnotationId) {
      setMyAnnotations(prev => 
        prev.map(ann => ann.id === selectedAnnotationId ? { ...ann, color } : ann)
      );
      setHasUnsavedChanges(true);
    }
  };

  // Combinar mis anotaciones con las de otros (filtradas por autor si aplica)
  const allAnnotations = useMemo(() => {
    const annotations: Annotation[] = [];
    
    // CRÍTICO: SIEMPRE agregar myAnnotations primero (anotaciones nuevas creadas localmente)
    // Esto asegura que las anotaciones recién creadas aparezcan inmediatamente
    // incluso si 'my' es null o no coincide con el filtro
    annotations.push(...myAnnotations);
    
    // Agregar anotaciones de 'my' si existe y coincide con el filtro de autor
    // Evitar duplicados comparando por ID
    if (my && (!selectedAuthorId || selectedAuthorId === my.created_by.user_id)) {
      my.annotations_json.forEach(ann => {
        if (!annotations.find(a => a.id === ann.id)) {
          annotations.push(ann);
        }
      });
    }
    
    // Agregar anotaciones de otros (filtradas por autor si aplica)
    others.forEach(otherSet => {
      if (!selectedAuthorId || selectedAuthorId === otherSet.created_by.user_id) {
        annotations.push(...otherSet.annotations_json);
      }
    });
    
    console.log('[PdfReviewer] allAnnotations calculado:', {
      total: annotations.length,
      myAnnotationsCount: myAnnotations.length,
      porPagina: annotations.reduce((acc, ann) => {
        acc[ann.page] = (acc[ann.page] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    });
    
    return annotations;
  }, [my, myAnnotations, others, selectedAuthorId]);

  // Scroll a la página seleccionada (desde barra o click)
  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current.get(pageNum);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum); // Actualizar estado inmediatamente
    }
  };

  // Intersection Observer para actualizar currentPage al hacer scroll
  useEffect(() => {
    if (numPages === 0 || !pagesReady) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Encontrar la página más visible
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length === 0) return;
        
        const visibleEntry = visibleEntries.reduce((prev, current) => {
          return (prev.intersectionRatio > current.intersectionRatio) ? prev : current;
        });
        
        const pageNum = parseInt(visibleEntry.target.getAttribute('data-page-number') || '1', 10);
        setCurrentPage(pageNum);
      },
      {
        threshold: [0.1, 0.5, 0.9], // Varios umbrales para mejor detección
        root: scrollContainerRef.current, // Usar el contenedor de scroll como root
        rootMargin: '-10% 0px -10% 0px' // Reducir área efectiva para centrar detección
      }
    );

    // Observar todas las páginas
    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [numPages, pagesReady]); // Re-ejecutar cuando cambian numPages o pagesReady

  // Efecto para manejar el arrastre (panning) con pointer events
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !panStartRef.current || !scrollContainerRef.current) return;
      
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Solo activar panning si el movimiento supera el threshold
      if (distance > dragThreshold && !isPanning) {
        setIsPanning(true);
      }
      
      // Aplicar panning solo si está activo
      if (isPanning) {
        // NO prevenir el comportamiento por defecto para permitir scroll normal
        scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
        scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDragging) {
        // Liberar el pointer capture si existe
        try {
          const target = e.target as HTMLElement;
          if (target && target.releasePointerCapture) {
            target.releasePointerCapture(e.pointerId);
          }
        } catch (err) {
          // Ignorar errores al liberar captura
        }
      }
      
      setIsDragging(false);
      setIsPanning(false);
      panStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, isPanning, dragThreshold]);

  // Determinar el cursor según la herramienta seleccionada
  const getCursorStyle = () => {
    switch (selectedTool) {
      case 'highlight': return 'text';
      case 'text': return 'text';
      case 'comment': return 'copy';
      case 'select': return isPanning ? 'grabbing' : 'grab';
      default: return 'default';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      <AnnotationToolbar
        selectedTool={selectedTool}
        onToolChange={handleToolChange}
        onSave={handleSave}
        onClose={handleClose}
        isSaving={isSaving}
        mode={mode}
        currentColor={currentColor}
        onColorChange={handleColorChange}
        notifyParticipants={notifyParticipants}
        onNotifyChange={setNotifyParticipants}
        isMinimized={isToolbarMinimized}
        onToggleMinimize={() => setIsToolbarMinimized(prev => !prev)}
      />
      
      <div className="flex flex-1 relative" style={{ minHeight: 0 }}>
        {/* Contenedor de scroll simple y nativo */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-auto bg-slate-100" 
          style={{ 
            minHeight: 0,
            cursor: isPanning ? 'grabbing' : (selectedTool === 'select' ? 'grab' : 'auto')
          }}
          onPointerDown={(e) => {
            // NO interferir si no es herramienta select o si el click es en una página/anotación
            const target = e.target as HTMLElement;
            
            // CRÍTICO: Permitir que los eventos lleguen a las páginas si NO es herramienta select
            // Esto es esencial para que las herramientas de anotación funcionen
            if (selectedTool !== 'select') {
              return; // No capturar el evento, dejar que llegue a las páginas
            }
            
            // Evitar si es botón, input, textarea, anotación, o elemento dentro de una página
            // También evitar cualquier elemento dentro del contenedor de páginas o react-pdf
            if (
              target.closest('button') || 
              target.closest('input') || 
              target.closest('textarea') || 
              target.closest('[data-annotation]') ||
              target.closest('[data-page-number]') ||
              target.closest('.react-pdf__Page') ||
              target.closest('.react-pdf__Document') ||
              target.closest('.react-pdf__Page__canvas') ||
              target.closest('.react-pdf__Page__textContent') ||
              target.closest('.react-pdf__Page__annotations')
            ) {
              return; // No capturar, dejar que el evento se propague
            }
            
            // Solo procesar si es botón izquierdo
            if (e.button !== 0 || e.defaultPrevented) return;
            
            // Detectar si el click es en la barra de scroll
            const container = e.currentTarget;
            const rect = container.getBoundingClientRect();
            const scrollbarWidth = container.offsetWidth - container.clientWidth;
            const scrollbarHeight = container.offsetHeight - container.clientHeight;
            
            // Verificar si el click está en la barra de scroll vertical
            if (scrollbarWidth > 0 && e.clientX >= rect.right - scrollbarWidth) {
              return; // Permitir scroll normal
            }
            
            // Verificar si el click está en la barra de scroll horizontal
            if (scrollbarHeight > 0 && e.clientY >= rect.bottom - scrollbarHeight) {
              return; // Permitir scroll normal
            }

            // Iniciar arrastre (pero no panning hasta que haya movimiento)
            setIsDragging(true);
            panStartRef.current = {
              x: e.clientX,
              y: e.clientY,
              scrollTop: scrollContainerRef.current?.scrollTop || 0,
              scrollLeft: scrollContainerRef.current?.scrollLeft || 0,
            };
            
            // Capturar el pointer para recibir eventos incluso fuera del elemento
            try {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            } catch (err) {
              // Si setPointerCapture falla, continuar sin captura
              console.warn('[PdfReviewer] No se pudo capturar el pointer');
            }
          }}
        >
          <div className="flex flex-col items-center gap-8 py-8 px-4" style={{ minHeight: '100%' }}>
            {pdfError ? (
              <div className="text-center py-8">
                <div className="text-destructive font-medium mb-2">Error</div>
                <div className="text-sm text-muted-foreground">{pdfError}</div>
              </div>
            ) : pdfUrl ? (
              <>
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
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                    <div
                      key={pageNum}
                      ref={(el) => {
                        if (el) {
                          pageRefs.current.set(pageNum, el);
                          // Marcar como listo cuando todas las páginas estén renderizadas
                          if (pageRefs.current.size === numPages && numPages > 0) {
                            setPagesReady(true);
                          }
                        } else {
                          pageRefs.current.delete(pageNum);
                        }
                      }}
                      data-page-number={pageNum}
                      className="relative mx-auto shadow-xl border bg-white mb-8"
                      style={{ 
                        width: pageWidth * scale, 
                        height: pageHeight * scale,
                        cursor: getCursorStyle() 
                      }}
                      onMouseDown={(e) => {
                        // Prevenir que el contenedor capture este evento
                        e.stopPropagation();
                        handleMouseDown(e, pageNum);
                      }}
                      onMouseMove={(e) => {
                        // Prevenir que el contenedor capture este evento
                        e.stopPropagation();
                        handleMouseMove(e);
                      }}
                      onMouseUp={(e) => {
                        // Prevenir que el contenedor capture este evento
                        e.stopPropagation();
                        handleMouseUp(e);
                      }}
                    >
                      {/* Preview del resaltado (Dibujo libre) */}
                      {isDrawing && drawingPage === pageNum && selectedTool === 'highlight' && currentPath.length > 1 && (
                        <svg
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            zIndex: 50,
                          }}
                        >
                          <polyline
                            points={currentPath.map(p => `${p.x * scale},${p.y * scale}`).join(' ')}
                            fill="none"
                            stroke="#FFEB3B"
                            strokeWidth={20 * scale}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={0.5}
                          />
                        </svg>
                      )}

                      <Page
                        pageNumber={pageNum}
                        onLoadSuccess={pageNum === 1 ? handlePageLoadSuccess : undefined}
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      
                      {/* Overlay invisible para capturar eventos cuando el Page bloquea eventos */}
                      {/* Solo mostrar cuando NO hay anotación seleccionada para permitir arrastre */}
                      {(mode === 'annotate' && (selectedTool === 'text' || selectedTool === 'comment' || selectedTool === 'highlight') && !selectedAnnotationId) && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'auto',
                            zIndex: 5, // Debajo del AnnotationOverlay (zIndex: 20) para no bloquear arrastre
                            cursor: getCursorStyle(),
                          }}
                          onPointerDown={(e) => {
                            // CRÍTICO: Prevenir que el evento se propague y se procese múltiples veces
                            e.stopPropagation();
                            
                            // No procesar si hay una anotación seleccionada (para permitir arrastre)
                            if (selectedAnnotationId) {
                              return;
                            }
                            
                            // No procesar si se hace clic en una anotación existente
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-annotation]')) {
                              return;
                            }
                            
                            const pageElement = e.currentTarget.parentElement;
                            if (!pageElement) return;
                            
                            const rect = pageElement.getBoundingClientRect();
                            const x = (e.clientX - rect.left) / scale;
                            const y = (e.clientY - rect.top) / scale;
                            
                            if (selectedTool === 'text' || selectedTool === 'comment') {
                              // Prevenir creación múltiple usando ref
                              if (creatingAnnotationRef.current) {
                                console.log('[PdfReviewer] Ya se está creando una anotación, ignorando click');
                                return;
                              }
                              
                              // Prevenir creación múltiple: verificar si ya hay una anotación recién creada en esta posición
                              const recentAnnotation = myAnnotations.find(ann => {
                                const pixels = normalizedToPixels(ann.rect, pageWidth, pageHeight);
                                const distance = Math.sqrt(Math.pow(pixels.x - x, 2) + Math.pow(pixels.y - y, 2));
                                return distance < 50 && ann.page === pageNum && !ann.text;
                              });
                              
                              if (recentAnnotation) {
                                console.log('[PdfReviewer] Evitando duplicado - anotación reciente encontrada');
                                return;
                              }
                              
                              creatingAnnotationRef.current = true;
                              console.log('[PdfReviewer] Creando anotación desde overlay - selectedTool:', selectedTool);
                              const width = selectedTool === 'text' ? 200 : 150;
                              const height = selectedTool === 'text' ? 30 : 60;
                              const normalized = pixelsToNormalized(x, y, width, height, pageWidth, pageHeight);
                              const newAnnotation: Annotation = {
                                id: nanoid(),
                                page: pageNum,
                                type: selectedTool === 'text' ? 'TEXT' : 'COMMENT',
                                rect: normalized,
                                text: '',
                                color: selectedTool === 'text' ? currentColor : '#FF5722',
                                opacity: selectedTool === 'text' ? 1 : 0.9,
                                createdAt: new Date().toISOString(),
                                createdByUserId: currentUserId,
                              };
                              console.log('[PdfReviewer] Anotación creada desde overlay:', newAnnotation);
                              setMyAnnotations(prev => {
                                const updated = [...prev, newAnnotation];
                                console.log('[PdfReviewer] Total anotaciones:', updated.length);
                                return updated;
                              });
                              setHasUnsavedChanges(true);
                              setSelectedAnnotationId(newAnnotation.id);
                              setDrawingPage(null);
                              
                              // Cambiar automáticamente a herramienta "select" (puntero) para poder mover el cuadro
                              setSelectedTool('select');
                              
                              // El AnnotationOverlay detectará automáticamente que es una anotación nueva (sin texto)
                              // y activará la edición cuando se haga clic en ella mediante handleAnnotationClick
                              // Para activar la edición inmediatamente, simulamos un click programático después de un breve delay
                              setTimeout(() => {
                                creatingAnnotationRef.current = false;
                                // Buscar el elemento de la anotación y disparar un click para activar la edición
                                const annotationElement = document.querySelector(`[data-annotation="${newAnnotation.id}"]`);
                                if (annotationElement) {
                                  const clickEvent = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window,
                                  });
                                  annotationElement.dispatchEvent(clickEvent);
                                }
                              }, 150);
                            } else if (selectedTool === 'highlight') {
                              setDrawingPage(pageNum);
                              setIsDrawing(true);
                              const startPoint = { x, y };
                              setDrawStart(startPoint);
                              setCurrentPath([startPoint]);
                            }
                          }}
                          onPointerMove={(e) => {
                            if (selectedTool === 'highlight' && isDrawing && drawingPage === pageNum) {
                              e.stopPropagation();
                              const pageElement = e.currentTarget.parentElement;
                              if (!pageElement) return;
                              
                              const rect = pageElement.getBoundingClientRect();
                              const x = (e.clientX - rect.left) / scale;
                              const y = (e.clientY - rect.top) / scale;
                              
                              setCurrentPath(prev => [...prev, { x, y }]);
                            }
                          }}
                          onPointerUp={(e) => {
                            if (isDrawing && drawingPage === pageNum && selectedTool === 'highlight') {
                              e.stopPropagation();
                              const pageElement = e.currentTarget.parentElement;
                              if (!pageElement) return;
                              
                              if (currentPath.length > 1) {
                                const xs = currentPath.map(p => p.x);
                                const ys = currentPath.map(p => p.y);
                                const minX = Math.min(...xs);
                                const minY = Math.min(...ys);
                                const maxX = Math.max(...xs);
                                const maxY = Math.max(...ys);
                                
                                const width = maxX - minX;
                                const height = maxY - minY;
                                
                                const normalizedRect = pixelsToNormalized(minX, minY, width, height, pageWidth, pageHeight);
                                const normalizedPoints = currentPath.map(p => ({
                                  x: p.x / pageWidth,
                                  y: p.y / pageHeight
                                }));
                                
                                const newAnnotation: Annotation = {
                                  id: nanoid(),
                                  page: drawingPage,
                                  type: 'HIGHLIGHT',
                                  rect: normalizedRect,
                                  points: normalizedPoints,
                                  strokeWidth: 20 / Math.max(pageWidth, pageHeight),
                                  color: '#FFEB3B',
                                  opacity: 0.5,
                                  createdAt: new Date().toISOString(),
                                  createdByUserId: currentUserId,
                                };
                                setMyAnnotations(prev => [...prev, newAnnotation]);
                                setHasUnsavedChanges(true);
                              }
                              
                              setIsDrawing(false);
                              setDrawingPage(null);
                              setDrawStart(null);
                              setCurrentPath([]);
                              setCurrentMousePos(null);
                            }
                          }}
                        />
                      )}
                      
                      <AnnotationOverlay
                        annotations={allAnnotations}
                        currentPage={pageNum}
                        pageWidth={pageWidth}
                        pageHeight={pageHeight}
                        scale={scale}
                        selectedAnnotationId={selectedAnnotationId}
                        onAnnotationClick={(ann) => {
                          setSelectedAnnotationId(ann.id);
                          // Si es una anotación nueva sin texto, cambiar automáticamente a herramienta "select"
                          if ((ann.type === 'TEXT' || ann.type === 'COMMENT') && !ann.text) {
                            setSelectedTool('select');
                          }
                        }}
                        onAnnotationUpdate={handleAnnotationUpdate}
                        onAnnotationDelete={handleDelete}
                        mode={mode}
                        currentTool={selectedTool}
                        currentUserId={currentUserId}
                      />
                    </div>
                  ))}
                </Document>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Cargando URL del PDF...
              </div>
            )}
            
            {/* Espacio para que el contenido no quede tapado por la barra flotante */}
            <div className="h-16" />
          </div>
        </div>

            {/* Barra de navegación flotante */}
            {pdfUrl && !pdfError && numPages > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 px-4 py-2 bg-background/95 backdrop-blur shadow-lg rounded-full border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium tabular-nums">
                  Página {currentPage} de {numPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
                  disabled={currentPage === numPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
        
        <AnnotationSidebar
          my={my}
          others={others}
          authors={authors}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onAnnotationClick={(ann) => setSelectedAnnotationId(ann.id)}
          onAnnotationDelete={handleDelete}
          deletingAnnotationId={deletingAnnotationId}
          selectedAnnotationId={selectedAnnotationId}
          mode={mode}
          currentUserId={currentUserId}
          selectedAuthorId={selectedAuthorId}
          onAuthorFilterChange={setSelectedAuthorId}
        />
      </div>
      
      {/* Diálogo de confirmación para cambios sin guardar */}
      <Dialog open={showUnsavedChangesDialog} onOpenChange={setShowUnsavedChangesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Guardar cambios?</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar. ¿Deseas guardar el borrador antes de salir?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseWithoutSaving}
              disabled={isSaving}
            >
              Salir sin guardar
            </Button>
            <Button
              onClick={handleSaveAndClose}
              disabled={isSaving}
            >
              {isSaving ? "Guardando..." : "Guardar borrador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

