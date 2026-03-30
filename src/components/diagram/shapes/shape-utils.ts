import type { DiagramNodeData } from "@/lib/types";
import { getTextStylingCSS, extractTextStylingFromNode } from "@/lib/text-styling";

// Helper function to get gradient CSS with angle
export const getGradientWithAngle = (colors: string[], angle: number = 135) => {
  // Convert angle to CSS gradient direction
  let gradientDirection = '';
  switch (angle) {
    case 0:
      gradientDirection = 'to right';
      break;
    case 45:
      gradientDirection = 'to bottom right';
      break;
    case -45:
      gradientDirection = 'to top right';
      break;
    case 90:
      gradientDirection = 'to bottom';
      break;
    case 180:
      gradientDirection = 'to left';
      break;
    default:
      gradientDirection = `${angle}deg`;
  }
  // Ensure unique string by including angle in all cases
  const gradient = `linear-gradient(${gradientDirection}, ${colors[0]}, ${colors[1]})`;
  return gradient;
};

// Helper function to determine if a color is dark or light
const isColorDark = (color: string): boolean => {
  // Convert hex to RGB
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches) {
      r = parseInt(matches[0]);
      g = parseInt(matches[1]);
      b = parseInt(matches[2]);
    }
  }
  
  // Calculate relative luminance (perceived brightness)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if dark (luminance < 0.5)
  return luminance < 0.5;
};

// Helper function to get text color based on background
export const getTextColorForBackground = (backgroundColor: string, customTextColor?: string): string => {
  if (customTextColor) return customTextColor;
  return isColorDark(backgroundColor) ? '#ffffff' : '#000000';
};

// Helper function to get text styling CSS for a node
export const getTextStylingForNode = (node: DiagramNodeData) => {
  const textStyling = extractTextStylingFromNode(node);
  return getTextStylingCSS(textStyling);
};

// Helper function to get text justification class
export const getTextJustifyClass = (justify?: string) => {
  switch (justify) {
    case 'left':
      return 'text-left';
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'full':
      return 'text-justify';
    default:
      return 'text-center';
  }
};

// Helper function to get vertical positioning class (for flex containers with flex-col)
export const getVerticalPositionClass = (position?: string) => {
  switch (position) {
    case 'top':
      return 'items-start';
    case 'middle':
      return 'items-center';
    case 'bottom':
      return 'items-end';
    default:
      return 'items-center';
  }
};

// Helper function to get vertical justification class (for flex containers with flex-col to position content)
export const getVerticalJustifyClass = (position?: string) => {
  switch (position) {
    case 'top':
      return 'justify-start';
    case 'middle':
      return 'justify-center';
    case 'bottom':
      return 'justify-end';
    default:
      return 'justify-center';
  }
};

// Helper function to get tag positioning classes
export const getTagPositionClasses = (position?: string) => {
  switch (position) {
    case 'top-left':
      return '-top-[30px] left-0';
    case 'top-center':
      return '-top-[30px] left-1/2 transform -translate-x-1/2';
    case 'top-right':
      return '-top-[30px] right-0';
    case 'bottom-left':
      return '-bottom-[30px] left-0';
    case 'bottom-center':
      return '-bottom-[30px] left-1/2 transform -translate-x-1/2';
    case 'bottom-right':
      return '-bottom-[30px] right-0';
    default:
      return '-top-[30px] left-1/2 transform -translate-x-1/2'; // Default to top-center
  }
};

// Get shape styling properties from node
export const getShapeStyles = (node: DiagramNodeData & { width?: number; height?: number }) => {
  const nodeAny = node as any;
  const backgroundStyle = nodeAny.backgroundStyle || 'solid';
  const backgroundColors = nodeAny.backgroundColors || [nodeAny.backgroundColor || '#6b7280', nodeAny.backgroundColor || '#6b7280'];
  const backgroundColor = nodeAny.backgroundColor || '#6b7280';
  const gradientAngle = nodeAny.gradientAngle || 135;
  const borderGradientAngle = nodeAny.borderGradientAngle ?? nodeAny.gradientAngle ?? 135;
  const borderStyle = nodeAny.borderStyle || 'solid';
  const borderColor = nodeAny.borderColor || '#6b7280';
  const borderColors = nodeAny.borderColors || [nodeAny.borderColor || '#6b7280', nodeAny.borderColor || '#6b7280'];
  const borderWidth = nodeAny.borderWidth || 2;
  const shadow = nodeAny.shadow || false;
  const roundedEdges = nodeAny.roundedEdges || false;

  return {
    background: backgroundStyle === 'gradient'
      ? getGradientWithAngle(backgroundColors, gradientAngle)
      : backgroundStyle === 'none'
        ? 'transparent'
        : backgroundColor,
    borderWidth: borderStyle === 'none' ? '0' : `${borderWidth}px`,
    borderStyle: borderStyle === 'gradient' ? 'solid' : borderStyle,
    borderColor: borderStyle === 'gradient' ? 'transparent' : borderColor,
    borderColors,
    borderImage: borderStyle === 'gradient' ? `${getGradientWithAngle(borderColors, borderGradientAngle)} 1` : undefined,
    shadow,
    roundedEdges,
    backgroundColor:
      backgroundStyle === 'gradient'
        ? backgroundColors[0]
        : backgroundStyle === 'none'
          ? 'transparent'
          : backgroundColor,
  };
};

/** SVG interior fill from visual styling — `none` is fully transparent, not the solid gray fallback. */
export function getShapeSvgFill(
  backgroundStyle: string | undefined,
  gradientFillRef: string,
  solidColor: string | undefined,
  solidFallback = '#6b7280'
): string {
  if (backgroundStyle === 'gradient') return gradientFillRef;
  if (backgroundStyle === 'none') return 'transparent';
  return solidColor || solidFallback;
}

/**
 * Convert polygon points string to array of [x, y] coordinates
 */
export const parsePoints = (points: string): [number, number][] => {
  return points.split(/\s+/).map(point => {
    const [x, y] = point.split(',').map(Number);
    return [x, y];
  });
};

/**
 * Compute viewBox and transformed points so the shape fills its container.
 * Without this, shapes like kite/triangle use oversized viewBoxes which leave
 * visible padding and cause misalignment with other shapes (e.g. rectangles).
 * @param points - Polygon points string (e.g., "30,5 55,50 5,50")
 * @param strokePadding - Padding for stroke (default 1) so stroke isn't clipped
 * @param targetSize - When provided, viewBox matches node size (w+2*pad, h+2*pad)
 *   and points are scaled to fill; prevents scaling gaps when resizing
 * @returns viewBox string, dimensions, and transformed points for polygon/path
 */
export const getPolygonViewBoxAndPoints = (
  points: string,
  strokePadding = 1,
  targetSize?: { w: number; h: number }
): { viewBox: string; width: number; height: number; transformedPoints: string } => {
  const coords = parsePoints(points);
  if (coords.length < 3) {
    return { viewBox: "0 0 60 60", width: 60, height: 60, transformedPoints: points };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const pad = strokePadding;
  const naturalW = maxX - minX;
  const naturalH = maxY - minY;

  let w: number;
  let h: number;
  let transformedPoints: string;

  if (targetSize && naturalW > 0 && naturalH > 0) {
    const tw = targetSize.w;
    const th = targetSize.h;
    w = tw + 2 * pad;
    h = th + 2 * pad;
    const scaleX = tw / naturalW;
    const scaleY = th / naturalH;
    transformedPoints = coords
      .map(([x, y]) => `${(x - minX) * scaleX + pad},${(y - minY) * scaleY + pad}`)
      .join(" ");
  } else {
    w = naturalW + 2 * pad;
    h = naturalH + 2 * pad;
    transformedPoints = coords
      .map(([x, y]) => `${x - minX + pad},${y - minY + pad}`)
      .join(" ");
  }

  return { viewBox: `0 0 ${w} ${h}`, width: w, height: h, transformedPoints };
};

/**
 * Calculate the angle between two points
 */
const angleBetween = (p1: [number, number], p2: [number, number]): number => {
  return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
};

/**
 * Calculate distance between two points
 */
const distance = (p1: [number, number], p2: [number, number]): number => {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
};

/**
 * Convert polygon points to a path with rounded corners
 * @param points - Polygon points string (e.g., "30,5 55,50 5,50")
 * @param radius - Corner radius (default: 5% of average edge length)
 * @param viewBox - ViewBox dimensions [width, height] for calculating relative radius
 */
export const polygonToRoundedPath = (
  points: string,
  radius?: number,
  viewBox?: [number, number]
): string => {
  const coords = parsePoints(points);
  if (coords.length < 3) return '';

  // Calculate default radius if not provided (6% of average edge length for subtle rounding)
  let defaultRadius = radius;
  if (defaultRadius === undefined) {
    let totalLength = 0;
    for (let i = 0; i < coords.length; i++) {
      const next = (i + 1) % coords.length;
      totalLength += distance(coords[i], coords[next]);
    }
    const avgLength = totalLength / coords.length;
    defaultRadius = avgLength * 0.06; // 6% of average edge length (subtle rounding)
  }

  // Clamp radius to prevent it from being too large
  let minEdgeLength = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const next = (i + 1) % coords.length;
    const edgeLength = distance(coords[i], coords[next]);
    minEdgeLength = Math.min(minEdgeLength, edgeLength);
  }
  const maxRadius = minEdgeLength * 0.25; // Max 25% of shortest edge (prevents over-exaggeration)
  
  // Ensure minimum radius for small shapes (at least 1 unit to keep rounding visible)
  const minRadius = 1;
  const actualRadius = Math.max(minRadius, Math.min(defaultRadius, maxRadius));

  const pathParts: string[] = [];
  
  for (let i = 0; i < coords.length; i++) {
    const prev = coords[(i - 1 + coords.length) % coords.length];
    const curr = coords[i];
    const next = coords[(i + 1) % coords.length];

    // Calculate edge vectors pointing AWAY from the corner (along the edges)
    // Edge 1: from prev to curr (pointing toward curr, then away from prev)
    const edge1 = [curr[0] - prev[0], curr[1] - prev[1]];
    // Edge 2: from curr to next (pointing away from curr toward next)
    const edge2 = [next[0] - curr[0], next[1] - curr[1]];
    
    // Normalize edge vectors
    const len1 = Math.sqrt(edge1[0] * edge1[0] + edge1[1] * edge1[1]);
    const len2 = Math.sqrt(edge2[0] * edge2[0] + edge2[1] * edge2[1]);
    
    if (len1 === 0 || len2 === 0) continue;
    
    const dir1 = [edge1[0] / len1, edge1[1] / len1]; // Direction along edge 1 (toward curr)
    const dir2 = [edge2[0] / len2, edge2[1] / len2]; // Direction along edge 2 (away from curr)
    
    // Calculate the angle between the two edges
    const dotProduct = dir1[0] * dir2[0] + dir1[1] * dir2[1];
    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
    
    // Calculate distance from corner to start/end of rounded corner
    // Use a smaller multiplier to create subtle rounding without bulging
    const dist = actualRadius / Math.tan(angle / 2);
    
    // Clamp distance to prevent it from exceeding a smaller portion of edge length
    // This creates more subtle rounding
    const maxDist1 = len1 * 0.3;
    const maxDist2 = len2 * 0.3;
    const clampedDist = Math.min(dist, maxDist1, maxDist2, actualRadius * 1.5);
    
    // Calculate rounded corner start point (along edge 1, before reaching curr)
    const startX = curr[0] - dir1[0] * clampedDist;
    const startY = curr[1] - dir1[1] * clampedDist;
    
    // Calculate rounded corner end point (along edge 2, after leaving curr)
    const endX = curr[0] + dir2[0] * clampedDist;
    const endY = curr[1] + dir2[1] * clampedDist;
    
    if (i === 0) {
      pathParts.push(`M ${startX},${startY}`);
    } else {
      pathParts.push(`L ${startX},${startY}`);
    }
    
    // Add smooth curve to round the corner
    // Use a control point that's positioned to create a smooth rounded corner
    // Position it between start and end, offset slightly toward the corner
    // but not at the corner itself (to avoid bulging)
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Calculate direction from midpoint toward corner
    const toCornerX = curr[0] - midX;
    const toCornerY = curr[1] - midY;
    const toCornerLen = Math.sqrt(toCornerX * toCornerX + toCornerY * toCornerY);
    
    if (toCornerLen > 0.01) {
      // Position control point closer to midpoint than corner
      // This creates a smooth curve without bulging
      const controlOffset = Math.min(actualRadius * 0.5, toCornerLen * 0.3);
      const controlX = midX + (toCornerX / toCornerLen) * controlOffset;
      const controlY = midY + (toCornerY / toCornerLen) * controlOffset;
      
      pathParts.push(`Q ${controlX},${controlY} ${endX},${endY}`);
    } else {
      // Fallback: straight line
      pathParts.push(`L ${endX},${endY}`);
    }
  }
  
  pathParts.push('Z');
  return pathParts.join(' ');
};

/**
 * Convert gradient angle to SVG linear gradient coordinates
 * @param angle - Gradient angle in degrees (0-360)
 * @returns SVG gradient coordinates object with x1, y1, x2, y2 as percentage strings
 */
export const getGradientCoordinates = (angle: number = 135) => {
  const radians = (angle * Math.PI) / 180;
  const x2 = 50 + 50 * Math.cos(radians);
  const y2 = 50 + 50 * Math.sin(radians);
  const x1 = 50 - 50 * Math.cos(radians);
  const y1 = 50 - 50 * Math.sin(radians);
  return {
    x1: `${x1}%`,
    y1: `${y1}%`,
    x2: `${x2}%`,
    y2: `${y2}%`
  };
};

/**
 * Generate SVG gradient coordinate data (no JSX - for use in .ts files)
 * @param gradientId - Unique ID for the gradient
 * @param colors - Array of two colors for the gradient
 * @param angle - Fill gradient angle in degrees (default: 135)
 * @param borderGradientId - Optional unique ID for border gradient
 * @param borderColors - Optional array of two colors for border gradient
 * @param borderAngle - Border gradient angle in degrees (defaults to fill angle)
 */
export const createSvgGradientData = (
  gradientId: string,
  colors: string[],
  angle: number = 135,
  borderGradientId?: string,
  borderColors?: string[],
  borderAngle?: number
) => {
  const coords = getGradientCoordinates(angle);
  const borderCoords = borderGradientId && borderColors
    ? getGradientCoordinates(borderAngle ?? angle)
    : undefined;
  return {
    gradientData: { id: gradientId, ...coords, color1: colors[0], color2: colors[1] },
    borderGradientData: borderGradientId && borderColors && borderCoords
      ? { id: borderGradientId, ...borderCoords, color1: borderColors[0], color2: borderColors[1] }
      : undefined,
    fillRef: `url(#${gradientId})`,
    strokeRef: borderGradientId ? `url(#${borderGradientId})` : undefined
  };
};

/**
 * Get SVG stroke properties for rounded edges (for path-based shapes)
 * Returns strokeLinejoin and strokeLinecap properties when roundedEdges is enabled
 */
export const getRoundedEdgesProps = (roundedEdges: boolean) => {
  if (!roundedEdges) {
    return {};
  }
  return {
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
};

