"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfAnnotatorToolbar } from "./pdf-annotator-toolbar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AnchorComment, ToolMode, TextHighlight } from "@/types/document-annotations";
import { PdfAnnotatorCommentsPanel } from "./pdf-annotator-comments-panel";
import { PdfAnnotatorPageCanvas } from "./pdf-annotator-page-canvas";
import { downloadFileAsArrayBuffer } from "@/lib/document-annotator/storage";
import { createClient } from "@/lib/supabase/client";

type ReviewState = {
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  draftText: string;
  zoom: number;
  pages: number;
  pdfDocument: any | null;
  highlights: TextHighlight[];
  highlightMode: boolean;
};

type PdfAnnotatorViewerProps = {
  fileVersionId: string;
  contractId: string;
  storagePath: string;
  fileName: string;
  initialComments?: AnchorComment[];
  initialHighlights?: TextHighlight[];
  onSave?: () => void;
};

export function PdfAnnotatorViewer({
  fileVersionId,
  contractId,
  storagePath,
  fileName,
  initialComments = [],
  initialHighlights = [],
  onSave,
}: PdfAnnotatorViewerProps) {
  const [state, setState] = useState<ReviewState>({
    comments: initialComments,
    selectedId: null,
    toolMode: "SELECT",
    draftText: "",
    zoom: 1,
    pages: 0,
    pdfDocument: null,
    highlights: initialHighlights,
    highlightMode: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userName, setUserName] = useState<string>("Usuario");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const isMobileRef = useRef(isMobile);
  React.useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Obtener nombre del usuario actual
  React.useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name = 
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() ||
          user.email?.split("@")[0] ||
          "Usuario";
        setUserName(name);
      }
    };
    loadUser();
  }, []);

  // Configurar el worker de PDF.js
  React.useEffect(() => {
    const setupWorker = async () => {
      if (typeof window === "undefined") return;
      
      try {
        const pdfjsLib = await import("pdfjs-dist");
        const version = pdfjsLib.version || "5.4.530";
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
      } catch (err) {
        console.error("Error configurando worker de PDF.js:", err);
      }
    };
    
    setupWorker();
  }, []);

  // Cargar archivo PDF desde Supabase Storage
  useEffect(() => {
    const loadPdfFile = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const arrayBuffer = await downloadFileAsArrayBuffer(storagePath);
        const pdfjsLib = await import("pdfjs-dist");
        
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          const version = pdfjsLib.version || "5.4.530";
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
        }

        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          useSystemFonts: true,
        });
        
        const pdfDocument = await loadingTask.promise;

        setState((prev) => ({
          ...prev,
          pages: pdfDocument.numPages,
          pdfDocument: pdfDocument,
        }));
      } catch (err: any) {
        console.error("[PdfAnnotator] Error cargando archivo:", err);
        setLoadError(err.message || "Error al cargar el archivo PDF");
      } finally {
        setIsLoading(false);
      }
    };

    loadPdfFile();
  }, [storagePath]);

  // Auto-guardar anotaciones periódicamente
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (state.comments.length > 0 || state.highlights.length > 0) {
        handleSaveAnnotations();
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [state.comments, state.highlights, fileVersionId, contractId]);

  const handleSaveAnnotations = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      const response = await fetch("/api/contracts/annotations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_version_id: fileVersionId,
          contract_id: contractId,
          comments: state.comments,
          highlights: state.highlights,
          status: "DRAFT",
        }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar anotaciones");
      }

      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error("[PdfAnnotator] Error guardando anotaciones:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const orderedComments = useMemo(
    () =>
      [...state.comments].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      ),
    [state.comments]
  );

  const orderMap = useMemo(() => {
    const map: Record<string, number> = {};
    orderedComments.forEach((c, index) => {
      map[c.id] = index + 1;
    });
    return map;
  }, [orderedComments]);

  const selectedComment = useMemo(
    () => orderedComments.find((c) => c.id === state.selectedId) ?? null,
    [orderedComments, state.selectedId]
  );

  // Atajos de teclado
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setState((prev) => ({ ...prev, toolMode: "SELECT", highlightMode: false }));
      }
      if (ev.key === "Delete" && state.selectedId) {
        const toDelete = state.comments.find((c) => c.id === state.selectedId);
        if (!toDelete) return;
        setDeleteDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.selectedId, state.comments]);

  const handleChangeMode = (mode: ToolMode) => {
    setState((prev) => ({ 
      ...prev, 
      toolMode: mode,
      // Desactivar highlight mode cuando se cambia a ANCHOR o PAN
      highlightMode: mode === "ANCHOR" || mode === "PAN" ? false : prev.highlightMode
    }));
  };

  const handleToggleHighlightMode = () => {
    setState((prev) => ({ 
      ...prev, 
      highlightMode: !prev.highlightMode,
      // Desactivar PAN cuando se activa highlight mode
      toolMode: !prev.highlightMode && prev.toolMode === "PAN" ? "SELECT" : prev.toolMode
    }));
  };

  const handleCreateHighlight = (
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
  ) => {
    const highlightId = `h-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    
    let newComment: AnchorComment | null = null;
    let commentId: string | undefined = undefined;
    
    if (x !== undefined && y !== undefined) {
      commentId = `c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      newComment = {
        id: commentId,
        page,
        x,
        y,
        text: "",
        author: userName,
        createdAt,
      };
    }
    
    const newHighlight: TextHighlight = {
      id: highlightId,
      page,
      selectedText,
      rangeStart,
      rangeEnd,
      containerSelector,
      paintPaths,
      paintWidth,
      paintHeight,
      color: "yellow",
      createdAt,
      commentId,
    };
    
    setState((prev) => ({
      ...prev,
      highlights: [...prev.highlights, newHighlight],
      comments: newComment ? [...prev.comments, newComment] : prev.comments,
      selectedId: newComment ? newComment.id : prev.selectedId,
      draftText: newComment ? "" : prev.draftText,
      highlightMode: newComment ? false : prev.highlightMode,
    }));
    
    if (newComment && isMobileRef.current) {
      setDrawerOpen(true);
    }
  };

  const handleDeleteHighlight = (id: string) => {
    setState((prev) => {
      const highlightToDelete = prev.highlights.find((h) => h.id === id);
      const commentIdToDelete = highlightToDelete?.commentId;
      
      const remainingHighlights = prev.highlights.filter((h) => h.id !== id);
      
      const remainingComments = commentIdToDelete
        ? prev.comments.filter((c) => c.id !== commentIdToDelete)
        : prev.comments;
      
      const newSelectedId = commentIdToDelete && prev.selectedId === commentIdToDelete
        ? (remainingComments[0]?.id ?? null)
        : prev.selectedId;
      
      return {
        ...prev,
        highlights: remainingHighlights,
        comments: remainingComments,
        selectedId: newSelectedId,
        draftText: newSelectedId
          ? (remainingComments.find((c) => c.id === newSelectedId)?.text ?? "")
          : "",
      };
    });
    handleSaveAnnotations();
  };

  const handleSelectComment = (id: string) => {
    setState((prev) => {
      const current = prev.comments.find((c) => c.id === prev.selectedId);
      if (current && prev.draftText.trim() && prev.draftText !== current.text) {
        const now = new Date().toISOString();
        const updatedComments = prev.comments.map((c) =>
          c.id === prev.selectedId
            ? { ...c, text: prev.draftText.trim(), updatedAt: now }
            : c
        );
        const target = updatedComments.find((c) => c.id === id);
        return {
          ...prev,
          comments: updatedComments,
          selectedId: target ? target.id : id,
          draftText: target?.text ?? "",
        };
      } else {
        const target = prev.comments.find((c) => c.id === id);
        return {
          ...prev,
          selectedId: target ? target.id : id,
          draftText: target?.text ?? "",
        };
      }
    });

    const targetNow = state.comments.find((c) => c.id === id);
    if (targetNow) {
      const pageEl = pageRefs.current[targetNow.page - 1];
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    if (isMobile) setDrawerOpen(true);
  };

  const handleUpdateDraft = (value: string) => {
    setState((prev) => ({ ...prev, draftText: value }));
  };

  const handleSave = () => {
    if (!state.selectedId) return;
    if (!state.draftText.trim()) return;
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === prev.selectedId
          ? { ...c, text: prev.draftText.trim(), updatedAt: now }
          : c
      ),
    }));
    handleSaveAnnotations();
  };

  const handleDelete = (id: string) => {
    setState((prev) => {
      const highlightsToDelete = prev.highlights
        .filter((h) => h.commentId === id)
        .map((h) => h.id);
      
      const remaining = prev.comments.filter((c) => c.id !== id);
      const newSelected = remaining[0]?.id ?? null;
      
      const remainingHighlights = prev.highlights.filter(
        (h) => !highlightsToDelete.includes(h.id)
      );
      
      return {
        ...prev,
        comments: remaining,
        highlights: remainingHighlights,
        selectedId: prev.selectedId === id ? newSelected : prev.selectedId,
        draftText: prev.selectedId === id
          ? (newSelected
              ? remaining.find((c) => c.id === newSelected)?.text ?? ""
              : "")
          : prev.draftText,
      };
    });
    handleSaveAnnotations();
  };

  const handleSaveComment = (id: string, text: string) => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === id ? { ...c, text, updatedAt: now } : c
      ),
      draftText: prev.selectedId === id ? text : prev.draftText,
    }));
    handleSaveAnnotations();
  };

  const handleMaybeRemoveEmptySelected = useCallback(() => {
    setState((prev) => {
      if (!prev.selectedId) return prev;
      const current = prev.comments.find((c) => c.id === prev.selectedId);
      if (!current) return prev;
      if (current.text.trim().length > 0) return prev;
      const remaining = prev.comments.filter((c) => c.id !== prev.selectedId);
      const newSelected = remaining[0]?.id ?? null;
      return {
        ...prev,
        comments: remaining,
        selectedId: newSelected,
        draftText: newSelected
          ? remaining.find((c) => c.id === newSelected)?.text ?? ""
          : "",
      };
    });
  }, []);

  const handleBlurDraft = () => {
    // NO eliminar automáticamente al hacer blur
  };

  const handleCancelDraft = () => {
    if (
      !selectedComment ||
      (!selectedComment.text.trim() && !state.draftText.trim())
    ) {
      handleMaybeRemoveEmptySelected();
      return;
    }

    setState((prev) => {
      const current = prev.comments.find((c) => c.id === prev.selectedId);
      return {
        ...prev,
        draftText: current?.text ?? "",
      };
    });
  };

  const handleUpdateCommentPosition = (id: string, page: number, x: number, y: number) => {
    setState((prev) => ({
      ...prev,
      comments: prev.comments.map((c) =>
        c.id === id ? { ...c, page, x, y } : c
      ),
    }));
  };

  const handleCreateComment = (page: number, x: number, y: number) => {
    const commentId = `c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const newComment: AnchorComment = {
      id: commentId,
      page,
      x,
      y,
      text: "",
      author: userName,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      comments: [...prev.comments, newComment],
      selectedId: commentId,
      draftText: "",
      toolMode: "SELECT", // Desactivar modo anclar después de crear comentario
    }));

    if (isMobile) {
      setDrawerOpen(true);
    }
  };

  // Estado local para el zoom
  const [localZoom, setLocalZoom] = useState(1);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalZoom(state.zoom);
  }, [state.zoom]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(localZoom + 0.25, 3);
    setLocalZoom(newZoom);
    
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    zoomTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        zoom: newZoom,
      }));
    }, 50);
  }, [localZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(localZoom - 0.25, 0.5);
    setLocalZoom(newZoom);
    
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    zoomTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        zoom: newZoom,
      }));
    }, 50);
  }, [localZoom]);

  const handleZoomReset = useCallback(() => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = null;
    }
    
    setState((prev) => ({
      ...prev,
      zoom: 1,
    }));
    setLocalZoom(1);
  }, []);

  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, []);

  const confirmDeleteSelected = () => {
    setState((prev) => {
      if (!prev.selectedId) return prev;
      
      const remaining = prev.comments.filter((c) => c.id !== prev.selectedId);
      const newSelected = remaining[0]?.id ?? null;
      return {
        ...prev,
        comments: remaining,
        selectedId: newSelected,
        draftText: newSelected
          ? remaining.find((c) => c.id === newSelected)?.text ?? ""
          : "",
      };
    });
    setDeleteDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-100">
        <div className="text-center">
          <div className="mb-4 text-lg font-medium text-zinc-700">Cargando documento...</div>
          <div className="text-sm text-zinc-500">{fileName}</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-100">
        <div className="text-center">
          <div className="mb-4 text-lg font-medium text-red-600">Error al cargar documento</div>
          <div className="text-sm text-zinc-500">{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-100">
      <PdfAnnotatorToolbar
        toolMode={state.toolMode}
        commentsCount={state.comments.length}
        onChangeMode={handleChangeMode}
        highlightMode={state.highlightMode}
        onToggleHighlightMode={handleToggleHighlightMode}
        zoom={localZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        isSaving={isSaving}
      />
      <div
        ref={containerRef}
        className="flex flex-1 flex-row gap-4 overflow-hidden px-6 md:px-8 py-4"
        style={{ minHeight: 0 }}
      >
        <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-6" style={{ minWidth: 0 }}>
          <PdfAnnotatorPageCanvas
            pages={state.pages}
            comments={state.comments}
            selectedId={state.selectedId}
            toolMode={state.toolMode}
            onSelect={handleSelectComment}
            onUpdatePosition={handleUpdateCommentPosition}
            onCreateComment={handleCreateComment}
            pageRefs={pageRefs}
            orderMap={orderMap}
            pdfDocument={state.pdfDocument}
            zoom={localZoom}
            highlightMode={state.highlightMode}
            highlights={state.highlights}
            onCreateHighlight={handleCreateHighlight}
            onDeleteHighlight={handleDeleteHighlight}
          />
        </div>

        {!isMobile && (
          <div className="flex w-96 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <PdfAnnotatorCommentsPanel
              comments={orderedComments}
              selectedId={state.selectedId}
              draftText={state.draftText}
              onSelect={handleSelectComment}
              onChangeDraft={handleUpdateDraft}
              onSave={handleSave}
              onDelete={handleDelete}
              onBlurDraft={handleBlurDraft}
              onCancelDraft={handleCancelDraft}
              onSaveComment={handleSaveComment}
            />
          </div>
        )}
      </div>

      {isMobile && (
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Comentarios</DrawerTitle>
            </DrawerHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              <PdfAnnotatorCommentsPanel
                comments={orderedComments}
                selectedId={state.selectedId}
                draftText={state.draftText}
                onSelect={handleSelectComment}
                onChangeDraft={handleUpdateDraft}
                onSave={handleSave}
                onDelete={handleDelete}
                onBlurDraft={handleBlurDraft}
                onCancelDraft={handleCancelDraft}
                onSaveComment={handleSaveComment}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>localhost:3000 dice</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar el comentario seleccionado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSelected}>
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

