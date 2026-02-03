"use client";

import * as React from "react";
import type { AnchorComment, ToolMode, TextHighlight } from "@/types/document-annotations";
import { cn } from "@/lib/utils";

type PdfAnnotatorPinsLayerProps = {
  page: number;
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
  orderMap: Record<string, number>;
  highlights: TextHighlight[];
};

export function PdfAnnotatorPinsLayer({
  page,
  comments,
  selectedId,
  toolMode,
  onSelect,
  onUpdatePosition,
  orderMap,
  highlights,
}: PdfAnnotatorPinsLayerProps) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingId || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      onUpdatePosition(draggingId, page, x, y);
    };

    const handleUp = () => {
      setDraggingId(null);
    };

    if (draggingId) {
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    }
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingId, onUpdatePosition, page]);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    id: string
  ) => {
    if (toolMode !== "SELECT") return;
    e.stopPropagation();
    setDraggingId(id);
  };

  const commentsWithoutHighlights = React.useMemo(() => {
    const highlightCommentIds = new Set(
      highlights.filter((h) => h.commentId).map((h) => h.commentId!)
    );
    return comments.filter((c) => !highlightCommentIds.has(c.id));
  }, [comments, highlights]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
    >
      {commentsWithoutHighlights.map((comment, index) => {
        const order = orderMap[comment.id] ?? index + 1;
        const selected = comment.id === selectedId;
        return (
          <div
            key={comment.id}
            className="pointer-events-none absolute"
            style={{
              left: `${comment.x * 100}%`,
              top: `${comment.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <button
              type="button"
              className={cn(
                "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-shadow",
                selected
                  ? "border-blue-600 bg-blue-600 text-white shadow-lg"
                  : "border-amber-500 bg-amber-400 text-zinc-900 shadow"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(comment.id);
              }}
              onPointerDown={(e) => handlePointerDown(e, comment.id)}
              title={`Comentario #${order} (página ${page})`}
            >
              {order}
            </button>
          </div>
        );
      })}
    </div>
  );
}

