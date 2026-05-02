"use client";

/**
 * EditorCanvas Component
 * 
 * Main orchestrator component for the diagram editor canvas. This component was refactored
 * from a single large file (~4100 lines) into smaller, focused modules for better
 * maintainability and testability.
 * 
 * Architecture:
 * - Uses custom hooks for state management and side effects
 * - Delegates rendering to specialized sub-components
 * - Coordinates event handling between multiple systems
 * - Provides imperative API via ref forwarding
 * 
 * See tree.md for detailed documentation of all modules.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, X } from "lucide-react";
import { DiagramNode } from "../diagram/diagram-node";
import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import type { SelectedItem } from "../diagram-editor";
import { ContextMenu } from "../ui/context-menu";
import { SimulationPopupMenu, type SimulationFeature } from "../ui/simulation-popup-menu";
import {
  SimulationAvailabilityWorkspace,
  type AvailabilityStatus,
  type DependencyEvaluationMode,
  type DependencyGroup,
  type SimulationElementState,
} from "./simulation-availability-workspace";
import { CanvasRulers } from "./canvas-rulers";
import { RULER_SIZE, type PositionedNode, type PositionedGroup } from "./canvas-constants";
import { calculateLayout } from "./canvas-layout-utils";
import { useCanvasTransform } from "@/hooks/use-canvas-transform";
import { getCanvasElementSizeForImageCapture } from "@/lib/presentation-viewport-fit";
import { useCanvasSelection } from "@/hooks/use-canvas-selection";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { useCanvasDragDrop } from "@/hooks/use-canvas-drag-drop";
import { useCanvasClipboard } from "@/hooks/use-canvas-clipboard";
import { useCanvasExport } from "@/hooks/use-canvas-export";
import { useCanvasContextMenu } from "@/hooks/use-canvas-context-menu";
import { useCanvasOperations } from "./canvas-operations";
import { CanvasConnections } from "./canvas-connections";
import { getConnectionEndpointIdSet } from "@/lib/connection-endpoint-ids";
import { CanvasArrowToggles } from "./canvas-arrow-toggles";
import { CanvasConnectionText } from "./canvas-connection-text";
import { getItemGroup } from "@/lib/grouping-utils";
import { computeConnectionSlots, stableDiagramConnectionId } from "@/lib/connection-order-utils";
import {
  collectObjectIdsInSelectionOrder,
  nextNodeLabelForAutoNumber,
  nextZoneLabelForAutoNumber,
  sortObjectIdsByDistanceFromAnchor,
} from "@/lib/auto-number-labels";
import { CanvasRotationOverlay } from "./canvas-rotation-overlay";
import { measureNodeDims } from "./canvas-constants";
import { buildHighlightAnimStaggerOrder } from "@/lib/highlight-anim";
import { useAlignmentGuides } from "@/hooks/use-alignment-guides";
import { CanvasAlignmentGuides } from "./canvas-alignment-guides";
import { SearchResourcesModal } from "./search-resources-modal";
import { MetadataPopup } from "./metadata-popup";
import { snapToGrid } from "./canvas-constants";
import { ConnectionWaypointHandles } from "../diagram/connection-waypoint-handles";
import { cn, isConnectorLineNodeType, isShapeNodeType } from "@/lib/utils";
import { isConnectorLineGeometryClosed } from "@/lib/line-curve-path";
import {
  getConnectorLineVertices,
  insertConnectorLineMidControl,
  insertConnectorLinePointAfterVertexIndex,
} from "@/lib/line-curve-path";
import { syncClosedConnectorLineBorderWidth } from "@/lib/line-styling";
import { isEventFromEditableElement } from "@/lib/keyboard-utils";
import { getDownstreamAnimationChainNodes } from "@/lib/connection-animation";

const ROTATION_DRAG_SENSITIVITY_DEG_PER_PX = 0.5;
const SIMULATION_AVAILABILITY_STATE_KEY = "simulation:availability:state";
const SIMULATION_AVAILABILITY_GROUPS_KEY = "simulation:availability:groups";
const SIMULATION_AVAILABILITY_STATUS_COLORS_KEY = "simulation:availability:status-colors";
const SIMULATION_AVAILABILITY_SELF_STATE_COLORS_KEY = "simulation:availability:self-state-colors";
const SIMULATION_AVAILABILITY_STATUS_TEXTS_KEY = "simulation:availability:status-texts";
const SIMULATION_AVAILABILITY_STATUS_SHADOW_COLORS_KEY = "simulation:availability:status-shadow-colors";
const SIMULATION_AVAILABILITY_STATE_OPACITY_KEY = "simulation:availability:state-opacity";
const SIMULATION_AVAILABILITY_DEPENDENCY_OPACITY_KEY = "simulation:availability:dependency-opacity";
const DEFAULT_SIMULATION_STATUS_COLORS: Record<AvailabilityStatus, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};
const DEFAULT_SIMULATION_SELF_STATE_COLORS: Record<SimulationElementState, string> = {
  active: "#22c55e",
  degraded: "#f59e0b",
  inactive: "#ef4444",
};
const DEFAULT_SIMULATION_STATUS_TEXTS: Record<AvailabilityStatus, string> = {
  green: "",
  amber: "",
  red: "",
};
const DEFAULT_SIMULATION_STATUS_SHADOW_COLORS: Record<AvailabilityStatus, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};
const DEFAULT_SIMULATION_STATE_OPACITY = 0.35;
const DEFAULT_SIMULATION_DEPENDENCY_OPACITY = 0.8;

function normalizeRotationDegrees(rotation: number): number {
  let r = rotation % 360;
  if (r >= 180) r -= 360;
  if (r < -180) r += 360;
  return r;
}

function snapRotationDegrees(rotation: number, snapStep: number): number {
  return normalizeRotationDegrees(Math.round(rotation / snapStep) * snapStep);
}

function parseSimulationJson<T>(rawValue: string | undefined, fallback: T): T {
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function parseSimulationNumber(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hexToRgba(color: string, alpha: number): string {
  const normalized = color.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  const expanded = hex.length === 3 ? hex.split("").map((ch) => ch + ch).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const intVal = Number.parseInt(expanded, 16);
  const red = (intVal >> 16) & 255;
  const green = (intVal >> 8) & 255;
  const blue = intVal & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getSimulationStateFromMetaData(metaData?: Record<string, string>): SimulationElementState {
  const rawState = metaData?.[SIMULATION_AVAILABILITY_STATE_KEY];
  return rawState === "degraded" || rawState === "inactive" ? rawState : "active";
}

function getSimulationGroupsFromMetaData(metaData?: Record<string, string>): DependencyGroup[] {
  const parsed = parseSimulationJson<DependencyGroup[]>(metaData?.[SIMULATION_AVAILABILITY_GROUPS_KEY], []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((group) => {
    const memberModes = Object.fromEntries(
      Object.entries(group.memberModes ?? {}).filter(([memberId, mode]) => {
        if (!group.memberIds.includes(memberId)) return false;
        return mode === "self" || mode === "dependencies" || mode === "both";
      })
    ) as Record<string, DependencyEvaluationMode>;

    return {
      ...group,
      minUnavailable:
        typeof group.minUnavailable === "number"
          ? group.minUnavailable
          : (typeof group.minDegraded === "number" ? group.minDegraded : 1),
      memberModes,
    };
  });
}

function getSimulationStatusColorsFromMetaData(metaData?: Record<string, string>): Record<AvailabilityStatus, string> {
  return {
    ...DEFAULT_SIMULATION_STATUS_COLORS,
    ...parseSimulationJson<Record<AvailabilityStatus, string>>(
      metaData?.[SIMULATION_AVAILABILITY_STATUS_COLORS_KEY],
      DEFAULT_SIMULATION_STATUS_COLORS,
    ),
  };
}

function getSimulationSelfStateColorsFromMetaData(metaData?: Record<string, string>): Record<SimulationElementState, string> {
  return {
    ...DEFAULT_SIMULATION_SELF_STATE_COLORS,
    ...parseSimulationJson<Record<SimulationElementState, string>>(
      metaData?.[SIMULATION_AVAILABILITY_SELF_STATE_COLORS_KEY],
      DEFAULT_SIMULATION_SELF_STATE_COLORS,
    ),
  };
}

function getSimulationStatusTextsFromMetaData(metaData?: Record<string, string>): Record<AvailabilityStatus, string> {
  return {
    ...DEFAULT_SIMULATION_STATUS_TEXTS,
    ...parseSimulationJson<Record<AvailabilityStatus, string>>(
      metaData?.[SIMULATION_AVAILABILITY_STATUS_TEXTS_KEY],
      DEFAULT_SIMULATION_STATUS_TEXTS,
    ),
  };
}

function getSimulationStatusShadowColorsFromMetaData(metaData?: Record<string, string>): Record<AvailabilityStatus, string> {
  return {
    ...DEFAULT_SIMULATION_STATUS_SHADOW_COLORS,
    ...parseSimulationJson<Record<AvailabilityStatus, string>>(
      metaData?.[SIMULATION_AVAILABILITY_STATUS_SHADOW_COLORS_KEY],
      DEFAULT_SIMULATION_STATUS_SHADOW_COLORS,
    ),
  };
}

function resolveAvailabilityThreshold(value: number, total: number): number {
  if (value === 0) return 0;
  if (value > 0 && value < 1) return Math.min(total, Math.max(1, Math.ceil(value * total)));
  return Math.min(total, Math.max(1, Math.round(value)));
}

function computeDependencyGroupStatus(
  group: DependencyGroup,
  simulationItemStateById: Record<string, SimulationElementState>,
  simulationAvailabilityStatusById: Record<string, AvailabilityStatus>,
): AvailabilityStatus {
  const total = group.memberIds.length;
  if (total === 0) return "green";

  const availabilityToState = (status: AvailabilityStatus): SimulationElementState => {
    if (status === "green") return "active";
    if (status === "amber") return "degraded";
    return "inactive";
  };

  const stateRank = (state: SimulationElementState): number => {
    if (state === "active") return 0;
    if (state === "degraded") return 1;
    return 2;
  };

  const getState = (id: string): SimulationElementState => {
    const selfState = simulationItemStateById[id] ?? "active";
    const dependencyState = availabilityToState(simulationAvailabilityStatusById[id] ?? "green");
    const mode = group.memberModes?.[id] ?? "both";
    if (mode === "self") return selfState;
    if (mode === "dependencies") return dependencyState;
    return stateRank(selfState) >= stateRank(dependencyState) ? selfState : dependencyState;
  };

  const activeCount = group.memberIds.filter((id) => getState(id) !== "inactive").length;
  const healthyCount = group.memberIds.filter((id) => getState(id) === "active").length;
  const minHealthy = resolveAvailabilityThreshold(group.minHealthy, total);
  const minUnavailableRaw =
    typeof group.minUnavailable === "number"
      ? group.minUnavailable
      : (typeof group.minDegraded === "number" ? group.minDegraded : 1);
  const minUnavailable = minUnavailableRaw === 0 ? 0 : resolveAvailabilityThreshold(minUnavailableRaw, total);

  if (healthyCount >= minHealthy) return "green";
  if (minUnavailable === 0 || activeCount >= minUnavailable) return "amber";
  return "red";
}

function computeAvailabilityStatus(
  groups: DependencyGroup[],
  simulationItemStateById: Record<string, SimulationElementState>,
  simulationAvailabilityStatusById: Record<string, AvailabilityStatus>,
): AvailabilityStatus {
  let hasAmber = false;
  for (const group of groups) {
    const status = computeDependencyGroupStatus(group, simulationItemStateById, simulationAvailabilityStatusById);
    if (status === "red") return "red";
    if (status === "amber") hasAmber = true;
  }
  return hasAmber ? "amber" : "green";
}

function availabilityStatusLabel(status: AvailabilityStatus): string {
  if (status === "green") return "Healthy";
  if (status === "amber") return "Degraded";
  return "Unavailable";
}

function simulationStateBadgeLabel(state: SimulationElementState): { full: string } {
  if (state === "active") return { full: "Active" };
  if (state === "degraded") return { full: "Degraded" };
  return { full: "Inactive" };
}

function simulationStateBadgeIcon(state: SimulationElementState) {
  if (state === "active") return <Check className="h-2.5 w-2.5 text-foreground" />;
  if (state === "degraded") return <Minus className="h-2.5 w-2.5 text-foreground" />;
  return <X className="h-2.5 w-2.5 text-foreground" />;
}

function nextSimulationElementState(state: SimulationElementState): SimulationElementState {
  if (state === "active") return "degraded";
  if (state === "degraded") return "inactive";
  return "active";
}

interface EditorCanvasProps {
  diagramData: DiagramData;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  onItemSelect: (item: SelectedItem | null, shiftKey?: boolean) => void;
  onBatchSelect?: (itemIds: string[]) => void;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedItem: React.Dispatch<React.SetStateAction<SelectedItem | null>>;
  selectedItemId?: string;
  selectedItem?: SelectedItem;
  selectedItemIds?: Set<string>;
  isConnectMode: boolean;
  onNodeClickInConnectMode: (node: DiagramNodeData) => void;
  onConnect?: (connectionOptions?: { style?: 'pathways' | 'bezier', curvature?: number; sourceItemId?: string }) => void;
  onDisconnect?: () => void;
  onConnectionDelete?: (from: string, to: string) => void;
  onConnectionWaypointMove?: (from: string, to: string, index: number, newPos: { x: number; y: number }, connectionId?: string) => void;
  onConnectionUpdate?: (from: string, to: string, updates: Record<string, unknown>, connectionId?: string) => void;
  onConnectionWaypointAdd?: (from: string, to: string) => void;
  onConnectionInsertNode?: (connection: DiagramConnectionData, connectionIndex: number, diagramPoint: { x: number; y: number }) => void;
  onConnectionContextMenu?: (e: React.MouseEvent, connection: DiagramConnectionData) => void;
  externalTransform?: { x: number; y: number; k: number };
  onTransformChange?: (transform: { x: number; y: number; k: number }) => void;
   onLabelUpdate?: (nodeId: string, newLabel: string) => void;
   onTagUpdate?: (nodeId: string, newTag: string) => void;
   onZoneTagUpdate?: (zoneId: string, newTag: string) => void;
   onDraggingChange?: (isDragging: boolean) => void;
  /** While true, chart in-canvas value drag is active — defer undo/redo snapshots until drag ends. */
  onChartValueDragSessionChange?: (active: boolean) => void;
  onClipboardChange?: (hasClipboard: boolean) => void;
  onMousePositionChange?: (position: { x: number; y: number } | null) => void;
  onSelectionChange?: (selection: { start: { x: number; y: number } | null; end: { x: number; y: number } | null }) => void;
  onExportComplete?: () => void;
  hoverEnabled?: boolean;
  iconBackgroundEnabled?: boolean;
  /** When false, new palette drops omit resource name (label) and info for icons/objects; text/textbox drops unchanged. Default true. */
  defaultTextLabelsEnabled?: boolean;
  connectionsBehindNodesEnabled?: boolean;
  animationConnectionsEnabled?: boolean;
  animationToggleOnClickEnabled?: boolean;
  /** When set, only show animations for connections from these source node IDs. Empty set = no animations (e.g. when deselected). */
  animationFilterSourceIds?: Set<string>;
  animationDisabledSources?: Set<string>;
  onAnimationDisabledSourcesChange?: (sources: Set<string>) => void;
  onSelectAll?: () => void;
  onTriggerTextStylingPanel?: () => void;
  onTriggerVisualStylingPanel?: () => void;
  onTriggerLineStylingPanel?: () => void;
  onTriggerConnectionSettingsPanel?: () => void;
  onResetConnectionSettingsTrigger?: () => void;
  layers?: {
    getAllLayers: () => Array<{id: string; name: string}>;
    getItemLayerById: (itemId: string) => string;
    assignItemsToLayer: (itemIds: string[], layerId: string) => void;
  };
  onGroupItems?: () => void;
  onUngroupItems?: () => void;
  onRemoveFromGroup?: () => void;
  onAddToGroupItems?: (groupId: string) => void;
  onMoveToBack?: () => void;
  onMoveToFront?: () => void;
  onMoveOneBack?: () => void;
  onMoveOneForward?: () => void;
  onZoneLayoutChange?: (zoneId: string, layout: 'grid' | 'circular') => void;
  onZoneCycle?: (zoneId: string) => void;
  onZoneSort?: (zoneId: string, order: 'alpha-asc' | 'alpha-desc') => void;
  isReadOnly?: boolean;
  alignmentGuidesEnabled?: boolean;
  onResourceActivateAtPosition?: (
    resource: { name: string; file?: string; type?: string; hasWhiteVariant?: boolean; format?: string; iconType?: string; iconName?: string; emoji?: string; imageUrl?: string; imageOptions?: import('@/lib/types').CustomImageOptions },
    provider: string,
    category: string,
    position: { x: number; y: number },
    fullItem?: object
  ) => void;
  metadataPopupsEnabled?: boolean;
  setUmlClassEditorModal?: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number; itemId: string }>>;
  setChartDataEditorModal?: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number; itemId: string }>>;
  /** Layer show/hide animation styles for nodes (from useLayerAnimation) */
  nodeAnimationStyles?: Map<string, { opacity: number; transition: string; transform?: string }>;
  /** Layer show/hide animation styles for connections (from useLayerAnimation) */
  connectionAnimationStyles?: Map<string, { opacity: number; transition: string; transform?: string }>;
  /** Key function for connection lookup (from useLayerAnimation.connectionKey) */
  connectionKey?: (conn: DiagramConnectionData) => string;
  /** Presentation slide / revision — remount connection layer so gradients match the slide diagram. */
  connectionRenderRevision?: string | number;
  /** Double-click on node with subDiagramId navigates to sub-diagram */
  onSubDiagramDoubleClick?: (node: DiagramNodeData) => void;
  /** True when node has subDiagramId and the linked sub exists (current level or root) */
  getHasLinkedSubDiagram?: (node: DiagramNodeData) => boolean;
  /** Create sub-diagram and link to node (context menu) */
  onCreateSubDiagram?: (nodeId: string) => void;
  /** Remove sub-diagram link from node (context menu) */
  onRemoveSubDiagramLink?: (nodeId: string) => void;
  /** Pause connection animations while a canvas context menu / overlay is open (same effective flag as top menubar). */
  onPauseConnectionAnimationsForOverlayUi?: () => void;
  /** Connector line: vertex handle click target for delete-point */
  connectorLineFocusedVertex?: { nodeId: string; vertexIndex: number } | null;
  onConnectorLineVertexFocus?: (nodeId: string, vertexIndex: number) => void;
  /** Return true if a focused line vertex was deleted (or delete was cancelled) — skip full node / batch delete */
  tryDeleteConnectorLineVertexBeforeNodeDelete?: (nodeId: string) => boolean;
  /** Simulation mode enables right-click simulation menu and left-click state cycling. */
  simulationModeEnabled?: boolean;
  /** Open the stacking / z-order list panel (e.g. from context menu). */
  onOpenZOrderList?: (point?: { x: number; y: number }, initialItemId?: string) => void;
  /** When true, wheel zoom is disabled (e.g. z-order list open in parent). */
  wheelZoomSuppressed?: boolean;
  /** When false, canvas background has no dot grid (e.g. presentation play mode overlay). Default true. */
  showDotGrid?: boolean;
}


export type EditorCanvasHandle = {
  /** Width/height of the canvas host for fit math (matches pointer / transform coordinates). */
  getCanvasHostViewportForFit: () => { width: number; height: number } | null;
  fitToView: () => void;
  exportPng: (options?: { backgroundColor?: 'transparent' | 'white' | 'dark'; quality?: 'low' | 'medium' | 'high' }) => Promise<void>;
  exportGif: (options?: { backgroundColor?: 'transparent' | 'white' | 'dark'; quality?: 'low' | 'medium' | 'high'; fps?: number; durationSeconds?: number }) => Promise<void>;
  captureSnapshotPng: (options?: {
    backgroundColor?: 'transparent' | 'white' | 'dark';
    quality?: 'low' | 'medium' | 'high';
    /** Fit diagram content in the bitmap only (html-to-image clone); does not change the canvas view. */
    fitContent?: boolean;
    /** With fitContent: bounds for fit (one slide for thumbnails, multiple for deck-consistent framing — see `use-canvas-export`). */
    unionDiagrams?: DiagramData[];
    fitPadding?: number;
    /** With fitContent: output canvas sized to content (+ margin) instead of full viewport dimensions. */
    tightContentFrame?: boolean;
    frameBorderPx?: number;
  }) => Promise<string>;
  copy: () => void;
  paste: () => void;
  canPaste: () => boolean;
  pastePaletteItem: (item: any, position?: { x: number; y: number }) => void;
};

export const EditorCanvas = React.forwardRef<EditorCanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { diagramData, setDiagramData, onItemSelect, onBatchSelect, setSelectedItemIds, setSelectedItem, selectedItemId, selectedItem, selectedItemIds = new Set(), isConnectMode, onNodeClickInConnectMode, onConnect, onDisconnect, onConnectionDelete, onConnectionWaypointMove, onConnectionUpdate, onConnectionWaypointAdd, onConnectionInsertNode, onConnectionContextMenu, externalTransform, onTransformChange, onLabelUpdate, onTagUpdate, onZoneTagUpdate, onDraggingChange, onChartValueDragSessionChange, onClipboardChange, onMousePositionChange, onSelectionChange, onExportComplete, hoverEnabled = true, iconBackgroundEnabled = true, defaultTextLabelsEnabled = true, connectionsBehindNodesEnabled = true, animationConnectionsEnabled = true, animationToggleOnClickEnabled = false, animationFilterSourceIds, animationDisabledSources = new Set(), onAnimationDisabledSourcesChange, onSelectAll, onTriggerTextStylingPanel, onTriggerVisualStylingPanel, onTriggerLineStylingPanel, onTriggerConnectionSettingsPanel, onResetConnectionSettingsTrigger, layers, onGroupItems, onUngroupItems, onRemoveFromGroup, onAddToGroupItems, onMoveToBack, onMoveToFront, onMoveOneBack, onMoveOneForward, onZoneLayoutChange, onZoneCycle, onZoneSort, isReadOnly = false, alignmentGuidesEnabled = true, onResourceActivateAtPosition, metadataPopupsEnabled = true, setUmlClassEditorModal, setChartDataEditorModal, nodeAnimationStyles, connectionAnimationStyles, connectionKey, connectionRenderRevision, onSubDiagramDoubleClick, getHasLinkedSubDiagram, onCreateSubDiagram, onRemoveSubDiagramLink, onPauseConnectionAnimationsForOverlayUi, connectorLineFocusedVertex = null, onConnectorLineVertexFocus, tryDeleteConnectorLineVertexBeforeNodeDelete, simulationModeEnabled = false, onOpenZOrderList, wheelZoomSuppressed = false, showDotGrid = true }: EditorCanvasProps,
  ref
) {
  const [gifExportAnimationTimeSeconds, setGifExportAnimationTimeSeconds] = React.useState<number | null>(null);

  // ============================================================================
  // LAYOUT CALCULATION
  // ============================================================================
  // Uses canvas-layout-utils.ts to calculate positions for all nodes and zones
  // This runs whenever diagramData changes and returns:
  // - processedNodes: Nodes with calculated x/y positions
  // - processedZones: Zones with calculated x/y/width/height
  // - width/height: Total canvas dimensions needed to contain all items
  const { processedNodes, processedZones, width, height } = useMemo(() => {
    return calculateLayout(diagramData);
  }, [diagramData]);

  // ============================================================================
  // LOOKUP MAPS
  // ============================================================================
  // Create fast lookup maps for O(1) access to nodes and zones by ID
  // Used by sub-components that need to find items quickly
  const nodesById = useMemo(() => {
    return processedNodes.reduce((acc, node) => {
      acc[node.id] = node;
      return acc;
    }, {} as Record<string, PositionedNode>);
  }, [processedNodes]);
  
  const zonesById = useMemo(() => {
    return processedZones.reduce((acc, zone) => {
      acc[zone.id] = zone;
      return acc;
    }, {} as Record<string, PositionedGroup>);
  }, [processedZones]);

  // Connection order: which connections render in which slot (between items) for proper z-order
  const connectionSlots = useMemo(
    () => computeConnectionSlots(diagramData, processedNodes, processedZones),
    [diagramData, processedNodes, processedZones]
  );

  // When a selected item is behind others, items on top get pointer-events: none so resize/drag
  // targets the selected item. Preserves visual stacking; allows operating on background when selected.
  const pointerEventsPassThroughIds = useMemo(() => {
    const passThrough = new Set<string>();
    if (!selectedItemIds?.size || selectedItemIds.size === 0) return passThrough;
    const sortedIds = connectionSlots.sortedItemIds;
    const getBounds = (id: string) => {
      const node = nodesById[id];
      const zone = zonesById[id];
      if (node) {
        const dims = measureNodeDims(node as PositionedNode);
        return { x: node.x ?? 0, y: node.y ?? 0, w: dims.width, h: dims.height };
      }
      if (zone) {
        return { x: zone.x ?? 0, y: zone.y ?? 0, w: zone.width ?? 300, h: zone.height ?? 220 };
      }
      return null;
    };
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (let i = 0; i < sortedIds.length; i++) {
      const id = sortedIds[i];
      if (!selectedItemIds.has(id)) continue;
      const selBounds = getBounds(id);
      if (!selBounds) continue;
      for (let j = i + 1; j < sortedIds.length; j++) {
        const topId = sortedIds[j];
        if (selectedItemIds.has(topId)) continue;
        const topBounds = getBounds(topId);
        if (!topBounds || !overlaps(selBounds, topBounds)) continue;
        passThrough.add(topId);
      }
    }
    return passThrough;
  }, [connectionSlots.sortedItemIds, selectedItemIds, nodesById, zonesById]);

  const canGroupSelectedCanvasItems = useMemo(() => {
    if (selectedItemIds.size < 2) return false;
    const nodeIds = new Set(diagramData.nodes.map((n) => n.id));
    const zoneIds = new Set((diagramData.zones ?? []).map((z) => z.id));
    return Array.from(selectedItemIds).some((id) => nodeIds.has(id) || zoneIds.has(id));
  }, [diagramData.nodes, diagramData.zones, selectedItemIds]);

  // Get the currently selected item (node or zone) for internal use
  const selectedNodeOrZone = useMemo(() => {
    if (!selectedItemId) return null;
    const node = nodesById[selectedItemId];
    if (node) return { ...node, itemType: 'node' as const };
    const zone = zonesById[selectedItemId];
    if (zone) return { ...zone, itemType: 'zone' as const, subType: (zone as any).subType };
    return null;
  }, [selectedItemId, nodesById, zonesById]);

  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  /** Latest `displayNodesById` for stable `DiagramNode` click handlers (`data-node-id` → node). */
  const displayNodesByIdRef = useRef<Record<string, PositionedNode>>({});
  const nodeClickHandlerRef = useRef<(e: React.MouseEvent, node: DiagramNodeData) => void>(
    (e) => e.stopPropagation()
  );
  const nodeContextMenuHandlerRef = useRef<(e: React.MouseEvent, node: DiagramNodeData) => void>(
    (e) => e.stopPropagation()
  );
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [searchModalOpen, setSearchModalOpen] = React.useState(false);
  const [metadataPopupRect, setMetadataPopupRect] = useState<{
    top: number;
    left: number;
    right: number;
    width: number;
    height: number;
    bottom: number;
  } | null>(null);
  const [simulationMenuState, setSimulationMenuState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    itemId: string;
    itemType: "node" | "zone" | "connection";
  } | null>(null);
  const [availabilityWorkspaceTarget, setAvailabilityWorkspaceTarget] = useState<{
    itemId: string;
    itemType: "node" | "zone" | "connection";
  } | null>(null);

  // Client-side rendering state
  const [isClient, setIsClient] = useState(false);

  // ============================================================================
  // ROTATION HANDLE STATE
  // ============================================================================
  // Track which selected item is currently hovered (for showing rotation handles)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredItemType, setHoveredItemType] = useState<'node' | 'zone' | null>(null);
  const [simulationHoveredItemId, setSimulationHoveredItemId] = useState<string | null>(null);
  const [simulationHoveredItemType, setSimulationHoveredItemType] = useState<'node' | 'zone' | null>(null);

  // Rotation drag state
  const [rotationDragState, setRotationDragState] = useState<{
    isActive: boolean;
    targetId: string;
    targetType: 'node' | 'zone';
    startY: number;
    startRotation: number;
    currentRotation: number;
    lastPointerClientY: number;
    shiftKey: boolean;
    activePointerId: number;
    capturedElement: HTMLElement | null;
  } | null>(null);

  /** Latest rotation drag state for pointer/keyboard handlers (avoids stale closures) */
  const rotationDragRef = useRef<typeof rotationDragState>(null);
  rotationDragRef.current = rotationDragState;

  // Store original dimensions for all selected items during multi-resize
  const originalDimensionsRef = useRef<Map<string, { width: number; height: number }>>(new Map());

  // Store original dimensions for all selected items when resize starts
  const handleResizeStart = useCallback((itemId: string, width: number, height: number) => {
    // Store original dimensions for the item being resized
    originalDimensionsRef.current.set(itemId, { width, height });
    
    // If multi-select, store original dimensions for all selected items
    if (selectedItemIds.size > 1) {
      selectedItemIds.forEach(id => {
        if (!originalDimensionsRef.current.has(id)) {
          const node = nodesById[id];
          const zone = zonesById[id];
          if (node) {
            const nodeWidth = node.width || 80;
            const nodeHeight = node.height || 80;
            originalDimensionsRef.current.set(id, { width: nodeWidth, height: nodeHeight });
          } else if (zone) {
            originalDimensionsRef.current.set(id, { width: zone.width, height: zone.height });
          }
        }
      });
    }
  }, [selectedItemIds, nodesById, zonesById]);

  // Clear original dimensions when resize ends
  const handleResizeEnd = useCallback(() => {
    originalDimensionsRef.current.clear();
  }, []);

  // Determine which item should show rotation handles
  // Handles appear when items are selected and persist until deselected
  // For multi-select, use the first selected item (or hovered item if available)
  const rotationTarget = useMemo(() => {
    // If no items selected, no rotation handles
    if (selectedItemIds.size === 0) {
      return null;
    }
    
    // Helper to check if a node is a line or point (exclude from rotation)
    const isLineNode = (node: any) => isConnectorLineNodeType(node?.type);
    const isPointNode = (node: any) => {
      return node?.type === 'generic.object.point' || node?.type?.endsWith('.point');
    };
    const excludeFromRotation = (node: any) => isLineNode(node) || isPointNode(node);
    
    // If hovering a selected item, use that (for multi-select, this provides better UX)
    if (hoveredItemId && hoveredItemType && selectedItemIds.has(hoveredItemId)) {
      // Exclude line and point nodes from rotation
      if (hoveredItemType === 'node') {
        const node = nodesById[hoveredItemId];
        if (node && excludeFromRotation(node)) return null;
      }
      return { id: hoveredItemId, type: hoveredItemType };
    }
    
    // For single selection, show handles for the selected item
    if (selectedItemIds.size === 1 && selectedItemId) {
      const node = nodesById[selectedItemId];
      if (node) {
        // Exclude line and point nodes from rotation
        if (excludeFromRotation(node)) return null;
        return { id: selectedItemId, type: 'node' as const };
      }
      const zone = zonesById[selectedItemId];
      if (zone) return { id: selectedItemId, type: 'zone' as const };
    }
    
    // For multi-select, use the first selected item (persistent, won't flicker)
    if (selectedItemIds.size > 1) {
      // Try to find first node (excluding lines and points)
      for (const id of selectedItemIds) {
        const node = nodesById[id];
        if (node && !excludeFromRotation(node)) return { id, type: 'node' as const };
      }
      // If no nodes, find first zone
      for (const id of selectedItemIds) {
        const zone = zonesById[id];
        if (zone) return { id, type: 'zone' as const };
      }
    }
    
    return null;
  }, [hoveredItemId, hoveredItemType, selectedItemIds, selectedItemId, nodesById, zonesById]);

  // Handle hover changes from nodes/zones
  // Don't clear hover when mouse moves to rotation overlay to prevent flickering
  const handleHoverChange = useCallback((id: string, itemType: 'node' | 'zone', isHovered: boolean) => {
    if (simulationModeEnabled) {
      if (isHovered) {
        setSimulationHoveredItemId(id);
        setSimulationHoveredItemType(itemType);
      } else if (simulationHoveredItemId === id) {
        setSimulationHoveredItemId(null);
        setSimulationHoveredItemType(null);
      }
    }

    if (isHovered) {
      setHoveredItemId(id);
      setHoveredItemType(itemType);
    } else {
      // Only clear if this was the hovered item and we're not in multi-select
      // In multi-select, keep the hover state stable to prevent flickering
      if (hoveredItemId === id && selectedItemIds.size <= 1) {
        setHoveredItemId(null);
        setHoveredItemType(null);
      }
      // For multi-select, keep the hover state even when mouse leaves
      // This prevents flickering when moving mouse to rotation handles
    }
  }, [simulationModeEnabled, simulationHoveredItemId, hoveredItemId, selectedItemIds]);

  useEffect(() => {
    if (!simulationModeEnabled) {
      setSimulationHoveredItemId(null);
      setSimulationHoveredItemType(null);
    }
  }, [simulationModeEnabled]);

  // Update rotation for an item
  const setRotationForItem = useCallback((targetId: string, targetType: 'node' | 'zone', rotation: number, applyToAllSelected = false, snapStep = 5) => {
    const normalizedRotation = snapRotationDegrees(rotation, snapStep);

    setDiagramData(prev => {
      if (applyToAllSelected && selectedItemIds.size > 1) {
        // Apply rotation to all selected items
        const updatedNodes = prev.nodes.map(n => {
          if (selectedItemIds.has(n.id)) {
            return { ...n, rotation: normalizedRotation };
          }
          return n;
        });
        
        const updatedZones = (prev.zones || []).map(z => {
          if (selectedItemIds.has(z.id)) {
            return { ...z, rotation: normalizedRotation };
          }
          return z;
        });
        
        return { ...prev, nodes: updatedNodes, zones: updatedZones };
      } else {
        // Single item rotation
        if (targetType === 'node') {
          return {
            ...prev,
            nodes: prev.nodes.map(n => 
              n.id === targetId ? { ...n, rotation: normalizedRotation } : n
            ),
          };
        } else {
          return {
            ...prev,
            zones: (prev.zones || []).map(z =>
              z.id === targetId ? { ...z, rotation: normalizedRotation } : z
            ),
          };
        }
      }
    });

    // Update selectedItem if it's the rotated item
    if (selectedNodeOrZone?.id === targetId) {
      setSelectedItem({ ...selectedNodeOrZone, rotation: normalizedRotation } as any);
    }
  }, [setDiagramData, selectedNodeOrZone, setSelectedItem]);

  // Handle rotation handle pointer down
  const handleRotationHandlePointerDown = useCallback((e: React.PointerEvent, corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    if (!rotationTarget) return;

    e.preventDefault();
    e.stopPropagation();

    const target = rotationTarget.type === 'node' 
      ? nodesById[rotationTarget.id]
      : zonesById[rotationTarget.id];
    
    if (!target) return;

    const currentRotation = (target as any).rotation || 0;

    const capturedElement = e.target as HTMLElement;
    
    setRotationDragState({
      isActive: true,
      targetId: rotationTarget.id,
      targetType: rotationTarget.type,
      startY: e.clientY,
      startRotation: currentRotation,
      currentRotation: currentRotation,
      lastPointerClientY: e.clientY,
      shiftKey: e.shiftKey,
      activePointerId: e.pointerId,
      capturedElement,
    });

    // Set pointer capture for smooth dragging
    capturedElement.setPointerCapture(e.pointerId);
  }, [rotationTarget, nodesById, zonesById]);

  const onRotationHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      handleRotationHandlePointerDown(e, "top-left");
    },
    [handleRotationHandlePointerDown]
  );

  // Pointer drag + Shift: 5° snap (default) or 45° snap when Shift is held
  const isRotationDragging = !!rotationDragState?.isActive;

  useEffect(() => {
    if (!isRotationDragging) return;

    const applyRotationFromPointer = (clientY: number, shiftKey: boolean) => {
      const drag = rotationDragRef.current;
      if (!drag?.isActive) return;

      const deltaY = drag.startY - clientY;
      const rawRotation = drag.startRotation + deltaY * ROTATION_DRAG_SENSITIVITY_DEG_PER_PX;
      const snapStep = shiftKey ? 45 : 5;
      const newRotation = snapRotationDegrees(rawRotation, snapStep);
      const targetId = drag.targetId;
      const targetType = drag.targetType;

      setRotationDragState((prev) =>
        prev
          ? {
              ...prev,
              currentRotation: newRotation,
              lastPointerClientY: clientY,
              shiftKey,
            }
          : null
      );

      requestAnimationFrame(() => {
        setRotationForItem(targetId, targetType, newRotation, true, snapStep);
      });
    };

    const handlePointerMove = (e: PointerEvent) => {
      applyRotationFromPointer(e.clientY, e.shiftKey);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = rotationDragRef.current;
      if (!drag?.isActive || e.pointerId !== drag.activePointerId) return;

      const capturedElement = drag.capturedElement;
      const snapStep = e.shiftKey ? 45 : 5;
      const deltaY = drag.startY - drag.lastPointerClientY;
      const rawRotation =
        drag.startRotation + deltaY * ROTATION_DRAG_SENSITIVITY_DEG_PER_PX;
      const finalRotation = snapRotationDegrees(rawRotation, snapStep);

      if (capturedElement) {
        try {
          capturedElement.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }

      setRotationForItem(drag.targetId, drag.targetType, finalRotation, true, snapStep);
      setRotationDragState(null);
    };

    const handlePointerUpCapture = (e: PointerEvent) => {
      if (rotationDragRef.current?.isActive) {
        handlePointerUp(e);
      }
    };

    const handleShiftKeyToggle = (e: KeyboardEvent) => {
      if (e.key !== "Shift") return;
      const drag = rotationDragRef.current;
      if (!drag?.isActive) return;
      applyRotationFromPointer(drag.lastPointerClientY, e.shiftKey);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUpCapture);
    window.addEventListener("keydown", handleShiftKeyToggle);
    window.addEventListener("keyup", handleShiftKeyToggle);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUpCapture);
      window.removeEventListener("keydown", handleShiftKeyToggle);
      window.removeEventListener("keyup", handleShiftKeyToggle);
    };
  }, [isRotationDragging, setRotationForItem]);
  
  
  // ============================================================================
  // HOOK: useCanvasTransform
  // ============================================================================
  // Manages canvas panning and zooming
  // - transform: Current canvas transform (x, y, k/scale)
  // - handleWheel: Processes mouse wheel events for zooming
  // - handleFitToView: Auto-fits diagram to viewport
  // - setTransform: Updates transform state
  // See: src/hooks/use-canvas-transform.ts
  const { transform, setTransform, handleWheel, handleFitToView } = useCanvasTransform({
    externalTransform,
    onTransformChange,
    canvasRef,
    processedNodes,
    processedZones,
    wheelZoomDisabled: searchModalOpen || wheelZoomSuppressed,
  });

  // Measure selected item rect for metadata popup (anchored to object)
  useLayoutEffect(() => {
    if (!metadataPopupsEnabled || !selectedItemId || !selectedItem) {
      setMetadataPopupRect(null);
      return;
    }
    const metaData = selectedItem && "metaData" in selectedItem ? selectedItem.metaData : undefined;
    if (!metaData || Object.keys(metaData).length === 0) {
      setMetadataPopupRect(null);
      return;
    }
    const container = canvasRef.current;
    if (!container) {
      setMetadataPopupRect(null);
      return;
    }
    const isEdge = selectedItem?.itemType === "edge";
    const selector = isEdge ? `[data-connection-id="${selectedItemId}"]` : `[data-node-id="${selectedItemId}"]`;
    const el = container.querySelector(selector);
    if (!el) {
      setMetadataPopupRect(null);
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setMetadataPopupRect({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
      });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [metadataPopupsEnabled, selectedItemId, selectedItem, transform.x, transform.y, transform.k]);

  // ============================================================================
  // HOOK: useCanvasOperations
  // ============================================================================
  // Provides CRUD operations for diagram items
  // - addNode: Adds a new node to the diagram
  // - resizeNode: Resizes a node with minimum size constraints
  // - resizeGroup: Resizes a zone with minimum size constraints
  // - moveItem: Moves a single item
  // - moveMultipleItems: Moves multiple selected items
  // - handleDelete: Deletes a single item
  // - handleDeleteMultiple: Deletes multiple items
  // - updateGroupLabel: Updates zone label
  // See: src/components/editor/canvas-operations.ts
  const operations = useCanvasOperations({
    setDiagramData,
    processedNodes,
    processedZones,
    onItemSelect,
    toast,
    iconBackgroundEnabled,
    defaultTextLabelsEnabled,
  });

  // Wrapper functions for multi-item resize
  const handleNodeUpdate = useCallback((updatedNode: DiagramNodeData) => {
    setDiagramData(prevData => ({
      ...prevData,
      nodes: prevData.nodes?.map(n => n.id === updatedNode.id ? updatedNode : n) || []
    }));
  }, [setDiagramData]);

  const handleNodeResize = useCallback((nodeId: string, newWidth: number, newHeight: number, newX?: number, newY?: number) => {
    if (selectedItemIds.size > 1 && selectedItemIds.has(nodeId)) {
      // Multi-select resize: calculate scale factors from the dragged node
      const draggedOriginal = originalDimensionsRef.current.get(nodeId);
      if (draggedOriginal) {
        const scaleX = draggedOriginal.width > 0 ? newWidth / draggedOriginal.width : 1;
        const scaleY = draggedOriginal.height > 0 ? newHeight / draggedOriginal.height : 1;
        const anchorX = newX !== undefined ? ('right' as const) : undefined;
        const anchorY = newY !== undefined ? ('bottom' as const) : undefined;

        // Separate nodes and zones
        const selectedNodeIds: string[] = [];
        const selectedZoneIds: string[] = [];

        selectedItemIds.forEach(id => {
          if (nodesById[id]) {
            selectedNodeIds.push(id);
          } else if (zonesById[id]) {
            selectedZoneIds.push(id);
          }
        });

        if (selectedNodeIds.length > 0) {
          operations.resizeMultipleNodes(selectedNodeIds, scaleX, scaleY, originalDimensionsRef.current, { anchorX, anchorY });
        }
        if (selectedZoneIds.length > 0) {
          operations.resizeMultipleGroups(selectedZoneIds, scaleX, scaleY, originalDimensionsRef.current);
        }
      } else {
        operations.resizeNode(nodeId, newWidth, newHeight, newX, newY);
      }
    } else {
      operations.resizeNode(nodeId, newWidth, newHeight, newX, newY);
    }
  }, [selectedItemIds, nodesById, zonesById, operations]);

  const handleZoneResize = useCallback((zoneId: string, newWidth: number, newHeight: number) => {
    if (selectedItemIds.size > 1 && selectedItemIds.has(zoneId)) {
      // Multi-select resize: calculate scale factors from the dragged zone
      const draggedOriginal = originalDimensionsRef.current.get(zoneId);
      if (draggedOriginal) {
        const scaleX = draggedOriginal.width > 0 ? newWidth / draggedOriginal.width : 1;
        const scaleY = draggedOriginal.height > 0 ? newHeight / draggedOriginal.height : 1;
        
        // Separate nodes and zones
        const selectedNodeIds: string[] = [];
        const selectedZoneIds: string[] = [];
        
        selectedItemIds.forEach(id => {
          if (nodesById[id]) {
            selectedNodeIds.push(id);
          } else if (zonesById[id]) {
            selectedZoneIds.push(id);
          }
        });
        
        if (selectedNodeIds.length > 0) {
          operations.resizeMultipleNodes(selectedNodeIds, scaleX, scaleY, originalDimensionsRef.current);
        }
        if (selectedZoneIds.length > 0) {
          operations.resizeMultipleGroups(selectedZoneIds, scaleX, scaleY, originalDimensionsRef.current);
        }
      } else {
        operations.resizeGroup(zoneId, newWidth, newHeight);
      }
    } else {
      operations.resizeGroup(zoneId, newWidth, newHeight);
    }
  }, [selectedItemIds, nodesById, zonesById, operations]);

  // ============================================================================
  // HOOK: useCanvasDragDrop
  // ============================================================================
  // Handles drag and drop functionality using react-dnd
  // - drop: Configures drop target for canvas
  // - dragPosition: Current drag position for visual feedback
  // - multiDragPositions: Positions for multi-item dragging
  // - hoveredGroupId: ID of zone currently being hovered during drag
  // See: src/hooks/use-canvas-drag-drop.ts
  const handleDuplicateNodesPlaced = useCallback(
    (newNodes: DiagramNodeData[]) => {
      if (newNodes.length === 0) return;
      setSelectedItemIds(new Set(newNodes.map((n) => n.id)));
      setSelectedItem({ ...newNodes[0], itemType: "node" as const });
    },
    [setSelectedItemIds, setSelectedItem]
  );

  const [isCanvasItemDragging, setIsCanvasItemDragging] = useState(false);

  const connectionEndpointIdSet = useMemo(
    () => getConnectionEndpointIdSet(diagramData.connections),
    [diagramData.connections],
  );

  const notifyDraggingChange = useCallback(
    (dragging: boolean) => {
      setIsCanvasItemDragging(dragging);
      onDraggingChange?.(dragging);
    },
    [onDraggingChange]
  );

  const { dragPosition, multiDragPositions, hoveredGroupId, drop, altKeyHeld } = useCanvasDragDrop({
    canvasRef,
    transform,
    processedZones,
    nodesById,
    zonesById,
    selectedItemIds,
    diagramData,
    isReadOnly,
    addNode: operations.addNode,
    moveItem: operations.moveItem,
    moveMultipleItems: operations.moveMultipleItems,
    duplicateNodesAtPositions: operations.duplicateNodesAtPositions,
    onDuplicateNodesPlaced: handleDuplicateNodesPlaced,
    onDraggingChange: notifyDraggingChange,
  });

  /**
   * While a canvas item is being dragged (not Alt+duplicate), connection routing for lines that
   * do not touch the dragged item(s) can stay frozen. Non-endpoint-only drags fully reuse the
   * last bundle; endpoint drags use a partial recompute in CanvasConnections.
   */
  const freezeUnrelatedConnectionRouting = useMemo(() => {
    if (altKeyHeld) return false;
    if (dragPosition?.itemId) return true;
    if (multiDragPositions && Object.keys(multiDragPositions).length > 0) return true;
    return false;
  }, [altKeyHeld, dragPosition?.itemId, multiDragPositions]);

  const unrelatedConnectionRoutingDragIdsKey = useMemo(() => {
    if (!freezeUnrelatedConnectionRouting) return "";
    if (multiDragPositions && Object.keys(multiDragPositions).length > 0) {
      return Object.keys(multiDragPositions).sort().join("\t");
    }
    if (dragPosition?.itemId) {
      return dragPosition.itemId;
    }
    return "";
  }, [freezeUnrelatedConnectionRouting, dragPosition?.itemId, multiDragPositions]);

  const hasEndpointInDrag = useMemo(() => {
    if (!isCanvasItemDragging) return false;
    if (dragPosition?.itemId && connectionEndpointIdSet.has(dragPosition.itemId)) return true;
    if (multiDragPositions) {
      for (const id of Object.keys(multiDragPositions)) {
        if (connectionEndpointIdSet.has(id)) return true;
      }
    }
    return false;
  }, [isCanvasItemDragging, dragPosition?.itemId, multiDragPositions, connectionEndpointIdSet]);

  // Positions during drag (ghost/cursor); used for guides and Alt-duplicate previews
  const nodesWithDragPositions = useMemo(() => {
    const result = { ...nodesById };
    
    // Apply single item drag override
    if (dragPosition?.itemId && result[dragPosition.itemId]) {
      const node = result[dragPosition.itemId];
      const isLineNode = isConnectorLineNodeType(node.type);
      
      if (isLineNode && dragPosition.deltaX !== undefined && dragPosition.deltaY !== undefined) {
        // For line nodes, also update startPos and endPos
        const originalNode = nodesById[dragPosition.itemId];
        if (originalNode) {
          const currentStartPos = (originalNode as any)?.startPos || { x: (originalNode?.x || 0), y: (originalNode?.y || 0) };
          const currentEndPos = (originalNode as any)?.endPos || { x: (originalNode?.x || 0) + 150, y: (originalNode?.y || 0) };
          const ctrls = (originalNode as any)?.lineControlPoints as { x: number; y: number }[] | undefined;
          const dx = dragPosition.deltaX;
          const dy = dragPosition.deltaY;
          result[dragPosition.itemId] = {
            ...node,
            x: dragPosition.x,
            y: dragPosition.y,
            startPos: { x: currentStartPos.x + dx, y: currentStartPos.y + dy },
            endPos: { x: currentEndPos.x + dx, y: currentEndPos.y + dy },
            ...(ctrls?.length
              ? {
                  lineControlPoints: ctrls.map((c) => ({
                    ...c,
                    x: c.x + dx,
                    y: c.y + dy,
                  })),
                }
              : {}),
          };
        } else {
          result[dragPosition.itemId] = {
            ...node,
            x: dragPosition.x,
            y: dragPosition.y
          };
        }
      } else {
        result[dragPosition.itemId] = {
          ...node,
          x: dragPosition.x,
          y: dragPosition.y
        };
      }
    }
    
    // Apply multi-item drag overrides
    if (multiDragPositions) {
      Object.entries(multiDragPositions).forEach(([itemId, pos]) => {
        if (result[itemId]) {
          const node = result[itemId];
          const isLineNode = isConnectorLineNodeType(node.type);
          
          if (isLineNode) {
            // For line nodes, calculate delta and update startPos and endPos
            const originalNode = nodesById[itemId];
            if (originalNode) {
              const originalX = originalNode.x ?? 0;
              const originalY = originalNode.y ?? 0;
              const deltaX = pos.x - originalX;
              const deltaY = pos.y - originalY;
              
              const currentStartPos = (originalNode as any)?.startPos || { x: originalX, y: originalY };
              const currentEndPos = (originalNode as any)?.endPos || { x: originalX + 150, y: originalY };
              const ctrls = (originalNode as any)?.lineControlPoints as { x: number; y: number }[] | undefined;
              
              result[itemId] = {
                ...node,
                x: pos.x,
                y: pos.y,
                startPos: { x: currentStartPos.x + deltaX, y: currentStartPos.y + deltaY },
                endPos: { x: currentEndPos.x + deltaX, y: currentEndPos.y + deltaY },
                ...(ctrls?.length
                  ? {
                      lineControlPoints: ctrls.map((c) => ({
                        ...c,
                        x: c.x + deltaX,
                        y: c.y + deltaY,
                      })),
                    }
                  : {}),
              };
            } else {
              result[itemId] = {
                ...node,
                x: pos.x,
                y: pos.y
              };
            }
          } else {
            result[itemId] = {
              ...node,
              x: pos.x,
              y: pos.y
            };
          }
        }
      });
    }
    
    return result;
  }, [nodesById, dragPosition, multiDragPositions]);

  const displayNodesById = useMemo(() => {
    const isDup = altKeyHeld && (dragPosition || multiDragPositions);
    if (!isDup) return nodesWithDragPositions;
    const r = { ...nodesWithDragPositions };
    if (multiDragPositions && Object.keys(multiDragPositions).length > 0) {
      for (const id of Object.keys(multiDragPositions)) {
        if (nodesById[id]) r[id] = nodesById[id];
      }
      return r;
    }
    if (dragPosition?.itemId && nodesById[dragPosition.itemId]) {
      r[dragPosition.itemId] = nodesById[dragPosition.itemId];
    }
    return r;
  }, [nodesWithDragPositions, nodesById, altKeyHeld, dragPosition, multiDragPositions]);

  displayNodesByIdRef.current = displayNodesById;

  const highlightAnimStagger = useMemo(
    () => buildHighlightAnimStaggerOrder(displayNodesById),
    [displayNodesById]
  );

  const duplicateDragPreviewNodes = useMemo((): DiagramNodeData[] => {
    if (!altKeyHeld || !(dragPosition || multiDragPositions)) return [];
    if (multiDragPositions && Object.keys(multiDragPositions).length > 0) {
      return Object.keys(multiDragPositions)
        .map((id) => {
          const n = nodesWithDragPositions[id];
          if (!n) return null;
          return { ...n, id: `__alt_dup_preview__${id}` } as DiagramNodeData;
        })
        .filter((n): n is DiagramNodeData => n !== null);
    }
    if (dragPosition?.itemId && nodesWithDragPositions[dragPosition.itemId]) {
      const n = nodesWithDragPositions[dragPosition.itemId];
      return [{ ...n, id: `__alt_dup_preview__${dragPosition.itemId}` } as DiagramNodeData];
    }
    return [];
  }, [altKeyHeld, dragPosition, multiDragPositions, nodesWithDragPositions]);

  const zonesWithDragPositions = useMemo(() => {
    const result = { ...zonesById };
    
    // Apply single item drag override
    if (dragPosition?.itemId && result[dragPosition.itemId]) {
      result[dragPosition.itemId] = {
        ...result[dragPosition.itemId],
        x: dragPosition.x,
        y: dragPosition.y
      };
    }
    
    // Apply multi-item drag overrides
    if (multiDragPositions) {
      Object.entries(multiDragPositions).forEach(([itemId, pos]) => {
        if (result[itemId]) {
          result[itemId] = {
            ...result[itemId],
            x: pos.x,
            y: pos.y
          };
        }
      });
    }
    
    return result;
  }, [zonesById, dragPosition, multiDragPositions]);

  const displayZonesById = useMemo(() => {
    const isDup = altKeyHeld && (dragPosition || multiDragPositions);
    if (!isDup) return zonesWithDragPositions;
    const r = { ...zonesWithDragPositions };
    if (multiDragPositions && Object.keys(multiDragPositions).length > 0) {
      for (const id of Object.keys(multiDragPositions)) {
        if (zonesById[id]) r[id] = zonesById[id];
      }
      return r;
    }
    if (dragPosition?.itemId && zonesById[dragPosition.itemId]) {
      r[dragPosition.itemId] = zonesById[dragPosition.itemId];
    }
    return r;
  }, [zonesWithDragPositions, zonesById, altKeyHeld, dragPosition, multiDragPositions]);

  // ============================================================================
  // HOOK: useAlignmentGuides
  // ============================================================================
  // Calculates alignment guides during drag operations
  // Shows green semi-transparent lines when objects align
  // Note: Must be called AFTER displayNodesById and displayZonesById are created
  // See: src/hooks/use-alignment-guides.ts
  const draggedItemId = dragPosition?.itemId || null;
  const draggedItemIds = multiDragPositions ? new Set(Object.keys(multiDragPositions)) : new Set<string>();

  const { guides: alignmentGuides } = useAlignmentGuides({
    diagramData,
    displayNodesById: nodesWithDragPositions,
    displayZonesById: zonesWithDragPositions,
    draggedItemId,
    draggedItemIds,
    transform,
    enabled: alignmentGuidesEnabled,
  });

  // ============================================================================
  // HOOK: useCanvasContextMenu
  // ============================================================================
  // Manages right-click context menu state and position
  // - contextMenu: Current menu state (visible, x, y, itemType, itemId)
  // - handleContextMenu: Opens context menu at specific position
  // - closeContextMenu: Closes the context menu
  // See: src/hooks/use-canvas-context-menu.ts
  const { contextMenu, handleContextMenu, closeContextMenu } = useCanvasContextMenu({
    isReadOnly,
    onContextMenuOpen: onPauseConnectionAnimationsForOverlayUi,
  });
  const [lastRightClickItemId, setLastRightClickItemId] = React.useState<string | null>(null);
  const [searchModalPosition, setSearchModalPosition] = React.useState({ x: 0, y: 0 });
  const [searchModalDiagramPosition, setSearchModalDiagramPosition] = React.useState<{ x: number; y: number } | null>(null);



  // ============================================================================
  // HOOK: useCanvasClipboard
  // ============================================================================
  // Handles copy, paste, and clipboard operations
  // - handleCopy: Copies selected item(s) to clipboard
  // - handlePaste: Pastes clipboard content at mouse position
  // - canPaste: Checks if clipboard has content to paste
  // See: src/hooks/use-canvas-clipboard.ts
  const { clipboard, handleCopy, handlePaste, canPaste } = useCanvasClipboard({
    diagramData,
    selectedItemIds,
    setDiagramData,
    setSelectedItemIds,
    setSelectedItem,
    onItemSelect,
    onBatchSelect,
    onClipboardChange,
    toast,
  });

  // ============================================================================
  // HOOK: useCanvasExport
  // ============================================================================
  // Manages PNG export functionality
  // - exportPng: Exports current viewport to PNG
  // - startExport: Starts export with quality settings
  // See: src/hooks/use-canvas-export.ts
  const { exportPng, exportGif, startExport, captureViewportPngDataUrl } = useCanvasExport({
    canvasRef,
    toast,
    diagramData,
    processedNodes,
    processedZones,
    selectedItemIds,
    onGifAnimationTimeUpdate: setGifExportAnimationTimeSeconds,
  });

  const canAutoNumberLabels = useMemo(
    () => collectObjectIdsInSelectionOrder(selectedItemIds, diagramData).length >= 2,
    [selectedItemIds, diagramData]
  );

  const handleAutoNumberLabels = useCallback(() => {
    const objectIds = collectObjectIdsInSelectionOrder(selectedItemIds, diagramData);
    if (objectIds.length < 2) return;
    const anchorId = objectIds[0];
    const centerById = new Map<string, { x: number; y: number }>();
    for (const id of objectIds) {
      const pNode = processedNodes.find((n) => n.id === id);
      if (pNode && typeof pNode.x === "number" && typeof pNode.y === "number") {
        const dims = measureNodeDims(pNode);
        const w = pNode.sizeMode === "custom" && pNode.width ? pNode.width : dims.width;
        const h = pNode.sizeMode === "custom" && pNode.height ? pNode.height : dims.height;
        centerById.set(id, { x: pNode.x + w / 2, y: pNode.y + h / 2 });
        continue;
      }
      const pZone = processedZones.find((z) => z.id === id);
      if (
        pZone &&
        typeof pZone.x === "number" &&
        typeof pZone.y === "number" &&
        typeof pZone.width === "number" &&
        typeof pZone.height === "number"
      ) {
        centerById.set(id, { x: pZone.x + pZone.width / 2, y: pZone.y + pZone.height / 2 });
      }
    }
    const ordered = sortObjectIdsByDistanceFromAnchor(anchorId, objectIds, centerById);

    setDiagramData((prev) => {
      const nodeUpdates = new Map<string, ReturnType<typeof nextNodeLabelForAutoNumber>>();
      const zoneLabelUpdates = new Map<string, string>();
      for (let i = 0; i < ordered.length; i++) {
        const id = ordered[i];
        const num = i + 1;
        const node = prev.nodes.find((n) => n.id === id);
        if (node) {
          nodeUpdates.set(id, nextNodeLabelForAutoNumber(node, num));
          continue;
        }
        const zone = prev.zones?.find((z) => z.id === id);
        if (zone) {
          zoneLabelUpdates.set(id, nextZoneLabelForAutoNumber(zone.label, num));
        }
      }
      if (nodeUpdates.size === 0 && zoneLabelUpdates.size === 0) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((n) => {
          const u = nodeUpdates.get(n.id);
          if (!u) return n;
          return { ...n, label: u.label, richLabel: undefined };
        }),
        zones:
          zoneLabelUpdates.size === 0
            ? prev.zones
            : (prev.zones?.map((z) => {
                const nl = zoneLabelUpdates.get(z.id);
                return nl !== undefined ? { ...z, label: nl } : z;
              }) ?? []),
      };
    });
    closeContextMenu();
  }, [selectedItemIds, diagramData, processedNodes, processedZones, setDiagramData, closeContextMenu]);

  // ============================================================================
  // HOOK: useCanvasSelection
  // ============================================================================
  // Handles multi-item selection with selection rectangle
  // - selectionStart/End: Selection rectangle coordinates
  // - handleCanvasClick: Clears selection when clicking empty canvas
  // - handleMouseDown/Move/Up: Manages selection rectangle drawing
  // - justCompletedSelection: Flag to prevent immediate deselection
  // See: src/hooks/use-canvas-selection.ts
  const { selectionStart, selectionEnd, selectionMarqueeMode, justCompletedSelection, handleCanvasClick, handleMouseDown: handleSelectionMouseDown, handleMouseMove: handleSelectionMouseMove, handleMouseUpOrLeave: handleSelectionMouseUpOrLeave } = useCanvasSelection({
    canvasRef,
    transform,
    isConnectMode,
    isReadOnly,
    diagramData,
    onItemSelect,
    onBatchSelect,
    onSelectionChange,
    closeContextMenu,
    onCloseConnectionSettingsPanel: onResetConnectionSettingsTrigger,
  });

  // ============================================================================
  // HOOK: useCanvasInteractions
  // ============================================================================
  // Handles mouse position tracking and panning
  // - handleMouseMove: Tracks mouse position (throttled for performance)
  // - handleMouseDown: Initiates right-click panning
  // - handleTouchStart/Move/End: Handles touch gestures for mobile
  // - isPanning: Whether canvas is currently being panned
  // See: src/hooks/use-canvas-interactions.ts
  const { isPanning, handleMouseDown: handleInteractionsMouseDown, handleMouseMove: handleInteractionsMouseMove, handleMouseUpOrLeave: handleInteractionsMouseUpOrLeave, handleTouchStart, handleTouchMove, handleTouchEnd, wasLastRightClickAPan } = useCanvasInteractions({
    canvasRef,
    transform,
    setTransform,
    isConnectMode,
    onMousePositionChange,
  });



  // ============================================================================
  // EVENT HANDLER COMBINATION
  // ============================================================================
  // Combines mouse handlers from multiple hooks to handle all mouse interactions
  // Selection and interaction handlers are called in sequence for each event
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseDown(e);  // Handles selection rectangle start
    handleInteractionsMouseDown(e); // Handles right-click panning start
  }, [handleSelectionMouseDown, handleInteractionsMouseDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleSelectionMouseMove(e);  // Updates selection rectangle while dragging
    handleInteractionsMouseMove(e); // Tracks mouse position and handles panning
  }, [handleSelectionMouseMove, handleInteractionsMouseMove]);

  const handleMouseUpOrLeave = useCallback(async () => {
    await handleSelectionMouseUpOrLeave(); // Completes selection and selects items
    handleInteractionsMouseUpOrLeave(); // Stops panning and cleans up
  }, [handleSelectionMouseUpOrLeave, handleInteractionsMouseUpOrLeave]);

  // ============================================================================
  // NODE/ZONE EVENT HANDLERS
  // ============================================================================
  // Handles clicks and context menus for individual nodes and zones
  // Wrapped in useCallback for stable references (enables DiagramNode memoization)

  const openSimulationMenu = useCallback(
    (e: React.MouseEvent, itemId: string, itemType: "node" | "zone" | "connection") => {
      e.stopPropagation();
      e.preventDefault();
      setSimulationMenuState({ visible: true, x: e.clientX, y: e.clientY, itemId, itemType });
      closeContextMenu();
    },
    [closeContextMenu],
  );

  const handleSimulationElementPrimaryClick = useCallback((e: React.MouseEvent, itemId: string) => {
    if (!simulationModeEnabled) return;
    e.stopPropagation();

    const useSelectionBatch = e.shiftKey || e.ctrlKey || e.metaKey;
    const targetIds = new Set<string>();
    if (useSelectionBatch) {
      selectedItemIds.forEach((id) => targetIds.add(id));
      targetIds.add(itemId);
    } else {
      targetIds.add(itemId);
    }

    setDiagramData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => {
        if (!targetIds.has(node.id)) return node;
        const current = getSimulationStateFromMetaData(node.metaData);
        return {
          ...node,
          metaData: {
            ...(node.metaData ?? {}),
            [SIMULATION_AVAILABILITY_STATE_KEY]: nextSimulationElementState(current),
          },
        };
      }),
      zones: (prev.zones ?? []).map((zone) => {
        if (!targetIds.has(zone.id)) return zone;
        const current = getSimulationStateFromMetaData(zone.metaData);
        return {
          ...zone,
          metaData: {
            ...(zone.metaData ?? {}),
            [SIMULATION_AVAILABILITY_STATE_KEY]: nextSimulationElementState(current),
          },
        };
      }),
      connections: prev.connections.map((connection, index) => {
        const stableId = stableDiagramConnectionId(connection, index);
        if (!targetIds.has(stableId)) return connection;
        const current = getSimulationStateFromMetaData(connection.metaData);
        return {
          ...connection,
          metaData: {
            ...(connection.metaData ?? {}),
            [SIMULATION_AVAILABILITY_STATE_KEY]: nextSimulationElementState(current),
          },
        };
      }),
    }));
  }, [simulationModeEnabled, selectedItemIds, setDiagramData]);

  const handleNodeClick = useCallback((e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    const fingerTap = (e as React.MouseEvent & { dwFingerTap?: boolean }).dwFingerTap === true;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;

    // Touch: second tap on an already-selected item opens the same menu as right-click (mouse unchanged).
    if (fingerTap && !additive && !isConnectMode && selectedItemIds.has(node.id)) {
      nodeContextMenuHandlerRef.current(e, node);
      return;
    }

    closeContextMenu();
    setSimulationMenuState(null);
    onResetConnectionSettingsTrigger?.(); // Reset connection settings panel when clicking on a node

    if (simulationModeEnabled) {
      const isAdditiveSelection = e.shiftKey || e.ctrlKey || e.metaKey;
      if (isAdditiveSelection) {
        onItemSelect({ ...node, itemType: 'node' }, true);
      }
      handleSimulationElementPrimaryClick(e, node.id);
      return;
    }
    
    // When animation mode is on: select = enable animations for this node's chain, deselect = stop.
    // Ensure this node's chain is enabled (clear from disabled) so animations show when selecting.
    if (animationToggleOnClickEnabled && !isConnectMode && onAnimationDisabledSourcesChange && diagramData?.connections) {
      const chainNodes = getDownstreamAnimationChainNodes(node.id, diagramData.connections);
      const next = new Set(animationDisabledSources);
      chainNodes.forEach((id) => next.delete(id));
      onAnimationDisabledSourcesChange(next);
    }
    
    if (isConnectMode) {
      onNodeClickInConnectMode(node); // In connect mode, clicking creates connection
    } else {
      const isAdditiveSelection = e.shiftKey || e.ctrlKey || e.metaKey;
      onItemSelect({ ...node, itemType: 'node' }, isAdditiveSelection); // Normal selection
    }
  }, [closeContextMenu, onResetConnectionSettingsTrigger, simulationModeEnabled, animationToggleOnClickEnabled, isConnectMode, onNodeClickInConnectMode, onItemSelect, handleSimulationElementPrimaryClick, onAnimationDisabledSourcesChange, animationDisabledSources, diagramData, selectedItemIds]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: DiagramNodeData) => {
    e.stopPropagation();
    e.preventDefault();
    setSimulationMenuState(null);
    if (simulationModeEnabled) {
      openSimulationMenu(e, node.id, "node");
      return;
    }
    // If multiple items are selected and this node is already in the selection, preserve the selection
    // Otherwise, select just this node
    if (selectedItemIds.size > 1 && selectedItemIds.has(node.id)) {
      // Preserve multi-selection - don't change selection
    } else if (selectedItemId !== node.id) {
      onItemSelect({ ...node, itemType: 'node' }, false);
    }
    // Always reset connection settings trigger when opening context menu
    onResetConnectionSettingsTrigger?.();
    setLastRightClickItemId(node.id);
    handleContextMenu(e, node.id, 'node'); // Opens context menu
  }, [simulationModeEnabled, openSimulationMenu, selectedItemIds, selectedItemId, onItemSelect, onResetConnectionSettingsTrigger, handleContextMenu]);

  nodeClickHandlerRef.current = handleNodeClick;
  nodeContextMenuHandlerRef.current = handleNodeContextMenu;

  const onDiagramNodeClickStable = useCallback(
    (e: React.MouseEvent, nodeHint?: DiagramNodeData) => {
      let id: string | null = null;
      const ct = e.currentTarget;
      if (ct instanceof Element) {
        id = ct.getAttribute("data-node-id");
      }
      if (!id && e.target instanceof Element) {
        id = e.target.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
      }
      if (!id && nodeHint) id = nodeHint.id;
      if (!id) return;
      const node = displayNodesByIdRef.current[id] ?? (nodeHint?.id === id ? nodeHint : undefined);
      if (!node) return;
      nodeClickHandlerRef.current(e, node);
    },
    [],
  );

  const onDiagramNodeContextMenuStable = useCallback(
    (e: React.MouseEvent, nodeHint?: DiagramNodeData) => {
      let id: string | null = null;
      const ct = e.currentTarget;
      if (ct instanceof Element) {
        id = ct.getAttribute("data-node-id");
      }
      if (!id && e.target instanceof Element) {
        id = e.target.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
      }
      if (!id && nodeHint) id = nodeHint.id;
      if (!id) return;
      const node = displayNodesByIdRef.current[id] ?? (nodeHint?.id === id ? nodeHint : undefined);
      if (!node) return;
      nodeContextMenuHandlerRef.current(e, node);
    },
    [],
  );

  const handleZoneClick = useCallback((e: React.MouseEvent, zone: DiagramZoneData) => {
    e.stopPropagation();
    closeContextMenu();
    setSimulationMenuState(null);
    onResetConnectionSettingsTrigger?.(); // Reset connection settings panel when clicking on a zone
    if (simulationModeEnabled) {
      const isAdditiveSelection = e.shiftKey || e.ctrlKey || e.metaKey;
      if (isAdditiveSelection) {
        onItemSelect({ ...zone, itemType: 'node' } as Parameters<typeof onItemSelect>[0], true);
      }
      handleSimulationElementPrimaryClick(e, zone.id);
      return;
    }
    if (isConnectMode) {
      onNodeClickInConnectMode(zone as any); // Zones can also be connection targets
    } else {
      const isAdditiveSelection = e.shiftKey || e.ctrlKey || e.metaKey;
      onItemSelect({ ...zone, itemType: 'node' } as Parameters<typeof onItemSelect>[0], isAdditiveSelection);
    }
  }, [closeContextMenu, onResetConnectionSettingsTrigger, simulationModeEnabled, isConnectMode, onNodeClickInConnectMode, onItemSelect, handleSimulationElementPrimaryClick]);

  const handleZoneContextMenu = useCallback((e: React.MouseEvent, zone: DiagramZoneData) => {
    e.stopPropagation();
    e.preventDefault();
    setSimulationMenuState(null);
    if (simulationModeEnabled) {
      openSimulationMenu(e, zone.id, "zone");
      return;
    }
    // If multiple items are selected and this zone is already in the selection, preserve the selection
    // Otherwise, select just this zone
    if (selectedItemIds.size > 1 && selectedItemIds.has(zone.id)) {
      // Preserve multi-selection - don't change selection
    } else if (selectedItemId !== zone.id) {
      onItemSelect({ ...zone, itemType: 'node' } as Parameters<typeof onItemSelect>[0], false);
    }
    // Always reset connection settings trigger when opening context menu
    onResetConnectionSettingsTrigger?.();
    setLastRightClickItemId(zone.id);
    handleContextMenu(e, zone.id, 'zone');
  }, [simulationModeEnabled, openSimulationMenu, selectedItemIds, selectedItemId, onItemSelect, onResetConnectionSettingsTrigger, handleContextMenu]);

  const allSimulationCanvasElements = useMemo(() => {
    const connectionLabelById = new Map<string, string>();
    diagramData.connections.forEach((connection, index) => {
      const stableId = stableDiagramConnectionId(connection, index);
      const fromLabel = nodesById[connection.from]?.label || zonesById[connection.from]?.label || connection.from;
      const toLabel = nodesById[connection.to]?.label || zonesById[connection.to]?.label || connection.to;
      connectionLabelById.set(stableId, connection.text?.trim() || `${fromLabel} -> ${toLabel}`);
    });

    return [
      ...diagramData.nodes.map((node) => ({ id: node.id, label: node.label || node.id, type: "node" as const })),
      ...(diagramData.zones ?? []).map((zone) => ({ id: zone.id, label: zone.label || zone.id, type: "zone" as const })),
      ...diagramData.connections.map((connection, index) => ({
        id: stableDiagramConnectionId(connection, index),
        label: connectionLabelById.get(stableDiagramConnectionId(connection, index)) || stableDiagramConnectionId(connection, index),
        type: "connection" as const,
      })),
    ];
  }, [diagramData.connections, diagramData.nodes, diagramData.zones, nodesById, zonesById]);

  const simulationItemStateById = useMemo(() => {
    const result: Record<string, SimulationElementState> = {};
    diagramData.nodes.forEach((node) => {
      result[node.id] = getSimulationStateFromMetaData(node.metaData);
    });
    (diagramData.zones ?? []).forEach((zone) => {
      result[zone.id] = getSimulationStateFromMetaData(zone.metaData);
    });
    diagramData.connections.forEach((connection, index) => {
      result[stableDiagramConnectionId(connection, index)] = getSimulationStateFromMetaData(connection.metaData);
    });
    return result;
  }, [diagramData.connections, diagramData.nodes, diagramData.zones]);

  const simulationAvailabilityStatusByItemId = useMemo(() => {
    const groupsByItemId: Record<string, DependencyGroup[]> = {};

    diagramData.nodes.forEach((node) => {
      groupsByItemId[node.id] = getSimulationGroupsFromMetaData(node.metaData);
    });
    (diagramData.zones ?? []).forEach((zone) => {
      groupsByItemId[zone.id] = getSimulationGroupsFromMetaData(zone.metaData);
    });
    diagramData.connections.forEach((connection, index) => {
      const stableId = stableDiagramConnectionId(connection, index);
      groupsByItemId[stableId] = getSimulationGroupsFromMetaData(connection.metaData);
    });

    const statusByItemId: Record<string, AvailabilityStatus> = {};
    Object.keys(groupsByItemId).forEach((itemId) => {
      statusByItemId[itemId] = "green";
    });

    for (let iteration = 0; iteration < 8; iteration++) {
      let changed = false;
      const nextStatusByItemId: Record<string, AvailabilityStatus> = { ...statusByItemId };

      Object.entries(groupsByItemId).forEach(([itemId, groups]) => {
        nextStatusByItemId[itemId] = computeAvailabilityStatus(groups, simulationItemStateById, statusByItemId);
      });

      Object.keys(nextStatusByItemId).forEach((itemId) => {
        if (nextStatusByItemId[itemId] !== statusByItemId[itemId]) changed = true;
      });

      Object.assign(statusByItemId, nextStatusByItemId);
      if (!changed) break;
    }

    return statusByItemId;
  }, [diagramData.connections, diagramData.nodes, diagramData.zones, simulationItemStateById]);

  const availabilityWorkspaceItem = useMemo(() => {
    if (!availabilityWorkspaceTarget) return null;
    if (availabilityWorkspaceTarget.itemType === "node") {
      return diagramData.nodes.find((node) => node.id === availabilityWorkspaceTarget.itemId) || null;
    }
    if (availabilityWorkspaceTarget.itemType === "zone") {
      return diagramData.zones?.find((zone) => zone.id === availabilityWorkspaceTarget.itemId) || null;
    }
    const connection = diagramData.connections.find((conn, index) => stableDiagramConnectionId(conn, index) === availabilityWorkspaceTarget.itemId);
    if (!connection) return null;
    const fromLabel = nodesById[connection.from]?.label || zonesById[connection.from]?.label || connection.from;
    const toLabel = nodesById[connection.to]?.label || zonesById[connection.to]?.label || connection.to;
    return {
      ...connection,
      label: connection.text?.trim() || `${fromLabel} -> ${toLabel}`,
    };
  }, [availabilityWorkspaceTarget, diagramData.nodes, diagramData.zones, diagramData.connections, nodesById, zonesById]);

  const availabilityWorkspaceConfig = useMemo(() => {
    const metaData = availabilityWorkspaceItem?.metaData;
    return {
      targetState: getSimulationStateFromMetaData(metaData),
      dependencyGroups: getSimulationGroupsFromMetaData(metaData),
      statusColors: getSimulationStatusColorsFromMetaData(metaData),
      statusTexts: getSimulationStatusTextsFromMetaData(metaData),
      statusShadowColors: getSimulationStatusShadowColorsFromMetaData(metaData),
      stateColors: getSimulationSelfStateColorsFromMetaData(metaData),
      stateOpacity: parseSimulationNumber(metaData?.[SIMULATION_AVAILABILITY_STATE_OPACITY_KEY], DEFAULT_SIMULATION_STATE_OPACITY),
      dependencyOpacity: parseSimulationNumber(metaData?.[SIMULATION_AVAILABILITY_DEPENDENCY_OPACITY_KEY], DEFAULT_SIMULATION_DEPENDENCY_OPACITY),
    };
  }, [availabilityWorkspaceItem]);

  const availabilityWorkspaceStatus = useMemo(() => {
    if (!availabilityWorkspaceTarget) return "green";
    return simulationAvailabilityStatusByItemId[availabilityWorkspaceTarget.itemId] ?? "green";
  }, [availabilityWorkspaceTarget, simulationAvailabilityStatusByItemId]);

  const simulationStatusStyleByItemId = useMemo(() => {
    const result: Record<string, { color: string; opacity?: number; shadowColor?: string }> = {};

    const applyFromMeta = (itemId: string, metaData?: Record<string, string>) => {
      const groups = getSimulationGroupsFromMetaData(metaData);
      if (!groups.length) return;
      const status = computeAvailabilityStatus(groups, simulationItemStateById, simulationAvailabilityStatusByItemId);
      const statusColors = getSimulationStatusColorsFromMetaData(metaData);
      const shadowColors = getSimulationStatusShadowColorsFromMetaData(metaData);
      const opacity = parseSimulationNumber(metaData?.[SIMULATION_AVAILABILITY_DEPENDENCY_OPACITY_KEY], DEFAULT_SIMULATION_DEPENDENCY_OPACITY);
      result[itemId] = {
        color: statusColors[status],
        opacity,
        shadowColor: shadowColors[status],
      };
    };

    diagramData.nodes.forEach((node) => applyFromMeta(node.id, node.metaData));
    (diagramData.zones ?? []).forEach((zone) => applyFromMeta(zone.id, zone.metaData));
    diagramData.connections.forEach((connection, index) => {
      applyFromMeta(stableDiagramConnectionId(connection, index), connection.metaData);
    });

    return result;
  }, [diagramData, simulationItemStateById, simulationAvailabilityStatusByItemId]);

  const simulationStateStyleByItemId = useMemo(() => {
    const result: Record<string, { color: string; opacity?: number }> = {};

    const applyFromMeta = (itemId: string, metaData?: Record<string, string>) => {
      const state = getSimulationStateFromMetaData(metaData);
      if (state === "active") return;
      const stateColors = getSimulationSelfStateColorsFromMetaData(metaData);
      const opacity = parseSimulationNumber(metaData?.[SIMULATION_AVAILABILITY_STATE_OPACITY_KEY], DEFAULT_SIMULATION_STATE_OPACITY);
      result[itemId] = {
        color: stateColors[state],
        opacity,
      };
    };

    diagramData.nodes.forEach((node) => applyFromMeta(node.id, node.metaData));
    (diagramData.zones ?? []).forEach((zone) => applyFromMeta(zone.id, zone.metaData));
    diagramData.connections.forEach((connection, index) => {
      applyFromMeta(stableDiagramConnectionId(connection, index), connection.metaData);
    });

    return result;
  }, [diagramData]);

  const simulationStateBadgeByItemId = useMemo(() => {
    const result: Record<string, { color: string; state: SimulationElementState; full: string }> = {};

    diagramData.nodes.forEach((node) => {
      const state = getSimulationStateFromMetaData(node.metaData);
      const stateColors = getSimulationSelfStateColorsFromMetaData(node.metaData);
      const labels = simulationStateBadgeLabel(state);
      result[node.id] = {
        color: stateColors[state],
        state,
        full: labels.full,
      };
    });

    (diagramData.zones ?? []).forEach((zone) => {
      const state = getSimulationStateFromMetaData(zone.metaData);
      const stateColors = getSimulationSelfStateColorsFromMetaData(zone.metaData);
      const labels = simulationStateBadgeLabel(state);
      result[zone.id] = {
        color: stateColors[state],
        state,
        full: labels.full,
      };
    });

    return result;
  }, [diagramData.nodes, diagramData.zones]);

  const simulationNotificationTextByItemId = useMemo(() => {
    const result: Record<string, string> = {};

    const applyFromMeta = (itemId: string, metaData?: Record<string, string>) => {
      const groups = getSimulationGroupsFromMetaData(metaData);
      if (!groups.length) return;
      const status = computeAvailabilityStatus(groups, simulationItemStateById, simulationAvailabilityStatusByItemId);
      const statusTexts = getSimulationStatusTextsFromMetaData(metaData);
      const text = statusTexts[status]?.trim();
      if (text) result[itemId] = text;
    };

    diagramData.nodes.forEach((node) => applyFromMeta(node.id, node.metaData));
    (diagramData.zones ?? []).forEach((zone) => applyFromMeta(zone.id, zone.metaData));

    return result;
  }, [diagramData, simulationItemStateById, simulationAvailabilityStatusByItemId]);

  const simulationHoverMetrics = useMemo(() => {
    if (!simulationModeEnabled || !simulationHoveredItemId || !simulationHoveredItemType) return null;

    const hoveredItem = simulationHoveredItemType === "node"
      ? diagramData.nodes.find((node) => node.id === simulationHoveredItemId)
      : diagramData.zones?.find((zone) => zone.id === simulationHoveredItemId);
    if (!hoveredItem) return null;

    const groups = getSimulationGroupsFromMetaData(hoveredItem.metaData);
    const status = simulationAvailabilityStatusByItemId[simulationHoveredItemId] ?? "green";
    const state = simulationItemStateById[simulationHoveredItemId] ?? "active";
    const statusTexts = getSimulationStatusTextsFromMetaData(hoveredItem.metaData);
    const resolvedStatusText = statusTexts[status]?.trim();

    return {
      itemId: simulationHoveredItemId,
      itemType: simulationHoveredItemType,
      label: hoveredItem.label || simulationHoveredItemId,
      status,
      state,
      statusText: resolvedStatusText,
      groups: groups.map((group) => ({
        id: group.id,
        label: group.label || group.id,
        status: computeDependencyGroupStatus(group, simulationItemStateById, simulationAvailabilityStatusByItemId),
        members: group.memberIds.length,
      })),
    };
  }, [
    simulationModeEnabled,
    simulationHoveredItemId,
    simulationHoveredItemType,
    diagramData.nodes,
    diagramData.zones,
    simulationAvailabilityStatusByItemId,
    simulationItemStateById,
  ]);

  const updateSimulationMetaDataForTarget = useCallback((updates: Record<string, string>) => {
    if (!availabilityWorkspaceTarget) return;
    setDiagramData((prev) => {
      if (availabilityWorkspaceTarget.itemType === "node") {
        return {
          ...prev,
          nodes: prev.nodes.map((node) =>
            node.id === availabilityWorkspaceTarget.itemId
              ? { ...node, metaData: { ...(node.metaData ?? {}), ...updates } }
              : node,
          ),
        };
      }
      if (availabilityWorkspaceTarget.itemType === "connection") {
        return {
          ...prev,
          connections: prev.connections.map((connection, index) => {
            const stableId = stableDiagramConnectionId(connection, index);
            if (stableId !== availabilityWorkspaceTarget.itemId) return connection;
            return { ...connection, metaData: { ...(connection.metaData ?? {}), ...updates } };
          }),
        };
      }
      return {
        ...prev,
        zones: (prev.zones ?? []).map((zone) =>
          zone.id === availabilityWorkspaceTarget.itemId
            ? { ...zone, metaData: { ...(zone.metaData ?? {}), ...updates } }
            : zone,
        ),
      };
    });
  }, [availabilityWorkspaceTarget, setDiagramData]);

  const updateSimulationStateById = useCallback((itemId: string, state: SimulationElementState) => {
    setDiagramData((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) =>
        node.id === itemId
          ? { ...node, metaData: { ...(node.metaData ?? {}), [SIMULATION_AVAILABILITY_STATE_KEY]: state } }
          : node,
      ),
      zones: (prev.zones ?? []).map((zone) =>
        zone.id === itemId
          ? { ...zone, metaData: { ...(zone.metaData ?? {}), [SIMULATION_AVAILABILITY_STATE_KEY]: state } }
          : zone,
      ),
      connections: prev.connections.map((connection, index) => {
        const stableId = stableDiagramConnectionId(connection, index);
        if (stableId !== itemId) return connection;
        return {
          ...connection,
          metaData: { ...(connection.metaData ?? {}), [SIMULATION_AVAILABILITY_STATE_KEY]: state },
        };
      }),
    }));
  }, [setDiagramData]);

  const handleSimulationFeatureSelect = useCallback((feature: SimulationFeature) => {
    if (!simulationMenuState) return;
    if (feature === "availability") {
      setAvailabilityWorkspaceTarget({
        itemId: simulationMenuState.itemId,
        itemType: simulationMenuState.itemType,
      });
      setSimulationMenuState(null);
      return;
    }
    toast({
      title: "Simulation feature not restored yet",
      description: `${feature.charAt(0).toUpperCase() + feature.slice(1)} simulation is not wired in this branch yet.`,
    });
    setSimulationMenuState(null);
  }, [simulationMenuState, toast]);

  // ============================================================================
  // DRAG AND DROP SETUP
  // ============================================================================
  // Configures the canvas as a drop target for drag-and-drop operations
  // This allows items to be dropped onto the canvas from the sidebar
  drop(canvasRef);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================
  // - Cmd/Ctrl+C: Copy selected item(s)
  // - Cmd/Ctrl+V: Paste from clipboard
  // - Delete/Backspace: Delete selected item(s) (only when not editing text)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEventFromEditableElement(e)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        // Multi-selection: copy all. Check first so we don't copy only primary when both are set.
        if (selectedItemIds && selectedItemIds.size > 1) {
          handleCopy();
        } else if (selectedItemId || (selectedItemIds && selectedItemIds.size > 0)) {
          const idToCopy = selectedItemId || Array.from(selectedItemIds)[0];
          handleCopy(idToCopy);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        if (canPaste()) {
          handlePaste();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();

        // Keep keyboard delete behavior identical to the on-canvas connection
        // remove action by routing selected edge deletes through onConnectionDelete.
        if (selectedItem?.itemType === 'edge' && onConnectionDelete) {
          const edge = selectedItem as DiagramConnectionData & { id?: string };
          onConnectionDelete(edge.from, edge.to);
          return;
        }

        if (
          selectedItemIds &&
          selectedItemIds.size === 1 &&
          tryDeleteConnectorLineVertexBeforeNodeDelete
        ) {
          const onlyId = Array.from(selectedItemIds)[0];
          if (tryDeleteConnectorLineVertexBeforeNodeDelete(onlyId)) {
            return;
          }
        }

        // If there are multiple selected items, delete all of them
        if (selectedItemIds && selectedItemIds.size > 0) {
          operations.handleDeleteMultiple(Array.from(selectedItemIds));
        } else if (selectedItemId) {
          // Fallback: delete single selected item
          operations.handleDelete(selectedItemId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItem, selectedItemId, selectedItemIds, onConnectionDelete, handleCopy, handlePaste, canPaste, operations, tryDeleteConnectorLineVertexBeforeNodeDelete]);

  // ============================================================================
  // CANVAS DIMENSIONS TRACKING
  // ============================================================================
  // Tracks canvas container dimensions using ResizeObserver
  // This is needed for rulers to display correctly
  useEffect(() => {
    if (!canvasRef.current) return;

    const updateDimensions = () => {
      if (canvasRef.current) {
        setCanvasDimensions({
          width: canvasRef.current.offsetWidth,
          height: canvasRef.current.offsetHeight
        });
      }
    };

    // Initial dimensions
    updateDimensions();

    // Set up ResizeObserver to track dimension changes
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      
      resizeObserver.observe(canvasRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    } else {
      // Fallback for browsers without ResizeObserver
      const handleResize = () => {
        updateDimensions();
      };
      
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // ============================================================================
  // IMPERATIVE API (via ref forwarding)
  // ============================================================================
  // Exposes methods that parent components can call via ref
  // Used by diagram-editor.tsx for menu bar actions and other external controls
  const copyHandler = useCallback(() => {
    // Multi-selection: copy all items (including connections). Must check first so we
    // don't fall through to single-item copy when selectedItemId is set as primary.
    if (selectedItemIds && selectedItemIds.size > 1) {
      handleCopy();
    } else if (selectedItemId || (selectedItemIds && selectedItemIds.size > 0)) {
      const idToCopy = selectedItemId || Array.from(selectedItemIds)[0];
      handleCopy(idToCopy);
    }
  }, [selectedItemId, selectedItemIds, handleCopy]);

  const pasteHandler = useCallback(() => {
    if (canPaste()) {
      handlePaste();
    }
  }, [canPaste, handlePaste]);

  const pastePaletteItemHandler = useCallback((item: any, position?: { x: number; y: number }) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    // If diagram-space position provided (e.g. from right-click search modal), use it
    if (position && typeof position.x === 'number' && typeof position.y === 'number') {
      operations.addNode(item, { x: position.x, y: position.y }, null);
      return;
    }

    // Use the same zoom/viewport center reference as useCanvasTransform
    if (typeof window !== 'undefined') {
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      // Place new items near the center of the current viewport with slight randomness
      const jitter = 80; // px
      const offsetX = (Math.random() - 0.5) * 2 * jitter;
      const offsetY = (Math.random() - 0.5) * 2 * jitter;

      const adjustedViewportX = viewportCenterX + offsetX;
      const adjustedViewportY = viewportCenterY + offsetY;

      // Convert browser viewport coordinates to canvas-relative coordinates
      const canvasRelativeX = adjustedViewportX - rect.left;
      const canvasRelativeY = adjustedViewportY - rect.top;

      // Convert to diagram-space coordinates using current transform
      const canvasX = (canvasRelativeX - transform.x) / transform.k;
      const canvasY = (canvasRelativeY - transform.y) / transform.k;

      operations.addNode(item, { x: canvasX, y: canvasY }, null);
      return;
    }

    // Fallback (SSR/defensive): center within canvas element
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const canvasX = (centerX - transform.x) / transform.k;
    const canvasY = (centerY - transform.y) / transform.k;
    operations.addNode(item, { x: canvasX, y: canvasY }, null);
  }, [transform, operations, defaultTextLabelsEnabled]);

  const canPasteHandler = useCallback(() => {
    return canPaste();
  }, [canPaste]);

  React.useImperativeHandle(ref, () => ({
    getCanvasHostViewportForFit: () => {
      const el = canvasRef.current;
      if (!el) return null;
      return getCanvasElementSizeForImageCapture(el);
    },
    fitToView: handleFitToView, // Auto-fits diagram to viewport
    exportPng: (options?: { backgroundColor?: 'transparent' | 'white' | 'dark'; quality?: 'low' | 'medium' | 'high' }) => exportPng(options), // Exports current viewport to PNG
    exportGif: (options?: { backgroundColor?: 'transparent' | 'white' | 'dark'; quality?: 'low' | 'medium' | 'high'; fps?: number; durationSeconds?: number }) => exportGif(options), // Exports current viewport to GIF
    captureSnapshotPng: (options?: {
      backgroundColor?: 'transparent' | 'white' | 'dark';
      quality?: 'low' | 'medium' | 'high';
      fitContent?: boolean;
      unionDiagrams?: DiagramData[];
      fitPadding?: number;
      tightContentFrame?: boolean;
      frameBorderPx?: number;
    }) => captureViewportPngDataUrl(options),
    copy: copyHandler, // Copies selected item(s)
    paste: pasteHandler, // Pastes from clipboard
    canPaste: canPasteHandler, // Checks if paste is available
    pastePaletteItem: pastePaletteItemHandler, // Pastes a new item from the sidebar palette
  }), [handleFitToView, exportPng, exportGif, captureViewportPngDataUrl, copyHandler, pasteHandler, canPasteHandler, pastePaletteItemHandler]);

  return (
    <div className="relative w-full h-full" data-tutorial-id="canvas">
        {/* ========================================================================
            CANVAS RULERS
            ========================================================================
            Renders horizontal and vertical rulers along canvas edges
            Shows pixel measurements and grid markers
            See: src/components/editor/canvas-rulers.tsx
        */}
        {canvasDimensions.width > 0 && canvasDimensions.height > 0 && (
          <CanvasRulers
            transform={transform}
            canvasWidth={canvasDimensions.width}
            canvasHeight={canvasDimensions.height}
            rulerSize={RULER_SIZE}
          />
        )}
        
        {/* ========================================================================
            MAIN CANVAS CONTAINER
            ========================================================================
            This div handles all mouse/touch/wheel events and contains the
            transformable diagram content area
        */}
        <div
          ref={canvasRef}
          id="canvas-container"
          data-testid="editor-canvas"
          className="relative w-full h-full overflow-hidden"
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => {
            // When in text edit, use normal browser behavior (right-click context menu)
            if (isEventFromEditableElement(e)) return;
            e.preventDefault();
            // If user right-click-dragged to pan, don't show search - they wanted to pan
            if (wasLastRightClickAPan()) return;
            // Nodes and zones handle their own context menus and call stopPropagation
            // If we reach here, it's empty canvas - show search resources modal
            const target = e.target as HTMLElement;
            if (target.closest('[data-node-id]') || target.closest('[data-zone-id]')) return;
            if (simulationModeEnabled) return;
            if (isReadOnly || !onResourceActivateAtPosition) return;
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const canvasRelativeX = e.clientX - rect.left;
            const canvasRelativeY = e.clientY - rect.top;
            const diagramX = snapToGrid((canvasRelativeX - transform.x) / transform.k);
            const diagramY = snapToGrid((canvasRelativeY - transform.y) / transform.k);
            onPauseConnectionAnimationsForOverlayUi?.();
            setSearchModalPosition({ x: e.clientX, y: e.clientY });
            setSearchModalDiagramPosition({ x: diagramX, y: diagramY });
            setSearchModalOpen(true);
          }}
        >
          {simulationModeEnabled && (
            <div className="pointer-events-none absolute bottom-4 right-4 z-30">
              <div className="rounded-lg border border-border/60 bg-background/75 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                Left-click cycles Active, Degraded, Inactive. Right-click opens simulation options.
              </div>
            </div>
          )}

          {/* ====================================================================
              TRANSFORMABLE DIAGRAM CONTENT AREA
              ====================================================================
              This div contains all diagram items and is transformed (translated
              and scaled) based on pan/zoom state. The transform CSS property
              applies pan (x, y) and zoom (scale k) transformations.
          */}
          <div
            data-diagram-layer
            className={cn("relative", showDotGrid && "dot-grid")}
            style={{
              width: `${width}px`,
              height: `${height}px`,
              zIndex: 1,
              position: "relative",
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Zones removed - diagram is flat (nodes only) */}

            {simulationModeEnabled && Object.entries(simulationStatusStyleByItemId).map(([itemId, style]) => {
              const node = displayNodesById[itemId];
              if (node) {
                const dims = measureNodeDims(node as PositionedNode);
                return (
                  <div
                    key={`sim-status-node-${itemId}`}
                    className="pointer-events-none absolute rounded-lg"
                    style={{
                      left: `${(node.x ?? 0) - 4}px`,
                      top: `${(node.y ?? 0) - 4}px`,
                      width: `${dims.width + 8}px`,
                      height: `${dims.height + 8}px`,
                      border: `2px solid ${style.color}`,
                      boxShadow: `0 0 0 1px ${style.color}33, 0 0 14px ${style.shadowColor ?? style.color}66`,
                      opacity: style.opacity ?? 1,
                      zIndex: 40,
                    }}
                  />
                );
              }

              const zone = displayZonesById[itemId];
              if (zone) {
                return (
                  <div
                    key={`sim-status-zone-${itemId}`}
                    className="pointer-events-none absolute rounded-lg"
                    style={{
                      left: `${(zone.x ?? 0) - 4}px`,
                      top: `${(zone.y ?? 0) - 4}px`,
                      width: `${(zone.width ?? 300) + 8}px`,
                      height: `${(zone.height ?? 220) + 8}px`,
                      border: `2px solid ${style.color}`,
                      boxShadow: `0 0 0 1px ${style.color}33, 0 0 14px ${style.shadowColor ?? style.color}66`,
                      opacity: style.opacity ?? 1,
                      zIndex: 40,
                    }}
                  />
                );
              }
              return null;
            })}

            {simulationModeEnabled && Object.entries(simulationStateStyleByItemId).map(([itemId, style]) => {
              const node = displayNodesById[itemId];
              if (node) {
                const dims = measureNodeDims(node as PositionedNode);
                return (
                  <div
                    key={`sim-state-node-${itemId}`}
                    className="pointer-events-none absolute rounded-lg"
                    style={{
                      left: `${(node.x ?? 0) - 1}px`,
                      top: `${(node.y ?? 0) - 1}px`,
                      width: `${dims.width + 2}px`,
                      height: `${dims.height + 2}px`,
                      border: `2px dashed ${hexToRgba(style.color, Math.min(0.78, (style.opacity ?? 1) * 0.72))}`,
                      boxShadow: `inset 0 0 0 1px ${hexToRgba(style.color, Math.min(0.35, (style.opacity ?? 1) * 0.32))}`,
                      opacity: style.opacity ?? 1,
                      zIndex: 41,
                    }}
                  />
                );
              }

              const zone = displayZonesById[itemId];
              if (zone) {
                return (
                  <div
                    key={`sim-state-zone-${itemId}`}
                    className="pointer-events-none absolute rounded-lg"
                    style={{
                      left: `${(zone.x ?? 0) - 1}px`,
                      top: `${(zone.y ?? 0) - 1}px`,
                      width: `${(zone.width ?? 300) + 2}px`,
                      height: `${(zone.height ?? 220) + 2}px`,
                      border: `2px dashed ${hexToRgba(style.color, Math.min(0.78, (style.opacity ?? 1) * 0.72))}`,
                      boxShadow: `inset 0 0 0 1px ${hexToRgba(style.color, Math.min(0.35, (style.opacity ?? 1) * 0.32))}`,
                      opacity: style.opacity ?? 1,
                      zIndex: 41,
                    }}
                  />
                );
              }
              return null;
            })}

            {simulationModeEnabled && Object.entries(simulationStateBadgeByItemId).map(([itemId, badge]) => {
              const node = displayNodesById[itemId];
              if (node) {
                const dims = measureNodeDims(node as PositionedNode);
                return (
                  <div
                    key={`sim-state-badge-node-${itemId}`}
                    className="pointer-events-none absolute flex items-center gap-1 rounded-full border border-border/70 bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm"
                    style={{
                      left: `${(node.x ?? 0) + dims.width - 14}px`,
                      top: `${(node.y ?? 0) - 10}px`,
                      zIndex: 46,
                    }}
                    title={`Self state: ${badge.full}`}
                  >
                    <span
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ backgroundColor: badge.color }}
                    >
                      {simulationStateBadgeIcon(badge.state)}
                    </span>
                  </div>
                );
              }

              const zone = displayZonesById[itemId];
              if (zone) {
                return (
                  <div
                    key={`sim-state-badge-zone-${itemId}`}
                    className="pointer-events-none absolute flex items-center gap-1 rounded-full border border-border/70 bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm"
                    style={{
                      left: `${(zone.x ?? 0) + (zone.width ?? 300) - 14}px`,
                      top: `${(zone.y ?? 0) - 10}px`,
                      zIndex: 46,
                    }}
                    title={`Self state: ${badge.full}`}
                  >
                    <span
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full"
                      style={{ backgroundColor: badge.color }}
                    >
                      {simulationStateBadgeIcon(badge.state)}
                    </span>
                  </div>
                );
              }

              return null;
            })}

            {simulationModeEnabled && Object.entries(simulationNotificationTextByItemId).map(([itemId, text]) => {
              const node = displayNodesById[itemId];
              if (node) {
                return (
                  <div
                    key={`sim-notify-node-${itemId}`}
                    className="pointer-events-none absolute rounded bg-background/90 px-2 py-1 text-[11px] text-foreground shadow-sm"
                    style={{
                      left: `${(node.x ?? 0)}px`,
                      top: `${(node.y ?? 0) - 22}px`,
                      zIndex: 45,
                    }}
                  >
                    {text}
                  </div>
                );
              }
              const zone = displayZonesById[itemId];
              if (zone) {
                return (
                  <div
                    key={`sim-notify-zone-${itemId}`}
                    className="pointer-events-none absolute rounded bg-background/90 px-2 py-1 text-[11px] text-foreground shadow-sm"
                    style={{
                      left: `${(zone.x ?? 0)}px`,
                      top: `${(zone.y ?? 0) - 22}px`,
                      zIndex: 45,
                    }}
                  >
                    {text}
                  </div>
                );
              }
              return null;
            })}

            {simulationHoverMetrics && (() => {
              const node = simulationHoverMetrics.itemType === "node" ? displayNodesById[simulationHoverMetrics.itemId] : undefined;
              const zone = simulationHoverMetrics.itemType === "zone" ? displayZonesById[simulationHoverMetrics.itemId] : undefined;
              if (!node && !zone) return null;

              const left = node
                ? (node.x ?? 0) + measureNodeDims(node as PositionedNode).width + 10
                : (zone?.x ?? 0) + (zone?.width ?? 300) + 10;
              const top = node ? (node.y ?? 0) : (zone?.y ?? 0);

              return (
                <div
                  className="pointer-events-none absolute max-w-[280px] rounded-md border border-border/70 bg-background/95 px-3 py-2 text-[11px] text-foreground shadow-md backdrop-blur"
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    zIndex: 60,
                  }}
                >
                  <div className="font-semibold leading-tight">{simulationHoverMetrics.label}</div>
                  <div className="mt-1 text-muted-foreground">
                    Self: <span className="text-foreground">{simulationHoverMetrics.state}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Dependencies: <span className="text-foreground">{availabilityStatusLabel(simulationHoverMetrics.status)}</span>
                  </div>
                  {simulationHoverMetrics.statusText ? (
                    <div className="mt-1 text-muted-foreground">
                      Message: <span className="text-foreground">{simulationHoverMetrics.statusText}</span>
                    </div>
                  ) : null}
                  {simulationHoverMetrics.groups.length > 0 ? (
                    <div className="mt-1.5 space-y-0.5 text-muted-foreground">
                      {simulationHoverMetrics.groups.map((group) => (
                        <div key={group.id}>
                          {group.label}: {availabilityStatusLabel(group.status)} ({group.members} members)
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* ================================================================
                NODES + CONNECTIONS (layering mode)
                ================================================================
                connectionsBehindNodesEnabled=true: All connections first (z=0),
                then nodes on top. Lines never overlap rectangles.
                connectionsBehindNodesEnabled=false: Order-aware interleaving per
                connection-order-utils (conns can pass in front of/behind nodes).
            */}
            {connectionsBehindNodesEnabled ? (
              <>
                <CanvasConnections
                  key="conn-all"
                  width={width}
                  height={height}
                  diagramData={diagramData}
                  nodesById={displayNodesById}
                  zonesById={displayZonesById}
                  selectedItemId={selectedItemId}
                  selectedItem={selectedItem}
                  selectedItemIds={selectedItemIds}
                  onItemSelect={onItemSelect}
                  closeContextMenu={closeContextMenu}
                  onConnectionDelete={onConnectionDelete}
                  onConnectionContextMenu={onConnectionContextMenu}
                  onConnectionUpdate={onConnectionUpdate}
                  onConnectionWaypointAdd={onConnectionWaypointAdd}
                  onConnectionInsertNode={onConnectionInsertNode}
                  stackZIndex={0}
                  exportAnimationTimeSeconds={gifExportAnimationTimeSeconds}
                  animationConnectionsEnabled={animationConnectionsEnabled}
                  animationFilterSourceIds={animationFilterSourceIds}
                  animationDisabledSources={animationDisabledSources}
                  connectionAnimationStyles={connectionAnimationStyles}
                  connectionKey={connectionKey}
                  connectionRenderRevision={connectionRenderRevision}
                  transform={transform}
                  canvasRef={canvasRef}
                  isReadOnly={isReadOnly}
                  freezeConnectionRoutingWhileDrag={freezeUnrelatedConnectionRouting}
                  unrelatedConnectionRoutingDragIdsKey={unrelatedConnectionRoutingDragIdsKey}
                  orthogonalFastRouting={isCanvasItemDragging && (!freezeUnrelatedConnectionRouting || hasEndpointInDrag)}
                  viewportWidthPx={canvasDimensions.width}
                  viewportHeightPx={canvasDimensions.height}
                  simulationModeEnabled={simulationModeEnabled}
                  isConnectMode={isConnectMode}
                  onSimulationElementPrimaryClick={handleSimulationElementPrimaryClick}
                  onSimulationElementClick={(e, itemId) => openSimulationMenu(e, itemId, "connection")}
                  simulationStatusStyleByItemId={simulationStatusStyleByItemId}
                  simulationStateStyleByItemId={simulationStateStyleByItemId}
                />
                {connectionSlots.sortedItemIds.map((itemId, i) => {
                  const node = nodesById[itemId];
                  const zone = zonesById[itemId];
                  const nodeZIndex = 10 + i;
                  const nodeEl = node ? (
                    <DiagramNode
                      key={node.id}
                      node={displayNodesById[node.id] || node}
                      stackZIndex={nodeZIndex}
                  isSelected={selectedItemId === node.id || (selectedItemIds?.has(node.id) ?? false)}
                  isMultiSelected={selectedItemIds?.has(node.id) && (selectedItemIds?.size ?? 0) > 1}
                  isGroupMember={
                    selectedItemId !== node.id &&
                    selectedItemId !== undefined &&
                    getItemGroup(selectedItemId, diagramData) !== null &&
                    getItemGroup(node.id, diagramData) !== null &&
                    getItemGroup(selectedItemId, diagramData)?.id === getItemGroup(node.id, diagramData)?.id
                  }
                  onClick={onDiagramNodeClickStable}
                  onContextMenu={onDiagramNodeContextMenuStable}
                  onResize={handleNodeResize}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                  onLabelUpdate={onLabelUpdate}
                  onTagUpdate={onTagUpdate}
                  onDraggingChange={notifyDraggingChange}
                  onChartValueDragSessionChange={onChartValueDragSessionChange}
                  onUpdate={handleNodeUpdate}
                  hoverEnabled={hoverEnabled}
                  isReadOnly={isReadOnly}
                  onHoverChange={handleHoverChange}
                  onConnect={onConnect}
                  isConnectMode={isConnectMode && selectedItemId === node.id}
                  transform={transform}
                  canvasRef={canvasRef}
                  pointerEventsPassThrough={pointerEventsPassThroughIds.has(node.id)}
                  animationStyle={nodeAnimationStyles?.get(node.id)}
                  onSubDiagramDoubleClick={onSubDiagramDoubleClick}
                  hasLinkedSubDiagram={getHasLinkedSubDiagram?.(node) ?? Boolean(node.subDiagramId)}
                  rotationHandleVisible={
                    !isReadOnly &&
                    !!rotationTarget &&
                    rotationTarget.type === "node" &&
                    rotationTarget.id === node.id
                  }
                  onRotationPointerDown={onRotationHandlePointerDown}
                  isRotationDragging={
                    rotationDragState?.isActive === true && rotationDragState.targetId === node.id
                  }
                  highlightAnimStaggerIndex={highlightAnimStagger.indexById.get(node.id)}
                  highlightAnimStaggerCount={highlightAnimStagger.count}
                  connectorLineFocusedVertexIndex={
                    connectorLineFocusedVertex?.nodeId === node.id
                      ? connectorLineFocusedVertex.vertexIndex
                      : null
                  }
                  onConnectorLineVertexFocus={onConnectorLineVertexFocus}
                />
              ) : zone ? null : null;
                  return nodeEl;
                })}
                {duplicateDragPreviewNodes.map((previewNode, pi) => (
                  <DiagramNode
                    key={previewNode.id}
                    node={previewNode as PositionedNode}
                    stackZIndex={50000 + pi}
                    isDuplicateDragPreview
                    isSelected={false}
                    isMultiSelected={false}
                    isGroupMember={false}
                    onResize={handleNodeResize}
                    onResizeStart={handleResizeStart}
                    onResizeEnd={handleResizeEnd}
                    onLabelUpdate={onLabelUpdate}
                    onTagUpdate={onTagUpdate}
                    onDraggingChange={notifyDraggingChange}
                    onUpdate={handleNodeUpdate}
                    hoverEnabled={false}
                    isReadOnly={true}
                    transform={transform}
                    canvasRef={canvasRef}
                    hasLinkedSubDiagram={getHasLinkedSubDiagram?.(previewNode) ?? Boolean(previewNode.subDiagramId)}
                  />
                ))}
              </>
            ) : (
              <>
              {connectionSlots.sortedItemIds.flatMap((itemId, i) => {
                const slotConnections = connectionSlots.connectionsBySlot.get(i);
                const connIndices = slotConnections?.length
                  ? new Set(slotConnections)
                  : undefined;
                const node = nodesById[itemId];
                const zone = zonesById[itemId];
                // Icon/text nodes: elevate z so labels stay on top of connectors. Shapes: keep original so lines can pass in front.
                // `stackWithShapes` opts icon nodes into the shape ladder so layer item order controls overlap (e.g. icon behind a rect).
                const NODE_LAYER_BASE = 100;
                const isShape = node && isShapeNodeType(node.type);
                const isTextboxNode = node && node.type === 'generic.text.textbox';
                const closedConnectorLoop =
                  node &&
                  isConnectorLineNodeType(node.type) &&
                  isConnectorLineGeometryClosed(node);
                const useShapeStackTier =
                  isShape || isTextboxNode || closedConnectorLoop || Boolean(node?.stackWithShapes);
                /** Closed loops use shape-tier z (`2*i+1`) so rectangles before/after in layer order stack correctly. */
                const connZIndex = 2 * i;
                const nodeZIndex = useShapeStackTier ? 2 * i + 1 : NODE_LAYER_BASE + 2 * i + 1;
                const nodeEl = node ? (
                  <DiagramNode
                    key={node.id}
                    node={displayNodesById[node.id] || node}
                    stackZIndex={nodeZIndex}
                    isSelected={selectedItemId === node.id || (selectedItemIds?.has(node.id) ?? false)}
                    isMultiSelected={selectedItemIds?.has(node.id) && (selectedItemIds?.size ?? 0) > 1}
                    isGroupMember={
                      selectedItemId !== node.id &&
                      selectedItemId !== undefined &&
                      getItemGroup(selectedItemId, diagramData) !== null &&
                      getItemGroup(node.id, diagramData) !== null &&
                      getItemGroup(selectedItemId, diagramData)?.id === getItemGroup(node.id, diagramData)?.id
                    }
                    onClick={onDiagramNodeClickStable}
                    onContextMenu={onDiagramNodeContextMenuStable}
                    onResize={handleNodeResize}
                    onResizeStart={handleResizeStart}
                    onResizeEnd={handleResizeEnd}
                    onLabelUpdate={onLabelUpdate}
                    onTagUpdate={onTagUpdate}
                    onDraggingChange={notifyDraggingChange}
                    onChartValueDragSessionChange={onChartValueDragSessionChange}
                    onUpdate={handleNodeUpdate}
                    hoverEnabled={hoverEnabled}
                    isReadOnly={isReadOnly}
                    onHoverChange={handleHoverChange}
                    onConnect={onConnect}
                    isConnectMode={isConnectMode && selectedItemId === node.id}
                    transform={transform}
                    canvasRef={canvasRef}
                    pointerEventsPassThrough={pointerEventsPassThroughIds.has(node.id)}
                    animationStyle={nodeAnimationStyles?.get(node.id)}
                    onSubDiagramDoubleClick={onSubDiagramDoubleClick}
                    hasLinkedSubDiagram={getHasLinkedSubDiagram?.(node) ?? Boolean(node.subDiagramId)}
                    rotationHandleVisible={
                      !isReadOnly &&
                      !!rotationTarget &&
                      rotationTarget.type === "node" &&
                      rotationTarget.id === node.id
                    }
                    onRotationPointerDown={onRotationHandlePointerDown}
                    isRotationDragging={
                      rotationDragState?.isActive === true && rotationDragState.targetId === node.id
                    }
                    highlightAnimStaggerIndex={highlightAnimStagger.indexById.get(node.id)}
                    highlightAnimStaggerCount={highlightAnimStagger.count}
                    connectorLineFocusedVertexIndex={
                      connectorLineFocusedVertex?.nodeId === node.id
                        ? connectorLineFocusedVertex.vertexIndex
                        : null
                    }
                    onConnectorLineVertexFocus={onConnectorLineVertexFocus}
                  />
                ) : zone ? null : null;
                return [
                  connIndices ? (
                    <CanvasConnections
                      key={`conn-slot-${i}`}
                      width={width}
                      height={height}
                      diagramData={diagramData}
                      nodesById={displayNodesById}
                      zonesById={displayZonesById}
                      selectedItemId={selectedItemId}
                      selectedItem={selectedItem}
                      selectedItemIds={selectedItemIds}
                      onItemSelect={onItemSelect}
                      closeContextMenu={closeContextMenu}
                      onConnectionDelete={onConnectionDelete}
                      onConnectionContextMenu={onConnectionContextMenu}
                      onConnectionUpdate={onConnectionUpdate}
                      onConnectionWaypointAdd={onConnectionWaypointAdd}
                      onConnectionInsertNode={onConnectionInsertNode}
                      connectionIndices={connIndices}
                      stackZIndex={connZIndex}
                      exportAnimationTimeSeconds={gifExportAnimationTimeSeconds}
                      animationConnectionsEnabled={animationConnectionsEnabled}
                      animationFilterSourceIds={animationFilterSourceIds}
                      animationDisabledSources={animationDisabledSources}
                      connectionAnimationStyles={connectionAnimationStyles}
                      connectionKey={connectionKey}
                      connectionRenderRevision={connectionRenderRevision}
                      transform={transform}
                      canvasRef={canvasRef}
                      isReadOnly={isReadOnly}
                      freezeConnectionRoutingWhileDrag={freezeUnrelatedConnectionRouting}
                      unrelatedConnectionRoutingDragIdsKey={unrelatedConnectionRoutingDragIdsKey}
                      orthogonalFastRouting={isCanvasItemDragging && (!freezeUnrelatedConnectionRouting || hasEndpointInDrag)}
                      viewportWidthPx={canvasDimensions.width}
                      viewportHeightPx={canvasDimensions.height}
                      simulationModeEnabled={simulationModeEnabled}
                      isConnectMode={isConnectMode}
                      onSimulationElementPrimaryClick={handleSimulationElementPrimaryClick}
                      onSimulationElementClick={(e, itemId) => openSimulationMenu(e, itemId, "connection")}
                      simulationStatusStyleByItemId={simulationStatusStyleByItemId}
                      simulationStateStyleByItemId={simulationStateStyleByItemId}
                    />
                  ) : null,
                  nodeEl,
                ].filter(Boolean);
              })}
              {duplicateDragPreviewNodes.map((previewNode, pi) => (
                <DiagramNode
                  key={previewNode.id}
                  node={previewNode as PositionedNode}
                  stackZIndex={50000 + pi}
                  isDuplicateDragPreview
                  isSelected={false}
                  isMultiSelected={false}
                  isGroupMember={false}
                  onResize={handleNodeResize}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                  onLabelUpdate={onLabelUpdate}
                  onTagUpdate={onTagUpdate}
                  onDraggingChange={notifyDraggingChange}
                  onUpdate={handleNodeUpdate}
                  hoverEnabled={false}
                  isReadOnly={true}
                  transform={transform}
                  canvasRef={canvasRef}
                  hasLinkedSubDiagram={getHasLinkedSubDiagram?.(previewNode) ?? Boolean(previewNode.subDiagramId)}
                />
              ))}
              </>
            )}
            {!connectionsBehindNodesEnabled && (() => {
              const n = connectionSlots.sortedItemIds.length;
              const lastSlot = connectionSlots.connectionsBySlot.get(n);
              if (!lastSlot?.length) return null;
              return (
                <CanvasConnections
                  key="conn-slot-last"
                  width={width}
                  height={height}
                  diagramData={diagramData}
                  nodesById={displayNodesById}
                  zonesById={displayZonesById}
                  selectedItemId={selectedItemId}
                  selectedItem={selectedItem}
                  selectedItemIds={selectedItemIds}
                  onItemSelect={onItemSelect}
                  closeContextMenu={closeContextMenu}
                  onConnectionDelete={onConnectionDelete}
                  onConnectionContextMenu={onConnectionContextMenu}
                  onConnectionUpdate={onConnectionUpdate}
                  onConnectionWaypointAdd={onConnectionWaypointAdd}
                  onConnectionInsertNode={onConnectionInsertNode}
                  connectionIndices={new Set(lastSlot)}
                  stackZIndex={2 * n}
                  exportAnimationTimeSeconds={gifExportAnimationTimeSeconds}
                  animationConnectionsEnabled={animationConnectionsEnabled}
                  animationFilterSourceIds={animationFilterSourceIds}
                  animationDisabledSources={animationDisabledSources}
                  connectionAnimationStyles={connectionAnimationStyles}
                  connectionKey={connectionKey}
                  connectionRenderRevision={connectionRenderRevision}
                  transform={transform}
                  canvasRef={canvasRef}
                  isReadOnly={isReadOnly}
                  freezeConnectionRoutingWhileDrag={freezeUnrelatedConnectionRouting}
                  unrelatedConnectionRoutingDragIdsKey={unrelatedConnectionRoutingDragIdsKey}
                  orthogonalFastRouting={isCanvasItemDragging && (!freezeUnrelatedConnectionRouting || hasEndpointInDrag)}
                  viewportWidthPx={canvasDimensions.width}
                  viewportHeightPx={canvasDimensions.height}
                  simulationModeEnabled={simulationModeEnabled}
                  isConnectMode={isConnectMode}
                  onSimulationElementPrimaryClick={handleSimulationElementPrimaryClick}
                  onSimulationElementClick={(e, itemId) => openSimulationMenu(e, itemId, "connection")}
                  simulationStatusStyleByItemId={simulationStatusStyleByItemId}
                  simulationStateStyleByItemId={simulationStateStyleByItemId}
                />
              );
            })()}

            {/* ================================================================
                ARROW TOGGLES
                ================================================================
                Renders arrow toggle buttons only when a connection is selected
                (not when a node/shape is selected). See: canvas-arrow-toggles.tsx
            */}
            {selectedItem?.itemType === 'edge' && (
              <CanvasArrowToggles
                selectedItemId={selectedItemId}
                diagramData={diagramData}
                nodesById={displayNodesById}
                zonesById={displayZonesById}
                setDiagramData={setDiagramData}
                isReadOnly={isReadOnly}
              />
            )}

            {/* ================================================================
                CONNECTION TEXT
                ================================================================
                Renders and manages text labels on connections
                Allows editing connection labels
                See: src/components/editor/canvas-connection-text.tsx
            */}
            <CanvasConnectionText
              width={width}
              height={height}
              diagramData={diagramData}
              nodesById={displayNodesById}
              zonesById={displayZonesById}
              processedZones={processedZones}
            />

            {/* ================================================================
                CONNECTION WAYPOINT HANDLES
                Renders draggable waypoint handles when a connection is selected
            */}
            {(() => {
              if (isReadOnly || !onConnectionWaypointMove) return null;
              if (selectedItem?.itemType !== "edge" || !selectedItem) return null;
              const connId = (selectedItem as { id?: string }).id;
              const conn = diagramData.connections.find((c, idx) => {
                const cid = (c as DiagramConnectionData & { id?: string }).id ?? `${c.from}-${c.to}-${idx}`;
                return cid === connId;
              });
              if (!conn?.waypoints?.length) return null;
              const fromNode = displayNodesById[conn.from] || displayZonesById[conn.from];
              const toNode = displayNodesById[conn.to] || displayZonesById[conn.to];
              const fromItem = fromNode || diagramData.nodes.find((n) => n.id === conn.from);
              const toItem = toNode || diagramData.nodes.find((n) => n.id === conn.to);
              const connColor = conn.color || (toItem as any)?.lineColor || (fromItem as any)?.lineColor || "#6b7280";
              return (
                <ConnectionWaypointHandles
                  connection={conn}
                  waypoints={conn.waypoints}
                  connectionColor={connColor}
                  transform={transform}
                  onWaypointMove={onConnectionWaypointMove}
                  disabled={isReadOnly}
                />
              );
            })()}

            {/* ================================================================
                ALIGNMENT GUIDES
                ================================================================
                Renders visual alignment guide lines during drag operations
                Shows green semi-transparent lines when objects align
                See: src/components/editor/canvas-alignment-guides.tsx
            */}
            <CanvasAlignmentGuides
              guides={alignmentGuides}
              width={width}
              height={height}
              transform={transform}
            />
          </div>

          {/* ====================================================================
              SELECTION RECTANGLE OVERLAY
              ====================================================================
              Visual feedback for drag-to-select operation
              Shows a blue rectangle while user drags to select multiple items
              Position is calculated in diagram space and converted to screen space
          */}
          {selectionStart && selectionEnd && (
            <div
              className={
                selectionMarqueeMode === "connections"
                  ? "absolute border-2 border-green-500 bg-green-200/20 pointer-events-none z-[100]"
                  : "absolute border-2 border-blue-500 bg-blue-200/20 pointer-events-none z-[100]"
              }
              style={{
                left: `${Math.min(selectionStart.x, selectionEnd.x) * transform.k + transform.x}px`,
                top: `${Math.min(selectionStart.y, selectionEnd.y) * transform.k + transform.y}px`,
                width: `${Math.abs(selectionEnd.x - selectionStart.x) * transform.k}px`,
                height: `${Math.abs(selectionEnd.y - selectionStart.y) * transform.k}px`,
              }}
            />
          )}

          {/* ====================================================================
              ROTATION ANGLE HUD (handle is on the node — RotationHandle)
              ====================================================================
              Green dial while dragging; see canvas-rotation-overlay.tsx
          */}
          {rotationTarget &&
            rotationDragState?.isActive &&
            rotationDragState.targetId === rotationTarget.id &&
            (() => {
              const target =
                rotationTarget.type === "node"
                  ? displayNodesById[rotationTarget.id]
                  : displayZonesById[rotationTarget.id];

              if (!target) return null;

              let bounds: { x: number; y: number; width: number; height: number };

              if (rotationTarget.type === "node") {
                const node = target as PositionedNode;
                const dims = measureNodeDims(node);
                bounds = {
                  x: node.x || 0,
                  y: node.y || 0,
                  width: dims.width,
                  height: dims.height,
                };
              } else {
                const zone = target as PositionedGroup;
                bounds = {
                  x: zone.x || 0,
                  y: zone.y || 0,
                  width: zone.width || 300,
                  height: zone.height || 220,
                };
              }

              return (
                <CanvasRotationOverlay
                  transform={transform}
                  targetBounds={bounds}
                  rotationDegrees={rotationDragState.currentRotation}
                  shiftKey={rotationDragState.shiftKey}
                />
              );
            })()}

          {/* ====================================================================
              CONTEXT MENU
              ====================================================================
              Right-click context menu for nodes and zones
              Provides actions like copy, delete, connect, styling, etc.
              See: src/components/ui/context-menu.tsx
          */}
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            visible={contextMenu.visible}
            onClose={closeContextMenu}
            itemType={contextMenu.itemType}
            itemId={contextMenu.itemId}
            onDelete={() => {
              if (
                contextMenu.itemType === 'node' &&
                contextMenu.itemId &&
                tryDeleteConnectorLineVertexBeforeNodeDelete?.(contextMenu.itemId)
              ) {
                closeContextMenu();
                return;
              }
              if (contextMenu.itemType === 'node') {
                operations.handleDelete(contextMenu.itemId);
              } else {
                operations.handleDelete(contextMenu.itemId);
              }
              closeContextMenu();
            }}
            onCopy={() => {
              handleCopy(contextMenu.itemId);
              closeContextMenu();
            }}
            onSimulation={() => {
              if (!contextMenu.itemId || (contextMenu.itemType !== "node" && contextMenu.itemType !== "zone")) {
                closeContextMenu();
                return;
              }
              setSimulationMenuState({
                visible: true,
                x: contextMenu.x + 164,
                y: contextMenu.y,
                itemId: contextMenu.itemId,
                itemType: contextMenu.itemType,
              });
              closeContextMenu();
            }}
            onConnect={() => {
              const targetId = contextMenu.itemId;
              if (targetId) {
                if (contextMenu.itemType === 'zone') {
                  const zone = diagramData.zones?.find(z => z.id === targetId);
                  if (zone) {
                    onItemSelect({ ...(zone as any), itemType: 'node', id: zone.id } as Parameters<typeof onItemSelect>[0], false);
                  }
                } else {
                  const node = diagramData.nodes.find(n => n.id === targetId);
                  if (node) {
                    onItemSelect({ ...node, itemType: 'node' }, false);
                  }
                }
              }

              requestAnimationFrame(() => {
                onConnect?.({ style: 'bezier', curvature: 0.6, sourceItemId: targetId });
              });
              closeContextMenu();
            }}
            onDisconnect={() => {
              if (onDisconnect) {
                onDisconnect();
              }
              closeContextMenu();
            }}
            onTextStyling={() => {
              if (onTriggerTextStylingPanel) {
                onTriggerTextStylingPanel();
              }
              closeContextMenu();
            }}
            onVisualStyling={() => {
              if (onTriggerVisualStylingPanel) {
                onTriggerVisualStylingPanel();
              }
              closeContextMenu();
            }}
            onLineStyling={contextMenu.itemType === 'node' && (() => {
              const node = diagramData.nodes.find(n => n.id === contextMenu.itemId);
              return node && isConnectorLineNodeType(node.type);
            })() ? () => {
              if (onTriggerLineStylingPanel) {
                onTriggerLineStylingPanel();
              }
              closeContextMenu();
            } : undefined}
            connections={diagramData.connections?.filter((conn: DiagramConnectionData) => 
              conn.from === contextMenu.itemId || conn.to === contextMenu.itemId
            ) || []}
            triggerConnectionSettings={() => {
              if (onTriggerConnectionSettingsPanel) {
                onTriggerConnectionSettingsPanel();
              }
              closeContextMenu();
            }}
            nodeType={contextMenu.itemType === 'node' ? (diagramData.nodes.find(n => n.id === contextMenu.itemId)?.type) : undefined}
            connectorLineClosed={(() => {
              if (contextMenu.itemType !== 'node') return false;
              const n = diagramData.nodes.find((nn) => nn.id === contextMenu.itemId);
              if (!n || !isConnectorLineNodeType(n.type)) return false;
              return isConnectorLineGeometryClosed(n);
            })()}
            connectorLineCurved={
              contextMenu.itemType === 'node'
                ? (diagramData.nodes.find((n) => n.id === contextMenu.itemId) as any)?.linePathStyle ===
                  'curved'
                : false
            }
            onToggleConnectorLineCurved={
              contextMenu.itemType === 'node' &&
              (() => {
                const n = diagramData.nodes.find((nn) => nn.id === contextMenu.itemId);
                return n && isConnectorLineNodeType(n.type);
              })()
                ? () => {
                    const id = contextMenu.itemId;
                    setDiagramData((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) => {
                        if (n.id !== id) return n;
                        const c = n as any;
                        const nextCurved = c.linePathStyle !== 'curved';
                        let lineControlPoints = c.lineControlPoints;
                        if (nextCurved && (!lineControlPoints || lineControlPoints.length === 0)) {
                          const s = c.startPos || { x: c.x ?? 0, y: c.y ?? 0 };
                          const e = c.endPos || { x: (c.x ?? 0) + 150, y: c.y ?? 0 };
                          lineControlPoints = [{ x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 }];
                        }
                        return {
                          ...n,
                          linePathStyle: nextCurved ? 'curved' : 'straight',
                          lineControlPoints: nextCurved ? lineControlPoints : c.lineControlPoints,
                          lineSmoothJoints: nextCurved ? false : c.lineSmoothJoints,
                        };
                      }),
                    }));
                  }
                : undefined
            }
            onAddConnectorLinePoint={
              contextMenu.itemType === 'node' &&
              (() => {
                const n = diagramData.nodes.find((nn) => nn.id === contextMenu.itemId);
                return n && isConnectorLineNodeType(n.type);
              })()
                ? () => {
                    const id = contextMenu.itemId;
                    setDiagramData((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) => {
                        if (n.id !== id) return n;
                        const focusedIdx =
                          connectorLineFocusedVertex?.nodeId === id
                            ? connectorLineFocusedVertex.vertexIndex
                            : null;
                        if (focusedIdx != null) {
                          const nextGeom = insertConnectorLinePointAfterVertexIndex(
                            n as DiagramNodeData,
                            focusedIdx,
                          );
                          if (nextGeom) {
                            return syncClosedConnectorLineBorderWidth(nextGeom);
                          }
                        }
                        const c = n as any;
                        const s = c.startPos || { x: c.x ?? 0, y: c.y ?? 0 };
                        const e = c.endPos || { x: (c.x ?? 0) + 150, y: c.y ?? 0 };
                        const interior = [...(c.lineControlPoints || [])];
                        return syncClosedConnectorLineBorderWidth({
                          ...n,
                          lineControlPoints: insertConnectorLineMidControl(s, e, interior),
                        });
                      }),
                    }));
                  }
                : undefined
            }
            connectorLineShowSmoothJointsOption={
              contextMenu.itemType === 'node'
                ? (() => {
                    const c = diagramData.nodes.find((n) => n.id === contextMenu.itemId) as any;
                    if (!c || !isConnectorLineNodeType(c.type)) return false;
                    if (c.linePathStyle === 'curved') return false;
                    return ((c.lineControlPoints?.length ?? 0) as number) >= 1;
                  })()
                : false
            }
            connectorLineSmoothJoints={
              contextMenu.itemType === 'node'
                ? (diagramData.nodes.find((n) => n.id === contextMenu.itemId) as any)?.lineSmoothJoints ===
                  true
                : false
            }
            onToggleConnectorLineSmoothJoints={
              contextMenu.itemType === 'node' &&
              (() => {
                const c = diagramData.nodes.find((n) => n.id === contextMenu.itemId) as any;
                return (
                  c &&
                  isConnectorLineNodeType(c.type) &&
                  c.linePathStyle !== 'curved' &&
                  (c.lineControlPoints?.length ?? 0) >= 1
                );
              })()
                ? () => {
                    const id = contextMenu.itemId;
                    setDiagramData((prev) => ({
                      ...prev,
                      nodes: prev.nodes.map((n) => {
                        if (n.id !== id) return n;
                        const c = n as any;
                        const next = c.lineSmoothJoints !== true;
                        return { ...n, lineSmoothJoints: next };
                      }),
                    }));
                  }
                : undefined
            }
            onToggleLock={() => {
              if (contextMenu.itemType === 'node') {
                const node = diagramData.nodes.find(n => n.id === contextMenu.itemId);
                if (node) {
                  setDiagramData(prev => ({
                    ...prev,
                    nodes: prev.nodes.map(n =>
                      n.id === contextMenu.itemId
                        ? { ...n, locked: !n.locked }
                        : n
                    )
                  }));
                }
              }
              closeContextMenu();
            }}
            isLocked={contextMenu.itemType === 'node' ? (diagramData.nodes.find(n => n.id === contextMenu.itemId)?.locked || false) : false}
            currentLayer={layers ? layers.getItemLayerById(contextMenu.itemId) : undefined}
            availableLayers={layers ? layers.getAllLayers() : []}
            onChangeLayer={(layerId: string) => {
              if (layers) {
                // If multiple items are selected, move all selected items to the layer
                // Otherwise, move just the right-clicked item
                const itemsToMove = selectedItemIds.size > 1 
                  ? Array.from(selectedItemIds) 
                  : [contextMenu.itemId];
                layers.assignItemsToLayer(itemsToMove, layerId);
              }
            }}
            onOrientationChange={(orientation: 'auto' | 'horizontal' | 'vertical' | 'grid') => {
              const zone = diagramData.zones?.find(z => z.id === contextMenu.itemId);
              if (zone) {
                const newOrientation = orientation === 'grid' ? 'square' : orientation === 'auto' ? undefined : orientation;
                // Set sizeMode based on orientation:
                // - 'auto' orientation → 'auto' sizeMode
                // - 'grid', 'horizontal', 'vertical' → 'custom' sizeMode
                const newSizeMode = orientation === 'auto' ? 'auto' : 'custom';
                setDiagramData(prev => ({
                  ...prev,
                  zones: prev.zones?.map(z =>
                    z.id === contextMenu.itemId
                      ? { ...z, orientation: newOrientation, sizeMode: newSizeMode }
                      : z
                  ) || []
                }));
                toast({
                  title: "Orientation Changed",
                  description: `Zone orientation changed to ${orientation === 'grid' ? 'Grid' : orientation.charAt(0).toUpperCase() + orientation.slice(1)}`,
                });
              }
            }}
            currentOrientation={
              (() => {
                const zone = diagramData.zones?.find(zone => zone.id === contextMenu.itemId);
                if (!zone) return 'auto';
                if (!zone.orientation) return 'auto';
                if (zone.orientation === 'square') return 'grid';
                return zone.orientation;
              })()
            }
            canGroup={canGroupSelectedCanvasItems}
            isGrouped={getItemGroup(contextMenu.itemId, diagramData) !== null}
            canAddToGroup={(() => {
              if (selectedItemIds.size < 2) return false;
              
              // Find if any selected items are in a group
              const selectedItemsWithGroups = Array.from(selectedItemIds).map(itemId => ({
                itemId,
                group: getItemGroup(itemId, diagramData)
              })).filter(item => item.group !== null);
              
              // If no selected items are in any group, can't add to group
              if (selectedItemsWithGroups.length === 0) return false;
              
              // If all selected items are in the same group, no need to add to group
              const uniqueGroupIds = new Set(selectedItemsWithGroups.map(item => item.group!.id));
              if (uniqueGroupIds.size === 1 && selectedItemsWithGroups.length === selectedItemIds.size) return false;
              
              // If selected items are from different groups, can't add to group
              if (uniqueGroupIds.size > 1) return false;
              
              // Otherwise, we have some items in one group and some not in that group - allow adding to group
              return true;
            })()}
            onAddToGroup={() => {
              // Find the group that selected items should be added to
              const selectedItemsWithGroups = Array.from(selectedItemIds).map(itemId => ({
                itemId,
                group: getItemGroup(itemId, diagramData)
              })).filter(item => item.group !== null);
              
              if (selectedItemsWithGroups.length > 0 && onAddToGroupItems) {
                // Use the first group found (there should only be one based on canAddToGroup logic)
                const targetGroup = selectedItemsWithGroups[0].group!;
                onAddToGroupItems(targetGroup.id);
              }
            }}
            onGroup={onGroupItems}
            onUngroup={onUngroupItems}
            onRemoveFromGroup={(itemId: string) => {
              if (onRemoveFromGroup) {
                // Create a temporary selection with just this item
                const originalSelectedIds = selectedItemIds;
                setSelectedItemIds(new Set([itemId]));
                onRemoveFromGroup();
                // Restore original selection
                setSelectedItemIds(originalSelectedIds);
              }
            }}
            onMoveToBack={() => {
              if (onMoveToBack) {
                onMoveToBack();
              }
              closeContextMenu();
            }}
            onMoveToFront={() => {
              if (onMoveToFront) {
                onMoveToFront();
              }
              closeContextMenu();
            }}
            onMoveOneBack={() => {
              if (onMoveOneBack) {
                onMoveOneBack();
              }
              closeContextMenu();
            }}
            onMoveOneForward={() => {
              if (onMoveOneForward) {
                onMoveOneForward();
              }
              closeContextMenu();
            }}
            canMoveToBack={!!onMoveToBack && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            canMoveToFront={!!onMoveToFront && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            canMoveOneBack={!!onMoveOneBack && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            canMoveOneForward={!!onMoveOneForward && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone')}
            onLayoutChange={(layout) => onZoneLayoutChange?.(contextMenu.itemId, layout)}
            onCycleItems={() => onZoneCycle?.(contextMenu.itemId)}
            onSortItems={(order) => onZoneSort?.(contextMenu.itemId, order)}
            onEditUmlClass={setUmlClassEditorModal ? () => {
              setUmlClassEditorModal({ visible: true, x: contextMenu.x, y: contextMenu.y, itemId: contextMenu.itemId });
              closeContextMenu();
            } : undefined}
            onEditChartData={setChartDataEditorModal ? () => {
              setChartDataEditorModal({ visible: true, x: contextMenu.x, y: contextMenu.y, itemId: contextMenu.itemId });
              closeContextMenu();
            } : undefined}
            hasSubDiagramLink={contextMenu.itemType === 'node' ? Boolean(diagramData.nodes.find(n => n.id === contextMenu.itemId)?.subDiagramId) : false}
            onCreateSubDiagram={onCreateSubDiagram}
            onRemoveSubDiagramLink={onRemoveSubDiagramLink}
            canAutoNumber={canAutoNumberLabels}
            onAutoNumberLabels={handleAutoNumberLabels}
            onOpenZOrderList={onOpenZOrderList && (contextMenu.itemType === 'node' || contextMenu.itemType === 'zone') ? () => {
              onPauseConnectionAnimationsForOverlayUi?.();
              onOpenZOrderList({ x: contextMenu.x, y: contextMenu.y }, contextMenu.itemId);
              closeContextMenu();
            } : undefined}
          />
          <SimulationPopupMenu
            x={simulationMenuState?.x ?? 0}
            y={simulationMenuState?.y ?? 0}
            visible={simulationMenuState?.visible === true}
            onClose={() => setSimulationMenuState(null)}
            onSelect={handleSimulationFeatureSelect}
          />
          {availabilityWorkspaceTarget && (
            <SimulationAvailabilityWorkspace
              open={true}
              onOpenChange={(open) => {
                if (!open) setAvailabilityWorkspaceTarget(null);
              }}
              targetId={availabilityWorkspaceTarget.itemId}
              targetLabel={availabilityWorkspaceItem?.label || availabilityWorkspaceTarget.itemId}
              targetStatus={availabilityWorkspaceStatus}
              targetState={availabilityWorkspaceConfig.targetState}
              dependencyGroups={availabilityWorkspaceConfig.dependencyGroups}
              statusColors={availabilityWorkspaceConfig.statusColors}
              statusTexts={availabilityWorkspaceConfig.statusTexts}
              statusShadowColors={availabilityWorkspaceConfig.statusShadowColors}
              stateColors={availabilityWorkspaceConfig.stateColors}
              stateOpacity={availabilityWorkspaceConfig.stateOpacity}
              dependencyOpacity={availabilityWorkspaceConfig.dependencyOpacity}
              allCanvasElements={allSimulationCanvasElements}
              simulationItemStateById={simulationItemStateById}
              simulationAvailabilityStatusById={simulationAvailabilityStatusByItemId}
              onItemStateChange={updateSimulationStateById}
              onGroupsChange={(groups) => {
                updateSimulationMetaDataForTarget({
                  [SIMULATION_AVAILABILITY_GROUPS_KEY]: JSON.stringify(groups),
                });
              }}
              onStatusColorChange={(status, color) => {
                updateSimulationMetaDataForTarget({
                  [SIMULATION_AVAILABILITY_STATUS_COLORS_KEY]: JSON.stringify({
                    ...availabilityWorkspaceConfig.statusColors,
                    [status]: color,
                  }),
                });
              }}
              onStatusTextChange={(status, text) => {
                updateSimulationMetaDataForTarget({
                  [SIMULATION_AVAILABILITY_STATUS_TEXTS_KEY]: JSON.stringify({
                    ...availabilityWorkspaceConfig.statusTexts,
                    [status]: text,
                  }),
                });
              }}
              onStatusShadowColorChange={(status, color) => {
                updateSimulationMetaDataForTarget({
                  [SIMULATION_AVAILABILITY_STATUS_SHADOW_COLORS_KEY]: JSON.stringify({
                    ...availabilityWorkspaceConfig.statusShadowColors,
                    [status]: color,
                  }),
                });
              }}
              onStateColorChange={(state, color) => {
                updateSimulationMetaDataForTarget({
                  [SIMULATION_AVAILABILITY_SELF_STATE_COLORS_KEY]: JSON.stringify({
                    ...availabilityWorkspaceConfig.stateColors,
                    [state]: color,
                  }),
                });
              }}
              onStateOpacityChange={(opacity) => {
                updateSimulationMetaDataForTarget({
                  [SIMULATION_AVAILABILITY_STATE_OPACITY_KEY]: String(opacity),
                });
              }}
              onDependencyOpacityChange={(opacity) => {
                updateSimulationMetaDataForTarget({
                  [SIMULATION_AVAILABILITY_DEPENDENCY_OPACITY_KEY]: String(opacity),
                });
              }}
            />
          )}
          {metadataPopupRect &&
            !contextMenu.visible &&
            selectedItem &&
            "metaData" in selectedItem &&
            selectedItem.metaData &&
            Object.keys(selectedItem.metaData).length > 0 &&
            createPortal(
              <MetadataPopup
                anchorRect={metadataPopupRect}
                metaData={selectedItem.metaData}
              />,
              document.body
            )}
          {onResourceActivateAtPosition && (
            <SearchResourcesModal
              open={searchModalOpen}
              onOpenChange={(open) => {
                setSearchModalOpen(open);
                if (!open) setSearchModalDiagramPosition(null);
              }}
              position={searchModalPosition}
              onResourceActivate={(resource, provider, category, fullItem) => {
                const pos = searchModalDiagramPosition;
                if (pos) onResourceActivateAtPosition(resource as any, provider, category, pos, fullItem);
              }}
            />
          )}
        </div>
    </div>
  );
});
