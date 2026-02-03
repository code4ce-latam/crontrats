"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AnchorComment } from "@/types/comments";

type CommentsPanelProps = {
  comments: AnchorComment[];
  selectedId: string | null;
  draftText: string;
  onSelect: (id: string) => void;
  onChangeDraft: (text: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onBlurDraft: () => void;
  onCancelDraft: () => void;
  onSaveComment: (id: string, text: string) => void;
};

export function CommentsPanel({
  comments,
  selectedId,
  draftText,
  onSelect,
  onChangeDraft,
  onSave,
  onDelete,
  onBlurDraft,
  onCancelDraft,
  onSaveComment,
}: CommentsPanelProps) {
  const selected = comments.find((c) => c.id === selectedId) ?? null;
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState<string>("");
  const editTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Enfocar el textarea cuando entramos en modo edición
  React.useEffect(() => {
    if (editingId && editTextareaRef.current) {
      // Usar setTimeout para asegurar que el DOM esté completamente renderizado
      const timeoutId = setTimeout(() => {
        if (editTextareaRef.current) {
          editTextareaRef.current.focus();
          const len = editTextareaRef.current.value.length;
          try {
            editTextareaRef.current.setSelectionRange(len, len);
          } catch {
            // ignorar
          }
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [editingId]);

  // Si se selecciona un comentario nuevo sin texto, entrar en modo edición automáticamente
  React.useEffect(() => {
    if (selected && !selected.text.trim()) {
      // Si no está en modo edición o está editando otro comentario, activar edición
      if (!editingId || editingId !== selected.id) {
        setEditingId(selected.id);
        setEditText("");
      }
    }
  }, [selected, editingId]);

  // También activar edición cuando cambia selectedId directamente (para nuevos comentarios)
  React.useEffect(() => {
    if (selectedId && !editingId) {
      const comment = comments.find((c) => c.id === selectedId);
      if (comment && !comment.text.trim()) {
        // Pequeño delay para asegurar que el DOM esté listo
        const timeoutId = setTimeout(() => {
          setEditingId(selectedId);
          setEditText("");
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedId, comments, editingId]);

  const handleStartEdit = (comment: AnchorComment, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(comment.id);
    setEditText(comment.text);
  };

  const handleSaveEdit = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editText.trim()) {
      onSaveComment(id, editText.trim());
    }
    setEditingId(null);
    setEditText("");
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    // Si estamos editando un comentario, verificar si tiene texto guardado
    if (editingId) {
      const comment = comments.find((c) => c.id === editingId);
      // Si el comentario no tiene texto guardado (es un comentario nuevo), eliminarlo
      if (comment && !comment.text.trim() && !editText.trim()) {
        onDelete(editingId);
      }
    }
    
    setEditingId(null);
    setEditText("");
  };

  const handleDeleteComment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm("¿Eliminar este comentario y su ancla?");
    if (ok) {
      onDelete(id);
      if (editingId === id) {
        setEditingId(null);
        setEditText("");
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          Comentarios anclados
        </h2>
        <p className="text-xs text-zinc-500">
          Selecciona un comentario o crea uno nuevo en el documento.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {comments.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-zinc-500">
            No hay comentarios aún. Usa la herramienta{" "}
            <span className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] font-semibold">
              Anclar comentario
            </span>{" "}
            y haz clic sobre el documento.
          </p>
        )}
        {comments.map((comment) => {
          const isSelected = comment.id === selectedId;
          const isEditing = editingId === comment.id;
          const preview = comment.text.split("\n").slice(0, 2).join(" ");
          const hasText = comment.text.trim().length > 0;
          const updatedAt = comment.updatedAt
            ? new Date(comment.updatedAt).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;
          const createdAt = new Date(comment.createdAt).toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <Card
              key={comment.id}
              className={`transition-all duration-200 ${
                isSelected
                  ? "border-blue-500 bg-gradient-to-r from-blue-50 to-blue-100/50 shadow-md shadow-blue-200/50 ring-2 ring-blue-200"
                  : "border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300"
              } ${isEditing ? "border-2 border-blue-400 shadow-lg shadow-blue-300/50" : ""}`}
              onClick={() => !isEditing && onSelect(comment.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 p-3">
                <div className="flex flex-col gap-1 flex-1">
                  <CardTitle className="text-xs font-semibold text-zinc-900">
                    Comentario #{comments.indexOf(comment) + 1}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-wrap">
                    <span>Página {comment.page}</span>
                    <span>•</span>
                    <span>Por {comment.author}</span>
                    {updatedAt && (
                      <>
                        <span>•</span>
                        <span className="text-blue-600 font-medium">
                          Guardado: {updatedAt}
                        </span>
                      </>
                    )}
                    {!updatedAt && hasText && (
                      <>
                        <span>•</span>
                        <span>Creado: {createdAt}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {hasText && !isEditing && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-semibold text-green-700">
                      ✓
                    </span>
                  )}
                  {!isEditing && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[11px] text-zinc-400 hover:text-blue-600"
                        onClick={(e) => handleStartEdit(comment, e)}
                        title="Editar comentario"
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-zinc-400 hover:text-red-600"
                        onClick={(e) => handleDeleteComment(comment.id, e)}
                        title="Eliminar comentario"
                      >
                        ×
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      ref={editTextareaRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Escribe aquí el comentario…"
                      rows={3}
                      className="text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={(e) => handleCancelEdit(e)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => handleSaveEdit(comment.id, e)}
                        disabled={!editText.trim()}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="line-clamp-2 text-xs text-zinc-600">
                      {preview || "Sin texto"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}

