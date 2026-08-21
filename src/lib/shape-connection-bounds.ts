/**
 * Shape connection bounds - normalized edge positions for polygon shapes.
 * Connector entry/exit points must land on the visible shape boundary, not the
 * rectangular bounding box. Polygon shapes (octagon, hexagon, pentagon, etc.)
 * have angled edges and don't fill their viewBox, so we use shape-specific geometry.
 *
 * Values are in viewBox coordinates. Applied as: x = obj.x + (leftNorm/vbW)*width
 * with SVG meet scaling: scale = min(width/vbW, height/vbH), then
 * offsetX = (width - scale*vbW)/2, so: x = obj.x + offsetX + leftNorm * scale.
 */

export interface ShapeEdgeBounds {
  /** Top edge center Y (in viewBox coords) */
  topY: number;
  /** Bottom edge center Y */
  bottomY: number;
  /** Left edge center X */
  leftX: number;
  /** Right edge center X */
  rightX: number;
  viewBoxW: number;
  viewBoxH: number;
  /** When true, SVG uses preserveAspectRatio="none" (stretch to fill); use linear scaling */
  stretchScaling?: boolean;
}

/** Returns edge bounds for a shape type; null means use full bounding box (rectangle behavior) */
export function getShapeEdgeBounds(shapeType: string | undefined): ShapeEdgeBounds | null {
   // Pie / ring charts use the same 60×60 circular viewBox + meet as `generic.object.circle`.
  if (shapeType === 'generic.chart.pie' || shapeType === 'generic.chart.ring') {
    return { topY: 1, bottomY: 59, leftX: 1, rightX: 59, viewBoxW: 60, viewBoxH: 60 };
  }
  if (!shapeType?.startsWith?.('generic.object.')) return null;
  const base = shapeType.replace(/^generic\.object\./, '');
  const suffix = base.includes('.') ? base.split('.').pop()! : base;

  switch (suffix) {
    case 'circle':
    case 'ring':
      // viewBox 60x60, center (30,30), radius ~29. Top (30,1), Bottom (30,59), Left (1,30), Right (59,30)
      return { topY: 1, bottomY: 59, leftX: 1, rightX: 59, viewBoxW: 60, viewBoxH: 60 };

    case 'octagon':
      // Tight viewBox 52x52, Top (26,1), Bottom (26,51), Left (1,26), Right (51,26)
      return { topY: 1, bottomY: 51, leftX: 1, rightX: 51, viewBoxW: 52, viewBoxH: 52, stretchScaling: true };

    case 'hexagon':
      // Tight viewBox 42x52, Top (21,1), Bottom (21,51), Left (1,26), Right (41,26)
      return { topY: 1, bottomY: 51, leftX: 1, rightX: 41, viewBoxW: 42, viewBoxH: 52, stretchScaling: true };

    case 'pentagon':
      // Tight viewBox 46x45, Top (23,1), Bottom (23,44), Left (1,25), Right (45,25)
      return { topY: 1, bottomY: 44, leftX: 1, rightX: 45, viewBoxW: 46, viewBoxH: 45, stretchScaling: true };

    case 'kite':
      // Tight viewBox 42x52 (transformed from 60x60), Top (21,0), Bottom (21,50), Left (0,25), Right (40,25)
      return { topY: 0, bottomY: 50, leftX: 0, rightX: 40, viewBoxW: 42, viewBoxH: 52, stretchScaling: true };

    case 'trapezoid':
      // Tight viewBox 72x42, Top (35,1), Bottom (35,41), Left (0,21), Right (70,21)
      return { topY: 1, bottomY: 41, leftX: 0, rightX: 70, viewBoxW: 72, viewBoxH: 42, stretchScaling: true };

    case 'parallelogram':
      // Tight viewBox 72x42, Top center ~(41,1), Bottom ~(26,41), Left ~(4,21), Right ~(68,21)
      return { topY: 1, bottomY: 41, leftX: 4, rightX: 68, viewBoxW: 72, viewBoxH: 42, stretchScaling: true };

    case 'arrowhead':
      // Tight viewBox 52x32, Top (25,1), Bottom (25,31), Left (1,20), Right (51,20)
      return { topY: 1, bottomY: 31, leftX: 1, rightX: 51, viewBoxW: 52, viewBoxH: 32, stretchScaling: true };

    case 'chevron':
      // Tight viewBox 32x32, Top (15,1), Bottom (15,31), Left (1,16), Right (31,16)
      return { topY: 1, bottomY: 31, leftX: 1, rightX: 31, viewBoxW: 32, viewBoxH: 32, stretchScaling: true };

    case 'triangle':
      // Tight viewBox 52x47, Top (26,1), Bottom (26,46), Left (1,46), Right (51,46)
      return { topY: 1, bottomY: 46, leftX: 1, rightX: 51, viewBoxW: 52, viewBoxH: 47, stretchScaling: true };

    case 'star':
      // Tight viewBox 58x56, approximate extent
      return { topY: 1, bottomY: 55, leftX: 1, rightX: 57, viewBoxW: 58, viewBoxH: 56, stretchScaling: true };

    default:
      return null;
  }
}

/**
 * Compute connection point (x,y) for a shape's edge using its viewBox geometry.
 * Uses SVG preserveAspectRatio "meet" scaling.
 */
/** Kite tight viewBox 42×52 (transformed), vertices: Top(21,0), Right(41,26), Bottom(21,50), Left(1,26) */
const KITE_VIEWBOX = { w: 42, h: 52 };
const KITE_CENTER = { x: 21, y: 26 };

type KiteEdge = 'top' | 'right' | 'bottom' | 'left';

/** Returns the 3 points of the kite edge path in viewBox coords (polyline of 2 segments) */
export function getKiteEdgePath(edge: KiteEdge): Array<{ x: number; y: number }> {
  switch (edge) {
    case 'top': return [{ x: 1, y: 26 }, { x: 21, y: 0 }, { x: 41, y: 26 }];
    case 'right': return [{ x: 21, y: 0 }, { x: 41, y: 26 }, { x: 21, y: 50 }];
    case 'bottom': return [{ x: 41, y: 26 }, { x: 21, y: 50 }, { x: 1, y: 26 }];
    case 'left': return [{ x: 21, y: 50 }, { x: 1, y: 26 }, { x: 21, y: 0 }];
  }
}

/** Linear interpolation: t∈[0,1] along polyline with 3 points (2 segments). t=0.5 is middle vertex. */
function interpolateKitePath(path: Array<{ x: number; y: number }>, t: number): { x: number; y: number } {
  if (t <= 0.5) {
    const u = t * 2; // 0..1 on first segment
    return { x: path[0].x + (path[1].x - path[0].x) * u, y: path[0].y + (path[1].y - path[0].y) * u };
  } else {
    const u = (t - 0.5) * 2; // 0..1 on second segment
    return { x: path[1].x + (path[2].x - path[1].x) * u, y: path[1].y + (path[2].y - path[1].y) * u };
  }
}

/** Outward normal angle in degrees (for bezier: 0=up, 90=right, 180=down, 270=left). Point is on edge; outward = from center to point. */
export function getKiteEdgeAngleAtT(edge: KiteEdge, t: number): number {
  const path = getKiteEdgePath(edge);
  const pt = interpolateKitePath(path, t);
  const dx = pt.x - KITE_CENTER.x;
  const dy = pt.y - KITE_CENTER.y;
  const mathDeg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0=right, 90=down
  return ((mathDeg + 90) % 360 + 360) % 360; // convert to 0=up, 90=right
}

/** Outward offset for kite connectors as % of size - scales with kite so larger kites get more clearance */
const KITE_CONNECTOR_OFFSET_RATIO = 0.02;

/**
 * Connection point on kite edge at parametric t, with screen coords and exit angle.
 * Uses SVG stretch scaling (preserveAspectRatio="none") to match rendered kite.
 * Applies outward offset (2% of size) so connectors don't sit exactly on the boundary.
 */
export function getKiteConnectionPoint(
  edge: KiteEdge,
  t: number,
  obj: { x: number; y: number },
  width: number,
  height: number
): { x: number; y: number; angleDeg: number } {
  const path = getKiteEdgePath(edge);
  const pt = interpolateKitePath(path, t);
  const { w, h } = KITE_VIEWBOX;
  let x = obj.x + (pt.x / w) * width;
  let y = obj.y + (pt.y / h) * height;
  const angleDeg = getKiteEdgeAngleAtT(edge, t);
  const rad = (angleDeg * Math.PI) / 180;
  const offsetPx = Math.min(width, height) * KITE_CONNECTOR_OFFSET_RATIO;
  x += offsetPx * Math.sin(rad);
  y -= offsetPx * Math.cos(rad);
  return { x, y, angleDeg };
}

/** Check if type is kite for connection logic */
export function isKiteShapeType(shapeType: string | undefined): boolean {
  if (!shapeType?.startsWith?.('generic.object.')) return false;
  const suffix = shapeType.replace(/^generic\.object\./, '').split('.').pop() || '';
  return suffix === 'kite';
}

export function shapeEdgeToPoint(
  bounds: ShapeEdgeBounds,
  obj: { x: number; y: number },
  width: number,
  height: number,
  edge: 'top' | 'bottom' | 'left' | 'right'
): { x: number; y: number } {
  const { viewBoxW, viewBoxH, stretchScaling } = bounds;
  if (stretchScaling) {
    // SVG uses preserveAspectRatio="none" - linear stretch to fill
    switch (edge) {
      case 'top':
        return { x: obj.x + (bounds.leftX + bounds.rightX) / 2 / viewBoxW * width, y: obj.y + bounds.topY / viewBoxH * height };
      case 'bottom':
        return { x: obj.x + (bounds.leftX + bounds.rightX) / 2 / viewBoxW * width, y: obj.y + bounds.bottomY / viewBoxH * height };
      case 'left':
        return { x: obj.x + bounds.leftX / viewBoxW * width, y: obj.y + (bounds.topY + bounds.bottomY) / 2 / viewBoxH * height };
      case 'right':
        return { x: obj.x + bounds.rightX / viewBoxW * width, y: obj.y + (bounds.topY + bounds.bottomY) / 2 / viewBoxH * height };
    }
  }
  const scale = Math.min(width / viewBoxW, height / viewBoxH);
  const offsetX = (width - scale * viewBoxW) / 2;
  const offsetY = (height - scale * viewBoxH) / 2;

  switch (edge) {
    case 'top':
      return {
        x: obj.x + offsetX + (bounds.leftX + bounds.rightX) / 2 * scale,
        y: obj.y + offsetY + bounds.topY * scale,
      };
    case 'bottom':
      return {
        x: obj.x + offsetX + (bounds.leftX + bounds.rightX) / 2 * scale,
        y: obj.y + offsetY + bounds.bottomY * scale,
      };
    case 'left':
      return {
        x: obj.x + offsetX + bounds.leftX * scale,
        y: obj.y + offsetY + (bounds.topY + bounds.bottomY) / 2 * scale,
      };
    case 'right':
      return {
        x: obj.x + offsetX + bounds.rightX * scale,
        y: obj.y + offsetY + (bounds.topY + bounds.bottomY) / 2 * scale,
      };
  }
}
