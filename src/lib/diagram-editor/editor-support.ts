import type { DiagramConnectionData, DiagramData, Slide } from "@/lib/types";
import { isTimelineNodeType } from "@/lib/utils";
import { stableDiagramConnectionId } from "@/lib/connection-order-utils";
import { projectVisibleDiagram } from "@/lib/presentation-delta";
import type { PresentationDeltaMode } from "@/lib/presentation-slide-chain";
import { resolvePresentationSlideDiagrams } from "@/lib/presentation-slide-chain";
import type { PaletteResource } from "@/components/editor/diagram-editor-types";

/** Presentation strip: slow catch-up poll when debounce/interval missed (ms). */
export const PRESENTATION_THUMB_INTERVAL_MS = 20000;

/** After tab canvas / presentation draft edits, wait this long with no further changes before thumbnail PNG (ms). */
export const PRESENTATION_THUMB_DEBOUNCE_MS = 4000;

/** Strip tiles are ~140×79 CSS px; fit/rasterize at ~2× retina, capped by {@link PRESENTATION_THUMB_MAX_OUTPUT_PX}. */
export const PRESENTATION_THUMB_FIT_VIEWPORT = { width: 280, height: 158 } as const;

/** Longest edge of the PNG data URL stored on slides (safety cap after fit viewport math). */
export const PRESENTATION_THUMB_MAX_OUTPUT_PX = 320;

/** Margin in output pixels when `tightContentFrame` is used for strip thumbnails. */
export const PRESENTATION_THUMB_CAPTURE_FRAME_BORDER_PX = 8;

/** `captureSnapshotPng` quality for presentation strip thumbnails (`pixelRatio` 1 vs 2 for medium). */
export const PRESENTATION_THUMB_CAPTURE_QUALITY = 'low' as const;

export type PresentationThumbnailCaptureOptions = {
  backgroundColor: 'white' | 'dark';
  quality: typeof PRESENTATION_THUMB_CAPTURE_QUALITY;
  fitContent: true;
  unionDiagrams: DiagramData[];
  tightContentFrame: true;
  fitPadding: number;
  frameBorderPx: number;
  fitViewportPx: { width: number; height: number };
  maxOutputPx: number;
  fastThumbnail: true;
  backgroundCapture: true;
  cacheBust: false;
};

/** Shared capture options for presentation strip PNGs (small viewport fit + fast export path). */
export function buildPresentationThumbnailCaptureOptions(
  thumbBg: 'white' | 'dark',
  unionDiagrams: DiagramData[],
): PresentationThumbnailCaptureOptions {
  return {
    backgroundColor: thumbBg,
    quality: PRESENTATION_THUMB_CAPTURE_QUALITY,
    fitContent: true,
    unionDiagrams,
    tightContentFrame: true,
    fitPadding: 16,
    frameBorderPx: PRESENTATION_THUMB_CAPTURE_FRAME_BORDER_PX,
    fitViewportPx: { ...PRESENTATION_THUMB_FIT_VIEWPORT },
    maxOutputPx: PRESENTATION_THUMB_MAX_OUTPUT_PX,
    fastThumbnail: true,
    backgroundCapture: true,
    cacheBust: false,
  };
}

/** Options → enable presentation strip PNG refresh (default on). */
export const PRESENTATION_THUMBNAIL_UPDATES_ENABLED_STORAGE_KEY =
  'dw:presentationThumbnailUpdates:enabled';

/** Read persisted Options preference (default **on** when unset). */
export function readPresentationThumbnailUpdatesEnabledFromStorage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(PRESENTATION_THUMBNAIL_UPDATES_ENABLED_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

/** `captureViewportPngDataUrl`: light → white PNG background; dark → `#0f172a` (matches Tailwind slate). */
export function presentationThumbnailCaptureBackground(theme: 'light' | 'dark'): 'white' | 'dark' {
  return theme === 'dark' ? 'dark' : 'white';
}

/** Append so cached diagram fingerprints invalidate when UI theme toggles (strip PNGs stored in slides). */
export function withPresentationThumbnailThemeFingerprintTag(
  diagramFingerprint: string,
  theme: 'light' | 'dark',
): string {
  return `${diagramFingerprint}\u007FthumbBg:${theme}`;
}

/**
 * Diagram slice for thumbnail fingerprint / debounce keys — visible layers only, no pan/zoom
 * (`viewState`). Panning persists viewState and toggles viewport culling without changing slide content.
 */
export function diagramForPresentationThumbnailFingerprint(
  diagramData: DiagramData,
): DiagramData {
  const visible = projectVisibleDiagram(diagramData);
  const { viewState: _viewState, ...content } = visible;
  return content as DiagramData;
}

/** Stable key for scheduling thumbnail capture after diagram edits (ignores viewState). */
export function buildPresentationThumbnailDiagramContentKey(
  tabDiagram: DiagramData,
  presentationDraft: DiagramData | null,
): string {
  try {
    return JSON.stringify({
      tab: diagramForPresentationThumbnailFingerprint(tabDiagram),
      draft: presentationDraft
        ? diagramForPresentationThumbnailFingerprint(presentationDraft)
        : null,
    });
  } catch {
    return '';
  }
}

/** Stable when `activeTab.diagramData` is missing (legacy / corrupt rows). A fresh `{}` each render caused presentation master `useEffect` to loop. */
export const EMPTY_TAB_DIAGRAM_FALLBACK: DiagramData = { nodes: [], connections: [], groupings: [] };

/** Union bounds for PNG export / thumbnails: one entry per deck slide (slide 0 = main). */
export function buildPresentationUnionDiagramsForPngExport(args: {
  tabDiagram: DiagramData;
  presentationMaster: DiagramData | null;
  deckSlides: Slide[];
  activeSlideId: string | null;
  draft: DiagramData | null;
  layersFilteredBase: DiagramData;
  presentationDeltaMode?: PresentationDeltaMode;
}): DiagramData[] {
  const master = projectVisibleDiagram(args.presentationMaster ?? args.tabDiagram);
  const mode = args.presentationDeltaMode ?? 'master';
  const resolved = resolvePresentationSlideDiagrams(master, args.deckSlides, mode);
  return args.deckSlides.map((slide, slideIndex) => {
    if (args.activeSlideId && slide.id === args.activeSlideId && args.draft) {
      return projectVisibleDiagram(args.draft);
    }
    return projectVisibleDiagram(resolved[slideIndex]);
  });
}

export async function waitTwoAnimationFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** IDs in `selectedItemIds` that exist as nodes or zones (connection endpoints), preserving selection order. */
export function collectConnectSourceIdsFromDiagram(
  selectedItemIds: Set<string>,
  diagram: DiagramData,
): string[] {
  const nodeIds = new Set(diagram.nodes.map((n) => n.id));
  const zoneIds = new Set((diagram.zones ?? []).map((z) => z.id));
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedItemIds) {
    if (seen.has(id)) continue;
    if (nodeIds.has(id)) {
      const node = diagram.nodes.find((n) => n.id === id);
      if (node && isTimelineNodeType(node.type)) continue;
      result.push(id);
      seen.add(id);
    } else if (zoneIds.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  return result;
}

export function getSelectionIdKind(id: string, diagram: DiagramData): "object" | "edge" | "unknown" {
  if (diagram.nodes.some((n) => n.id === id)) return "object";
  if (diagram.zones?.some((z) => z.id === id)) return "object";
  const conns = diagram.connections ?? [];
  if (conns.some((c) => c.id === id)) return "edge";
  if (conns.some((c) => `${c.from}-${c.to}` === id)) return "edge";
  return "unknown";
}

/** Resolve stable connection ids from the multi-selection set (skips ambiguous legacy keys). */
export function connectionIdsFromSelectionSet(
  selectedItemIds: Set<string>,
  connections: DiagramConnectionData[],
): string[] {
  const out: string[] = [];
  for (const raw of selectedItemIds) {
    const byId = connections.find((c) => c.id === raw);
    if (byId?.id) {
      out.push(byId.id);
      continue;
    }
    let resolved: string | undefined;
    for (let idx = 0; idx < connections.length; idx++) {
      const c = connections[idx];
      if (`${c.from}-${c.to}-${idx}` === raw) {
        resolved = stableDiagramConnectionId(c, idx);
        break;
      }
    }
    if (resolved) {
      out.push(resolved);
      continue;
    }
    const legacyMatches = connections
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => `${c.from}-${c.to}` === raw);
    if (legacyMatches.length === 1) {
      const { c, idx } = legacyMatches[0];
      out.push(stableDiagramConnectionId(c, idx));
    }
  }
  return [...new Set(out)];
}

export function clearPendingConnectionWindowState(): void {
  delete (window as unknown as { pendingConnectionSourceId?: string }).pendingConnectionSourceId;
  delete (window as unknown as { pendingConnectionSourceIds?: string[] }).pendingConnectionSourceIds;
  delete (window as unknown as { pendingConnectionOptions?: unknown }).pendingConnectionOptions;
}

export type CompactOpCode = 0 | 1 | 2;
export type CompactOperation = [CompactOpCode, string, unknown?];

export type CompactAnimationStateV2 = {
  e?: 0;
  f?: string[];
  x?: string[];
};

export type CompactSlideV2 = {
  d?: { o: CompactOperation[] };
  r?: {
    n?: string[];
    l?: string[];
    c?: unknown[];
    ni?: number;
    li?: number;
    ci?: number;
  };
  t?: string;
  a?: CompactAnimationStateV2;
  z?: number;
  px?: number;
  py?: number;
};

export type CompactDeckV2 = {
  n?: string;
  tn?: string[][];
  tl?: string[][];
  tc?: unknown[][];
  s: CompactSlideV2[];
};

type CompactPresentationsV2 = {
  v: 2;
  ai?: number;
  d: CompactDeckV2[];
};

export type DiagramJsonWithPresentations = DiagramData & {
  presentations?: CompactPresentationsV2;
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function dedupeSlideRefSets(slides: CompactSlideV2[]): {
  slides: CompactSlideV2[];
  nodeTable?: string[][];
  layerTable?: string[][];
  connectionTable?: unknown[][];
} {
  const nodeCounts = new Map<string, number>();
  const layerCounts = new Map<string, number>();
  const connectionCounts = new Map<string, number>();
  const nodeValues = new Map<string, string[]>();
  const layerValues = new Map<string, string[]>();
  const connectionValues = new Map<string, unknown[]>();

  for (const slide of slides) {
    const nodeRef = slide.r?.n;
    const layerRef = slide.r?.l;
    const connRef = slide.r?.c;

    if (nodeRef && nodeRef.length > 0) {
      const key = stableStringify(nodeRef);
      nodeCounts.set(key, (nodeCounts.get(key) || 0) + 1);
      if (!nodeValues.has(key)) nodeValues.set(key, nodeRef);
    }

    if (layerRef && layerRef.length > 0) {
      const key = stableStringify(layerRef);
      layerCounts.set(key, (layerCounts.get(key) || 0) + 1);
      if (!layerValues.has(key)) layerValues.set(key, layerRef);
    }

    if (connRef && connRef.length > 0) {
      const key = stableStringify(connRef);
      connectionCounts.set(key, (connectionCounts.get(key) || 0) + 1);
      if (!connectionValues.has(key)) connectionValues.set(key, connRef);
    }
  }

  const nodeKeyToIndex = new Map<string, number>();
  const layerKeyToIndex = new Map<string, number>();
  const connectionKeyToIndex = new Map<string, number>();
  const nodeTable: string[][] = [];
  const layerTable: string[][] = [];
  const connectionTable: unknown[][] = [];

  for (const [key, count] of nodeCounts) {
    if (count <= 1) continue;
    const value = nodeValues.get(key);
    if (!value) continue;
    nodeKeyToIndex.set(key, nodeTable.length);
    nodeTable.push(value);
  }

  for (const [key, count] of layerCounts) {
    if (count <= 1) continue;
    const value = layerValues.get(key);
    if (!value) continue;
    layerKeyToIndex.set(key, layerTable.length);
    layerTable.push(value);
  }

  for (const [key, count] of connectionCounts) {
    if (count <= 1) continue;
    const value = connectionValues.get(key);
    if (!value) continue;
    connectionKeyToIndex.set(key, connectionTable.length);
    connectionTable.push(value);
  }

  const compressedSlides = slides.map((slide) => {
    const nodeRef = slide.r?.n;
    const layerRef = slide.r?.l;
    const connRef = slide.r?.c;

    const nextRef: NonNullable<CompactSlideV2["r"]> = {
      ...slide.r,
    };

    if (nodeRef && nodeRef.length > 0) {
      const key = stableStringify(nodeRef);
      const index = nodeKeyToIndex.get(key);
      if (index !== undefined) {
        nextRef.ni = index;
        delete nextRef.n;
      }
    }

    if (layerRef && layerRef.length > 0) {
      const key = stableStringify(layerRef);
      const index = layerKeyToIndex.get(key);
      if (index !== undefined) {
        nextRef.li = index;
        delete nextRef.l;
      }
    }

    if (connRef && connRef.length > 0) {
      const key = stableStringify(connRef);
      const index = connectionKeyToIndex.get(key);
      if (index !== undefined) {
        nextRef.ci = index;
        delete nextRef.c;
      }
    }

    const hasRefs = Object.keys(nextRef).length > 0;
    return {
      ...slide,
      r: hasRefs ? nextRef : undefined,
    };
  });

  return {
    slides: compressedSlides,
    nodeTable: nodeTable.length > 0 ? nodeTable : undefined,
    layerTable: layerTable.length > 0 ? layerTable : undefined,
    connectionTable: connectionTable.length > 0 ? connectionTable : undefined,
  };
}

export function buildBaseNodeMap(baseDiagram: DiagramData): Map<string, DiagramData["nodes"][number]> {
  const map = new Map<string, DiagramData["nodes"][number]>();
  for (const node of baseDiagram.nodes || []) {
    if (node?.id) map.set(node.id, node);
  }
  return map;
}

export function canCompressNodeReplaceToIds(
  operationValue: unknown,
  baseNodeMap: Map<string, DiagramData["nodes"][number]>,
): string[] | null {
  if (!Array.isArray(operationValue)) return null;
  const ids: string[] = [];

  for (const item of operationValue) {
    if (!item || typeof item !== "object") return null;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string") return null;
    const baseNode = baseNodeMap.get(id);
    if (!baseNode) return null;
    if (stableStringify(baseNode) !== stableStringify(item)) return null;
    ids.push(id);
  }

  return ids;
}

export function canCompressLayerReplaceToVisibleIds(
  operationValue: unknown,
  baseLayers: DiagramData["layers"],
): string[] | null {
  if (!Array.isArray(operationValue) || !baseLayers?.layers) return null;

  const baseLayerById = new Map(baseLayers.layers.map((layer) => [layer.id, layer]));
  const visibleIds: string[] = [];

  for (const item of operationValue) {
    if (!item || typeof item !== "object") return null;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string") return null;
    const baseLayer = baseLayerById.get(id);
    if (!baseLayer) return null;

    const candidate = item as { visible?: unknown } & Record<string, unknown>;
    const baseWithoutVisible = { ...baseLayer, visible: undefined };
    const itemWithoutVisible = { ...candidate, visible: undefined };

    if (stableStringify(baseWithoutVisible) !== stableStringify(itemWithoutVisible)) {
      return null;
    }

    if (candidate.visible === true) {
      visibleIds.push(id);
    }
  }

  return visibleIds;
}

/**
 * Strip default values from a connection object for compact delta storage.
 * Safe to round-trip: the renderer and clampConnectionAnimation fill in defaults on load.
 */
export function stripConnectionDefaults(conn: DiagramData["connections"][number]): unknown {
  const result: Record<string, unknown> = {};
  if (conn.id !== undefined) result.id = conn.id;
  result.from = conn.from;
  result.to = conn.to;
  if (conn.text !== undefined) result.text = conn.text;
  if (conn.textFontSize !== undefined && conn.textFontSize !== 12) result.textFontSize = conn.textFontSize;
  if (conn.textPosition !== undefined) result.textPosition = conn.textPosition;
  if (conn.color !== undefined) result.color = conn.color;
  if (conn.lineWidth !== undefined) result.lineWidth = conn.lineWidth;
  if (conn.lineWidthLock === false) result.lineWidthLock = false;
  if (conn.lineWidthEnd !== undefined) result.lineWidthEnd = conn.lineWidthEnd;
  if (conn.colorLock === false) result.colorLock = false;
  if (conn.colorEnd !== undefined) result.colorEnd = conn.colorEnd;
  if (conn.shadow !== undefined) result.shadow = conn.shadow;
  if (conn.style !== undefined && conn.style !== "bezier") result.style = conn.style;
  if (conn.smoothCorners === true) result.smoothCorners = true;
  if (conn.curvature !== undefined && conn.curvature !== 0.6) result.curvature = conn.curvature;
  if (conn.fromPreferredExit !== undefined) result.fromPreferredExit = conn.fromPreferredExit;
  if (conn.fromEdgePosition !== undefined) result.fromEdgePosition = conn.fromEdgePosition;
  if (conn.fromArrow !== undefined) result.fromArrow = conn.fromArrow;
  if (conn.toPreferredEntry !== undefined) result.toPreferredEntry = conn.toPreferredEntry;
  if (conn.toEdgePosition !== undefined) result.toEdgePosition = conn.toEdgePosition;
  if (conn.toArrow !== undefined) result.toArrow = conn.toArrow;
  if (conn.arrow !== undefined) result.arrow = conn.arrow;
  if (conn.centerEdgeAnchors === true) result.centerEdgeAnchors = true;
  if (conn.edgeAttachmentConstraint === "top-bottom" || conn.edgeAttachmentConstraint === "left-right") {
    result.edgeAttachmentConstraint = conn.edgeAttachmentConstraint;
  }
  if (conn.waypoints !== undefined) result.waypoints = conn.waypoints;
  if (conn.orthogonalTrunkOffsetX !== undefined && conn.orthogonalTrunkOffsetX !== 0) {
    result.orthogonalTrunkOffsetX = conn.orthogonalTrunkOffsetX;
  }
  if (conn.orthogonalTrunkOffsetY !== undefined && conn.orthogonalTrunkOffsetY !== 0) {
    result.orthogonalTrunkOffsetY = conn.orthogonalTrunkOffsetY;
  }
  if (conn.metaData !== undefined) result.metaData = conn.metaData;

  if (conn.animation !== undefined) {
    const anim = conn.animation;
    const hasNonDefaultFields =
      (anim.shape !== undefined && anim.shape !== "dot") ||
      (anim.speed !== undefined && anim.speed !== 20) ||
      (anim.size !== undefined && anim.size !== 2) ||
      (anim.autoCount !== undefined && anim.autoCount !== true) ||
      (anim.shapeCount !== undefined && anim.shapeCount !== 5) ||
      (anim.spacing !== undefined && anim.spacing !== 2) ||
      anim.color !== undefined;
    const enabledIsDefault = anim.enabled === false || anim.enabled === undefined;

    if (!enabledIsDefault || hasNonDefaultFields) {
      const animStripped: Record<string, unknown> = {};
      if (anim.enabled === true) animStripped.enabled = true;
      else if (anim.enabled === false && hasNonDefaultFields) animStripped.enabled = false;
      if (anim.shape !== undefined && anim.shape !== "dot") animStripped.shape = anim.shape;
      if (anim.speed !== undefined && anim.speed !== 20) animStripped.speed = anim.speed;
      if (anim.size !== undefined && anim.size !== 2) animStripped.size = anim.size;
      if (anim.autoCount !== undefined && anim.autoCount !== true) animStripped.autoCount = anim.autoCount;
      if (anim.shapeCount !== undefined && anim.shapeCount !== 5) animStripped.shapeCount = anim.shapeCount;
      if (anim.spacing !== undefined && anim.spacing !== 2) animStripped.spacing = anim.spacing;
      if (anim.color !== undefined) animStripped.color = anim.color;
      result.animation = animStripped;
    }
  }

  return result;
}

export function safeClone<T>(value: T): T {
  if (value === undefined) return value;

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to JSON cloning for plain serializable data.
    }
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) return value;
  return JSON.parse(serialized) as T;
}

export function blankSlideVisibleFromMaster(masterVisible: DiagramData): DiagramData {
  const next: DiagramData = {
    nodes: [],
    connections: [],
    groupings: [],
  };
  if (masterVisible.layers) {
    next.layers = safeClone(masterVisible.layers);
  }
  if (masterVisible.recentColors && masterVisible.recentColors.length > 0) {
    next.recentColors = [...masterVisible.recentColors];
  }
  return next;
}

export function createPaletteItem(
  resource:
    | PaletteResource
    | {
        name: string;
        iconType?: string;
        iconName?: string;
        emoji?: string;
        imageUrl?: string;
        imageOptions?: import("@/lib/types").CustomImageOptions;
      },
  provider: string,
  category: string,
) {
  const r = resource as {
    name: string;
    iconType?: string;
    iconName?: string;
    emoji?: string;
    file?: string;
    imageUrl?: string;
    imageOptions?: import("@/lib/types").CustomImageOptions;
    type?: string;
  };
  if (r.type === "custom-icon" && r.imageUrl) {
    return {
      type: "generic.icon.custom",
      label: r.name || "Custom Icon",
      provider: "generic",
      category: "icon",
      imageUrl: r.imageUrl,
      imageOptions: r.imageOptions,
    };
  }
  if (r.iconType === "lucide" && r.iconName) {
    const slug = r.iconName.toLowerCase().replace(/\s+/g, "-");
    return {
      type: `generic.icon.${slug}`,
      label: r.name,
      provider: "generic",
      category: "icon",
      iconType: "lucide",
      iconName: r.iconName,
    };
  }
  if (r.iconType === "emoji" && r.emoji) {
    const slug = r.name.replace(/\s+/g, "-").toLowerCase();
    return {
      type: `generic.emoji.${slug}`,
      label: r.name,
      provider: "generic",
      category: "emoji",
      iconType: "emoji",
      emoji: r.emoji,
    };
  }
  const derivedSlug = (resource as PaletteResource).name.replace(/\s+/g, "-").toLowerCase();
  const isTextPaletteTextBoxHeading =
    provider === "generic" && category === "text" && derivedSlug === "text-box-heading";
  const isPieChartPalette = provider === "generic" && category === "object" && derivedSlug === "pie-chart";
  const isBarChartPalette = provider === "generic" && category === "object" && derivedSlug === "bar-chart";
  const isLineChartPalette = provider === "generic" && category === "object" && derivedSlug === "line-chart";
  const isRingChartPalette =
    provider === "generic" && category === "object" && derivedSlug === "ring-chart";
  const isGridChartPalette =
    provider === "generic" && category === "object" && derivedSlug === "grid-chart";
  const isGanttChartPalette =
    provider === "generic" && category === "object" && derivedSlug === "gantt-chart";
  const isLoopChartPalette =
    provider === "generic" && category === "object" && derivedSlug === "loop-chart";
  const isCardPalette = provider === "generic" && category === "cards";
  const isBorderPalette = provider === "generic" && category === "borders";
  return {
    type: isTextPaletteTextBoxHeading
      ? "generic.object.text-box-heading"
      : isPieChartPalette
        ? "generic.chart.pie"
        : isBarChartPalette
          ? "generic.chart.bar"
          : isLineChartPalette
            ? "generic.chart.line"
            : isRingChartPalette
              ? "generic.chart.ring"
              : isGridChartPalette
                ? "generic.chart.grid"
                : isGanttChartPalette
                  ? "generic.chart.gantt"
                  : isLoopChartPalette
                    ? "generic.chart.loop"
                : isBorderPalette
                ? `generic.border.${derivedSlug}`
                : isCardPalette
                  ? `generic.card.${derivedSlug}`
                  : `${provider}.${category}.${derivedSlug}`,
    label: (resource as PaletteResource).name,
    provider,
    category: isTextPaletteTextBoxHeading ? "object" : category,
    file: (resource as PaletteResource).file,
  };
}
