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
  points?: { x: number; y: number }[]; // Array de puntos normalizados para dibujo libre
  strokeWidth?: number; // Ancho del trazo para dibujo libre
  createdAt: string; // ISO timestamp
  createdByUserId: string;
}

export interface AnnotationSet {
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
  my: AnnotationSet | null;
  others: AnnotationSet[];
  authors: Array<{
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  }>;
  last_updated_at: string | null;
}

// Mantener tipos antiguos por compatibilidad (deprecated)
/** @deprecated Usar AnnotationSet en su lugar */
export interface AnnotationDraft {
  id: string;
  annotations_json: Annotation[];
  created_at: string;
  updated_at: string;
}

/** @deprecated Usar AnnotationSet en su lugar */
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

