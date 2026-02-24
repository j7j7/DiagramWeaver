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
}

/** Returns edge bounds for a shape type; null means use full bounding box (rectangle behavior) */
export function getShapeEdgeBounds(shapeType: string | undefined): ShapeEdgeBounds | null {
  if (!shapeType?.startsWith?.('generic.object.')) return null;
  const base = shapeType.replace(/^generic\.object\./, '');
  const suffix = base.includes('.') ? base.split('.').pop()! : base;

  switch (suffix) {
    case 'circle':
      // viewBox 60x60, center (30,30), radius ~29. Top (30,1), Bottom (30,59), Left (1,30), Right (59,30)
      return { topY: 1, bottomY: 59, leftX: 1, rightX: 59, viewBoxW: 60, viewBoxH: 60 };

    case 'octagon':
      // viewBox 60x60, points "20,5 40,5 55,20 55,40 40,55 20,55 5,40 5,20"
      // Top edge y=5 center x=30, Bottom y=55 x=30, Left x=5 y=30, Right x=55 y=30
      return { topY: 5, bottomY: 55, leftX: 5, rightX: 55, viewBoxW: 60, viewBoxH: 60 };

    case 'hexagon':
      // viewBox 60x60, points "30,5 50,17.5 50,42.5 30,55 10,42.5 10,17.5"
      // Top vertex (30,5), Bottom (30,55), Left edge center (10,30), Right (50,30)
      return { topY: 5, bottomY: 55, leftX: 10, rightX: 50, viewBoxW: 60, viewBoxH: 60 };

    case 'pentagon':
      // viewBox 60x60, points "30,5 52,22 46,48 14,48 8,22"
      // Top (30,5), Bottom flat edge (30,48), Left extent (8,~35), Right (52,~35)
      return { topY: 5, bottomY: 48, leftX: 8, rightX: 52, viewBoxW: 60, viewBoxH: 60 };

    case 'kite':
      // viewBox 60x60, points "30,5 50,30 30,55 10,30"
      // Top (30,5), Bottom (30,55), Left (10,30), Right (50,30)
      return { topY: 5, bottomY: 55, leftX: 10, rightX: 50, viewBoxW: 60, viewBoxH: 60 };

    case 'trapezoid':
      // viewBox 80x50, points "15,5 65,5 75,45 5,45"
      // Top (40,5), Bottom (40,45), Left (10,25), Right (70,25)
      return { topY: 5, bottomY: 45, leftX: 10, rightX: 70, viewBoxW: 80, viewBoxH: 50 };

    case 'parallelogram':
      // viewBox 80x50, points "20,5 75,5 60,45 5,45"
      // Top center ~(47.5,5), Bottom ~(32.5,45), Left ~(12.5,25), Right ~(67.5,25)
      return { topY: 5, bottomY: 45, leftX: 12.5, rightX: 67.5, viewBoxW: 80, viewBoxH: 50 };

    case 'arrowhead':
      // viewBox 60x40, points "5,5 45,5 45,15 55,20 45,25 45,35 5,35"
      return { topY: 5, bottomY: 35, leftX: 5, rightX: 55, viewBoxW: 60, viewBoxH: 40 };

    case 'chevron':
      // viewBox 60x40, points "5,5 25,5 35,20 25,35 5,35 15,20"
      // Top center (15,5), Bottom (15,35), Left (5,20), Right (35,20)
      return { topY: 5, bottomY: 35, leftX: 5, rightX: 35, viewBoxW: 60, viewBoxH: 40 };

    case 'triangle':
      // viewBox 60x60, points "30,5 55,50 5,50"
      // Top vertex (30,5), Bottom edge center (30,50), Left (5,50) and Right (55,50) - use corners
      return { topY: 5, bottomY: 50, leftX: 5, rightX: 55, viewBoxW: 60, viewBoxH: 60 };

    case 'star':
      // Complex - use approximate extent. viewBox 60x60
      return { topY: 2, bottomY: 56, leftX: 2, rightX: 58, viewBoxW: 60, viewBoxH: 60 };

    default:
      return null;
  }
}

/**
 * Compute connection point (x,y) for a shape's edge using its viewBox geometry.
 * Uses SVG preserveAspectRatio "meet" scaling.
 */
/** Kite viewBox 60×60, vertices: Top(30,5), Right(50,30), Bottom(30,55), Left(10,30) */
const KITE_VIEWBOX = { w: 60, h: 60 };
const KITE_CENTER = { x: 30, y: 30 };

type KiteEdge = 'top' | 'right' | 'bottom' | 'left';

/** Returns the 3 points of the kite edge path in viewBox coords (polyline of 2 segments) */
export function getKiteEdgePath(edge: KiteEdge): Array<{ x: number; y: number }> {
  switch (edge) {
    case 'top': return [{ x: 10, y: 30 }, { x: 30, y: 5 }, { x: 50, y: 30 }];
    case 'right': return [{ x: 30, y: 5 }, { x: 50, y: 30 }, { x: 30, y: 55 }];
    case 'bottom': return [{ x: 50, y: 30 }, { x: 30, y: 55 }, { x: 10, y: 30 }];
    case 'left': return [{ x: 30, y: 55 }, { x: 10, y: 30 }, { x: 30, y: 5 }];
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
 * Uses SVG "meet" scaling to match rendered kite. Applies outward offset (2% of size) so
 * connectors don't sit exactly on the boundary; scales when kite is resized.
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
  const scale = Math.min(width / w, height / h);
  const offsetX = (width - scale * w) / 2;
  const offsetY = (height - scale * h) / 2;
  let x = obj.x + offsetX + pt.x * scale;
  let y = obj.y + offsetY + pt.y * scale;
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
  const { viewBoxW, viewBoxH } = bounds;
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
