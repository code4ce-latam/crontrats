"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  FileText, 
  User,
} from "lucide-react";
import type { Annotation } from "@/lib/annotations/types";

interface AnnotationAuthor {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface AnnotationSet {
  id: string;
  annotations_json: Annotation[];
  created_at: string;
  updated_at: string;
  created_by: AnnotationAuthor;
}

interface AnnotationSidebarProps {
  my: AnnotationSet | null;
  others: AnnotationSet[];
  authors: AnnotationAuthor[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onAnnotationClick: (annotation: Annotation) => void;
  selectedAnnotationId: string | null;
  mode: 'view' | 'annotate';
  currentUserId: string;
  selectedAuthorId: string | null;
  onAuthorFilterChange: (authorId: string | null) => void;
}

export function AnnotationSidebar({
  my,
  others,
  authors,
  currentPage,
  onPageChange,
  onAnnotationClick,
  selectedAnnotationId,
  mode,
  currentUserId,
  selectedAuthorId,
  onAuthorFilterChange,
}: AnnotationSidebarProps) {
  const annotationsByPage = useMemo(() => {
    const allAnnotations: Array<{ annotation: Annotation; author: AnnotationAuthor; setId: string }> = [];
    
    // Agregar mis anotaciones
    if (my && (!selectedAuthorId || selectedAuthorId === my.created_by.user_id)) {
      my.annotations_json.forEach(ann => {
        allAnnotations.push({ 
          annotation: ann, 
          author: my.created_by,
          setId: my.id 
        });
      });
    }
    
    // Agregar anotaciones de otros
    others.forEach(otherSet => {
      if (!selectedAuthorId || selectedAuthorId === otherSet.created_by.user_id) {
        otherSet.annotations_json.forEach(ann => {
          allAnnotations.push({ 
            annotation: ann, 
            author: otherSet.created_by,
            setId: otherSet.id 
          });
        });
      }
    });

    const grouped: Record<number, typeof allAnnotations> = {};
    allAnnotations.forEach(item => {
      if (!grouped[item.annotation.page]) {
        grouped[item.annotation.page] = [];
      }
      grouped[item.annotation.page].push(item);
    });

    return grouped;
  }, [my, others, selectedAuthorId]);

  const pages = Object.keys(annotationsByPage).map(Number).sort((a, b) => a - b);

  const handleAnnotationClick = (annotation: Annotation) => {
    onPageChange(annotation.page);
    setTimeout(() => {
      onAnnotationClick(annotation);
    }, 100);
  };

  const totalAnnotations = useMemo(() => {
    let count = 0;
    if (my && (!selectedAuthorId || selectedAuthorId === my.created_by.user_id)) {
      count += my.annotations_json.length;
    }
    others.forEach(other => {
      if (!selectedAuthorId || selectedAuthorId === other.created_by.user_id) {
        count += other.annotations_json.length;
      }
    });
    return count;
  }, [my, others, selectedAuthorId]);

  return (
    <div className="flex flex-col h-full border-l bg-background w-96 flex-shrink-0">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Anotaciones</h3>
        </div>
        
        {/* Filtro por autor */}
        {authors.length > 0 && (
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Filtrar por autor:
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedAuthorId === null ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => onAuthorFilterChange(null)}
              >
                Todos ({totalAnnotations})
              </Button>
              {authors.map(author => {
                // Calcular conteo de anotaciones para este autor
                let authorCount = 0;
                if (my && my.created_by.user_id === author.user_id) {
                  authorCount += my.annotations_json.length;
                }
                others.forEach(other => {
                  if (other.created_by.user_id === author.user_id) {
                    authorCount += other.annotations_json.length;
                  }
                });

                return (
                  <Button
                    key={author.user_id}
                    variant={selectedAuthorId === author.user_id ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs flex items-center gap-1"
                    onClick={() => onAuthorFilterChange(author.user_id)}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={author.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px]">
                        {author.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {author.display_name} ({authorCount})
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          {totalAnnotations > 0 ? (
            <span>{totalAnnotations} anotación(es)</span>
          ) : (
            <span>No hay anotaciones</span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {pages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay anotaciones</p>
            </div>
          ) : (
            pages.map(pageNum => {
              const pageAnnotations = annotationsByPage[pageNum];
              return (
                <div key={pageNum} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">Página {pageNum}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {pageAnnotations.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {pageAnnotations.map((item, idx) => {
                      const ann = item.annotation;
                      const isSelected = selectedAnnotationId === ann.id;
                      const initials = item.author.display_name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) || 'U';
                      
                      return (
                        <div
                          key={`${item.setId}-${ann.id}-${idx}`}
                          className={`p-3 rounded border cursor-pointer transition-colors ${
                            isSelected 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border hover:bg-muted'
                          }`}
                          onClick={() => handleAnnotationClick(ann)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-medium capitalize">
                                {ann.type === 'HIGHLIGHT' ? 'Resaltado' : 
                                 ann.type === 'TEXT' ? 'Texto' : 'Comentario'}
                              </span>
                            </div>
                          </div>
                          {ann.text && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {ann.text}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={item.author.avatar_url || undefined} alt={item.author.display_name} />
                              <AvatarFallback className="text-[10px]">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground truncate flex-1">
                              {item.author.display_name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

