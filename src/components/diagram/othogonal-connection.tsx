"use client";

import React, { useMemo, useRef, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";
import type { DiagramConnectionData } from "@/lib/types";
import { useResolvedGlobalText } from "./global-properties-context";
import {
  computeOrthogonalRoute,
  getPointOnOrthogonalPath,
  collectObstacles,
  appendInteriorObstaclesForPreferredEdges,
  mergeOrthogonalTrunkWaypoints,
  findOrthogonalTrunkVerticalSegment,
  findOrthogonalTrunkHorizontalSegment,
  orthogonalExteriorTrunkBaseX,
  orthogonalExteriorTrunkBaseY,
  orthogonalTrunkOffsetYIsAbsolute,
  type OrthogonalRoute,
  type Rect,
} from "@/lib/orthogonal-routing";
import type { DiagramTransform } from "@/components/diagram/connection-endpoint-handles";
import {
  determineConnectionEdges,
  getOptimalConnectionPoints,
  renderAnimatedShape,
  getLoopedAnimationPathConfig,
  colorWithHalfOpacity,
  type Positionable,
} from "./bezier-connection";
import { clampConnectionAnimation } from "@/lib/connection-animation";
import { buildRibbonPolygonPath } from "@/lib/connection-ribbon-path";
import {
  resolveConnectionWidths,
  connectionNeedsAdvancedLineStyle,
  maxResolvedLineWidth,
  lineWidthAtPathFraction,
  scaleValuesForAnimationKeyPoints,
  CONNECTION_ANIMATION_SPACING_REF_LINE_PX,
  connectionAdvancedStyleRevisionKeyResolved,
  resolveOrthogonalConnectionPaint,
  connectionGradientIdSuffix,
  isUseSourceLineColorOn,
} from "@/lib/connection-line-style";
import { connectionStrokeDashFromLineType } from "@/lib/utils";
import { useDwFingerTapSyntheticClick } from "@/hooks/use-dw-finger-tap-synthetic-click";

const EMPTY_OBSTACLES: Rect[] = [];

function clientToDiagram(
  clientX: number,
  clientY: number,
  canvasRef: React.RefObject<HTMLElement | null>,
  transform: DiagramTransform,
): { x: number; y: number } | null {
  const el = canvasRef.current;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const canvasRelativeX = clientX - rect.left;
  const canvasRelativeY = clientY - rect.top;
  return {
    x: (canvasRelativeX - transform.x) / transform.k,
    y: (canvasRelativeY - transform.y) / transform.k,
  };
}

function diagramTransformEqual(a?: DiagramTransform, b?: DiagramTransform): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.x === b.x && a.y === b.y && a.k === b.k;
}

// --- Props Interface ---

interface OrthogonalConnectionProps {
  from: Positionable & { lineColor?: string };
  to: Positionable & { lineColor?: string };
  connectionColor?: string;
  connectionData?: DiagramConnectionData;
  route?: OrthogonalRoute;
  /** All positioned nodes - used for obstacle avoidance */
  nodesById: Record<string, any>;
  /** All positioned zones - used for obstacle avoidance */
  zonesById: Record<string, any>;
  exportAnimationTimeSeconds?: number | null;
  animationConnectionsEnabled?: boolean;
  onClick?: (connection: DiagramConnectionData, event: React.MouseEvent) => void;
  onDoubleClick?: (connection: DiagramConnectionData, event: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent, connection: DiagramConnectionData) => void;
  /** Opacity/transform for slide/layer transitions — applied to path group only, not defs. */
  slideTransitionStyle?: React.CSSProperties;
  /** When no precomputed route, use fast L/Z-only routing (e.g. canvas drag). */
  orthogonalFastRouting?: boolean;
  /** Editor: allow dragging the Z-route vertical trunk when set with transform + canvas ref. */
  orthogonalTrunkDragEnabled?: boolean;
  diagramTransform?: DiagramTransform;
  diagramCanvasRef?: React.RefObject<HTMLElement | null>;
  onOrthogonalTrunkOffsetChange?: (offset: number | undefined) => void;
  onOrthogonalTrunkOffsetYChange?: (offset: number | undefined) => void;
}

// --- Memo Comparators ---

function positionablesEqual(a: OrthogonalConnectionProps["from"], b: OrthogonalConnectionProps["from"]): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  return (
    a.id === b.id &&
    a.x === b.x && a.y === b.y &&
    a.width === b.width && a.height === b.height &&
    a.type === b.type &&
    (a as any).label === (b as any).label &&
    a.lineColor === b.lineColor &&
    (a as any).borderColor === (b as any).borderColor &&
    (a as any).borderStyle === (b as any).borderStyle &&
    JSON.stringify((a as any).borderColors) === JSON.stringify((b as any).borderColors) &&
    (a as any).iconColor === (b as any).iconColor &&
    (a as any).iconOpacity === (b as any).iconOpacity &&
    (a as any).color === (b as any).color &&
    (a as any).nodeSize === (b as any).nodeSize &&
    (a as any).sizeMode === (b as any).sizeMode &&
    (a as any).textPosition === (b as any).textPosition &&
    (a as any).textVerticalPosition === (b as any).textVerticalPosition &&
    a.subType === b.subType
  );
}

function slideTransitionStyleEqual(
  a?: React.CSSProperties,
  b?: React.CSSProperties
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.opacity === b.opacity &&
    a.transform === b.transform &&
    a.transition === b.transition
  );
}

function connectionDataEqual(a?: DiagramConnectionData, b?: DiagramConnectionData): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.from !== b.from || a.to !== b.to || (a as any).id !== (b as any).id) return false;
  if (a.lineWidth !== b.lineWidth || a.lineWidthLock !== b.lineWidthLock || a.lineWidthEnd !== b.lineWidthEnd) return false;
  if (a.lineType !== b.lineType || a.shadow !== b.shadow || a.color !== b.color) return false;
  if (isUseSourceLineColorOn(a) !== isUseSourceLineColorOn(b)) return false;
  if (a.colorLock !== b.colorLock || a.colorEnd !== b.colorEnd) return false;
  if (a.fromArrow !== b.fromArrow || a.toArrow !== b.toArrow || a.arrow !== b.arrow) return false;
  if (a.centerEdgeAnchors !== b.centerEdgeAnchors) return false;
  if (a.fromPreferredExit !== b.fromPreferredExit || a.toPreferredEntry !== b.toPreferredEntry) return false;
  if (a.fromEdgePosition !== b.fromEdgePosition || a.toEdgePosition !== b.toEdgePosition) return false;
  if (a.edgeAttachmentConstraint !== b.edgeAttachmentConstraint) return false;
  if (a.smoothCorners !== b.smoothCorners) return false;
  if (a.text !== b.text || a.textPosition !== b.textPosition || a.style !== b.style) return false;
  const wpA = a.waypoints?.map((w) => `${w.x},${w.y}`).join(";") ?? "";
  const wpB = b.waypoints?.map((w) => `${w.x},${w.y}`).join(";") ?? "";
  if (wpA !== wpB) return false;
  const animA = a.animation ? JSON.stringify(a.animation) : "";
  const animB = b.animation ? JSON.stringify(b.animation) : "";
  if (animA !== animB) return false;
  if ((a.orthogonalTrunkOffsetX ?? 0) !== (b.orthogonalTrunkOffsetX ?? 0)) return false;
  if ((a.orthogonalTrunkOffsetY ?? 0) !== (b.orthogonalTrunkOffsetY ?? 0)) return false;
  return true;
}

function areOrthogonalPropsEqual(prev: OrthogonalConnectionProps, next: OrthogonalConnectionProps): boolean {
  const themeNeutral = "#6b7280";
  const prevRc = resolveOrthogonalConnectionPaint(
    prev.connectionData,
    prev.connectionColor,
    prev.from,
    prev.to,
    themeNeutral
  );
  const nextRc = resolveOrthogonalConnectionPaint(
    next.connectionData,
    next.connectionColor,
    next.from,
    next.to,
    themeNeutral
  );
  return (
    positionablesEqual(prev.from, next.from) &&
    positionablesEqual(prev.to, next.to) &&
    prev.connectionColor === next.connectionColor &&
    connectionDataEqual(prev.connectionData, next.connectionData) &&
    connectionAdvancedStyleRevisionKeyResolved(prev.connectionData, prevRc) ===
      connectionAdvancedStyleRevisionKeyResolved(next.connectionData, nextRc) &&
    prev.route?.pathData === next.route?.pathData &&
    prev.route?.totalLength === next.route?.totalLength &&
    prev.exportAnimationTimeSeconds === next.exportAnimationTimeSeconds &&
    prev.animationConnectionsEnabled === next.animationConnectionsEnabled &&
    slideTransitionStyleEqual(prev.slideTransitionStyle, next.slideTransitionStyle) &&
    prev.orthogonalFastRouting === next.orthogonalFastRouting &&
    prev.orthogonalTrunkDragEnabled === next.orthogonalTrunkDragEnabled &&
    diagramTransformEqual(prev.diagramTransform, next.diagramTransform) &&
    prev.diagramCanvasRef === next.diagramCanvasRef &&
    prev.onOrthogonalTrunkOffsetChange === next.onOrthogonalTrunkOffsetChange &&
    prev.onOrthogonalTrunkOffsetYChange === next.onOrthogonalTrunkOffsetYChange &&
    prev.onClick === next.onClick &&
    prev.onDoubleClick === next.onDoubleClick &&
    prev.onContextMenu === next.onContextMenu
  );
}

// --- Hoisted Constants ---

const GROUP_STYLE: React.CSSProperties = { pointerEvents: "auto" };

// --- Main Component ---

function OrthogonalConnectionInner({
  from,
  to,
  connectionColor,
  connectionData,
  route: precomputedRoute,
  nodesById,
  zonesById,
  exportAnimationTimeSeconds,
  animationConnectionsEnabled = true,
  onClick,
  onDoubleClick,
  onContextMenu,
  slideTransitionStyle,
  orthogonalFastRouting = false,
  orthogonalTrunkDragEnabled = false,
  diagramTransform,
  diagramCanvasRef,
  onOrthogonalTrunkOffsetChange,
  onOrthogonalTrunkOffsetYChange,
}: OrthogonalConnectionProps) {
  const { applyFingerTapMarkerToMouseEventIfNeeded, fingerTapTouchSvgProps } = useDwFingerTapSyntheticClick();
  const { resolvedTheme } = useTheme();
  const themeNeutral = resolvedTheme === "dark" ? "#9ca3af" : "#6b7280";

  // Compute node dimensions
  const fromWidth = (from as any).width ?? 80;
  const fromHeight = (from as any).height ?? 80;
  const toWidth = (to as any).width ?? 80;
  const toHeight = (to as any).height ?? 80;

  // Get exit / entry points
  const { fromX, fromY, toX, toY, fromAngle, toAngle } = useMemo(
    () => getOptimalConnectionPoints(from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData),
    [from, to, fromWidth, fromHeight, toWidth, toHeight, connectionData]
  );

  // Collect obstacles only when routing here (parent normally passes precomputed route).
  const obstacles = useMemo(() => {
    if (precomputedRoute) return EMPTY_OBSTACLES;
    const base = collectObstacles(
      nodesById,
      zonesById,
      [connectionData?.from ?? "", connectionData?.to ?? ""].filter(Boolean)
    );
    if (!connectionData?.from || !connectionData?.to) return base;
    return appendInteriorObstaclesForPreferredEdges(
      base,
      nodesById,
      zonesById,
      connectionData.from,
      connectionData.to,
      connectionData.fromPreferredExit,
      connectionData.toPreferredEntry,
    );
  }, [
    precomputedRoute,
    nodesById,
    zonesById,
    connectionData?.from,
    connectionData?.to,
    connectionData?.fromPreferredExit,
    connectionData?.toPreferredEntry,
  ]);

  // Route (optional manual waypoints + orthogonal trunk offset when no manual waypoints)
  const route: OrthogonalRoute = useMemo(
    () => {
      if (precomputedRoute) return precomputedRoute;
      const waypoints =
        mergeOrthogonalTrunkWaypoints(
          fromX,
          fromY,
          toX,
          toY,
          fromAngle,
          connectionData?.orthogonalTrunkOffsetX,
          connectionData?.orthogonalTrunkOffsetY,
          connectionData?.waypoints,
          toAngle,
        ) ?? connectionData?.waypoints;
      return computeOrthogonalRoute(fromX, fromY, toX, toY, fromAngle, toAngle, obstacles, waypoints, {
        smoothCorners: connectionData?.smoothCorners === true,
        fastObstacleRouting: orthogonalFastRouting,
      });
    },
    [
      precomputedRoute,
      fromX,
      fromY,
      toX,
      toY,
      fromAngle,
      toAngle,
      obstacles,
      connectionData?.waypoints,
      connectionData?.orthogonalTrunkOffsetX,
      connectionData?.orthogonalTrunkOffsetY,
      connectionData?.smoothCorners,
      orthogonalFastRouting,
    ]
  );

  const trunkVertical = useMemo(
    () =>
      orthogonalTrunkDragEnabled && diagramTransform && diagramCanvasRef && onOrthogonalTrunkOffsetChange
        ? findOrthogonalTrunkVerticalSegment(route.points)
        : null,
    [
      orthogonalTrunkDragEnabled,
      diagramTransform,
      diagramCanvasRef,
      onOrthogonalTrunkOffsetChange,
      route.pathData,
    ],
  );

  const onTrunkVerticalPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!diagramTransform || !diagramCanvasRef || !onOrthogonalTrunkOffsetChange) return;
      if (e.button !== 0) return;
      const p = clientToDiagram(e.clientX, e.clientY, diagramCanvasRef, diagramTransform);
      if (!p) return;
      e.stopPropagation();
      e.preventDefault();
      const startDiagramX = p.x;
      const exteriorBase = orthogonalExteriorTrunkBaseX(fromX, toX, fromAngle, toAngle);
      const startOffset =
        connectionData?.orthogonalTrunkOffsetX
        ?? (exteriorBase != null && trunkVertical ? trunkVertical.x - exteriorBase : 0);
      const onMove = (ev: PointerEvent) => {
        const p2 = clientToDiagram(ev.clientX, ev.clientY, diagramCanvasRef, diagramTransform);
        if (!p2) return;
        const next = startOffset + (p2.x - startDiagramX);
        if (Math.abs(next) < 0.5) onOrthogonalTrunkOffsetChange(undefined);
        else onOrthogonalTrunkOffsetChange(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      connectionData?.orthogonalTrunkOffsetX,
      diagramCanvasRef,
      diagramTransform,
      fromAngle,
      fromX,
      onOrthogonalTrunkOffsetChange,
      toAngle,
      toX,
      trunkVertical,
    ],
  );

  const trunkHorizontal = useMemo(
    () =>
      orthogonalTrunkDragEnabled && diagramTransform && diagramCanvasRef && onOrthogonalTrunkOffsetYChange
        ? findOrthogonalTrunkHorizontalSegment(route.points)
        : null,
    [
      orthogonalTrunkDragEnabled,
      diagramTransform,
      diagramCanvasRef,
      onOrthogonalTrunkOffsetYChange,
      route.pathData,
    ],
  );

  const onTrunkHorizontalPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!diagramTransform || !diagramCanvasRef || !onOrthogonalTrunkOffsetYChange) return;
      if (e.button !== 0) return;
      const p = clientToDiagram(e.clientX, e.clientY, diagramCanvasRef, diagramTransform);
      if (!p) return;
      e.stopPropagation();
      e.preventDefault();
      const startDiagramY = p.y;
      const exteriorBase = orthogonalExteriorTrunkBaseY(fromY, toY, fromAngle, toAngle);
      const useAbsoluteY = orthogonalTrunkOffsetYIsAbsolute(fromAngle, toAngle);
      // Absolute bus Y (left/right or perpendicular): seed from the visible trunk so stale
      // relative leftovers do not jump the line. Same-side top/bottom stays relative to exterior base.
      const startOffset = useAbsoluteY && trunkHorizontal
        ? trunkHorizontal.y
        : (
          connectionData?.orthogonalTrunkOffsetY
          ?? (exteriorBase != null && trunkHorizontal ? trunkHorizontal.y - exteriorBase : 0)
        );
      // Reconcile stored absolute Y with the visible trunk before dragging (failed drags may
      // have accumulated a value that never affected the path).
      if (
        useAbsoluteY
        && trunkHorizontal
        && connectionData?.orthogonalTrunkOffsetY != null
        && Math.abs(connectionData.orthogonalTrunkOffsetY - startOffset) > 10
      ) {
        onOrthogonalTrunkOffsetYChange(startOffset);
      }
      const onMove = (ev: PointerEvent) => {
        const p2 = clientToDiagram(ev.clientX, ev.clientY, diagramCanvasRef, diagramTransform);
        if (!p2) return;
        const next = startOffset + (p2.y - startDiagramY);
        if (!useAbsoluteY && Math.abs(next) < 0.5) onOrthogonalTrunkOffsetYChange(undefined);
        else onOrthogonalTrunkOffsetYChange(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      connectionData?.orthogonalTrunkOffsetY,
      diagramCanvasRef,
      diagramTransform,
      fromAngle,
      fromY,
      onOrthogonalTrunkOffsetYChange,
      toAngle,
      toY,
      trunkHorizontal,
    ],
  );

  const rw = resolveConnectionWidths(connectionData);
  const rc = resolveOrthogonalConnectionPaint(connectionData, connectionColor, from, to, themeNeutral);
  const advancedLine = connectionNeedsAdvancedLineStyle(rw, rc);
  const widthVaries = !rw.locked && rw.wStart !== rw.wEnd;
  const colorVaries = !rc.locked && rc.cStart !== rc.cEnd;
  const ribbonLayout = React.useMemo(() => {
    const baseGrad = { gx1: fromX, gy1: fromY, gx2: toX, gy2: toY };
    if (!widthVaries || route.totalLength <= 0) {
      return { ribbonPathD: '', ...baseGrad };
    }
    // Long orthogonal paths: cap samples so width-gradient / ribbon polys stay cheap in SVG.
    const samples = Math.max(32, Math.min(120, Math.ceil(route.totalLength / 8)));
    const pts = Array.from({ length: samples }, (_, i) =>
      getPointOnOrthogonalPath(i / (samples - 1), route.points, route.totalLength)
    );
    return {
      ribbonPathD: buildRibbonPolygonPath(pts, rw.wStart, rw.wEnd),
      gx1: pts[0].x,
      gy1: pts[0].y,
      gx2: pts[pts.length - 1].x,
      gy2: pts[pts.length - 1].y,
    };
  }, [widthVaries, route.pathData, route.totalLength, fromX, fromY, toX, toY, rw.wStart, rw.wEnd]);

  // Arrow markers and styles
  const showEndArrow = connectionData?.toArrow === true || connectionData?.arrow === true;
  const showStartArrow = connectionData?.fromArrow === true;
  const thickness = maxResolvedLineWidth(rw);
  const hasShadow = connectionData?.shadow === true;

  // Unique IDs for SVG defs
  const uid = useRef(`orth-${Math.random().toString(36).slice(2, 8)}`).current;
  const startMarkerId = `${uid}-start`;
  const endMarkerId = `${uid}-end`;
  const shadowFilterId = `${uid}-shadow`;

  // Click handlers
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      applyFingerTapMarkerToMouseEventIfNeeded(e);
      if (connectionData && onClick) {
        e.stopPropagation();
        onClick(connectionData, e);
      }
    },
    [applyFingerTapMarkerToMouseEventIfNeeded, connectionData, onClick]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (connectionData && onDoubleClick) {
        e.stopPropagation();
        e.preventDefault();
        onDoubleClick(connectionData, e);
      }
    },
    [connectionData, onDoubleClick]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (connectionData && onContextMenu) {
        e.stopPropagation();
        e.preventDefault();
        onContextMenu(e, connectionData);
      }
    },
    [connectionData, onContextMenu]
  );

  // Text label logic
  const rawTextLabel = connectionData?.text;
  const textLabel = useResolvedGlobalText(rawTextLabel);
  const textPosition = (connectionData?.textPosition ?? 50) / 100; // 0-1
  const textPoint = useMemo(
    () => (textLabel ? getPointOnOrthogonalPath(textPosition, route.points, route.totalLength) : null),
    [textLabel, textPosition, route]
  );

  // Animation logic (mirror BezierConnection)
  const MAX_RENDERED_ANIMATION_SHAPES = 2000;
  const animation = clampConnectionAnimation(connectionData?.animation);
  const connectionThickness = thickness;
  const shapeSize = animation.size * 2 * connectionThickness;
  const baseAnimShapeSize = animation.size * 2 * Math.max(rw.wStart, rw.wEnd, 1e-6);
  const spacingDistance =
    (animation.size * 2 * CONNECTION_ANIMATION_SPACING_REF_LINE_PX) * (1 + animation.spacing);
  const pathLengthForCount = route.totalLength;
  const maxShapeCountByLength = spacingDistance > 0 ? Math.floor(pathLengthForCount / spacingDistance) : 0;
  const requestedShapeCount = animation.autoCount ? maxShapeCountByLength : animation.shapeCount;
  const renderedShapeCount = Math.max(
    0,
    Math.min(
      MAX_RENDERED_ANIMATION_SHAPES,
      Math.min(requestedShapeCount, maxShapeCountByLength)
    )
  );
  const hasExportAnimationTime = typeof exportAnimationTimeSeconds === "number" && Number.isFinite(exportAnimationTimeSeconds);
  const shouldRenderAnimationShapes = animationConnectionsEnabled && animation.enabled && renderedShapeCount > 0 && pathLengthForCount > 0;
  const speedMagnitude = Math.abs(animation.speed);
  const shouldAnimateShapes = shouldRenderAnimationShapes && speedMagnitude > 0;
  const useStaticExportAnimation = shouldAnimateShapes && hasExportAnimationTime;
  const pathLength = pathLengthForCount;
  const animationDuration = shouldAnimateShapes ? pathLength / speedMagnitude : 0;
  const animationColor = animation.color ? animation.color : colorWithHalfOpacity(rc.cStart);
  const connectionKey = `${connectionData?.from ?? from.id}-${connectionData?.to ?? to.id}-${connectionData?.id ?? ""}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const gradIdSuffix = connectionGradientIdSuffix(connectionData, rc, ribbonLayout);
  const animationPhaseResetKey = [
    animation.enabled ? "1" : "0",
    animation.shape,
    animation.speed,
    animation.size,
    connectionThickness,
    Math.round(shapeSize * 100) / 100,
    animation.autoCount ? "auto" : "manual",
    animation.shapeCount,
    animation.spacing,
    renderedShapeCount,
    Math.round(pathLength),
  ].join("-").replace(/[^a-zA-Z0-9_-]/g, "_");
  const motionPathId = `orth-motion-${connectionKey}-${animationPhaseResetKey}`;
  const strokeDashProps = advancedLine
    ? {}
    : connectionStrokeDashFromLineType(thickness, connectionData?.lineType);
  const lineGradientId = `orth-line-grad-${connectionKey}-${gradIdSuffix}`;
  const markerFillStart = rc.cStart;
  const markerFillEnd = rc.cEnd;

  return (
    <>
      <defs>
        {hasShadow && (
          <filter id={shadowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer result="shadow">
              <feFuncA type="linear" slope={resolvedTheme === "dark" ? 0.5 : 0.3} />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}

        {advancedLine && colorVaries && (
          <linearGradient
            id={lineGradientId}
            gradientUnits="userSpaceOnUse"
            x1={ribbonLayout.gx1}
            y1={ribbonLayout.gy1}
            x2={ribbonLayout.gx2}
            y2={ribbonLayout.gy2}
          >
            <stop offset="0%" stopColor={rc.cStart} />
            <stop offset="100%" stopColor={rc.cEnd} />
          </linearGradient>
        )}

        {showStartArrow && (
          <marker
            id={startMarkerId}
            markerWidth="10"
            markerHeight="7"
            refX="1"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="10 0, 0 3.5, 10 7" fill={markerFillStart} />
          </marker>
        )}

        {showEndArrow && (
          <marker
            id={endMarkerId}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={markerFillEnd} />
          </marker>
        )}
      </defs>

      <g
        {...fingerTapTouchSvgProps}
        className="group"
        style={{ ...GROUP_STYLE, ...slideTransitionStyle }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-connection-id={
          connectionData?.from && connectionData?.to ? `${connectionData.from}-${connectionData.to}` : undefined
        }
      >
        {shouldRenderAnimationShapes && (
          <path id={motionPathId} d={route.pathData} fill="none" stroke="none" />
        )}
        {/* Invisible wide hit-test path */}
        <path
          d={route.pathData}
          stroke="transparent"
          strokeWidth={Math.max(20, maxResolvedLineWidth(rw) * 4)}
          fill="none"
        />

        {/* Visible path */}
        {advancedLine ? (
          <>
            {ribbonLayout.ribbonPathD ? (
              <path
                d={ribbonLayout.ribbonPathD}
                fill={colorVaries ? `url(#${lineGradientId})` : rc.cStart}
                stroke="none"
                className="cursor-pointer connection-glow-hover transition-[filter] duration-200"
                filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
              />
            ) : (
              <path
                d={route.pathData}
                stroke={colorVaries ? `url(#${lineGradientId})` : rc.cStart}
                strokeWidth={rw.wStart}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="cursor-pointer connection-glow-hover transition-[filter] duration-200"
                filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
              />
            )}
            {showStartArrow && (
              <path
                d={route.pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={rw.wStart}
                markerStart={`url(#${startMarkerId})`}
                pointerEvents="none"
              />
            )}
            {showEndArrow && (
              <path
                d={route.pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={rw.wEnd}
                markerEnd={`url(#${endMarkerId})`}
                pointerEvents="none"
              />
            )}
          </>
        ) : (
          <path
            d={route.pathData}
            stroke={rc.cStart}
            className="cursor-pointer connection-glow-hover transition-[filter] duration-200"
            strokeWidth={thickness}
            strokeLinejoin="round"
            strokeLinecap={strokeDashProps.strokeLinecap ?? "round"}
            strokeDasharray={strokeDashProps.strokeDasharray}
            fill="none"
            markerStart={showStartArrow ? `url(#${startMarkerId})` : undefined}
            markerEnd={showEndArrow ? `url(#${endMarkerId})` : undefined}
            filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
          />
        )}

        {trunkVertical && (
          <g style={{ pointerEvents: "auto" }}>
            <line
              x1={trunkVertical.x}
              y1={trunkVertical.yMin}
              x2={trunkVertical.x}
              y2={trunkVertical.yMax}
              stroke="transparent"
              strokeWidth={26}
              onPointerDown={onTrunkVerticalPointerDown}
              className="cursor-ew-resize"
            />
            <line
              x1={trunkVertical.x}
              y1={trunkVertical.yMin}
              x2={trunkVertical.x}
              y2={trunkVertical.yMax}
              stroke={resolvedTheme === "dark" ? "rgba(74,222,128,0.5)" : "rgba(34,197,94,0.45)"}
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
        )}

        {trunkHorizontal && (
          <g style={{ pointerEvents: "auto" }}>
            <line
              x1={trunkHorizontal.xMin}
              y1={trunkHorizontal.y}
              x2={trunkHorizontal.xMax}
              y2={trunkHorizontal.y}
              stroke="transparent"
              strokeWidth={26}
              onPointerDown={onTrunkHorizontalPointerDown}
              className="cursor-ns-resize"
            />
            <line
              x1={trunkHorizontal.xMin}
              y1={trunkHorizontal.y}
              x2={trunkHorizontal.xMax}
              y2={trunkHorizontal.y}
              stroke={resolvedTheme === "dark" ? "rgba(74,222,128,0.5)" : "rgba(34,197,94,0.45)"}
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
        )}

        {/* Animation shapes */}
        {shouldRenderAnimationShapes && Array.from({ length: renderedShapeCount }).map((_, index) => {
          const progress = renderedShapeCount > 0 ? index / renderedShapeCount : 0;

          if (shouldAnimateShapes && !useStaticExportAnimation) {
            const loopConfig = getLoopedAnimationPathConfig(progress, animation.speed);
            const scaleValues = scaleValuesForAnimationKeyPoints(loopConfig.keyPoints, rw);
            return (
              <g key={`orth-anim-${animationPhaseResetKey}-${index}`}>
                <g>
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    additive="replace"
                    values={scaleValues}
                    keyTimes={loopConfig.keyTimes}
                    dur={`${animationDuration}s`}
                    begin="0s"
                    repeatCount="indefinite"
                    calcMode="linear"
                  />
                  {renderAnimatedShape(animation.shape, baseAnimShapeSize, animationColor)}
                </g>
                <animateMotion
                  dur={`${animationDuration}s`}
                  begin="0s"
                  repeatCount="indefinite"
                  calcMode="linear"
                  keyTimes={loopConfig.keyTimes}
                  keyPoints={loopConfig.keyPoints}
                  rotate={animation.shape === "arrow" || animation.shape === "triangle" ? "auto" : undefined}
                >
                  <mpath href={`#${motionPathId}`} />
                </animateMotion>
              </g>
            );
          }

          let effectiveProgress = progress;
          if (useStaticExportAnimation && pathLength > 0 && exportAnimationTimeSeconds != null) {
            const cyclesPerSecond = speedMagnitude / pathLength;
            const direction = animation.speed < 0 ? -1 : 1;
            const offset = exportAnimationTimeSeconds * cyclesPerSecond * direction;
            const wrapped = (progress + offset) % 1;
            effectiveProgress = wrapped < 0 ? wrapped + 1 : wrapped;
          }

          const distance = effectiveProgress * pathLength;
          const t = pathLength > 0 ? Math.min(1, distance / pathLength) : 0;
          const point = getPointOnOrthogonalPath(t, route.points, route.totalLength);
          const tangentT = Math.min(1, (distance + 2) / pathLength);
          const tangentPoint = getPointOnOrthogonalPath(tangentT, route.points, route.totalLength);
          const angleDeg = Math.atan2(tangentPoint.y - point.y, tangentPoint.x - point.x) * (180 / Math.PI);
          const staticShapeSize = animation.size * 2 * lineWidthAtPathFraction(rw, t);

          return (
            <g key={`orth-static-${animationPhaseResetKey}-${index}`} transform={`translate(${point.x}, ${point.y}) rotate(${angleDeg})`}>
              {renderAnimatedShape(animation.shape, staticShapeSize, animationColor)}
            </g>
          );
        })}

        {/* Text label */}
        {textLabel && textPoint && (
          <g>
            <rect
              x={textPoint.x - textLabel.length * 3.5}
              y={textPoint.y - 10}
              width={textLabel.length * 7}
              height={20}
              rx={4}
              ry={4}
              fill={resolvedTheme === "dark" ? "rgba(30,30,30,0.85)" : "rgba(255,255,255,0.85)"}
            />
            <text
              x={textPoint.x}
              y={textPoint.y + 4}
              textAnchor="middle"
              className="text-xs fill-current"
              style={{ fontSize: "11px", pointerEvents: "none" }}
            >
              {textLabel}
            </text>
          </g>
        )}
      </g>
    </>
  );
}

export const OrthogonalConnection = React.memo(OrthogonalConnectionInner, areOrthogonalPropsEqual);