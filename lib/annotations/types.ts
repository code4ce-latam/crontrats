/**
 * Tipos para el sistema de anotaciones sobre PDF
 */

export type AnnotationType = 'HIGHLIGHT' | 'TEXT' | 'COMMENT';

export interface AnnotationRect {
  x: number; // 0..1 (normalizado)
  y: number; // 0..1 (normalizado)
  w: number; // 0..1 (normalizado)
  h: number; // 0..1 (normalizado)
}

export interface Annotation {
  id: string; // nanoid o uuid
  page: number; // 1-indexed
  type: AnnotationType;
  rect: AnnotationRect;
  text?: string; // para TEXT y COMMENT
  color?: string; // hex color (ej: "#FFEB3B")
  opacity?: number; // 0..1 (default: 0.3 para highlight, 1.0 para text/comment)
  createdAt: string; // ISO timestamp
  createdByUserId: string;
}

export interface AnnotationDraft {
  id: string;
  annotations_json: Annotation[];
  created_at: string;
  updated_at: string;
}

export interface AnnotationPublished {
  id: string;
  annotations_json: Annotation[];
  created_at: string;
  updated_at: string;
  created_by: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface AnnotationsListResponse {
  success: boolean;
  draft: AnnotationDraft | null;
  published: AnnotationPublished[];
}

