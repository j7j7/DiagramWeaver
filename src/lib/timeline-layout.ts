import type { DiagramNodeData, TimelineEntryData } from "@/lib/types";
import {
  curveBoundsExpanded,
  flattenConnectorStroke,
  getConnectorLineVertices,
  pointAtLengthRatio,
  type LinePathStyle,
} from "@/lib/line-curve-path";

export const TIMELINE_NODE_TYPE = "generic.object.timeline" as const;

/** Stable delimiter for timeline card selection keys (`makeTimelineEntryKey` / `parseTimelineEntryKey`). */
export const TIMELINE_ENTRY_KEY_SEP = "\u001f";

/** Default horizontal spine length when dropping a new timeline from the palette (`endPos.x - startPos.x`). */
export const TIMELINE_DEFAULT_SPINE_LENGTH_PX = 280;

/** Matches `GRID_STEP` in canvas-constants (kept local to avoid an import cycle). */
const TIMELINE_GRID_STEP = 10;
function snapTimelineToGrid(v: number): number {
  return Math.round(v / TIMELINE_GRID_STEP) * TIMELINE_GRID_STEP;
}

export function makeTimelineEntryKey(nodeId: string, entryId: string): string {
  return `${nodeId}${TIMELINE_ENTRY_KEY_SEP}${entryId}`;
}

export function parseTimelineEntryKey(key: string): { nodeId: string; entryId: string } | null {
  const i = key.indexOf(TIMELINE_ENTRY_KEY_SEP);
  if (i <= 0 || i >= key.length - 1) return null;
  return { nodeId: key.slice(0, i), entryId: key.slice(i + 1) };
}

/** Last selected entry id for `nodeId` when walking `keysOrdered` from end (matches timeline multi-select primary). */
export function lastTimelineEntryIdOnNodeFromOrderedKeys(
  keysOrdered: readonly string[],
  nodeId: string,
): string | null {
  for (let k = keysOrdered.length - 1; k >= 0; k--) {
    const p = parseTimelineEntryKey(keysOrdered[k]!);
    if (p?.nodeId === nodeId) return p.entryId;
  }
  return null;
}

export function isTimelineNodeType(type: string | undefined): boolean {
  return type === TIMELINE_NODE_TYPE;
}

/** Stable fingerprint when timeline cards / layout-driving props change between slides. */
export function timelinePresentationSignature(node: DiagramNodeData): string | null {
  if (!isTimelineNodeType(node.type)) return null;
  const x = node as DiagramNodeData & Record<string, unknown>;
  return JSON.stringify([
    x.timelineEntries,
    x.timelineDistribution,
    x.timelineCardSide,
    x.timelineSections,
    x.timelineCardW,
    x.timelineCardH,
    x.timelineCornerRadius,
    x.timelineOffsetPx,
    x.timelineCardFillMode,
    x.timelineHueStepDeg,
    x.timelineConnectorWidth,
    x.timelineDotRadius,
    x.compositeBodyShape,
    x.startCap,
    x.endCap,
  ]);
}

/** Spine geometry helpers accept same locals as connector lines. */
export type TimelineNodeSynth = DiagramNodeData & {
  __localStartPos?: { x: number; y: number };
  __localEndPos?: { x: number; y: number };
  __localControlPoints?: { x: number; y: number }[];
};

/** First card at spine start (t≈0), last at end (t≈1), evenly spaced. Uses manual distribution + per-entry `t`. */
export function applyTimelineEntriesSpacedEndpoints(node: DiagramNodeData): DiagramNodeData {
  const entries = node.timelineEntries ?? [];
  const n = entries.length;
  if (n === 0) return node;
  const ratios = n === 1 ? [0.5] : entries.map((_, i) => i / (n - 1));
  const nextEntries = entries.map((e, i) => ({
    ...e,
    t: ratios[i],
  }));
  return {
    ...node,
    timelineDistribution: "manual",
    timelineEntries: nextEntries,
  };
}

export function timelineEffectiveRatios(node: DiagramNodeData): number[] {
  const entries = node.timelineEntries ?? [];
  const n = entries.length;
  if (n === 0) return [];
  const dist = node.timelineDistribution ?? "even";
  if (dist === "even") {
    return entries.map((_, i) => (i + 1) / (n + 1));
  }
  return entries.map((e, i) => {
    const t = typeof e.t === "number" && Number.isFinite(e.t) ? e.t : (i + 1) / (n + 1);
    return Math.max(0, Math.min(1, t));
  });
}

/** Freeze ghost even/manual ratios onto entries (`manual` + explicit `t` per row). */
export function timelineEntriesMaterializedRatios(node: DiagramNodeData): TimelineEntryData[] {
  const entries = node.timelineEntries ?? [];
  const ratios = timelineEffectiveRatios(node);
  return entries.map((e, i) => ({
    ...e,
    t: typeof e.t === "number" && Number.isFinite(e.t) ? Math.max(0, Math.min(1, e.t)) : ratios[i],
  }));
}

const CARD_TAIL_GAP = 2;

/**
 * Map pointer position → spine ratio `t`, perpendicular offset, and which side of the spine (above vs below).
 * Diagram coordinates are snapped to the canvas grid (10px, same step as `snapToGrid`) before projection.
 * `preferSide` stabilizes side choice when the pointer lies near the spine (deadband).
 */
export function timelineDragSolveFromDiagramPoint(
  px: number,
  py: number,
  node: DiagramNodeData,
  entryIndex: number,
  verts: { x: number; y: number }[],
  linePathStyle?: LinePathStyle,
  lineSmoothJoints?: boolean,
  preferSide?: TimelineCardSideResolved,
): { t: number; cardNormalOffsetPx: number; cardSide: TimelineCardSideResolved } {
  const gx = snapTimelineToGrid(px);
  const gy = snapTimelineToGrid(py);
  const tRaw = projectDiagramPointToTimelineStrokeRatio(gx, gy, verts, linePathStyle, lineSmoothJoints);
  const t = Math.max(0, Math.min(1, tRaw));
  const entries = node.timelineEntries ?? [];
  const entry = entries[entryIndex];
  const prefer =
    preferSide ?? resolveEntryCardSide(node, entry, entryIndex);
  const offsetPx = node.timelineOffsetPx ?? 44;
  const defaultH = node.timelineCardH ?? 52;
  const dotR = node.timelineDotRadius ?? 5;
  const ch = entry?.height ?? defaultH;
  const baseArm = dotR + offsetPx * 0.45;
  const depthToCardCenter = ch / 2 + CARD_TAIL_GAP;
  const anchor = pointAtLengthRatio(verts, t, linePathStyle, lineSmoothJoints);
  const { nx, ny } = unitNormalAtRatio(verts, t, linePathStyle, lineSmoothJoints);

  const Wx = gx - anchor.x;
  const Wy = gy - anchor.y;
  /** Positive scalar ⇒ pointer on the "+N" side, which we map to **below** (matches `sideMultiplier('below') === 1`). */
  const sGeom = Wx * nx + Wy * ny;

  const deadband = 14;
  let cardSide: TimelineCardSideResolved;
  let effectiveAlong: number;

  if (Math.abs(sGeom) < deadband) {
    cardSide = prefer;
    const vm = sideMultiplier(cardSide);
    const vx = nx * vm;
    const vy = ny * vm;
    effectiveAlong = Wx * vx + Wy * vy;
    if (effectiveAlong < 0) effectiveAlong = 0;
  } else {
    cardSide = sGeom >= 0 ? "below" : "above";
    effectiveAlong = Math.abs(sGeom);
  }

  const cardNormalOffsetPx = Math.max(-180, Math.min(240, effectiveAlong - baseArm - depthToCardCenter));
  return { t, cardNormalOffsetPx, cardSide };
}

/** Insert a row at the index implied by `arcRatio` (0–1 along spine). Freezes current positions as explicit `t`, switches to `manual`. */
export function insertTimelineEntryNearArcRatio(node: DiagramNodeData, arcRatio: number): DiagramNodeData {
  const entries = [...(node.timelineEntries ?? [])];
  const n = entries.length;
  const clickR = Math.max(0, Math.min(1, arcRatio));
  if (n === 0) {
    const newId = `${node.id}-te-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
    return {
      ...node,
      timelineDistribution: "manual",
      timelineEntries: [{ id: newId, label: "Step 1", t: clickR }],
    };
  }
  const ratios = timelineEffectiveRatios(node);
  let insertIdx = n;
  for (let i = 0; i < ratios.length; i++) {
    if (clickR < ratios[i]) {
      insertIdx = i;
      break;
    }
  }
  const newId = `${node.id}-te-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const nextEntries: TimelineEntryData[] = entries.map((e, i) => ({
    ...e,
    t: ratios[i],
  }));
  nextEntries.splice(insertIdx, 0, {
    id: newId,
    label: `Step ${n + 1}`,
    t: clickR,
  });
  return {
    ...node,
    timelineDistribution: "manual",
    timelineEntries: nextEntries,
  };
}

export type TimelineCardSideResolved = "above" | "below";

export function resolveCardSide(
  mode: "above" | "below" | "alternate" | undefined,
  index: number,
): TimelineCardSideResolved {
  const m = mode ?? "above";
  if (m === "alternate") return index % 2 === 0 ? "above" : "below";
  return m;
}

/** Per-entry override wins; otherwise node-level alternate / above / below. */
export function resolveEntryCardSide(
  node: DiagramNodeData,
  entry: TimelineEntryData | undefined,
  index: number,
): TimelineCardSideResolved {
  if (entry?.cardSide === "above" || entry?.cardSide === "below") return entry.cardSide;
  return resolveCardSide(node.timelineCardSide, index);
}

export function sideMultiplier(side: TimelineCardSideResolved): number {
  return side === "above" ? -1 : 1;
}

export function unitNormalAtRatio(
  verts: { x: number; y: number }[],
  ratio: number,
  linePathStyle?: LinePathStyle,
  lineSmoothJoints?: boolean,
): { nx: number; ny: number } {
  const dt = 0.003;
  const p0 = pointAtLengthRatio(verts, Math.max(0, ratio - dt), linePathStyle, lineSmoothJoints);
  const p1 = pointAtLengthRatio(verts, Math.min(1, ratio + dt), linePathStyle, lineSmoothJoints);
  const tx = p1.x - p0.x;
  const ty = p1.y - p0.y;
  const len = Math.hypot(tx, ty) || 1;
  const ux = tx / len;
  const uy = ty / len;
  return { nx: -uy, ny: ux };
}

/** Closest arc-length ratio on flattened spine for diagram coords (px). */
export function projectDiagramPointToTimelineStrokeRatio(
  px: number,
  py: number,
  verts: { x: number; y: number }[],
  linePathStyle?: LinePathStyle,
  lineSmoothJoints?: boolean,
): number {
  const flat = flattenConnectorStroke(verts, linePathStyle, lineSmoothJoints);
  if (flat.length < 2) return 0;
  let bestD2 = Infinity;
  let bestAlong = 0;
  const totals: number[] = [0];
  let cumulative = 0;
  for (let i = 1; i < flat.length; i++) {
    const dx = flat[i].x - flat[i - 1].x;
    const dy = flat[i].y - flat[i - 1].y;
    cumulative += Math.hypot(dx, dy);
    totals.push(cumulative);
  }
  const totalLen = cumulative || 1;
  for (let i = 1; i < flat.length; i++) {
    const ax = flat[i - 1].x;
    const ay = flat[i - 1].y;
    const bx = flat[i].x;
    const by = flat[i].y;
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby || 1;
    let u = (apx * abx + apy * aby) / ab2;
    u = Math.max(0, Math.min(1, u));
    const qx = ax + abx * u;
    const qy = ay + aby * u;
    const d2 = (px - qx) ** 2 + (py - qy) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      const segLen = Math.hypot(abx, aby);
      bestAlong = totals[i - 1] + segLen * u;
    }
  }
  return Math.max(0, Math.min(1, bestAlong / totalLen));
}

export interface TimelineEntryLayoutAbs {
  entryIndex: number;
  entryId: string;
  ratio: number;
  anchor: { x: number; y: number };
  cardCenter: { x: number; y: number };
  cardW: number;
  cardH: number;
  cornerR: number;
  side: TimelineCardSideResolved;
}

export function layoutTimelineEntriesAbs(
  node: DiagramNodeData,
  synth?: Partial<TimelineNodeSynth>,
): TimelineEntryLayoutAbs[] {
  const merged = { ...node, ...synth } as TimelineNodeSynth;
  const verts = getConnectorLineVertices(merged);
  const linePathStyle = merged.linePathStyle as LinePathStyle | undefined;
  const lineSmoothJoints = merged.lineSmoothJoints === true;
  const entries = merged.timelineEntries ?? [];
  const ratios = timelineEffectiveRatios(merged);
  const offsetPx = merged.timelineOffsetPx ?? 44;
  const defaultW = merged.timelineCardW ?? 112;
  const defaultH = merged.timelineCardH ?? 52;
  const baseCorner = merged.timelineCornerRadius ?? 8;
  const dotR = merged.timelineDotRadius ?? 5;

  return entries.map((entry, i) => {
    const t = ratios[i] ?? 0.5;
    const anchor = pointAtLengthRatio(verts, t, linePathStyle, lineSmoothJoints);
    const side = resolveEntryCardSide(merged, entry, i);
    const mult = sideMultiplier(side);
    const { nx, ny } = unitNormalAtRatio(verts, t, linePathStyle, lineSmoothJoints);
    const cw = entry.width ?? defaultW;
    const ch = entry.height ?? defaultH;
    const cr = entry.cornerRadius ?? baseCorner;
    const extra = typeof entry.cardNormalOffsetPx === "number" && Number.isFinite(entry.cardNormalOffsetPx)
      ? entry.cardNormalOffsetPx
      : 0;
    const arm = Math.max(dotR * 0.35, dotR + offsetPx * 0.45 + extra);
    const stemTip = {
      x: anchor.x + nx * mult * arm,
      y: anchor.y + ny * mult * arm,
    };
    const cardCenter = {
      x: stemTip.x + nx * mult * (ch / 2 + CARD_TAIL_GAP),
      y: stemTip.y + ny * mult * (ch / 2 + CARD_TAIL_GAP),
    };
    return {
      entryIndex: i,
      entryId: entry.id,
      ratio: t,
      anchor,
      cardCenter,
      cardW: cw,
      cardH: ch,
      cornerR: cr,
      side,
    };
  });
}

export function computeTimelineOuterBounds(
  node: DiagramNodeData,
  synth?: Partial<TimelineNodeSynth>,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const merged = { ...node, ...synth } as TimelineNodeSynth;
  const verts = getConnectorLineVertices(merged);
  const linePathStyle = merged.linePathStyle as LinePathStyle | undefined;
  const lineSmoothJoints = merged.lineSmoothJoints === true;
  const strokeW = typeof merged.lineThickness === "number" ? merged.lineThickness : 2.5;
  const padSpine = Math.max(28, strokeW * 3 + 22);
  const spineExp = curveBoundsExpanded(verts, padSpine, linePathStyle, lineSmoothJoints);

  const layouts = layoutTimelineEntriesAbs(node, synth);
  let minX = spineExp.minX;
  let minY = spineExp.minY;
  let maxX = spineExp.maxX;
  let maxY = spineExp.maxY;

  for (const L of layouts) {
    const halfW = L.cardW / 2 + 6;
    const halfH = L.cardH / 2 + 6;
    minX = Math.min(minX, L.cardCenter.x - halfW);
    maxX = Math.max(maxX, L.cardCenter.x + halfW);
    minY = Math.min(minY, L.cardCenter.y - halfH);
    maxY = Math.max(maxY, L.cardCenter.y + halfH);
  }

  return { minX, minY, maxX, maxY };
}

/** Card bounds for inline editors — relative to diagram node container origin `(node.x, node.y)`. */
export function timelineEntryOverlayBoundsRelativeToNodeContainer(
  node: DiagramNodeData,
  entryId: string,
  synth?: Partial<TimelineNodeSynth>,
): { left: number; top: number; width: number; height: number } | null {
  const nx = node.x ?? 0;
  const ny = node.y ?? 0;
  const layouts = layoutTimelineEntriesAbs(node, synth);
  const L = layouts.find((l) => l.entryId === entryId);
  if (!L) return null;
  return {
    left: L.cardCenter.x - nx - L.cardW / 2,
    top: L.cardCenter.y - ny - L.cardH / 2,
    width: L.cardW,
    height: L.cardH,
  };
}

/** Slide transition: a card removed on the next slide — layout in **current** node container space. */
export interface TimelineSlideRemovedCardPayload {
  entry: TimelineEntryData;
  left: number;
  top: number;
  width: number;
  height: number;
  hueRank: number;
}

/**
 * Removed-entry ghosts for slide transitions: positions match {@link timelineEntryOverlayBoundsRelativeToNodeContainer}
 * for `prevNode`, then shifted by node position delta so they sit correctly inside the **current** slide’s container.
 */
export function timelineSlideRemovedCardPayloads(
  prevNode: DiagramNodeData,
  currNode: DiagramNodeData,
  synthPrev?: Partial<TimelineNodeSynth>,
): TimelineSlideRemovedCardPayload[] {
  if (!isTimelineNodeType(prevNode.type) || !isTimelineNodeType(currNode.type)) return [];
  const prevE = prevNode.timelineEntries ?? [];
  const currIds = new Set((currNode.timelineEntries ?? []).map((e) => e.id));
  const dx = (currNode.x ?? 0) - (prevNode.x ?? 0);
  const dy = (currNode.y ?? 0) - (prevNode.y ?? 0);
  const out: TimelineSlideRemovedCardPayload[] = [];
  for (let i = 0; i < prevE.length; i++) {
    const entry = prevE[i]!;
    if (currIds.has(entry.id)) continue;
    const b = timelineEntryOverlayBoundsRelativeToNodeContainer(prevNode, entry.id, synthPrev);
    if (!b) continue;
    out.push({
      entry,
      left: b.left - dx,
      top: b.top - dy,
      width: b.width,
      height: b.height,
      hueRank: i,
    });
  }
  return out;
}
