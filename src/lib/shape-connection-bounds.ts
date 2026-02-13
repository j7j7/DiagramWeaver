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
