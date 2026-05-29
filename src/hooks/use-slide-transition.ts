import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { DiagramData, DiagramNodeData, DiagramConnectionData, DiagramZoneData } from '@/lib/types';
import { extractVisualColorFields, visualColorNeedsCrossfade, visualColorSignature } from '@/lib/slide-visual-color';
import { buildStaggerDelaysForSlideTransition } from '@/lib/slide-transition-order';
import { easeSlideTransitionInOut } from '@/lib/ease-slide-cubic-bezier';
import { isChartNodeType } from '@/lib/chart-node';
import {
  CHART_SLIDE_SEGMENT_STAGGER_MS,
  chartPresentationSignature,
  chartSegmentCountForStagger,
  type ChartSlideStagger,
} from '@/lib/chart-presentation-stagger';
import { chartSlideLerpCompatible } from '@/lib/chart-slide-lerp';
import {
  isTimelineNodeType,
  timelinePresentationSignature,
  timelineSlideRemovedCardPayloads,
  type TimelineSlideRemovedCardPayload,
} from '@/lib/timeline-layout';
import { isPyramidNodeType } from '@/lib/pyramid';
import { isSegmentedRectangleNodeType } from '@/lib/segmented-rectangle';
import {
  sectionedShapePresentationSignature,
  sectionedShapeSegmentCount,
} from '@/lib/sectioned-shape-slide-transition';
import { isCardNodeType } from '@/lib/card-utils';
import { cardPresentationSignature, cardSlideStaggerParticipantCount } from '@/lib/card-presentation';

export interface SlideTransitionStyle {
  opacity: number;
  transition: string;
  /** Stagger start (ms) — matches canvas stack order (back → front), same idea as layer animations. */
  transitionDelayMs?: number;
  transform?: string | undefined;
  transformOrigin?: string;
  /** Interpolated endpoint offsets so connection paths lerp with moving nodes (slide transitions). */
  slideEndpointOffset?: { fromDx: number; fromDy: number; toDx: number; toDy: number };
  /** Interpolated manual waypoints (same length on prev/current slide). */
  slideWaypointOffsets?: Array<{ dx: number; dy: number }>;
  /** Appearing/disappearing reverse replacement (A→B out + B→A in). */
  reversePairConnKey?: string;
  /** Slide fade-out — omit from per-edge anchor spread (target slide defines slot count). */
  slideFadeOut?: boolean;
  visualColorMerge?: Record<string, unknown>;
  visualColorMergeTransition?: string;
  /** Stack "from" and "to" visual fields and animate top layer opacity (gradients). */
  visualColorCrossfade?: { from: Record<string, unknown>; to: Record<string, unknown> };
  visualColorCrossfadeTopOpacity?: number;
  visualColorCrossfadeTopTransition?: string;
  /** Pie/bar/line: stagger segment pop during slide change (outer node scale suppressed). */
  chartSlideStagger?: ChartSlideStagger;
  /** Pyramid / segmented rectangle: per-tier or per-strip opacity stagger (outer motion suppressed like charts). */
  sectionSlideStagger?: ChartSlideStagger;
  /** Card composite: per-element opacity stagger (outer motion suppressed like charts). */
  cardSlideStagger?: ChartSlideStagger;
  /** Timeline cards: same stagger contract as `chartSlideStagger` (play / slide transitions). */
  timelineSlideStagger?: ChartSlideStagger;
  /** Removed cards ghosted from the previous slide (shrink + fade; staggered). */
  timelineRemoveStagger?: ChartSlideStagger;
  timelineRemovedCards?: ReadonlyArray<TimelineSlideRemovedCardPayload>;
  /** Previous-slide timeline node — merged with each {@link timelineRemovedCards} entry for `MindmapNodeShape`. */
  timelineRemovedGhostBase?: DiagramNodeData;
  /** New entry ids in curr order that play enter stagger; omit when every card should animate (whole timeline appear). */
  timelineEnterStaggerOrder?: readonly string[];
  /** 0–1 eased progress for value-only chart interpolation (same segment layout). */
  chartLerpU?: number;
  /** `JSON.stringify(prev.chart)` when lerping. */
  chartLerpFromJson?: string;
}

interface SlideNodeAnimStyle {
  deltaX: number;
  deltaY: number;
  opacityStart: number;
  opacityEnd: number;
  translateYStart: number;
  translateYEnd: number;
  easing: string;
  widthStart: number;
  widthEnd: number;
  heightStart: number;
  heightEnd: number;
  isAppearing: boolean;
  isDisappearing: boolean;
  isResizeOnly: boolean;
  scaleOriginX: string;
  scaleOriginY: string;
  hasVisualColorChange: boolean;
  useVisualColorCrossfade: boolean;
  visualColorMergeStart: Record<string, unknown>;
  visualColorMergeEnd: Record<string, unknown>;
  chartPresentationChanged?: boolean;
  suppressChartOuterScale?: boolean;
  chartLerpEligible?: boolean;
  chartLerpFromJson?: string;
  isAppearingChart?: boolean;
  isDisappearingChart?: boolean;
  isAppearingTimeline?: boolean;
  isDisappearingTimeline?: boolean;
  timelinePresentationChanged?: boolean;
  suppressTimelineOuterMotion?: boolean;
  sectionedShapePresentationChanged?: boolean;
  suppressSectionedShapeOuterMotion?: boolean;
  isAppearingSectionedShape?: boolean;
  isDisappearingSectionedShape?: boolean;
  cardPresentationChanged?: boolean;
  suppressCardOuterMotion?: boolean;
  isAppearingCard?: boolean;
  isDisappearingCard?: boolean;
}

interface SlideAnimation {
  startTime: number;
  durationMs: number;
  /** Per-slide scaled motion duration (matches CSS transitions + RAF geometry/chart lerp windows). */
  motionDurationMs: number;
  /** Per-slide scaled chart/timeline/section segment stagger (matches segment CSS animations). */
  segmentStaggerMs: number;
  nodeIdStyles: Map<string, SlideNodeAnimStyle>;
  connKeyStyles: Map<string, {
    opacityStart: number;
    opacityEnd: number;
    translateYStart: number;
    translateYEnd: number;
    easing: string;
    slideEndpointMove?: {
      fromDx: number;
      fromDy: number;
      toDx: number;
      toDy: number;
      waypointPrev?: Array<{ x: number; y: number }>;
      waypointCurr?: Array<{ x: number; y: number }>;
      waypointChanged: boolean;
      /** When true, keep endpoints at previous-slide positions (no RAF lerp); used for disappearing connections. */
      geomLockToPrev?: boolean;
    };
  }>;
  connectionDelayMs: Map<string, number>;
  nodeDelayMs: Map<string, number>;
}

const TRANSITION_DURATION_MS = 300;
/** Hard cap for play/slide transitions so huge diffs stay navigable (see time budget in `startTransition`). */
const SLIDE_TRANSITION_TOTAL_BUDGET_MS = 2000;
/** Kept small for RAF vs CSS sync; folded into budget when scaling down. */
const SLIDE_TRANSITION_RAF_TAIL_PAD_MS = 50;
const EASE_OUT = 'cubic-bezier(0.0, 0.0, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0.0, 1, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.4, 0.0, 0.2, 1)';

function slideMergeTransitionWithDelay(delayMs: number, durationMs: number = TRANSITION_DURATION_MS): string {
  const t = durationMs;
  const e = 'cubic-bezier(0.4, 0, 0.2, 1)';
  const d = delayMs;
  return `background ${t}ms ${e} ${d}ms, background-color ${t}ms ${e} ${d}ms, border-color ${t}ms ${e} ${d}ms, color ${t}ms ${e} ${d}ms, fill ${t}ms ${e} ${d}ms, stroke ${t}ms ${e} ${d}ms`;
}

function slideCrossfadeOpacityWithDelay(delayMs: number, durationMs: number = TRANSITION_DURATION_MS): string {
  return `opacity ${durationMs}ms ${EASE_IN_OUT} ${delayMs}ms`;
}

/** Only opacity + transform — avoid `transition: all`, which can drag box-shadow/filter into interpolation and flash during compositing. */
function slideMotionTransition(easing: string, durationMs: number = TRANSITION_DURATION_MS): string {
  const t = durationMs;
  return `opacity ${t}ms ${easing}, transform ${t}ms ${easing}`;
}

/** Connection appear/disappear: opacity only (no vertical slide). */
function slideConnectionFadeTransition(easing: string, durationMs: number = TRANSITION_DURATION_MS): string {
  const t = durationMs;
  return `opacity ${t}ms ${easing}`;
}

/** Fade transitions: tag reverse replacement pairs so canvas can collapse duplicate anchor slots. */
function buildSlideReversePairKeys(
  connKeyStyles: Map<string, { opacityStart: number; opacityEnd: number }>,
  prevConnsMap: Map<string, DiagramConnectionData>,
  currConnsMap: Map<string, DiagramConnectionData>,
): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const connKeyVal of connKeyStyles.keys()) {
    const style = connKeyStyles.get(connKeyVal)!;
    if (style.opacityStart === style.opacityEnd) continue;
    const prevConn = prevConnsMap.get(connKeyVal);
    const currConn = currConnsMap.get(connKeyVal);
    if (!prevConn || currConn) continue;
    const revKey = connKey({ from: prevConn.to, to: prevConn.from } as DiagramConnectionData);
    if (currConnsMap.has(revKey) && !prevConnsMap.has(revKey)) {
      pairs.set(connKeyVal, revKey);
      pairs.set(revKey, connKeyVal);
    }
  }
  return pairs;
}

function slideConnFadeExtras(
  connKeyVal: string,
  style: { opacityStart: number; opacityEnd: number },
  reversePairKeys: Map<string, string>,
): Pick<SlideTransitionStyle, 'reversePairConnKey' | 'slideFadeOut'> {
  if (style.opacityStart === style.opacityEnd) return {};
  const extras: Pick<SlideTransitionStyle, 'reversePairConnKey' | 'slideFadeOut'> = {};
  if (style.opacityEnd === 0) extras.slideFadeOut = true;
  const pair = reversePairKeys.get(connKeyVal);
  if (pair) extras.reversePairConnKey = pair;
  return extras;
}

function connKey(conn: DiagramConnectionData): string {
  return (conn as any).id || `${conn.from}\u2192${conn.to}`;
}

function timelineCardSlideStaggerBase(
  delayMs: number,
  exit: boolean,
  segmentStaggerMs: number,
  motionDurationMs: number,
): ChartSlideStagger {
  return {
    baseDelayMs: delayMs,
    staggerMs: segmentStaggerMs,
    durationMs: motionDurationMs,
    easingCss: EASE_IN_OUT,
    exit,
  };
}

/** Per-card slide fields for timelines (whole appear/exit vs add/remove diff). */
function computeTimelineCardTransitionStylePatch(
  nodeId: string,
  style: SlideNodeAnimStyle,
  prevNodesMap: Map<string, DiagramNodeData>,
  currNodesMap: Map<string, DiagramNodeData>,
  baseDelayMs: number,
  segmentStaggerMs: number,
  motionDurationMs: number,
): Pick<
  SlideTransitionStyle,
  | 'timelineSlideStagger'
  | 'timelineRemoveStagger'
  | 'timelineRemovedCards'
  | 'timelineRemovedGhostBase'
  | 'timelineEnterStaggerOrder'
> {
  const prevNode = prevNodesMap.get(nodeId);
  const currNode = currNodesMap.get(nodeId);

  if (style.isAppearingTimeline && currNode && isTimelineNodeType(currNode.type)) {
    return {
      timelineSlideStagger: timelineCardSlideStaggerBase(baseDelayMs, false, segmentStaggerMs, motionDurationMs),
    };
  }
  if (style.isDisappearingTimeline && prevNode && isTimelineNodeType(prevNode.type)) {
    return {
      timelineSlideStagger: timelineCardSlideStaggerBase(baseDelayMs, true, segmentStaggerMs, motionDurationMs),
    };
  }
  if (
    style.timelinePresentationChanged &&
    prevNode &&
    currNode &&
    isTimelineNodeType(prevNode.type) &&
    isTimelineNodeType(currNode.type)
  ) {
    const removed = timelineSlideRemovedCardPayloads(prevNode, currNode, undefined);
    const currE = currNode.timelineEntries ?? [];
    const prevE = prevNode.timelineEntries ?? [];
    const prevIds = new Set(prevE.map((e) => e.id));
    const addedOrder = currE.filter((e) => !prevIds.has(e.id)).map((e) => e.id);

    return {
      ...(addedOrder.length > 0
        ? {
            timelineSlideStagger: timelineCardSlideStaggerBase(
              baseDelayMs,
              false,
              segmentStaggerMs,
              motionDurationMs,
            ),
            timelineEnterStaggerOrder: addedOrder,
          }
        : {}),
      ...(removed.length > 0
        ? {
            timelineRemoveStagger: timelineCardSlideStaggerBase(
              baseDelayMs,
              true,
              segmentStaggerMs,
              motionDurationMs,
            ),
            timelineRemovedCards: removed,
            timelineRemovedGhostBase: prevNode,
          }
        : {}),
    };
  }
  return {};
}

/** Line nodes use startPos/endPos; compare when both slides have a line node. */
function buildItemMap(diagram: DiagramData): Map<string, DiagramNodeData | DiagramZoneData> {
  const m = new Map<string, DiagramNodeData | DiagramZoneData>();
  for (const n of diagram.nodes || []) m.set(n.id, n);
  for (const z of diagram.zones || []) m.set(z.id, z);
  return m;
}

function lineEndpointsEqual(a: DiagramNodeData, b: DiagramNodeData): boolean {
  const as = (a as { startPos?: { x: number; y: number } }).startPos;
  const bs = (b as { startPos?: { x: number; y: number } }).startPos;
  const ae = (a as { endPos?: { x: number; y: number } }).endPos;
  const be = (b as { endPos?: { x: number; y: number } }).endPos;
  if (as && bs) {
    if (as.x !== bs.x || as.y !== bs.y) return false;
  } else if (Boolean(as) !== Boolean(bs)) return false;
  if (ae && be) {
    if (ae.x !== be.x || ae.y !== be.y) return false;
  } else if (Boolean(ae) !== Boolean(be)) return false;
  return true;
}

interface SlideTransitionConfig {
  enabled: boolean;
  currentDiagram: DiagramData | null;
  previousDiagram: DiagramData | null;
}

export function useSlideTransition({ enabled, currentDiagram, previousDiagram }: SlideTransitionConfig) {
  const [animations, setAnimations] = useState<SlideAnimation[]>([]);
  const [nodeStyles, setNodeStyles] = useState<Map<string, SlideTransitionStyle>>(new Map());
  const [connectionStyles, setConnectionStyles] = useState<Map<string, SlideTransitionStyle>>(new Map());
  const [animatingNodes, setAnimatingNodes] = useState<DiagramNodeData[]>([]);
  const [animatingConnections, setAnimatingConnections] = useState<DiagramConnectionData[]>([]);

  const connectionSlideEffectiveStartRef = useRef<number | null>(null);
  const connectionGeomRafRef = useRef<number | null>(null);
  const chartLerpRafRef = useRef<number | null>(null);
  const animationsRef = useRef<SlideAnimation[]>([]);
  animationsRef.current = animations;

  const startTransition = useCallback(() => {
    if (!enabled || !currentDiagram || !previousDiagram) return;

    const prevNodesMap = new Map((previousDiagram.nodes || []).map(n => [n.id, n]));
    const currNodesMap = new Map((currentDiagram.nodes || []).map(n => [n.id, n]));
    const prevConnsMap = new Map((previousDiagram.connections || []).map(c => [connKey(c), c]));
    const currConnsMap = new Map((currentDiagram.connections || []).map(c => [connKey(c), c]));
    const prevItemsMap = buildItemMap(previousDiagram);
    const currItemsMap = buildItemMap(currentDiagram);

    const nodeIdStyles = new Map<string, SlideNodeAnimStyle>();
    const connKeyStyles = new Map<string, any>();
    const nodesToAdd: DiagramNodeData[] = [];
    const connsToAdd: DiagramConnectionData[] = [];

    const allNodeIds = new Set([...prevNodesMap.keys(), ...currNodesMap.keys()]);

    for (const nodeId of allNodeIds) {
      const prevNode = prevNodesMap.get(nodeId);
      const currNode = currNodesMap.get(nodeId);

      const prevX = prevNode?.x ?? 0;
      const prevY = prevNode?.y ?? 0;
      const currX = currNode?.x ?? 0;
      const currY = currNode?.y ?? 0;

      const prevWidth = prevNode?.width ?? 80;
      const prevHeight = prevNode?.height ?? 80;
      const currWidth = currNode?.width ?? 80;
      const currHeight = currNode?.height ?? 80;

      const isAppearing = !prevNode && !!currNode;
      const isDisappearing = !!prevNode && !currNode;
      const isMoving = Boolean(
        prevNode &&
          currNode &&
          (prevX !== currX ||
            prevY !== currY ||
            !lineEndpointsEqual(prevNode, currNode) ||
            (prevNode.rotation ?? 0) !== (currNode.rotation ?? 0)),
      );

      let opacityStart = isAppearing ? 0 : 1;
      let opacityEnd = isDisappearing ? 0 : 1;

      const deltaX = isMoving ? (prevX - currX) : 0;
      const deltaY = isMoving ? (prevY - currY) : 0;

      let translateYStart = isAppearing ? 30 : 0;
      let translateYEnd = isDisappearing ? 30 : 0;

      const easing = isAppearing ? EASE_OUT : (isDisappearing ? EASE_IN : EASE_IN_OUT);

      const isResizeOnly = Boolean(
        prevNode && currNode && !isMoving && (prevWidth !== currWidth || prevHeight !== currHeight),
      );

      // Infer resize anchor: which edge stayed fixed during resize (from position delta)
      // Left edge moved right (x increased) -> right edge was anchor -> origin-x 100%
      // Top edge moved down (y increased) -> bottom edge was anchor -> origin-y 100%
      const scaleOriginX = prevX < currX ? '100%' : '0';
      const scaleOriginY = prevY < currY ? '100%' : '0';

      const hasVisualColorChange = Boolean(
        prevNode && currNode && visualColorSignature(prevNode) !== visualColorSignature(currNode)
      );
      const visualColorMergeStart = hasVisualColorChange && prevNode ? extractVisualColorFields(prevNode) : {};
      const visualColorMergeEnd = hasVisualColorChange && currNode ? extractVisualColorFields(currNode) : {};
      const useVisualColorCrossfade =
        hasVisualColorChange && visualColorNeedsCrossfade(visualColorMergeStart, visualColorMergeEnd);

      const prevChartSig = prevNode ? chartPresentationSignature(prevNode) : null;
      const currChartSig = currNode ? chartPresentationSignature(currNode) : null;
      const chartPresentationChanged = Boolean(
        prevChartSig != null && currChartSig != null && prevChartSig !== currChartSig
      );

      const isChartNode =
        isChartNodeType(prevNode?.type) || isChartNodeType(currNode?.type);
      const isDisappearingChart = Boolean(
        isDisappearing && prevNode && isChartNodeType(prevNode.type),
      );
      /** Never CSS-scale the chart wrapper; segments animate inside SVG (appear + disappear). */
      const suppressChartOuterScale = Boolean(
        isChartNode && (!isDisappearing || isDisappearingChart),
      );

      const isAppearingChart = Boolean(isAppearing && isChartNode);
      if (isAppearingChart) {
        opacityStart = 1;
        translateYStart = 0;
      }
      if (isDisappearingChart) {
        opacityEnd = 1;
        translateYEnd = 0;
      }

      const chartLerpEligible = Boolean(
        chartPresentationChanged &&
          prevNode &&
          currNode &&
          chartSlideLerpCompatible(prevNode, currNode)
      );
      const chartLerpFromJson =
        chartLerpEligible && prevNode?.chart
          ? JSON.stringify(prevNode.chart)
          : undefined;

      const prevTlSig = prevNode ? timelinePresentationSignature(prevNode) : null;
      const currTlSig = currNode ? timelinePresentationSignature(currNode) : null;
      const timelinePresentationChanged = Boolean(
        prevTlSig != null && currTlSig != null && prevTlSig !== currTlSig
      );

      const isTimelineNode =
        isTimelineNodeType(prevNode?.type) || isTimelineNodeType(currNode?.type);
      const isDisappearingTimeline = Boolean(
        isDisappearing && prevNode && isTimelineNodeType(prevNode.type),
      );
      /** Cards animate individually; outer wrapper skips scale / pop like charts. */
      const suppressTimelineOuterMotion = Boolean(
        isTimelineNode && (!isDisappearing || isDisappearingTimeline),
      );

      const isAppearingTimeline = Boolean(isAppearing && currNode && isTimelineNodeType(currNode.type));
      if (isAppearingTimeline) {
        opacityStart = 1;
        translateYStart = 0;
      }
      if (isDisappearingTimeline) {
        opacityEnd = 1;
        translateYEnd = 0;
      }

      const prevSectionSig = prevNode ? sectionedShapePresentationSignature(prevNode) : null;
      const currSectionSig = currNode ? sectionedShapePresentationSignature(currNode) : null;
      const sectionedShapePresentationChanged = Boolean(
        prevSectionSig != null && currSectionSig != null && prevSectionSig !== currSectionSig,
      );

      const isSectionedShapeNode =
        isPyramidNodeType(prevNode?.type) ||
        isPyramidNodeType(currNode?.type) ||
        isSegmentedRectangleNodeType(prevNode?.type) ||
        isSegmentedRectangleNodeType(currNode?.type);

      const isDisappearingSectionedShape = Boolean(
        isDisappearing && prevNode && (isPyramidNodeType(prevNode.type) || isSegmentedRectangleNodeType(prevNode.type)),
      );

      /** Tier/strip SVG paints stagger like charts; outer wrapper skips scale / fade pop. */
      const suppressSectionedShapeOuterMotion = Boolean(
        isSectionedShapeNode && (!isDisappearing || isDisappearingSectionedShape),
      );

      const isAppearingSectionedShape = Boolean(
        isAppearing && currNode && (isPyramidNodeType(currNode.type) || isSegmentedRectangleNodeType(currNode.type)),
      );

      if (isAppearingSectionedShape) {
        opacityStart = 1;
        translateYStart = 0;
      }
      if (isDisappearingSectionedShape) {
        opacityEnd = 1;
        translateYEnd = 0;
      }

      const prevCardSig = prevNode ? cardPresentationSignature(prevNode) : null;
      const currCardSig = currNode ? cardPresentationSignature(currNode) : null;
      const cardPresentationChanged = Boolean(
        prevCardSig != null && currCardSig != null && prevCardSig !== currCardSig,
      );
      const isCardNode =
        isCardNodeType(prevNode?.type) || isCardNodeType(currNode?.type);
      const isDisappearingCard = Boolean(
        isDisappearing && prevNode && isCardNodeType(prevNode.type),
      );
      const suppressCardOuterMotion = Boolean(
        isCardNode && (!isDisappearing || isDisappearingCard),
      );
      const isAppearingCard = Boolean(
        isAppearing && currNode && isCardNodeType(currNode.type),
      );
      if (isAppearingCard) {
        opacityStart = 1;
        translateYStart = 0;
      }
      if (isDisappearingCard) {
        opacityEnd = 1;
        translateYEnd = 0;
      }

      const needsNodeTransition =
        isAppearing ||
        isDisappearing ||
        isMoving ||
        isResizeOnly ||
        hasVisualColorChange ||
        chartPresentationChanged ||
        timelinePresentationChanged ||
        sectionedShapePresentationChanged ||
        cardPresentationChanged;

      if (!needsNodeTransition) continue;

      nodeIdStyles.set(nodeId, {
        deltaX,
        deltaY,
        opacityStart,
        opacityEnd,
        translateYStart,
        translateYEnd,
        easing,
        widthStart: prevWidth,
        widthEnd: currWidth,
        heightStart: prevHeight,
        heightEnd: currHeight,
        isAppearing,
        isDisappearing,
        isResizeOnly,
        scaleOriginX,
        scaleOriginY,
        hasVisualColorChange,
        useVisualColorCrossfade,
        visualColorMergeStart,
        visualColorMergeEnd,
        chartPresentationChanged,
        suppressChartOuterScale,
        chartLerpEligible,
        chartLerpFromJson,
        isAppearingChart,
        isDisappearingChart,
        timelinePresentationChanged,
        suppressTimelineOuterMotion,
        isAppearingTimeline,
        isDisappearingTimeline,
        sectionedShapePresentationChanged,
        suppressSectionedShapeOuterMotion,
        isAppearingSectionedShape,
        isDisappearingSectionedShape,
        cardPresentationChanged,
        suppressCardOuterMotion,
        isAppearingCard,
        isDisappearingCard,
      });

      if (isDisappearing) {
        nodesToAdd.push(prevNode);
      }
    }

    const allConnKeys = new Set([...prevConnsMap.keys(), ...currConnsMap.keys()]);

    for (const connKeyVal of allConnKeys) {
      const prevConn = prevConnsMap.get(connKeyVal);
      const currConn = currConnsMap.get(connKeyVal);

      const isAppearing = !prevConn && currConn;
      const isDisappearing = prevConn && !currConn;

      const opacityStart = isAppearing ? 0 : 1;
      const opacityEnd = isDisappearing ? 0 : 1;
 
      const translateYStart = 0;
      const translateYEnd = 0;

      const easing = isAppearing ? EASE_OUT : (isDisappearing ? EASE_IN : EASE_IN_OUT);

      const needsConnTransition = isAppearing || isDisappearing;
      if (!needsConnTransition) continue;

      if (isDisappearing) {
        connsToAdd.push(prevConn);

        const fromPrev = prevItemsMap.get(prevConn.from);
        const fromCurr = currItemsMap.get(prevConn.from);
        const toPrev = prevItemsMap.get(prevConn.to);
        const toCurr = currItemsMap.get(prevConn.to);

        let fromDx = 0;
        let fromDy = 0;
        let toDx = 0;
        let toDy = 0;
        if (fromPrev && fromCurr) {
          fromDx = (fromPrev.x ?? 0) - (fromCurr.x ?? 0);
          fromDy = (fromPrev.y ?? 0) - (fromCurr.y ?? 0);
        }
        if (toPrev && toCurr) {
          toDx = (toPrev.x ?? 0) - (toCurr.x ?? 0);
          toDy = (toPrev.y ?? 0) - (toCurr.y ?? 0);
        }

        connKeyStyles.set(connKeyVal, {
          opacityStart: 1,
          opacityEnd: 0,
          translateYStart: 0,
          translateYEnd: 0,
          easing: EASE_IN,
          slideEndpointMove: {
            fromDx,
            fromDy,
            toDx,
            toDy,
            waypointPrev: prevConn.waypoints,
            waypointCurr: prevConn.waypoints,
            waypointChanged: false,
            geomLockToPrev: true,
          },
        });
        continue;
      }

      connKeyStyles.set(connKeyVal, {
        opacityStart,
        opacityEnd,
        translateYStart,
        translateYEnd,
        easing,
      });
    }

    for (const connKeyVal of allConnKeys) {
      const prevConn = prevConnsMap.get(connKeyVal);
      const currConn = currConnsMap.get(connKeyVal);
      if (!prevConn || !currConn) continue;
      if (connKeyStyles.has(connKeyVal)) continue;

      const fromPrev = prevItemsMap.get(currConn.from);
      const fromCurr = currItemsMap.get(currConn.from);
      const toPrev = prevItemsMap.get(currConn.to);
      const toCurr = currItemsMap.get(currConn.to);
      if (!fromPrev || !fromCurr || !toPrev || !toCurr) continue;

      const fromDx = (fromPrev.x ?? 0) - (fromCurr.x ?? 0);
      const fromDy = (fromPrev.y ?? 0) - (fromCurr.y ?? 0);
      const toDx = (toPrev.x ?? 0) - (toCurr.x ?? 0);
      const toDy = (toPrev.y ?? 0) - (toCurr.y ?? 0);

      const waypointChanged =
        JSON.stringify(prevConn.waypoints ?? null) !== JSON.stringify(currConn.waypoints ?? null) ||
        (prevConn.orthogonalTrunkOffsetX ?? 0) !== (currConn.orthogonalTrunkOffsetX ?? 0) ||
        (prevConn.orthogonalTrunkOffsetY ?? 0) !== (currConn.orthogonalTrunkOffsetY ?? 0);

      if (fromDx === 0 && fromDy === 0 && toDx === 0 && toDy === 0 && !waypointChanged) continue;

      connKeyStyles.set(connKeyVal, {
        opacityStart: 1,
        opacityEnd: 1,
        translateYStart: 0,
        translateYEnd: 0,
        easing: EASE_IN_OUT,
        slideEndpointMove: {
          fromDx,
          fromDy,
          toDx,
          toDy,
          waypointPrev: prevConn.waypoints,
          waypointCurr: currConn.waypoints,
          waypointChanged,
        },
      });
    }

    if (nodeIdStyles.size === 0 && connKeyStyles.size === 0) {
      return;
    }

    const reversePairKeys = buildSlideReversePairKeys(connKeyStyles, prevConnsMap, currConnsMap);

    const baseDelays = buildStaggerDelaysForSlideTransition(
      new Set(nodeIdStyles.keys()),
      new Set(connKeyStyles.keys()),
      currentDiagram,
      previousDiagram,
    );
    const nodeDelayMs = new Map(baseDelays.nodeDelayMs);
    const connectionDelayMs = new Map(baseDelays.connectionDelayMs);

    // Disappearing connections: fade at previous-slide geometry first; endpoints that move wait until fade ends.
    for (const connKeyVal of connKeyStyles.keys()) {
      const prevConn = prevConnsMap.get(connKeyVal);
      const currConn = currConnsMap.get(connKeyVal);
      if (!prevConn || currConn) continue;

      const fadeEnd = (connectionDelayMs.get(connKeyVal) ?? 0) + TRANSITION_DURATION_MS;
      for (const nid of [prevConn.from, prevConn.to]) {
        if (nodeIdStyles.has(nid)) {
          nodeDelayMs.set(nid, Math.max(nodeDelayMs.get(nid) ?? 0, fadeEnd));
        }
      }
    }

    // New connections: start fading in only after both endpoints have finished moving into place.
    for (const connKeyVal of connKeyStyles.keys()) {
      const prevConn = prevConnsMap.get(connKeyVal);
      const currConn = currConnsMap.get(connKeyVal);
      if (!currConn || prevConn) continue;

      const dA = nodeDelayMs.get(currConn.from) ?? 0;
      const dB = nodeDelayMs.get(currConn.to) ?? 0;
      connectionDelayMs.set(connKeyVal, Math.max(dA, dB) + TRANSITION_DURATION_MS);
    }

    let maxStaggerMs = 0;
    for (const v of nodeDelayMs.values()) maxStaggerMs = Math.max(maxStaggerMs, v);
    for (const v of connectionDelayMs.values()) maxStaggerMs = Math.max(maxStaggerMs, v);

    let chartTailMs = 0;
    for (const [nodeId, st] of nodeIdStyles) {
      const pn = prevNodesMap.get(nodeId);
      const cn = currNodesMap.get(nodeId);
      const chartNode =
        cn && isChartNodeType(cn.type) ? cn : pn && isChartNodeType(pn.type) ? pn : null;
      if (!chartNode) continue;
      const nSeg = chartSegmentCountForStagger(chartNode);
      if (nSeg <= 0) continue;
      const useStaggerTail =
        st.isAppearingChart ||
        st.isDisappearingChart ||
        (st.chartPresentationChanged && !st.chartLerpEligible);
      if (!useStaggerTail) continue;
      const base = nodeDelayMs.get(nodeId) ?? 0;
      chartTailMs = Math.max(
        chartTailMs,
        base + (nSeg - 1) * CHART_SLIDE_SEGMENT_STAGGER_MS + TRANSITION_DURATION_MS
      );
    }

    for (const [nodeId, st] of nodeIdStyles) {
      const pn = prevNodesMap.get(nodeId);
      const cn = currNodesMap.get(nodeId);

      let nEnter = 0;
      let nExit = 0;

      if (st.isAppearingTimeline && cn && isTimelineNodeType(cn.type)) {
        nEnter = cn.timelineEntries?.length ?? 0;
      } else if (st.isDisappearingTimeline && pn && isTimelineNodeType(pn.type)) {
        nExit = pn.timelineEntries?.length ?? 0;
      } else if (
        st.timelinePresentationChanged &&
        pn &&
        cn &&
        isTimelineNodeType(pn.type) &&
        isTimelineNodeType(cn.type)
      ) {
        const pE = pn.timelineEntries ?? [];
        const cE = cn.timelineEntries ?? [];
        const cIds = new Set(cE.map((e) => e.id));
        const pIds = new Set(pE.map((e) => e.id));
        nExit = pE.filter((e) => !cIds.has(e.id)).length;
        nEnter = cE.filter((e) => !pIds.has(e.id)).length;
      }

      if (nEnter === 0 && nExit === 0) continue;

      const base = nodeDelayMs.get(nodeId) ?? 0;
      const stg = CHART_SLIDE_SEGMENT_STAGGER_MS;
      const dur = TRANSITION_DURATION_MS;
      const tailEnter = nEnter > 0 ? base + (nEnter - 1) * stg + dur : 0;
      const tailExit = nExit > 0 ? base + (nExit - 1) * stg + dur : 0;
      chartTailMs = Math.max(chartTailMs, tailEnter, tailExit);
    }

    for (const [nodeId, st] of nodeIdStyles) {
      const pn = prevNodesMap.get(nodeId);
      const cn = currNodesMap.get(nodeId);
      const sectionedNode =
        cn && (isPyramidNodeType(cn.type) || isSegmentedRectangleNodeType(cn.type))
          ? cn
          : pn && (isPyramidNodeType(pn.type) || isSegmentedRectangleNodeType(pn.type))
            ? pn
            : null;
      if (!sectionedNode) continue;
      const nSeg = sectionedShapeSegmentCount(sectionedNode);
      if (nSeg <= 0) continue;
      const useSectionTail =
        st.isAppearingSectionedShape ||
        st.isDisappearingSectionedShape ||
        !!st.sectionedShapePresentationChanged;
      if (!useSectionTail) continue;
      const base = nodeDelayMs.get(nodeId) ?? 0;
      chartTailMs = Math.max(
        chartTailMs,
        base + (nSeg - 1) * CHART_SLIDE_SEGMENT_STAGGER_MS + TRANSITION_DURATION_MS,
      );
    }

    for (const [nodeId, st] of nodeIdStyles) {
      const pn = prevNodesMap.get(nodeId);
      const cn = currNodesMap.get(nodeId);
      const cardNode =
        cn && isCardNodeType(cn.type)
          ? cn
          : pn && isCardNodeType(pn.type)
            ? pn
            : null;
      if (!cardNode) continue;
      const nEl = cardSlideStaggerParticipantCount(cardNode);
      if (nEl <= 0) continue;
      const useCardTail =
        st.isAppearingCard ||
        st.isDisappearingCard ||
        !!st.cardPresentationChanged;
      if (!useCardTail) continue;
      const base = nodeDelayMs.get(nodeId) ?? 0;
      chartTailMs = Math.max(
        chartTailMs,
        base + (nEl - 1) * CHART_SLIDE_SEGMENT_STAGGER_MS + TRANSITION_DURATION_MS,
      );
    }

    /** Longest intrinsic moment (no tail pad): node/conn motion + stagger vs chart/timeline/section tails. */
    const intrinsicMotionMs = Math.max(maxStaggerMs + TRANSITION_DURATION_MS, chartTailMs);
    const slideTimeBudgetMotionMs = Math.max(
      1,
      SLIDE_TRANSITION_TOTAL_BUDGET_MS - SLIDE_TRANSITION_RAF_TAIL_PAD_MS,
    );
    const timeScale = Math.min(1, slideTimeBudgetMotionMs / Math.max(1e-6, intrinsicMotionMs));
    const motionDurationMs = TRANSITION_DURATION_MS * timeScale;
    const segmentStaggerMs = CHART_SLIDE_SEGMENT_STAGGER_MS * timeScale;

    if (timeScale !== 1) {
      for (const [id, ms] of nodeDelayMs) {
        nodeDelayMs.set(id, ms * timeScale);
      }
      for (const [key, ms] of connectionDelayMs) {
        connectionDelayMs.set(key, ms * timeScale);
      }
    }

    const totalDurationMs = timeScale * intrinsicMotionMs + SLIDE_TRANSITION_RAF_TAIL_PAD_MS;

    const nodeDelayFor = (id: string) => nodeDelayMs.get(id) ?? 0;
    const connDelayFor = (key: string) => connectionDelayMs.get(key) ?? 0;

    setAnimatingNodes(nodesToAdd);
    setAnimatingConnections(connsToAdd);

    const newAnimation: SlideAnimation = {
      startTime: performance.now(),
      durationMs: totalDurationMs,
      motionDurationMs,
      segmentStaggerMs,
      nodeIdStyles,
      connKeyStyles,
      connectionDelayMs,
      nodeDelayMs: new Map(nodeDelayMs),
    };

    connectionSlideEffectiveStartRef.current = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        connectionSlideEffectiveStartRef.current = performance.now();
      });
    });

    setAnimations([newAnimation]);

    setNodeStyles((prev) => {
      const next = new Map(prev);
      for (const [nodeId, style] of nodeIdStyles) {
        // Resize-only: no position change, only scale. Use top-left origin so position stays fixed.
        const transformX = style.isResizeOnly ? 0 : style.deltaX;
        const transformY = style.isResizeOnly ? 0 : (style.deltaY + style.translateYStart);

        // Disappearing: start at scale 1 (no scale-up). Moving/resizing/appearing: use width/height lerp.
        let scaleX = 1;
        let scaleY = 1;
        if (style.isDisappearing) {
          scaleX = 1;
          scaleY = 1;
        } else if (
          style.suppressChartOuterScale ||
          style.suppressTimelineOuterMotion ||
          style.suppressSectionedShapeOuterMotion ||
          style.suppressCardOuterMotion
        ) {
          scaleX = 1;
          scaleY = 1;
        } else {
          scaleX = style.widthEnd !== 0 ? style.widthStart / style.widthEnd : 1;
          scaleY = style.heightEnd !== 0 ? style.heightStart / style.heightEnd : 1;
        }

        const needsTransform = transformX !== 0 || transformY !== 0 || scaleX !== 1 || scaleY !== 1;

        let transform = undefined;
        if (needsTransform) {
          const parts = [];
          if (transformX !== 0 || transformY !== 0) {
            parts.push(`translate(${transformX}px, ${transformY}px)`);
          }
          if (scaleX !== 1 || scaleY !== 1) {
            parts.push(`scale(${scaleX}, ${scaleY})`);
          }
          transform = parts.join(' ');
        }

        // Use anchor-aware origin: which edge stayed fixed during resize (prevents position drift)
        // e.g. left edge moved right -> right was anchor -> origin-x 100%
        // center: for appear/disappear (opacity/translateY only, or shrink-to-center)
        const hasScale = scaleX !== 1 || scaleY !== 1;
        const transformOrigin = (hasScale && !style.isDisappearing)
          ? `${style.scaleOriginX ?? '0'} ${style.scaleOriginY ?? '0'}`
          : 'center';

        const dMs0 = nodeDelayFor(nodeId);
        const useChartStagger =
          style.isAppearingChart ||
          !!style.isDisappearingChart ||
          (!!style.chartPresentationChanged && !style.chartLerpEligible);
        const chartSlideStagger: ChartSlideStagger | undefined = useChartStagger
          ? {
              baseDelayMs: dMs0,
              staggerMs: segmentStaggerMs,
              durationMs: motionDurationMs,
              easingCss: EASE_IN_OUT,
              exit: !!style.isDisappearingChart,
            }
          : undefined;

        const useSectionSlideStagger =
          style.isAppearingSectionedShape ||
          !!style.isDisappearingSectionedShape ||
          !!style.sectionedShapePresentationChanged;
        const sectionSlideStagger: ChartSlideStagger | undefined = useSectionSlideStagger
          ? {
              baseDelayMs: dMs0,
              staggerMs: segmentStaggerMs,
              durationMs: motionDurationMs,
              easingCss: EASE_IN_OUT,
              exit: !!style.isDisappearingSectionedShape,
            }
          : undefined;

        const useCardSlideStagger =
          style.isAppearingCard ||
          !!style.isDisappearingCard ||
          !!style.cardPresentationChanged;
        const cardSlideStagger: ChartSlideStagger | undefined = useCardSlideStagger
          ? {
              baseDelayMs: dMs0,
              staggerMs: segmentStaggerMs,
              durationMs: motionDurationMs,
              easingCss: EASE_IN_OUT,
              exit: !!style.isDisappearingCard,
              shellEntrance: !!style.isAppearingCard,
            }
          : undefined;

        const tlCardPatch = computeTimelineCardTransitionStylePatch(
          nodeId,
          style,
          prevNodesMap,
          currNodesMap,
          dMs0,
          segmentStaggerMs,
          motionDurationMs,
        );

        const chartLerpFields =
          style.chartLerpEligible && style.chartLerpFromJson
            ? { chartLerpU: 0, chartLerpFromJson: style.chartLerpFromJson }
            : {};

        if (style.hasVisualColorChange && style.useVisualColorCrossfade) {
          next.set(nodeId, {
            opacity: style.opacityStart,
            transition: 'none',
            transform,
            transformOrigin,
            visualColorCrossfade: {
              from: style.visualColorMergeStart,
              to: style.visualColorMergeEnd,
            },
            visualColorCrossfadeTopOpacity: 0,
            visualColorCrossfadeTopTransition: 'none',
            ...(chartSlideStagger ? { chartSlideStagger } : {}),
            ...(sectionSlideStagger ? { sectionSlideStagger } : {}),
            ...(cardSlideStagger ? { cardSlideStagger } : {}),
            ...tlCardPatch,
            ...chartLerpFields,
          });
        } else {
          next.set(nodeId, {
            opacity: style.opacityStart,
            transition: 'none',
            transform,
            transformOrigin,
            ...(style.hasVisualColorChange ? {
              visualColorMerge: style.visualColorMergeStart,
              visualColorMergeTransition: 'none',
            } : {}),
            ...(chartSlideStagger ? { chartSlideStagger } : {}),
            ...(sectionSlideStagger ? { sectionSlideStagger } : {}),
            ...(cardSlideStagger ? { cardSlideStagger } : {}),
            ...tlCardPatch,
            ...chartLerpFields,
          });
        }
      }
      return next;
    });

    setConnectionStyles((prev) => {
      const next = new Map(prev);
      for (const [connKeyVal, style] of connKeyStyles) {
        const sm = style.slideEndpointMove;
        if (sm) {
          const wpPrev = sm.waypointPrev;
          const wpCurr = sm.waypointCurr;
          const slideWaypointOffsets =
            wpPrev && wpCurr && wpPrev.length === wpCurr.length && wpPrev.length > 0
              ? wpPrev.map((wp: { x: number; y: number }, i: number) => ({
                  dx: wp.x - wpCurr[i].x,
                  dy: wp.y - wpCurr[i].y,
                }))
              : undefined;
          next.set(connKeyVal, {
            opacity: sm.geomLockToPrev ? style.opacityStart : 1,
            transition: 'none',
            slideEndpointOffset: {
              fromDx: sm.fromDx,
              fromDy: sm.fromDy,
              toDx: sm.toDx,
              toDy: sm.toDy,
            },
            slideWaypointOffsets,
            ...slideConnFadeExtras(connKeyVal, style, reversePairKeys),
          });
          continue;
        }

        next.set(connKeyVal, {
          opacity: style.opacityStart,
          transition: 'none',
          ...slideConnFadeExtras(connKeyVal, style, reversePairKeys),
        });
      }
      return next;
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNodeStyles((prev) => {
          const next = new Map(prev);
          for (const [nodeId, style] of nodeIdStyles) {
            const transition = slideMotionTransition(style.easing, motionDurationMs);
            const transformX = 0;
            const transformY =
              style.isDisappearingChart ||
              style.isDisappearingTimeline ||
              style.isDisappearingSectionedShape ||
              style.isDisappearingCard
              ? 0
              : style.isResizeOnly
                ? 0
                : style.translateYEnd;

            const scaleX =
              style.isDisappearing &&
              !style.isDisappearingChart &&
              !style.isDisappearingTimeline &&
              !style.isDisappearingSectionedShape &&
              !style.isDisappearingCard
                ? 0
                : 1;
            const scaleY =
              style.isDisappearing &&
              !style.isDisappearingChart &&
              !style.isDisappearingTimeline &&
              !style.isDisappearingSectionedShape &&
              !style.isDisappearingCard
                ? 0
                : 1;

            const needsTransform = transformX !== 0 || transformY !== 0 || scaleX !== 1 || scaleY !== 1;

            let transform = undefined;
            if (needsTransform) {
              const parts = [];
              if (transformX !== 0 || transformY !== 0) {
                parts.push(`translate(${transformX}px, ${transformY}px)`);
              }
              if (scaleX !== 1 || scaleY !== 1) {
                parts.push(`scale(${scaleX}, ${scaleY})`);
              }
              transform = parts.join(' ');
            }

            const hasScale = scaleX !== 1 || scaleY !== 1;
            const transformOrigin = (hasScale && !style.isDisappearing)
              ? `${style.scaleOriginX ?? '0'} ${style.scaleOriginY ?? '0'}`
              : 'center';

            const dMs = nodeDelayFor(nodeId);
            const useChartStagger =
              style.isAppearingChart ||
              !!style.isDisappearingChart ||
              (!!style.chartPresentationChanged && !style.chartLerpEligible);
            const chartSlideStagger: ChartSlideStagger | undefined = useChartStagger
              ? {
                  baseDelayMs: dMs,
                  staggerMs: segmentStaggerMs,
                  durationMs: motionDurationMs,
                  easingCss: EASE_IN_OUT,
                  exit: !!style.isDisappearingChart,
                }
              : undefined;

            const useSectionSlideStagger =
              style.isAppearingSectionedShape ||
              !!style.isDisappearingSectionedShape ||
              !!style.sectionedShapePresentationChanged;
            const sectionSlideStagger: ChartSlideStagger | undefined = useSectionSlideStagger
              ? {
                  baseDelayMs: dMs,
                  staggerMs: segmentStaggerMs,
                  durationMs: motionDurationMs,
                  easingCss: EASE_IN_OUT,
                  exit: !!style.isDisappearingSectionedShape,
                }
              : undefined;

            const useCardSlideStagger =
              style.isAppearingCard ||
              !!style.isDisappearingCard ||
              !!style.cardPresentationChanged;
            const cardSlideStagger: ChartSlideStagger | undefined = useCardSlideStagger
              ? {
                  baseDelayMs: dMs,
                  staggerMs: segmentStaggerMs,
                  durationMs: motionDurationMs,
                  easingCss: EASE_IN_OUT,
                  exit: !!style.isDisappearingCard,
                  shellEntrance: !!style.isAppearingCard,
                }
              : undefined;

            const tlCardPatch = computeTimelineCardTransitionStylePatch(
              nodeId,
              style,
              prevNodesMap,
              currNodesMap,
              dMs,
              segmentStaggerMs,
              motionDurationMs,
            );

            const chartLerpFields =
              style.chartLerpEligible && style.chartLerpFromJson
                ? { chartLerpU: 0, chartLerpFromJson: style.chartLerpFromJson }
                : {};

            if (style.hasVisualColorChange && style.useVisualColorCrossfade) {
              next.set(nodeId, {
                opacity: style.opacityEnd,
                transition,
                transitionDelayMs: dMs,
                transform,
                transformOrigin,
                visualColorCrossfade: {
                  from: style.visualColorMergeStart,
                  to: style.visualColorMergeEnd,
                },
                visualColorCrossfadeTopOpacity: 0,
                visualColorCrossfadeTopTransition: slideCrossfadeOpacityWithDelay(dMs, motionDurationMs),
                ...(chartSlideStagger ? { chartSlideStagger } : {}),
                ...(sectionSlideStagger ? { sectionSlideStagger } : {}),
                ...(cardSlideStagger ? { cardSlideStagger } : {}),
                ...tlCardPatch,
                ...chartLerpFields,
              });
            } else if (style.hasVisualColorChange) {
              // Keep previous-slide colors but enable transition on paint props; next rAF applies end colors.
              next.set(nodeId, {
                opacity: style.opacityEnd,
                transition,
                transitionDelayMs: dMs,
                transform,
                transformOrigin,
                visualColorMerge: style.visualColorMergeStart,
                visualColorMergeTransition: slideMergeTransitionWithDelay(dMs, motionDurationMs),
                ...(chartSlideStagger ? { chartSlideStagger } : {}),
                ...(sectionSlideStagger ? { sectionSlideStagger } : {}),
                ...(cardSlideStagger ? { cardSlideStagger } : {}),
                ...tlCardPatch,
                ...chartLerpFields,
              });
            } else {
              next.set(nodeId, {
                opacity: style.opacityEnd,
                transition,
                transitionDelayMs: dMs,
                transform,
                transformOrigin,
                ...(chartSlideStagger ? { chartSlideStagger } : {}),
                ...(sectionSlideStagger ? { sectionSlideStagger } : {}),
                ...(cardSlideStagger ? { cardSlideStagger } : {}),
                ...tlCardPatch,
                ...chartLerpFields,
              });
            }
          }
          return next;
        });

        setConnectionStyles((prev) => {
          const next = new Map(prev);
          for (const [connKeyVal, style] of connKeyStyles) {
            const sm = style.slideEndpointMove;
            if (sm) {
              const wpPrev = sm.waypointPrev;
              const wpCurr = sm.waypointCurr;
              const slideWaypointOffsets =
                wpPrev && wpCurr && wpPrev.length === wpCurr.length && wpPrev.length > 0
                  ? wpPrev.map((wp: { x: number; y: number }, i: number) => ({
                      dx: wp.x - wpCurr[i].x,
                      dy: wp.y - wpCurr[i].y,
                    }))
                  : undefined;
              if (sm.geomLockToPrev) {
                const transition = slideConnectionFadeTransition(style.easing, motionDurationMs);
                next.set(connKeyVal, {
                  opacity: style.opacityEnd,
                  transition,
                  transitionDelayMs: connDelayFor(connKeyVal),
                  slideEndpointOffset: {
                    fromDx: sm.fromDx,
                    fromDy: sm.fromDy,
                    toDx: sm.toDx,
                    toDy: sm.toDy,
                  },
                  slideWaypointOffsets,
                  ...slideConnFadeExtras(connKeyVal, style, reversePairKeys),
                });
                continue;
              }
              next.set(connKeyVal, {
                opacity: 1,
                transition: 'none',
                transitionDelayMs: connDelayFor(connKeyVal),
                slideEndpointOffset: {
                  fromDx: sm.fromDx,
                  fromDy: sm.fromDy,
                  toDx: sm.toDx,
                  toDy: sm.toDy,
                },
                slideWaypointOffsets,
              });
              continue;
            }

            const transition = slideConnectionFadeTransition(style.easing, motionDurationMs);

            next.set(connKeyVal, {
              opacity: style.opacityEnd,
              transition,
              transitionDelayMs: connDelayFor(connKeyVal),
              ...slideConnFadeExtras(connKeyVal, style, reversePairKeys),
            });
          }
          return next;
        });

        requestAnimationFrame(() => {
          setNodeStyles((prev) => {
            const next = new Map(prev);
            for (const [nodeId, style] of nodeIdStyles) {
              if (!style.hasVisualColorChange) continue;
              const existing = next.get(nodeId);
              if (!existing) continue;
              const dMs = nodeDelayFor(nodeId);
              if (style.useVisualColorCrossfade) {
                next.set(nodeId, {
                  ...existing,
                  visualColorCrossfade: {
                    from: style.visualColorMergeStart,
                    to: style.visualColorMergeEnd,
                  },
                  visualColorCrossfadeTopOpacity: 1,
                  visualColorCrossfadeTopTransition: slideCrossfadeOpacityWithDelay(dMs, motionDurationMs),
                });
              } else {
                next.set(nodeId, {
                  ...existing,
                  visualColorMerge: style.visualColorMergeEnd,
                  visualColorMergeTransition: slideMergeTransitionWithDelay(dMs, motionDurationMs),
                });
              }
            }
            return next;
          });
        });
      });
    });
  }, [enabled, currentDiagram, previousDiagram]);

  useEffect(() => {
    if (animations.length === 0) {
      connectionSlideEffectiveStartRef.current = null;
      if (connectionGeomRafRef.current !== null) {
        cancelAnimationFrame(connectionGeomRafRef.current);
        connectionGeomRafRef.current = null;
      }
      if (chartLerpRafRef.current !== null) {
        cancelAnimationFrame(chartLerpRafRef.current);
        chartLerpRafRef.current = null;
      }
      return;
    }

    const anim = animations[0];
    const hasGeom = [...anim.connKeyStyles.values()].some(
      (s) => s.slideEndpointMove && !s.slideEndpointMove.geomLockToPrev,
    );
    if (!hasGeom) return;

    const tick = () => {
      const t0 = connectionSlideEffectiveStartRef.current;
      const active = animationsRef.current[0];
      if (!active) return;

      if (t0 == null) {
        connectionGeomRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsed = performance.now() - t0;
      const delays = active.connectionDelayMs;

      setConnectionStyles((prev) => {
        const next = new Map(prev);
        for (const [key, style] of active.connKeyStyles) {
          const sm = style.slideEndpointMove;
          if (!sm || sm.geomLockToPrev) continue;

          const delayMs = delays.get(key) ?? 0;
          const md = active.motionDurationMs;
          const u = Math.max(0, Math.min(1, (elapsed - delayMs) / md));
          const p = easeSlideTransitionInOut(u);

          const wpPrev = sm.waypointPrev;
          const wpCurr = sm.waypointCurr;
          const slideWaypointOffsets =
            wpPrev && wpCurr && wpPrev.length === wpCurr.length && wpPrev.length > 0
              ? wpPrev.map((wp: { x: number; y: number }, i: number) => ({
                  dx: (wp.x - wpCurr[i].x) * (1 - p),
                  dy: (wp.y - wpCurr[i].y) * (1 - p),
                }))
              : undefined;

          next.set(key, {
            opacity: 1,
            transition: 'none',
            slideEndpointOffset: {
              fromDx: sm.fromDx * (1 - p),
              fromDy: sm.fromDy * (1 - p),
              toDx: sm.toDx * (1 - p),
              toDy: sm.toDy * (1 - p),
            },
            slideWaypointOffsets,
          });
        }
        return next;
      });

      if (elapsed < active.durationMs + 50) {
        connectionGeomRafRef.current = requestAnimationFrame(tick);
      } else {
        connectionGeomRafRef.current = null;
      }
    };

    connectionGeomRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (connectionGeomRafRef.current !== null) {
        cancelAnimationFrame(connectionGeomRafRef.current);
        connectionGeomRafRef.current = null;
      }
    };
  }, [animations.length]);

  useEffect(() => {
    if (animations.length === 0) return;

    const anim = animations[0];
    const hasLerp = [...anim.nodeIdStyles.values()].some((s) => s.chartLerpEligible);
    if (!hasLerp) return;

    const tick = () => {
      const t0 = connectionSlideEffectiveStartRef.current;
      const active = animationsRef.current[0];
      if (!active) return;

      if (t0 == null) {
        chartLerpRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsed = performance.now() - t0;
      const nodeDelays = active.nodeDelayMs;

      setNodeStyles((prev) => {
        const next = new Map(prev);
        for (const [nodeId, st] of active.nodeIdStyles) {
          if (!st.chartLerpEligible || !st.chartLerpFromJson) continue;
          const existing = next.get(nodeId);
          if (!existing) continue;
          const delayMs = nodeDelays.get(nodeId) ?? 0;
          const md = active.motionDurationMs;
          const u = Math.max(0, Math.min(1, (elapsed - delayMs) / md));
          const p = easeSlideTransitionInOut(u);
          next.set(nodeId, {
            ...existing,
            chartLerpU: p,
            chartLerpFromJson: st.chartLerpFromJson,
          });
        }
        return next;
      });

      if (elapsed < anim.durationMs + 50) {
        chartLerpRafRef.current = requestAnimationFrame(tick);
      } else {
        chartLerpRafRef.current = null;
      }
    };

    chartLerpRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (chartLerpRafRef.current !== null) {
        cancelAnimationFrame(chartLerpRafRef.current);
        chartLerpRafRef.current = null;
      }
    };
  }, [animations.length]);

  useEffect(() => {
    if (animations.length === 0) return;

    const anim = animations[0];

    const timer = setTimeout(() => {
      setAnimations([]);

      setNodeStyles((prev) => {
        const next = new Map(prev);
        for (const [nodeId, style] of anim.nodeIdStyles) {
          if (style.opacityEnd === 1 && !style.isDisappearing) {
            next.set(nodeId, {
              opacity: 1,
              transition: 'none',
              transitionDelayMs: undefined,
              transform: undefined,
              transformOrigin: undefined,
              visualColorMerge: undefined,
              visualColorMergeTransition: undefined,
              visualColorCrossfade: undefined,
              visualColorCrossfadeTopOpacity: undefined,
              visualColorCrossfadeTopTransition: undefined,
              chartSlideStagger: undefined,
              sectionSlideStagger: undefined,
              cardSlideStagger: undefined,
              timelineSlideStagger: undefined,
              timelineRemoveStagger: undefined,
              timelineRemovedCards: undefined,
              timelineRemovedGhostBase: undefined,
              timelineEnterStaggerOrder: undefined,
              chartLerpU: undefined,
              chartLerpFromJson: undefined,
            });
          }
        }
        return next;
      });

      setConnectionStyles((prev) => {
        const next = new Map(prev);
        for (const [connKeyVal, style] of anim.connKeyStyles) {
          if (style.opacityEnd === 1) {
            next.set(connKeyVal, {
              opacity: 1,
              transition: 'none',
              transitionDelayMs: undefined,
              transform: undefined,
              slideEndpointOffset: undefined,
              slideWaypointOffsets: undefined,
            });
          }
        }
        return next;
      });

      setTimeout(() => {
        setNodeStyles((prev) => {
          const next = new Map(prev);
          for (const [nodeId] of anim.nodeIdStyles) {
            next.delete(nodeId);
          }
          return next;
        });

        setConnectionStyles((prev) => {
          const next = new Map(prev);
          for (const [connKeyVal] of anim.connKeyStyles) {
            next.delete(connKeyVal);
          }
          return next;
        });

        setAnimatingNodes([]);
        setAnimatingConnections([]);
      }, 100);
    }, anim.durationMs + 50);

    return () => clearTimeout(timer);
  }, [animations.length]);

  const animatingDiagramData = useMemo(() => {
    if (animatingNodes.length === 0 && animatingConnections.length === 0) return null;
    const existingNodeIds = new Set((currentDiagram?.nodes || []).map((n) => n.id));
    const extraNodes = animatingNodes.filter((n) => !existingNodeIds.has(n.id));
    const existingConnKeys = new Set((currentDiagram?.connections || []).map((c) => connKey(c)));
    const extraConns = animatingConnections.filter((c) => !existingConnKeys.has(connKey(c)));

    if (extraNodes.length === 0 && extraConns.length === 0) return null;

    return {
      ...currentDiagram,
      nodes: [...(currentDiagram?.nodes || []), ...extraNodes],
      connections: [...(currentDiagram?.connections || []), ...extraConns],
    } as DiagramData;
  }, [currentDiagram, animatingNodes, animatingConnections]);

  return {
    nodeTransitionStyles: nodeStyles,
    connectionTransitionStyles: connectionStyles,
    animatingDiagramData,
    startTransition,
    isTransitioning: animations.length > 0,
    connectionKey: connKey,
  };
}
