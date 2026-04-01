/**
 * Hand Drawing Annotation Types and Utilities
 * Supports freehand drawing with strokes, colors, and styles
 */

/** A single point in a stroke */
export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number; // 0-1, for pressure-sensitive devices
}

/** A complete hand-drawn stroke */
export interface AnnotationStroke {
  id: string;
  points: StrokePoint[];
  color: string; // Hex color (e.g., '#FF0000')
  width: number; // Stroke width in pixels
  opacity: number; // 0-1
  timestamp: number; // When the stroke was created
  style?: 'pen' | 'marker' | 'highlighter' | 'eraser'; // Drawing style
}

/** Container for all annotations in a diagram */
export interface DiagramAnnotations {
  enabled: boolean; // Whether annotations are active
  strokes: AnnotationStroke[];
  createdAt: number;
  updatedAt: number;
}

/** Annotation tool configuration */
export interface AnnotationToolConfig {
  enabled: boolean;
  color: string;
  width: number; // 1-20 pixels
  opacity: number; // 0-1
  style: 'pen' | 'marker' | 'highlighter' | 'eraser';
}

/** Slide-specific annotations for presentation mode */
export interface SlideAnnotations {
  enabled: boolean;
  strokes: AnnotationStroke[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Serialize annotations to JSON
 */
export function serializeAnnotations(annotations: DiagramAnnotations): string {
  return JSON.stringify(annotations);
}

/**
 * Deserialize annotations from JSON
 */
export function deserializeAnnotations(json: string): DiagramAnnotations {
  try {
    const data = JSON.parse(json);
    return validateAnnotations(data);
  } catch (error) {
    console.error('Failed to deserialize annotations:', error);
    return { enabled: false, strokes: [], createdAt: Date.now(), updatedAt: Date.now() };
  }
}

/**
 * Validate annotations structure
 */
export function validateAnnotations(data: unknown): DiagramAnnotations {
  if (!data || typeof data !== 'object') {
    return { enabled: false, strokes: [], createdAt: Date.now(), updatedAt: Date.now() };
  }

  const anno = data as Record<string, unknown>;
  const strokes = Array.isArray(anno.strokes) ? anno.strokes : [];

  return {
    enabled: Boolean(anno.enabled),
    strokes: strokes.filter(isValidStroke),
    createdAt: typeof anno.createdAt === 'number' ? anno.createdAt : Date.now(),
    updatedAt: typeof anno.updatedAt === 'number' ? anno.updatedAt : Date.now(),
  };
}

/**
 * Type guard for annotation stroke
 */
function isValidStroke(stroke: unknown): stroke is AnnotationStroke {
  if (!stroke || typeof stroke !== 'object') return false;

  const s = stroke as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    Array.isArray(s.points) &&
    s.points.every((p: unknown) => {
      if (typeof p !== 'object' || !p) return false;
      const point = p as Record<string, unknown>;
      return typeof point.x === 'number' && typeof point.y === 'number';
    }) &&
    typeof s.color === 'string' &&
    typeof s.width === 'number' &&
    typeof s.opacity === 'number' &&
    typeof s.timestamp === 'number'
  );
}

/**
 * Create an empty annotations container
 */
export function createEmptyAnnotations(): DiagramAnnotations {
  return {
    enabled: false,
    strokes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Add a stroke to annotations
 */
export function addStroke(annotations: DiagramAnnotations, stroke: AnnotationStroke): DiagramAnnotations {
  return {
    ...annotations,
    strokes: [...annotations.strokes, stroke],
    updatedAt: Date.now(),
  };
}

/**
 * Remove a stroke by ID
 */
export function removeStroke(annotations: DiagramAnnotations, strokeId: string): DiagramAnnotations {
  return {
    ...annotations,
    strokes: annotations.strokes.filter((s) => s.id !== strokeId),
    updatedAt: Date.now(),
  };
}

/**
 * Clear all strokes
 */
export function clearStrokes(annotations: DiagramAnnotations): DiagramAnnotations {
  return {
    ...annotations,
    strokes: [],
    updatedAt: Date.now(),
  };
}

/**
 * Undo last stroke
 */
export function undoLastStroke(annotations: DiagramAnnotations): DiagramAnnotations {
  if (annotations.strokes.length === 0) return annotations;
  const strokes = annotations.strokes.slice(0, -1);
  return {
    ...annotations,
    strokes,
    updatedAt: Date.now(),
  };
}

/**
 * Get bounding box of all strokes
 */
export function getAnnotationsBounds(annotations: DiagramAnnotations): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (annotations.strokes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of annotations.strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Compress the color string to save space
 * e.g., '#FF0000' -> 'r', '#00FF00' -> 'g'
 */
export function compressColor(color: string): string {
  const lower = color.toLowerCase();
  const colorMap: Record<string, string> = {
    '#000000': '0', // black
    '#ffffff': 'w', // white
    '#ff0000': 'r', // red
    '#00ff00': 'g', // green
    '#0000ff': 'b', // blue
    '#ffff00': 'y', // yellow
    '#ff00ff': 'm', // magenta
    '#00ffff': 'c', // cyan
  };
  return colorMap[lower] || color;
}

/**
 * Decompress color string
 */
export function decompressColor(color: string): string {
  const colorMap: Record<string, string> = {
    '0': '#000000',
    'w': '#ffffff',
    'r': '#ff0000',
    'g': '#00ff00',
    'b': '#0000ff',
    'y': '#ffff00',
    'm': '#ff00ff',
    'c': '#00ffff',
  };
  return colorMap[color] || color;
}

/**
 * Simplify stroke points to reduce file size
 * Uses line simplification algorithm
 */
export function simplifyStroke(stroke: AnnotationStroke, tolerance: number = 2): AnnotationStroke {
  if (stroke.points.length <= 2) return stroke;

  // Ramer-Douglas-Peucker algorithm
  const points = stroke.points;
  const simplified = rdpSimplify(points, tolerance);

  return {
    ...stroke,
    points: simplified,
  };
}

/**
 * Ramer-Douglas-Peucker line simplification
 */
function rdpSimplify(points: StrokePoint[], tolerance: number): StrokePoint[] {
  if (points.length <= 2) return points;

  let maxDistSq = 0;
  let maxIndex = 0;

  const p1 = points[0];
  const p2 = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distSq = perpendicularDistanceSq(points[i], p1, p2);
    if (distSq > maxDistSq) {
      maxDistSq = distSq;
      maxIndex = i;
    }
  }

  const toleranceSq = tolerance * tolerance;
  if (maxDistSq > toleranceSq) {
    const left = rdpSimplify(points.slice(0, maxIndex + 1), tolerance);
    const right = rdpSimplify(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [p1, p2];
}

/**
 * Calculate perpendicular distance squared from point to line
 */
function perpendicularDistanceSq(point: StrokePoint, a: StrokePoint, b: StrokePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const px = point.x - a.x;
    const py = point.y - a.y;
    return px * px + py * py;
  }

  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const px = point.x - projX;
  const py = point.y - projY;

  return px * px + py * py;
}
