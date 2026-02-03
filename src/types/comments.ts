export type ToolMode = "SELECT" | "ANCHOR" | "PAN";

export type AnchorComment = {
  id: string;
  page: number;
  x: number; // 0..1 relativo al ancho de la página
  y: number; // 0..1 relativo al alto de la página
  text: string;
  author: string;
  createdAt: string;
  updatedAt?: string;
};

// Highlight independiente de comentarios
export type TextHighlight = {
  id: string;
  page: number;
  selectedText?: string; // El texto seleccionado (opcional, para compatibilidad)
  rangeStart?: number; // Offset del inicio del texto resaltado (opcional)
  rangeEnd?: number; // Offset del fin del texto resaltado (opcional)
  containerSelector?: string; // Selector del contenedor (opcional)
  // Paths de pintura (nuevo método)
  paintPaths?: Array<{
    x: number; // Coordenada X relativa (0-1)
    y: number; // Coordenada Y relativa (0-1)
  }>;
  paintWidth?: number; // Ancho del pincel en píxeles
  paintHeight?: number; // Alto del pincel en píxeles
  color?: string; // Color del highlight (opcional, por defecto amarillo)
  createdAt: string;
  commentId?: string; // ID del comentario asociado (opcional, para ligar highlight con comentario)
};


