import React, { useLayoutEffect, useMemo, useRef } from "react";
import { BezierConnection, determineConnectionEdges, getOptimalConnectionPoints, calculateBezierControlPoints, getBezierPoint, getPointOnConnectionPath, closestTOnConnectionPath } from "../diagram/bezier-connection";
import { OrthogonalConnection } from "../diagram/othogonal-connection";
import {
  computeOrthogonalRoute,
  computeOrthogonalRoutesBatch,
  getPointOnOrthogonalPath,
  closestTOnOrthogonalPath,
  buildObstacleCatalog,
  obstaclesForEndpoints,
  appendInteriorObstaclesForPreferredEdges,
  mergeOrthogonalTrunkWaypoints,
  orthogonalRouteRequestGeometryKey,
  type OrthogonalRoute,
  type OrthogonalRouteRequest,
} from "@/lib/orthogonal-routing";
import type { DiagramData, DiagramConnectionData } from "@/lib/types";
import {
  stableDiagramConnectionId,
  connectionSelectionIdMatches,
  isDiagramConnectionInCanvasSelection,
} from "@/lib/connection-order-utils";
import { measureNodeDims, type PositionedNode, type PositionedGroup, NODE_WIDTH, BASE_NODE_HEIGHT, TEXT_NODE_HEIGHT, EXTRA_LINE_HEIGHT, CONNECTION_HELPER_Z_INDEX, snapToGrid } from "./canvas-constants";
import { getNodeSizeDimensions } from "@/lib/visual-styling";
import { transitionShorthandWithDelay } from "@/lib/css-transition-with-delay";
import { cn, isIconOrEmojiType, isShapeNodeType } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectionEndpointHandles, type DiagramTransform } from "../diagram/connection-endpoint-handles";
import type { Positionable } from "../diagram/bezier-connection";
import {
  DEFAULT_VIEWPORT_OBSTACLE_PAD,
  hostRectToDiagramViewRect,
  mergeObstaclesByViewport,
} from "@/lib/connector-obstacle-viewport-freeze";

interface CanvasConnectionsProps {
  width: number;
  height: number;
  diagramData: DiagramData;
  nodesById: Record<string, PositionedNode>;
  zonesById: Record<string, PositionedGroup>;
  selectedItemId?: string;
  selectedItem?: any;
  selectedItemIds?: Set<string>;
  onItemSelect: (item: any | null, multiSelectModifier?: boolean) => void;
  closeContextMenu: () => void;
  onConnectionDelete?: (from: string, to: string, connectionId?: string) => void;
  /** Called when user right-clicks on a connection line */
  onConnectionContextMenu?: (e: React.MouseEvent, connection: DiagramConnectionData) => void;
  /** Called when connection properties need to be updated */
  onConnectionUpdate?: (from: string, to: string, updates: Record<string, unknown>, connectionId?: string) => void;
  /** Called when a waypoint needs to be added */
  onConnectionWaypointAdd?: (from: string, to: string, connectionId?: string) => void;
  /** Double-click on a connection: insert a node at the nearest point on the path (editor only). */
  onConnectionInsertNode?: (connection: DiagramConnectionData, connectionIndex: number, diagramPoint: { x: number; y: number }) => void;
  /** When set, only render connections whose index is in this set (for order-aware layering) */
  connectionIndices?: Set<number>;
  /** Z-index for this connection layer when using order-aware layering (enables interleaving with nodes) */
  stackZIndex?: number;
  /** During GIF export, advances animation deterministically per frame */
  exportAnimationTimeSeconds?: number | null;
  /**
   * When true, diagram routing (orthogonal batch + cache refresh) is skipped and the last
   * computed layout bundle is kept — use while dragging only items with no connection endpoints
   * so other lines stay static until drag end.
   */
  freezeConnectionRoutingWhileDrag?: boolean;
  /** When false, hide all animation shapes on connections (default: true) */
  animationConnectionsEnabled?: boolean;
  /** When set, only show animations for connections from this source node ID */
  animationFilterSourceId?: string;
  /** When set, only show animations for connections from these source node IDs (chain). Takes precedence over animationFilterSourceId. */
  animationFilterSourceIds?: Set<string>;
  /** Set of node IDs whose outbound animations should be disabled */
  animationDisabledSources?: Set<string>;
  /** Layer show/hide animation styles (from useLayerAnimation) keyed by connectionKey(conn) */
  connectionAnimationStyles?: Map<string, {
    opacity: number;
    transition: string;
    transform?: string;
    transitionDelayMs?: number;
    slideEndpointOffset?: { fromDx: number; fromDy: number; toDx: number; toDy: number };
    slideWaypointOffsets?: Array<{ dx: number; dy: number }>;
  }>;
  /** Key function for connection lookup (from useLayerAnimation.connectionKey) */
  connectionKey?: (conn: DiagramConnectionData) => string;
  /** Editor: pan/zoom for mapping pointer coords to diagram space (endpoint handles). */
  transform?: DiagramTransform;
  /** Editor: canvas root for client→diagram coordinate conversion */
  canvasRef?: React.RefObject<HTMLElement | null>;
  /** When true, hide draggable endpoint handles (viewer / read-only). */
  isReadOnly?: boolean;
  /**
   * Changes with each presentation slide (or other logical diagram revision) so connection
   * subtrees remount during playback — avoids stale SVG defs/gradients when slide deltas swap styling.
   */
  connectionRenderRevision?: string | number;
  /** L/Z-only orthogonal paths (no A*) while dragging canvas items — full routing when false. */
  orthogonalFastRouting?: boolean;
  /**
   * Optional host viewport in CSS pixels. When set with `transform`, obstacles for nodes/zones
   * fully outside the visible diagram (plus pad) use a frozen last-seen position until re-enter
   * view — avoids re-routing from far-off object moves. Omit in exports / headless to use live data.
   */
  viewportWidthPx?: number;
  viewportHeightPx?: number;
  /** Pad around the view in diagram space when deciding visible vs off-screen. Default 400. */
  viewportObstaclePadDiagramPx?: number;
}

function setsEqual(a: Set<number> | undefined, b: Set<number> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function stringSetsEqual(a: Set<string> | undefined, b: Set<string> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function areCanvasConnectionsPropsEqual(prev: CanvasConnectionsProps, next: CanvasConnectionsProps): boolean {
  return prev.width === next.width &&
    prev.height === next.height &&
    prev.selectedItemId === next.selectedItemId &&
    stringSetsEqual(prev.selectedItemIds, next.selectedItemIds) &&
    prev.stackZIndex === next.stackZIndex &&
    prev.exportAnimationTimeSeconds === next.exportAnimationTimeSeconds &&
    prev.animationConnectionsEnabled === next.animationConnectionsEnabled &&
    prev.animationFilterSourceId === next.animationFilterSourceId &&
    stringSetsEqual(prev.animationFilterSourceIds, next.animationFilterSourceIds) &&
    prev.animationDisabledSources === next.animationDisabledSources &&
    prev.connectionAnimationStyles === next.connectionAnimationStyles &&
    prev.connectionKey === next.connectionKey &&
    prev.transform === next.transform &&
    prev.canvasRef === next.canvasRef &&
    prev.isReadOnly === next.isReadOnly &&
    prev.connectionRenderRevision === next.connectionRenderRevision &&
    prev.orthogonalFastRouting === next.orthogonalFastRouting &&
    prev.freezeConnectionRoutingWhileDrag === next.freezeConnectionRoutingWhileDrag &&
    prev.viewportWidthPx === next.viewportWidthPx &&
    prev.viewportHeightPx === next.viewportHeightPx &&
    prev.viewportObstaclePadDiagramPx === next.viewportObstaclePadDiagramPx &&
    prev.diagramData === next.diagramData &&
    prev.nodesById === next.nodesById &&
    prev.zonesById === next.zonesById &&
    prev.onItemSelect === next.onItemSelect &&
    prev.closeContextMenu === next.closeContextMenu &&
    prev.onConnectionDelete === next.onConnectionDelete &&
    prev.onConnectionContextMenu === next.onConnectionContextMenu &&
    prev.onConnectionUpdate === next.onConnectionUpdate &&
    prev.onConnectionWaypointAdd === next.onConnectionWaypointAdd &&
    prev.onConnectionInsertNode === next.onConnectionInsertNode &&
    setsEqual(prev.connectionIndices, next.connectionIndices);
}

function CanvasConnectionsInner(props: CanvasConnectionsProps) {
  const {
    width,
    height,
    diagramData,
    nodesById,
    zonesById,
    selectedItemId,
    selectedItem,
    selectedItemIds,
    onItemSelect,
    closeContextMenu,
    onConnectionDelete,
    onConnectionContextMenu,
    onConnectionUpdate,
    onConnectionWaypointAdd,
    onConnectionInsertNode,
    connectionIndices,
    stackZIndex,
    exportAnimationTimeSeconds,
    animationConnectionsEnabled = true,
    animationFilterSourceId,
    animationFilterSourceIds,
    animationDisabledSources = new Set(),
    connectionAnimationStyles,
    connectionKey,
    transform,
    canvasRef,
    isReadOnly = false,
    connectionRenderRevision,
    orthogonalFastRouting = false,
    viewportWidthPx,
    viewportHeightPx,
    viewportObstaclePadDiagramPx = DEFAULT_VIEWPORT_OBSTACLE_PAD,
    freezeConnectionRoutingWhileDrag = false,
  } = props;

  /**
   * Per-connection orthogonal route cache (ref survives parent re-renders when React.memo
   * bails out). When selection/context menu/`nodesById` identity changes without geometry
   * changing, we skip `computeOrthogonalRoutesBatch` for that connection.
   */
  const orthogonalRouteCacheRef = useRef<Record<string, OrthogonalRoute>>({});
  const obstacleViewportStateRef = useRef<Map<string, { x: number; y: number; width: number; height: number }>>(new Map());
  const viewportSyncVersionRef = useRef(0);
  const routingWhileDragFreezeRef = useRef<{
    connections: DiagramData["connections"];
    bundle: {
      obstacleCatalog: ReturnType<typeof buildObstacleCatalog>;
      connectionEdgeInfo: Map<string, { fromEdge: string; toEdge: string }>;
      edgeGroups: Map<string, any[]>;
      buildConnectionLayout: (edge: any, index: number) => any;
      orthogonalRouteMap: Map<number, OrthogonalRoute>;
    };
  } | null>(null);

  useLayoutEffect(() => {
    if (
      transform &&
      typeof viewportWidthPx === "number" &&
      typeof viewportHeightPx === "number" &&
      viewportWidthPx > 0 &&
      viewportHeightPx > 0
    ) {
      viewportSyncVersionRef.current += 1;
    }
  }, [transform, viewportWidthPx, viewportHeightPx]);

  const { nodesByIdForObstacles, zonesByIdForObstacles, obstacleViewEpoch } = useMemo(() => {
    if (
      !transform ||
      typeof viewportWidthPx !== "number" ||
      typeof viewportHeightPx !== "number" ||
      viewportWidthPx <= 0 ||
      viewportHeightPx <= 0
    ) {
      return { nodesByIdForObstacles: nodesById, zonesByIdForObstacles: zonesById, obstacleViewEpoch: 0 };
    }
    const view = hostRectToDiagramViewRect(viewportWidthPx, viewportHeightPx, transform);
    if (!view) {
      return { nodesByIdForObstacles: nodesById, zonesByIdForObstacles: zonesById, obstacleViewEpoch: 0 };
    }
    const { nodesForObstacles, zonesForObstacles } = mergeObstaclesByViewport(
      nodesById,
      zonesById,
      view,
      viewportWidthPx,
      viewportHeightPx,
      viewportObstaclePadDiagramPx,
      obstacleViewportStateRef,
    );
    return { nodesByIdForObstacles: nodesForObstacles, zonesByIdForObstacles: zonesForObstacles, obstacleViewEpoch: viewportSyncVersionRef.current };
  }, [
    nodesById,
    zonesById,
    transform,
    viewportWidthPx,
    viewportHeightPx,
    viewportObstaclePadDiagramPx,
  ]);

  // Obstacle / edge grouping / orthogonal batch routing are diagram-geometry work only. Memoize
  // so pan/zoom (transform updates) does not re-run A* and path building every frame.
  const {
    obstacleCatalog,
    connectionEdgeInfo,
    edgeGroups,
    buildConnectionLayout,
    orthogonalRouteMap,
  } = useMemo(() => {
    if (
      freezeConnectionRoutingWhileDrag &&
      diagramData.connections === routingWhileDragFreezeRef.current?.connections &&
      routingWhileDragFreezeRef.current
    ) {
      return { ...routingWhileDragFreezeRef.current.bundle };
    }

    const obstacleCatalogInner = buildObstacleCatalog(nodesByIdForObstacles, zonesByIdForObstacles);
    const connectionEdgeInfoInner = new Map<string, { fromEdge: string; toEdge: string }>();
    const edgeGroupsInner = new Map<string, any[]>();

    (diagramData.connections || []).forEach((conn: any, connIndex: number) => {
      const fromItem = nodesById[conn.from] || zonesById[conn.from];
      const toItem = nodesById[conn.to] || zonesById[conn.to];
      if (!fromItem || !toItem) return;

      const fromItemDims = "type" in fromItem
        ? measureNodeDims(fromItem as PositionedNode)
        : { width: (fromItem as any).width, height: (fromItem as any).height };
      const toItemDims = "type" in toItem
        ? measureNodeDims(toItem as PositionedNode)
        : { width: (toItem as any).width, height: (toItem as any).height };

      const fromPos: any = {
        ...fromItem,
        width: "width" in fromItem ? (fromItem as any).width : fromItemDims.width,
        height: "height" in fromItem ? (fromItem as any).height : fromItemDims.height,
      };
      const toPos: any = {
        ...toItem,
        width: "width" in toItem ? (toItem as any).width : toItemDims.width,
        height: "height" in toItem ? (toItem as any).height : toItemDims.height,
      };

      const edges = determineConnectionEdges(
        fromPos,
        toPos,
        conn,
        fromItemDims.width,
        fromItemDims.height,
        toItemDims.width,
        toItemDims.height,
      );
      const edgeKey = `${conn.from}-${edges.fromEdge}`;
      const toEdgeKey = `${conn.to}-${edges.toEdge}`;

      const connKey = `${conn.from}-${conn.to}-${connIndex}`;
      connectionEdgeInfoInner.set(connKey, edges);

      const toCenterY = (toPos as any).y + ((toPos as any).height ?? toItemDims.height) / 2;
      const toCenterX = (toPos as any).x + ((toPos as any).width ?? toItemDims.width) / 2;
      const fromCenterY = (fromPos as any).y + ((fromPos as any).height ?? fromItemDims.height) / 2;
      const fromCenterX = (fromPos as any).x + ((fromPos as any).width ?? fromItemDims.width) / 2;

      if (!edgeGroupsInner.has(edgeKey)) {
        edgeGroupsInner.set(edgeKey, []);
      }
      const fromSortCoord = edges.fromEdge === "left" || edges.fromEdge === "right" ? toCenterY : toCenterX;
      edgeGroupsInner.get(edgeKey)!.push({ conn, connIndex, isFrom: true, sortCoord: fromSortCoord });

      if (!edgeGroupsInner.has(toEdgeKey)) {
        edgeGroupsInner.set(toEdgeKey, []);
      }
      const toSortCoord = edges.toEdge === "left" || edges.toEdge === "right" ? fromCenterY : fromCenterX;
      edgeGroupsInner.get(toEdgeKey)!.push({ conn, connIndex, isFrom: false, sortCoord: toSortCoord });
    });

    edgeGroupsInner.forEach((arr) => {
      arr.sort((a: { sortCoord: number }, b: { sortCoord: number }) => a.sortCoord - b.sortCoord);
    });

    const visibleConnections = (diagramData.connections || [])
      .map((edge: any, index: number) => ({ edge, index }))
      .filter(({ index }: { index: number }) => !connectionIndices || connectionIndices.has(index));

    const buildConnectionLayout = (edge: any, index: number) => {
    const fromItem = nodesById[edge.from] || zonesById[edge.from];
    const toItem = nodesById[edge.to] || zonesById[edge.to];
    if (!fromItem || !toItem) return null;

    const fromItemDims = "type" in fromItem
      ? measureNodeDims(fromItem as PositionedNode)
      : { width: (fromItem as any).width, height: (fromItem as any).height };
    const toItemDims = "type" in toItem
      ? measureNodeDims(toItem as PositionedNode)
      : { width: (toItem as any).width, height: (toItem as any).height };

    const fromPos: any = {
      ...fromItem,
      width: "width" in fromItem ? (fromItem as any).width : fromItemDims.width,
      height: "height" in fromItem ? (fromItem as any).height : fromItemDims.height,
    };
    const toPos: any = {
      ...toItem,
      width: "width" in toItem ? (toItem as any).width : toItemDims.width,
      height: "height" in toItem ? (toItem as any).height : toItemDims.height,
    };

    fromPos.lineColor = (fromItem as any).lineColor;
    toPos.lineColor = (toItem as any).lineColor;

    const stableConnKey = connectionKey ? connectionKey(edge) : null;
    const slideConnStyle = stableConnKey && connectionAnimationStyles ? connectionAnimationStyles.get(stableConnKey) : undefined;
    const slideOff = slideConnStyle?.slideEndpointOffset;
    const slideWpOff = slideConnStyle?.slideWaypointOffsets;

    const geomFrom = slideOff
      ? { ...fromPos, x: (fromPos.x ?? 0) + slideOff.fromDx, y: (fromPos.y ?? 0) + slideOff.fromDy }
      : fromPos;
    const geomTo = slideOff
      ? { ...toPos, x: (toPos.x ?? 0) + slideOff.toDx, y: (toPos.y ?? 0) + slideOff.toDy }
      : toPos;

    const connKey = `${edge.from}-${edge.to}-${index}`;
    const edges = !slideOff && connectionEdgeInfoInner.has(connKey)
      ? connectionEdgeInfoInner.get(connKey)!
      : determineConnectionEdges(geomFrom, geomTo, edge, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);

    const fromEdgeKey = `${edge.from}-${edges.fromEdge}`;
    const toEdgeKey = `${edge.to}-${edges.toEdge}`;
    const fromEdgeConnections = edgeGroupsInner.get(fromEdgeKey) || [];
    const toEdgeConnections = edgeGroupsInner.get(toEdgeKey) || [];
    const fromEdgeIndex = fromEdgeConnections.findIndex((item: any) => item.connIndex === index);
    const toEdgeIndex = toEdgeConnections.findIndex((item: any) => item.connIndex === index);

    let enhancedEdge: any = {
      ...edge,
      fromPreferredExit: edges.fromEdge,
      toPreferredEntry: edges.toEdge,
      connectionIndex: fromEdgeIndex >= 0 ? fromEdgeIndex : 0,
      totalConnections: fromEdgeConnections.length > 0 ? fromEdgeConnections.length : 1,
      toConnectionIndex: toEdgeIndex >= 0 ? toEdgeIndex : 0,
      toTotalConnections: toEdgeConnections.length > 0 ? toEdgeConnections.length : 1,
    };
    if (slideWpOff && enhancedEdge.waypoints?.length) {
      enhancedEdge = {
        ...enhancedEdge,
        waypoints: enhancedEdge.waypoints.map((w: { x: number; y: number }, i: number) => ({
          ...w,
          x: w.x + (slideWpOff[i]?.dx ?? 0),
          y: w.y + (slideWpOff[i]?.dy ?? 0),
        })),
      };
    }

    const isFromShape = isShapeNodeType(fromPos.type);
    const isToShape = isShapeNodeType(toPos.type);
    const isFromTextType = fromPos.type === "generic.text.text" || fromPos.type === "generic.text.textbox";
    const isToTextType = toPos.type === "generic.text.text" || toPos.type === "generic.text.textbox";
    const isFromGroup = fromPos.type === "group" || fromPos.subType === "zone";
    const isToGroup = toPos.type === "group" || toPos.subType === "zone";

    const calculateNodeHeight = (label: string = "", nodeType: string, sizeMode?: string, customHeight?: number) => {
      if (sizeMode === "custom" && customHeight) return customHeight;
      if (nodeType === "generic.text.textbox" || nodeType === "generic.text.text") {
        const maxCharsPerLine = 30;
        const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
        return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
      }
      const maxCharsPerLine = 12;
      const lines = Math.ceil(label.length / maxCharsPerLine);
      return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
    };

    const fromCalculatedHeight = calculateNodeHeight((fromPos as any).label || "", fromPos.type, (fromPos as any).sizeMode, (fromPos as any).height);
    const toCalculatedHeight = calculateNodeHeight((toPos as any).label || "", toPos.type, (toPos as any).sizeMode, (toPos as any).height);

    let fromTextUnderHeight = 0;
    let toTextUnderHeight = 0;

    if (isFromShape && (fromPos as any).label && ((fromPos as any).textPosition === "under" || !(fromPos as any).textPosition)) {
      const maxCharsPerLine = 16;
      const lines = Math.ceil(((fromPos as any).label || "").length / maxCharsPerLine);
      fromTextUnderHeight = lines * 20;
    }

    if (isToShape && (toPos as any).label && ((toPos as any).textPosition === "under" || !(toPos as any).textPosition)) {
      const maxCharsPerLine = 16;
      const lines = Math.ceil(((toPos as any).label || "").length / maxCharsPerLine);
      toTextUnderHeight = lines * 20;
    }

    if (!isFromShape && !isFromTextType && (fromPos as any).label && ((fromPos as any).label || "").trim().length > 0) {
      const maxCharsPerLine = 16;
      const lines = Math.ceil(((fromPos as any).label || "").length / maxCharsPerLine);
      fromTextUnderHeight = 20 + ((lines - 1) * 8);
    }

    if (!isToShape && !isToTextType && (toPos as any).label && ((toPos as any).label || "").trim().length > 0) {
      const maxCharsPerLine = 16;
      const lines = Math.ceil(((toPos as any).label || "").length / maxCharsPerLine);
      toTextUnderHeight = 20 + ((lines - 1) * 8);
    }

    const fromWidth = isFromGroup
      ? ((fromPos as any).width || 300)
      : (isFromShape && (fromPos as any).width ? (fromPos as any).width : ((fromPos as any).width || NODE_WIDTH));
    const fromHeight = isFromGroup
      ? ((fromPos as any).height || 220)
      : (isFromShape && (fromPos as any).height ? (fromPos as any).height : (fromCalculatedHeight + fromTextUnderHeight));
    const toWidth = isToGroup
      ? ((toPos as any).width || 300)
      : (isToShape && (toPos as any).width ? (toPos as any).width : ((toPos as any).width || NODE_WIDTH));
    const toHeight = isToGroup
      ? ((toPos as any).height || 220)
      : (isToShape && (toPos as any).height ? (toPos as any).height : (toCalculatedHeight + toTextUnderHeight));

    let fromIconHeight: number | undefined;
    let toIconHeight: number | undefined;
    let fromIconOffset: number | undefined;
    let toIconOffset: number | undefined;

    const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
    const isToIconNode = !isToGroup && !isToShape && !isToTextType;
    const fromIconContainer = isFromIconNode ? getNodeSizeDimensions((fromPos as any).nodeSize).container : undefined;
    const toIconContainer = isToIconNode ? getNodeSizeDimensions((toPos as any).nodeSize).container : undefined;

    if (!isFromGroup) {
      if (isFromShape) {
        fromIconHeight = (fromPos as any).height || 48;
      } else if (isFromTextType) {
        fromIconHeight = fromCalculatedHeight;
      } else {
        fromIconHeight = fromIconContainer ?? BASE_NODE_HEIGHT;
        const textVerticalPosition = (fromPos as any).textVerticalPosition || "bottom";
        if (textVerticalPosition === "top" && (fromPos as any).label && ((fromPos as any).label || "").trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((fromPos as any).label || "").length / maxCharsPerLine);
          fromIconOffset = 20 + ((lines - 1) * 8);
        }
      }
    }

    if (!isToGroup) {
      if (isToShape) {
        toIconHeight = (toPos as any).height || 48;
      } else if (isToTextType) {
        toIconHeight = toCalculatedHeight;
      } else {
        toIconHeight = toIconContainer ?? BASE_NODE_HEIGHT;
        const textVerticalPosition = (toPos as any).textVerticalPosition || "bottom";
        if (textVerticalPosition === "top" && (toPos as any).label && ((toPos as any).label || "").trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((toPos as any).label || "").length / maxCharsPerLine);
          toIconOffset = 20 + ((lines - 1) * 8);
        }
      }
    }

    const fromIconWidth = isFromIconNode && fromIconContainer && fromWidth > fromIconContainer ? fromIconContainer : undefined;
    const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
    const toIconWidth = isToIconNode && toIconContainer && toWidth > toIconContainer ? toIconContainer : undefined;
    const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;

    const connectionPoints = getOptimalConnectionPoints(
      geomFrom,
      geomTo,
      fromWidth,
      fromHeight,
      toWidth,
      toHeight,
      enhancedEdge,
      fromIconHeight,
      toIconHeight,
      fromIconOffset,
      toIconOffset,
      fromIconWidth,
      fromIconOffsetX,
      toIconWidth,
      toIconOffsetX
    );

    const baseObstacles = obstaclesForEndpoints(obstacleCatalogInner, edge.from, edge.to);
    const obstacles = appendInteriorObstaclesForPreferredEdges(
      baseObstacles,
      nodesByIdForObstacles,
      zonesByIdForObstacles,
      edge.from,
      edge.to,
      edge.fromPreferredExit,
      edge.toPreferredEntry,
    );

    return {
      fromPos: geomFrom,
      toPos: geomTo,
      enhancedEdge,
      connStyle: edge.style ?? "bezier",
      obstacles,
      ...connectionPoints,
    };
  };

    const orthogonalRouteRequests: OrthogonalRouteRequest[] = [];
    const orthogonalRouteIndices: number[] = [];

    visibleConnections.forEach(({ edge, index }) => {
      const layout = buildConnectionLayout(edge, index);
      if (!layout || layout.connStyle !== "orthogonal") return;

      orthogonalRouteIndices.push(index);
      const mergedWaypoints =
        mergeOrthogonalTrunkWaypoints(
          layout.fromX,
          layout.fromY,
          layout.toX,
          layout.toY,
          layout.fromAngle,
          edge.orthogonalTrunkOffsetX,
          edge.orthogonalTrunkOffsetY,
          layout.enhancedEdge.waypoints,
        ) ?? layout.enhancedEdge.waypoints;

      orthogonalRouteRequests.push({
        fromX: layout.fromX,
        fromY: layout.fromY,
        toX: layout.toX,
        toY: layout.toY,
        fromAngle: layout.fromAngle,
        toAngle: layout.toAngle,
        obstacles: layout.obstacles,
        waypoints: mergedWaypoints,
        smoothCorners: layout.enhancedEdge.smoothCorners === true,
        fastObstacleRouting: orthogonalFastRouting,
      });
    });

    const orthogonalRouteMapInner = new Map<number, OrthogonalRoute>();
    const conns = (diagramData.connections ?? []) as DiagramConnectionData[];
    const nOrth = orthogonalRouteIndices.length;
    const missingRequests: OrthogonalRouteRequest[] = [];
    const missingMeta: { index: number; cacheKey: string }[] = [];
    const prevCache = orthogonalRouteCacheRef.current;

    for (let i = 0; i < nOrth; i++) {
      const index = orthogonalRouteIndices[i];
      const request = orthogonalRouteRequests[i];
      const edge = conns[index];
      if (!edge) continue;
      const stableId = stableDiagramConnectionId(edge, index);
      const cacheKey = `${stableId}~${orthogonalRouteRequestGeometryKey(request)}`;
      const hit = prevCache[cacheKey];
      if (hit) {
        orthogonalRouteMapInner.set(index, hit);
      } else {
        missingRequests.push(request);
        missingMeta.push({ index, cacheKey });
      }
    }

    if (missingRequests.length > 0) {
      const computed = computeOrthogonalRoutesBatch(missingRequests);
      missingMeta.forEach((m, j) => {
        const route = computed[j];
        if (route) {
          orthogonalRouteMapInner.set(m.index, route);
        }
      });
    }

    const newCache: Record<string, OrthogonalRoute> = {};
    for (let i = 0; i < nOrth; i++) {
      const index = orthogonalRouteIndices[i];
      const request = orthogonalRouteRequests[i];
      const edge = conns[index];
      if (!edge) continue;
      const stableId = stableDiagramConnectionId(edge, index);
      const cacheKey = `${stableId}~${orthogonalRouteRequestGeometryKey(request)}`;
      const r = orthogonalRouteMapInner.get(index);
      if (r) newCache[cacheKey] = r;
    }
    orthogonalRouteCacheRef.current = newCache;

    const bundle = {
      obstacleCatalog: obstacleCatalogInner,
      connectionEdgeInfo: connectionEdgeInfoInner,
      edgeGroups: edgeGroupsInner,
      buildConnectionLayout,
      orthogonalRouteMap: orthogonalRouteMapInner,
    };
    if (!freezeConnectionRoutingWhileDrag) {
      routingWhileDragFreezeRef.current = {
        connections: diagramData.connections,
        bundle: { ...bundle },
      };
    }

    return bundle;
  }, [
    diagramData,
    nodesById,
    zonesById,
    nodesByIdForObstacles,
    zonesByIdForObstacles,
    obstacleViewEpoch,
    connectionIndices,
    connectionKey,
    connectionAnimationStyles,
    orthogonalFastRouting,
    freezeConnectionRoutingWhileDrag,
  ]);
  
  return (
    <>
    <svg
      width={width}
      height={height}
      className="absolute top-0 left-0 overflow-visible pointer-events-none"
      style={{ zIndex: stackZIndex ?? (connectionIndices !== undefined ? 0 : 1) }}
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current text-muted-foreground" />
        </marker>
      </defs>
      {/* Count connections per edge for distribution */}
      {(diagramData.connections || [])
        .map((edge: any, index: number) => (connectionIndices ? { edge, index } : { edge, index }))
        .filter(({ index }: { index: number }) => !connectionIndices || connectionIndices.has(index))
        .map(({ edge, index }: { edge: any; index: number }) => {
        const fromItem = nodesById[edge.from] || zonesById[edge.from];
        const toItem = nodesById[edge.to] || zonesById[edge.to];
        if (!fromItem || !toItem) return null;

        // Use measured dimensions for nodes to ensure proper connection alignment
        const fromItemDims = 'type' in fromItem ? measureNodeDims(fromItem as PositionedNode) : { width: (fromItem as any).width, height: (fromItem as any).height };
        const toItemDims = 'type' in toItem ? measureNodeDims(toItem as PositionedNode) : { width: (toItem as any).width, height: (toItem as any).height };
        
        const fromPos: any = {
          ...fromItem,
          width: 'width' in fromItem ? (fromItem as any).width : fromItemDims.width,
          height: 'height' in fromItem ? (fromItem as any).height : fromItemDims.height,
        };
        const toPos: any = {
          ...toItem,
          width: 'width' in toItem ? (toItem as any).width : toItemDims.width,
          height: 'height' in toItem ? (toItem as any).height : toItemDims.height,
        };

        // Explicitly set lineColor after spreading to ensure it's not overwritten
        fromPos.lineColor = (fromItem as any).lineColor;
        toPos.lineColor = (toItem as any).lineColor;

        const stableConnKey = connectionKey ? connectionKey(edge) : null;
        const slideConnStyle = stableConnKey && connectionAnimationStyles ? connectionAnimationStyles.get(stableConnKey) : undefined;
        const slideTransitionStyle = slideConnStyle
          ? {
              opacity: slideConnStyle.opacity,
              transition: transitionShorthandWithDelay(
                slideConnStyle.transition,
                slideConnStyle.transitionDelayMs,
              ),
              ...(slideConnStyle.transform && { transform: slideConnStyle.transform }),
            }
          : undefined;
        const slideOff = slideConnStyle?.slideEndpointOffset;
        const slideWpOff = slideConnStyle?.slideWaypointOffsets;

        const geomFrom = slideOff
          ? { ...fromPos, x: (fromPos.x ?? 0) + slideOff.fromDx, y: (fromPos.y ?? 0) + slideOff.fromDy }
          : fromPos;
        const geomTo = slideOff
          ? { ...toPos, x: (toPos.x ?? 0) + slideOff.toDx, y: (toPos.y ?? 0) + slideOff.toDy }
          : toPos;
        
        // Get edge information for this connection
        const connKey = `${edge.from}-${edge.to}-${index}`;
        const edges = !slideOff && connectionEdgeInfo.has(connKey)
          ? connectionEdgeInfo.get(connKey)!
          : determineConnectionEdges(geomFrom, geomTo, edge, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);
        
        // Calculate per-edge indices
        const fromEdgeKey = `${edge.from}-${edges.fromEdge}`;
        const toEdgeKey = `${edge.to}-${edges.toEdge}`;
        
        const fromEdgeConnections = edgeGroups.get(fromEdgeKey) || [];
        const toEdgeConnections = edgeGroups.get(toEdgeKey) || [];
        
        const fromEdgeIndex = fromEdgeConnections.findIndex((item: any) => item.connIndex === index);
        const toEdgeIndex = toEdgeConnections.findIndex((item: any) => item.connIndex === index);
        
        const fromEdgeTotal = fromEdgeConnections.length;
        const toEdgeTotal = toEdgeConnections.length;
        
        // Update edge with per-edge connection distribution info
        let enhancedEdge: any = {
          ...edge,
          fromPreferredExit: edges.fromEdge,
          toPreferredEntry: edges.toEdge,
          // Use from edge info for from node
          connectionIndex: fromEdgeIndex >= 0 ? fromEdgeIndex : 0,
          totalConnections: fromEdgeTotal > 0 ? fromEdgeTotal : 1,
          // Store to edge info separately for the "to" node
          toConnectionIndex: toEdgeIndex >= 0 ? toEdgeIndex : 0,
          toTotalConnections: toEdgeTotal > 0 ? toEdgeTotal : 1,
        };
        if (slideWpOff && enhancedEdge.waypoints?.length) {
          enhancedEdge = {
            ...enhancedEdge,
            waypoints: enhancedEdge.waypoints.map((w: { x: number; y: number }, i: number) => ({
              ...w,
              x: w.x + (slideWpOff[i]?.dx ?? 0),
              y: w.y + (slideWpOff[i]?.dy ?? 0),
            })),
          };
        }

        // Selection ids may be uuid or from-to-index (marquee / tab state); match canonically.
        const connRow = edge as DiagramConnectionData;
        const allConns = (diagramData.connections ?? []) as DiagramConnectionData[];
        const edgeId = stableDiagramConnectionId(connRow, index);
        const isConnectionHighlighted = isDiagramConnectionInCanvasSelection(
          connRow,
          index,
          allConns,
          selectedItemIds,
          selectedItemId,
          selectedItem
        );
        
        // Only show delete button if a node/zone is selected and this connection is associated with it
        const shouldShowDeleteButton = selectedItemId && (selectedItemId === edge.from || selectedItemId === edge.to) && onConnectionDelete;

        // Calculate center point for delete button
        // Reuse similar logic from bezier-connection.tsx for calculating connection points
        const isFromShape = isShapeNodeType(fromPos.type);
        const isToShape = isShapeNodeType(toPos.type);
        
        const isFromTextType = fromPos.type === 'generic.text.text' || fromPos.type === 'generic.text.textbox';
        const isToTextType = toPos.type === 'generic.text.text' || toPos.type === 'generic.text.textbox';
        
        const isFromGroup = fromPos.type === 'group' || fromPos.subType === 'zone';
        const isToGroup = toPos.type === 'group' || toPos.subType === 'zone';
        
        // Calculate node heights
        const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
          if (sizeMode === 'custom' && customHeight) return customHeight;
          if (nodeType === 'generic.text.textbox' || nodeType === 'generic.text.text') {
            const maxCharsPerLine = 30;
            const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
            return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
          } else {
            const maxCharsPerLine = 12;
            const lines = Math.ceil(label.length / maxCharsPerLine);
            return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
          }
        };
        
        const fromCalculatedHeight = calculateNodeHeight((fromPos as any).label || '', fromPos.type, (fromPos as any).sizeMode, (fromPos as any).height);
        const toCalculatedHeight = calculateNodeHeight((toPos as any).label || '', toPos.type, (toPos as any).sizeMode, (toPos as any).height);
        
        // Calculate text under heights
        let fromTextUnderHeight = 0;
        let toTextUnderHeight = 0;
        
        if (isFromShape && (fromPos as any).label && ((fromPos as any).textPosition === 'under' || !(fromPos as any).textPosition)) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
          fromTextUnderHeight = lines * 20;
        }
        
        if (isToShape && (toPos as any).label && ((toPos as any).textPosition === 'under' || !(toPos as any).textPosition)) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
          toTextUnderHeight = lines * 20;
        }
        
        if (!isFromShape && !isFromTextType && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
          fromTextUnderHeight = 20 + ((lines - 1) * 8);
        }
        
        if (!isToShape && !isToTextType && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
          const maxCharsPerLine = 16;
          const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
          toTextUnderHeight = 20 + ((lines - 1) * 8);
        }
        
        const fromWidth = isFromGroup 
          ? ((fromPos as any).width || 300)
          : (isFromShape && (fromPos as any).width ? (fromPos as any).width : ((fromPos as any).width || NODE_WIDTH));
        const fromHeight = isFromGroup
          ? ((fromPos as any).height || 220)
          : (isFromShape && (fromPos as any).height ? (fromPos as any).height : (fromCalculatedHeight + fromTextUnderHeight));
        const toWidth = isToGroup
          ? ((toPos as any).width || 300)
          : (isToShape && (toPos as any).width ? (toPos as any).width : ((toPos as any).width || NODE_WIDTH));
        const toHeight = isToGroup
          ? ((toPos as any).height || 220)
          : (isToShape && (toPos as any).height ? (toPos as any).height : (toCalculatedHeight + toTextUnderHeight));
        
        // Calculate icon heights and offsets
        let fromIconHeight: number | undefined;
        let toIconHeight: number | undefined;
        let fromIconOffset: number | undefined;
        let toIconOffset: number | undefined;
        
        const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
        const isToIconNode = !isToGroup && !isToShape && !isToTextType;
        const fromIconContainer = isFromIconNode ? getNodeSizeDimensions((fromPos as any).nodeSize).container : undefined;
        const toIconContainer = isToIconNode ? getNodeSizeDimensions((toPos as any).nodeSize).container : undefined;

        if (!isFromGroup) {
          if (isFromShape) {
            fromIconHeight = (fromPos as any).height || 48;
          } else if (isFromTextType) {
            fromIconHeight = fromCalculatedHeight;
          } else {
            fromIconHeight = fromIconContainer ?? BASE_NODE_HEIGHT;
            const textVerticalPosition = (fromPos as any).textVerticalPosition || 'bottom';
            if (textVerticalPosition === 'top' && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
              const maxCharsPerLine = 16;
              const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
              fromIconOffset = 20 + ((lines - 1) * 8);
            }
          }
        }
        
        if (!isToGroup) {
          if (isToShape) {
            toIconHeight = (toPos as any).height || 48;
          } else if (isToTextType) {
            toIconHeight = toCalculatedHeight;
          } else {
            toIconHeight = toIconContainer ?? BASE_NODE_HEIGHT;
            const textVerticalPosition = (toPos as any).textVerticalPosition || 'bottom';
            if (textVerticalPosition === 'top' && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
              const maxCharsPerLine = 16;
              const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
              toIconOffset = 20 + ((lines - 1) * 8);
            }
          }
        }

        const fromIconWidth = isFromIconNode && fromIconContainer && fromWidth > fromIconContainer ? fromIconContainer : undefined;
        const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
        const toIconWidth = isToIconNode && toIconContainer && toWidth > toIconContainer ? toIconContainer : undefined;
        const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;

        // Calculate connection points
        const connectionPoints = getOptimalConnectionPoints(geomFrom, geomTo, fromWidth, fromHeight, toWidth, toHeight, enhancedEdge, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset, fromIconWidth, fromIconOffsetX, toIconWidth, toIconOffsetX);
        const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;
        
        // Calculate control points for bezier curve
        const curvature = edge?.curvature || 0.6;
        const { cp1X, cp1Y, cp2X, cp2Y } = calculateBezierControlPoints(
          fromX, 
          fromY, 
          toX, 
          toY, 
          curvature, 
          fromAngle, 
          toAngle
        );
        
        // Get center point (t = 0.5)
        const centerPoint = getBezierPoint(0.5, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);

        const connStyle = edge.style ?? 'bezier';

        const connectionHandlers = {
          onClick: (connection: DiagramConnectionData, event: React.MouseEvent) => {
            closeContextMenu();
            if (onItemSelect) {
              const isAdditiveSelection = event.shiftKey || event.ctrlKey || event.metaKey;
              onItemSelect({
                ...connection,
                itemType: 'edge',
                id: edgeId,
              }, isAdditiveSelection);
            }
          },
          onContextMenu: (e: React.MouseEvent, connection: DiagramConnectionData) => {
            closeContextMenu();
            if (onItemSelect && !isConnectionHighlighted) {
              onItemSelect({
                ...connection,
                itemType: 'edge',
                id: edgeId,
              });
            }
            onConnectionContextMenu?.(e, connection);
          },
        };

        const handleConnectionDoubleClick =
          !isReadOnly && onConnectionInsertNode && transform && canvasRef?.current && edge.from !== edge.to
            ? (_connection: DiagramConnectionData, event: React.MouseEvent) => {
                const el = canvasRef.current;
                if (!el) return;
                event.stopPropagation();
                event.preventDefault();
                const rect = el.getBoundingClientRect();
                const px = (event.clientX - rect.left - transform.x) / transform.k;
                const py = (event.clientY - rect.top - transform.y) / transform.k;
                let insertAbs: { x: number; y: number };
                if (connStyle === "orthogonal") {
                  const route = orthogonalRouteMap.get(index);
                  if (!route || !(route.totalLength > 0)) return;
                  const t = closestTOnOrthogonalPath(px, py, route.points, route.totalLength);
                  insertAbs = getPointOnOrthogonalPath(t, route.points, route.totalLength);
                } else {
                  const t = closestTOnConnectionPath(
                    px,
                    py,
                    fromX,
                    fromY,
                    toX,
                    toY,
                    fromAngle,
                    toAngle,
                    curvature,
                    enhancedEdge.waypoints,
                  );
                  insertAbs = getPointOnConnectionPath(
                    t,
                    fromX,
                    fromY,
                    toX,
                    toY,
                    fromAngle,
                    toAngle,
                    curvature,
                    enhancedEdge.waypoints,
                  );
                }
                onConnectionInsertNode(enhancedEdge as DiagramConnectionData, index, {
                  x: snapToGrid(insertAbs.x),
                  y: snapToGrid(insertAbs.y),
                });
              }
            : undefined;

        return (
          <g
            key={`${edge.from}-${edge.to}-${index}-${edge.toArrow ? 'arrow' : 'noarrow'}-${edge._updated || ''}-r${connectionRenderRevision ?? ''}`}
            className={cn(isConnectionHighlighted && 'drop-shadow-[0_0_6px_rgba(0,200,150,0.8)]')}
          >
            {connStyle === 'orthogonal' ? (
              <OrthogonalConnection
                from={geomFrom}
                to={geomTo}
                connectionColor={edge.color}
                connectionData={enhancedEdge}
                route={orthogonalRouteMap.get(index)}
                nodesById={nodesById}
                zonesById={zonesById}
                exportAnimationTimeSeconds={exportAnimationTimeSeconds}
                animationConnectionsEnabled={animationConnectionsEnabled && (animationFilterSourceIds ? animationFilterSourceIds.has(edge.from) : (!animationFilterSourceId || edge.from === animationFilterSourceId)) && !animationDisabledSources.has(edge.from)}
                onClick={connectionHandlers.onClick}
                onDoubleClick={handleConnectionDoubleClick}
                onContextMenu={connectionHandlers.onContextMenu}
                slideTransitionStyle={slideTransitionStyle}
                orthogonalFastRouting={orthogonalFastRouting}
                orthogonalTrunkDragEnabled={
                  !isReadOnly && isConnectionHighlighted && !enhancedEdge.waypoints?.length
                }
                diagramTransform={
                  !isReadOnly && isConnectionHighlighted && !enhancedEdge.waypoints?.length
                    ? transform
                    : undefined
                }
                diagramCanvasRef={
                  !isReadOnly && isConnectionHighlighted && !enhancedEdge.waypoints?.length
                    ? canvasRef
                    : undefined
                }
                onOrthogonalTrunkOffsetChange={
                  onConnectionUpdate
                    ? (offset) =>
                        onConnectionUpdate(
                          edge.from,
                          edge.to,
                          offset === undefined
                            ? { orthogonalTrunkOffsetX: undefined }
                            : { orthogonalTrunkOffsetX: offset },
                          (edge as DiagramConnectionData).id,
                        )
                    : undefined
                }
                onOrthogonalTrunkOffsetYChange={
                  onConnectionUpdate
                    ? (offset) =>
                        onConnectionUpdate(
                          edge.from,
                          edge.to,
                          offset === undefined
                            ? { orthogonalTrunkOffsetY: undefined }
                            : { orthogonalTrunkOffsetY: offset },
                          (edge as DiagramConnectionData).id,
                        )
                    : undefined
                }
              />
            ) : (
              <BezierConnection
                from={geomFrom}
                to={geomTo}
                connectionColor={edge.color}
                connectionData={enhancedEdge}
                exportAnimationTimeSeconds={exportAnimationTimeSeconds}
                animationConnectionsEnabled={animationConnectionsEnabled && (animationFilterSourceIds ? animationFilterSourceIds.has(edge.from) : (!animationFilterSourceId || edge.from === animationFilterSourceId)) && !animationDisabledSources.has(edge.from)}
                onClick={connectionHandlers.onClick}
                onDoubleClick={handleConnectionDoubleClick}
                onContextMenu={connectionHandlers.onContextMenu}
                slideTransitionStyle={slideTransitionStyle}
              />
            )}
          </g>
        );
      })}
    </svg>
    {/* Render action buttons for selected connections */}
    <TooltipProvider>
    {(diagramData.connections || [])
      .map((edge: any, index: number) => ({ edge, index }))
      .filter(({ index }: { index: number }) => !connectionIndices || connectionIndices.has(index))
      .map(({ edge, index }: { edge: any; index: number }) => {
      const fromItem = nodesById[edge.from] || zonesById[edge.from];
      const toItem = nodesById[edge.to] || zonesById[edge.to];
      if (!fromItem || !toItem) return null;

      const allConnsToolbar = (diagramData.connections ?? []) as DiagramConnectionData[];
      const edgeId = stableDiagramConnectionId(edge as DiagramConnectionData, index);
      const isConnectionSelected =
        selectedItem?.itemType === "edge" &&
        !!selectedItem?.id &&
        connectionSelectionIdMatches(selectedItem.id, edge as DiagramConnectionData, index, allConnsToolbar);
      
      if (!isConnectionSelected) return null;

      const fromItemDims = 'type' in fromItem ? measureNodeDims(fromItem as PositionedNode) : { width: (fromItem as any).width, height: (fromItem as any).height };
      const toItemDims = 'type' in toItem ? measureNodeDims(toItem as PositionedNode) : { width: (toItem as any).width, height: (toItem as any).height };
      
      const fromPos: any = {
        ...fromItem,
        width: 'width' in fromItem ? (fromItem as any).width : fromItemDims.width,
        height: 'height' in fromItem ? (fromItem as any).height : fromItemDims.height,
      };
      const toPos: any = {
        ...toItem,
        width: 'width' in toItem ? (toItem as any).width : toItemDims.width,
        height: 'height' in toItem ? (toItem as any).height : toItemDims.height,
      };
      
      fromPos.lineColor = (fromItem as any).lineColor;
      toPos.lineColor = (toItem as any).lineColor;

      const stableConnKeyToolbar = connectionKey ? connectionKey(edge) : null;
      const slideConnStyleToolbar = stableConnKeyToolbar && connectionAnimationStyles ? connectionAnimationStyles.get(stableConnKeyToolbar) : undefined;
      const slideOffToolbar = slideConnStyleToolbar?.slideEndpointOffset;
      const slideWpOffToolbar = slideConnStyleToolbar?.slideWaypointOffsets;

      const geomFromToolbar = slideOffToolbar
        ? { ...fromPos, x: (fromPos.x ?? 0) + slideOffToolbar.fromDx, y: (fromPos.y ?? 0) + slideOffToolbar.fromDy }
        : fromPos;
      const geomToToolbar = slideOffToolbar
        ? { ...toPos, x: (toPos.x ?? 0) + slideOffToolbar.toDx, y: (toPos.y ?? 0) + slideOffToolbar.toDy }
        : toPos;
      
      const connKey = `${edge.from}-${edge.to}-${index}`;
      const edges = !slideOffToolbar && connectionEdgeInfo.has(connKey)
        ? connectionEdgeInfo.get(connKey)!
        : determineConnectionEdges(geomFromToolbar, geomToToolbar, edge, fromItemDims.width, fromItemDims.height, toItemDims.width, toItemDims.height);
      
      const fromEdgeKey = `${edge.from}-${edges.fromEdge}`;
      const toEdgeKey = `${edge.to}-${edges.toEdge}`;
      const fromEdgeConnections = edgeGroups.get(fromEdgeKey) || [];
      const toEdgeConnections = edgeGroups.get(toEdgeKey) || [];
      const fromEdgeIndex = fromEdgeConnections.findIndex((item: any) => item.connIndex === index);
      const toEdgeIndex = toEdgeConnections.findIndex((item: any) => item.connIndex === index);
      
      let enhancedEdge: any = {
        ...edge,
        fromPreferredExit: edges.fromEdge,
        toPreferredEntry: edges.toEdge,
        connectionIndex: fromEdgeIndex >= 0 ? fromEdgeIndex : 0,
        totalConnections: fromEdgeConnections.length > 0 ? fromEdgeConnections.length : 1,
        toConnectionIndex: toEdgeIndex >= 0 ? toEdgeIndex : 0,
        toTotalConnections: toEdgeConnections.length > 0 ? toEdgeConnections.length : 1,
      };
      if (slideWpOffToolbar && enhancedEdge.waypoints?.length) {
        enhancedEdge = {
          ...enhancedEdge,
          waypoints: enhancedEdge.waypoints.map((w: { x: number; y: number }, i: number) => ({
            ...w,
            x: w.x + (slideWpOffToolbar[i]?.dx ?? 0),
            y: w.y + (slideWpOffToolbar[i]?.dy ?? 0),
          })),
        };
      }

      const isFromShape = isShapeNodeType(fromPos.type);
      const isToShape = isShapeNodeType(toPos.type);
      const isFromTextType = fromPos.type === 'generic.text.text' || fromPos.type === 'generic.text.textbox';
      const isToTextType = toPos.type === 'generic.text.text' || toPos.type === 'generic.text.textbox';
      const isFromGroup = fromPos.type === 'group' || fromPos.subType === 'zone';
      const isToGroup = toPos.type === 'group' || toPos.subType === 'zone';
      
      const calculateNodeHeight = (label: string = '', nodeType: string, sizeMode?: string, customHeight?: number) => {
        if (sizeMode === 'custom' && customHeight) return customHeight;
        if (nodeType === 'generic.text.textbox' || nodeType === 'generic.text.text') {
          const maxCharsPerLine = 30;
          const lines = Math.max(1, Math.ceil(label.length / maxCharsPerLine));
          return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
        } else {
          const maxCharsPerLine = 12;
          const lines = Math.ceil(label.length / maxCharsPerLine);
          return BASE_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
        }
      };
      
      const fromCalculatedHeight = calculateNodeHeight((fromPos as any).label || '', fromPos.type, (fromPos as any).sizeMode, (fromPos as any).height);
      const toCalculatedHeight = calculateNodeHeight((toPos as any).label || '', toPos.type, (toPos as any).sizeMode, (toPos as any).height);
      
      let fromTextUnderHeight = 0;
      let toTextUnderHeight = 0;
      if (isFromShape && (fromPos as any).label && ((fromPos as any).textPosition === 'under' || !(fromPos as any).textPosition)) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
        fromTextUnderHeight = lines * 20;
      }
      if (isToShape && (toPos as any).label && ((toPos as any).textPosition === 'under' || !(toPos as any).textPosition)) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
        toTextUnderHeight = lines * 20;
      }
      if (!isFromShape && !isFromTextType && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
        fromTextUnderHeight = 20 + ((lines - 1) * 8);
      }
      if (!isToShape && !isToTextType && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
        const maxCharsPerLine = 16;
        const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
        toTextUnderHeight = 20 + ((lines - 1) * 8);
      }
      
      const fromWidth = isFromGroup ? ((fromPos as any).width || 300) : (isFromShape && (fromPos as any).width ? (fromPos as any).width : ((fromPos as any).width || NODE_WIDTH));
      const fromHeight = isFromGroup ? ((fromPos as any).height || 220) : (isFromShape && (fromPos as any).height ? (fromPos as any).height : (fromCalculatedHeight + fromTextUnderHeight));
      const toWidth = isToGroup ? ((toPos as any).width || 300) : (isToShape && (toPos as any).width ? (toPos as any).width : ((toPos as any).width || NODE_WIDTH));
      const toHeight = isToGroup ? ((toPos as any).height || 220) : (isToShape && (toPos as any).height ? (toPos as any).height : (toCalculatedHeight + toTextUnderHeight));
      
      const isFromIconNode = !isFromGroup && !isFromShape && !isFromTextType;
      const isToIconNode = !isToGroup && !isToShape && !isToTextType;
      const fromIconContainer = isFromIconNode ? getNodeSizeDimensions((fromPos as any).nodeSize).container : undefined;
      const toIconContainer = isToIconNode ? getNodeSizeDimensions((toPos as any).nodeSize).container : undefined;

      let fromIconHeight: number | undefined;
      let toIconHeight: number | undefined;
      let fromIconOffset: number | undefined;
      let toIconOffset: number | undefined;
      
      if (!isFromGroup) {
        if (isFromShape) {
          fromIconHeight = (fromPos as any).height || 48;
        } else if (isFromTextType) {
          fromIconHeight = fromCalculatedHeight;
        } else {
          fromIconHeight = fromIconContainer ?? BASE_NODE_HEIGHT;
          const textVerticalPosition = (fromPos as any).textVerticalPosition || 'bottom';
          if (textVerticalPosition === 'top' && (fromPos as any).label && ((fromPos as any).label || '').trim().length > 0) {
            const maxCharsPerLine = 16;
            const lines = Math.ceil(((fromPos as any).label || '').length / maxCharsPerLine);
            fromIconOffset = 20 + ((lines - 1) * 8);
          }
        }
      }
      
      if (!isToGroup) {
        if (isToShape) {
          toIconHeight = (toPos as any).height || 48;
        } else if (isToTextType) {
          toIconHeight = toCalculatedHeight;
        } else {
          toIconHeight = toIconContainer ?? BASE_NODE_HEIGHT;
          const textVerticalPosition = (toPos as any).textVerticalPosition || 'bottom';
          if (textVerticalPosition === 'top' && (toPos as any).label && ((toPos as any).label || '').trim().length > 0) {
            const maxCharsPerLine = 16;
            const lines = Math.ceil(((toPos as any).label || '').length / maxCharsPerLine);
            toIconOffset = 20 + ((lines - 1) * 8);
          }
        }
      }

      const fromIconWidth = isFromIconNode && fromIconContainer && fromWidth > fromIconContainer ? fromIconContainer : undefined;
      const fromIconOffsetX = fromIconWidth ? (fromWidth - fromIconWidth) / 2 : undefined;
      const toIconWidth = isToIconNode && toIconContainer && toWidth > toIconContainer ? toIconContainer : undefined;
      const toIconOffsetX = toIconWidth ? (toWidth - toIconWidth) / 2 : undefined;
      
      const connectionPoints = getOptimalConnectionPoints(geomFromToolbar, geomToToolbar, fromWidth, fromHeight, toWidth, toHeight, enhancedEdge, fromIconHeight, toIconHeight, fromIconOffset, toIconOffset, fromIconWidth, fromIconOffsetX, toIconWidth, toIconOffsetX);
      const { fromX, fromY, toX, toY, fromAngle, toAngle } = connectionPoints;
      const connStyle = edge?.style ?? 'bezier';

      let startPoint: { x: number; y: number };
      let centerPoint: { x: number; y: number };
      let arrowPoint: { x: number; y: number };

      if (connStyle === 'orthogonal') {
        const baseObstaclesToolbar = obstaclesForEndpoints(obstacleCatalog, edge.from, edge.to);
        const obstacles = appendInteriorObstaclesForPreferredEdges(
          baseObstaclesToolbar,
          nodesByIdForObstacles,
          zonesByIdForObstacles,
          edge.from,
          edge.to,
          edge.fromPreferredExit,
          edge.toPreferredEntry,
        );
        const route = orthogonalRouteMap.get(index)
          ?? computeOrthogonalRoute(fromX, fromY, toX, toY, fromAngle, toAngle, obstacles, edge?.waypoints, {
            smoothCorners: edge?.smoothCorners === true,
            fastObstacleRouting: orthogonalFastRouting,
          });
        startPoint = getPointOnOrthogonalPath(0.1, route.points, route.totalLength);
        centerPoint = getPointOnOrthogonalPath(0.5, route.points, route.totalLength);
        arrowPoint = getPointOnOrthogonalPath(0.9, route.points, route.totalLength);
      } else {
        const curvature = edge?.curvature || 0.6;
        const waypoints = edge?.waypoints;
        const getPoint = (t: number) =>
          waypoints?.length
            ? getPointOnConnectionPath(t, fromX, fromY, toX, toY, fromAngle, toAngle, curvature, waypoints)
            : (() => {
                const { cp1X, cp1Y, cp2X, cp2Y } = calculateBezierControlPoints(fromX, fromY, toX, toY, curvature, fromAngle, toAngle);
                return getBezierPoint(t, fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY);
              })();
        startPoint = getPoint(0.1);
        centerPoint = getPoint(0.5);
        arrowPoint = getPoint(0.9);
      }
      const hasArrow = edge.toArrow === true || edge.arrow === true;

      const ICON_SIZE = 29; // 24 * 1.2 ~20% bigger
      const ICON_HALF = Math.round(ICON_SIZE / 2);
      const BUTTON_Z_INDEX = CONNECTION_HELPER_Z_INDEX;

      return (
        <React.Fragment key={`actions-${edge.from}-${edge.to}-${index}`}>
          {/* Arrow toggle button - positioned at 90% (destination) along the curve */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute cursor-pointer"
                style={{
                  zIndex: BUTTON_Z_INDEX,
                  left: `${arrowPoint.x - ICON_HALF}px`,
                  top: `${arrowPoint.y - ICON_HALF}px`,
                  width: `${ICON_SIZE}px`,
                  height: `${ICON_SIZE}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (onConnectionUpdate) {
                    onConnectionUpdate(edge.from, edge.to, {
                      arrow: !hasArrow,
                      toArrow: !hasArrow,
                    }, (edge as { id?: string }).id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onConnectionContextMenu?.(e, edge);
                }}
              >
                <svg
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  viewBox="0 0 24 24"
                  className="pointer-events-none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="12"
                    fill={hasArrow ? "#22c55e" : "#ef4444"}
                  />
                  <path d="M 11 7 L 17 12 L 11 17 Z" fill="white" />
                </svg>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="z-[9999]">
              Toggle arrow
            </TooltipContent>
          </Tooltip>

          {/* Add waypoint button - at center (50%) along the path (bezier and orthogonal) */}
          {onConnectionWaypointAdd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute cursor-pointer"
                  style={{
                    zIndex: BUTTON_Z_INDEX,
                    left: `${centerPoint.x - ICON_HALF}px`,
                    top: `${centerPoint.y - ICON_HALF}px`,
                    width: `${ICON_SIZE}px`,
                    height: `${ICON_SIZE}px`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onConnectionWaypointAdd) {
                      onConnectionWaypointAdd(edge.from, edge.to, (edge as { id?: string }).id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onConnectionContextMenu?.(e, edge);
                  }}
                >
                  <svg
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    viewBox="0 0 24 24"
                    className="pointer-events-none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="12"
                      fill="#22c55e"
                    />
                    <rect x="10.5" y="6" width="3" height="12" fill="white" rx="0.5" />
                    <rect x="6" y="10.5" width="12" height="3" fill="white" rx="0.5" />
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-[9999]">
                Add waypoint
              </TooltipContent>
            </Tooltip>
          )}

          {/* Delete button - at start (10%) along the curve */}
          {onConnectionDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute cursor-pointer"
                  style={{
                    zIndex: BUTTON_Z_INDEX,
                    left: `${startPoint.x - ICON_HALF}px`,
                    top: `${startPoint.y - ICON_HALF}px`,
                    width: `${ICON_SIZE}px`,
                    height: `${ICON_SIZE}px`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onConnectionDelete) {
                      onConnectionDelete(edge.from, edge.to, (edge as { id?: string }).id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onConnectionContextMenu?.(e, edge);
                  }}
                >
                  <svg
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    viewBox="0 0 24 24"
                    className="pointer-events-none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="12"
                      fill="#ef4444"
                    />
                    <path
                      d="M 8 8 L 16 16 M 16 8 L 8 16"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-[9999]">
                Delete connection
              </TooltipContent>
            </Tooltip>
          )}

          {/* Endpoint edge handles: after action buttons so start handle is not covered by delete (10% along path) */}
          {onConnectionUpdate && transform && canvasRef && !isReadOnly && (
            <ConnectionEndpointHandles
              connection={edge}
              connectionId={edgeId}
              geomFrom={geomFromToolbar as Positionable}
              geomTo={geomToToolbar as Positionable}
              fromWidth={fromWidth}
              fromHeight={fromHeight}
              toWidth={toWidth}
              toHeight={toHeight}
              fromX={fromX}
              fromY={fromY}
              toX={toX}
              toY={toY}
              transform={transform}
              canvasRef={canvasRef}
              onEdgeAttachmentChange={onConnectionUpdate}
            />
          )}
        </React.Fragment>
      );
    })}
    </TooltipProvider>
    </>
  );
}

export const CanvasConnections = React.memo(CanvasConnectionsInner, areCanvasConnectionsPropsEqual);

