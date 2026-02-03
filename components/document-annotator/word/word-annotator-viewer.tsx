"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WordAnnotatorToolbar } from "./word-annotator-toolbar";
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
import { WordAnnotatorCommentsPanel } from "./word-annotator-comments-panel";
import { WordAnnotatorPageCanvas } from "./word-annotator-page-canvas";
import { downloadFileAsArrayBuffer } from "@/lib/document-annotator/storage";
import { createClient } from "@/lib/supabase/client";

type ReviewState = {
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  draftText: string;
  zoom: number;
  pages: number;
  documentPagesHtml: string[] | null;
  highlights: TextHighlight[];
  highlightMode: boolean;
};

type WordAnnotatorViewerProps = {
  fileVersionId: string;
  contractId: string;
  storagePath: string;
  fileName: string;
  initialComments?: AnchorComment[];
  initialHighlights?: TextHighlight[];
  onSave?: () => void;
};

export function WordAnnotatorViewer({
  fileVersionId,
  contractId,
  storagePath,
  fileName,
  initialComments = [],
  initialHighlights = [],
  onSave,
}: WordAnnotatorViewerProps) {
  const [state, setState] = useState<ReviewState>({
    comments: initialComments,
    selectedId: null,
    toolMode: "SELECT",
    draftText: "",
    zoom: 1,
    pages: 0,
    documentPagesHtml: null,
    highlights: initialHighlights,
    highlightMode: false,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userName, setUserName] = useState<string>("Usuario");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Obtener nombre del usuario actual
  useEffect(() => {
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

  // Cargar archivo Word desde Supabase Storage
  useEffect(() => {
    const loadWordFile = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        // Descargar archivo como ArrayBuffer
        const arrayBuffer = await downloadFileAsArrayBuffer(storagePath);

        // Procesar con mammoth
        const mammoth = await import("mammoth/mammoth.browser");
        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        const rawHtml = value || "";

        // Paginar el HTML
        const temp = document.createElement("div");
        temp.innerHTML = rawHtml;

        const pages: string[] = [];
        let current: string[] = [];

        const pushCurrent = () => {
          if (current.length) {
            pages.push(current.join(""));
            current = [];
          }
        };

        const PAGE_CHAR_LIMIT = 2500;
        let charCount = 0;

        const children = Array.from(temp.childNodes);
        children.forEach((node, index) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const style = (el.getAttribute("style") || "").toLowerCase();
            const className = (el.className || "").toLowerCase();
            const hasExplicitBreak =
              style.includes("page-break-before") ||
              style.includes("page-break-after") ||
              className.includes("page-break");

            const html = el.outerHTML;
            const textLen = (el.textContent ?? "").length;

            if (hasExplicitBreak) {
              pushCurrent();
              pages.push(html);
              charCount = 0;
              return;
            }

            if (charCount + textLen > PAGE_CHAR_LIMIT) {
              pushCurrent();
              charCount = 0;
            }

            current.push(html);
            charCount += textLen;
          } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? "";
            if (text.trim()) {
              if (charCount + text.length > PAGE_CHAR_LIMIT) {
                pushCurrent();
                charCount = 0;
              }
              current.push(text);
              charCount += text.length;
            }
          }

          if (index === children.length - 1) {
            pushCurrent();
          }
        });

        const finalPages = pages.length > 0 ? pages : [rawHtml];

        setState((prev) => ({
          ...prev,
          pages: finalPages.length,
          documentPagesHtml: finalPages,
        }));
      } catch (err: any) {
        console.error("[WordAnnotator] Error cargando archivo:", err);
        setLoadError(err.message || "Error al cargar el archivo Word");
      } finally {
        setIsLoading(false);
      }
    };

    loadWordFile();
  }, [storagePath]);

  // Auto-guardar anotaciones periódicamente
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (state.comments.length > 0 || state.highlights.length > 0) {
        handleSaveAnnotations();
      }
    }, 30000); // Guardar cada 30 segundos

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
        const errorData = await response.json().catch(() => ({}));
        console.error("[WordAnnotator] Error guardando anotaciones:", errorData);
        throw new Error(errorData.error || "Error al guardar anotaciones");
      }

      if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error("[WordAnnotator] Error guardando anotaciones:", error);
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

  // Atajos de teclado: Esc y Delete
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
      // Desactivar highlight mode cuando se cambia a ANCHOR
      highlightMode: mode === "ANCHOR" ? false : prev.highlightMode
    }));
  };

  const handleToggleHighlightMode = () => {
    setState((prev) => ({ 
      ...prev, 
      highlightMode: !prev.highlightMode
    }));
  };

  const handleCreateHighlight = (
    page: number,
    selectedText: string,
    rangeStart: number,
    rangeEnd: number,
    containerSelector: string,
    x?: number,
    y?: number
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
    
    if (newComment && isMobile) {
      setDrawerOpen(true);
    }
  };

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
      <WordAnnotatorToolbar
        toolMode={state.toolMode}
        commentsCount={state.comments.length}
        onChangeMode={handleChangeMode}
        highlightMode={state.highlightMode}
        onToggleHighlightMode={handleToggleHighlightMode}
        isSaving={isSaving}
      />
      <div
        ref={containerRef}
        className="flex flex-1 flex-row gap-4 overflow-hidden px-6 md:px-8 py-4"
        style={{ minHeight: 0 }}
      >
        <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-6" style={{ minWidth: 0 }}>
          <WordAnnotatorPageCanvas
            pages={state.pages}
            comments={state.comments}
            selectedId={state.selectedId}
            toolMode={state.toolMode}
            onSelect={handleSelectComment}
            onUpdatePosition={handleUpdateCommentPosition}
            onCreateComment={handleCreateComment}
            pageRefs={pageRefs}
            orderMap={orderMap}
            documentHtmlPages={state.documentPagesHtml}
            highlightMode={state.highlightMode}
            highlights={state.highlights}
            onCreateHighlight={handleCreateHighlight}
            onDeleteHighlight={handleDeleteHighlight}
          />
        </div>

        {!isMobile && (
          <div className="flex w-96 flex-shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <WordAnnotatorCommentsPanel
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
              <WordAnnotatorCommentsPanel
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

