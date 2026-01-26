"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  FileText, 
  Eye, 
  EyeOff,
  CheckCircle2,
  Clock,
  User,
} from "lucide-react";
import type { Annotation, AnnotationDraft, AnnotationPublished } from "@/lib/annotations/types";

interface AnnotationSidebarProps {
  draft: AnnotationDraft | null;
  published: AnnotationPublished[];
  showPublished: boolean;
  onTogglePublished: () => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  onAnnotationClick: (annotation: Annotation) => void;
  selectedAnnotationId: string | null;
  mode: 'view' | 'annotate';
  currentUserId: string;
}

export function AnnotationSidebar({
  draft,
  published,
  showPublished,
  onTogglePublished,
  currentPage,
  onPageChange,
  onAnnotationClick,
  selectedAnnotationId,
  mode,
  currentUserId,
}: AnnotationSidebarProps) {
  const [currentUserProfile, setCurrentUserProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null);

  // Obtener perfil del usuario actual para mostrar en borradores
  useEffect(() => {
    const loadCurrentUserProfile = async () => {
      if (!currentUserId) return;
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', currentUserId)
          .single();
        
        if (profile) {
          setCurrentUserProfile({
            display_name: profile.display_name || 'Usuario',
            avatar_url: profile.avatar_url,
          });
        }
      } catch (error) {
        console.error("[AnnotationSidebar] Error cargando perfil:", error);
      }
    };
    loadCurrentUserProfile();
  }, [currentUserId]);
  const annotationsByPage = useMemo(() => {
    const allAnnotations: Array<{ annotation: Annotation; source: 'draft' | 'published'; sourceId: string }> = [];
    
    if (draft) {
      draft.annotations_json.forEach(ann => {
        allAnnotations.push({ annotation: ann, source: 'draft', sourceId: draft.id });
      });
    }
    
    if (showPublished) {
      published.forEach(pub => {
        pub.annotations_json.forEach(ann => {
          allAnnotations.push({ annotation: ann, source: 'published', sourceId: pub.id });
        });
      });
    }

    const grouped: Record<number, typeof allAnnotations> = {};
    allAnnotations.forEach(item => {
      if (!grouped[item.annotation.page]) {
        grouped[item.annotation.page] = [];
      }
      grouped[item.annotation.page].push(item);
    });

    return grouped;
  }, [draft, published, showPublished]);

  const pages = Object.keys(annotationsByPage).map(Number).sort((a, b) => a - b);

  const handleAnnotationClick = (annotation: Annotation) => {
    onPageChange(annotation.page);
    setTimeout(() => {
      onAnnotationClick(annotation);
    }, 100);
  };

  // Función para obtener información del usuario de una anotación
  const getUserInfo = (item: { annotation: Annotation; source: 'draft' | 'published'; sourceId: string }) => {
    if (item.source === 'draft') {
      // Para borradores, usar el usuario actual
      return currentUserProfile || { display_name: 'Tú', avatar_url: null };
    } else {
      // Para publicadas, buscar en el array de published
      const publishedItem = published.find(p => p.id === item.sourceId);
      return publishedItem?.created_by || { display_name: 'Usuario desconocido', avatar_url: null };
    }
  };

  return (
    <div className="flex flex-col h-full border-l bg-background w-96 flex-shrink-0">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Anotaciones</h3>
          {mode === 'view' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePublished}
            >
              {showPublished ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        
        {draft && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Clock className="h-4 w-4" />
            <span>Mi borrador: {draft.annotations_json.length} anotaciones</span>
          </div>
        )}
        
        {published.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span>Publicadas: {published.length} versión(es)</span>
          </div>
        )}
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
                      return (
                        <div
                          key={`${item.sourceId}-${ann.id}-${idx}`}
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
                              {item.source === 'draft' && (
                                <Badge variant="outline" className="text-xs">Borrador</Badge>
                              )}
                            </div>
                          </div>
                          {ann.text && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {ann.text}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                            {(() => {
                              const userInfo = getUserInfo(item);
                              const initials = userInfo.display_name
                                .split(' ')
                                .map(n => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2) || 'U';
                              return (
                                <>
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={userInfo.avatar_url || undefined} alt={userInfo.display_name} />
                                    <AvatarFallback className="text-[10px]">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground truncate flex-1">
                                    {userInfo.display_name}
                                  </span>
                                </>
                              );
                            })()}
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

