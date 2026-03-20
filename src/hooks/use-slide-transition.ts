import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { DiagramData, DiagramNodeData, DiagramConnectionData } from '@/lib/types';
import { extractVisualColorFields, visualColorNeedsCrossfade, visualColorSignature } from '@/lib/slide-visual-color';
import { buildStaggerDelaysForSlideTransition } from '@/lib/slide-transition-order';

export interface SlideTransitionStyle {
  opacity: number;
  transition: string;
  /** Stagger start (ms) — matches canvas stack order (back → front), same idea as layer animations. */
  transitionDelayMs?: number;
  transform?: string | undefined;
  transformOrigin?: string;
  visualColorMerge?: Record<string, unknown>;
  visualColorMergeTransition?: string;
  /** Stack "from" and "to" visual fields and animate top layer opacity (gradients). */
  visualColorCrossfade?: { from: Record<string, unknown>; to: Record<string, unknown> };
  visualColorCrossfadeTopOpacity?: number;
  visualColorCrossfadeTopTransition?: string;
}

interface SlideAnimation {
  startTime: number;
  durationMs: number;
  nodeIdStyles: Map<string, {
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
  }>;
  connKeyStyles: Map<string, {
    opacityStart: number;
    opacityEnd: number;
    translateYStart: number;
    translateYEnd: number;
    easing: string;
  }>;
}

const TRANSITION_DURATION_MS = 300;
const EASE_OUT = 'cubic-bezier(0.0, 0.0, 0.2, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0.0, 1, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.4, 0.0, 0.2, 1)';

function slideMergeTransitionWithDelay(delayMs: number): string {
  const t = TRANSITION_DURATION_MS;
  const e = 'cubic-bezier(0.4, 0, 0.2, 1)';
  const d = delayMs;
  return `background ${t}ms ${e} ${d}ms, background-color ${t}ms ${e} ${d}ms, border-color ${t}ms ${e} ${d}ms, color ${t}ms ${e} ${d}ms, fill ${t}ms ${e} ${d}ms, stroke ${t}ms ${e} ${d}ms`;
}

function slideCrossfadeOpacityWithDelay(delayMs: number): string {
  return `opacity ${TRANSITION_DURATION_MS}ms ${EASE_IN_OUT} ${delayMs}ms`;
}

function connKey(conn: DiagramConnectionData): string {
  return (conn as any).id || `${conn.from}\u2192${conn.to}`;
}

/** Line nodes use startPos/endPos; compare when both slides have a line node. */
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

  const rafRef = useRef<number | null>(null);
  const animationsRef = useRef<SlideAnimation[]>([]);
  animationsRef.current = animations;

  const startTransition = useCallback(() => {
    if (!enabled || !currentDiagram || !previousDiagram) return;

    const prevNodesMap = new Map((previousDiagram.nodes || []).map(n => [n.id, n]));
    const currNodesMap = new Map((currentDiagram.nodes || []).map(n => [n.id, n]));
    const prevConnsMap = new Map((previousDiagram.connections || []).map(c => [connKey(c), c]));
    const currConnsMap = new Map((currentDiagram.connections || []).map(c => [connKey(c), c]));

    const nodeIdStyles = new Map<string, any>();
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

      const isAppearing = !prevNode && currNode;
      const isDisappearing = prevNode && !currNode;
      const isMoving = Boolean(
        prevNode &&
          currNode &&
          (prevX !== currX ||
            prevY !== currY ||
            !lineEndpointsEqual(prevNode, currNode) ||
            (prevNode.rotation ?? 0) !== (currNode.rotation ?? 0)),
      );

      const opacityStart = isAppearing ? 0 : 1;
      const opacityEnd = isDisappearing ? 0 : 1;

      const deltaX = isMoving ? (prevX - currX) : 0;
      const deltaY = isMoving ? (prevY - currY) : 0;

      const translateYStart = isAppearing ? 30 : 0;
      const translateYEnd = isDisappearing ? 30 : 0;

      const easing = isAppearing ? EASE_OUT : (isDisappearing ? EASE_IN : EASE_IN_OUT);

      const isResizeOnly = prevNode && currNode && !isMoving && (prevWidth !== currWidth || prevHeight !== currHeight);

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

      const needsNodeTransition =
        isAppearing || isDisappearing || isMoving || isResizeOnly || hasVisualColorChange;

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
 
      const translateYStart = isAppearing ? 30 : 0;
      const translateYEnd = isDisappearing ? 30 : 0;

      const easing = isAppearing ? EASE_OUT : (isDisappearing ? EASE_IN : EASE_IN_OUT);

      const needsConnTransition = isAppearing || isDisappearing;
      if (!needsConnTransition) continue;

      connKeyStyles.set(connKeyVal, {
        opacityStart,
        opacityEnd,
        translateYStart,
        translateYEnd,
        easing,
      });

      if (isDisappearing) {
        connsToAdd.push(prevConn);
      }
    }

    if (nodeIdStyles.size === 0 && connKeyStyles.size === 0) {
      return;
    }

    const { nodeDelayMs, connectionDelayMs, maxStaggerMs } = buildStaggerDelaysForSlideTransition(
      new Set(nodeIdStyles.keys()),
      new Set(connKeyStyles.keys()),
      currentDiagram,
      previousDiagram,
    );
    const nodeDelayFor = (id: string) => nodeDelayMs.get(id) ?? 0;
    const connDelayFor = (key: string) => connectionDelayMs.get(key) ?? 0;
    const totalDurationMs = maxStaggerMs + TRANSITION_DURATION_MS + 50;

    setAnimatingNodes(nodesToAdd);
    setAnimatingConnections(connsToAdd);

    const newAnimation: SlideAnimation = {
      startTime: performance.now(),
      durationMs: totalDurationMs,
      nodeIdStyles,
      connKeyStyles,
    };

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
          });
        }
      }
      return next;
    });

    setConnectionStyles((prev) => {
      const next = new Map(prev);
      for (const [connKeyVal, style] of connKeyStyles) {
        const transformY = style.translateYStart;

        const transform = transformY !== 0
          ? `translateY(${transformY}px)`
          : undefined;

        next.set(connKeyVal, {
          opacity: style.opacityStart,
          transition: 'none',
          transform,
        });
      }
      return next;
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNodeStyles((prev) => {
          const next = new Map(prev);
          for (const [nodeId, style] of nodeIdStyles) {
            const transition = `all ${TRANSITION_DURATION_MS}ms ${style.easing}`;
            const transformX = 0;
            const transformY = style.isResizeOnly ? 0 : style.translateYEnd;

            const scaleX = style.isDisappearing ? 0 : 1;
            const scaleY = style.isDisappearing ? 0 : 1;

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
                visualColorCrossfadeTopTransition: slideCrossfadeOpacityWithDelay(dMs),
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
                visualColorMergeTransition: slideMergeTransitionWithDelay(dMs),
              });
            } else {
              next.set(nodeId, {
                opacity: style.opacityEnd,
                transition,
                transitionDelayMs: dMs,
                transform,
                transformOrigin,
              });
            }
          }
          return next;
        });

        setConnectionStyles((prev) => {
          const next = new Map(prev);
          for (const [connKeyVal, style] of connKeyStyles) {
            const transition = `all ${TRANSITION_DURATION_MS}ms ${style.easing}`;
            const transformY = style.translateYEnd;

            const transform = transformY !== 0
              ? `translateY(${transformY}px)`
              : undefined;

            next.set(connKeyVal, {
              opacity: style.opacityEnd,
              transition,
              transitionDelayMs: connDelayFor(connKeyVal),
              transform,
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
                  visualColorCrossfadeTopTransition: slideCrossfadeOpacityWithDelay(dMs),
                });
              } else {
                next.set(nodeId, {
                  ...existing,
                  visualColorMerge: style.visualColorMergeEnd,
                  visualColorMergeTransition: slideMergeTransitionWithDelay(dMs),
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
    if (animations.length === 0) return;

    const anim = animations[0];

    const timer = setTimeout(() => {
      setAnimations([]);

      setNodeStyles((prev) => {
        const next = new Map(prev);
        for (const [nodeId, style] of anim.nodeIdStyles) {
          if (style.opacityEnd === 1) {
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
