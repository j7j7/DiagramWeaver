import type { NodeSize } from "@/lib/types";
import { getNodeSizeDimensions } from "@/lib/visual-styling";

/** Default bevel spin on the canvas plane (degrees). */
export const ICON_BEVEL_DEFAULT_ROTATION = 23;
/** Extra Z-rotation so neighbouring tiles line up on the grid (added to bevel angle). */
export const ICON_BEVEL_DEFAULT_GRID_OFFSET = 0;
export const ICON_BEVEL_MIN_GRID_OFFSET = -20;
export const ICON_BEVEL_MAX_GRID_OFFSET = 20;

/** Block thickness as a fraction of icon size (0.01–0.42). */
export const ICON_BEVEL_DEFAULT_DEPTH = 0.03;
export const ICON_BEVEL_MIN_DEPTH = 0.01;
export const ICON_BEVEL_MAX_DEPTH = 0.42;

/** Tilt back toward the viewer (app-icon / YouTube-style 3D). */
export const ICON_BEVEL_TILT_X = 52;
const DEFAULT_TILE = "#9aa3ab";

function parseHexColor(input: string): [number, number, number] | null {
  const t = input.trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Mix channel toward white (amount > 0) or black (amount < 0). */
export function shadeHexColor(hex: string, amount: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const t = amount >= 0 ? 255 : 0;
  const f = Math.min(1, Math.max(-1, Math.abs(amount)));
  return rgbToHex(
    rgb[0] + (t - rgb[0]) * f,
    rgb[1] + (t - rgb[1]) * f,
    rgb[2] + (t - rgb[2]) * f,
  );
}

export function normalizeIconBevelRotation(deg?: number): number {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return ICON_BEVEL_DEFAULT_ROTATION;
  return ((deg % 360) + 360) % 360;
}

export function normalizeIconBevelDepth(ratio?: number): number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return ICON_BEVEL_DEFAULT_DEPTH;
  return Math.min(ICON_BEVEL_MAX_DEPTH, Math.max(ICON_BEVEL_MIN_DEPTH, ratio));
}

export function normalizeIconBevelGridOffset(deg?: number): number {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return ICON_BEVEL_DEFAULT_GRID_OFFSET;
  return Math.min(ICON_BEVEL_MAX_GRID_OFFSET, Math.max(ICON_BEVEL_MIN_GRID_OFFSET, deg));
}

export function getIconBevelSceneTransform(
  rotationDeg?: number,
  gridOffsetDeg?: number,
): {
  rotateX: number;
  rotateZ: number;
} {
  const rot = normalizeIconBevelRotation(rotationDeg);
  const grid = normalizeIconBevelGridOffset(gridOffsetDeg);
  return {
    rotateX: ICON_BEVEL_TILT_X,
    rotateZ: rot + grid,
  };
}

/** Painted square extent of the 3D tile (perspective wrapper), for layout and connection anchors. */
export function getIconBevelViewportSize(containerSize: number, depthRatio?: number): number {
  const { depth, pad } = getIconBevelGeometry(containerSize, depthRatio);
  return containerSize + pad * 2 + depth;
}

/** Icon tile size for connection anchors and node measurement (includes bevel padding when enabled). */
export function getIconTileAnchorSize(node: {
  nodeSize?: NodeSize;
  iconBevel?: boolean;
  iconBevelDepth?: number;
}): number {
  const { container } = getNodeSizeDimensions(node.nodeSize);
  if (node.iconBevel) {
    return getIconBevelViewportSize(container, node.iconBevelDepth);
  }
  return container;
}

export function getIconBevelGeometry(size: number, depthRatio?: number): {
  depth: number;
  radius: number;
  /** Clip radius for the icon glyph so corners align with the bevelled top face. */
  iconClipRadius: number;
  pad: number;
  perspective: number;
} {
  const ratio = normalizeIconBevelDepth(depthRatio);
  const depth = Math.max(2, Math.round(size * ratio));
  const radius = Math.max(4, Math.round(size * 0.24));
  /** Same as top-face radius so the glyph follows the bevelled plate. */
  const iconClipRadius = radius;
  const pad = Math.round(size * (0.28 + ratio * 0.45) + depth);
  const viewport = size + pad * 2;
  return {
    depth,
    radius,
    iconClipRadius,
    pad,
    perspective: Math.round(viewport * 2.5),
  };
}

export function getIconBevelFaceColors(topHex?: string): {
  base: string;
  topGradient: string;
  sideFront: string;
  sideRight: string;
  edgeHighlight: string;
  groundShadow: string;
} {
  const base = topHex && parseHexColor(topHex) ? topHex : DEFAULT_TILE;
  const highlight = shadeHexColor(base, 0.14);
  const mid = shadeHexColor(base, -0.06);
  return {
    base,
    topGradient: `linear-gradient(145deg, ${highlight} 0%, ${base} 40%, ${mid} 100%)`,
    sideFront: shadeHexColor(base, -0.22),
    sideRight: shadeHexColor(base, -0.36),
    edgeHighlight: shadeHexColor(base, 0.18),
    groundShadow: "rgba(15, 23, 42, 0.24)",
  };
}

export function getIconBevelTopFaceInset(): string {
  return "inset 0 2px 7px rgba(255,255,255,0.42), inset 0 -2px 5px rgba(0,0,0,0.08)";
}

/**
 * Single diagonal stack on the top face — fills rounded corners; pairs with border extrusion.
 */
export function buildIconBevelCornerStack(
  depthPx: number,
  colors: Pick<ReturnType<typeof getIconBevelFaceColors>, "sideFront" | "sideRight">,
): string {
  const parts: string[] = [];
  const steps = Math.max(2, Math.min(8, Math.round(depthPx * 0.45)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = t > 0.88 ? colors.sideRight : t > 0.45 ? colors.sideFront : shadeHexColor(colors.sideFront, -0.05);
    parts.push(`${i}px ${i}px 0 0 ${c}`);
  }
  return parts.join(", ");
}

const EDGE_SAMPLE_SIZE = 72;
const EDGE_ALPHA_MIN = 20;

/** Average RGB of silhouette edge pixels (opaque meets transparent / canvas border). */
export function sampleEdgeColorFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  const addPixel = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count += 1;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) < EDGE_ALPHA_MIN) continue;
      const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const touchesClear =
        (x > 0 && alphaAt(x - 1, y) < EDGE_ALPHA_MIN) ||
        (x < width - 1 && alphaAt(x + 1, y) < EDGE_ALPHA_MIN) ||
        (y > 0 && alphaAt(x, y - 1) < EDGE_ALPHA_MIN) ||
        (y < height - 1 && alphaAt(x, y + 1) < EDGE_ALPHA_MIN);
      if (onBorder || touchesClear) addPixel(x, y);
    }
  }

  if (count === 0) {
    const ring = Math.max(1, Math.round(Math.min(width, height) * 0.06));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nearEdge =
          x < ring || y < ring || x >= width - ring || y >= height - ring;
        if (nearEdge && alphaAt(x, y) >= EDGE_ALPHA_MIN) addPixel(x, y);
      }
    }
  }

  if (count === 0) return null;
  return rgbToHex(rSum / count, gSum / count, bSum / count);
}

/**
 * Sample the mid-section of each side (inset from corners) — the icon plate colour,
 * not outer silhouette corners (which break when the glyph is rounded/clipped).
 */
export function sampleCenterEdgeColorFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  const inset = Math.max(2, Math.round(Math.min(width, height) * 0.1));
  const spanStartX = Math.round(width * 0.22);
  const spanEndX = Math.round(width * 0.78);
  const spanStartY = Math.round(height * 0.22);
  const spanEndY = Math.round(height * 0.78);

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const addPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    if (alphaAt(x, y) < EDGE_ALPHA_MIN) return;
    const i = (y * width + x) * 4;
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count += 1;
  };

  for (let x = spanStartX; x <= spanEndX; x++) {
    addPixel(x, inset);
    addPixel(x, height - 1 - inset);
  }
  for (let y = spanStartY; y <= spanEndY; y++) {
    addPixel(inset, y);
    addPixel(width - 1 - inset, y);
  }

  if (count === 0) return sampleEdgeColorFromRgba(data, width, height);
  return rgbToHex(rSum / count, gSum / count, bSum / count);
}

function rasterizeImageSourceForSampling(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Uint8ClampedArray | null {
  if (typeof document === "undefined" || sourceWidth <= 0 || sourceHeight <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = EDGE_SAMPLE_SIZE;
  canvas.height = EDGE_SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, EDGE_SAMPLE_SIZE, EDGE_SAMPLE_SIZE);
  ctx.drawImage(source, 0, 0, EDGE_SAMPLE_SIZE, EDGE_SAMPLE_SIZE);
  return ctx.getImageData(0, 0, EDGE_SAMPLE_SIZE, EDGE_SAMPLE_SIZE).data;
}

/** Rasterize and pick plate colour from center of each edge (match icon background). */
export function sampleIconBackgroundColorFromImageSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): string | null {
  const data = rasterizeImageSourceForSampling(source, sourceWidth, sourceHeight);
  if (!data) return null;
  return sampleCenterEdgeColorFromRgba(data, EDGE_SAMPLE_SIZE, EDGE_SAMPLE_SIZE);
}

/** @deprecated Prefer {@link sampleIconBackgroundColorFromImageSource} for bevel match. */
export function sampleIconEdgeColorFromImageSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): string | null {
  const data = rasterizeImageSourceForSampling(source, sourceWidth, sourceHeight);
  if (!data) return null;
  return sampleEdgeColorFromRgba(data, EDGE_SAMPLE_SIZE, EDGE_SAMPLE_SIZE);
}

/** Read `background-color` from a themed icon tile (e.g. `bg-card`). */
export function readIconTileBackgroundHex(element: Element | null | undefined): string | null {
  if (!element || typeof window === "undefined") return null;
  const bg = getComputedStyle(element).backgroundColor;
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(bg);
  if (!m) return null;
  const aMatch = /^rgba\([^)]+,\s*([\d.]+)\s*\)/i.exec(bg);
  if (aMatch && parseFloat(aMatch[1]) < 0.05) return null;
  return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
}
