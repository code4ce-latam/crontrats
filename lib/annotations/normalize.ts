import type { AnnotationRect } from './types';

/**
 * Convierte coordenadas normalizadas (0..1) a píxeles
 */
export function normalizedToPixels(
  rect: AnnotationRect,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x * pageWidth,
    y: rect.y * pageHeight,
    width: rect.w * pageWidth,
    height: rect.h * pageHeight,
  };
}

/**
 * Convierte píxeles a coordenadas normalizadas (0..1)
 */
export function pixelsToNormalized(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number
): AnnotationRect {
  return {
    x: x / pageWidth,
    y: y / pageHeight,
    w: width / pageWidth,
    h: height / pageHeight,
  };
}

/**
 * Valida que las coordenadas normalizadas estén en el rango 0..1
 */
export function validateNormalizedRect(rect: AnnotationRect): boolean {
  return (
    rect.x >= 0 && rect.x <= 1 &&
    rect.y >= 0 && rect.y <= 1 &&
    rect.w >= 0 && rect.w <= 1 &&
    rect.h >= 0 && rect.h <= 1 &&
    rect.x + rect.w <= 1 &&
    rect.y + rect.h <= 1
  );
}

/**
 * Ajusta las coordenadas normalizadas para que estén dentro del rango válido
 */
export function clampNormalizedRect(rect: AnnotationRect): AnnotationRect {
  return {
    x: Math.max(0, Math.min(1, rect.x)),
    y: Math.max(0, Math.min(1, rect.y)),
    w: Math.max(0, Math.min(1 - rect.x, rect.w)),
    h: Math.max(0, Math.min(1 - rect.y, rect.h)),
  };
}

