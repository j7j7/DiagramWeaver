"use client";

import React, { useMemo, useRef, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";
import type { DiagramConnectionData, DiagramNodeData, DiagramZoneData } from "@/lib/types";
import {
  computeOrthogonalRoute,
  getPointOnOrthogonalPath,
  collectObstacles,
  type OrthogonalRoute,
} from "@/lib/orthogonal-routing";
import {
  determineConnectionEdges,
  getOptimalConnectionPoints,
  renderAnimatedShape,
  getLoopedAnimationPathConfig,
  colorWithHalfOpacity,
  type Positionable,
} from "./bezier-connection";
import { clampConnectionAnimation } from "@/lib/connection-animation";

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
  onContextMenu?: (e: React.MouseEvent, connection: DiagramConnectionData) => void;
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
    (a as any).nodeSize === (b as any).nodeSize &&
    (a as any).sizeMode === (b as any).sizeMode &&
    (a as any).textPosition === (b as any).textPosition &&
    (a as any).textVerticalPosition === (b as any).textVerticalPosition &&
    a.subType === b.subType
  );
}

function connectionDataEqual(a?: DiagramConnectionData, b?: DiagramConnectionData): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.from !== b.from || a.to !== b.to || (a as any).id !== (b as any).id) return false;
  if (a.lineWidth !== b.lineWidth || a.shadow !== b.shadow || a.color !== b.color) return false;
  if (a.fromArrow !== b.fromArrow || a.toArrow !== b.toArrow || a.arrow !== b.arrow) return false;
  if (a.centerEdgeAnchors !== b.centerEdgeAnchors) return false;
  if (a.smoothCorners !== b.smoothCorners) return false;
  if (a.text !== b.text || a.textPosition !== b.textPosition || a.style !== b.style) return false;
  const wpA = a.waypoints?.map((w) => `${w.x},${w.y}`).join(";") ?? "";
  const wpB = b.waypoints?.map((w) => `${w.x},${w.y}`).join(";") ?? "";
  if (wpA !== wpB) return false;
  const animA = a.animation ? JSON.stringify(a.animation) : "";
  const animB = b.animation ? JSON.stringify(b.animation) : "";
  if (animA !== animB) return false;
  return true;
}

function areOrthogonalPropsEqual(prev: OrthogonalConnectionProps, next: OrthogonalConnectionProps): boolean {
  return (
    positionablesEqual(prev.from, next.from) &&
    positionablesEqual(prev.to, next.to) &&
    prev.connectionColor === next.connectionColor &&
    connectionDataEqual(prev.connectionData, next.connectionData) &&
    prev.route?.pathData === next.route?.pathData &&
    prev.route?.totalLength === next.route?.totalLength &&
    prev.exportAnimationTimeSeconds === next.exportAnimationTimeSeconds &&
    prev.animationConnectionsEnabled === next.animationConnectionsEnabled &&
    prev.nodesById === next.nodesById &&
    prev.zonesById === next.zonesById
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
  onContextMenu,
}: OrthogonalConnectionProps) {
  const { resolvedTheme } = useTheme();

  // Determine connection colour
  const finalConnectionColor = useMemo(() => {
    if (connectionData?.color) return connectionData.color;
    if (connectionColor) return connectionColor;
    if (to?.lineColor) return to.lineColor;
    if (from?.lineColor) return from.lineColor;
    return resolvedTheme === "dark" ? "#9ca3af" : "#6b7280";
  }, [connectionData?.color, connectionColor, to?.lineColor, from?.lineColor, resolvedTheme]);

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

  // Collect obstacles (exclude source and target nodes)
  const obstacles = useMemo(
    () => collectObstacles(
      nodesById,
      zonesById,
      [connectionData?.from ?? "", connectionData?.to ?? ""].filter(Boolean)
    ),
    [nodesById, zonesById, connectionData?.from, connectionData?.to]
  );

  // Route (with optional waypoints - path passes through each)
  const waypoints = connectionData?.waypoints;
  const route: OrthogonalRoute = useMemo(
    () => precomputedRoute ?? computeOrthogonalRoute(fromX, fromY, toX, toY, fromAngle, toAngle, obstacles, waypoints, {
      smoothCorners: connectionData?.smoothCorners === true,
    }),
    [precomputedRoute, fromX, fromY, toX, toY, fromAngle, toAngle, obstacles, waypoints, connectionData?.smoothCorners]
  );

  // Arrow markers and styles
  const showEndArrow = connectionData?.toArrow === true || connectionData?.arrow === true;
  const showStartArrow = connectionData?.fromArrow === true;
  const thickness = connectionData?.lineWidth || 2.5;
  const hasShadow = connectionData?.shadow === true;

  // Unique IDs for SVG defs
  const uid = useRef(`orth-${Math.random().toString(36).slice(2, 8)}`).current;
  const startMarkerId = `${uid}-start`;
  const endMarkerId = `${uid}-end`;
  const shadowFilterId = `${uid}-shadow`;

  // Click handlers
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (connectionData && onClick) {
        e.stopPropagation();
        onClick(connectionData, e);
      }
    },
    [connectionData, onClick]
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
  const textLabel = connectionData?.text;
  const textPosition = (connectionData?.textPosition ?? 50) / 100; // 0-1
  const textPoint = useMemo(
    () => (textLabel ? getPointOnOrthogonalPath(textPosition, route.points, route.totalLength) : null),
    [textLabel, textPosition, route]
  );

  // Animation logic (mirror BezierConnection)
  const MAX_RENDERED_ANIMATION_SHAPES = 2000;
  const animation = clampConnectionAnimation(connectionData?.animation);
  const connectionThickness = connectionData?.lineWidth || 2.5;
  const shapeSize = animation.size * 2 * connectionThickness;
  const spacingDistance = shapeSize * (1 + animation.spacing);
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
  const animationColor = animation.color ? animation.color : colorWithHalfOpacity(finalConnectionColor);
  const connectionKey = `${connectionData?.from ?? from.id}-${connectionData?.to ?? to.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
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
            <polygon points="10 0, 0 3.5, 10 7" fill={finalConnectionColor} />
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
            <polygon points="0 0, 10 3.5, 0 7" fill={finalConnectionColor} />
          </marker>
        )}
      </defs>

      <g className="group" style={GROUP_STYLE} onClick={handleClick} onContextMenu={handleContextMenu} data-connection-id={
        connectionData?.from && connectionData?.to 
          ? `${connectionData.from}-${connectionData.to}` 
          : undefined
      }>
        {shouldRenderAnimationShapes && (
          <path id={motionPathId} d={route.pathData} fill="none" stroke="none" />
        )}
        {/* Invisible wide hit-test path */}
        <path d={route.pathData} stroke="transparent" strokeWidth={20} fill="none" />

        {/* Visible path */}
        <path
          d={route.pathData}
          stroke={finalConnectionColor}
          className="cursor-pointer connection-glow-hover transition-[filter] duration-200"
          strokeWidth={thickness}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
          markerStart={showStartArrow ? `url(#${startMarkerId})` : undefined}
          markerEnd={showEndArrow ? `url(#${endMarkerId})` : undefined}
          filter={hasShadow ? `url(#${shadowFilterId})` : undefined}
        />

        {/* Animation shapes */}
        {shouldRenderAnimationShapes && Array.from({ length: renderedShapeCount }).map((_, index) => {
          const progress = renderedShapeCount > 0 ? index / renderedShapeCount : 0;

          if (shouldAnimateShapes && !useStaticExportAnimation) {
            const loopConfig = getLoopedAnimationPathConfig(progress, animation.speed);
            return (
              <g key={`orth-anim-${animationPhaseResetKey}-${index}`}>
                {renderAnimatedShape(animation.shape, shapeSize, animationColor)}
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

          return (
            <g key={`orth-static-${animationPhaseResetKey}-${index}`} transform={`translate(${point.x}, ${point.y}) rotate(${angleDeg})`}>
              {renderAnimatedShape(animation.shape, shapeSize, animationColor)}
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