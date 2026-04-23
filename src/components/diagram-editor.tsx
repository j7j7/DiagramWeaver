"use client";
import React, { useRef, useCallback, useLayoutEffect, useEffect, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Panel, Group as PanelGroup } from 'react-resizable-panels';
import { ComponentSidebar } from './editor/component-sidebar';
import { EditorCanvas, type EditorCanvasHandle } from './editor/editor-canvas';
import { ConnectionContextModal } from './editor/connection-context-modal';
import { UmlClassEditorModal } from './editor/uml-class-editor-modal';
import { ChartDataEditorModal } from './editor/chart-data-editor-modal';
import { computeUmlClassDimensions } from '@/lib/uml-utils';
import { PresentationPlayer } from './editor/presentation-player';
import { setBooleanDebounced, setItemDebounced, getBooleanSafe, getItemSafe } from '@/lib/local-storage-debounce';
import dynamic from 'next/dynamic';

const TopMenuBar = dynamic(() => import('./editor/top-menu-bar').then(mod => ({ default: mod.TopMenuBar })), {
  ssr: false,
  loading: () => <div className="flex items-center border-b bg-card min-h-[2.5rem] overflow-x-auto">
    <div className="flex h-10 items-center space-x-1 rounded-md border bg-background p-1">
      <div className="flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium">Loading...</div>
    </div>
  </div>
});

// Lazy load large panels for better initial load performance
const JsonEditorPanel = dynamic(() => import('./editor/json-editor-panel').then(mod => ({ default: mod.JsonEditorPanel })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full min-w-[200px] border-l bg-card">
    <div className="text-sm text-muted-foreground">Loading JSON…</div>
  </div>
});

const PresentationEditorPanel = dynamic(() => import('./editor/presentation-editor-panel').then(mod => ({ default: mod.PresentationEditorPanel })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-12 border-b bg-card">
    <div className="text-sm text-muted-foreground">Loading Presentation Editor...</div>
  </div>
});

const LayersPanel = dynamic(() => import('./editor/layers-panel').then(mod => ({ default: mod.LayersPanel })), {
  ssr: false,
  loading: () => <div className="p-4 border rounded-md bg-card shadow-lg">
    <div className="text-sm text-muted-foreground">Loading Layers Panel...</div>
  </div>
});

const PropertiesPanel = dynamic(() => import('./editor/properties-panel').then(mod => ({ default: mod.PropertiesPanel })), {
  ssr: false,
  loading: () => <div className="p-4 border-t bg-card">
    <div className="text-sm text-muted-foreground">Loading Properties Panel...</div>
  </div>
});

const ScratchPad = dynamic(() => import('./editor/scratch-pad').then(mod => ({ default: mod.ScratchPad })), {
  ssr: false,
});

import { TabBar } from './editor/tab-bar';
import { ExportDialog } from './editor/export-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData, PresentationDeck, Slide, DiagramDelta } from '@/lib/types';
import { generateSequentialId } from '@/lib/id-generator';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDiagramTabs, TUTORIAL_TAB_NAME } from '@/hooks/use-diagram-tabs';
import { useLayers } from '@/hooks/use-layers';
import { useLayerAnimation } from '@/hooks/use-layer-animation';
import { useConnectionAnimationIdlePause } from '@/hooks/use-connection-animation-idle';
import { flattenDiagramOnImport, type RawDiagramData } from '@/lib/flatten-on-import';
import { collectAllIdsInDiagram, sanitizeImportedDiagram } from '@/lib/import-sanitize';
import { getDiagramAtStack, updateDiagramAtStack, addSubDiagramAtStack, removeSubDiagramAtStack } from '@/lib/sub-diagram-utils';
import { sanitizeViewState } from '@/lib/view-state-utils';
import { DiagramDataSchema } from '@/lib/schemas';
import { normalizeHttpImageUrl, sanitizeCustomIconsInDiagram } from '@/lib/custom-icon-utils';
import { parseMermaidFlowchart, parseMermaidClassDiagram, parseMermaidSequenceDiagram, detectMermaidDiagramType } from '@/lib/mermaid-parser';
import { mermaidToDiagramData, classDiagramToDiagramData, sequenceDiagramToDiagramData } from '@/lib/mermaid-to-diagram';
import { themeManager, DIAGRAM_THEME_HUE_STEP_DEG, DEFAULT_THEMES } from '@/lib/theme-manager';
import { orderSelectedIdsForThemeHue } from '@/lib/selection-theme-order';
import { DiagramTheme, ThemeMenuApplyOptions } from '@/lib/theme-types';
import { TutorialProvider, useTutorial } from './tutorial/tutorial-provider';
import { getTutorialSteps } from './tutorial/tutorial-steps';
import { TutorialOverlay } from './tutorial/tutorial-overlay';
import { TooltipProvider } from '@/components/ui/tooltip';
import { 
  createGroup, 
  addToGroup,
  removeFromGroup, 
  ungroup, 
  getItemGroup,
  getGroupMembers,
  handleItemDeletion as cleanupGroupsAfterDeletion
} from '@/lib/grouping-utils';
import { 
  moveItemToBack,
  moveItemToFront,
  moveItemOneBack,
  moveItemOneForward,
  getItemPosition,
  getItemCount
} from '@/lib/rendering-order-utils';
import { performAutoLayout } from '@/lib/auto-layout';
import {
  generateConnectionId,
  ensureConnectionIds,
  stableDiagramConnectionId,
  connectionSelectionIdMatches,
  selectionSetContainsConnection,
} from '@/lib/connection-order-utils';
import { GRID_STEP, snapToGrid, snapDimensionToGrid } from '@/components/editor/canvas-constants';
import { DEFAULT_CONNECTION_ANIMATION, toConnectionAnimationPatch, getDownstreamAnimationChainNodes } from '@/lib/connection-animation';
import { isEventFromEditableElement } from '@/lib/keyboard-utils';
import {
  applyDiagramDelta,
  computeDiagramDelta,
  listVisibleLayerIds,
  projectVisibleDiagram,
} from '@/lib/presentation-delta';
import { sanitizeExportBasename } from '@/components/editor/export-dialog';
import {
  computeSlidePlaybackTransform,
  computeUnionFitTransformForDiagrams,
  pruneConnectionsToVisibleNodes,
} from '@/lib/presentation-viewport-fit';
import { extractEmbeddedPresentations, slideNeedsPresentationThumbnailSnapshot } from '@/lib/extract-embedded-presentations';
import {
  loadPresentationsByTab,
  savePresentationsByTab,
} from '@/lib/presentation-storage';
import { collapsePresentationDecksToOne } from '@/lib/presentation-deck-merge';
import { createPresentationPrimarySlide } from '@/lib/presentation-primary-slide';
import { DiagramBreadcrumb, type BreadcrumbSegment } from './editor/diagram-breadcrumb';
import { isConnectorLineNodeType } from '@/lib/utils';
import { removeConnectorLineVertexAtIndex, isConnectorLineGeometryClosed } from '@/lib/line-curve-path';
import {
  syncClosedConnectorLineBorderWidth,
  syncClosedConnectorVisualBorderFromLineStyling,
} from '@/lib/line-styling';

/** Presentation slide PNG thumbnails: poll at most this often; capture only when delta fingerprint changed. */
const PRESENTATION_THUMB_INTERVAL_MS = 3000;

/** Stable when `activeTab.diagramData` is missing (legacy / corrupt rows). A fresh `{}` each render caused presentation master `useEffect` to loop. */
const EMPTY_TAB_DIAGRAM_FALLBACK: DiagramData = { nodes: [], connections: [], groupings: [] };

/** Union bounds for PNG export / thumbnails: one entry per deck slide (slide 0 = main). */
function buildPresentationUnionDiagramsForPngExport(args: {
  tabDiagram: DiagramData;
  presentationMaster: DiagramData | null;
  deckSlides: Slide[];
  activeSlideId: string | null;
  draft: DiagramData | null;
  layersFilteredBase: DiagramData;
}): DiagramData[] {
  const master = projectVisibleDiagram(args.presentationMaster ?? args.tabDiagram);
  return args.deckSlides.map((slide) => {
    if (args.activeSlideId && slide.id === args.activeSlideId && args.draft) {
      return projectVisibleDiagram(args.draft);
    }
    return projectVisibleDiagram(applyDiagramDelta(master, slide.diagramDelta));
  });
}

async function waitTwoAnimationFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** IDs in `selectedItemIds` that exist as nodes or zones (connection endpoints), preserving selection order. */
function collectConnectSourceIdsFromDiagram(selectedItemIds: Set<string>, diagram: DiagramData): string[] {
  const nodeIds = new Set(diagram.nodes.map((n) => n.id));
  const zoneIds = new Set((diagram.zones ?? []).map((z) => z.id));
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedItemIds) {
    if (seen.has(id)) continue;
    if (nodeIds.has(id) || zoneIds.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  return result;
}

function getSelectionIdKind(id: string, diagram: DiagramData): "object" | "edge" | "unknown" {
  if (diagram.nodes.some((n) => n.id === id)) return "object";
  if (diagram.zones?.some((z) => z.id === id)) return "object";
  const conns = diagram.connections ?? [];
  if (conns.some((c) => c.id === id)) return "edge";
  if (conns.some((c) => `${c.from}-${c.to}` === id)) return "edge";
  return "unknown";
}

/** Resolve stable connection ids from the multi-selection set (skips ambiguous legacy keys). */
function connectionIdsFromSelectionSet(
  selectedItemIds: Set<string>,
  connections: DiagramConnectionData[]
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

function clearPendingConnectionWindowState(): void {
  delete (window as unknown as { pendingConnectionSourceId?: string }).pendingConnectionSourceId;
  delete (window as unknown as { pendingConnectionSourceIds?: string[] }).pendingConnectionSourceIds;
  delete (window as unknown as { pendingConnectionOptions?: unknown }).pendingConnectionOptions;
}

export type SelectedItem = (
  | (DiagramNodeData & {
      itemType: 'node',
      id: string,
      // Zone styling properties for nodes
      borderColor?: string,
      textColor?: string,
      backgroundColor?: string,
      borderStyle?: 'solid' | 'dotted' | 'gradient' | 'none',
      borderColors?: string[],
      backgroundStyle?: 'solid' | 'gradient' | 'frosted' | 'none',
      backgroundColors?: string[],
      frostedDiffusion?: number,
      frostedTransparency?: number,
      gradientAngle?: number,
      shadow?: boolean,
      rotation?: number,
      textPosition?: 'above' | 'center' | 'under',
      textJustify?: 'left' | 'center' | 'right' | 'full',
      textVerticalPosition?: 'top' | 'middle' | 'bottom',
      fontFamily?: string,
      fontSize?: number,
      fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900',
      fontStyle?: 'normal' | 'italic' | 'oblique',
      textDecoration?: 'none' | 'underline' | 'overline' | 'line-through',
      textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize',
      letterSpacing?: number,
      lineHeight?: number,
      textOpacity?: number,
      borderWidth?: number,
      objectStyle?: string,
      width?: number,
      height?: number,
      sizeMode?: 'auto' | 'custom',
      minWidth?: number,
      minHeight?: number,
      orientation?: 'horizontal' | 'vertical' | 'square',
      maxItemsPerRow?: number,
      lineColor?: string,
      parentId?: string,
      tag?: string,
      tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    })
  | (DiagramConnectionData & { 
      itemType: 'edge', 
      id: string,
      // Additional edge properties
      freeflow?: boolean,
      edgePosition?: number
    })
);

interface PaletteResource {
  name: string;
  file?: string; // Optional for icon resources (symbols/emojis)
  type?: string;
  hasWhiteVariant?: boolean;
  format?: string;
  iconType?: string;
  iconName?: string;
  emoji?: string;
}

interface PaletteSelection {
  resource: PaletteResource;
  provider: string;
  category: string;
}

type CompactOpCode = 0 | 1 | 2; // 0=add, 1=remove, 2=replace
type CompactOperation = [CompactOpCode, string, unknown?];

type CompactAnimationStateV2 = {
  e?: 0; // only stored when animations are disabled
  f?: string[];
  x?: string[];
};

type CompactSlideV2 = {
  d?: { o: CompactOperation[] };
  r?: {
    n?: string[]; // visible node ids (resolved from base diagram)
    l?: string[]; // visible layer ids (resolved from base diagram)
    c?: unknown[]; // stripped connections array (resolved from deck table)
    ni?: number; // node id set index in deck table
    li?: number; // layer id set index in deck table
    ci?: number; // connection array index in deck table
  };
  t?: string;
  a?: CompactAnimationStateV2;
  z?: number;
  px?: number;
  py?: number;
};

type CompactDeckV2 = {
  n?: string;
  tn?: string[][]; // deck-level node id set table
  tl?: string[][]; // deck-level layer id set table
  tc?: unknown[][]; // deck-level connection array table
  s: CompactSlideV2[];
};

type CompactPresentationsV2 = {
  v: 2;
  ai?: number;
  d: CompactDeckV2[];
};

type DiagramJsonWithPresentations = DiagramData & {
  presentations?: CompactPresentationsV2;
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function dedupeSlideRefSets(slides: CompactSlideV2[]): {
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

    const nextRef: NonNullable<CompactSlideV2['r']> = {
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

function buildBaseNodeMap(baseDiagram: DiagramData): Map<string, DiagramData['nodes'][number]> {
  const map = new Map<string, DiagramData['nodes'][number]>();
  for (const node of baseDiagram.nodes || []) {
    if (node?.id) map.set(node.id, node);
  }
  return map;
}

function canCompressNodeReplaceToIds(
  operationValue: unknown,
  baseNodeMap: Map<string, DiagramData['nodes'][number]>
): string[] | null {
  if (!Array.isArray(operationValue)) return null;
  const ids: string[] = [];

  for (const item of operationValue) {
    if (!item || typeof item !== 'object') return null;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string') return null;
    const baseNode = baseNodeMap.get(id);
    if (!baseNode) return null;
    if (stableStringify(baseNode) !== stableStringify(item)) return null;
    ids.push(id);
  }

  return ids;
}

function canCompressLayerReplaceToVisibleIds(
  operationValue: unknown,
  baseLayers: DiagramData['layers']
): string[] | null {
  if (!Array.isArray(operationValue) || !baseLayers?.layers) return null;

  const baseLayerById = new Map(baseLayers.layers.map((layer) => [layer.id, layer]));
  const visibleIds: string[] = [];

  for (const item of operationValue) {
    if (!item || typeof item !== 'object') return null;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string') return null;
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
function stripConnectionDefaults(conn: DiagramData['connections'][number]): unknown {
  const result: Record<string, unknown> = {};
  if (conn.id !== undefined) result.id = conn.id;
  result.from = conn.from;
  result.to = conn.to;
  if (conn.text !== undefined) result.text = conn.text;
  if (conn.textPosition !== undefined) result.textPosition = conn.textPosition;
  if (conn.color !== undefined) result.color = conn.color;
  if (conn.lineWidth !== undefined) result.lineWidth = conn.lineWidth;
  if (conn.lineWidthLock === false) result.lineWidthLock = false;
  if (conn.lineWidthEnd !== undefined) result.lineWidthEnd = conn.lineWidthEnd;
  if (conn.colorLock === false) result.colorLock = false;
  if (conn.colorEnd !== undefined) result.colorEnd = conn.colorEnd;
  if (conn.shadow !== undefined) result.shadow = conn.shadow;
  // style: 'bezier' is the default — omit it to save space
  if (conn.style !== undefined && conn.style !== 'bezier') result.style = conn.style;
  if (conn.smoothCorners === true) result.smoothCorners = true;
  // curvature: 0.6 is the default — omit it to save space
  if (conn.curvature !== undefined && conn.curvature !== 0.6) result.curvature = conn.curvature;
  if (conn.fromPreferredExit !== undefined) result.fromPreferredExit = conn.fromPreferredExit;
  if (conn.fromArrow !== undefined) result.fromArrow = conn.fromArrow;
  if (conn.toPreferredEntry !== undefined) result.toPreferredEntry = conn.toPreferredEntry;
  if (conn.toArrow !== undefined) result.toArrow = conn.toArrow;
  if (conn.arrow !== undefined) result.arrow = conn.arrow;
  if (conn.centerEdgeAnchors === true) result.centerEdgeAnchors = true;
  if (conn.edgeAttachmentConstraint === 'top-bottom' || conn.edgeAttachmentConstraint === 'left-right') {
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
      (anim.shape !== undefined && anim.shape !== 'dot') ||
      (anim.speed !== undefined && anim.speed !== 20) ||
      (anim.size !== undefined && anim.size !== 2) ||
      (anim.autoCount !== undefined && anim.autoCount !== true) ||
      (anim.shapeCount !== undefined && anim.shapeCount !== 5) ||
      (anim.spacing !== undefined && anim.spacing !== 2) ||
      anim.color !== undefined;
    const enabledIsDefault = anim.enabled === false || anim.enabled === undefined;

    if (!enabledIsDefault || hasNonDefaultFields) {
      const animStripped: Record<string, unknown> = {};
      // Keep enabled=true explicitly; keep enabled=false only when non-default fields are
      // also present (otherwise legacy-detection in clampConnectionAnimation would infer enabled=true)
      if (anim.enabled === true) animStripped.enabled = true;
      else if (anim.enabled === false && hasNonDefaultFields) animStripped.enabled = false;
      if (anim.shape !== undefined && anim.shape !== 'dot') animStripped.shape = anim.shape;
      if (anim.speed !== undefined && anim.speed !== 20) animStripped.speed = anim.speed;
      if (anim.size !== undefined && anim.size !== 2) animStripped.size = anim.size;
      if (anim.autoCount !== undefined && anim.autoCount !== true) animStripped.autoCount = anim.autoCount;
      if (anim.shapeCount !== undefined && anim.shapeCount !== 5) animStripped.shapeCount = anim.shapeCount;
      if (anim.spacing !== undefined && anim.spacing !== 2) animStripped.spacing = anim.spacing;
      if (anim.color !== undefined) animStripped.color = anim.color;
      result.animation = animStripped;
    }
    // All-default animation → omit entirely (clampConnectionAnimation(undefined) gives all defaults)
  }

  return result;
}

function safeClone<T>(value: T): T {
  if (value === undefined) return value;

  if (typeof structuredClone === 'function') {
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

function createPaletteItem(
  resource: PaletteResource | { name: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions },
  provider: string,
  category: string
) {
  const r = resource as { name: string; iconType?: string; iconName?: string; emoji?: string; file?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions; type?: string };
  if (r.type === 'custom-icon' && r.imageUrl) {
    return {
      type: 'generic.icon.custom',
      label: r.name || 'Custom Icon',
      provider: 'generic',
      category: 'icon',
      imageUrl: r.imageUrl,
      imageOptions: r.imageOptions,
    };
  }
  if (r.iconType === 'lucide' && r.iconName) {
    const slug = r.iconName.toLowerCase().replace(/\s+/g, '-');
    return { type: `generic.icon.${slug}`, label: r.name, provider: 'generic', category: 'icon', iconType: 'lucide', iconName: r.iconName };
  }
  if (r.iconType === 'emoji' && r.emoji) {
    const slug = r.name.replace(/\s+/g, '-').toLowerCase();
    return { type: `generic.emoji.${slug}`, label: r.name, provider: 'generic', category: 'emoji', iconType: 'emoji', emoji: r.emoji };
  }
  const derivedSlug = (resource as PaletteResource).name.replace(/\s+/g, '-').toLowerCase();
  const isTextPaletteTextBoxHeading =
    provider === 'generic' && category === 'text' && derivedSlug === 'text-box-heading';
  const isPieChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'pie-chart';
  const isBarChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'bar-chart';
  const isLineChartPalette = provider === 'generic' && category === 'object' && derivedSlug === 'line-chart';
  return {
    type: isTextPaletteTextBoxHeading
      ? 'generic.object.text-box-heading'
      : isPieChartPalette
        ? 'generic.chart.pie'
        : isBarChartPalette
          ? 'generic.chart.bar'
          : isLineChartPalette
            ? 'generic.chart.line'
            : `${provider}.${category}.${derivedSlug}`,
    label: (resource as PaletteResource).name,
    provider,
    category: isTextPaletteTextBoxHeading ? 'object' : category,
    file: (resource as PaletteResource).file,
  };
}

export default function DiagramEditor() {
  const [isClient, setIsClient] = React.useState<boolean>(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const editorRef = React.useRef<EditorCanvasHandle>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportDialogFormat, setExportDialogFormat] = React.useState<'png' | 'gif'>('png');
  const [closeTabDialogOpen, setCloseTabDialogOpen] = React.useState(false);
  const [pendingCloseTabId, setPendingCloseTabId] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = React.useState<boolean>(false);
  // Use fixed defaults for SSR/hydration; restore from localStorage in useEffect
  const [rightPanelCollapsed, setRightPanelCollapsed] = React.useState<boolean>(true);
  const [metadataPopupsEnabled, setMetadataPopupsEnabled] = React.useState<boolean>(true);
  const [propertiesPanelVisible, setPropertiesPanelVisible] = React.useState<boolean>(true);
  const [scratchPadOpen, setScratchPadOpen] = React.useState<boolean>(false);
  const [layerAnimationsEnabled, setLayerAnimationsEnabled] = React.useState<boolean>(true);
  const [rulesEditorOpen, setRulesEditorOpen] = React.useState<boolean>(false);
  const [rules, setRules] = React.useState<import('@/lib/rules-types').DiagramRule[]>([]);
  const [presentationDecks, setPresentationDecks] = React.useState<PresentationDeck[]>([]);
  const presentationDecksRef = React.useRef(presentationDecks);
  presentationDecksRef.current = presentationDecks;
  const [activePresentationDeckId, setActivePresentationDeckId] = React.useState<string | null>(null);
  const [activePresentationSlideId, setActivePresentationSlideId] = React.useState<string | null>(null);
  const activePresentationDeck = React.useMemo(
    () =>
      activePresentationDeckId
        ? presentationDecks.find((d) => d.id === activePresentationDeckId) ?? null
        : null,
    [presentationDecks, activePresentationDeckId],
  );
  const activePresentationPrimarySlideId = activePresentationDeck?.slides[0]?.id ?? null;
  const isPrimaryPresentationSlideActive = Boolean(
    activePresentationPrimarySlideId && activePresentationSlideId === activePresentationPrimarySlideId,
  );
  const [presentationDisabledLayerIds, setPresentationDisabledLayerIds] = React.useState<Set<string>>(new Set());
  const [selectedPresentationSlideIds, setSelectedPresentationSlideIds] = React.useState<Set<string>>(new Set());
  const [presentationPlayerOpen, setPresentationPlayerOpen] = React.useState<boolean>(false);
  const [presentationPlayerIndex, setPresentationPlayerIndex] = React.useState<number>(0);
  const [presentationMasterDiagram, setPresentationMasterDiagram] = React.useState<DiagramData | null>(null);
  const [presentationDraftDiagram, setPresentationDraftDiagram] = React.useState<DiagramData | null>(null);
  /** `${deckId}:${slideId}` → JSON fingerprint of diagram delta vs master — thumbnail matches this until the slide is edited. */
  const presentationThumbDeltaFingerprintBySlideRef = React.useRef<Record<string, string>>({});
  /** `${tabId}:${deckId}:${slideId}` — last canvas re-sync from tab + slide delta (refresh / deck load). */
  const presentationSlideCanvasKeyRef = React.useRef<string | null>(null);
  /** Last `${tabId}:${JSON.stringify(tabDiagram)}` applied in base-slide → master sync (avoids setState on reference-only churn). */
  const presentationMasterFromTabSyncKeyRef = React.useRef<string | null>(null);
  /** Last `${deckId}:${slideId}` for which thumbnail fingerprint baseline was set (layout + hydration). */
  const presentationThumbFingerprintSlideKeyRef = React.useRef<string | null>(null);
  const presentationThumbCaptureInFlightRef = React.useRef(false);
  /** True while sequentially capturing PNG thumbnails for every slide (e.g. compact file load). */
  const presentationThumbBackfillRunningRef = React.useRef(false);
  /** Skip persisting slide delta while temporarily switching slides for multi-slide PNG export. */
  const presentationPersistSuppressedForExportRef = React.useRef(false);
  const presentationThumbCtxRef = React.useRef<{
    draft: DiagramData | null;
    master: DiagramData | null;
    tab: DiagramData;
    deckId: string | null;
    slideId: string | null;
  }>({
    draft: null,
    master: null,
    tab: { nodes: [], connections: [], groupings: [] },
    deckId: null,
    slideId: null,
  });
  const canvasTransformRef = React.useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  /** Tracks last slide we applied viewport for — avoids re-applying on every deck update; used when switching slides. */
  const prevPresentationSlideIdForViewportRef = React.useRef<string | null>(null);
  const presentationStateByTabRef = React.useRef<Record<string, {
    decks: PresentationDeck[];
    activeDeckId: string | null;
    activeSlideId: string | null;
    selectedSlideIds: string[];
    masterDiagram: DiagramData | null;
    draftDiagram: DiagramData | null;
  }>>({});
  const presentationPersistTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last serialized tab diagram on base slide — used to rebase snapshot deltas when the base diagram edits. */
  const presentationPrevBaseJsonRef = React.useRef<string | null>(null);
  const presentationHydrationStartedRef = React.useRef(false);
  const lastRestoredStackRef = React.useRef<string | null>(null);
  const [presentationStorageHydrated, setPresentationStorageHydrated] = React.useState(false);

  // Restore rules from localStorage after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = getItemSafe('dw:rules');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const rulesArray = Array.isArray(parsed?.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : [];
        if (rulesArray.length > 0 && rulesArray.every((r: any) => r && typeof r.id === 'string' && r.operator)) {
          setRules(rulesArray);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Save rules to localStorage when they change (debounced)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setItemDebounced('dw:rules', JSON.stringify({ version: '1.0', rules }), 1000);
    }
  }, [rules]);

  // Restore scratchpad visibility from localStorage after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = getItemSafe('dw:scratchpad:visible');
    if (saved) {
      try {
        setScratchPadOpen(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Save scratchpad visibility to localStorage when it changes (debounced)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setItemDebounced('dw:scratchpad:visible', JSON.stringify(scratchPadOpen), 1000);
    }
  }, [scratchPadOpen]);

  // Restore layer animations enabled from localStorage after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = getItemSafe('dw:layerAnimations:enabled');
    if (saved !== null) {
      try {
        setLayerAnimationsEnabled(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Save layer animations enabled to localStorage when it changes (debounced)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setItemDebounced('dw:layerAnimations:enabled', JSON.stringify(layerAnimationsEnabled), 1000);
    }
  }, [layerAnimationsEnabled]);

  const [jsonPanelWidth, setJsonPanelWidth] = React.useState<number>(420);
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const [canPaste, setCanPaste] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mermaidInputRef = React.useRef<HTMLInputElement>(null);
  const subDiagramImportInputRef = React.useRef<HTMLInputElement>(null);
  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null);
  const [hoverEnabled, setHoverEnabled] = React.useState<boolean>(false);
  const [iconBackgroundEnabled, setIconBackgroundEnabled] = React.useState<boolean>(true);
  const [defaultTextLabelsEnabled, setDefaultTextLabelsEnabled] = React.useState<boolean>(true);
  const [alignmentGuidesEnabled, setAlignmentGuidesEnabled] = React.useState<boolean>(true);
  const [connectionsBehindNodesEnabled, setConnectionsBehindNodesEnabled] = React.useState<boolean>(true);
  const [animationConnectionsUserEnabled, setAnimationConnectionsUserEnabled] = React.useState<boolean>(true);
  const [animationConnectionsMenuPaused, setAnimationConnectionsMenuPaused] = React.useState(false);
  const {
    idlePaused: animationConnectionsIdlePaused,
    onCanvasActivity: onConnectionAnimationCanvasActivityFromHook,
  } = useConnectionAnimationIdlePause(animationConnectionsUserEnabled);
  const onConnectionAnimationCanvasActivity = React.useCallback(() => {
    setAnimationConnectionsMenuPaused(false);
    onConnectionAnimationCanvasActivityFromHook();
  }, [onConnectionAnimationCanvasActivityFromHook]);
  const animationConnectionsEnabled =
    animationConnectionsUserEnabled &&
    !animationConnectionsIdlePaused &&
    !animationConnectionsMenuPaused;

  React.useEffect(() => {
    if (!animationConnectionsUserEnabled) {
      setAnimationConnectionsMenuPaused(false);
    }
  }, [animationConnectionsUserEnabled]);

  const pauseConnectionAnimationsForOverlayUi = React.useCallback(() => {
    if (animationConnectionsUserEnabled) {
      setAnimationConnectionsMenuPaused(true);
    }
  }, [animationConnectionsUserEnabled]);

  const [animationToggleOnClickEnabled, setAnimationToggleOnClickEnabled] = React.useState<boolean>(false);
  const [animationDisabledSources, setAnimationDisabledSources] = React.useState<Set<string>>(new Set());
  const [isReadOnly, setIsReadOnly] = React.useState<boolean>(false);
  const [triggerTextStylingPanel, setTriggerTextStylingPanel] = React.useState<boolean>(false);
  const [triggerVisualStylingPanel, setTriggerVisualStylingPanel] = React.useState<boolean>(false);
  const [triggerLineStylingPanel, setTriggerLineStylingPanel] = React.useState<boolean>(false);
  const [triggerConnectionSettingsPanel, setTriggerConnectionSettingsPanel] = React.useState<boolean>(false);
  const [connectionContextModal, setConnectionContextModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    connection: import('@/lib/types').DiagramConnectionData | null;
  }>({ visible: false, x: 0, y: 0, connection: null });
  const [umlClassEditorModal, setUmlClassEditorModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
  }>({ visible: false, x: 0, y: 0, itemId: '' });
  const [chartDataEditorModal, setChartDataEditorModal] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
  }>({ visible: false, x: 0, y: 0, itemId: '' });
  const [lastRightClickItemId, setLastRightClickItemId] = React.useState<string | null>(null);
  const [selectedResource, setSelectedResource] = React.useState<PaletteSelection | null>(null);
  const [paletteClipboardItem, setPaletteClipboardItem] = React.useState<any | null>(null);
  const [animationSelectionDialogOpen, setAnimationSelectionDialogOpen] = React.useState(false);
  const [animationOverwriteDialogOpen, setAnimationOverwriteDialogOpen] = React.useState(false);
  const [animationDisableConfirmDialogOpen, setAnimationDisableConfirmDialogOpen] = React.useState(false);
  const [animationCurrentOnlyDialogOpen, setAnimationCurrentOnlyDialogOpen] = React.useState(false);
  const [pendingAnimationUpdate, setPendingAnimationUpdate] = React.useState<{
    from: string;
    to: string;
    connectionId?: string;
    mode: 'enable' | 'disable';
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      smoothCorners?: boolean;
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    };
    selectedConnectionIds: string[];
    /** When set, animation dialog applies full `updates` to every listed connection (stable ids). */
    applyAllConnectionIds?: string[];
  } | null>(null);

  const setMousePositionForIdle = React.useCallback(
    (pos: { x: number; y: number } | null) => {
      setMousePosition(pos);
      if (pos !== null) {
        onConnectionAnimationCanvasActivity();
      }
    },
    [onConnectionAnimationCanvasActivity],
  );

  // Reset trigger states after they've been used
  React.useEffect(() => {
    if (triggerTextStylingPanel) {
      const timer = setTimeout(() => setTriggerTextStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerTextStylingPanel]);

  React.useEffect(() => {
    if (triggerVisualStylingPanel) {
      const timer = setTimeout(() => setTriggerVisualStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerVisualStylingPanel]);

  React.useEffect(() => {
    if (triggerLineStylingPanel) {
      const timer = setTimeout(() => setTriggerLineStylingPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerLineStylingPanel]);

  React.useEffect(() => {
    if (triggerConnectionSettingsPanel) {
      const timer = setTimeout(() => setTriggerConnectionSettingsPanel(false), 100);
      return () => clearTimeout(timer);
    }
  }, [triggerConnectionSettingsPanel]);

  // Tab management
  const {
    tabs,
    activeTabId,
    isLoaded,
    activeTab,
    createTab,
    ensureTutorialTab,
    switchTab,
    closeTab,
    updateActiveTab,
    updateTab,
    getTab,
    reorderTabs,
    markTabAsSaved,
    getHistoryRef,
    setHistoryRef,
  } = useDiagramTabs({
    isClient,
    onToast: toast,
  });

  // Load saved presentations for all tabs once the tab store is ready
  React.useEffect(() => {
    if (!isLoaded || presentationStorageHydrated || presentationHydrationStartedRef.current) return;
    presentationHydrationStartedRef.current = true;

    let cancelled = false;

    loadPresentationsByTab()
      .then((byTab) => {
        if (cancelled || !byTab) return;

        for (const [tabId, entry] of Object.entries(byTab)) {
          const collapsed = collapsePresentationDecksToOne(entry.decks, entry.activeDeckId);
          const existing = presentationStateByTabRef.current[tabId];
          const deckForTab = collapsed.decks.find((d) => d.id === collapsed.activeDeckId) ?? collapsed.decks[0];
          const primaryId = deckForTab?.slides[0]?.id ?? null;
          const loadedSlideId = entry.activeSlideId ?? existing?.activeSlideId ?? primaryId;
          presentationStateByTabRef.current[tabId] = {
            decks: collapsed.decks,
            activeDeckId: collapsed.activeDeckId,
            activeSlideId: loadedSlideId,
            selectedSlideIds: existing?.selectedSlideIds ?? [],
            masterDiagram: existing?.masterDiagram ?? null,
            draftDiagram: existing?.draftDiagram ?? null,
          };
        }

        if (activeTabId && byTab[activeTabId]) {
          const collapsed = collapsePresentationDecksToOne(
            byTab[activeTabId].decks,
            byTab[activeTabId].activeDeckId,
          );
          setPresentationDecks(collapsed.decks);
          setActivePresentationDeckId(collapsed.activeDeckId);
          const deckNow =
            collapsed.decks.find((d) => d.id === collapsed.activeDeckId) ?? collapsed.decks[0];
          const primaryNow = deckNow?.slides[0]?.id ?? null;
          setActivePresentationSlideId(byTab[activeTabId].activeSlideId ?? primaryNow);
        }
      })
      .catch(() => {
        // Storage unavailable; keep in-memory behavior.
      })
      .finally(() => {
        if (!cancelled) {
          setPresentationStorageHydrated(true);
        }
      });

    return () => { cancelled = true; };
  }, [isLoaded, presentationStorageHydrated, activeTabId]);

  React.useEffect(() => {
    const liveTabIds = new Set(tabs.map((tab) => tab.id));
    for (const tabId of Object.keys(presentationStateByTabRef.current)) {
      if (!liveTabIds.has(tabId)) {
        delete presentationStateByTabRef.current[tabId];
      }
    }
  }, [tabs]);

  // Sync active tab state to local state for component use
  const tabDiagramData = activeTab?.diagramData ?? EMPTY_TAB_DIAGRAM_FALLBACK;
  const diagramData = isPrimaryPresentationSlideActive
    ? tabDiagramData
    : (presentationDraftDiagram ?? tabDiagramData);

  presentationThumbCtxRef.current = {
    draft: presentationDraftDiagram,
    master: presentationMasterDiagram,
    tab: tabDiagramData,
    deckId: activePresentationDeckId,
    slideId: activePresentationSlideId,
  };

  const presentationDraftDiagramRef = React.useRef(presentationDraftDiagram);
  presentationDraftDiagramRef.current = presentationDraftDiagram;
  const presentationMasterDiagramRef = React.useRef(presentationMasterDiagram);
  presentationMasterDiagramRef.current = presentationMasterDiagram;
  const tabDiagramDataRef = React.useRef(tabDiagramData);
  tabDiagramDataRef.current = tabDiagramData;

  /** After slide/deck change (not draft-only edits): baseline delta fingerprint so leaving without edits skips capture. */
  useLayoutEffect(() => {
    if (!activePresentationSlideId) return;
    const deckId = activePresentationDeckId;
    const slideId = activePresentationSlideId;
    if (!deckId || !slideId) {
      presentationThumbFingerprintSlideKeyRef.current = null;
      return;
    }
    const slideKey = `${deckId}:${slideId}`;
    if (presentationThumbFingerprintSlideKeyRef.current === slideKey) return;
    presentationThumbFingerprintSlideKeyRef.current = slideKey;

    const draft = presentationDraftDiagramRef.current;
    if (!draft) return;
    const master = presentationMasterDiagramRef.current ?? tabDiagramDataRef.current;
    try {
      const masterBase = projectVisibleDiagram(master);
      const fp = JSON.stringify(computeDiagramDelta(masterBase, projectVisibleDiagram(draft)));
      presentationThumbDeltaFingerprintBySlideRef.current[slideKey] = fp;
    } catch {
      // ignore
    }
  }, [activePresentationDeckId, activePresentationSlideId]);

  /**
   * IndexedDB restores decks/slide selection, but not presentation master/draft. On hard refresh the active-tab
   * effect can also clear state before per-tab storage hydrates. Rebuild master + draft from the tab diagram
   * and the active slide’s delta once storage is ready (same as choosing a slide in the panel).
   */
  React.useEffect(() => {
    if (!presentationStorageHydrated || !activeTabId) return;
    if (!activePresentationDeckId || !activePresentationSlideId) return;

    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const slide = deck?.slides.find((s) => s.id === activePresentationSlideId);
    if (!deck || !slide) return;

    const key = `${activeTabId}:${activePresentationDeckId}:${activePresentationSlideId}`;
    const masterMissing = !presentationMasterDiagramRef.current;
    const slideContextChanged = presentationSlideCanvasKeyRef.current !== key;
    if (!masterMissing && !slideContextChanged) return;

    presentationSlideCanvasKeyRef.current = key;

    const tabSnapshot = safeClone(tabDiagramDataRef.current);
    if (masterMissing) {
      setPresentationMasterDiagram(tabSnapshot);
    }

    if (deck.slides[0]?.id === activePresentationSlideId) {
      setPresentationDraftDiagram(null);
      return;
    }

    const masterBase = projectVisibleDiagram(
      masterMissing ? tabSnapshot : (presentationMasterDiagramRef.current ?? tabSnapshot),
    );
    const nextDraft = applyDiagramDelta(masterBase, slide.diagramDelta);
    try {
      const fp = JSON.stringify(
        computeDiagramDelta(masterBase, projectVisibleDiagram(nextDraft)),
      );
      presentationThumbDeltaFingerprintBySlideRef.current[`${activePresentationDeckId}:${activePresentationSlideId}`] = fp;
      presentationThumbFingerprintSlideKeyRef.current = `${activePresentationDeckId}:${activePresentationSlideId}`;
    } catch {
      // ignore
    }
    setPresentationDraftDiagram(nextDraft);
  }, [
    presentationStorageHydrated,
    activeTabId,
    activePresentationDeckId,
    activePresentationSlideId,
    presentationDecks,
  ]);

  const history = activeTab?.history || [JSON.stringify({ nodes: [], connections: [], groupings: [] })];
  const historyIndex = activeTab?.historyIndex || 0;
  const historyRef = React.useRef(getHistoryRef(activeTabId || '') || { history: [], index: 0 });
  const selectedItem = activeTab?.selectedItem || null;
  const selectedItemIds = activeTab?.selectedItemIds || new Set();
  const isConnectMode = activeTab?.isConnectMode || false;
  const jsonPanelOpen = activeTab?.jsonPanelOpen || false;
  const sanitizeCanvasTransform = React.useCallback((transform?: { x: number; y: number; k: number } | null) => {
    const safeX = typeof transform?.x === 'number' && Number.isFinite(transform.x) ? transform.x : 0;
    const safeY = typeof transform?.y === 'number' && Number.isFinite(transform.y) ? transform.y : 0;
    const safeKRaw = typeof transform?.k === 'number' && Number.isFinite(transform.k) ? transform.k : 1;
    const safeK = Math.max(0.1, Math.min(2.5, safeKRaw));
    return { x: safeX, y: safeY, k: safeK };
  }, []);

  const canvasTransform = sanitizeCanvasTransform(activeTab?.canvasTransform);
  React.useEffect(() => {
    canvasTransformRef.current = canvasTransform;
  }, [canvasTransform]);
  const activePresentationSlides = activePresentationDeck?.slides ?? [];
  const activePresentationSlideDiagrams = React.useMemo(() => {
    const master = projectVisibleDiagram(presentationMasterDiagram ?? diagramData);
    return activePresentationSlides.map((slide) => applyDiagramDelta(master, slide.diagramDelta));
  }, [activePresentationSlides, presentationMasterDiagram, diagramData]);

  /** Union-fit for thumbnails: active slide uses live draft so bounds match the canvas while editing. */
  const activePresentationSlideDiagramsForThumbnailCapture = React.useMemo(() => {
    const master = projectVisibleDiagram(presentationMasterDiagram ?? diagramData);
    return activePresentationSlides.map((slide) => {
      if (
        activePresentationSlideId &&
        slide.id === activePresentationSlideId &&
        presentationDraftDiagram
      ) {
        return projectVisibleDiagram(presentationDraftDiagram);
      }
      return applyDiagramDelta(master, slide.diagramDelta);
    });
  }, [
    activePresentationSlides,
    presentationMasterDiagram,
    diagramData,
    activePresentationSlideId,
    presentationDraftDiagram,
  ]);

  /** Deck + slide ids only (stable while editing deltas) — used to re-run placeholder thumbnail backfill after file load. */
  const presentationDeckIdentityKey = React.useMemo(
    () =>
      presentationDecks
        .map((d) => `${d.id}:${d.slides.map((s) => s.id).join(',')}`)
        .join('||'),
    [presentationDecks],
  );

  React.useEffect(() => {
    if (!isPrimaryPresentationSlideActive) return;
    if (!activePresentationDeckId || activePresentationSlides.length === 0) {
      presentationPrevBaseJsonRef.current = JSON.stringify(tabDiagramData);
      return;
    }
    const nextJson = JSON.stringify(tabDiagramData);
    const prevJson = presentationPrevBaseJsonRef.current;
    if (prevJson !== null && prevJson !== nextJson) {
      try {
        const oldMaster = JSON.parse(prevJson) as DiagramData;
        const oldB = projectVisibleDiagram(oldMaster);
        const newB = projectVisibleDiagram(tabDiagramData);
        setPresentationDecks((prev) =>
          prev.map((deck) => {
            if (deck.id !== activePresentationDeckId) return deck;
            return {
              ...deck,
              slides: deck.slides.map((slide, si) => {
                if (si === 0) return slide;
                const full = applyDiagramDelta(oldB, slide.diagramDelta);
                const nextDelta = computeDiagramDelta(newB, projectVisibleDiagram(full));
                return { ...slide, diagramDelta: nextDelta };
              }),
              updatedAt: Date.now(),
            };
          }),
        );
      } catch {
        /* ignore */
      }
    }
    presentationPrevBaseJsonRef.current = nextJson;
  }, [
    tabDiagramData,
    isPrimaryPresentationSlideActive,
    activePresentationDeckId,
    activePresentationSlides.length,
  ]);

  React.useEffect(() => {
    if (!isPrimaryPresentationSlideActive) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(tabDiagramData);
    } catch {
      return;
    }
    const syncKey = `${activeTabId ?? ''}:${serialized}`;
    if (presentationMasterFromTabSyncKeyRef.current === syncKey) return;
    presentationMasterFromTabSyncKeyRef.current = syncKey;
    setPresentationMasterDiagram(safeClone(tabDiagramData));
  }, [isPrimaryPresentationSlideActive, activeTabId, tabDiagramData]);

  React.useEffect(() => {
    if (!isLoaded || !presentationStorageHydrated || !activeTabId) return;
    if (presentationDecks.length > 0 && activePresentationDeckId) return;
    const now = Date.now();
    const id = `deck-tab-${activeTabId}`;
    const primary = createPresentationPrimarySlide(id, { createdAt: now });
    const deck: PresentationDeck = {
      id,
      name: '',
      slides: [primary],
      createdAt: now,
      updatedAt: now,
    };
    setPresentationDecks([deck]);
    setActivePresentationDeckId(id);
    setActivePresentationSlideId(primary.id);
    setPresentationDraftDiagram(null);
  }, [isLoaded, presentationStorageHydrated, activeTabId, presentationDecks.length, activePresentationDeckId]);

  /** After load, coerce legacy null active slide to primary. */
  React.useEffect(() => {
    if (!activePresentationDeckId) return;
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const pid = deck?.slides[0]?.id;
    if (!pid || activePresentationSlideId !== null) return;
    setActivePresentationSlideId(pid);
  }, [activePresentationDeckId, presentationDecks, activePresentationSlideId]);

  const presentationPlayerSlides = React.useMemo(() => activePresentationSlides, [activePresentationSlides]);
  const presentationPlayerSlideDiagrams = React.useMemo(() => {
    const master = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
    return activePresentationSlides.map((slide) => applyDiagramDelta(master, slide.diagramDelta));
  }, [activePresentationSlides, presentationMasterDiagram, tabDiagramData]);

  // Refresh key to force canvas re-render
  const [canvasRefreshKey, setCanvasRefreshKey] = React.useState(0);

  /** Line shape: vertex handle click (no drag) — Delete removes this point instead of the whole node */
  const [connectorLineFocusedVertex, setConnectorLineFocusedVertex] = React.useState<{
    nodeId: string;
    vertexIndex: number;
  } | null>(null);

  React.useEffect(() => {
    setConnectorLineFocusedVertex(null);
  }, [activeTabId]);

  // Sub-diagram navigation stack: empty = root; non-empty = viewing sub-diagram
  const [activeDiagramStack, setActiveDiagramStack] = React.useState<BreadcrumbSegment[]>([]);
  
  const refreshCanvas = React.useCallback(() => {
    setCanvasRefreshKey(prev => prev + 1);
  }, []);



  // Helper functions to update active tab
  const setDiagramData = React.useCallback((updater: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    if (!activeTabId) return;
    const newData = typeof updater === 'function' ? updater(diagramData) : updater;
    const connections = newData.connections || [];
    const needsIds = connections.some((c: DiagramConnectionData) => !(c as DiagramConnectionData).id);
    const ensuredConnections = needsIds ? ensureConnectionIds(connections) : connections;
    const nextData = { ...newData, connections: ensuredConnections };

    if (
      activePresentationPrimarySlideId &&
      activePresentationSlideId &&
      activePresentationSlideId !== activePresentationPrimarySlideId
    ) {
      setPresentationDraftDiagram(nextData);
      updateActiveTab({ hasUnsavedPresentations: true });
      return;
    }

    updateActiveTab({ diagramData: nextData });
  }, [
    activeTabId,
    diagramData,
    activePresentationSlideId,
    activePresentationPrimarySlideId,
    updateActiveTab,
  ]);

  // Current diagram (root or sub) and its setter - traverses full stack for nested sub-diagrams
  const currentDiagramData = React.useMemo(() => {
    return getDiagramAtStack(diagramData, activeDiagramStack);
  }, [diagramData, activeDiagramStack]);

  const setCurrentDiagramData = React.useCallback((updater: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    if (activeDiagramStack.length === 0) {
      setDiagramData(updater);
      return;
    }
    setDiagramData((prev) => {
      const current = getDiagramAtStack(prev, activeDiagramStack);
      const next = typeof updater === 'function' ? updater(current) : updater;
      return updateDiagramAtStack(prev, activeDiagramStack, () => next);
    });
  }, [activeDiagramStack, setDiagramData]);

  const setSelectedItem = React.useCallback((updater: SelectedItem | null | ((prev: SelectedItem | null) => SelectedItem | null)) => {
    if (!activeTabId) return;
    const newItem = typeof updater === 'function' ? updater(selectedItem) : updater;
    updateActiveTab({ selectedItem: newItem });
  }, [activeTabId, selectedItem, updateActiveTab]);

  const selectedItemForSyncRef = React.useRef(selectedItem);
  selectedItemForSyncRef.current = selectedItem;
  const setSelectedItemForSyncRef = React.useRef(setSelectedItem);
  setSelectedItemForSyncRef.current = setSelectedItem;

  /**
   * Keep selectedItem geometry in sync with the diagram after drag/resize (diagram updates first).
   * Otherwise toolbar handlers that spread `selectedItem` (e.g. visual styling) can re-apply stale x/y.
   *
   * Depends only on `currentDiagramData`: do not list `selectedItem` or `setSelectedItem` (the latter
   * changes identity when selection changes and would retrigger this effect → max update depth).
   */
  React.useEffect(() => {
    const selectedItem = selectedItemForSyncRef.current;
    const setSelectedItem = setSelectedItemForSyncRef.current;
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const id = selectedItem.id;

    const lineEndpointsMatch = (a: DiagramNodeData, b: DiagramNodeData) =>
      JSON.stringify((a as any).startPos) === JSON.stringify((b as any).startPos) &&
      JSON.stringify((a as any).endPos) === JSON.stringify((b as any).endPos);

    const rot = (o: unknown) => (typeof o === 'number' && Number.isFinite(o) ? o : 0);

    if (selectedItem.itemType === 'node') {
      const node = currentDiagramData.nodes.find((n) => n.id === id);
      if (node) {
        setSelectedItem((prev) => {
          if (!prev || prev.id !== id || prev.itemType !== 'node') return prev;
          const s = prev as DiagramNodeData & { itemType: 'node' };
          if (
            node.x === s.x &&
            node.y === s.y &&
            node.width === s.width &&
            node.height === s.height &&
            rot((node as any).rotation) === rot((s as any).rotation) &&
            lineEndpointsMatch(node, s)
          ) {
            return prev;
          }
          return { ...node, itemType: 'node' as const };
        });
        return;
      }
      const zone = currentDiagramData.zones?.find((z) => z.id === id);
      if (zone) {
        setSelectedItem((prev) => {
          if (!prev || prev.id !== id || prev.itemType !== 'node') return prev;
          const s = prev as DiagramZoneData & { itemType: 'node' };
          if (
            zone.x === s.x &&
            zone.y === s.y &&
            zone.width === s.width &&
            zone.height === s.height &&
            rot((zone as any).rotation) === rot((s as any).rotation)
          ) {
            return prev;
          }
          return { ...zone, itemType: 'node' as const } as SelectedItem;
        });
      }
      return;
    }
  }, [currentDiagramData]);

  // Initialize layers system (uses current diagram - root or sub)
  const layers = useLayers({
    diagramData: currentDiagramData,
    setDiagramData: setCurrentDiagramData,
    toast
  });

  // Layer show/hide animations (Options menu toggle, default enabled)
  const layerAnimation = useLayerAnimation(
    layerAnimationsEnabled,
    layers.filteredDiagramData ?? currentDiagramData,
    layers.layersConfig,
  );

  React.useEffect(() => {
    layerAnimation.updateSnapshot(currentDiagramData);
  }, [currentDiagramData, layerAnimation.updateSnapshot]);

  const handleToggleLayerVisibility = React.useCallback(
    (layerId: string) => {
      if (!layerAnimation.onLayerVisibilityWillChange(layerId)) return;
      layers.toggleLayerVisibilityById(layerId);
    },
    [layerAnimation.onLayerVisibilityWillChange, layers.toggleLayerVisibilityById],
  );

  const displayDiagramData = layerAnimation.animatingDiagramData ?? layers.filteredDiagramData ?? currentDiagramData;

  const diagramDataForExportLayersRef = React.useRef<DiagramData>(currentDiagramData);
  diagramDataForExportLayersRef.current = layers.filteredDiagramData ?? currentDiagramData;

  React.useEffect(() => {
    presentationPrevBaseJsonRef.current = null;
    presentationMasterFromTabSyncKeyRef.current = null;
    if (!activeTabId) {
      setPresentationDecks([]);
      setActivePresentationDeckId(null);
      setActivePresentationSlideId(null);
      setSelectedPresentationSlideIds(new Set());
      setPresentationMasterDiagram(null);
      setPresentationDraftDiagram(null);
      setActiveDiagramStack([]);
      lastRestoredStackRef.current = null;
      return;
    }
    setActiveDiagramStack([]);

    const scoped = presentationStateByTabRef.current[activeTabId];
    if (!scoped) {
      setPresentationDecks([]);
      setActivePresentationDeckId(null);
      setActivePresentationSlideId(null);
      setSelectedPresentationSlideIds(new Set());
      setPresentationMasterDiagram(null);
      setPresentationDraftDiagram(null);
      return;
    }

    setPresentationDecks(scoped.decks);
    setActivePresentationDeckId(scoped.activeDeckId);
    const tabDeck =
      scoped.decks.find((d) => d.id === scoped.activeDeckId) ?? scoped.decks[0];
    const tabPrimaryId = tabDeck?.slides[0]?.id ?? null;
    setActivePresentationSlideId(scoped.activeSlideId ?? tabPrimaryId);
    setSelectedPresentationSlideIds(new Set(scoped.selectedSlideIds));
    setPresentationMasterDiagram(scoped.masterDiagram);
    setPresentationDraftDiagram(scoped.draftDiagram);
  }, [activeTabId]);

  React.useEffect(() => {
    if (!activeTabId) return;
    presentationStateByTabRef.current[activeTabId] = {
      decks: presentationDecks,
      activeDeckId: activePresentationDeckId,
      activeSlideId: activePresentationSlideId,
      selectedSlideIds: Array.from(selectedPresentationSlideIds),
      masterDiagram: presentationMasterDiagram,
      draftDiagram: presentationDraftDiagram,
    };
  }, [
    activeTabId,
    presentationDecks,
    activePresentationDeckId,
    activePresentationSlideId,
    selectedPresentationSlideIds,
    presentationMasterDiagram,
    presentationDraftDiagram,
  ]);

  // Persist presentations for all tabs whenever per-tab state changes (debounced 600 ms).
  // Keep this effect after ref sync so writes always include latest tab state.
  React.useEffect(() => {
    if (!isLoaded || !presentationStorageHydrated || !activeTabId) return;
    if (presentationPersistTimeoutRef.current) {
      clearTimeout(presentationPersistTimeoutRef.current);
    }

    presentationPersistTimeoutRef.current = setTimeout(() => {
      presentationPersistTimeoutRef.current = null;
      const liveTabIds = new Set(tabs.map((tab) => tab.id));
      const snapshot: Record<string, { decks: PresentationDeck[]; activeDeckId: string | null; activeSlideId?: string | null }> = {};
      for (const [tabId, state] of Object.entries(presentationStateByTabRef.current)) {
        if (liveTabIds.has(tabId) && state.decks.length > 0) {
          snapshot[tabId] = {
            decks: state.decks,
            activeDeckId: state.activeDeckId,
            activeSlideId: state.activeSlideId ?? undefined,
          };
        }
      }
      savePresentationsByTab(snapshot).catch(() => { /* silent */ });
    }, 600);

    return () => {
      if (presentationPersistTimeoutRef.current) {
        clearTimeout(presentationPersistTimeoutRef.current);
        presentationPersistTimeoutRef.current = null;
      }
    };
  }, [
    activeTabId,
    isLoaded,
    presentationStorageHydrated,
    presentationDecks,
    activePresentationDeckId,
    activePresentationSlideId,
    selectedPresentationSlideIds,
    presentationMasterDiagram,
    presentationDraftDiagram,
    tabs,
  ]);

  // When animation toggle-on-click mode is on: show animations only for selected node's chain. Nothing selected = no animations.
  const effectiveAnimationFilterIds = React.useMemo(() => {
    if (!animationToggleOnClickEnabled || !animationConnectionsEnabled) return undefined;
    const displayData = layers.filteredDiagramData ?? diagramData;
    const connections = displayData?.connections ?? [];
    if (selectedItem?.itemType === 'node' && selectedItem?.id && connections.length > 0) {
      return getDownstreamAnimationChainNodes(selectedItem.id, connections);
    }
    return new Set<string>(); // Empty set = no animations when nothing selected
  }, [animationToggleOnClickEnabled, animationConnectionsEnabled, selectedItem, layers.filteredDiagramData, diagramData]);

  const setSelectedItemIds = React.useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (!activeTabId) return;
    const newIds = typeof updater === 'function' ? updater(selectedItemIds) : updater;
    updateActiveTab({ selectedItemIds: newIds });
    
    // Update active layer based on selection
    layers.updateActiveLayerFromSelection(newIds);
  }, [activeTabId, selectedItemIds, updateActiveTab, layers]);

  const setIsConnectMode = React.useCallback((mode: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ isConnectMode: mode });
  }, [activeTabId, updateActiveTab]);

  const setJsonPanelOpen = React.useCallback((open: boolean) => {
    if (!activeTabId) return;
    updateActiveTab({ jsonPanelOpen: open });
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(open));
    }
  }, [activeTabId, updateActiveTab, isClient]);

  const viewStatePersistRef = useRef<{ x: number; y: number; k: number } | null>(null);
  const viewStatePersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const VIEW_STATE_DEBOUNCE_MS = 400;

  const setCanvasTransform = React.useCallback((transform: { x: number; y: number; k: number }) => {
    if (!activeTabId) return;
    const sanitized = sanitizeCanvasTransform(transform);
    updateActiveTab({ canvasTransform: sanitized });

    if (isPrimaryPresentationSlideActive) {
      viewStatePersistRef.current = sanitized;
      if (viewStatePersistTimeoutRef.current) clearTimeout(viewStatePersistTimeoutRef.current);
      viewStatePersistTimeoutRef.current = setTimeout(() => {
        viewStatePersistTimeoutRef.current = null;
        const toPersist = viewStatePersistRef.current;
        if (!toPersist) return;
        const vs = sanitizeViewState(toPersist);
        if (!vs) return;
        setDiagramData((prev) => {
          const current = getDiagramAtStack(prev, activeDiagramStack);
          return updateDiagramAtStack(prev, activeDiagramStack, () => ({
            ...current,
            viewState: vs,
          }));
        });
      }, VIEW_STATE_DEBOUNCE_MS);
    }
  }, [
    activeTabId,
    updateActiveTab,
    sanitizeCanvasTransform,
    isPrimaryPresentationSlideActive,
    activeDiagramStack,
    setDiagramData,
  ]);

  React.useLayoutEffect(() => {
    if (!activeTabId) {
      prevPresentationSlideIdForViewportRef.current = null;
      return;
    }
    if (!activePresentationDeckId || !activePresentationSlideId) {
      prevPresentationSlideIdForViewportRef.current = null;
      return;
    }

    const prevSlideId = prevPresentationSlideIdForViewportRef.current;
    if (prevSlideId === activePresentationSlideId) {
      return;
    }

    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const slide = deck?.slides.find((s) => s.id === activePresentationSlideId);
    if (!deck || !slide) {
      return;
    }

    if (prevSlideId && prevSlideId !== activePresentationSlideId) {
      const c = canvasTransformRef.current;
      setPresentationDecks((prevDecks) =>
        prevDecks.map((d) => {
          if (d.id !== activePresentationDeckId) return d;
          return {
            ...d,
            slides: d.slides.map((s) =>
              s.id === prevSlideId
                ? { ...s, autoZoomLevel: c.k, viewPanX: c.x, viewPanY: c.y }
                : s
            ),
            updatedAt: Date.now(),
          };
        })
      );
    }

    const masterBase = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
    const diagramForSlide = pruneConnectionsToVisibleNodes(applyDiagramDelta(masterBase, slide.diagramDelta));
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
    const t = computeSlidePlaybackTransform(slide, diagramForSlide, vw, vh);
    if (t) {
      setCanvasTransform(t);
      canvasTransformRef.current = sanitizeCanvasTransform(t);
    }

    prevPresentationSlideIdForViewportRef.current = activePresentationSlideId;
  }, [
    activeTabId,
    activePresentationDeckId,
    activePresentationSlideId,
    presentationDecks,
    presentationMasterDiagram,
    tabDiagramData,
    setCanvasTransform,
    sanitizeCanvasTransform,
  ]);

  React.useEffect(() => {
    return () => {
      if (viewStatePersistTimeoutRef.current) {
        clearTimeout(viewStatePersistTimeoutRef.current);
        viewStatePersistTimeoutRef.current = null;
      }
    };
  }, []);

  const setHistory = React.useCallback((newHistory: string[]) => {
    if (!activeTabId) return;
    updateActiveTab({ history: newHistory });
    setHistoryRef(activeTabId, { history: newHistory, index: historyIndex });
  }, [activeTabId, historyIndex, updateActiveTab, setHistoryRef]);

  const setHistoryIndex = React.useCallback((index: number) => {
    if (!activeTabId) return;
    updateActiveTab({ historyIndex: index });
    const currentHistory = historyRef.current.history;
    setHistoryRef(activeTabId, { history: currentHistory, index });
  }, [activeTabId, updateActiveTab, setHistoryRef]);

  // Update historyRef when active tab changes
  React.useEffect(() => {
    if (activeTabId && activeTab) {
      historyRef.current = getHistoryRef(activeTabId) || { history: activeTab.history, index: activeTab.historyIndex };
    }
  }, [activeTabId, activeTab, getHistoryRef]);

  // Debounced history update to prevent excessive processing during rapid changes
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const updateHistory = useCallback(() => {
    if (!activeTabId || !activeTab) return;
    
    // Skip history updates during dragging
    if (isDragging) {
      return;
    }
    
    const jsonString = JSON.stringify(diagramData);
    
    // Skip if this is same as last history entry (but not on initial load)
    if (historyRef.current.history.length > 1 && historyRef.current.history[historyRef.current.index] === jsonString) {
      return;
    }
    
    // Update history using ref for immediate access
    const currentHistory = historyRef.current.history.slice(0, historyRef.current.index + 1);
    currentHistory.push(jsonString);
    
    // Keep only last 20 states
    if (currentHistory.length > 20) {
      currentHistory.shift();
    }
    
    const newIndex = currentHistory.length - 1;
    
    // Update ref
    historyRef.current = { history: currentHistory, index: newIndex };
    
    // Update tab state
    updateActiveTab({ history: currentHistory, historyIndex: newIndex });
    setHistoryRef(activeTabId, historyRef.current);
  }, [diagramData, isDragging, activeTabId, activeTab, updateActiveTab, setHistoryRef]);

  // Watch diagramData changes and update history with debouncing
  React.useEffect(() => {
    // Clear existing timeout
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    
    // Skip history updates during dragging to prevent performance issues
    if (isDragging) {
      return;
    }
    
    // Debounce history updates to 300ms
    historyTimeoutRef.current = setTimeout(() => {
      updateHistory();
    }, 300);
    
    // Cleanup timeout on unmount
    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [diagramData, updateHistory, isDragging]);

  const undo = React.useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef]);

  const redo = React.useCallback(() => {
    if (!activeTabId) return;
    const { history: currentHistory, index: currentIndex } = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      const newIndex = currentIndex + 1;
      historyRef.current.index = newIndex;
      setHistoryIndex(newIndex);
      const newDiagramData = JSON.parse(currentHistory[newIndex]);
      setDiagramData(newDiagramData);
      setSelectedItem(null);
      setHistoryRef(activeTabId, historyRef.current);
    }
  }, [activeTabId, setHistoryIndex, setDiagramData, setSelectedItem, setHistoryRef]);

  // Initialize client-side state after hydration
  React.useEffect(() => {
    setIsClient(true);
    const savedWidth = localStorage.getItem('dw:jsonEditor:width');
    if (savedWidth !== null) {
      const parsed = parseInt(savedWidth, 10);
      if (!Number.isNaN(parsed) && parsed >= 280) {
        setJsonPanelWidth(Math.min(parsed, Math.max(300, window.innerWidth * 0.5)));
      }
    }
    // Load icon background preference
    const savedIconBackground = localStorage.getItem('dw:iconBackground:enabled');
    if (savedIconBackground !== null) {
      setIconBackgroundEnabled(savedIconBackground === 'true');
    }
    const savedDefaultTextLabels = localStorage.getItem('dw:defaultTextLabels:enabled');
    if (savedDefaultTextLabels !== null) {
      setDefaultTextLabelsEnabled(savedDefaultTextLabels === 'true');
    }
  }, []);

  // Handle body scroll lock when mobile sidebar is open
  React.useEffect(() => {
    if (isMobile) {
      if (sidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [sidebarOpen, isMobile]);

  const handleItemSelect = React.useCallback((item: SelectedItem | null, shiftKey = false) => {
    setConnectorLineFocusedVertex(null);

    if (isConnectMode && !item) {
      setIsConnectMode(false);
    }

    if (!item && animationToggleOnClickEnabled) {
      setAnimationDisabledSources(new Set());
    }

    const diagramForSelectionKind = currentDiagramData;

    if (shiftKey && item) {
      const itemKind = item.itemType === "edge" ? "edge" : "object";
      const mergedForAnchor = new Set(selectedItemIds);
      if (selectedItem?.id) {
        mergedForAnchor.add(selectedItem.id);
      }
      const anchorOrdered = Array.from(mergedForAnchor);
      if (anchorOrdered.length > 0) {
        const anchorKind = getSelectionIdKind(anchorOrdered[0], diagramForSelectionKind);
        if (anchorKind !== "unknown" && anchorKind !== itemKind) {
          return;
        }
      }

      setSelectedItemIds((prev) => {
        const newSet = new Set(prev);

        // Preserve the currently selected item when entering additive selection
        // from flows where selectedItemIds may not yet include selectedItem.
        if (selectedItem?.id) {
          newSet.add(selectedItem.id);
        }

        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
      setSelectedItem(item);
    } else {
      // Plain click on an item already in a multi-selection: primary only, keep the set.
      // Use canonical connection matching (uuid vs from-to-index in the set).
      let preserveMulti = false;
      if (item && !shiftKey && selectedItemIds.size > 1 && item.itemType === 'edge') {
        const conns = (displayDiagramData.connections ?? []) as DiagramConnectionData[];
        for (let i = 0; i < conns.length; i++) {
          if (!connectionSelectionIdMatches(item.id, conns[i], i, conns)) continue;
          preserveMulti = selectionSetContainsConnection(selectedItemIds, conns[i], i, conns);
          break;
        }
      }

      if (preserveMulti) {
        setSelectedItem(item);
      } else {
        setSelectedItem(item);

        if (item) {
          setSelectedItemIds(new Set([item.id]));
        } else {
          setSelectedItemIds(new Set());
        }
      }
    }
  }, [
    currentDiagramData,
    displayDiagramData,
    isConnectMode,
    animationToggleOnClickEnabled,
    selectedItem,
    selectedItemIds,
    setIsConnectMode,
    setAnimationDisabledSources,
    setSelectedItem,
    setSelectedItemIds,
  ]);

  const handleConnectorLineVertexFocus = React.useCallback(
    (nodeId: string, vertexIndex: number) => {
      const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
      if (!node || !isConnectorLineNodeType(node.type)) return;
      setSelectedItem({ ...node, itemType: 'node' });
      setSelectedItemIds(new Set([nodeId]));
      setConnectorLineFocusedVertex({ nodeId, vertexIndex });
    },
    [currentDiagramData, setSelectedItem, setSelectedItemIds, setConnectorLineFocusedVertex],
  );

  const handleBatchSelect = React.useCallback((itemIds: string[]) => {
    setConnectorLineFocusedVertex(null);
    if (itemIds.length === 0) {
      setSelectedItem(null);
      setSelectedItemIds(new Set());
      if (animationToggleOnClickEnabled) setAnimationDisabledSources(new Set());
      return;
    }

    // Same graph the canvas / marquee use (current sub-diagram + visible layers + animation snapshot)
    const dataForHits = displayDiagramData;

    const items: SelectedItem[] = [];
    const resolvedIds: string[] = [];

    for (const id of itemIds) {
      const node = dataForHits.nodes.find((n) => n.id === id);
      if (node) {
        resolvedIds.push(node.id);
        items.push({ ...node, itemType: "node" as const });
        continue;
      }

      const zone = dataForHits.zones?.find((z) => z.id === id);
      if (zone) {
        resolvedIds.push(zone.id);
        items.push({ ...(zone as any), itemType: "node" as const, id: zone.id } as SelectedItem);
        continue;
      }

      const idxBySynthetic = (dataForHits.connections ?? []).findIndex(
        (conn, idx) =>
          (conn as DiagramConnectionData).id === id || `${conn.from}-${conn.to}-${idx}` === id
      );
      let connection =
        idxBySynthetic >= 0 ? dataForHits.connections![idxBySynthetic] : undefined;
      if (!connection) {
        const legacy = (dataForHits.connections ?? []).filter((conn) => `${conn.from}-${conn.to}` === id);
        connection = legacy.length === 1 ? legacy[0] : undefined;
      }
      if (connection) {
        const cIdx = (dataForHits.connections ?? []).indexOf(connection);
        const connId =
          (connection as DiagramConnectionData).id ??
          `${connection.from}-${connection.to}-${Math.max(0, cIdx)}`;
        resolvedIds.push(connId);
        items.push({ ...connection, itemType: "edge" as const, id: connId });
      }
    }

    if (items.length > 0) {
      setSelectedItem(items[0]);
      setSelectedItemIds(new Set(resolvedIds));
    }
  }, [setSelectedItem, setSelectedItemIds, animationToggleOnClickEnabled, setAnimationDisabledSources, displayDiagramData, setConnectorLineFocusedVertex]);
  
  const handleItemUpdate = React.useCallback((updatedItem: SelectedItem) => {
    if (updatedItem.itemType === 'edge') return;
    setCurrentDiagramData(prevData => {
            // Find the existing node to preserve its properties
            const existingNode = prevData.nodes.find(n => n.id === updatedItem.id);

            if (existingNode) {
              const mergedNode = { ...existingNode } as DiagramNodeData;
              Object.keys(updatedItem).forEach(key => {
                  if (key !== 'itemType' && key !== 'id') {
                      const value = (updatedItem as any)[key];
                      if (value !== undefined) {
                          (mergedNode as any)[key] = value;
                      }
                  }
              });
              return {
                  ...prevData,
                  nodes: prevData.nodes.map(n => n.id === updatedItem.id ? mergedNode : n)
              };
            }

            const zones = prevData.zones || [];
            const zi = zones.findIndex(z => z.id === updatedItem.id);
            if (zi >= 0) {
              const existingZone = zones[zi];
              const mergedZone = { ...existingZone } as DiagramZoneData;
              Object.keys(updatedItem).forEach(key => {
                if (key !== 'itemType' && key !== 'id') {
                  const value = (updatedItem as any)[key];
                  if (value !== undefined) {
                    (mergedZone as any)[key] = value;
                  }
                }
              });
              const nextZones = [...zones];
              nextZones[zi] = mergedZone;
              return { ...prevData, zones: nextZones };
            }

            return prevData;
    });

    // Also update the selected item state if it's the one being edited
    if (selectedItem?.id === updatedItem.id) {
        setSelectedItem(updatedItem);
    }
  }, [selectedItem, setCurrentDiagramData, setSelectedItem]);

  /** Apply tag, description (`info`), and/or plain toolbar **label** to every selected node and zone (multi-select). */
  const handleBulkMetadataUpdate = React.useCallback(
    (patch: { tag?: string; info?: string; label?: string }) => {
      if (selectedItemIds.size < 2) return;
      const hasTag = 'tag' in patch;
      const hasInfo = 'info' in patch;
      const hasLabel = 'label' in patch;
      if (!hasTag && !hasInfo && !hasLabel) return;

      setCurrentDiagramData((prevData) => ({
        ...prevData,
        nodes: prevData.nodes.map((n) => {
          if (!selectedItemIds.has(n.id)) return n;
          let next = n;
          if (hasTag) next = { ...next, tag: patch.tag };
          if (hasInfo) next = { ...next, info: patch.info };
          if (hasLabel) {
            const isPlainTextNode =
              n.type === 'generic.text.textbox' || n.type === 'generic.text.text';
            next = {
              ...next,
              label: patch.label,
              ...(isPlainTextNode ? { richLabel: undefined } : {}),
            };
          }
          return next;
        }),
        zones: (prevData.zones || []).map((z) => {
          if (!selectedItemIds.has(z.id)) return z;
          let next = z;
          if (hasTag) next = { ...next, tag: patch.tag };
          if (hasInfo) next = { ...next, info: patch.info };
          if (hasLabel) next = { ...next, label: patch.label };
          return next;
        }),
      }));

      if (
        selectedItem?.itemType === 'node' &&
        selectedItemIds.has(selectedItem.id)
      ) {
        let nextSel = selectedItem as SelectedItem;
        if (hasTag) nextSel = { ...nextSel, tag: patch.tag } as SelectedItem;
        if (hasInfo) nextSel = { ...nextSel, info: patch.info } as SelectedItem;
        if (hasLabel) {
          const t = (nextSel as { type?: string }).type;
          const isPlainTextNode =
            t === 'generic.text.textbox' || t === 'generic.text.text';
          nextSel = {
            ...nextSel,
            label: patch.label,
            ...(isPlainTextNode ? { richLabel: undefined } : {}),
          } as SelectedItem;
        }
        setSelectedItem(nextSel);
      }
    },
    [selectedItem, selectedItemIds, setCurrentDiagramData, setSelectedItem],
  );

  const handleLabelUpdate = React.useCallback((nodeId: string, newLabel: string, richLabel?: import("@/lib/types").RichTextRun[]) => {
    React.startTransition(() => {
      setCurrentDiagramData(prevData => {
        const propagateToSelection =
          selectedItemIds.size > 1 && selectedItemIds.has(nodeId);
        const targetIds: Set<string> = propagateToSelection
          ? new Set(
              [...selectedItemIds].filter((id) =>
                prevData.nodes.some((n) => n.id === id),
              ),
            )
          : new Set([nodeId]);

        return {
          ...prevData,
          nodes: prevData.nodes.map((n) =>
            targetIds.has(n.id)
              ? { ...n, label: newLabel, richLabel: richLabel ?? undefined }
              : n,
          ),
        };
      });

      const propagateToSelection =
        selectedItemIds.size > 1 && selectedItemIds.has(nodeId);
      if (
        selectedItem?.itemType === 'node' &&
        selectedItemIds.has(selectedItem.id) &&
        (selectedItem.id === nodeId || propagateToSelection)
      ) {
        if (richLabel !== undefined) {
          setSelectedItem({ ...selectedItem, label: newLabel, richLabel });
        } else if (propagateToSelection) {
          setSelectedItem({ ...selectedItem, label: newLabel, richLabel: undefined });
        } else {
          setSelectedItem({ ...selectedItem, label: newLabel });
        }
      }
    });
  }, [selectedItem, selectedItemIds, setCurrentDiagramData, setSelectedItem]);

  const handleTagUpdate = React.useCallback((nodeId: string, newTag: string) => {
    const propagateToSelection =
      selectedItemIds.size > 1 && selectedItemIds.has(nodeId);
    const targetIds: Set<string> = propagateToSelection
      ? new Set([...selectedItemIds])
      : new Set([nodeId]);

    setCurrentDiagramData((prevData) => ({
      ...prevData,
      nodes: prevData.nodes.map((n) =>
        targetIds.has(n.id) ? { ...n, tag: newTag } : n,
      ),
      zones: (prevData.zones || []).map((z) =>
        targetIds.has(z.id) ? { ...z, tag: newTag } : z,
      ),
    }));

    if (
      selectedItem?.itemType === 'node' &&
      selectedItemIds.has(selectedItem.id) &&
      (selectedItem.id === nodeId || propagateToSelection)
    ) {
      setSelectedItem({ ...selectedItem, tag: newTag });
    }
  }, [selectedItem, selectedItemIds, setCurrentDiagramData, setSelectedItem]);

  const handleResourceSelect = (resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions }, provider: string, category: string) => {
    // Track the currently selected resource from the sidebar for copy/paste
    setSelectedResource({ resource, provider, category });
    console.log('Resource selected:', { resource, provider, category });
  };

  const handleResourceActivate = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions },
    provider: string,
    category: string,
    fullItem?: { type: string; label: string; provider: string; category: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions }
  ) => {
    const item = fullItem ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item);
    }
  };

  const handleResourceActivateAtPosition = (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions },
    provider: string,
    category: string,
    position: { x: number; y: number },
    fullItem?: object
  ) => {
    const item = (fullItem as { type: string; label: string; provider: string; category: string }) ?? createPaletteItem(resource as PaletteResource, provider, category);
    setSelectedResource({ resource, provider, category });
    setPaletteClipboardItem(item);
    if (editorRef.current) {
      editorRef.current.pastePaletteItem(item, position);
    }
  };

  const handleGroupItems = React.useCallback(() => {
    if (selectedItemIds.size < 2) {
      toast({
        variant: 'destructive',
        title: 'Cannot Group',
        description: 'Select at least 2 items to create a group.'
      });
      return;
    }

    try {
      const updatedData = createGroup(Array.from(selectedItemIds), currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Items Grouped',
        description: `Created group with ${selectedItemIds.size} items.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Group Failed',
        description: error instanceof Error ? error.message : 'Failed to create group.'
      });
    }
  }, [selectedItemIds, currentDiagramData, setCurrentDiagramData, toast]);

  const handleUngroupItems = React.useCallback(() => {
    if (!selectedItem) return;

    const group = getItemGroup(selectedItem.id, currentDiagramData);
    if (!group) {
      toast({
        variant: 'destructive',
        title: 'Not Grouped',
        description: 'Selected item is not in a group.'
      });
      return;
    }

    try {
      const updatedData = ungroup(group.id, currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Items Ungrouped',
        description: 'Group has been dissolved.'
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ungroup Failed',
        description: error instanceof Error ? error.message : 'Failed to ungroup items.'
      });
    }
  }, [selectedItem, currentDiagramData, setCurrentDiagramData, toast]);

  const handleRemoveFromGroup = React.useCallback(() => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = removeFromGroup(Array.from(selectedItemIds), currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Removed from Group',
        description: `${selectedItemIds.size} item(s) removed from group.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Remove Failed',
        description: error instanceof Error ? error.message : 'Failed to remove from group.'
      });
    }
  }, [selectedItemIds, currentDiagramData, setCurrentDiagramData, toast]);

  const handleAddToGroup = React.useCallback((groupId: string) => {
    if (selectedItemIds.size === 0) return;

    try {
      const updatedData = addToGroup(Array.from(selectedItemIds), groupId, currentDiagramData);
      setCurrentDiagramData(updatedData);
      toast({
        title: 'Added to Group',
        description: `${selectedItemIds.size} item(s) added to group.`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Add to Group Failed',
        description: error instanceof Error ? error.message : 'Failed to add to group.'
      });
    }
  }, [selectedItemIds, currentDiagramData, setCurrentDiagramData, toast]);

  const generateSubDiagramId = React.useCallback(() => {
    const { subDiagramKeys } = collectAllIdsInDiagram(diagramData);
    let i = 1;
    while (subDiagramKeys.has(`sub-${i}`)) i++;
    return `sub-${i}`;
  }, [diagramData]);

  const handleSubDiagramDoubleClick = React.useCallback((node: DiagramNodeData) => {
    if (!node.subDiagramId) return;
    const subId = node.subDiagramId;
    setDiagramData((prev) => {
      const current = getDiagramAtStack(prev, activeDiagramStack);
      if (current.subDiagrams?.[subId]) return prev;
      // Sub not at current level: use blank or migrate from root (legacy storage)
      const atRoot = prev.subDiagrams?.[subId];
      const content = atRoot ?? { nodes: [], connections: [] };
      if (atRoot && activeDiagramStack.length > 0) {
        const { [subId]: _, ...restRoot } = prev.subDiagrams || {};
        const withoutAtRoot = { ...prev, subDiagrams: Object.keys(restRoot).length ? restRoot : undefined };
        return addSubDiagramAtStack(withoutAtRoot, activeDiagramStack, subId, content);
      }
      return addSubDiagramAtStack(prev, activeDiagramStack, subId, content);
    });
    setActiveDiagramStack((s) => [...s, { diagramId: subId, fromNodeId: node.id, fromNodeLabel: node.label || 'Sub-diagram' }]);
    setSelectedItem(null);
  }, [activeDiagramStack, setDiagramData]);

  const handleBreadcrumbNavigate = React.useCallback((index: number) => {
    setActiveDiagramStack((s) => s.slice(0, index));
    setSelectedItem(null);
  }, []);

  const handleBreadcrumbSegmentRename = React.useCallback(
    (segmentIndex: number, newLabel: string) => {
      if (segmentIndex < 1) return;
      const seg = activeDiagramStack[segmentIndex - 1];
      if (!seg?.fromNodeId) return;
      const parentStack = activeDiagramStack.slice(0, segmentIndex - 1);
      setDiagramData((prev) =>
        updateDiagramAtStack(prev, parentStack, (current) => ({
          ...current,
          nodes: current.nodes.map((n) =>
            n.id === seg.fromNodeId ? { ...n, label: newLabel } : n
          ),
        }))
      );
      setActiveDiagramStack((s) =>
        s.map((x, i) =>
          i === segmentIndex - 1 ? { ...x, fromNodeLabel: newLabel } : x
        )
      );
    },
    [activeDiagramStack, setDiagramData]
  );

  const handleCreateSubDiagram = React.useCallback((nodeId: string) => {
    const subId = generateSubDiagramId();
    const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
    setDiagramData((prev) => {
      const withNode = updateDiagramAtStack(prev, activeDiagramStack, (current) => ({
        ...current,
        nodes: current.nodes.map((n) => (n.id === nodeId ? { ...n, subDiagramId: subId } : n)),
      }));
      return addSubDiagramAtStack(withNode, activeDiagramStack, subId, { nodes: [], connections: [] });
    });
    setActiveDiagramStack((s) => [...s, { diagramId: subId, fromNodeId: nodeId, fromNodeLabel: node?.label || 'Sub-diagram' }]);
    setSelectedItem(null);
  }, [generateSubDiagramId, currentDiagramData, activeDiagramStack, setDiagramData]);

  /** Restore viewState when navigating to a diagram; use fitToView if no saved state */
  React.useEffect(() => {
    if (!isPrimaryPresentationSlideActive) return;
    const stackKey = JSON.stringify(activeDiagramStack);
    if (lastRestoredStackRef.current === stackKey) return;
    lastRestoredStackRef.current = stackKey;

    const targetDiagram = getDiagramAtStack(diagramData, activeDiagramStack);
    const vs = sanitizeViewState(targetDiagram?.viewState);
    if (vs) {
      setCanvasTransform(vs);
    } else {
      const t = setTimeout(() => editorRef.current?.fitToView(), 100);
      return () => clearTimeout(t);
    }
  }, [activeDiagramStack, diagramData, isPrimaryPresentationSlideActive, setCanvasTransform]);

  /** True when node has subDiagramId and the sub exists (at current level or root for legacy) */
  const getHasLinkedSubDiagram = React.useCallback((node: DiagramNodeData) => {
    if (!node.subDiagramId) return false;
    const subId = node.subDiagramId;
    if (currentDiagramData.subDiagrams?.[subId]) return true;
    if (activeDiagramStack.length > 0 && diagramData.subDiagrams?.[subId]) return true;
    return false;
  }, [currentDiagramData, activeDiagramStack, diagramData]);

  const handleRemoveSubDiagramLink = React.useCallback((nodeId: string) => {
    const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
    const subId = node?.subDiagramId;
    if (!subId) return;
    setDiagramData((prev) => {
      const withoutLink = updateDiagramAtStack(prev, activeDiagramStack, (current) => ({
        ...current,
        nodes: current.nodes.map((n) => (n.id === nodeId ? { ...n, subDiagramId: undefined } : n)),
      }));
      return removeSubDiagramAtStack(withoutLink, activeDiagramStack, subId);
    });
    if (activeDiagramStack.some((s) => s.diagramId === subId)) {
      setActiveDiagramStack((s) => s.filter((seg) => seg.diagramId !== subId));
    }
    setSelectedItem(null);
  }, [currentDiagramData, activeDiagramStack, setDiagramData]);

  const handleConnect = (targetItem: DiagramNodeData) => {
    const pendingIdsRaw = (window as unknown as { pendingConnectionSourceIds?: string[] }).pendingConnectionSourceIds;
    const pendingSingle = (window as unknown as { pendingConnectionSourceId?: string }).pendingConnectionSourceId;
    let sourceIds: string[] = Array.isArray(pendingIdsRaw) && pendingIdsRaw.length > 0
      ? pendingIdsRaw
      : pendingSingle
        ? [pendingSingle]
        : selectedItem?.itemType === 'node'
          ? [selectedItem.id]
          : [];

    const seen = new Set<string>();
    sourceIds = sourceIds.filter((id) => {
      if (!id || id === targetItem.id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (!isConnectMode || sourceIds.length === 0) {
      clearPendingConnectionWindowState();
      setIsConnectMode(false);
      return;
    }

    if (isConnectorLineNodeType(targetItem.type)) {
      return;
    }

    const connectionOptions = (window as unknown as { pendingConnectionOptions?: { style?: string; curvature?: number } }).pendingConnectionOptions || {};

    clearPendingConnectionWindowState();

    const connStyle: DiagramConnectionData['style'] =
      connectionOptions.style === 'orthogonal' ? 'orthogonal' : 'bezier';
    const connCurvature = connStyle === 'bezier' ? (connectionOptions.curvature ?? 0.5) : undefined;

    const newConnections: DiagramConnectionData[] = sourceIds.map((fromId) => ({
      id: generateConnectionId(),
      from: fromId,
      to: targetItem.id,
      style: connStyle,
      curvature: connCurvature,
      animation: toConnectionAnimationPatch(DEFAULT_CONNECTION_ANIMATION),
    }));

    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: [...prevData.connections, ...newConnections],
    }));

    setIsConnectMode(false);
    setSelectedItem(null); // Deselect after connecting
  };

  const startConnecting = (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number; sourceItemId?: string }) => {
    let sourceIds: string[];
    if (connectionOptions?.sourceItemId) {
      sourceIds = [connectionOptions.sourceItemId];
    } else {
      sourceIds = collectConnectSourceIdsFromDiagram(selectedItemIds, currentDiagramData);
      if (sourceIds.length === 0 && selectedItem?.itemType === 'node') {
        sourceIds = [selectedItem.id];
      }
    }

    if (sourceIds.length === 0) return;

    setIsConnectMode(true);
    (window as unknown as { pendingConnectionSourceIds: string[] }).pendingConnectionSourceIds = sourceIds;
    (window as unknown as { pendingConnectionOptions?: unknown }).pendingConnectionOptions = connectionOptions;
  }

  const getLayerNameById = React.useCallback((layerId: string): string => {
    return layers.layersConfig.layers.find((layer) => layer.id === layerId)?.name || layerId;
  }, [layers.layersConfig.layers]);

  const getAffectedLayerIdsForConnection = React.useCallback((from: string, to: string): string[] => {
    const ids = new Set<string>();
    const source = currentDiagramData;
    const fromNode = source.nodes.find((n) => n.id === from);
    const toNode = source.nodes.find((n) => n.id === to);
    if (fromNode?.layer) ids.add(fromNode.layer);
    if (toNode?.layer) ids.add(toNode.layer);
    return Array.from(ids);
  }, [currentDiagramData]);

  const confirmPresentationLayerImpact = React.useCallback((actionLabel: string, layerIds: string[]): boolean => {
    if (layerIds.length === 0) return true;

    const uniqueLayerIds = Array.from(new Set(layerIds));
    const layerNames = uniqueLayerIds.map((id) => getLayerNameById(id));
    const confirmed = window.confirm(
      `${actionLabel} is assigned to layer(s): ${layerNames.join(', ')}. ` +
      `This will disable layer functions for the affected layer(s) in Presentation Mode only. Continue?`
    );
    if (!confirmed) return false;

    setPresentationDisabledLayerIds((prev) => {
      const next = new Set(prev);
      uniqueLayerIds.forEach((id) => next.add(id));
      return next;
    });
    return true;
  }, [getLayerNameById]);

  const tryDeleteConnectorLineVertexBeforeNodeDelete = React.useCallback(
    (nodeId: string): boolean => {
      const f = connectorLineFocusedVertex;
      if (!f || f.nodeId !== nodeId) return false;
      const node = currentDiagramData.nodes.find((n) => n.id === nodeId);
      if (!node || !isConnectorLineNodeType(node.type)) return false;
      const wasClosed = isConnectorLineGeometryClosed(node);
      const nextGeom = removeConnectorLineVertexAtIndex(node, f.vertexIndex);
      if (!nextGeom) return false;
      const layerId = node.layer || layers.getItemLayerById(nodeId);
      if (!confirmPresentationLayerImpact('The selected item', layerId ? [layerId] : [])) return true;
      const isNowClosed = isConnectorLineGeometryClosed(nextGeom);
      let synced = nextGeom;
      if (isNowClosed) {
        synced = syncClosedConnectorLineBorderWidth(synced);
        if (!wasClosed && isNowClosed) {
          synced = syncClosedConnectorVisualBorderFromLineStyling(synced);
        }
      }
      setCurrentDiagramData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === synced.id ? synced : n)),
      }));
      setConnectorLineFocusedVertex(null);
      setSelectedItem({ ...synced, itemType: 'node' });
      return true;
    },
    [
      connectorLineFocusedVertex,
      currentDiagramData,
      layers,
      confirmPresentationLayerImpact,
      setCurrentDiagramData,
      setSelectedItem,
    ],
  );

  const handleItemDelete = React.useCallback(
    (itemToDelete: SelectedItem) => {
      if (
        itemToDelete.itemType === 'node' &&
        isConnectorLineNodeType(itemToDelete.type) &&
        tryDeleteConnectorLineVertexBeforeNodeDelete(itemToDelete.id)
      ) {
        return;
      }

      if (itemToDelete.itemType === 'node') {
        const layerId = itemToDelete.layer || layers.getItemLayerById(itemToDelete.id);
        if (!confirmPresentationLayerImpact('The selected item', layerId ? [layerId] : [])) return;
      } else if (itemToDelete.itemType === 'edge') {
        const edge = itemToDelete as { from: string; to: string };
        if (!confirmPresentationLayerImpact('This connection', getAffectedLayerIdsForConnection(edge.from, edge.to))) return;
      }

      let newNodes = currentDiagramData.nodes;
      let newConnections = currentDiagramData.connections;

      if (itemToDelete.itemType === 'node') {
        newNodes = currentDiagramData.nodes.filter((n) => n.id !== itemToDelete.id);
        newConnections = currentDiagramData.connections.filter(
          (e: { from: string; to: string }) => e.from !== itemToDelete.id && e.to !== itemToDelete.id,
        );
      } else if (itemToDelete.itemType === 'edge') {
        const edgeItem = itemToDelete as { from: string; to: string; id?: string };
        const hasExactIdMatch = Boolean(
          edgeItem.id &&
            currentDiagramData.connections.some(
              (e: DiagramConnectionData) => (e as DiagramConnectionData).id === edgeItem.id,
            ),
        );
        newConnections = currentDiagramData.connections.filter((e: DiagramConnectionData) => {
          if (hasExactIdMatch && edgeItem.id && (e as DiagramConnectionData).id) {
            return (e as DiagramConnectionData).id !== edgeItem.id;
          }
          return !(e.from === edgeItem.from && e.to === edgeItem.to);
        });
      }

      const updatedData = { ...currentDiagramData, nodes: newNodes, connections: newConnections };
      const nextDiagram = cleanupGroupsAfterDeletion([itemToDelete.id], updatedData);
      setCurrentDiagramData(nextDiagram);
      setSelectedItem(null);
    },
    [
      currentDiagramData,
      layers,
      setCurrentDiagramData,
      setSelectedItem,
      getAffectedLayerIdsForConnection,
      confirmPresentationLayerImpact,
      tryDeleteConnectorLineVertexBeforeNodeDelete,
    ],
  );

  const computePresentationDisabledLayerIds = React.useCallback((
    masterDiagram: DiagramData,
    currentDiagram: DiagramData
  ): Set<string> => {
    const disabled = new Set<string>();

    const currentNodeIds = new Set((currentDiagram.nodes || []).map((n) => n.id));
    const masterNodeLayerById = new Map((masterDiagram.nodes || []).map((n) => [n.id, n.layer || 'background']));

    // If a node from master is missing in presentation draft, its layer becomes disabled.
    for (const node of masterDiagram.nodes || []) {
      if (!currentNodeIds.has(node.id)) {
        disabled.add(node.layer || 'background');
      }
    }

    const currentConnectionKeys = new Set(
      (currentDiagram.connections || []).map((c) => (c.id ? `id:${c.id}` : `pair:${c.from}->${c.to}`))
    );

    // If a master connection is missing, disable layers of its endpoint nodes.
    for (const conn of masterDiagram.connections || []) {
      const key = conn.id ? `id:${conn.id}` : `pair:${conn.from}->${conn.to}`;
      if (!currentConnectionKeys.has(key)) {
        const fromLayer = masterNodeLayerById.get(conn.from);
        const toLayer = masterNodeLayerById.get(conn.to);
        if (fromLayer) disabled.add(fromLayer);
        if (toLayer) disabled.add(toLayer);
      }
    }

    return disabled;
  }, []);

  React.useEffect(() => {
    const master = presentationMasterDiagram ?? tabDiagramData;
    const current = presentationDraftDiagram ?? diagramData;
    if (!master || !current) return;

    const nextDisabled = computePresentationDisabledLayerIds(master, current);
    setPresentationDisabledLayerIds((prev) => {
      if (prev.size === nextDisabled.size) {
        let same = true;
        for (const id of prev) {
          if (!nextDisabled.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return nextDisabled;
    });
  }, [
    presentationMasterDiagram,
    presentationDraftDiagram,
    tabDiagramData,
    diagramData,
    computePresentationDisabledLayerIds,
  ]);

  const disconnectSelected = () => {
    if (!selectedItem || selectedItem.itemType !== 'node') return;
    if (!confirmPresentationLayerImpact('The selected item', [selectedItem.layer || layers.getItemLayerById(selectedItem.id)])) return;
    const id = selectedItem.id;
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.filter((e: any) => e.from !== id && e.to !== id),
    }));
    toast({ title: 'Disconnected', description: 'All connections to/from this item have been removed.' });
  };

  const persistPresentationSlideFromDiagram = React.useCallback((nextDiagram: DiagramData) => {
    if (!activePresentationDeckId || !activePresentationSlideId) return;
    if (
      activePresentationPrimarySlideId &&
      activePresentationSlideId === activePresentationPrimarySlideId
    ) {
      return;
    }

    const masterBase = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
    const nextVisible = projectVisibleDiagram(nextDiagram);
    const nextDelta = computeDiagramDelta(masterBase, nextVisible);

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: deck.slides.map((slide) => (
          slide.id === activePresentationSlideId
            ? { ...slide, diagramDelta: nextDelta }
            : slide
        )),
        updatedAt: Date.now(),
      };
    }));
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationPrimarySlideId,
  ]);

  React.useEffect(() => {
    if (presentationPersistSuppressedForExportRef.current) return;
    if (!activePresentationDeckId || !activePresentationSlideId) return;
    if (
      activePresentationPrimarySlideId &&
      activePresentationSlideId === activePresentationPrimarySlideId
    ) {
      return;
    }
    if (!presentationDraftDiagram) return;
    persistPresentationSlideFromDiagram(presentationDraftDiagram);
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    activePresentationPrimarySlideId,
    presentationDraftDiagram,
    persistPresentationSlideFromDiagram,
  ]);

  const runPresentationThumbnailCaptureIfNeeded = React.useCallback(async () => {
    if (presentationThumbBackfillRunningRef.current) return;
    if (presentationThumbCaptureInFlightRef.current) return;
    if (!editorRef.current?.captureSnapshotPng) return;

    const ctx = presentationThumbCtxRef.current;
    if (!ctx.deckId) return;

    presentationThumbCaptureInFlightRef.current = true;
    try {
      // Slide 1 (main diagram) strip thumbnail — main tab only. Never use `layers.filteredDiagramData`
      // here: while editing a snapshot, layers follow the draft and would change the base fingerprint + PNG.
      const visibleMain = projectVisibleDiagram(ctx.tab);
      let baseFingerprint: string | null = null;
      try {
        baseFingerprint = JSON.stringify(visibleMain);
      } catch {
        baseFingerprint = null;
      }
      if (baseFingerprint !== null) {
        const deckForBase = presentationDecksRef.current.find((d) => d.id === ctx.deckId);
        const primarySlide = deckForBase?.slides[0];
        if (primarySlide) {
          const primaryKey = `${ctx.deckId}:${primarySlide.id}`;
          const needsPrimaryPng = slideNeedsPresentationThumbnailSnapshot(primarySlide.snapshotImage);
          if (
            presentationThumbDeltaFingerprintBySlideRef.current[primaryKey] !== baseFingerprint ||
            needsPrimaryPng
          ) {
            const captureDeckId = ctx.deckId;
            const capturePrimaryId = primarySlide.id;
            try {
              const primaryPng = await editorRef.current.captureSnapshotPng({
                backgroundColor: 'white',
                quality: 'medium',
                fitContent: true,
                unionDiagrams: [visibleMain],
              });
              if (presentationThumbCtxRef.current.deckId === captureDeckId) {
                setPresentationDecks((prev) =>
                  prev.map((d) =>
                    d.id !== captureDeckId
                      ? d
                      : {
                          ...d,
                          slides: d.slides.map((s) =>
                            s.id === capturePrimaryId ? { ...s, snapshotImage: primaryPng } : s,
                          ),
                          updatedAt: Date.now(),
                        },
                  ),
                );
                presentationThumbDeltaFingerprintBySlideRef.current[primaryKey] = baseFingerprint;
              }
            } catch {
              // Retry later
            }
          }
        }
      }

      const ctxSlide = presentationThumbCtxRef.current;
      if (!ctxSlide.draft || !ctxSlide.slideId || !ctxSlide.deckId) return;

      let deltaFingerprint: string;
      try {
        const masterBase = projectVisibleDiagram(ctxSlide.master ?? ctxSlide.tab);
        const nextVisible = projectVisibleDiagram(ctxSlide.draft);
        const nextDelta = computeDiagramDelta(masterBase, nextVisible);
        deltaFingerprint = JSON.stringify(nextDelta);
      } catch {
        return;
      }

      const thumbKey = `${ctxSlide.deckId}:${ctxSlide.slideId}`;
      let slideForThumb: Slide | undefined;
      for (const d of presentationDecksRef.current) {
        if (d.id !== ctxSlide.deckId) continue;
        slideForThumb = d.slides.find((s) => s.id === ctxSlide.slideId);
        break;
      }
      const snapshotNeedsRealPng =
        slideForThumb && slideNeedsPresentationThumbnailSnapshot(slideForThumb.snapshotImage);
      if (
        presentationThumbDeltaFingerprintBySlideRef.current[thumbKey] === deltaFingerprint &&
        !snapshotNeedsRealPng
      ) {
        return;
      }

      const captureDeckId = ctxSlide.deckId;
      const captureSlideId = ctxSlide.slideId;

      const snapshotImage = await editorRef.current.captureSnapshotPng({
        backgroundColor: 'white',
        quality: 'medium',
        fitContent: true,
        unionDiagrams: activePresentationSlideDiagramsForThumbnailCapture,
      });

      if (
        presentationThumbCtxRef.current.slideId !== captureSlideId ||
        presentationThumbCtxRef.current.deckId !== captureDeckId
      ) {
        return;
      }

      setPresentationDecks((prev) =>
        prev.map((d) => {
          if (d.id !== captureDeckId) return d;
          return {
            ...d,
            slides: d.slides.map((s) =>
              s.id === captureSlideId ? { ...s, snapshotImage } : s
            ),
            updatedAt: Date.now(),
          };
        })
      );
      presentationThumbDeltaFingerprintBySlideRef.current[thumbKey] = deltaFingerprint;
    } catch {
      // Retry on a later interval or slide change
    } finally {
      presentationThumbCaptureInFlightRef.current = false;
    }
  }, [setPresentationDecks, activePresentationSlideDiagramsForThumbnailCapture]);

  const captureOutgoingSlideThumbnailIfNeeded = React.useCallback(async () => {
    if (presentationThumbBackfillRunningRef.current) return;
    await runPresentationThumbnailCaptureIfNeeded();
  }, [runPresentationThumbnailCaptureIfNeeded]);

  React.useEffect(() => {
    if (!activePresentationDeckId) return;

    const id = window.setInterval(() => {
      void runPresentationThumbnailCaptureIfNeeded();
    }, PRESENTATION_THUMB_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [activePresentationDeckId, runPresentationThumbnailCaptureIfNeeded]);

  React.useEffect(() => {
    if (!activePresentationDeckId) return;
    void runPresentationThumbnailCaptureIfNeeded();
  }, [activePresentationDeckId, activePresentationSlideId, tabDiagramData, runPresentationThumbnailCaptureIfNeeded]);

  /**
   * Compact / legacy loads use SVG placeholders for `snapshotImage`. Capture real PNGs for every slide
   * (sequential: each slide must be the active draft for `captureSnapshotPng` + union fit).
   */
  React.useEffect(() => {
    if (!presentationMasterDiagram) return;

    const decksSnapshot = presentationDecksRef.current;
    if (decksSnapshot.length === 0) return;

    const needsAny = decksSnapshot.some((d) =>
      d.slides.some((s) => slideNeedsPresentationThumbnailSnapshot(s.snapshotImage)),
    );
    if (!needsAny) return;

    let cancelled = false;
    const savedDeckId = activePresentationDeckId;
    const savedSlideId = activePresentationSlideId;
    const masterBase = projectVisibleDiagram(presentationMasterDiagram);

    const waitForEditor = async () => {
      for (let i = 0; i < 45; i++) {
        if (cancelled) return false;
        if (editorRef.current?.captureSnapshotPng) return true;
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
      return Boolean(editorRef.current?.captureSnapshotPng);
    };

    presentationThumbBackfillRunningRef.current = true;

    void (async () => {
      const ready = await waitForEditor();
      if (!ready || cancelled) {
        presentationThumbBackfillRunningRef.current = false;
        return;
      }

      try {
        for (const deck of decksSnapshot) {
          const slidesNeeding = deck.slides.filter((s) =>
            slideNeedsPresentationThumbnailSnapshot(s.snapshotImage),
          );
          if (slidesNeeding.length === 0) continue;

          for (const slide of slidesNeeding) {
            if (cancelled) return;

            if (deck.slides[0]?.id === slide.id) {
              const visibleMain = masterBase;
              try {
                const primaryPng = await editorRef.current!.captureSnapshotPng!({
                  backgroundColor: 'white',
                  quality: 'medium',
                  fitContent: true,
                  unionDiagrams: [visibleMain],
                });
                if (cancelled) return;
                flushSync(() => {
                  setPresentationDecks((prev) =>
                    prev.map((d) =>
                      d.id !== deck.id
                        ? d
                        : {
                            ...d,
                            slides: d.slides.map((s) =>
                              s.id === slide.id ? { ...s, snapshotImage: primaryPng } : s,
                            ),
                            updatedAt: Date.now(),
                          },
                    ),
                  );
                });
                try {
                  presentationThumbDeltaFingerprintBySlideRef.current[`${deck.id}:${slide.id}`] =
                    JSON.stringify(visibleMain);
                } catch {
                  // ignore
                }
              } catch {
                // Next slide
              }
              await new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              );
              continue;
            }

            const draftDiagram = projectVisibleDiagram(
              applyDiagramDelta(masterBase, slide.diagramDelta),
            );
            const unionDiagrams = deck.slides.map((s) =>
              s.id === slide.id
                ? draftDiagram
                : projectVisibleDiagram(applyDiagramDelta(masterBase, s.diagramDelta)),
            );

            flushSync(() => {
              setActivePresentationDeckId(deck.id);
              setActivePresentationSlideId(slide.id);
              setPresentationDraftDiagram(draftDiagram);
            });

            await new Promise<void>((r) =>
              requestAnimationFrame(() => requestAnimationFrame(() => r())),
            );
            if (cancelled) return;

            try {
              const snapshotImage = await editorRef.current!.captureSnapshotPng!({
                backgroundColor: 'white',
                quality: 'medium',
                fitContent: true,
                unionDiagrams,
              });

              if (cancelled) return;

              flushSync(() => {
                setPresentationDecks((prev) =>
                  prev.map((d) => {
                    if (d.id !== deck.id) return d;
                    return {
                      ...d,
                      slides: d.slides.map((s) =>
                        s.id === slide.id ? { ...s, snapshotImage } : s,
                      ),
                      updatedAt: Date.now(),
                    };
                  }),
                );
              });
              try {
                const fp = JSON.stringify(
                  computeDiagramDelta(masterBase, projectVisibleDiagram(draftDiagram)),
                );
                presentationThumbDeltaFingerprintBySlideRef.current[`${deck.id}:${slide.id}`] = fp;
              } catch {
                // ignore
              }
            } catch {
              // Next slide or restore
            }
          }
        }
      } finally {
        if (savedDeckId && savedSlideId) {
          const restoreDeck = presentationDecksRef.current.find((d) => d.id === savedDeckId);
          const restoreSlide = restoreDeck?.slides.find((s) => s.id === savedSlideId);
          if (restoreDeck && restoreSlide) {
            if (restoreDeck.slides[0]?.id === restoreSlide.id) {
              flushSync(() => {
                setActivePresentationDeckId(savedDeckId);
                setActivePresentationSlideId(savedSlideId);
                setPresentationDraftDiagram(null);
              });
            } else {
              const restoreDraft = projectVisibleDiagram(
                applyDiagramDelta(masterBase, restoreSlide.diagramDelta),
              );
              flushSync(() => {
                setActivePresentationDeckId(savedDeckId);
                setActivePresentationSlideId(savedSlideId);
                setPresentationDraftDiagram(restoreDraft);
              });
            }
          }
        }
        presentationThumbBackfillRunningRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- active deck/slide are restore targets for this run only; omitting avoids re-entry on every slide change.
  }, [presentationMasterDiagram, presentationDeckIdentityKey]);

  const activeStripSlideIndex =
    activePresentationDeck && activePresentationSlideId
      ? activePresentationSlides.findIndex((s) => s.id === activePresentationSlideId)
      : -1;
  const hasLaterSlides =
    activeStripSlideIndex >= 0 && activeStripSlideIndex < activePresentationSlides.length - 1;

  const handlePropagateAddToLaterSlides = React.useCallback(() => {
    if (!activePresentationDeckId || !selectedItem || !hasLaterSlides) return;
    const draftSource = presentationDraftDiagram ?? tabDiagramData;
    const masterBase = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
    let itemToAdd: DiagramNodeData | DiagramConnectionData | null = null;
    if (selectedItem.itemType === 'node') {
      const node = draftSource.nodes.find((n) => n.id === selectedItem.id);
      if (node) itemToAdd = { ...node };
    } else if (selectedItem.itemType === 'edge') {
      const connId = (selectedItem as { id?: string }).id;
      const conn = (draftSource.connections || []).find(
        (c) => (connId && (c as DiagramConnectionData).id === connId) || (c.from === selectedItem.from && c.to === selectedItem.to)
      );
      if (conn) itemToAdd = { ...conn };
    }
    if (!itemToAdd) return;

    setPresentationDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== activePresentationDeckId) return deck;
        const currentIdx = activePresentationSlideId
          ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
          : -1;
        if (activePresentationSlideId && currentIdx < 0) return deck;
        const nextSlides = deck.slides.map((slide, idx) => {
          if (idx <= currentIdx) return slide;
          const slideDiagram = applyDiagramDelta(masterBase, slide.diagramDelta);
          let nextDiagram: DiagramData;
          if (itemToAdd && 'from' in itemToAdd && 'to' in itemToAdd) {
            const conn = itemToAdd as DiagramConnectionData;
            const existing = (slideDiagram.connections || []).some(
              (c) => (conn.id && (c as DiagramConnectionData).id === conn.id) || (c.from === conn.from && c.to === conn.to)
            );
            if (existing) return slide;
            nextDiagram = {
              ...slideDiagram,
              connections: [...(slideDiagram.connections || []), ensureConnectionIds([conn])[0]],
            };
          } else if (itemToAdd && 'type' in itemToAdd) {
            const node = itemToAdd as DiagramNodeData;
            if (slideDiagram.nodes.some((n) => n.id === node.id)) return slide;
            nextDiagram = {
              ...slideDiagram,
              nodes: [...slideDiagram.nodes, node],
            };
          } else {
            return slide;
          }
          const nextVisible = projectVisibleDiagram(nextDiagram);
          const nextDelta = computeDiagramDelta(masterBase, nextVisible);
          return { ...slide, diagramDelta: nextDelta };
        });
        return { ...deck, slides: nextSlides, updatedAt: Date.now() };
      })
    );
    toast({ title: 'Added to later slides', description: `Item added to ${activePresentationSlides.length - 1 - activeStripSlideIndex} slide(s).` });
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    selectedItem,
    hasLaterSlides,
    presentationDraftDiagram,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationSlides.length,
    activeStripSlideIndex,
  ]);

  const handlePropagateDeleteToLaterSlides = React.useCallback(() => {
    if (!activePresentationDeckId || !selectedItem || !hasLaterSlides) return;
    const masterBase = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
    const nodeIdToRemove = selectedItem.itemType === 'node' ? selectedItem.id : null;
    const connectionToRemove =
      selectedItem.itemType === 'edge' ? { from: selectedItem.from, to: selectedItem.to, id: (selectedItem as { id?: string }).id } : null;

    setPresentationDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== activePresentationDeckId) return deck;
        const currentIdx = activePresentationSlideId
          ? deck.slides.findIndex((s) => s.id === activePresentationSlideId)
          : -1;
        if (activePresentationSlideId && currentIdx < 0) return deck;
        const nextSlides = deck.slides.map((slide, idx) => {
          if (idx <= currentIdx) return slide;
          const slideDiagram = applyDiagramDelta(masterBase, slide.diagramDelta);
          let nextDiagram: DiagramData;
          if (nodeIdToRemove) {
            nextDiagram = {
              ...slideDiagram,
              nodes: slideDiagram.nodes.filter((n) => n.id !== nodeIdToRemove),
              connections: (slideDiagram.connections || []).filter((c) => c.from !== nodeIdToRemove && c.to !== nodeIdToRemove),
            };
          } else if (connectionToRemove) {
            nextDiagram = {
              ...slideDiagram,
              connections: (slideDiagram.connections || []).filter((c) => {
                if (connectionToRemove.id && (c as DiagramConnectionData).id) return (c as DiagramConnectionData).id !== connectionToRemove.id;
                return !(c.from === connectionToRemove.from && c.to === connectionToRemove.to);
              }),
            };
          } else {
            return slide;
          }
          const nextVisible = projectVisibleDiagram(nextDiagram);
          const nextDelta = computeDiagramDelta(masterBase, nextVisible);
          return { ...slide, diagramDelta: nextDelta };
        });
        return { ...deck, slides: nextSlides, updatedAt: Date.now() };
      })
    );
    toast({ title: 'Removed from later slides', description: `Item removed from ${activePresentationSlides.length - 1 - activeStripSlideIndex} slide(s).` });
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    selectedItem,
    hasLaterSlides,
    presentationMasterDiagram,
    tabDiagramData,
    activePresentationSlides.length,
    activeStripSlideIndex,
  ]);

  const disconnectConnection = React.useCallback((from: string, to: string, connectionId?: string) => {
    if (!confirmPresentationLayerImpact('This connection', getAffectedLayerIdsForConnection(from, to))) return;
    const nextDiagram: DiagramData = {
      ...diagramData,
      connections: diagramData.connections.filter((e: DiagramConnectionData) => {
        if (connectionId && (e as DiagramConnectionData).id) return (e as DiagramConnectionData).id !== connectionId;
        return !(e.from === from && e.to === to);
      }),
    };

    setDiagramData(nextDiagram);

    if (selectedItem && selectedItem.itemType === 'edge') {
      const match = (selectedItem.from === from && selectedItem.to === to) &&
        (!connectionId || (selectedItem as { id?: string }).id === connectionId);
      if (match) setSelectedItem(null);
    }
    toast({ title: 'Connection Disconnected', description: 'Connection has been removed.' });
  }, [diagramData, selectedItem, setDiagramData, setSelectedItem, confirmPresentationLayerImpact, getAffectedLayerIdsForConnection, layers]);

  const getFilenameStem = (filename: string) =>
    filename.replace(/\.[^.]+$/, '') || filename;

  const handleSave = async (tabId?: string): Promise<boolean> => {
    const targetTabId = (typeof tabId === 'string' ? tabId : undefined) ?? activeTabId;
    const targetTab = targetTabId ? getTab(targetTabId) : activeTab;
    if (!targetTabId || !targetTab) return false;

    const baseForPresentationCompression = projectVisibleDiagram(presentationMasterDiagram ?? targetTab.diagramData);
    const baseNodeMap = buildBaseNodeMap(baseForPresentationCompression);

    const compactDecks: CompactDeckV2[] = presentationDecks.map((deck) => {
      const rawSlides: CompactSlideV2[] = deck.slides.map((slide, index) => {
        const compactRefs: CompactSlideV2['r'] = {};
        const compactOps: CompactOperation[] = [];

        for (const operation of slide.diagramDelta.operations || []) {
          if (operation.op === 'replace' && operation.path === '/nodes') {
            const compressedIds = canCompressNodeReplaceToIds(operation.value, baseNodeMap);
            if (compressedIds) {
              compactRefs.n = compressedIds;
              continue;
            }
          }

          if (operation.op === 'replace' && operation.path === '/layers/layers') {
            const compressedVisibleLayerIds = canCompressLayerReplaceToVisibleIds(
              operation.value,
              baseForPresentationCompression.layers
            );
            if (compressedVisibleLayerIds) {
              compactRefs.l = compressedVisibleLayerIds;
              continue;
            }
          }

          if (operation.op === 'replace' && operation.path === '/connections' && Array.isArray(operation.value)) {
            compactRefs.c = (operation.value as DiagramData['connections']).map(stripConnectionDefaults);
            continue;
          }

          const code: CompactOpCode = operation.op === 'add' ? 0 : operation.op === 'remove' ? 1 : 2;
          compactOps.push(
            operation.value === undefined
              ? [code, operation.path]
              : [code, operation.path, operation.value]
          );
        }

        const animationState = slide.animationState;
        const compactAnimation: CompactAnimationStateV2 | undefined = animationState
          ? {
              e: animationState.enabled ? undefined : 0,
              f: animationState.filterSourceIds && animationState.filterSourceIds.length > 0
                ? animationState.filterSourceIds
                : undefined,
              x: animationState.disabledSourceIds && animationState.disabledSourceIds.length > 0
                ? animationState.disabledSourceIds
                : undefined,
            }
          : undefined;

        const hasCompactAnimation = Boolean(
          compactAnimation && (
            compactAnimation.e !== undefined ||
            (compactAnimation.f && compactAnimation.f.length > 0) ||
            (compactAnimation.x && compactAnimation.x.length > 0)
          )
        );

        const defaultTitle = `Snapshot ${index + 1}`;
        return {
          d: compactOps.length > 0 ? { o: compactOps } : undefined,
          r: (compactRefs.n || compactRefs.l || compactRefs.c) ? compactRefs : undefined,
          t: slide.title && slide.title !== defaultTitle ? slide.title : undefined,
          a: hasCompactAnimation ? compactAnimation : undefined,
          z: typeof slide.autoZoomLevel === 'number' && Number.isFinite(slide.autoZoomLevel)
            ? Number(slide.autoZoomLevel.toFixed(4))
            : undefined,
          px: typeof slide.viewPanX === 'number' && Number.isFinite(slide.viewPanX)
            ? Number(slide.viewPanX.toFixed(2))
            : undefined,
          py: typeof slide.viewPanY === 'number' && Number.isFinite(slide.viewPanY)
            ? Number(slide.viewPanY.toFixed(2))
            : undefined,
        };
      });

      const deduped = dedupeSlideRefSets(rawSlides);
      return {
        n: deck.name || undefined,
        tn: deduped.nodeTable,
        tl: deduped.layerTable,
        tc: deduped.connectionTable,
        s: deduped.slides,
      };
    });

    const activeDeckIndex = activePresentationDeckId
      ? presentationDecks.findIndex((deck) => deck.id === activePresentationDeckId)
      : -1;

    const dataToSave: DiagramJsonWithPresentations = {
      ...targetTab.diagramData,
      presentations: {
        v: 2,
        ai: activeDeckIndex >= 0 ? activeDeckIndex : undefined,
        d: compactDecks,
      },
    };
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const suggestedName = `${targetTab.name.replace(/\s+/g, '-').toLowerCase()}.json`;

    // Try to use the File System Access API if available (Chromium browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        const fileName = 'name' in handle ? String(handle.name) : suggestedName;
        updateTab(targetTabId, { name: getFilenameStem(fileName) });
        markTabAsSaved(targetTabId);
        toast({ title: 'Diagram Saved', description: 'Your diagram has been saved successfully.' });
        return true;
      } catch (error: any) {
        if (error.name === 'AbortError') return false;
        console.log('File System Access API failed, falling back to download:', error);
      }
    }

    // Fallback: automatic download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateTab(targetTabId, { name: getFilenameStem(suggestedName) });
    markTabAsSaved(targetTabId);
    toast({ title: 'Diagram Saved', description: 'Your diagram has been downloaded.' });
    return true;
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleMermaidImportClick = () => {
    mermaidInputRef.current?.click();
  };

  const handleMermaidFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') return;
        const diagramType = detectMermaidDiagramType(text);
        if (diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content found. Expected: sequenceDiagram followed by participant and message definitions.');
          }
          if (parsed.errors.length > 0) {
            const errMsg = parsed.errors.join('; ');
            console.error('[Mermaid Import] Sequence diagram parse issues:', { errors: parsed.errors });
            throw new Error(`Sequence diagram parse issues: ${errMsg}`);
          }
          const completeData = sequenceDiagramToDiagramData(parsed);
          completeData.connections = ensureConnectionIds(completeData.connections || []);
          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            toast({ title: 'Mermaid Imported', description: 'Your sequence diagram has been successfully imported.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
          return;
        }
        if (diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content found. Expected: classDiagram followed by class and inheritance definitions.');
          }
          if (parsed.errors.length > 0) {
            const errMsg = parsed.errors.join('; ');
            console.error('[Mermaid Import] Class diagram parse issues:', { errors: parsed.errors });
            throw new Error(`Class diagram parse issues: ${errMsg}`);
          }
          let completeData = classDiagramToDiagramData(parsed);
          completeData.connections = ensureConnectionIds(completeData.connections || []);
          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            toast({ title: 'Mermaid Imported', description: 'Your class diagram has been successfully imported.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
          return;
        }
        const parsed = parseMermaidFlowchart(text);
        if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
          throw new Error('No valid flowchart content found. Expected: flowchart TD or flowchart LR followed by node and edge definitions.');
        }
        if (parsed.errors.length > 0) {
          const errMsg = parsed.errors.join('; ');
          console.error('[Mermaid Import] Parse issues:', { errors: parsed.errors, nodes: parsed.nodes.length, edges: parsed.edges.length });
          throw new Error(`Mermaid parse issues: ${errMsg}`);
        }
        let completeData = await mermaidToDiagramData(parsed);
        setDiagramData({ nodes: [], connections: [], groupings: [] });
        setTimeout(() => {
          setDiagramData(completeData);
          setSelectedItem(null);
          toast({ title: 'Mermaid Imported', description: 'Your diagram has been successfully imported.' });
          setTimeout(() => editorRef.current?.fitToView(), 100);
        }, 0);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        const stack = error instanceof Error ? error.stack : undefined;
        console.error('[Mermaid Import] Error:', { message, stack, file: file?.name });
        toast({ variant: 'destructive', title: 'Error Importing Mermaid', description: message });
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const parseUnknownJsonToDiagramData = React.useCallback((json: unknown): DiagramData => {
    const flattened = flattenDiagramOnImport((json || {}) as RawDiagramData);

    // Keep import resilient: invalid custom icon URLs are downgraded to fallback rendering
    // before strict Zod validation runs.
    const preSanitized = {
      ...flattened,
      nodes: (flattened.nodes || []).map((node: any) => {
        if (node?.type !== 'generic.icon.custom') return node;
        const normalizedUrl = normalizeHttpImageUrl(node?.imageUrl);
        if (!normalizedUrl) {
          const { imageUrl: _discard, ...rest } = node;
          return rest;
        }
        return { ...node, imageUrl: normalizedUrl };
      }),
    };

    const result = DiagramDataSchema.safeParse(preSanitized);
    if (!result.success) {
      throw new Error(`Invalid diagram format: ${result.error.message}`);
    }
    const connections = ensureConnectionIds(result.data.connections || []);
    const parsedData: DiagramData = {
      nodes: result.data.nodes || [],
      connections,
      groupings: result.data.groupings,
      layers: result.data.layers,
    };
    return sanitizeCustomIconsInDiagram(parsedData);
  }, []);

  const extractPresentationsFromDiagramJson = React.useCallback((json: unknown): {
    decks: PresentationDeck[];
    activeDeckId: string | null;
  } => {
    const base = parseUnknownJsonToDiagramData(json);
    const extracted = extractEmbeddedPresentations(json, base);
    return collapsePresentationDecksToOne(extracted.decks, extracted.activeDeckId);
  }, [parseUnknownJsonToDiagramData]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result;
          if (typeof text !== 'string') return;
          const ext = file.name.toLowerCase().slice(-5);
          const diagramType = detectMermaidDiagramType(text);
          const isMermaid = /\.(mmd|mermaid)$/.test(file.name.toLowerCase())
            || diagramType !== null;
          let completeData: DiagramData;
          let loadedPresentations: { decks: PresentationDeck[]; activeDeckId: string | null } = {
            decks: [],
            activeDeckId: null,
          };

          if (isMermaid && diagramType === 'sequenceDiagram') {
            const parsed = parseMermaidSequenceDiagram(text);
            if (parsed.participants.length === 0 && parsed.messages.length === 0) {
              throw new Error('No valid sequence diagram content found.');
            }
            if (parsed.errors.length > 0) {
              throw new Error(`Sequence diagram parse issues: ${parsed.errors.join('; ')}`);
            }
            completeData = sequenceDiagramToDiagramData(parsed);
          } else if (isMermaid && diagramType === 'classDiagram') {
            const parsed = parseMermaidClassDiagram(text);
            if (parsed.classes.length === 0 && parsed.edges.length === 0) {
              throw new Error('No valid class diagram content found. Expected: classDiagram followed by class and inheritance definitions.');
            }
            if (parsed.errors.length > 0) {
              const errMsg = parsed.errors.join('; ');
              console.error('[Mermaid Load] Class diagram parse issues:', { errors: parsed.errors });
              throw new Error(`Class diagram parse issues: ${errMsg}`);
            }
            completeData = classDiagramToDiagramData(parsed);
          } else if (isMermaid) {
            const parsed = parseMermaidFlowchart(text);
            if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
              throw new Error('No valid flowchart content found. Expected: flowchart TD or flowchart LR followed by node and edge definitions.');
            }
            if (parsed.errors.length > 0) {
              const errMsg = parsed.errors.join('; ');
              console.error('[Mermaid Load] Parse issues:', { errors: parsed.errors, nodes: parsed.nodes.length, edges: parsed.edges.length });
              throw new Error(`Mermaid parse issues: ${errMsg}`);
            }
            let mermaidData = await mermaidToDiagramData(parsed);
            completeData = mermaidData;
          } else {
            const jsonData = JSON.parse(text);
            completeData = parseUnknownJsonToDiagramData(jsonData);
            loadedPresentations = extractPresentationsFromDiagramJson(jsonData);
          }
          completeData.connections = ensureConnectionIds(completeData.connections || []);

          setDiagramData({ nodes: [], connections: [], groupings: [] });
          setTimeout(() => {
            setDiagramData(completeData);
            setSelectedItem(null);
            setPresentationDecks(loadedPresentations.decks);
            setActivePresentationDeckId(loadedPresentations.activeDeckId);
            const loadDeck =
              loadedPresentations.decks.find((d) => d.id === loadedPresentations.activeDeckId) ??
              loadedPresentations.decks[0];
            setActivePresentationSlideId(loadDeck?.slides[0]?.id ?? null);
            setSelectedPresentationSlideIds(new Set());
            setPresentationMasterDiagram(safeClone(completeData));
            updateActiveTab({ name: getFilenameStem(file.name), hasUnsavedPresentations: false });
            toast({ title: 'Diagram Loaded', description: 'Your diagram has been successfully loaded.' });
            setTimeout(() => editorRef.current?.fitToView(), 100);
          }, 0);
        } catch (error) {
          const message = error instanceof Error ? error.message : "An unknown error occurred";
          const stack = error instanceof Error ? error.stack : undefined;
          console.error('[Diagram Load] Error:', { message, stack, file: file?.name });
          toast({
            variant: 'destructive',
            title: 'Error Loading Diagram',
            description: `Could not load or parse the file. ${message}`,
          });
        }
      };
      reader.readAsText(file);
    }
    if (event.target) event.target.value = '';
  };

  const handleImportIntoSubDiagramClick = React.useCallback(() => {
    subDiagramImportInputRef.current?.click();
  }, []);

  const handleSubDiagramFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || activeDiagramStack.length === 0) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') return;
        const diagramType = detectMermaidDiagramType(text);
        const isMermaid = /\.(mmd|mermaid)$/.test(file.name.toLowerCase()) || diagramType !== null;
        let completeData: DiagramData;

        if (isMermaid && diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content found.');
          }
          completeData = sequenceDiagramToDiagramData(parsed);
        } else if (isMermaid && diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content found.');
          }
          completeData = classDiagramToDiagramData(parsed);
        } else if (isMermaid) {
          const parsed = parseMermaidFlowchart(text);
          if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid flowchart content found.');
          }
          completeData = await mermaidToDiagramData(parsed);
        } else {
          const jsonData = JSON.parse(text);
          completeData = parseUnknownJsonToDiagramData(jsonData);
        }
        completeData.connections = ensureConnectionIds(completeData.connections || []);
        const existingIds = collectAllIdsInDiagram(diagramData);
        const sanitized = sanitizeImportedDiagram(completeData, existingIds);
        setCurrentDiagramData(sanitized);
        setSelectedItem(null);
        toast({ title: 'Sub-diagram imported', description: 'The diagram has been imported into this sub-diagram.' });
        setTimeout(() => editorRef.current?.fitToView(), 100);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        toast({
          variant: 'destructive',
          title: 'Error importing diagram',
          description: `Could not load or parse the file. ${message}`,
        });
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  }, [activeDiagramStack.length, diagramData, parseUnknownJsonToDiagramData, setCurrentDiagramData, toast]);

  const hasConnectionAnimationSettings = React.useCallback((connection: DiagramConnectionData) => {
    const animation = connection.animation;
    if (!animation) return false;
    return (
      animation.enabled === true ||
      animation.color !== undefined ||
      animation.shape !== undefined ||
      animation.speed !== undefined ||
      animation.size !== undefined ||
      animation.autoCount !== undefined ||
      animation.shapeCount !== undefined ||
      animation.spacing !== undefined
    );
  }, []);

  const applyConnectionUpdates = React.useCallback((
    from: string,
    to: string,
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      lineWidthLock?: boolean;
      lineWidthEnd?: number;
      colorLock?: boolean;
      colorEnd?: string;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      smoothCorners?: boolean;
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      centerEdgeAnchors?: boolean;
      edgeAttachmentConstraint?: DiagramConnectionData['edgeAttachmentConstraint'];
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      orthogonalTrunkOffsetX?: number;
      orthogonalTrunkOffsetY?: number;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    },
    connectionId?: string,
    applyToConnectionIds?: string[]
  ) => {
    const multiById =
      applyToConnectionIds && applyToConnectionIds.length > 0 ? new Set(applyToConnectionIds) : null;

    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: (prevData.connections ?? []).map((conn, idx) => {
        const stableId = stableDiagramConnectionId(conn as DiagramConnectionData, idx);
        const match = multiById
          ? multiById.has(stableId)
          : connectionId
            ? (conn as DiagramConnectionData).id === connectionId
            : (conn.from === from && conn.to === to);
        if (!match) return conn;
        const merged = { ...conn, ...updates } as DiagramConnectionData;
        if (updates.lineWidthLock === true) {
          delete merged.lineWidthEnd;
          delete merged.lineWidthLock;
        }
        if (updates.colorLock === true) {
          delete merged.colorEnd;
          delete merged.colorLock;
        }
        if (updates.smoothCorners === false) {
          delete merged.smoothCorners;
        }
        if (updates.centerEdgeAnchors === false) {
          delete merged.centerEdgeAnchors;
        }
        if (
          'edgeAttachmentConstraint' in updates &&
          (updates.edgeAttachmentConstraint === undefined || updates.edgeAttachmentConstraint === 'auto')
        ) {
          delete merged.edgeAttachmentConstraint;
        }
        if ('fromPreferredExit' in updates && updates.fromPreferredExit === undefined) {
          delete merged.fromPreferredExit;
        }
        if ('toPreferredEntry' in updates && updates.toPreferredEntry === undefined) {
          delete merged.toPreferredEntry;
        }
        if ('orthogonalTrunkOffsetX' in updates && updates.orthogonalTrunkOffsetX === undefined) {
          delete merged.orthogonalTrunkOffsetX;
        }
        if ('orthogonalTrunkOffsetY' in updates && updates.orthogonalTrunkOffsetY === undefined) {
          delete merged.orthogonalTrunkOffsetY;
        }
        return merged;
      }),
    }));
    if (selectedItem && selectedItem.itemType === 'edge') {
      const sid = (selectedItem as { id?: string }).id;
      const match = multiById
        ? !!(sid && multiById.has(sid))
        : connectionId
          ? sid === connectionId
          : (selectedItem.from === from && selectedItem.to === to);
      if (match) {
        const next = { ...selectedItem, ...updates } as DiagramConnectionData & { itemType: 'edge'; id: string };
        if (updates.lineWidthLock === true) {
          delete (next as DiagramConnectionData).lineWidthEnd;
          delete (next as DiagramConnectionData).lineWidthLock;
        }
        if (updates.colorLock === true) {
          delete (next as DiagramConnectionData).colorEnd;
          delete (next as DiagramConnectionData).colorLock;
        }
        if ('fromPreferredExit' in updates && updates.fromPreferredExit === undefined) {
          delete (next as DiagramConnectionData).fromPreferredExit;
        }
        if ('toPreferredEntry' in updates && updates.toPreferredEntry === undefined) {
          delete (next as DiagramConnectionData).toPreferredEntry;
        }
        if ('orthogonalTrunkOffsetX' in updates && updates.orthogonalTrunkOffsetX === undefined) {
          delete (next as DiagramConnectionData).orthogonalTrunkOffsetX;
        }
        if ('orthogonalTrunkOffsetY' in updates && updates.orthogonalTrunkOffsetY === undefined) {
          delete (next as DiagramConnectionData).orthogonalTrunkOffsetY;
        }
        setSelectedItem(next as SelectedItem);
      }
    }
  }, [selectedItem, setCurrentDiagramData, setSelectedItem]);

  const applyAnimationToCurrentAndSelected = React.useCallback((
    from: string,
    to: string,
    updates: {
      text?: string;
      color?: string;
      textPosition?: number;
      lineWidth?: number;
      shadow?: boolean;
      style?: 'bezier' | 'orthogonal';
      smoothCorners?: boolean;
      curvature?: number;
      fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      fromArrow?: boolean;
      toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center';
      toArrow?: boolean;
      arrow?: boolean;
      waypoints?: Array<{ x: number; y: number; id?: string }>;
      metaData?: Record<string, string>;
      animation?: DiagramConnectionData['animation'];
    },
    selectedConnectionIds: string[],
    currentConnectionId?: string
  ) => {
    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: (prevData.connections ?? []).map((conn, idx) => {
        const stable = stableDiagramConnectionId(conn as DiagramConnectionData, idx);
        const connId = (conn as DiagramConnectionData).id;
        const isCurrent = currentConnectionId
          ? connId === currentConnectionId || stable === currentConnectionId
          : conn.from === from && conn.to === to;
        if (isCurrent) return { ...conn, ...updates };
        const peerMatch =
          selectedConnectionIds.includes(stable) ||
          (!!connId && selectedConnectionIds.includes(connId));
        if (peerMatch && updates.animation) {
          return { ...conn, animation: updates.animation };
        }
        return conn;
      }),
    }));

    if (selectedItem && selectedItem.itemType === 'edge') {
      const match = currentConnectionId ? (selectedItem as { id?: string }).id === currentConnectionId : (selectedItem.from === from && selectedItem.to === to);
      if (match) setSelectedItem({ ...selectedItem, ...updates });
    }
  }, [selectedItem, setCurrentDiagramData, setSelectedItem]);

  const resetPendingAnimationDialogs = React.useCallback(() => {
    setAnimationSelectionDialogOpen(false);
    setAnimationOverwriteDialogOpen(false);
    setAnimationDisableConfirmDialogOpen(false);
    setPendingAnimationUpdate(null);
  }, []);

  const handleConnectionUpdate = React.useCallback((from: string, to: string, updates: { text?: string; color?: string; textPosition?: number; lineWidth?: number; lineWidthLock?: boolean; lineWidthEnd?: number; colorLock?: boolean; colorEnd?: string; shadow?: boolean; style?: 'bezier' | 'orthogonal'; smoothCorners?: boolean; curvature?: number; fromPreferredExit?: 'top' | 'bottom' | 'left' | 'right' | 'center'; fromArrow?: boolean; toPreferredEntry?: 'top' | 'bottom' | 'left' | 'right' | 'center'; toArrow?: boolean; arrow?: boolean; centerEdgeAnchors?: boolean; edgeAttachmentConstraint?: DiagramConnectionData['edgeAttachmentConstraint']; waypoints?: Array<{ x: number; y: number; id?: string }>; orthogonalTrunkOffsetX?: number; orthogonalTrunkOffsetY?: number; metaData?: Record<string, string>; animation?: DiagramConnectionData['animation'] }, connectionId?: string) => {
    const effectiveConnId = connectionId ?? (selectedItem?.itemType === 'edge' ? (selectedItem as { id?: string }).id : undefined);
    const connections = currentDiagramData.connections ?? [];
    const resolvedEdgeIds = connectionIdsFromSelectionSet(selectedItemIds, connections as DiagramConnectionData[]);

    let currentIdx = -1;
    for (let i = 0; i < connections.length; i++) {
      const conn = connections[i] as DiagramConnectionData;
      if (effectiveConnId) {
        if (conn.id === effectiveConnId || stableDiagramConnectionId(conn, i) === effectiveConnId) {
          currentIdx = i;
          break;
        }
      } else if (conn.from === from && conn.to === to) {
        currentIdx = i;
        break;
      }
    }
    const currentConn = currentIdx >= 0 ? (connections[currentIdx] as DiagramConnectionData) : undefined;
    const currentStableKey =
      currentIdx >= 0 && currentConn !== undefined ? stableDiagramConnectionId(currentConn, currentIdx) : effectiveConnId;

    const isEnablingAnimation = updates.animation?.enabled === true && currentConn?.animation?.enabled !== true;
    const isDisablingAnimation = updates.animation?.enabled === false && currentConn?.animation?.enabled === true;
    const selectedConnectionIds = resolvedEdgeIds.filter((id) => id !== currentStableKey);

    const updatesTouchWaypoints = Object.prototype.hasOwnProperty.call(updates, 'waypoints');
    const fanOutMultiEdges = resolvedEdgeIds.length > 1 && !updatesTouchWaypoints;
    const applyIds = fanOutMultiEdges ? resolvedEdgeIds : undefined;

    if (isEnablingAnimation || isDisablingAnimation) {
      if (selectedConnectionIds.length > 0) {
        setPendingAnimationUpdate({
          from,
          to,
          connectionId: effectiveConnId,
          mode: isDisablingAnimation ? 'disable' : 'enable',
          updates,
          selectedConnectionIds,
          applyAllConnectionIds: resolvedEdgeIds.length > 1 ? resolvedEdgeIds : undefined,
        });
        setAnimationSelectionDialogOpen(true);
        return;
      }
    }

    if (updates.animation && selectedConnectionIds.length > 0 && !fanOutMultiEdges) {
      applyAnimationToCurrentAndSelected(from, to, updates, selectedConnectionIds, effectiveConnId);
      return;
    }

    applyConnectionUpdates(from, to, updates, effectiveConnId, applyIds && applyIds.length > 0 ? applyIds : undefined);
  }, [selectedItem, selectedItemIds, currentDiagramData.connections, setPendingAnimationUpdate, setAnimationSelectionDialogOpen, applyAnimationToCurrentAndSelected, applyConnectionUpdates]);

  const handleAnimationApplyCurrentOnly = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    applyConnectionUpdates(
      pendingAnimationUpdate.from,
      pendingAnimationUpdate.to,
      pendingAnimationUpdate.updates,
      pendingAnimationUpdate.connectionId
    );
    resetPendingAnimationDialogs();
    setAnimationCurrentOnlyDialogOpen(true);
  }, [pendingAnimationUpdate, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleAnimationApplySelectedConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    setAnimationSelectionDialogOpen(false);

    if (pendingAnimationUpdate.mode === 'disable') {
      setAnimationDisableConfirmDialogOpen(true);
      return;
    }

    const connections = currentDiagramData.connections ?? [];
    const hasOtherExistingAnimation = connections.some((conn, idx) => {
      const stable = stableDiagramConnectionId(conn as DiagramConnectionData, idx);
      const idMatches = pendingAnimationUpdate.selectedConnectionIds.some(
        (pid) => pid === stable || (!!(conn as DiagramConnectionData).id && pid === (conn as DiagramConnectionData).id)
      );
      if (!idMatches) return false;
      return hasConnectionAnimationSettings(conn);
    });

    if (hasOtherExistingAnimation) {
      setAnimationOverwriteDialogOpen(true);
      return;
    }

    if (pendingAnimationUpdate.applyAllConnectionIds && pendingAnimationUpdate.applyAllConnectionIds.length > 0) {
      applyConnectionUpdates(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.connectionId,
        pendingAnimationUpdate.applyAllConnectionIds
      );
    } else {
      applyAnimationToCurrentAndSelected(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.selectedConnectionIds,
        pendingAnimationUpdate.connectionId
      );
    }
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, currentDiagramData.connections, hasConnectionAnimationSettings, applyAnimationToCurrentAndSelected, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleAnimationDisableConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    if (pendingAnimationUpdate.applyAllConnectionIds && pendingAnimationUpdate.applyAllConnectionIds.length > 0) {
      applyConnectionUpdates(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.connectionId,
        pendingAnimationUpdate.applyAllConnectionIds
      );
    } else {
      applyAnimationToCurrentAndSelected(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.selectedConnectionIds,
        pendingAnimationUpdate.connectionId
      );
    }
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, applyAnimationToCurrentAndSelected, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleAnimationOverwriteConfirm = React.useCallback(() => {
    if (!pendingAnimationUpdate) return;
    if (pendingAnimationUpdate.applyAllConnectionIds && pendingAnimationUpdate.applyAllConnectionIds.length > 0) {
      applyConnectionUpdates(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.connectionId,
        pendingAnimationUpdate.applyAllConnectionIds
      );
    } else {
      applyAnimationToCurrentAndSelected(
        pendingAnimationUpdate.from,
        pendingAnimationUpdate.to,
        pendingAnimationUpdate.updates,
        pendingAnimationUpdate.selectedConnectionIds,
        pendingAnimationUpdate.connectionId
      );
    }
    resetPendingAnimationDialogs();
  }, [pendingAnimationUpdate, applyAnimationToCurrentAndSelected, applyConnectionUpdates, resetPendingAnimationDialogs]);

  const handleConnectionWaypointMove = (from: string, to: string, index: number, newPos: { x: number; y: number }, connectionId?: string) => {
    setDiagramData(prevData => ({
      ...prevData,
      connections: prevData.connections.map(conn => {
        const match = connectionId ? (conn as DiagramConnectionData).id === connectionId : (conn.from === from && conn.to === to);
        if (!match || !conn.waypoints) return conn;
        const updated = [...conn.waypoints];
        if (index >= 0 && index < updated.length) {
          updated[index] = { ...updated[index], x: newPos.x, y: newPos.y };
        }
        return { ...conn, waypoints: updated };
      })
    }));
  };

  const handleConnectionWaypointAdd = (from: string, to: string, connectionId?: string) => {
    const connections = currentDiagramData.connections ?? [];
    const conn = connections.find((c) =>
      connectionId ? (c as DiagramConnectionData).id === connectionId : (c.from === from && c.to === to)
    );
    if (!conn) return;
    const existing = conn.waypoints ?? [];
    const fromNode = currentDiagramData.nodes.find((n) => n.id === from) || currentDiagramData.zones?.find((z) => z.id === from);
    const toNode = currentDiagramData.nodes.find((n) => n.id === to) || currentDiagramData.zones?.find((z) => z.id === to);
    let midX: number;
    let midY: number;
    if (existing.length > 0) {
      const last = existing[existing.length - 1];
      const tx = ((toNode as any)?.x ?? 100) + (((toNode as any)?.width ?? 80) / 2);
      const ty = ((toNode as any)?.y ?? 80) + (((toNode as any)?.height ?? 80) / 2);
      midX = (last.x + tx) / 2;
      midY = (last.y + ty) / 2;
    } else if (fromNode && toNode) {
      const fx = ((fromNode as any).x ?? 0) + (((fromNode as any).width ?? 80) / 2);
      const fy = ((fromNode as any).y ?? 0) + (((fromNode as any).height ?? 80) / 2);
      const tx = ((toNode as any).x ?? 100) + (((toNode as any).width ?? 80) / 2);
      const ty = ((toNode as any).y ?? 80) + (((toNode as any).height ?? 80) / 2);
      midX = (fx + tx) / 2;
      midY = (fy + ty) / 2;
    } else {
      midX = 200;
      midY = 150;
    }
    const newWaypoint = { x: snapToGrid(midX), y: snapToGrid(midY), id: `wp-${Date.now()}` };
    const connId = connectionId ?? (conn as DiagramConnectionData).id;
    handleConnectionUpdate(from, to, { waypoints: [...existing, newWaypoint] }, connId);
  };

  const handleConnectionInsertNode = React.useCallback((
    _conn: DiagramConnectionData,
    connectionIndex: number,
    diagramPoint: { x: number; y: number },
  ) => {
    if (isReadOnly) return;
    const snapshotConns = currentDiagramData.connections ?? [];
    if (connectionIndex < 0 || connectionIndex >= snapshotConns.length) return;
    const target = snapshotConns[connectionIndex] as DiagramConnectionData;
    if (!target || target.from === target.to) return;
    if (!confirmPresentationLayerImpact('This edit', getAffectedLayerIdsForConnection(target.from, target.to))) return;

    const insertOutcome: { node: DiagramNodeData | null; newIdForLayer: string } = { node: null, newIdForLayer: '' };
    setCurrentDiagramData((prev) => {
      const conns = prev.connections ?? [];
      if (connectionIndex >= conns.length) return prev;
      const row = conns[connectionIndex] as DiagramConnectionData;
      if (!row || row.from !== target.from || row.to !== target.to) return prev;
      const {
        from: _from,
        to: _to,
        id: _id,
        waypoints: _wp,
        orthogonalTrunkOffsetX: _ox,
        orthogonalTrunkOffsetY: _oy,
        connectionIndex: _ci,
        totalConnections: _tc,
        toConnectionIndex: _tci,
        toTotalConnections: _ttc,
        ...restRest
      } = row;
      const restStyle = restRest as Omit<
        DiagramConnectionData,
        | 'from'
        | 'to'
        | 'id'
        | 'waypoints'
        | 'orthogonalTrunkOffsetX'
        | 'orthogonalTrunkOffsetY'
        | 'connectionIndex'
        | 'totalConnections'
        | 'toConnectionIndex'
        | 'toTotalConnections'
      >;
      const w = snapDimensionToGrid(80);
      const h = snapDimensionToGrid(50);
      const nx = snapToGrid(diagramPoint.x - w / 2);
      const ny = snapToGrid(diagramPoint.y - h / 2);
      const newNodeId = generateSequentialId('generic.object.rectangle', prev);
      insertOutcome.newIdForLayer = newNodeId;
      const builtInThemes = DEFAULT_THEMES.filter((t) => t.isBuiltIn);
      const randomTheme = builtInThemes[Math.floor(Math.random() * builtInThemes.length)];
      const newNode: DiagramNodeData = {
        id: newNodeId,
        type: 'generic.object.rectangle',
        label: '',
        x: nx,
        y: ny,
        width: w,
        height: h,
        sizeMode: 'custom',
        textJustify: 'center',
        ...(randomTheme?.properties ?? {}),
      };
      insertOutcome.node = newNode;
      const endArrow = row.toArrow === true || row.arrow === true;
      const leg1: DiagramConnectionData = {
        ...restStyle,
        id: generateConnectionId(),
        from: row.from,
        to: newNodeId,
        fromArrow: row.fromArrow,
        toArrow: false,
        arrow: undefined,
        text: row.text,
        textPosition: row.textPosition,
      };
      const leg2: DiagramConnectionData = {
        ...restStyle,
        id: generateConnectionId(),
        from: newNodeId,
        to: row.to,
        fromArrow: false,
        toArrow: endArrow,
        arrow: undefined,
      };
      const newConnections = [...conns.slice(0, connectionIndex), leg1, leg2, ...conns.slice(connectionIndex + 1)];
      return {
        ...prev,
        nodes: [...(prev.nodes ?? []), newNode],
        connections: newConnections,
      };
    });
    if (insertOutcome.node && insertOutcome.newIdForLayer) {
      const created = insertOutcome.node;
      requestAnimationFrame(() => {
        layers.assignItemsToLayer([insertOutcome.newIdForLayer], layers.getItemLayerById(target.from));
      });
      setSelectedItem({ ...created, itemType: 'node' } as SelectedItem);
      setSelectedItemIds(new Set([created.id]));
    }
  }, [
    isReadOnly,
    currentDiagramData.connections,
    setCurrentDiagramData,
    confirmPresentationLayerImpact,
    getAffectedLayerIdsForConnection,
    layers,
    setSelectedItem,
    setSelectedItemIds,
  ]);

  const handleConnectionWaypointRemove = (from: string, to: string, index: number, connectionId?: string) => {
    const connections = currentDiagramData.connections ?? [];
    const conn = connections.find((c) =>
      connectionId ? (c as DiagramConnectionData).id === connectionId : (c.from === from && c.to === to)
    );
    if (!conn?.waypoints) return;
    const updated = conn.waypoints.filter((_, i) => i !== index);
    const connId = connectionId ?? (conn as DiagramConnectionData).id;
    handleConnectionUpdate(from, to, { waypoints: updated.length ? updated : undefined }, connId);
  };

  const handleConnectionAnimationBulkApply = (
    sourceId: string,
    direction: 'outbound' | 'inbound',
    animation: DiagramConnectionData['animation']
  ) => {
    const animationPatch = toConnectionAnimationPatch(animation);
    setCurrentDiagramData((prevData) => ({
      ...prevData,
      connections: (prevData.connections ?? []).map((conn) => {
        const shouldApply = direction === 'outbound' ? conn.from === sourceId : conn.to === sourceId;
        if (!shouldApply) return conn;
        return {
          ...conn,
          animation: animationPatch,
        };
      }),
    }));
  };

  const handleConnectionContextMenu = useCallback(
    (e: React.MouseEvent, connection: DiagramConnectionData) => {
      pauseConnectionAnimationsForOverlayUi();
      setConnectionContextModal({ visible: true, x: e.clientX, y: e.clientY, connection });
    },
    [pauseConnectionAnimationsForOverlayUi],
  );

  const handleNew = () => {
    createTab();
  };

  const handleLoadExample = React.useCallback(async (exampleId: string) => {
    try {
      const isMermaid = exampleId === 'simple' || exampleId === 'complex' || exampleId === 'class-diagram' || exampleId === 'sequence-diagram';
      const res = await fetch(`/examples/${exampleId}.${isMermaid ? 'mmd' : 'json'}`);
      if (!res.ok) {
        throw new Error(`Failed to load example: ${res.statusText}`);
      }
      const text = await res.text();
      let diagram: DiagramData;

      if (isMermaid) {
        const diagramType = detectMermaidDiagramType(text);
        let mermaidData: DiagramData;
        if (diagramType === 'sequenceDiagram') {
          const parsed = parseMermaidSequenceDiagram(text);
          if (parsed.participants.length === 0 && parsed.messages.length === 0) {
            throw new Error('No valid sequence diagram content in Mermaid example.');
          }
          mermaidData = sequenceDiagramToDiagramData(parsed);
        } else if (diagramType === 'classDiagram') {
          const parsed = parseMermaidClassDiagram(text);
          if (parsed.classes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid class diagram content in Mermaid example.');
          }
          mermaidData = classDiagramToDiagramData(parsed);
        } else {
          const parsed = parseMermaidFlowchart(text);
          if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
            throw new Error('No valid flowchart content in Mermaid example.');
          }
          mermaidData = await mermaidToDiagramData(parsed);
        }
        diagram = mermaidData;
      } else {
        const json = JSON.parse(text);
        diagram = parseUnknownJsonToDiagramData(json);
      }

      const exampleName = exampleId === 'example1' ? 'Example 1' : exampleId === 'example2' ? 'Example 2'
        : exampleId === 'simple' ? 'Mermaid Simple' : exampleId === 'complex' ? 'Mermaid Complex'
        : exampleId === 'class-diagram' ? 'Mermaid Class Diagram'
        : exampleId === 'sequence-diagram' ? 'Mermaid Sequence Diagram' : `Example: ${exampleId}`;
      createTab({ name: exampleName, diagramData: diagram });

      toast({ title: 'Example Loaded', description: `${exampleName} has been loaded in a new tab.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ variant: 'destructive', title: 'Error Loading Example', description: `Could not load example. ${message}` });
    }
  }, [parseUnknownJsonToDiagramData, createTab, toast]);

  const activeTabIdRef = React.useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const tabsRef = React.useRef(tabs);
  tabsRef.current = tabs;

  const handleLoadTutorialExample = React.useCallback(
    async (exampleId: string) => {
      if (!isLoaded) {
        await new Promise((r) => window.setTimeout(r, 450));
      }
      ensureTutorialTab();

      try {
        const res = await fetch(`/examples/tutorial/${exampleId}.json`);
        if (!res.ok) {
          throw new Error(`Failed to load tutorial example: ${res.statusText}`);
        }
        const text = await res.text();
        const json = JSON.parse(text) as unknown;
        const diagram = parseUnknownJsonToDiagramData(json);
        const serialized = JSON.stringify(diagram);
        const tabId = tabsRef.current.find(
          (t) => t.isTutorialTab === true || t.name === TUTORIAL_TAB_NAME
        )?.id;
        if (!tabId) return;

        updateTab(tabId, {
          diagramData: diagram,
          name: TUTORIAL_TAB_NAME,
          selectedItem: null,
          selectedItemIds: new Set(),
          history: [serialized],
          historyIndex: 0,
          isConnectMode: false,
        });
        setHistoryRef(tabId, { history: [serialized], index: 0 });
        switchTab(tabId);
        window.setTimeout(() => editorRef.current?.fitToView(), 150);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast({ variant: 'destructive', title: 'Tutorial example failed', description: message });
      }
    },
    [isLoaded, parseUnknownJsonToDiagramData, setHistoryRef, updateTab, toast, ensureTutorialTab, switchTab]
  );

  /** Mutate the dedicated tutorial tab's diagram (not necessarily the active tab). */
  const updateTutorialDiagramData = React.useCallback(
    (updater: (prev: DiagramData) => DiagramData) => {
      const tabId = tabsRef.current.find(
        (t) => t.isTutorialTab === true || t.name === TUTORIAL_TAB_NAME
      )?.id;
      if (!tabId) return;
      const tab = getTab(tabId);
      if (!tab) return;
      const newData = updater(tab.diagramData);
      const connections = newData.connections || [];
      const needsIds = connections.some((c: DiagramConnectionData) => !(c as DiagramConnectionData).id);
      const ensuredConnections = needsIds ? ensureConnectionIds(connections) : connections;
      const nextData = { ...newData, connections: ensuredConnections };
      updateTab(tabId, { diagramData: nextData });
    },
    [getTab, updateTab],
  );

  const handleTutorialFinish = React.useCallback(() => {
    const list = tabsRef.current;
    const tutorialId = list.find((t) => t.isTutorialTab === true || t.name === TUTORIAL_TAB_NAME)?.id;
    if (!tutorialId) return;
    if (list.filter((t) => !t.isTutorialTab).length === 0) {
      flushSync(() => {
        createTab({ name: 'Diagram 1', silent: true });
      });
    }
    void closeTab(tutorialId, true);
  }, [createTab, closeTab]);

  const handleMenuCopy = React.useCallback(() => {
    if (selectedResource) {
      const item = createPaletteItem(selectedResource.resource, selectedResource.provider, selectedResource.category);
      setPaletteClipboardItem(item);
    } else {
      editorRef.current?.copy();
    }
  }, [selectedResource, setPaletteClipboardItem, editorRef]);

  const handleMenuPaste = React.useCallback(() => {
    if (paletteClipboardItem && editorRef.current) {
      editorRef.current.pastePaletteItem(paletteClipboardItem);
    } else {
      editorRef.current?.paste();
    }
  }, [paletteClipboardItem, editorRef]);

  const handleSelectAll = React.useCallback(() => {
    const allIds = new Set<string>();

    diagramData.nodes.forEach(node => allIds.add(node.id));
    diagramData.connections.forEach(connection => {
      allIds.add((connection as DiagramConnectionData).id ?? `${connection.from}-${connection.to}`);
    });

    setSelectedItemIds(allIds);

    if (allIds.size > 0) {
      const firstId = Array.from(allIds)[0];
      const nodeItem = diagramData.nodes.find(node => node.id === firstId);
      if (nodeItem) {
        setSelectedItem({ ...nodeItem, itemType: 'node' });
        return;
      }
      const connection = diagramData.connections.find(conn =>
        (conn as DiagramConnectionData).id === firstId || `${conn.from}-${conn.to}` === firstId
      );
      if (connection) {
        const connId = (connection as DiagramConnectionData).id ?? firstId;
        setSelectedItem({ ...connection, itemType: 'edge' as const, id: connId });
      }
    } else {
      setSelectedItem(null);
    }
  }, [diagramData, setSelectedItemIds, setSelectedItem]);

  const handleExportPng = async () => {
    setExportDialogFormat('png');
    setExportDialogOpen(true);
  };

  const handleExportGif = async () => {
    setExportDialogFormat('gif');
    setExportDialogOpen(true);
  };

  const handleExport = async (options: {
    format: 'png' | 'gif';
    backgroundColor: 'transparent' | 'white' | 'dark';
    quality?: 'low' | 'medium' | 'high';
    fps?: number;
    durationSeconds?: number;
    /** 1-based slide indices matching deck order (slide 1 = main diagram). */
    pngSlideNumbers?: number[];
    exportBasename?: string;
  }) => {
    setExportDialogOpen(false);
    if (!editorRef.current) return;

    if (options.format === 'gif') {
      await editorRef.current.exportGif({
        backgroundColor: options.backgroundColor,
        quality: options.quality || 'medium',
        fps: options.fps,
        durationSeconds: options.durationSeconds,
      });
      return;
    }

    const basename =
      sanitizeExportBasename(options.exportBasename?.trim() || activeTab?.name || 'diagram') || 'diagram';

    const deck =
      activeDiagramStack.length === 0 && activePresentationDeckId
        ? presentationDecks.find((d) => d.id === activePresentationDeckId)
        : null;
    const totalSlides = deck ? deck.slides.length : 0;
    const wantMulti =
      Boolean(options.pngSlideNumbers && options.pngSlideNumbers.length > 0 && deck && totalSlides >= 1);

    if (wantMulti && deck && totalSlides >= 1) {
      const indices = [...new Set(options.pngSlideNumbers!)].filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= totalSlides,
      );
      if (indices.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Export cancelled',
          description: 'No valid slides in range.',
        });
        return;
      }
      indices.sort((a, b) => a - b);

      const savedSlideId = activePresentationSlideId;
      const savedDraft = presentationDraftDiagram;
      presentationPersistSuppressedForExportRef.current = true;

      const blobs: { slideNumber: number; blob: Blob }[] = [];

      try {
        for (const slideNum of indices) {
          let activeIdForUnion: string | null = null;
          let draftForUnion: DiagramData | null = null;

          const slide = deck.slides[slideNum - 1];
          if (!slide) continue;
          const masterBase = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
          if (deck.slides[0]?.id === slide.id) {
            flushSync(() => {
              setActivePresentationSlideId(slide.id);
              setPresentationDraftDiagram(null);
            });
            activeIdForUnion = slide.id;
            draftForUnion = null;
          } else {
            const resolved =
              savedSlideId === slide.id && savedDraft
                ? savedDraft
                : applyDiagramDelta(masterBase, slide.diagramDelta);
            activeIdForUnion = slide.id;
            draftForUnion = resolved;
            flushSync(() => {
              setActivePresentationSlideId(slide.id);
              setPresentationDraftDiagram(safeClone(resolved));
            });
          }

          await waitTwoAnimationFrames();

          const unionDiagrams = buildPresentationUnionDiagramsForPngExport({
            tabDiagram: tabDiagramData,
            presentationMaster: presentationMasterDiagram,
            deckSlides: deck.slides,
            activeSlideId: activeIdForUnion,
            draft: draftForUnion,
            layersFilteredBase: diagramDataForExportLayersRef.current,
          });

          const dataUrl = await editorRef.current.captureSnapshotPng({
            backgroundColor: options.backgroundColor,
            quality: options.quality || 'medium',
            fitContent: true,
            unionDiagrams,
          });
          const blob = await (await fetch(dataUrl)).blob();
          blobs.push({ slideNumber: slideNum, blob });
        }
      } catch (err) {
        blobs.length = 0;
        console.error('Multi-slide PNG export failed:', err);
        toast({
          variant: 'destructive',
          title: 'Export failed',
          description: 'Could not export one or more slides.',
        });
      } finally {
        flushSync(() => {
          setActivePresentationSlideId(savedSlideId);
          setPresentationDraftDiagram(savedDraft);
        });
        presentationPersistSuppressedForExportRef.current = false;
      }

      if (blobs.length === 0) return;

      const writeViaDirectoryPicker = async (): Promise<boolean> => {
        const w = window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
        if (typeof w.showDirectoryPicker !== 'function') return false;
        try {
          const dir = await w.showDirectoryPicker();
          for (const { slideNumber, blob } of blobs) {
            const name = `${basename}-${slideNumber}.png`;
            const fh = await dir.getFileHandle(name, { create: true });
            const writable = await fh.createWritable();
            await writable.write(blob);
            await writable.close();
          }
          return true;
        } catch (e: unknown) {
          if (e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError') return false;
          return false;
        }
      };

      if (blobs.length === 1) {
        const { slideNumber, blob } = blobs[0]!;
        const suggestedName = `${basename}-${slideNumber}.png`;
        if (typeof window.showSaveFilePicker === 'function') {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName,
              types: [{ description: 'PNG Images', accept: { 'image/png': ['.png'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            toast({ title: 'Exported', description: `${suggestedName} saved.` });
            return;
          } catch (e: unknown) {
            if (e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError') return;
          }
        }
        const link = document.createElement('a');
        link.download = suggestedName;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        toast({ title: 'Exported', description: `${suggestedName} downloaded.` });
        return;
      }

      if (await writeViaDirectoryPicker()) {
        toast({
          title: 'Exported',
          description: `${blobs.length} PNG files saved (${basename}-#.png).`,
        });
        return;
      }

      for (const { slideNumber, blob } of blobs) {
        const name = `${basename}-${slideNumber}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = name;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      toast({
        title: 'Exported',
        description: `${blobs.length} PNG files downloaded (${basename}-#.png).`,
      });
      return;
    }

    await editorRef.current.exportPng({
      backgroundColor: options.backgroundColor,
      quality: options.quality || 'medium',
    });
  };

  const handleTabClose = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.isTutorialTab === true || tab.name === TUTORIAL_TAB_NAME) {
      await closeTab(tabId, true);
      return;
    }

    // Check for unsaved changes
    const currentDataHash = JSON.stringify(activeTab?.diagramData);
    const hasUnsavedChanges = tab.isModified;

    if (hasUnsavedChanges) {
      setPendingCloseTabId(tabId);
      setCloseTabDialogOpen(true);
    } else {
      await closeTab(tabId, true);
    }
  };

  const handleCloseTabConfirm = async () => {
    if (pendingCloseTabId) {
      await closeTab(pendingCloseTabId, true);
      setPendingCloseTabId(null);
    }
    setCloseTabDialogOpen(false);
  };

  const handleCloseTabSave = async () => {
    if (!pendingCloseTabId) return;
    const saved = await handleSave(pendingCloseTabId);
    if (saved) {
      await closeTab(pendingCloseTabId, true);
      setPendingCloseTabId(null);
      setCloseTabDialogOpen(false);
    }
  };

  const handleJsonValidChange = (newDiagramData: DiagramData) => {
    setDiagramData(newDiagramData);
  };

  const handleThemeApplyToSelected = (theme: DiagramTheme, menuOptions?: ThemeMenuApplyOptions) => {
    const multiHue = menuOptions?.multiSelectHueByLayout === true;
    if (!selectedItemIds || selectedItemIds.size === 0) {
      // Apply to single selected item
      if (selectedItem) {
        const updatedItem = themeManager.applyThemeToItem(selectedItem, theme);
        handleItemUpdate(updatedItem as any);
      }
    } else {
      // Apply to multiple selected items - use current diagram (root or sub) for sub-diagram support
      setCurrentDiagramData((prevData) => {
        const orderMap =
          multiHue && selectedItemIds.size > 1
            ? orderSelectedIdsForThemeHue(selectedItemIds, prevData.nodes, prevData.connections ?? [])
            : null;

        const stepDeg =
          menuOptions?.multiSelectHueStepDegrees ?? DIAGRAM_THEME_HUE_STEP_DEG;
        const hueShiftForId = (id: string): number => {
          if (!orderMap) return 0;
          const idx = orderMap.get(id) ?? 0;
          return idx * stepDeg;
        };

        const updatedNodes = prevData.nodes.map((node) => {
          if (selectedItemIds.has(node.id)) {
            const hueShift = hueShiftForId(node.id);
            return themeManager.applyThemeToItem(node, theme, { hueShiftDegrees: hueShift }) as DiagramNodeData;
          }
          return node;
        });
        const updatedConnections = (prevData.connections ?? []).map((connection) => {
          const connId = (connection as DiagramConnectionData).id ?? `${connection.from}-${connection.to}`;
          if (selectedItemIds.has(connId)) {
            const hueShift = hueShiftForId(connId);
            return themeManager.applyThemeToItem(connection, theme, { hueShiftDegrees: hueShift }) as DiagramConnectionData;
          }
          return connection;
        });
        return { ...prevData, nodes: updatedNodes, connections: updatedConnections };
      });
      const count = selectedItemIds.size;
      toast({
        title: 'Theme Applied',
        description: `Applied "${theme.name}" theme to ${count} item${count > 1 ? 's' : ''}.`,
      });
    }
  };

  const handleMoveToBack = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToBack(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleMoveToFront = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemToFront(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleMoveOneBack = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneBack(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleMoveOneForward = React.useCallback(() => {
    if (!selectedItem || selectedItem.itemType === 'edge') return;
    const updatedData = moveItemOneForward(currentDiagramData, selectedItem.id, selectedItem.itemType);
    setCurrentDiagramData(updatedData);
  }, [selectedItem, currentDiagramData, setCurrentDiagramData]);

  const handleAlignObjects = (alignment: 'top' | 'center' | 'bottom' | 'v-middle' | 'left' | 'h-center' | 'right' | 'distribute-v' | 'distribute-h') => {
    if (!selectedItem || selectedItemIds.size < 2) return;

    // Get the reference item (first selected item) and store it permanently
    // Use current diagram (root or sub) for sub-diagram support
    const firstSelectedId = Array.from(selectedItemIds)[0];
    const referenceNode = currentDiagramData.nodes.find(n => n.id === firstSelectedId);
    if (!referenceNode) return;
    
    const referenceItem = { ...referenceNode, itemType: 'node' } as SelectedItem;
    
    // Helper function to get object dimensions
    const getObjectDimensions = (item: SelectedItem): { width: number; height: number } => {
      if (item.itemType === 'node') {
        const node = item as any;
        
        // Check if it's a shape node
        const isShapeNode = node.type === 'generic.object.square' ||
                           node.type === 'generic.object.circle' ||
                           node.type === 'generic.object.point' ||
                           node.type === 'generic.object.rectangle' ||
                           node.type === 'generic.object.uml-class' ||
                           node.type === 'generic.object.rounded-rectangle' ||
                           node.type === 'generic.object.text-box-heading' ||
                           node.type === 'generic.object.triangle' ||
                           node.type === 'generic.object.star' ||
                           node.type === 'generic.object.cloud';
        
        // Check if it's a textbox or plain text node (same custom sizing behavior)
        const isTextboxNode = node.type === 'generic.text.textbox';
        const isPlainTextNode = node.type === 'generic.text.text';
        
        // Use custom dimensions if sizeMode is 'custom' and dimensions are provided
        if ((isTextboxNode || isPlainTextNode || isShapeNode) && node.sizeMode === 'custom' && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Shapes always use their custom width/height if set
        if (isShapeNode && node.width && node.height) {
          return { width: node.width, height: node.height };
        }
        
        // Default dimensions based on node type
        if (node.type === 'generic.object.text-box-heading' || node.type?.endsWith('.text-box-heading')) {
          return { width: 180, height: 90 };
        }
        if (node.type?.startsWith('generic.text')) {
          if (node.type === 'generic.text.textbox' || node.type === 'generic.text.text') {
            return { width: 120, height: 60 };
          }
          return { width: 100, height: 40 };
        }
        
        // Default for icon nodes
        return { width: 80, height: 50 };
      }
      return { width: 80, height: 50 };
    };

    // Calculate reference position based on alignment
    const refDims = getObjectDimensions(referenceItem);
    const refX = (referenceItem as any).x || 0;
    const refY = (referenceItem as any).y || 0;
    let referenceX: number;
    let referenceY: number;

    // Handle vertical alignment
    switch (alignment) {
      case 'top':
        referenceY = refY;
        break;
      case 'v-middle':
        referenceY = refY + (refDims.height / 2);
        break;
      case 'bottom':
        referenceY = refY + refDims.height;
        break;
      default:
        // For horizontal alignment, use center Y as default
        referenceY = refY + (refDims.height / 2);
        break;
    }

    // Handle horizontal alignment
    switch (alignment) {
      case 'left':
        referenceX = refX;
        break;
      case 'h-center':
        referenceX = refX + (refDims.width / 2);
        break;
      case 'right':
        referenceX = refX + refDims.width;
        break;
      default:
        // For vertical alignment, use center X as default
        referenceX = refX + (refDims.width / 2);
        break;
    }

    // Handle distribute operations
    if (alignment === 'distribute-v' || alignment === 'distribute-h') {
      // Get all selected items with their positions and dimensions
      const selectedItems: Array<{id: string, x: number, y: number, width: number, height: number, itemType: 'node', index: number}> = [];
      
      selectedItemIds.forEach(id => {
        const node = currentDiagramData.nodes.find(n => n.id === id);
        if (node) {
          const dims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          selectedItems.push({
            id,
            x: node.x || 0,
            y: node.y || 0,
            width: dims.width,
            height: dims.height,
            itemType: 'node',
            index: currentDiagramData.nodes.findIndex(n => n.id === id)
          });
        }
      });

      if (selectedItems.length < 3) return; // Need at least 3 items to distribute

      // Sort items by position
      if (alignment === 'distribute-v') {
        selectedItems.sort((a, b) => a.y - b.y);
      } else {
        selectedItems.sort((a, b) => a.x - b.x);
      }

      // Calculate distribution
      const firstItem = selectedItems[0];
      const lastItem = selectedItems[selectedItems.length - 1];
      
      let newPositions: Array<{id: string, x?: number, y?: number}> = [];

      if (alignment === 'distribute-v') {
        // Vertical distribution
        const totalHeight = lastItem.y + lastItem.height - firstItem.y;
        const totalItemHeight = selectedItems.reduce((sum, item) => sum + item.height, 0);
        const totalSpacing = totalHeight - totalItemHeight;
        const spacing = totalSpacing / (selectedItems.length - 1);
        
        let currentY = firstItem.y;
        selectedItems.forEach(item => {
          newPositions.push({ id: item.id, y: currentY });
          currentY += item.height + spacing;
        });
      } else {
        // Horizontal distribution
        const totalWidth = lastItem.x + lastItem.width - firstItem.x;
        const totalItemWidth = selectedItems.reduce((sum, item) => sum + item.width, 0);
        const totalSpacing = totalWidth - totalItemWidth;
        const spacing = totalSpacing / (selectedItems.length - 1);
        
        let currentX = firstItem.x;
        selectedItems.forEach(item => {
          newPositions.push({ id: item.id, x: currentX });
          currentX += item.width + spacing;
        });
      }

      // Apply the new positions (use current diagram for sub-diagram support)
      setCurrentDiagramData(prevData => {
        const newNodes = [...prevData.nodes];
        newPositions.forEach(pos => {
          const nodeIndex = newNodes.findIndex(n => n.id === pos.id);
          if (nodeIndex !== -1) {
            newNodes[nodeIndex] = { ...newNodes[nodeIndex], ...pos };
          }
        });
        return { ...prevData, nodes: newNodes };
      });

      const updatedSelectedItems: SelectedItem[] = [];
      selectedItemIds.forEach(id => {
        const updatedNode = currentDiagramData.nodes.find(n => n.id === id);
        if (updatedNode) {
          updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
        }
      });

      // Update the primary selected item if it was distributed
      if (selectedItem && selectedItem.id !== firstSelectedId) {
        const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }

      return;
    }

    // Align all selected items (use current diagram for sub-diagram support)
    setCurrentDiagramData(prevData => {
      const newNodes = [...prevData.nodes];

      selectedItemIds.forEach(id => {
        if (id === firstSelectedId) return;

        const nodeIndex = newNodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          const node = newNodes[nodeIndex];
          const nodeDims = getObjectDimensions({ ...node, itemType: 'node' } as SelectedItem);
          let newX = node.x;
          let newY = node.y;
          
          switch (alignment) {
            case 'top':
              newY = referenceY;
              break;
            case 'v-middle':
              newY = referenceY - (nodeDims.height / 2);
              break;
            case 'bottom':
              newY = referenceY - nodeDims.height;
              break;
          }
          
          switch (alignment) {
            case 'left':
              newX = referenceX;
              break;
            case 'h-center':
              newX = referenceX - (nodeDims.width / 2);
              break;
            case 'right':
              newX = referenceX - nodeDims.width;
              break;
            case 'center':
              newX = referenceX - (nodeDims.width / 2);
              break;
          }
          
          newNodes[nodeIndex] = { ...node, x: newX, y: newY };
        }
      });

      return { ...prevData, nodes: newNodes };
    });

    const updatedSelectedItems: SelectedItem[] = [];
    selectedItemIds.forEach(id => {
      const updatedNode = currentDiagramData.nodes.find(n => n.id === id);
      if (updatedNode) {
        updatedSelectedItems.push({ ...updatedNode, itemType: 'node' } as SelectedItem);
      }
    });

    // Update the primary selected item if it was aligned
    if (selectedItem && selectedItem.id !== referenceItem.id) {
      const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
      if (updatedPrimary) {
        setSelectedItem(updatedPrimary);
      }
    }
  };

  /**
   * Linear steps (menu): **Horizontal step** sorts **leftmost** first (**`x`** then **`y`**), steps **y** only (matches
   * horizontal curve’s **y** bulge axis; negative **step** → **up**). **Vertical step** sorts **topmost** first (**`y`**
   * then **`x`**), steps **x** only (matches vertical curve’s **x** bulge axis; negative **step** → **right**).
   * **vertical-curve** keeps **selection order**; **horizontal-curve** sorts **left→right**
   * (**`x`** then **`y`**) so **leftmost** is first and **rightmost** is last.
   * **Curved** variants: **vertical-curve** — first item fixed; last item’s **x** matches first (same column), **y**
   * unchanged; middle **y** interpolates first→last, **x** uses `x0 + bulge·4·t·(1−t)`. **horizontal-curve** — **x**
   * unchanged per item; last **y** matches first; middle **y** = chord plus bulge. **Bulge** from **Step amount**:
   * **`max(GRID, |steps|·GRID)`**. ≥3 canvas items. Negative **step** flips bulge side.
   */
  const handleLayoutGridStep = (
    direction:
      | 'horizontal-left'
      | 'vertical-down'
      | 'horizontal-curve'
      | 'vertical-curve',
    stepAmount: number,
  ) => {
    if (isReadOnly) return;
    const raw = Math.trunc(Number(stepAmount));
    const steps =
      !Number.isFinite(raw) || raw === 0
        ? 1
        : Math.max(-99, Math.min(99, raw));
    const zones = currentDiagramData.zones || [];
    const canvasTargets: string[] = [];
    for (const id of selectedItemIds) {
      if (
        currentDiagramData.nodes.some((n) => n.id === id) ||
        zones.some((z) => z.id === id)
      ) {
        canvasTargets.push(id);
      }
    }

    const getSnappedPos = (
      data: DiagramData,
      id: string,
    ): { x: number; y: number } => {
      const node = data.nodes.find((nn) => nn.id === id);
      if (node) {
        return { x: snapToGrid(node.x || 0), y: snapToGrid(node.y || 0) };
      }
      const z = (data.zones || []).find((zz) => zz.id === id);
      return { x: snapToGrid(z?.x || 0), y: snapToGrid(z?.y || 0) };
    };

    if (direction === 'horizontal-curve' || direction === 'vertical-curve') {
      if (canvasTargets.length < 3) return;
      let orderedTargets = [...canvasTargets];
      if (direction === 'horizontal-curve') {
        orderedTargets.sort((a, b) => {
          const pa = getSnappedPos(currentDiagramData, a);
          const pb = getSnappedPos(currentDiagramData, b);
          if (pa.x !== pb.x) return pa.x - pb.x;
          return pa.y - pb.y;
        });
      }
      const n = orderedTargets.length;
      const indexById = new Map(orderedTargets.map((id, i) => [id, i]));
      const targetSet = new Set(orderedTargets);
      const curveW = (t: number) => 4 * t * (1 - t);

      const hasMovableMiddle = orderedTargets.slice(1, -1).some((id) => {
        const node = currentDiagramData.nodes.find((x) => x.id === id);
        if (node) return !node.locked;
        return zones.some((z) => z.id === id);
      });
      if (!hasMovableMiddle) return;

      setCurrentDiagramData((prev) => {
        const zlist = prev.zones || [];
        const p0 = getSnappedPos(prev, orderedTargets[0]);
        const p1 = getSnappedPos(prev, orderedTargets[n - 1]);
        const spanY = p1.y - p0.y;
        const bulgeMag = snapToGrid(
          Math.max(GRID_STEP, Math.abs(steps) * GRID_STEP),
        );
        const bulge = bulgeMag * (Math.sign(steps) || 1);

        const applyCurveNode = (node: (typeof prev.nodes)[0], idx: number) => {
          if (idx === 0) return node;
          if (idx === n - 1) {
            if (node.locked) return node;
            if (direction === 'vertical-curve') {
              return { ...node, x: p0.x, y: p1.y };
            }
            return {
              ...node,
              x: snapToGrid(node.x || 0),
              y: p0.y,
            };
          }
          if (node.locked) return node;
          const t = idx / (n - 1);
          const w = curveW(t);
          if (direction === 'vertical-curve') {
            const yLine = p0.y + spanY * t;
            return {
              ...node,
              x: snapToGrid(p0.x + bulge * w),
              y: snapToGrid(yLine),
            };
          }
          const xKeep = snapToGrid(node.x || 0);
          const yLine = p0.y + spanY * t + bulge * w;
          return {
            ...node,
            x: xKeep,
            y: snapToGrid(yLine),
          };
        };

        const applyCurveZone = (z: (typeof zlist)[0], idx: number) => {
          if (idx === 0) return z;
          if (idx === n - 1) {
            if (direction === 'vertical-curve') {
              return { ...z, x: p0.x, y: p1.y };
            }
            return {
              ...z,
              x: snapToGrid(z.x || 0),
              y: p0.y,
            };
          }
          const t = idx / (n - 1);
          const w = curveW(t);
          if (direction === 'vertical-curve') {
            const yLine = p0.y + spanY * t;
            return {
              ...z,
              x: snapToGrid(p0.x + bulge * w),
              y: snapToGrid(yLine),
            };
          }
          const xKeep = snapToGrid(z.x || 0);
          const yLine = p0.y + spanY * t + bulge * w;
          return {
            ...z,
            x: xKeep,
            y: snapToGrid(yLine),
          };
        };

        const newNodes = prev.nodes.map((node) => {
          if (!targetSet.has(node.id)) return node;
          const idx = indexById.get(node.id)!;
          return applyCurveNode(node, idx);
        });
        const newZones = zlist.map((z) => {
          if (!targetSet.has(z.id)) return z;
          const idx = indexById.get(z.id)!;
          return applyCurveZone(z, idx);
        });
        return { ...prev, nodes: newNodes, zones: newZones };
      });

      if (
        selectedItem &&
        selectedItem.itemType !== 'edge' &&
        orderedTargets.includes(selectedItem.id)
      ) {
        const idx = indexById.get(selectedItem.id)!;
        const primaryNode = currentDiagramData.nodes.find(
          (nn) => nn.id === selectedItem.id,
        );
        const primaryIsZone = zones.some((z) => z.id === selectedItem.id);
        if (primaryNode?.locked && idx !== 0) return;
        if (!primaryNode && !primaryIsZone) return;
        const p0c = getSnappedPos(currentDiagramData, orderedTargets[0]);
        const p1c = getSnappedPos(
          currentDiagramData,
          orderedTargets[n - 1],
        );
        const sY = p1c.y - p0c.y;
        const bulgeMagC = snapToGrid(
          Math.max(GRID_STEP, Math.abs(steps) * GRID_STEP),
        );
        const bulgeC = bulgeMagC * (Math.sign(steps) || 1);
        if (idx === 0) return;
        if (idx === n - 1) {
          if (primaryNode?.locked) return;
          if (direction === 'vertical-curve') {
            setSelectedItem({
              ...selectedItem,
              x: p0c.x,
              y: p1c.y,
            } as SelectedItem);
          } else {
            setSelectedItem({
              ...selectedItem,
              x: snapToGrid(selectedItem.x || 0),
              y: p0c.y,
            } as SelectedItem);
          }
          return;
        }
        const t = idx / (n - 1);
        const w = curveW(t);
        if (direction === 'vertical-curve') {
          setSelectedItem({
            ...selectedItem,
            x: snapToGrid(p0c.x + bulgeC * w),
            y: snapToGrid(p0c.y + sY * t),
          } as SelectedItem);
        } else {
          setSelectedItem({
            ...selectedItem,
            x: snapToGrid(selectedItem.x || 0),
            y: snapToGrid(p0c.y + sY * t + bulgeC * w),
          } as SelectedItem);
        }
      }
      return;
    }

    if (canvasTargets.length < 2) return;

    const layoutPosForStepSort = (id: string) => {
      const node = currentDiagramData.nodes.find((nn) => nn.id === id);
      if (node) {
        return { x: snapToGrid(node.x || 0), y: snapToGrid(node.y || 0) };
      }
      const z = zones.find((zz) => zz.id === id);
      return { x: snapToGrid(z?.x || 0), y: snapToGrid(z?.y || 0) };
    };

    const orderedTargets = [...canvasTargets];
    if (direction === 'horizontal-left') {
      orderedTargets.sort((a, b) => {
        const pa = layoutPosForStepSort(a);
        const pb = layoutPosForStepSort(b);
        if (pa.x !== pb.x) return pa.x - pb.x;
        return pa.y - pb.y;
      });
    } else if (direction === 'vertical-down') {
      orderedTargets.sort((a, b) => {
        const pa = layoutPosForStepSort(a);
        const pb = layoutPosForStepSort(b);
        if (pa.y !== pb.y) return pa.y - pb.y;
        return pa.x - pb.x;
      });
    }

    const anchorId = orderedTargets[0];
    const anchorNodePre = currentDiagramData.nodes.find((n) => n.id === anchorId);
    const anchorZonePre = anchorNodePre ? null : zones.find((z) => z.id === anchorId);
    const ax = snapToGrid(anchorNodePre?.x ?? anchorZonePre?.x ?? 0);
    const ay = snapToGrid(anchorNodePre?.y ?? anchorZonePre?.y ?? 0);

    const indexById = new Map(orderedTargets.map((id, i) => [id, i]));
    const targetSet = new Set(orderedTargets);

    const hasMovableStep =
      orderedTargets.slice(1).some((id) => {
        const n = currentDiagramData.nodes.find((x) => x.id === id);
        if (n) return !n.locked;
        return zones.some((z) => z.id === id);
      });
    if (!hasMovableStep) return;

    setCurrentDiagramData((prev) => {
      const zlist = prev.zones || [];
      const newNodes = prev.nodes.map((n) => {
        if (!targetSet.has(n.id)) return n;
        const idx = indexById.get(n.id)!;
        if (idx === 0) return n;
        if (n.locked) return n;
        if (direction === 'vertical-down') {
          return {
            ...n,
            x: snapToGrid(ax - idx * steps * GRID_STEP),
            y: snapToGrid(n.y || 0),
          };
        }
        return {
          ...n,
          x: snapToGrid(n.x || 0),
          y: snapToGrid(ay + idx * steps * GRID_STEP),
        };
      });
      const newZones = zlist.map((z) => {
        if (!targetSet.has(z.id)) return z;
        const idx = indexById.get(z.id)!;
        if (idx === 0) return z;
        if (direction === 'vertical-down') {
          return {
            ...z,
            x: snapToGrid(ax - idx * steps * GRID_STEP),
            y: snapToGrid(z.y || 0),
          };
        }
        return {
          ...z,
          x: snapToGrid(z.x || 0),
          y: snapToGrid(ay + idx * steps * GRID_STEP),
        };
      });
      return { ...prev, nodes: newNodes, zones: newZones };
    });

    if (selectedItem && selectedItem.itemType !== 'edge' && indexById.has(selectedItem.id)) {
      const idx = indexById.get(selectedItem.id)!;
      if (idx === 0) return;
      const primaryNode = currentDiagramData.nodes.find((n) => n.id === selectedItem.id);
      const primaryIsZone = zones.some((z) => z.id === selectedItem.id);
      if (primaryNode?.locked) return;
      if (!primaryNode && !primaryIsZone) return;
      if (direction === 'vertical-down') {
        setSelectedItem({
          ...selectedItem,
          x: snapToGrid(ax - idx * steps * GRID_STEP),
          y: snapToGrid(selectedItem.y || 0),
        } as SelectedItem);
      } else {
        setSelectedItem({
          ...selectedItem,
          x: snapToGrid(selectedItem.x || 0),
          y: snapToGrid(ay + idx * steps * GRID_STEP),
        } as SelectedItem);
      }
    }
  };

  const handleAutoLayout = () => {
    try {
      const newData = performAutoLayout(currentDiagramData);
      setCurrentDiagramData(newData);
      toast({ 
        title: 'Auto Layout Applied', 
        description: 'Diagram has been automatically arranged.' 
      });
    } catch (error) {
      console.error('Auto layout failed:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Auto Layout Failed', 
        description: 'Could not apply auto layout.' 
      });
    }
  };

  const handleSelectPresentationBaseSlide = React.useCallback(async () => {
    const pid = activePresentationDeck?.slides[0]?.id;
    if (!pid || activePresentationSlideId === pid) return;
    await captureOutgoingSlideThumbnailIfNeeded();
    setActivePresentationSlideId(pid);
    setPresentationDraftDiagram(null);
    setSelectedPresentationSlideIds(new Set());
  }, [
    activePresentationDeck,
    activePresentationSlideId,
    captureOutgoingSlideThumbnailIfNeeded,
  ]);

  const runPresentationAutoZoom = React.useCallback(async () => {

    if (activePresentationSlideDiagrams.length > 0) {
      const diagrams = activePresentationSlideDiagrams.map((d) => pruneConnectionsToVisibleNodes(d));
      const t = computeUnionFitTransformForDiagrams(
        diagrams,
        typeof window !== 'undefined' ? window.innerWidth : 1280,
        typeof window !== 'undefined' ? window.innerHeight : 720
      );
      if (t && Number.isFinite(t.k) && t.k > 0) {
        return Number(t.k.toFixed(4));
      }
      toast({
        variant: 'destructive',
        title: 'Auto Zoom Failed',
        description: 'Could not compute bounds from all slide snapshots.',
      });
      return null;
    }

    if (!editorRef.current?.fitToView) {
      toast({ variant: 'destructive', title: 'Auto Zoom Failed', description: 'Canvas auto zoom API is unavailable.' });
      return null;
    }

    editorRef.current.fitToView();
    await new Promise((resolve) => window.setTimeout(resolve, 140));
    const zoom = canvasTransformRef.current.k;
    if (!Number.isFinite(zoom) || zoom <= 0) {
      toast({ variant: 'destructive', title: 'Auto Zoom Failed', description: 'Could not compute an optimized zoom level.' });
      return null;
    }

    return Number(zoom.toFixed(4));
  }, [activePresentationSlideDiagrams, toast]);

  const handleAutoZoomPresentation = React.useCallback(async () => {
    if (!activePresentationDeckId) return;
    const autoZoomLevel = await runPresentationAutoZoom();
    if (autoZoomLevel === null) return;

    if (!activePresentationDeck || activePresentationDeck.slides.length === 0) {
      toast({
        title: 'Auto Zoom Applied',
        description: `Optimized zoom set to ${(autoZoomLevel * 100).toFixed(1)}%. Add snapshots to apply this value.`,
      });
      return;
    }

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: deck.slides.map((slide) => ({
          ...slide,
          autoZoomLevel,
          viewPanX: undefined,
          viewPanY: undefined,
        })),
        updatedAt: Date.now(),
      };
    }));

    toast({
      title: 'Auto Zoom Applied To Presentation',
      description: `All ${activePresentationDeck.slides.length} snapshot(s) now use ${(autoZoomLevel * 100).toFixed(1)}% zoom.`,
    });
  }, [activePresentationDeckId, activePresentationDeck, runPresentationAutoZoom, toast]);

  const resolvePresentationZoomLevel = React.useCallback((overrideZoomLevel?: number): number | null => {
    const candidate = overrideZoomLevel ?? canvasTransformRef.current.k;
    if (!Number.isFinite(candidate) || candidate <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Zoom', description: 'Could not read a valid zoom level from the canvas.' });
      return null;
    }
    return Number(Math.min(2.5, Math.max(0.1, candidate)).toFixed(4));
  }, [toast]);

  const applyZoomToCanvas = React.useCallback((zoomLevel: number) => {
    const current = canvasTransformRef.current;
    const next = { ...current, k: zoomLevel };
    setCanvasTransform(next);
    canvasTransformRef.current = next;
  }, [setCanvasTransform]);

  const handleApplyPresentationZoomToCurrent = React.useCallback((overrideZoomLevel?: number) => {
    if (!activePresentationDeckId) return;
    const zoomLevel = resolvePresentationZoomLevel(overrideZoomLevel);
    if (zoomLevel === null) return;

    if (isPrimaryPresentationSlideActive) {
      applyZoomToCanvas(zoomLevel);
      const c = canvasTransformRef.current;
      const vs = sanitizeViewState(c);
      if (vs) {
        setDiagramData((prev) => {
          const current = getDiagramAtStack(prev, activeDiagramStack);
          return updateDiagramAtStack(prev, activeDiagramStack, () => ({
            ...current,
            viewState: vs,
          }));
        });
      }
      toast({ title: 'Zoom Applied', description: `Diagram zoom set to ${(zoomLevel * 100).toFixed(1)}%.` });
      return;
    }

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: deck.slides.map((slide) => (
          slide.id === activePresentationSlideId
            ? {
                ...slide,
                autoZoomLevel: zoomLevel,
                viewPanX: canvasTransformRef.current.x,
                viewPanY: canvasTransformRef.current.y,
              }
            : slide
        )),
        updatedAt: Date.now(),
      };
    }));

    applyZoomToCanvas(zoomLevel);
    toast({ title: 'Zoom Applied', description: `Active snapshot zoom set to ${(zoomLevel * 100).toFixed(1)}%.` });
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    isPrimaryPresentationSlideActive,
    resolvePresentationZoomLevel,
    applyZoomToCanvas,
    toast,
    activeDiagramStack,
    setDiagramData,
  ]);

  const handleApplyPresentationZoomToAll = React.useCallback((overrideZoomLevel?: number) => {
    if (!activePresentationDeckId || !activePresentationDeck || activePresentationDeck.slides.length === 0) return;
    const zoomLevel = resolvePresentationZoomLevel(overrideZoomLevel);
    if (zoomLevel === null) return;

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: deck.slides.map((slide) => ({
          ...slide,
          autoZoomLevel: zoomLevel,
          viewPanX: undefined,
          viewPanY: undefined,
        })),
        updatedAt: Date.now(),
      };
    }));

    applyZoomToCanvas(zoomLevel);
    toast({ title: 'Zoom Applied', description: `All ${activePresentationDeck.slides.length} snapshots set to ${(zoomLevel * 100).toFixed(1)}%.` });
  }, [
    activePresentationDeckId,
    activePresentationDeck,
    resolvePresentationZoomLevel,
    applyZoomToCanvas,
    toast,
  ]);

  const capturePresentationSlidePayload = React.useCallback(async (autoZoomLevel?: number) => {
    if (!editorRef.current?.captureSnapshotPng) {
      throw new Error('Canvas snapshot API is unavailable.');
    }

    const snapshotImage = await editorRef.current.captureSnapshotPng({
      backgroundColor: 'white',
      quality: 'medium',
    });

    const visibleCurrent = projectVisibleDiagram(layers.filteredDiagramData ?? diagramData);
    const masterBase = projectVisibleDiagram(presentationMasterDiagram ?? diagramData);

    let diagramDelta: DiagramDelta;
    try {
      diagramDelta = computeDiagramDelta(masterBase, visibleCurrent);
      // Validate round-trip correctness for stored deltas.
      applyDiagramDelta(masterBase, diagramDelta);
    } catch {
      // Fallback to full replace when delta generation hits non-serializable edge cases.
      diagramDelta = {
        version: '1.0',
        compressed: true,
        operations: [{ op: 'replace' as const, path: '', value: safeClone(visibleCurrent) }],
      };
    }

    return {
      snapshotImage,
      diagramDelta,
      animationState: {
        enabled: animationConnectionsEnabled,
        filterSourceIds: effectiveAnimationFilterIds ? Array.from(effectiveAnimationFilterIds) : undefined,
        disabledSourceIds: animationDisabledSources.size > 0 ? Array.from(animationDisabledSources) : undefined,
      },
      autoZoomLevel: autoZoomLevel ?? canvasTransformRef.current.k,
      viewPanX: canvasTransformRef.current.x,
      viewPanY: canvasTransformRef.current.y,
      visibleLayerIds: listVisibleLayerIds(diagramData),
    };
  }, [
    layers.filteredDiagramData,
    diagramData,
    presentationMasterDiagram,
    animationConnectionsEnabled,
    effectiveAnimationFilterIds,
    animationDisabledSources,
  ]);

  const handleAddPresentationSnapshot = React.useCallback(async () => {
    if (!activePresentationDeckId) return;

    try {
      const payload = await capturePresentationSlidePayload();

      const slide: Slide = {
        id: `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...payload,
        title: `Slide ${(activePresentationDeck?.slides.length ?? 0) + 1}`,
        createdAt: Date.now(),
      };

      await captureOutgoingSlideThumbnailIfNeeded();

      setPresentationDecks((prev) => prev.map((deck) => {
        if (deck.id !== activePresentationDeckId) return deck;
        return {
          ...deck,
          slides: [...deck.slides, slide],
          updatedAt: Date.now(),
        };
      }));
      setActivePresentationSlideId(slide.id);
      setSelectedPresentationSlideIds(new Set());
      toast({ title: 'Snapshot Added', description: 'Captured current visible canvas state.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not capture snapshot';
      const lower = message.toLowerCase();
      const isChunkLoadError =
        lower.includes('failed to load chunk') ||
        lower.includes('chunkloaderror') ||
        (lower.includes('/_next/static/chunks/') && lower.includes('module'));

      if (isChunkLoadError) {
        toast({
          variant: 'destructive',
          title: 'Snapshot Failed',
          description: 'App updated in background. Reloading to sync assets...',
        });
        setTimeout(() => window.location.reload(), 150);
        return;
      }
      toast({ variant: 'destructive', title: 'Snapshot Failed', description: message });
    }
  }, [
    activePresentationDeckId,
    captureOutgoingSlideThumbnailIfNeeded,
    capturePresentationSlidePayload,
    activePresentationDeck?.slides.length,
    toast,
  ]);

  const handleRemovePresentationSlides = React.useCallback(() => {
    if (!activePresentationDeckId || !activePresentationDeck) return;
    const primaryId = activePresentationDeck.slides[0]?.id;
    const rawIds = selectedPresentationSlideIds.size > 0
      ? selectedPresentationSlideIds
      : new Set(activePresentationSlideId ? [activePresentationSlideId] : []);
    const idsToRemove = new Set([...rawIds].filter((id) => id !== primaryId));
    if (idsToRemove.size === 0) return;

    const nextSlides = activePresentationDeck.slides.filter((slide) => !idsToRemove.has(slide.id));
    const currentStillExists = activePresentationSlideId
      ? nextSlides.some((slide) => slide.id === activePresentationSlideId)
      : false;
    const nextActiveSlideId = currentStillExists
      ? activePresentationSlideId!
      : nextSlides[0]!.id;

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: nextSlides,
        updatedAt: Date.now(),
      };
    }));
    setActivePresentationSlideId(nextActiveSlideId);
    setSelectedPresentationSlideIds(new Set());
    const slide = nextSlides.find((s) => s.id === nextActiveSlideId);
    if (slide && slide.id === primaryId) {
      setPresentationDraftDiagram(null);
    } else if (slide) {
      const master = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
      setPresentationDraftDiagram(applyDiagramDelta(master, slide.diagramDelta));
    }
  }, [
    activePresentationDeckId,
    activePresentationDeck,
    activePresentationSlideId,
    selectedPresentationSlideIds,
    presentationMasterDiagram,
    tabDiagramData,
  ]);

  const handleDeletePresentationSlide = React.useCallback((slideId: string) => {
    if (!activePresentationDeckId || !activePresentationDeck) return;
    if (activePresentationDeck.slides[0]?.id === slideId) {
      toast({
        variant: 'destructive',
        title: 'Cannot delete',
        description: 'The first slide is the main diagram and cannot be removed.',
      });
      return;
    }
    const targetSlide = activePresentationDeck.slides.find((slide) => slide.id === slideId);
    if (!targetSlide) return;

    const confirmed = window.confirm(`Delete slide "${targetSlide.title || 'Untitled'}"?`);
    if (!confirmed) return;

    const nextSlides = activePresentationDeck.slides.filter((slide) => slide.id !== slideId);
    const nextActiveSlideId =
      activePresentationSlideId === slideId
        ? (nextSlides[0]?.id ?? null)
        : (activePresentationSlideId ?? nextSlides[0]?.id ?? null);

    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      return {
        ...deck,
        slides: nextSlides,
        updatedAt: Date.now(),
      };
    }));

    setActivePresentationSlideId(nextActiveSlideId);
    setSelectedPresentationSlideIds(new Set());

    if (nextActiveSlideId) {
      const nextSlide = nextSlides.find((slide) => slide.id === nextActiveSlideId);
      if (nextSlide) {
        if (nextSlides[0]?.id === nextSlide.id) {
          setPresentationDraftDiagram(null);
        } else {
          const master = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
          setPresentationDraftDiagram(applyDiagramDelta(master, nextSlide.diagramDelta));
        }
      }
    } else {
      setPresentationDraftDiagram(null);
    }

    toast({ title: 'Slide deleted', description: 'The slide has been removed from this presentation.' });
  }, [
    activePresentationDeckId,
    activePresentationDeck,
    activePresentationSlideId,
    presentationMasterDiagram,
    tabDiagramData,
    toast,
  ]);

  const handleMovePresentationSlide = React.useCallback((fromIndex: number, toIndex: number) => {
    if (!activePresentationDeckId || fromIndex === toIndex) return;
    if (fromIndex === 0 || toIndex === 0) return;
    setPresentationDecks((prev) => prev.map((deck) => {
      if (deck.id !== activePresentationDeckId) return deck;
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= deck.slides.length || toIndex >= deck.slides.length) return deck;
      const nextSlides = [...deck.slides];
      const [moved] = nextSlides.splice(fromIndex, 1);
      nextSlides.splice(toIndex, 0, moved);
      return {
        ...deck,
        slides: nextSlides,
        updatedAt: Date.now(),
      };
    }));
  }, [activePresentationDeckId]);

  const handleSelectPresentationSlide = React.useCallback(async (slideId: string) => {
    if (slideId === activePresentationSlideId) return;
    await captureOutgoingSlideThumbnailIfNeeded();
    setActivePresentationSlideId(slideId);
    setSelectedPresentationSlideIds(new Set());
    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const slide = deck?.slides.find((s) => s.id === slideId);
    if (slide && deck) {
      if (deck.slides[0]?.id === slide.id) {
        setPresentationDraftDiagram(null);
      } else {
        const master = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
        setPresentationDraftDiagram(applyDiagramDelta(master, slide.diagramDelta));
      }
    }
  }, [
    activePresentationSlideId,
    activePresentationDeckId,
    captureOutgoingSlideThumbnailIfNeeded,
    presentationDecks,
    presentationMasterDiagram,
    tabDiagramData,
  ]);

  const handleTogglePresentationSlideSelection = React.useCallback((slideId: string, checked: boolean) => {
    setSelectedPresentationSlideIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(slideId);
      else next.delete(slideId);
      return next;
    });
  }, []);

  const handlePreviousPresentationSlide = React.useCallback(async () => {
    if (activePresentationSlides.length === 0) return;
    const currentIndex = activePresentationSlides.findIndex((slide) => slide.id === activePresentationSlideId);
    if (currentIndex <= 0) {
      await handleSelectPresentationSlide(
        activePresentationSlides[activePresentationSlides.length - 1].id,
      );
      return;
    }
    await handleSelectPresentationSlide(activePresentationSlides[currentIndex - 1].id);
  }, [activePresentationSlides, activePresentationSlideId, handleSelectPresentationSlide]);

  const handleNextPresentationSlide = React.useCallback(async () => {
    if (activePresentationSlides.length === 0) return;
    const currentIndex = activePresentationSlides.findIndex((slide) => slide.id === activePresentationSlideId);
    if (currentIndex < 0 || currentIndex >= activePresentationSlides.length - 1) {
      await handleSelectPresentationSlide(activePresentationSlides[0].id);
      return;
    }
    await handleSelectPresentationSlide(activePresentationSlides[currentIndex + 1].id);
  }, [activePresentationSlides, activePresentationSlideId, handleSelectPresentationSlide]);

  const handleEnterPresentationPlayMode = React.useCallback(() => {
    if (presentationPlayerSlides.length === 0) return;
    setPresentationPlayerIndex(0);
    setPresentationPlayerOpen(true);
  }, [presentationPlayerSlides.length]);

  const toggleJsonPanel = () => {
    const newState = !jsonPanelOpen;
    setJsonPanelOpen(newState);
    if (isClient) {
      localStorage.setItem('dw:jsonEditor:open', String(newState));
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toUpperCase().includes('MAC');

      if (isEventFromEditableElement(e)) return;
      
      // Ctrl+Shift+J (or Cmd+Shift+J on Mac) - Toggle JSON Panel
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleJsonPanel();
      }
      
      // Ctrl+N (or Cmd+N on Mac) - New
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNew();
      }
      
      // Ctrl+O (or Cmd+O on Mac) - Load
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault();
        handleLoadClick();
      }
      
      // Ctrl+S (or Cmd+S on Mac) - Save
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      
      // Ctrl+Z (or Cmd+Z on Mac) - Undo
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Ctrl+Shift+Z (or Cmd+Shift+Z on Mac) - Redo
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      }
      
      // Ctrl+Y (or Cmd+Y on Mac) - Redo (alternative)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      
      // Ctrl+A (or Cmd+A on Mac) - Select All
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault();
        handleSelectAll();
      }

      // Ctrl+C (or Cmd+C on Mac) - Copy selection
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'c' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleMenuCopy();
        return;
      }

      // Ctrl+V (or Cmd+V on Mac) - Paste
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'v' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleMenuPaste();
        return;
      }

      // Ctrl+0 (or Cmd+0 on Mac) - Fit to View
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === '0' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        editorRef.current?.fitToView();
        return;
      }

      // Escape key - Clear multi-selection
      if (e.key === 'Escape' && selectedItemIds.size > 1) {
        e.preventDefault();
        setSelectedItemIds(new Set());
        return;
      }

      // Delete/Backspace - Delete selected item (including selected connection).
      // Multi-select is handled in EditorCanvas (handleDeleteMultiple). That listener runs first
      // (child useEffect); if we also run single-item delete here we apply stale currentDiagramData
      // and overwrite the batch delete (one item removed, rest remain until a second keypress).
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItem && !isReadOnly) {
        if (selectedItemIds.size > 1) {
          return;
        }
        e.preventDefault();
        handleItemDelete(selectedItem);
        return;
      }
      
      // Ctrl+G (or Cmd+G on Mac) - Group selected items
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        handleGroupItems();
        return;
      }
      
      // Ctrl+Shift+G (or Cmd+Shift+G on Mac) - Ungroup selected items
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleUngroupItems();
        return;
      }
      
      // Ctrl+Shift+L (or Cmd+Shift+L on Mac) - Auto Layout
      if ((isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleAutoLayout();
        return;
      }
      
      // Ctrl+Alt+A (or Cmd+Option+A on Mac) - Toggle Animation Connections (user preference)
      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAnimationConnectionsUserEnabled((v) => !v);
        return;
      }
      
      // Ctrl+Alt+C (or Cmd+Option+C on Mac) - Toggle Click to Toggle Animations
      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (animationConnectionsEnabled) {
          setAnimationToggleOnClickEnabled(!animationToggleOnClickEnabled);
        }
        return;
      }

      // Ctrl+Alt+P (or Cmd+Option+P on Mac) — start presentation playback
      if ((isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (!presentationPlayerOpen) {
          handleEnterPresentationPlayMode();
        }
        return;
      }
      
      // Arrow keys - Move selected items by 10px grid
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedItem && selectedItem.itemType !== 'edge') {
        e.preventDefault();
        
        const gridSize = 10; // Use 10px for arrow key movement
        let deltaX = 0;
        let deltaY = 0;
        
        switch (e.key) {
          case 'ArrowUp':
            deltaY -= gridSize;
            break;
          case 'ArrowDown':
            deltaY += gridSize;
            break;
          case 'ArrowLeft':
            deltaX -= gridSize;
            break;
          case 'ArrowRight':
            deltaX += gridSize;
            break;
        }
        
        // Determine which items to move (multi-selection or single selection)
        const itemIdsToMove = selectedItemIds.size > 0 ? Array.from(selectedItemIds) : [selectedItem.id];
        
        // Filter out locked nodes
        const unlockedItemIds = itemIdsToMove.filter(id => {
          const node = diagramData.nodes.find(n => n.id === id);
          return !node || !node.locked;
        });
        
        // If all items are locked, don't move anything
        if (unlockedItemIds.length === 0) {
          return;
        }
        
        setDiagramData(prevData => {
          const newNodes = [...prevData.nodes];
          unlockedItemIds.forEach(id => {
            const nodeIndex = newNodes.findIndex(n => n.id === id);
            if (nodeIndex !== -1) {
              const node = newNodes[nodeIndex];
              newNodes[nodeIndex] = { 
                ...node, 
                x: Math.round(((node.x || 0) + deltaX) / gridSize) * gridSize,
                y: Math.round(((node.y || 0) + deltaY) / gridSize) * gridSize
              };
            }
          });
          return { ...prevData, nodes: newNodes };
        });
        
        const updatedSelectedItems: SelectedItem[] = [];
        unlockedItemIds.forEach(id => {
          const updatedNode = diagramData.nodes.find(n => n.id === id);
          if (updatedNode) {
            updatedSelectedItems.push({ 
              ...updatedNode, 
              itemType: 'node',
              x: Math.round(((updatedNode.x || 0) + deltaX) / gridSize) * gridSize,
              y: Math.round(((updatedNode.y || 0) + deltaY) / gridSize) * gridSize
            } as SelectedItem);
          }
        });
        
        // Update the primary selected item
        const updatedPrimary = updatedSelectedItems.find(item => item.id === selectedItem.id);
        if (updatedPrimary) {
          setSelectedItem(updatedPrimary);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jsonPanelOpen, historyIndex, history, selectedItem, selectedItemIds, diagramData, setDiagramData, setSelectedItem, animationConnectionsEnabled, setAnimationConnectionsUserEnabled, setAnimationToggleOnClickEnabled, isReadOnly, handleItemDelete, handleMenuCopy, handleMenuPaste, presentationPlayerOpen, handleEnterPresentationPlayMode]);

  // Persist panel width (debounced for better performance)
  React.useEffect(() => {
    if (isClient) {
      setItemDebounced('dw:jsonEditor:width', String(jsonPanelWidth), 200);
    }
  }, [jsonPanelWidth, isClient]);

  // Persist icon background preference (debounced)
  React.useEffect(() => {
    if (isClient) {
      setBooleanDebounced('dw:iconBackground:enabled', iconBackgroundEnabled);
    }
  }, [iconBackgroundEnabled, isClient]);

  // Persist default text labels for new palette drops (debounced)
  React.useEffect(() => {
    if (isClient) {
      setBooleanDebounced('dw:defaultTextLabels:enabled', defaultTextLabelsEnabled);
    }
  }, [defaultTextLabelsEnabled, isClient]);

  // Persist alignment guides preference (debounced)
  React.useEffect(() => {
    if (isClient) {
      setBooleanDebounced('dw:alignmentGuides:enabled', alignmentGuidesEnabled);
    }
  }, [alignmentGuidesEnabled, isClient]);

  // Restore panel state from localStorage after hydration (avoids hydration mismatch)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCollapsed = getItemSafe('dw:propertiesPanel:collapsed');
    if (savedCollapsed !== null) setRightPanelCollapsed(savedCollapsed === 'true');
    const savedVisible = getItemSafe('dw:propertiesPanel:visible');
    if (savedVisible !== null) setPropertiesPanelVisible(savedVisible !== 'false');
    const savedPopups = getItemSafe('dw:metadataPopups:enabled');
    if (savedPopups !== null) setMetadataPopupsEnabled(savedPopups !== 'false');
    const savedGuides = getItemSafe('dw:alignmentGuides:enabled');
    if (savedGuides !== null) setAlignmentGuidesEnabled(savedGuides !== 'false');
    const savedConnectionsBehind = getItemSafe('dw:connectionsBehindNodes:enabled');
    if (savedConnectionsBehind !== null) setConnectionsBehindNodesEnabled(savedConnectionsBehind !== 'false');
    const savedAnimationConnections = getItemSafe('dw:animationConnections:enabled');
    if (savedAnimationConnections !== null) setAnimationConnectionsUserEnabled(savedAnimationConnections !== 'false');
    const savedAnimationToggleOnClick = getItemSafe('dw:animationToggleOnClick:enabled');
    if (savedAnimationToggleOnClick !== null) setAnimationToggleOnClickEnabled(savedAnimationToggleOnClick === 'true');
  }, []);

  // Persist connections-behind-nodes preference (debounced)
  React.useEffect(() => {
    if (isClient) {
      setBooleanDebounced('dw:connectionsBehindNodes:enabled', connectionsBehindNodesEnabled);
    }
  }, [connectionsBehindNodesEnabled, isClient]);

  // Persist animation connections preference (debounced; user intent only — not idle auto-pause)
  React.useEffect(() => {
    if (isClient) {
      setBooleanDebounced('dw:animationConnections:enabled', animationConnectionsUserEnabled);
    }
  }, [animationConnectionsUserEnabled, isClient]);

  // Persist animation toggle on click preference (debounced)
  React.useEffect(() => {
    if (isClient) {
      setBooleanDebounced('dw:animationToggleOnClick:enabled', animationToggleOnClickEnabled);
    }
  }, [animationToggleOnClickEnabled, isClient]);

  // Reset click-to-toggle disabled sources when it's enabled
  React.useEffect(() => {
    if (animationToggleOnClickEnabled) {
      setAnimationDisabledSources(new Set());
    }
  }, [animationToggleOnClickEnabled]);

  // Disable click-to-toggle when master animation toggle is off
  React.useEffect(() => {
    if (!animationConnectionsEnabled && animationToggleOnClickEnabled) {
      setAnimationToggleOnClickEnabled(false);
    }
  }, [animationConnectionsEnabled, animationToggleOnClickEnabled]);

  // Reset disabled animation sources when master animation toggle is re-enabled (only after client init)
  React.useEffect(() => {
    if (!isClient) return;
    if (animationConnectionsEnabled) {
      setAnimationDisabledSources(new Set());
    }
  }, [animationConnectionsEnabled, isClient]);

  // Persist properties panel collapse state
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:propertiesPanel:collapsed', String(rightPanelCollapsed));
    }
  }, [rightPanelCollapsed, isClient]);

  // Persist properties panel visibility
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:propertiesPanel:visible', String(propertiesPanelVisible));
    }
  }, [propertiesPanelVisible, isClient]);

  // Persist metadata popups enabled
  React.useEffect(() => {
    if (isClient) {
      localStorage.setItem('dw:metadataPopups:enabled', String(metadataPopupsEnabled));
    }
  }, [metadataPopupsEnabled, isClient]);

  const togglePropertiesPanel = React.useCallback(() => {
    setPropertiesPanelVisible(prev => !prev);
  }, []);

  const toggleMetadataPopups = React.useCallback(() => {
    setMetadataPopupsEnabled(prev => !prev);
  }, []);

  const canPasteFromMenu = paletteClipboardItem != null || canPaste;

  return (
    <TooltipProvider>
    <TutorialProvider
      onTutorialSessionStart={ensureTutorialTab}
      onTutorialFinish={handleTutorialFinish}
      onLoadTutorialExample={handleLoadTutorialExample}
    >
      <DiagramEditorInner
        canPasteFromMenu={canPasteFromMenu}
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        leftPanelCollapsed={leftPanelCollapsed}
        setLeftPanelCollapsed={setLeftPanelCollapsed}
        rightPanelCollapsed={rightPanelCollapsed}
        setRightPanelCollapsed={setRightPanelCollapsed}
        propertiesPanelVisible={propertiesPanelVisible}
        onTogglePropertiesPanel={togglePropertiesPanel}
        metadataPopupsEnabled={metadataPopupsEnabled}
        onToggleMetadataPopups={toggleMetadataPopups}
        selectedItem={selectedItem}
        selectedItemIds={selectedItemIds}
        handleItemUpdate={handleItemUpdate}
        handleBulkMetadataUpdate={handleBulkMetadataUpdate}
        startConnecting={startConnecting}
        handleItemDelete={handleItemDelete}
        connectorLineFocusedVertex={connectorLineFocusedVertex}
        handleConnectorLineVertexFocus={handleConnectorLineVertexFocus}
        tryDeleteConnectorLineVertexBeforeNodeDelete={tryDeleteConnectorLineVertexBeforeNodeDelete}
        handleResourceSelect={handleResourceSelect}
        handleResourceActivate={handleResourceActivate}
        handleResourceActivateAtPosition={handleResourceActivateAtPosition}
        toggleJsonPanel={toggleJsonPanel}
        jsonPanelOpen={jsonPanelOpen}
        jsonPanelWidth={jsonPanelWidth}
        setJsonPanelWidth={setJsonPanelWidth}
        editorRef={editorRef}
        handleConnectionUpdate={handleConnectionUpdate}
        disconnectConnection={disconnectConnection}
        handleConnectionWaypointAdd={handleConnectionWaypointAdd}
        handleConnectionInsertNode={handleConnectionInsertNode}
        handleConnectionWaypointRemove={handleConnectionWaypointRemove}
        handleConnectionWaypointMove={handleConnectionWaypointMove}
        handleConnectionContextMenu={handleConnectionContextMenu}
        connectionContextModal={connectionContextModal}
        setConnectionContextModal={setConnectionContextModal}
        umlClassEditorModal={umlClassEditorModal}
        setUmlClassEditorModal={setUmlClassEditorModal}
        chartDataEditorModal={chartDataEditorModal}
        setChartDataEditorModal={setChartDataEditorModal}
        setDiagramData={setDiagramData}
        updateTutorialDiagramData={updateTutorialDiagramData}
        layers={layers}
        layerAnimationsEnabled={layerAnimationsEnabled}
        setLayerAnimationsEnabled={setLayerAnimationsEnabled}
        layerAnimation={layerAnimation}
        displayDiagramData={displayDiagramData}
        handleToggleLayerVisibility={handleToggleLayerVisibility}
        canvasTransform={canvasTransform}
        setCanvasTransform={setCanvasTransform}
        handleNew={handleNew}
        handleLoadClick={handleLoadClick}
        handleMermaidImportClick={handleMermaidImportClick}
        handleMermaidFileChange={handleMermaidFileChange}
        mermaidInputRef={mermaidInputRef}
        handleSave={handleSave}
        handleLoadExample={handleLoadExample}
        createTab={createTab}
        handleExportSvg={handleExportPng}
        handleExportGif={handleExportGif}
        handleMenuCopy={handleMenuCopy}
        handleMenuPaste={handleMenuPaste}
        canPaste={canPaste}
        undo={undo}
        redo={redo}
        historyIndex={historyIndex}
        history={history}
        handleSelectAll={handleSelectAll}
        mousePosition={mousePosition}
        hoverEnabled={hoverEnabled}
        setHoverEnabled={setHoverEnabled}
        iconBackgroundEnabled={iconBackgroundEnabled}
        setIconBackgroundEnabled={setIconBackgroundEnabled}
        defaultTextLabelsEnabled={defaultTextLabelsEnabled}
        setDefaultTextLabelsEnabled={setDefaultTextLabelsEnabled}
        alignmentGuidesEnabled={alignmentGuidesEnabled}
        setAlignmentGuidesEnabled={setAlignmentGuidesEnabled}
        connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
        setConnectionsBehindNodesEnabled={setConnectionsBehindNodesEnabled}
        animationConnectionsEnabled={animationConnectionsEnabled}
        animationConnectionsUserEnabled={animationConnectionsUserEnabled}
        animationConnectionsIdlePaused={animationConnectionsIdlePaused}
        animationConnectionsMenuPaused={animationConnectionsMenuPaused}
        setAnimationConnectionsMenuPaused={setAnimationConnectionsMenuPaused}
        pauseConnectionAnimationsForOverlayUi={pauseConnectionAnimationsForOverlayUi}
        setAnimationConnectionsEnabled={setAnimationConnectionsUserEnabled}
        animationToggleOnClickEnabled={animationToggleOnClickEnabled}
        setAnimationToggleOnClickEnabled={setAnimationToggleOnClickEnabled}
        effectiveAnimationFilterIds={effectiveAnimationFilterIds}
        animationDisabledSources={animationDisabledSources}
        setAnimationDisabledSources={setAnimationDisabledSources}
        isReadOnly={isReadOnly}
        setIsReadOnly={setIsReadOnly}
        handleAlignObjects={handleAlignObjects}
        handleLayoutGridStep={handleLayoutGridStep}
        handleAutoLayout={handleAutoLayout}
        handleThemeApplyToSelected={handleThemeApplyToSelected}
        triggerTextStylingPanel={triggerTextStylingPanel}
        setTriggerTextStylingPanel={setTriggerTextStylingPanel}
        triggerVisualStylingPanel={triggerVisualStylingPanel}
        setTriggerVisualStylingPanel={setTriggerVisualStylingPanel}
        triggerLineStylingPanel={triggerLineStylingPanel}
        setTriggerLineStylingPanel={setTriggerLineStylingPanel}
        triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
        setTriggerConnectionSettingsPanel={setTriggerConnectionSettingsPanel}
        setScratchPadOpen={setScratchPadOpen}
        scratchPadOpen={scratchPadOpen}
        rulesEditorOpen={rulesEditorOpen}
        setRulesEditorOpen={setRulesEditorOpen}
        rules={rules}
        setRules={setRules}
        presentationDecks={presentationDecks}
        activePresentationDeckId={activePresentationDeckId}
        activePresentationSlideId={activePresentationSlideId}
        presentationDisabledLayerIds={presentationDisabledLayerIds}
        activePresentationSlides={activePresentationSlides}
        activePresentationSlideDiagrams={activePresentationSlideDiagrams}
        selectedPresentationSlideIds={selectedPresentationSlideIds}
        handleSelectPresentationBaseSlide={handleSelectPresentationBaseSlide}
        handleAutoZoomPresentation={handleAutoZoomPresentation}
        handleApplyPresentationZoomToCurrent={handleApplyPresentationZoomToCurrent}
        handleApplyPresentationZoomToAll={handleApplyPresentationZoomToAll}
        handleAddPresentationSnapshot={handleAddPresentationSnapshot}
        handleRemovePresentationSlides={handleRemovePresentationSlides}
        handleDeletePresentationSlide={handleDeletePresentationSlide}
        presentationHasLaterSlides={hasLaterSlides}
        handlePropagateAddToLaterSlides={handlePropagateAddToLaterSlides}
        handlePropagateDeleteToLaterSlides={handlePropagateDeleteToLaterSlides}
        handleMovePresentationSlide={handleMovePresentationSlide}
        handleSelectPresentationSlide={handleSelectPresentationSlide}
        handleTogglePresentationSlideSelection={handleTogglePresentationSlideSelection}
        handlePreviousPresentationSlide={handlePreviousPresentationSlide}
        handleNextPresentationSlide={handleNextPresentationSlide}
        handleEnterPresentationPlayMode={handleEnterPresentationPlayMode}
        presentationPlayerSlides={presentationPlayerSlides}
        presentationPlayerSlideDiagrams={presentationPlayerSlideDiagrams}
        presentationPlayerOpen={presentationPlayerOpen}
        setPresentationPlayerOpen={setPresentationPlayerOpen}
        presentationPlayerIndex={presentationPlayerIndex}
        setPresentationPlayerIndex={setPresentationPlayerIndex}
        tabs={tabs}
        activeTabId={activeTabId}
        isLoaded={isLoaded}
        switchTab={switchTab}
        handleTabClose={handleTabClose}
        reorderTabs={reorderTabs}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        diagramData={diagramData}
        handleJsonValidChange={handleJsonValidChange}
        exportDialogOpen={exportDialogOpen}
        exportDialogFormat={exportDialogFormat}
        setExportDialogOpen={setExportDialogOpen}
        handleExport={handleExport}
        refreshCanvas={refreshCanvas}
        updateHistory={updateHistory}
        closeTabDialogOpen={closeTabDialogOpen}
        setCloseTabDialogOpen={setCloseTabDialogOpen}
        pendingCloseTabId={pendingCloseTabId}
        setPendingCloseTabId={setPendingCloseTabId}
        handleCloseTabConfirm={handleCloseTabConfirm}
        handleCloseTabSave={handleCloseTabSave}
        animationSelectionDialogOpen={animationSelectionDialogOpen}
        setAnimationSelectionDialogOpen={setAnimationSelectionDialogOpen}
        animationOverwriteDialogOpen={animationOverwriteDialogOpen}
        setAnimationOverwriteDialogOpen={setAnimationOverwriteDialogOpen}
        animationDisableConfirmDialogOpen={animationDisableConfirmDialogOpen}
        setAnimationDisableConfirmDialogOpen={setAnimationDisableConfirmDialogOpen}
        animationCurrentOnlyDialogOpen={animationCurrentOnlyDialogOpen}
        setAnimationCurrentOnlyDialogOpen={setAnimationCurrentOnlyDialogOpen}
        handleAnimationApplyCurrentOnly={handleAnimationApplyCurrentOnly}
        handleAnimationApplySelectedConfirm={handleAnimationApplySelectedConfirm}
        handleAnimationDisableConfirm={handleAnimationDisableConfirm}
        handleAnimationOverwriteConfirm={handleAnimationOverwriteConfirm}
        handleItemSelect={handleItemSelect}
        handleBatchSelect={handleBatchSelect}
        setSelectedItemIds={setSelectedItemIds}
        setSelectedItem={setSelectedItem}
        isConnectMode={isConnectMode}
        handleConnect={handleConnect}
        setIsConnectMode={setIsConnectMode}
        disconnectSelected={disconnectSelected}
        handleLabelUpdate={handleLabelUpdate}
        handleTagUpdate={handleTagUpdate}
        setIsDragging={setIsDragging}
        setCanPaste={setCanPaste}
        setMousePosition={setMousePositionForIdle}
        handleGroupItems={handleGroupItems}
        handleUngroupItems={handleUngroupItems}
        handleRemoveFromGroup={handleRemoveFromGroup}
        handleAddToGroup={handleAddToGroup}
        handleMoveToBack={handleMoveToBack}
        handleMoveToFront={handleMoveToFront}
        handleMoveOneBack={handleMoveOneBack}
        handleMoveOneForward={handleMoveOneForward}
        canvasRefreshKey={canvasRefreshKey}
        activeTab={activeTab}
        toast={toast}
        activeDiagramStack={activeDiagramStack}
        handleBreadcrumbNavigate={handleBreadcrumbNavigate}
        handleBreadcrumbSegmentRename={handleBreadcrumbSegmentRename}
        handleSubDiagramDoubleClick={handleSubDiagramDoubleClick}
        getHasLinkedSubDiagram={getHasLinkedSubDiagram}
        handleCreateSubDiagram={handleCreateSubDiagram}
        handleRemoveSubDiagramLink={handleRemoveSubDiagramLink}
        setCurrentDiagramData={setCurrentDiagramData}
        currentDiagramData={currentDiagramData}
        onImportIntoSubDiagram={activeDiagramStack.length > 0 ? handleImportIntoSubDiagramClick : undefined}
        onSubDiagramFileChange={handleSubDiagramFileChange}
        subDiagramImportInputRef={subDiagramImportInputRef}
      />
      <TutorialOverlay />
    </TutorialProvider>
    </TooltipProvider>
  );
}

function DiagramEditorInner({
  canPasteFromMenu,
  isMobile,
  sidebarOpen,
  setSidebarOpen,
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  rightPanelCollapsed,
  setRightPanelCollapsed,
  propertiesPanelVisible,
  onTogglePropertiesPanel,
  metadataPopupsEnabled,
  onToggleMetadataPopups,
  selectedItem,
  selectedItemIds,
  handleItemUpdate,
  handleBulkMetadataUpdate,
  startConnecting,
  handleItemDelete,
  connectorLineFocusedVertex,
  handleConnectorLineVertexFocus,
  tryDeleteConnectorLineVertexBeforeNodeDelete,
  handleResourceSelect,
  handleResourceActivate,
  handleResourceActivateAtPosition,
  toggleJsonPanel,
  jsonPanelOpen,
  editorRef,
  handleConnectionUpdate,
  disconnectConnection,
  handleConnectionWaypointAdd,
  handleConnectionInsertNode,
  handleConnectionWaypointRemove,
  handleConnectionWaypointMove,
  handleConnectionContextMenu,
  connectionContextModal,
  setConnectionContextModal,
  umlClassEditorModal,
  setUmlClassEditorModal,
  chartDataEditorModal,
  setChartDataEditorModal,
  setDiagramData,
  updateTutorialDiagramData,
  setCurrentDiagramData,
  currentDiagramData,
  activeDiagramStack,
  handleBreadcrumbNavigate,
  handleBreadcrumbSegmentRename,
  handleSubDiagramDoubleClick,
  getHasLinkedSubDiagram,
  handleCreateSubDiagram,
  handleRemoveSubDiagramLink,
  onImportIntoSubDiagram,
  onSubDiagramFileChange,
  subDiagramImportInputRef,
  layers,
  layerAnimationsEnabled,
  setLayerAnimationsEnabled,
  displayDiagramData,
  layerAnimation,
  handleToggleLayerVisibility,
  canvasTransform,
  setCanvasTransform,
  handleNew,
  handleLoadClick,
  handleMermaidImportClick,
  handleMermaidFileChange,
  mermaidInputRef,
  handleSave,
  handleLoadExample,
  createTab,
  handleExportSvg,
  handleExportGif,
  handleMenuCopy,
  handleMenuPaste,
  canPaste,
  undo,
  redo,
  historyIndex,
  history,
  handleSelectAll,
  mousePosition,
  hoverEnabled,
  setHoverEnabled,
  iconBackgroundEnabled,
  setIconBackgroundEnabled,
  defaultTextLabelsEnabled,
  setDefaultTextLabelsEnabled,
  alignmentGuidesEnabled,
  setAlignmentGuidesEnabled,
  connectionsBehindNodesEnabled,
  setConnectionsBehindNodesEnabled,
  animationConnectionsEnabled,
  animationConnectionsUserEnabled,
  animationConnectionsIdlePaused,
  animationConnectionsMenuPaused,
  setAnimationConnectionsMenuPaused,
  pauseConnectionAnimationsForOverlayUi,
  setAnimationConnectionsEnabled: setAnimationConnectionsUserEnabled,
  animationToggleOnClickEnabled,
  setAnimationToggleOnClickEnabled,
  effectiveAnimationFilterIds,
  animationDisabledSources,
  setAnimationDisabledSources,
  isReadOnly,
  setIsReadOnly,
  handleAlignObjects,
  handleLayoutGridStep,
  handleAutoLayout,
  handleThemeApplyToSelected,
  triggerTextStylingPanel,
  setTriggerTextStylingPanel,
  triggerVisualStylingPanel,
  setTriggerVisualStylingPanel,
  triggerLineStylingPanel,
  setTriggerLineStylingPanel,
  triggerConnectionSettingsPanel,
  setTriggerConnectionSettingsPanel,
  setScratchPadOpen,
  scratchPadOpen,
  rulesEditorOpen,
  setRulesEditorOpen,
  rules,
  setRules,
  presentationDecks,
  activePresentationDeckId,
  activePresentationSlideId,
  presentationDisabledLayerIds,
  activePresentationSlides,
  activePresentationSlideDiagrams,
  selectedPresentationSlideIds,
  handleSelectPresentationBaseSlide,
  handleAutoZoomPresentation,
  handleApplyPresentationZoomToCurrent,
  handleApplyPresentationZoomToAll,
  handleAddPresentationSnapshot,
  handleRemovePresentationSlides,
  handleDeletePresentationSlide,
  presentationHasLaterSlides,
  handlePropagateAddToLaterSlides,
  handlePropagateDeleteToLaterSlides,
  handleMovePresentationSlide,
  handleSelectPresentationSlide,
  handleTogglePresentationSlideSelection,
  handlePreviousPresentationSlide,
  handleNextPresentationSlide,
  handleEnterPresentationPlayMode,
  presentationPlayerSlides,
  presentationPlayerSlideDiagrams,
  presentationPlayerOpen,
  setPresentationPlayerOpen,
  presentationPlayerIndex,
  setPresentationPlayerIndex,
  tabs,
  activeTabId,
  isLoaded,
  switchTab,
  handleTabClose,
  reorderTabs,
  fileInputRef,
  handleFileChange,
  jsonPanelOpen: jsonPanelOpenInner,
  jsonPanelWidth,
  setJsonPanelWidth,
  diagramData,
  handleJsonValidChange,
  toggleJsonPanel: toggleJsonPanelInner,
  exportDialogOpen,
  exportDialogFormat,
  setExportDialogOpen,
  handleExport,
  refreshCanvas,
  updateHistory,
  closeTabDialogOpen,
  setCloseTabDialogOpen,
  pendingCloseTabId,
  setPendingCloseTabId,
  handleCloseTabConfirm,
  handleCloseTabSave,
  animationSelectionDialogOpen,
  setAnimationSelectionDialogOpen,
  animationOverwriteDialogOpen,
  setAnimationOverwriteDialogOpen,
  animationDisableConfirmDialogOpen,
  setAnimationDisableConfirmDialogOpen,
  animationCurrentOnlyDialogOpen,
  setAnimationCurrentOnlyDialogOpen,
  handleAnimationApplyCurrentOnly,
  handleAnimationApplySelectedConfirm,
  handleAnimationDisableConfirm,
  handleAnimationOverwriteConfirm,
  handleItemSelect,
  handleBatchSelect,
  setSelectedItemIds,
  setSelectedItem,
  isConnectMode,
  handleConnect,
  setIsConnectMode,
  disconnectSelected,
  handleLabelUpdate,
  handleTagUpdate,
  setIsDragging,
  setCanPaste,
  setMousePosition,
  handleGroupItems,
  handleUngroupItems,
  handleRemoveFromGroup,
  handleAddToGroup,
  handleMoveToBack,
  handleMoveToFront,
  handleMoveOneBack,
  handleMoveOneForward,
  canvasRefreshKey,
  activeTab,
  toast,
}: any) {
  const presentationConnectionRenderRevision = React.useMemo(
    () => `${activePresentationDeckId ?? ''}-${activePresentationSlideId ?? ''}`,
    [activePresentationDeckId, activePresentationSlideId],
  );

  const exportPresentationSlidesInfo = React.useMemo(() => {
    if (activeDiagramStack.length > 0) return null;
    const deck = presentationDecks.find((d: PresentationDeck) => d.id === activePresentationDeckId);
    if (!deck || deck.slides.length < 1) return null;
    return {
      totalSlides: deck.slides.length,
      tabName: activeTab?.name ?? 'diagram',
    };
  }, [activeDiagramStack.length, presentationDecks, activePresentationDeckId, activeTab?.name]);

  const isPrimaryPresentationSlideActiveInner = React.useMemo(() => {
    const deck = presentationDecks.find((d: PresentationDeck) => d.id === activePresentationDeckId);
    const pid = deck?.slides[0]?.id;
    return Boolean(pid && activePresentationSlideId === pid);
  }, [presentationDecks, activePresentationDeckId, activePresentationSlideId]);

  const { start, isOpen: tutorialOpen, steps: tutorialSteps, currentIndex: tutorialStepIndex } = useTutorial();

  const handleStartTutorial = React.useCallback(() => {
    start(getTutorialSteps());
  }, [start]);

  // `updateTutorialDiagramData` updates the tutorial tab even when another tab is active.
  const updateTutorialDiagramDataRef = React.useRef(updateTutorialDiagramData);
  updateTutorialDiagramDataRef.current = updateTutorialDiagramData;

  // When the Connections step starts, add A→B on the tutorial diagram so the user only adds A→C next.
  const tutorialStepId = tutorialSteps[tutorialStepIndex]?.id;
  useEffect(() => {
    if (!tutorialOpen || !tutorialSteps.length) return;
    if (activeDiagramStack.length > 0) return;
    if (tutorialStepId !== 'c-intro') return;

    const FROM = 'tutorial-shape-a';
    const TO = 'tutorial-shape-b';

    updateTutorialDiagramDataRef.current((prev: DiagramData) => {
      const nodes = prev.nodes || [];
      if (!nodes.some((n: DiagramNodeData) => n.id === FROM) || !nodes.some((n: DiagramNodeData) => n.id === TO)) return prev;

      const connections = prev.connections || [];
      const alreadyHas = connections.some(
        (c: DiagramConnectionData) =>
          (c.from === FROM && c.to === TO) ||
          (c.from === TO && c.to === FROM),
      );
      if (alreadyHas) return prev;

      const newConn: DiagramConnectionData = {
        id: generateConnectionId(),
        from: FROM,
        to: TO,
        style: 'bezier',
        curvature: 0.6,
        animation: {
          enabled: false,
          shape: 'dot',
          speed: 20,
          size: 2,
          autoCount: true,
          shapeCount: 5,
          spacing: 2,
        },
        arrow: true,
        toArrow: true,
      };

      return {
        ...prev,
        connections: [...connections, newConn],
      };
    });
  }, [
    tutorialOpen,
    tutorialStepIndex,
    tutorialStepId,
    activeDiagramStack.length,
    tutorialSteps.length,
  ]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen w-screen bg-background text-foreground font-body relative overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar - fixed on mobile, normal on desktop */}
        <div className={`${isMobile ? 'fixed left-0 top-0 h-full z-50 transform transition-transform duration-300 ease-in-out' : ''} ${isMobile && !sidebarOpen ? '-translate-x-full' : ''} ${isMobile ? (leftPanelCollapsed ? 'w-12' : 'w-80') : ''}`}>
 <ComponentSidebar
    selectedItem={selectedItem}
    selectedItemIds={selectedItemIds}
    onItemUpdate={handleItemUpdate}
    onConnect={startConnecting}
    onDisconnect={disconnectSelected}
    onItemDelete={handleItemDelete}
    diagramData={diagramData}
    onResourceSelect={handleResourceSelect}
    onResourceActivate={handleResourceActivate}
    onToggleJsonPanel={toggleJsonPanel}
    jsonPanelOpen={jsonPanelOpen}
    onFitToView={() => editorRef.current?.fitToView()}
    onConnectionUpdate={handleConnectionUpdate}
    onConnectionDisconnect={disconnectConnection}
    onCloseSidebar={() => setSidebarOpen(false)}
    isMobile={isMobile}
    transform={canvasTransform}
    onTransformChange={setCanvasTransform}
    collapsed={leftPanelCollapsed}
    onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
  />
        </div>
        
        {/* Mobile menu toggle button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="fixed left-4 top-4 z-30 p-3 bg-card border border-border rounded-md shadow-lg touch-target"
            style={{ touchAction: 'manipulation' }}
            aria-label="Toggle sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        
        <main className={`flex-1 flex flex-col min-h-0 ${isMobile ? 'w-full' : ''} ${isMobile && sidebarOpen ? 'pointer-events-none' : ''} ${(jsonPanelOpen || propertiesPanelVisible) ? 'min-w-0' : ''}`}>
            <header className="flex shrink-0 flex-col border-b bg-card">
                <TopMenuBar
                    onNew={handleNew}
                    onLoad={handleLoadClick}
                    onImportMermaid={handleMermaidImportClick}
                    onImportIntoSubDiagram={onImportIntoSubDiagram}
                    onSave={handleSave}
                    onLoadExample={handleLoadExample}
                    onNewTab={createTab}
                    onExportSvg={handleExportSvg}
                    onExportGif={handleExportGif}
                    onToggleJsonPanel={toggleJsonPanel}
                    jsonPanelOpen={jsonPanelOpen}
                    onTogglePropertiesPanel={onTogglePropertiesPanel}
                    propertiesPanelVisible={propertiesPanelVisible}
                    onToggleMetadataPopups={onToggleMetadataPopups}
                    metadataPopupsEnabled={metadataPopupsEnabled}
                    onToggleLayersPanel={layers.toggleLayersPanel}
                    layersPanelOpen={layers.layersPanelOpen}
                    layerAnimationsEnabled={layerAnimationsEnabled}
                    onToggleLayerAnimations={() => setLayerAnimationsEnabled(!layerAnimationsEnabled)}
                    onFitToView={() => editorRef.current?.fitToView()}
                    onCopy={handleMenuCopy}
                    onPaste={handleMenuPaste}
                    canPaste={canPasteFromMenu}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={historyIndex > 0}
                    canRedo={historyIndex < history.length - 1}
                    onSelectAll={handleSelectAll}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    onItemUpdate={handleItemUpdate}
                    onBulkMetadataUpdate={handleBulkMetadataUpdate}
                    onConnect={startConnecting}
                    onDisconnect={disconnectSelected}
                    onDelete={() => {
                      if (selectedItem) {
                        handleItemDelete(selectedItem);
                      }
                    }}
                    onConnectionUpdate={handleConnectionUpdate}
                    onConnectionDisconnect={disconnectConnection}
                    onConnectionWaypointAdd={handleConnectionWaypointAdd}
                    onConnectionWaypointRemove={handleConnectionWaypointRemove}
                    diagramData={diagramData}
                    onDiagramDataUpdate={setDiagramData}
                    currentDiagramData={currentDiagramData}
                    onCurrentDiagramDataUpdate={setCurrentDiagramData}
                    mousePosition={mousePosition}
                    hoverEnabled={hoverEnabled}
                    onToggleHover={() => setHoverEnabled(!hoverEnabled)}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    onToggleIconBackground={() => setIconBackgroundEnabled(!iconBackgroundEnabled)}
                    defaultTextLabelsEnabled={defaultTextLabelsEnabled}
                    onToggleDefaultTextLabels={() => setDefaultTextLabelsEnabled(!defaultTextLabelsEnabled)}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    onToggleAlignmentGuides={() => setAlignmentGuidesEnabled(!alignmentGuidesEnabled)}
                    connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
                    onToggleConnectionsBehindNodes={() => setConnectionsBehindNodesEnabled(!connectionsBehindNodesEnabled)}
                    animationConnectionsEnabled={animationConnectionsEnabled}
                    animationConnectionsUserEnabled={animationConnectionsUserEnabled}
                    animationConnectionsIdlePaused={animationConnectionsIdlePaused}
                    animationConnectionsMenuPaused={animationConnectionsMenuPaused}
                    onConnectionAnimationPauseFromMenu={pauseConnectionAnimationsForOverlayUi}
                    onToggleAnimationConnections={() => setAnimationConnectionsUserEnabled((v: boolean) => !v)}
                    animationToggleOnClickEnabled={animationToggleOnClickEnabled}
                    onToggleAnimationToggleOnClick={() => setAnimationToggleOnClickEnabled(!animationToggleOnClickEnabled)}
                    isReadOnly={isReadOnly}
                    onToggleReadOnly={() => setIsReadOnly(!isReadOnly)}
                    onAlignObjects={handleAlignObjects}
                    onLayoutGridStep={handleLayoutGridStep}
                    onAutoLayout={handleAutoLayout}
                    onThemeApplyToSelected={handleThemeApplyToSelected}
                    triggerTextStylingPanel={triggerTextStylingPanel}
                    triggerVisualStylingPanel={triggerVisualStylingPanel}
                    triggerLineStylingPanel={triggerLineStylingPanel}
                    triggerConnectionSettingsPanel={triggerConnectionSettingsPanel}
                    onCloseConnectionSettingsPanel={() => {
                      // This will be passed down to close the connection settings panel
                      // We need to emit an event or call a callback to top-menu-bar
                    }}
                    onToggleScratchPad={() => setScratchPadOpen(!scratchPadOpen)}
                    scratchPadOpen={scratchPadOpen}
                    onToggleRulesEditor={() => setRulesEditorOpen(true)}
                    onRulesEditorOpenChange={setRulesEditorOpen}
                    rulesEditorOpen={rulesEditorOpen}
                    rules={rules}
                    onRulesChange={setRules}
                    presentationHasLaterSlides={presentationHasLaterSlides}
                    onPropagateAddToLaterSlides={handlePropagateAddToLaterSlides}
                    onPropagateDeleteToLaterSlides={handlePropagateDeleteToLaterSlides}
                    onStartTutorial={handleStartTutorial}
                />
                {!isLoaded ? (
                  <div className="flex items-center gap-1 border-b bg-card px-3 py-2 text-sm text-muted-foreground">
                    Loading tabs…
                  </div>
                ) : (
                  activeTabId && (
                    <TabBar
                      tabs={tabs}
                      activeTabId={activeTabId}
                      onTabSelect={switchTab}
                      onTabClose={handleTabClose}
                      onTabReorder={reorderTabs}
                    />
                  )
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json,application/json,.mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={mermaidInputRef}
                    onChange={handleMermaidFileChange}
                    accept=".mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
                <input
                    type="file"
                    ref={subDiagramImportInputRef}
                    onChange={onSubDiagramFileChange}
                    accept=".json,application/json,.mmd,.mermaid,text/plain"
                    style={{ display: 'none' }}
                />
                <PresentationEditorPanel
                  decks={presentationDecks}
                  activeDeckId={activePresentationDeckId}
                  activeSlideId={activePresentationSlideId}
                  selectedSlideIds={selectedPresentationSlideIds}
                  onAutoZoom={handleAutoZoomPresentation}
                  onApplyZoomToCurrent={handleApplyPresentationZoomToCurrent}
                  onApplyZoomToAll={handleApplyPresentationZoomToAll}
                  onAddSnapshot={handleAddPresentationSnapshot}
                  onRemoveSlides={handleRemovePresentationSlides}
                  onDeleteSlide={handleDeletePresentationSlide}
                  onMoveSlide={handleMovePresentationSlide}
                  onSelectSlide={handleSelectPresentationSlide}
                  onSelectBaseSlide={handleSelectPresentationBaseSlide}
                  onPreviousSlide={handlePreviousPresentationSlide}
                  onNextSlide={handleNextPresentationSlide}
                  onEnterPlayMode={handleEnterPresentationPlayMode}
                />
            </header>
            <div className="flex min-h-0 flex-1 flex-col">
                {activeDiagramStack.length > 0 && (
                  <DiagramBreadcrumb
                    segments={[{ diagramId: null }, ...activeDiagramStack]}
                    rootLabel={activeTab?.name || 'Main Diagram'}
                    onNavigate={handleBreadcrumbNavigate}
                    onSegmentRename={handleBreadcrumbSegmentRename}
                    isReadOnly={isReadOnly}
                  />
                )}
                <div className={`flex min-h-0 flex-1 ${(jsonPanelOpen || propertiesPanelVisible) ? 'overflow-x-auto' : ''}`}>
                  <div className={`flex-1 h-full min-h-0 min-w-0 ${(jsonPanelOpen || propertiesPanelVisible) ? 'mr-2' : ''}`}>
                <EditorCanvas
                    key={canvasRefreshKey}
                    ref={editorRef}
                    diagramData={displayDiagramData}
                    nodeAnimationStyles={layerAnimation.nodeAnimationStyles}
                    connectionAnimationStyles={layerAnimation.connectionAnimationStyles}
                    connectionKey={layerAnimation.connectionKey}
                    connectionRenderRevision={presentationConnectionRenderRevision}
                    setDiagramData={setCurrentDiagramData}
                    onItemSelect={handleItemSelect}
                    onBatchSelect={handleBatchSelect}
                    setSelectedItemIds={setSelectedItemIds}
                    setSelectedItem={setSelectedItem as any}
                    selectedItemId={selectedItem?.id}
                    selectedItem={selectedItem}
                    selectedItemIds={selectedItemIds}
                    connectorLineFocusedVertex={connectorLineFocusedVertex}
                    onConnectorLineVertexFocus={handleConnectorLineVertexFocus}
                    tryDeleteConnectorLineVertexBeforeNodeDelete={tryDeleteConnectorLineVertexBeforeNodeDelete}
                    isConnectMode={isConnectMode}
                    onNodeClickInConnectMode={handleConnect}
                    onConnect={startConnecting}
                    onDisconnect={() => {
                             // Remove all connections from selected item
                             if (selectedItem) {
                                 setCurrentDiagramData((prevData: DiagramData) => ({
                                     ...prevData,
                                     connections: prevData.connections?.filter((e: any) => e.from !== selectedItem.id && e.to !== selectedItem.id) || []
                                 }));
                                 toast({
                                     title: "Connections Disconnected",
                                     description: "All connections from the selected item have been removed.",
                                 });
                             }
                        }}
                    onConnectionDelete={disconnectConnection}
                    onConnectionWaypointMove={handleConnectionWaypointMove}
                    onConnectionUpdate={handleConnectionUpdate}
                    onConnectionWaypointAdd={handleConnectionWaypointAdd}
                    onConnectionInsertNode={handleConnectionInsertNode}
                    onConnectionContextMenu={handleConnectionContextMenu}
                    onPauseConnectionAnimationsForOverlayUi={pauseConnectionAnimationsForOverlayUi}
                    externalTransform={canvasTransform}
                     onTransformChange={setCanvasTransform}
                     onLabelUpdate={handleLabelUpdate}
                     onTagUpdate={handleTagUpdate}
                     onDraggingChange={setIsDragging}
                    onClipboardChange={setCanPaste}
                    onMousePositionChange={setMousePosition}
                    onExportComplete={() => setExportDialogOpen(false)}
                    hoverEnabled={hoverEnabled}
                    iconBackgroundEnabled={iconBackgroundEnabled}
                    defaultTextLabelsEnabled={defaultTextLabelsEnabled}
                    onSelectAll={handleSelectAll}
                    onTriggerTextStylingPanel={() => setTriggerTextStylingPanel(true)}
                    onTriggerVisualStylingPanel={() => setTriggerVisualStylingPanel(true)}
                    onTriggerLineStylingPanel={() => setTriggerLineStylingPanel(true)}
                    onTriggerConnectionSettingsPanel={() => setTriggerConnectionSettingsPanel(true)}
                    onResetConnectionSettingsTrigger={() => setTriggerConnectionSettingsPanel(false)}
                    layers={{
                      getAllLayers: layers.getAllLayers,
                      getItemLayerById: layers.getItemLayerById,
                      assignItemsToLayer: layers.assignItemsToLayer
                    }}
                    onGroupItems={handleGroupItems}
                    onUngroupItems={handleUngroupItems}
                    onRemoveFromGroup={handleRemoveFromGroup}
                    onAddToGroupItems={handleAddToGroup}
                    onMoveToBack={handleMoveToBack}
                    onMoveToFront={handleMoveToFront}
                    onMoveOneBack={handleMoveOneBack}
                    onMoveOneForward={handleMoveOneForward}
                    isReadOnly={isReadOnly}
                    alignmentGuidesEnabled={alignmentGuidesEnabled}
                    connectionsBehindNodesEnabled={connectionsBehindNodesEnabled}
                    animationConnectionsEnabled={animationConnectionsEnabled}
                    animationToggleOnClickEnabled={animationToggleOnClickEnabled}
                    animationFilterSourceIds={effectiveAnimationFilterIds}
                    animationDisabledSources={animationDisabledSources}
                    onAnimationDisabledSourcesChange={setAnimationDisabledSources}
                    onResourceActivateAtPosition={handleResourceActivateAtPosition}
                    metadataPopupsEnabled={metadataPopupsEnabled}
                    setUmlClassEditorModal={setUmlClassEditorModal}
                    setChartDataEditorModal={setChartDataEditorModal}
                    onSubDiagramDoubleClick={handleSubDiagramDoubleClick}
                    getHasLinkedSubDiagram={getHasLinkedSubDiagram}
                    onCreateSubDiagram={handleCreateSubDiagram}
                    onRemoveSubDiagramLink={handleRemoveSubDiagramLink}
                    />
                  </div>

                  {/* Properties Panel (metadata, item name/type) */}
                  {propertiesPanelVisible && (
                  <PropertiesPanel
                    selectedItem={selectedItem}
                    diagramData={currentDiagramData}
                    onItemUpdate={handleItemUpdate}
                    onConnectionUpdate={handleConnectionUpdate}
                    collapsed={rightPanelCollapsed}
                    onToggleCollapse={() => setRightPanelCollapsed((prev: boolean) => !prev)}
                    isReadOnly={isReadOnly}
                  />
                  )}
                  
                  {/* Layers Panel */}
                  {layers.layersPanelOpen && (
                    <div className="absolute top-4 right-4 z-50">
                      <LayersPanel
                        layers={layers.getAllLayers()}
                        activeLayerId={layers.layersConfig.activeLayerId}
                        disabledLayerIds={Array.from(presentationDisabledLayerIds)}
                        selectedItemsLayerIds={selectedItemIds.size > 0 ? 
                          Array.from(selectedItemIds).map(id => layers.getItemLayerById(id)) : []
                        }
                        onAddLayer={(name: string) => {
                          void name;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.addNewLayer(name);
                        }}
                        onRemoveLayer={(layerId: string) => {
                          void layerId;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.removeLayerById(layerId);
                        }}
                        onRenameLayer={(layerId: string, newName: string) => {
                          void layerId;
                          void newName;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.renameLayerById(layerId, newName);
                        }}
                        onToggleVisibility={(layerId: string) => {
                          if (presentationDisabledLayerIds.has(layerId)) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: `Layer "${layers.getLayer(layerId)?.name || layerId}" was impacted by slide edits and cannot be toggled here.`,
                            });
                            return;
                          }
                          handleToggleLayerVisibility(layerId);
                        }}
                        onSetActiveLayer={(layerId: string) => {
                          void layerId;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.setActiveLayerById(layerId);
                        }}
                        onReorderLayers={(fromIndex: number, toIndex: number) => {
                          void fromIndex;
                          void toIndex;
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.reorderLayers(fromIndex, toIndex);
                        }}
                        onAssignSelectedItemsToLayer={selectedItemIds.size > 0 ? (layerId: string) => {
                          if (!isPrimaryPresentationSlideActiveInner) {
                            toast({
                              variant: 'destructive',
                              title: 'Layer Editing Disabled',
                              description: 'Layer structure is locked while editing a snapshot so deltas stay valid.',
                            });
                            return;
                          }
                          layers.assignItemsToLayer(Array.from(selectedItemIds), layerId);
                        } : undefined}
                        onClose={layers.toggleLayersPanel}
                        getLayerItemCount={(layerId: string) => {
                          const items = layers.getLayerItems(layerId);
                          return (items.nodes?.length || 0);
                        }}
                      />
                    </div>
                  )}
                  
                  {jsonPanelOpen && (
                    <div className="flex-shrink-0">
                      <JsonEditorPanel
                        value={diagramData}
                        onValidJsonChange={handleJsonValidChange}
                        isOpen={jsonPanelOpen}
                        onToggleOpen={toggleJsonPanel}
                        widthPx={jsonPanelWidth}
                        onWidthChange={setJsonPanelWidth}
                        isReadOnly={isReadOnly}
                        focusTarget={
                          selectedItem
                            ? selectedItem.itemType === 'node'
                              ? { itemType: 'node' as const, id: selectedItem.id }
                              : {
                                  itemType: 'edge' as const,
                                  id: selectedItem.id,
                                  from: selectedItem.from,
                                  to: selectedItem.to,
                                }
                            : null
                        }
                      />
                    </div>
                  )}
                </div>
            </div>
        </main>
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          initialFormat={exportDialogFormat}
          presentationSlides={exportPresentationSlidesInfo}
          onExport={handleExport}
        />
        {umlClassEditorModal.visible && umlClassEditorModal.itemId && typeof window !== 'undefined' && createPortal(
          <UmlClassEditorModal
            x={umlClassEditorModal.x}
            y={umlClassEditorModal.y}
            visible={umlClassEditorModal.visible}
            onClose={() => setUmlClassEditorModal({ visible: false, x: 0, y: 0, itemId: '' })}
            node={diagramData.nodes?.find((n: DiagramNodeData) => n.id === umlClassEditorModal.itemId) ?? null}
            onSave={(nodeId, umlClass) => {
              const dims = computeUmlClassDimensions(umlClass.name, umlClass.attributes, umlClass.methods);
              setDiagramData((prev: DiagramData) => ({
                ...prev,
                nodes: prev.nodes?.map((n: DiagramNodeData) =>
                  n.id === nodeId ? { ...n, umlClass, width: dims.width, height: dims.height } : n
                ) ?? [],
              }));
              setUmlClassEditorModal({ visible: false, x: 0, y: 0, itemId: '' });
            }}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        {chartDataEditorModal.visible && chartDataEditorModal.itemId && typeof window !== 'undefined' && createPortal(
          <ChartDataEditorModal
            x={chartDataEditorModal.x}
            y={chartDataEditorModal.y}
            visible={chartDataEditorModal.visible}
            onClose={() => setChartDataEditorModal({ visible: false, x: 0, y: 0, itemId: '' })}
            node={diagramData.nodes?.find((n: DiagramNodeData) => n.id === chartDataEditorModal.itemId) ?? null}
            onSave={(nodeId, chart) => {
              setDiagramData((prev: DiagramData) => ({
                ...prev,
                nodes: prev.nodes?.map((n: DiagramNodeData) =>
                  n.id === nodeId ? { ...n, chart } : n
                ) ?? [],
              }));
              setChartDataEditorModal({ visible: false, x: 0, y: 0, itemId: '' });
            }}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        {connectionContextModal.connection && typeof window !== 'undefined' && createPortal(
          <ConnectionContextModal
            x={connectionContextModal.x}
            y={connectionContextModal.y}
            visible={connectionContextModal.visible}
            onClose={() => setConnectionContextModal({ visible: false, x: 0, y: 0, connection: null })}
            connection={connectionContextModal.connection}
            diagramData={diagramData}
            onConnectionUpdate={handleConnectionUpdate}
            onConnectionDisconnect={disconnectConnection}
            onConnectionWaypointAdd={handleConnectionWaypointAdd}
            onConnectionWaypointRemove={handleConnectionWaypointRemove}
            isReadOnly={isReadOnly}
          />,
          document.body
        )}
        <ScratchPad 
          isOpen={scratchPadOpen} 
          onClose={() => setScratchPadOpen(false)} 
          diagramData={diagramData}
          setDiagramData={setDiagramData}
          onCanvasRefresh={refreshCanvas}
          onHistoryUpdate={updateHistory}
        />
        <PresentationPlayer
          open={presentationPlayerOpen}
          slides={presentationPlayerSlides}
          slideDiagrams={presentationPlayerSlideDiagrams}
          currentIndex={presentationPlayerIndex}
          onOpenChange={setPresentationPlayerOpen}
          onIndexChange={setPresentationPlayerIndex}
          onApplyZoomToCurrentSlide={handleApplyPresentationZoomToCurrent}
          onApplyZoomToAllSlides={handleApplyPresentationZoomToAll}
        />
        <AlertDialog
          open={animationSelectionDialogOpen}
          onOpenChange={setAnimationSelectionDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply animation setting</AlertDialogTitle>
              <AlertDialogDescription>
                Other selected connections are detected. Do you want to apply this animation setting to all selected connections, or only the current connection?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationApplySelectedConfirm}>Apply to Selected</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationOverwriteDialogOpen}
          onOpenChange={setAnimationOverwriteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Overwrite animation setting</AlertDialogTitle>
              <AlertDialogDescription>
                Some selected connections already have animation settings. These settings will be overwritten by the new setting. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationOverwriteConfirm}>Overwrite and Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationDisableConfirmDialogOpen}
          onOpenChange={setAnimationDisableConfirmDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable animation for selected connections</AlertDialogTitle>
              <AlertDialogDescription>
                This will disable animation for all currently selected connections. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleAnimationApplyCurrentOnly}>Current Only</AlertDialogCancel>
              <AlertDialogAction onClick={handleAnimationDisableConfirm}>Disable and Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={animationCurrentOnlyDialogOpen}
          onOpenChange={setAnimationCurrentOnlyDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Applied to current connection only</AlertDialogTitle>
              <AlertDialogDescription>
                Only the current connection will apply the animation setting.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setAnimationCurrentOnlyDialogOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={closeTabDialogOpen} onOpenChange={setCloseTabDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
              <AlertDialogDescription>
                This tab has unsaved changes. Do you want to save them before closing?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setPendingCloseTabId(null);
                setCloseTabDialogOpen(false);
              }}>Cancel</AlertDialogCancel>
              <Button variant="outline" onClick={handleCloseTabConfirm}>Don&apos;t Save</Button>
              <Button onClick={handleCloseTabSave}>Save</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DndProvider>
  );
}
