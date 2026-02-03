"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toolbar } from "./Toolbar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { AnchorComment, ToolMode, TextHighlight } from "@/types/comments";
import { CommentsPanel } from "./CommentsPanel";
import { DocumentViewerPages } from "./PageCanvas";

type ReviewState = {
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  draftText: string;
  zoom: number;
  pages: number;
  documentPagesHtml: string[] | null;
  highlights: TextHighlight[]; // Highlights independientes
  highlightMode: boolean; // Modo de resaltado activo
};

export function DocumentViewer() {
  const [state, setState] = useState<ReviewState>({
    comments: [],
    selectedId: null,
    toolMode: "SELECT",
    draftText: "",
    zoom: 1,
    pages: 0,
    documentPagesHtml: null,
    highlights: [],
    highlightMode: false,
  });

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const orderedComments = useMemo(
    () =>
      [...state.comments].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      ),
    [state.comments]
  );

  // Mapa id -> número global de comentario (1..N) para que
  // el mismo número se vea tanto en el pin como en el panel derecho.
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
        const ok = window.confirm("¿Eliminar el comentario seleccionado?");
        if (!ok) return;
        setState((prev) => {
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
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.selectedId, state.comments]);

  const handleChangeMode = (mode: ToolMode) => {
    setState((prev) => ({ ...prev, toolMode: mode }));
  };

  const handleToggleHighlightMode = () => {
    setState((prev) => ({ ...prev, highlightMode: !prev.highlightMode }));
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
    
    // Crear también un comentario anclado si se proporcionaron coordenadas
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
        author: "Revisor",
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
      commentId, // Ligar el highlight con el comentario
    };
    
    setState((prev) => ({
      ...prev,
      highlights: [...prev.highlights, newHighlight],
      comments: newComment ? [...prev.comments, newComment] : prev.comments,
      // Si se creó un comentario, seleccionarlo automáticamente
      selectedId: newComment ? newComment.id : prev.selectedId,
      draftText: newComment ? "" : prev.draftText,
      // Desactivar el modo de resaltado cuando se crea un comentario
      highlightMode: newComment ? false : prev.highlightMode,
    }));
    
    // Si se creó un comentario y estamos en móvil, abrir el drawer
    if (newComment && isMobile) {
      setDrawerOpen(true);
    }
  };

  const handleDeleteHighlight = (id: string) => {
    setState((prev) => {
      // Buscar el highlight para obtener el commentId asociado
      const highlightToDelete = prev.highlights.find((h) => h.id === id);
      const commentIdToDelete = highlightToDelete?.commentId;
      
      // Eliminar el highlight
      const remainingHighlights = prev.highlights.filter((h) => h.id !== id);
      
      // Si el highlight tenía un comentario asociado, también eliminarlo
      const remainingComments = commentIdToDelete
        ? prev.comments.filter((c) => c.id !== commentIdToDelete)
        : prev.comments;
      
      // Si se eliminó el comentario seleccionado, limpiar la selección
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
    // Antes de cambiar de selección, guardar el draft actual si hay texto
    setState((prev) => {
      const current = prev.comments.find((c) => c.id === prev.selectedId);
      if (current && prev.draftText.trim() && prev.draftText !== current.text) {
        // Auto-guardar cambios antes de cambiar de selección
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
  };

  const handleDelete = (id: string) => {
    setState((prev) => {
      // Buscar highlights asociados a este comentario
      const highlightsToDelete = prev.highlights
        .filter((h) => h.commentId === id)
        .map((h) => h.id);
      
      // Eliminar el comentario
      const remaining = prev.comments.filter((c) => c.id !== id);
      const newSelected = remaining[0]?.id ?? null;
      
      // Eliminar los highlights asociados
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
    // Solo se eliminará si el usuario hace clic en "Cancelar" explícitamente
  };

  const handleCancelDraft = () => {
    // Si el comentario seleccionado está vacío (texto persistido y draft),
    // cancelar debe eliminar el ancla (requisito).
    if (
      !selectedComment ||
      (!selectedComment.text.trim() && !state.draftText.trim())
    ) {
      handleMaybeRemoveEmptySelected();
      return;
    }

    // Si hay texto guardado, restaurar el draft al texto guardado
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

  // Carga de archivo Word (.docx) y conversión a HTML (solo cliente)
  const handleUploadWord = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      window.alert("Por favor selecciona un archivo .docx de Word.");
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const mammoth = await import("mammoth/mammoth.browser");
      const { value } = await mammoth.convertToHtml({ arrayBuffer });
      const rawHtml = value || "";

      // Intentar detectar saltos de página generados por Word (page-break-*).
      // Si no se encuentran, hacemos una paginación aproximada por longitud de texto.
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
    } catch (err) {
      console.error(err);
      window.alert("No se pudo leer el archivo de Word. Verifica el formato.");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-100">
      <Toolbar
        toolMode={state.toolMode}
        commentsCount={state.comments.length}
        onChangeMode={handleChangeMode}
        onUploadWord={handleUploadWord}
        highlightMode={state.highlightMode}
        onToggleHighlightMode={handleToggleHighlightMode}
      />
      <div
        ref={containerRef}
        className="flex flex-1 flex-row gap-4 overflow-hidden p-4"
      >
        <div className="flex-1 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-6">
          <DocumentViewerPages
            pages={state.pages}
            comments={state.comments}
            selectedId={state.selectedId}
            toolMode={state.toolMode}
            onSelect={handleSelectComment}
            onUpdatePosition={handleUpdateCommentPosition}
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
          <div className="flex w-96 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <CommentsPanel
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
              <CommentsPanel
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
    </div>
  );
}

