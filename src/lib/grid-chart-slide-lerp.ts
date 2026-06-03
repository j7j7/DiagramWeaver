import { lerpColors } from "@/lib/color-shift";
import type { GridChartLayoutCell, GridCellFillMode } from "@/lib/grid-chart-layout";
import type { DiagramNodeData, NodeChartSpecGrid } from "@/lib/types";

const TRANSPARENT = "rgba(0,0,0,0)";

const GRID_LERP_SNAPSHOT_KIND = "grid-lerp-snapshot" as const;

export type GridChartLerpSnapshot = {
  kind: typeof GRID_LERP_SNAPSHOT_KIND;
  chart: NodeChartSpecGrid;
  backgroundColor?: string;
};

/** Stagger rank per cell index (lower rank = earlier in pop/fade sequence). */
export function gridCellStaggerRankByIndex(seed: string, count: number): number[] {
  const order = gridCellSlideStaggerOrder(seed, count);
  const ranks = new Array<number>(count);
  order.forEach((cellIdx, rank) => {
    ranks[cellIdx] = rank;
  });
  return ranks;
}

export function gridChartLerpSnapshotFromNode(node: DiagramNodeData): string {
  const chart = node.chart;
  if (chart?.kind !== "grid") {
    return JSON.stringify(chart ?? null);
  }
  const snap: GridChartLerpSnapshot = {
    kind: GRID_LERP_SNAPSHOT_KIND,
    chart,
    ...((node.backgroundColor ?? "").trim()
      ? { backgroundColor: (node.backgroundColor ?? "").trim() }
      : {}),
  };
  return JSON.stringify(snap);
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Randomized cell animation order, stable for a given seed (node id + prior chart JSON). */
export function gridCellSlideStaggerOrder(seed: string, count: number): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  if (count <= 1) return indices;
  const rng = mulberry32(hashSeed(seed));
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }
  return indices;
}

/** Same grid topology (cols × rows) so per-cell fill colors can interpolate. */
export function gridChartSlideLerpCompatible(prev: DiagramNodeData, curr: DiagramNodeData): boolean {
  const a = prev.chart;
  const b = curr.chart;
  if (!a || !b || a.kind !== "grid" || b.kind !== "grid") return false;
  const cols = Math.max(1, a.cols ?? 4);
  const rows = Math.max(1, a.rows ?? 4);
  if (cols !== Math.max(1, b.cols ?? 4)) return false;
  if (rows !== Math.max(1, b.rows ?? 4)) return false;
  const n = cols * rows;
  const ca = Array.isArray(a.cells) ? a.cells.length : 0;
  const cb = Array.isArray(b.cells) ? b.cells.length : 0;
  return ca >= n && cb >= n;
}

function isCellFillVisible(cell: GridChartLayoutCell): boolean {
  return cell.fillMode !== "none";
}

function emptyFillFields(): Pick<
  GridChartLayoutCell,
  "fillMode" | "solidFill" | "gradientColor1" | "gradientColor2" | "fillOpacity"
> {
  return {
    fillMode: "none",
    solidFill: "transparent",
    gradientColor1: "",
    gradientColor2: "",
    fillOpacity: 1,
  };
}

function copyFillFrom(
  source: GridChartLayoutCell,
  fillOpacity: number
): Pick<
  GridChartLayoutCell,
  "fillMode" | "solidFill" | "gradientColor1" | "gradientColor2" | "fillOpacity"
> {
  if (!isCellFillVisible(source)) return emptyFillFields();
  if (source.fillMode === "gradient") {
    return {
      fillMode: "gradient",
      solidFill: "",
      gradientColor1: source.gradientColor1,
      gradientColor2: source.gradientColor2,
      fillOpacity,
    };
  }
  return {
    fillMode: "solid",
    solidFill: source.solidFill.trim() || TRANSPARENT,
    gradientColor1: "",
    gradientColor2: "",
    fillOpacity,
  };
}

function lerpCellFillFields(
  prev: GridChartLayoutCell,
  curr: GridChartLayoutCell,
  u: number
): Pick<
  GridChartLayoutCell,
  "fillMode" | "solidFill" | "gradientColor1" | "gradientColor2" | "fillOpacity"
> {
  const prevOn = isCellFillVisible(prev);
  const currOn = isCellFillVisible(curr);

  if (!prevOn && !currOn) return emptyFillFields();
  if (!prevOn && currOn) return copyFillFrom(curr, u);
  if (prevOn && !currOn) return copyFillFrom(prev, 1 - u);

  if (prev.fillMode === "gradient" || curr.fillMode === "gradient") {
    const g1From = prev.fillMode === "gradient" ? prev.gradientColor1.trim() : prev.solidFill.trim();
    const g2From =
      prev.fillMode === "gradient"
        ? prev.gradientColor2.trim()
        : prev.solidFill.trim();
    const g1To = curr.fillMode === "gradient" ? curr.gradientColor1.trim() : curr.solidFill.trim();
    const g2To =
      curr.fillMode === "gradient"
        ? curr.gradientColor2.trim()
        : curr.solidFill.trim();
    return {
      fillMode: "gradient",
      solidFill: "",
      gradientColor1: lerpColors(g1From || TRANSPARENT, g1To || TRANSPARENT, u),
      gradientColor2: lerpColors(g2From || TRANSPARENT, g2To || TRANSPARENT, u),
      fillOpacity: 1,
    };
  }

  const from = prev.solidFill.trim() || TRANSPARENT;
  const to = curr.solidFill.trim() || TRANSPARENT;
  return {
    fillMode: "solid",
    solidFill: lerpColors(from, to, u),
    gradientColor1: "",
    gradientColor2: "",
    fillOpacity: 1,
  };
}

/**
 * Blend resolved layout cell paints from `prevCells` → `currCells`.
 * `globalU` is the eased slide chart lerp (0–1), shared by all cells for a smooth colour crossfade.
 */
export function lerpGridChartLayoutCells(
  prevCells: GridChartLayoutCell[],
  currCells: GridChartLayoutCell[],
  globalU: number
): GridChartLayoutCell[] {
  const n = currCells.length;
  if (n === 0) return currCells;
  const u = Math.max(0, Math.min(1, globalU));
  if (u >= 1 - 1e-9) return currCells;
  if (u <= 1e-9) return prevCells.length === n ? prevCells : currCells;

  return currCells.map((curr, i) => {
    const prev = prevCells[i];
    if (!prev) return curr;
    return { ...curr, ...lerpCellFillFields(prev, curr, u) };
  });
}

export function parseGridChartLerpSnapshot(json: string): {
  chart: NodeChartSpecGrid;
  backgroundColor?: string;
} | null {
  try {
    const parsed = JSON.parse(json) as GridChartLerpSnapshot | NodeChartSpecGrid;
    if (parsed && typeof parsed === "object" && "kind" in parsed && parsed.kind === GRID_LERP_SNAPSHOT_KIND) {
      return { chart: parsed.chart, backgroundColor: parsed.backgroundColor };
    }
    if (parsed && typeof parsed === "object" && "kind" in parsed && parsed.kind === "grid") {
      return { chart: parsed as NodeChartSpecGrid };
    }
    return null;
  } catch {
    return null;
  }
}

/** @deprecated Use {@link parseGridChartLerpSnapshot}. */
export function parseGridChartForSlideLerp(json: string): NodeChartSpecGrid | null {
  return parseGridChartLerpSnapshot(json)?.chart ?? null;
}
