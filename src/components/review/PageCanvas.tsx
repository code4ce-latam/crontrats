"use client";

import * as React from "react";
import type { AnchorComment, ToolMode } from "@/types/comments";
import { PinsLayer } from "./PinsLayer";

type DocumentViewerPagesProps = {
  pages: number;
  comments: AnchorComment[];
  selectedId: string | null;
  toolMode: ToolMode;
  onCreateAnchor: (page: number, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  orderMap: Record<string, number>;
  documentHtmlPages: string[] | null;
};

export function DocumentViewerPages({
  pages,
  comments,
  selectedId,
  toolMode,
  onCreateAnchor,
  onSelect,
  onUpdatePosition,
  pageRefs,
  orderMap,
  documentHtmlPages,
}: DocumentViewerPagesProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      {Array.from({ length: pages }).map((_, index) => {
        const pageNumber = index + 1;
        const pageComments = comments.filter((c) => c.page === pageNumber);
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
            onCreateAnchor={onCreateAnchor}
            onSelect={onSelect}
            onUpdatePosition={onUpdatePosition}
            orderMap={orderMap}
            documentHtml={
              documentHtmlPages ? documentHtmlPages[pageNumber - 1] ?? null : null
            }
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
  onCreateAnchor: (page: number, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, page: number, x: number, y: number) => void;
  orderMap: Record<string, number>;
  documentHtml: string | null;
};

export const PageCanvas = React.forwardRef<HTMLDivElement, PageCanvasProps>(
  (
    {
      page,
      comments,
      selectedId,
      toolMode,
      onCreateAnchor,
      onSelect,
      onUpdatePosition,
      orderMap,
      documentHtml,
    },
    ref
  ) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (toolMode !== "ANCHOR") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      onCreateAnchor(page, x, y);
    };

    return (
      <div className="w-full max-w-[794px]">
        <div className="mb-2 text-xs font-medium text-zinc-500">
          Página {page}
        </div>
        <div
          ref={ref}
          className={
            documentHtml
              ? "relative w-full min-h-[842px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
              : "relative aspect-[210/297] w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
          }
          onClick={handleClick}
        >
          {documentHtml ? (
            <div className="h-full w-full p-6 text-sm leading-relaxed text-zinc-800">
              <div
                className="pointer-events-none prose max-w-none"
                dangerouslySetInnerHTML={{ __html: documentHtml }}
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
          />
        </div>
      </div>
    );
  }
);

PageCanvas.displayName = "PageCanvas";


