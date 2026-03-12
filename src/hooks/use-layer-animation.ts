import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { DiagramData, DiagramNodeData, DiagramConnectionData, LayersConfig } from '@/lib/types';
import { getItemLayer } from '@/lib/layers-utils';

/**
 * Per-element animation style applied as inline styles on nodes / connection <g> wrappers.
 */
export interface LayerAnimationStyle {
  opacity: number;
  transition: string;
  transform?: string;
}

/**
 * Tracks an in-progress layer animation (show or hide).
 */
interface LayerAnimation {
  layerId: string;
  direction: 'show' | 'hide';
  /** Node IDs in stagger order */
  orderedNodeIds: string[];
  /** Connection keys whose source/target is in this layer */
  connectionKeys: string[];
  /** Map: connectionKey -> nodeId it follows (inherits that node's timing) */
  connectionToNode: Map<string, string>;
  startTime: number;
  staggerMs: number;
  fadeDurationMs: number;
  /** True once we've painted the first frame at initial opacity (needed for show) */
  primed: boolean;
}

const FADE_DURATION_MS = 300;
const STAGGER_MS = 80;

/**
 * Build a stable key for a connection (prefers .id, falls back to from->to).
 */
function connKey(conn: DiagramConnectionData): string {
  return (conn as any).id || `${conn.from}\u2192${conn.to}`;
}

export function useLayerAnimation(
  enabled: boolean,
  diagramData: DiagramData,
  layersConfig: LayersConfig,
) {
  const [animations, setAnimations] = useState<LayerAnimation[]>([]);
  const [nodeStyles, setNodeStyles] = useState<Map<string, LayerAnimationStyle>>(new Map());
  const [connectionStyles, setConnectionStyles] = useState<Map<string, LayerAnimationStyle>>(new Map());
  const [fadingOutNodes, setFadingOutNodes] = useState<DiagramNodeData[]>([]);
  const [fadingOutConns, setFadingOutConns] = useState<DiagramConnectionData[]>([]);

  const rafRef = useRef<number | null>(null);
  const animationsRef = useRef<LayerAnimation[]>([]);
  animationsRef.current = animations;

  // Keep a snapshot of the FULL (unfiltered) diagram data so we can find
  // connections for nodes that are about to be hidden/shown.
  const snapshotRef = useRef<DiagramData>(diagramData);

  /**
   * Update the full-data snapshot. Call with the UNFILTERED diagram data
   * so we can find connections for nodes that are about to be shown/hidden.
   */
  const updateSnapshot = useCallback((fullData: DiagramData) => {
    snapshotRef.current = fullData;
  }, []);

  /**
   * Get ordered node IDs for animation.
   */
  const getOrderedNodeIds = useCallback(
    (layerId: string, direction: 'show' | 'hide', source: DiagramData): string[] => {
      const nodesInLayer = (source.nodes || []).filter(
        (n) => getItemLayer(n) === layerId,
      );
      const ids = nodesInLayer.map((n) => n.id);
      return direction === 'hide' ? [...ids].reverse() : ids;
    },
    [],
  );

  /**
   * Get connections whose from or to node is in the given set.
   * Returns mapping of connectionKey -> tied nodeId.
   */
  const getConnectionsForNodes = useCallback(
    (nodeIdSet: Set<string>, source: DiagramData): {
      keys: string[];
      mapping: Map<string, string>;
      conns: DiagramConnectionData[];
    } => {
      const mapping = new Map<string, string>();
      const keys: string[] = [];
      const conns: DiagramConnectionData[] = [];

      for (const conn of (source.connections || [])) {
        if (nodeIdSet.has(conn.from) || nodeIdSet.has(conn.to)) {
          const key = connKey(conn);
          const tiedTo = nodeIdSet.has(conn.from) ? conn.from : conn.to;
          mapping.set(key, tiedTo);
          keys.push(key);
          conns.push(conn);
        }
      }
      return { keys, mapping, conns };
    },
    [],
  );

  /**
   * Call BEFORE toggling the layer visibility.
   * Returns false if animations are disabled or layer invalid.
   * When an animation is in progress for this layer: returns true (caller should toggle)
   * but does not start a new animation - the current one continues until complete.
   */
  const onLayerVisibilityWillChange = useCallback(
    (layerId: string) => {
      if (!enabled) return false;

      const layer = layersConfig.layers.find((l) => l.id === layerId);
      if (!layer) return false;

      // Animation in progress: allow toggle (return true) but don't start a new anim.
      // The current animation will continue until complete.
      if (animationsRef.current.some((a) => a.layerId === layerId)) return true;

      const direction: 'show' | 'hide' = layer.visible ? 'hide' : 'show';
      const source = snapshotRef.current;
      const orderedNodeIds = getOrderedNodeIds(layerId, direction, source);
      if (orderedNodeIds.length === 0) return false;

      const nodeIdSet = new Set(orderedNodeIds);
      const { keys: cKeys, mapping: cMapping, conns } = getConnectionsForNodes(nodeIdSet, source);

      // --- Set up fading-out snapshots for hide direction ---
      if (direction === 'hide') {
        const nodesInLayer = (source.nodes || []).filter(
          (n) => getItemLayer(n) === layerId,
        );

        setFadingOutNodes((prev) => {
          const ids = new Set(nodesInLayer.map((n) => n.id));
          return [...prev.filter((n) => !ids.has(n.id)), ...nodesInLayer];
        });

        setFadingOutConns((prev) => {
          const ids = new Set(cKeys);
          return [...prev.filter((c) => !ids.has(connKey(c))), ...conns];
        });
      }

      // --- Queue the new animation ---
      setAnimations((prev) => [
        ...prev,
        {
          layerId,
          direction,
          orderedNodeIds,
          connectionKeys: cKeys,
          connectionToNode: cMapping,
          startTime: performance.now(),
          staggerMs: STAGGER_MS,
          fadeDurationMs: FADE_DURATION_MS,
          primed: false,
        },
      ]);

      const initialOpacity = direction === 'show' ? 0 : 1;
      const initialNodeStyle: LayerAnimationStyle = {
        opacity: initialOpacity,
        transition: 'none',
        transform: direction === 'show' ? 'translateY(30px)' : 'translateY(0px)',
      };
      const initialConnStyle: LayerAnimationStyle = {
        opacity: initialOpacity,
        transition: 'none',
      };

      setNodeStyles((prev) => {
        const next = new Map(prev);
        for (const nodeId of orderedNodeIds) next.set(nodeId, initialNodeStyle);
        return next;
      });

      setConnectionStyles((prev) => {
        const next = new Map(prev);
        for (const key of cKeys) next.set(key, initialConnStyle);
        return next;
      });

      return true;
    },
    [enabled, layersConfig, getOrderedNodeIds, getConnectionsForNodes],
  );

  // When a show animation is running and the layer was toggled to hidden
  // (diagramData no longer has those nodes), add them to fadingOutNodes so
  // animatingDiagramData keeps them visible until the show anim completes.
  useEffect(() => {
    const source = snapshotRef.current;
    const existingIds = new Set((diagramData.nodes || []).map((n) => n.id));
    const existingConnKeys = new Set((diagramData.connections || []).map((c) => connKey(c)));

    for (const anim of animationsRef.current) {
      if (anim.direction !== 'show') continue;
      const missing = anim.orderedNodeIds.filter((id) => !existingIds.has(id));
      if (missing.length === 0) continue;
      const nodesInLayer = (source.nodes || []).filter((n) => getItemLayer(n) === anim.layerId);
      const conns = (source.connections || []).filter(
        (c) => anim.connectionKeys.includes(connKey(c)),
      );
      setFadingOutNodes((prev) => {
        const ids = new Set(nodesInLayer.map((n) => n.id));
        return [...prev.filter((n) => !ids.has(n.id)), ...nodesInLayer];
      });
      setFadingOutConns((prev) => {
        const keys = new Set(conns.map((c) => connKey(c)));
        return [...prev.filter((c) => !keys.has(connKey(c))), ...conns];
      });
      break;
    }
  }, [diagramData, animations]);

  const computeStyle = (
    anim: LayerAnimation,
    staggerIndex: number,
    elapsed: number,
    forNode: boolean,
  ): { style: LayerAnimationStyle; done: boolean } => {
    const nodeStart = staggerIndex * anim.staggerMs;
    const nodeEnd = nodeStart + anim.fadeDurationMs;
    const targetOpacity = anim.direction === 'show' ? 1 : 0;
    const holdOpacity = anim.direction === 'show' ? 0 : 1;

    const easing = anim.direction === 'show'
      ? 'cubic-bezier(0.0, 0.0, 0.2, 1)'
      : 'cubic-bezier(0.4, 0.0, 1, 1)';
    
    const dur = anim.fadeDurationMs;
    const transition = forNode
      ? `opacity ${dur}ms ${easing}, transform ${dur}ms ${easing}`
      : `opacity ${dur}ms ${easing}`;

    const holdTransform = anim.direction === 'show' ? 'translateY(30px)' : 'translateY(0px)';
    const targetTransform = anim.direction === 'show' ? 'translateY(0px)' : 'translateY(30px)';

    if (elapsed < nodeStart) {
      return {
        style: { opacity: holdOpacity, transition, ...(forNode && { transform: holdTransform }) },
        done: false,
      };
    } else if (elapsed >= nodeEnd) {
      return {
        style: { opacity: targetOpacity, transition, ...(forNode && { transform: targetTransform }) },
        done: true,
      };
    } else {
      return {
        style: { opacity: targetOpacity, transition, ...(forNode && { transform: targetTransform }) },
        done: false,
      };
    }
  };

  // When a show animation is running and the layer was toggled hidden (user clicked during anim),
  // diagramData no longer has those nodes. Keep them in fadingOutNodes so animatingDiagramData
  // continues to render them until the show animation completes.
  useEffect(() => {
    const showAnims = animationsRef.current.filter((a) => a.direction === 'show');
    if (showAnims.length === 0) return;

    const existingIds = new Set((diagramData.nodes || []).map((n) => n.id));
    const source = snapshotRef.current;

    for (const anim of showAnims) {
      const nodesInLayer = (source.nodes || []).filter((n) => getItemLayer(n) === anim.layerId);
      const missing = nodesInLayer.filter((n) => !existingIds.has(n.id));
      if (missing.length === 0) continue;

      const conns = (source.connections || []).filter(
        (c) => missing.some((n) => n.id === c.from || n.id === c.to),
      );

      setFadingOutNodes((prev) => {
        const ids = new Set(missing.map((n) => n.id));
        return [...prev.filter((n) => !ids.has(n.id)), ...missing];
      });
      setFadingOutConns((prev) => {
        const keys = new Set(conns.map((c) => connKey(c)));
        return [...prev.filter((c) => !keys.has(connKey(c))), ...conns];
      });
      break; // one layer at a time
    }
  }, [diagramData.nodes, animations]);

  useEffect(() => {
    if (animations.length === 0) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let frameCount = 0;

    const tick = () => {
      frameCount++;
      const now = performance.now();
      let anyActive = false;
      const completedLayers: string[] = [];

      for (const anim of animationsRef.current) {
        if (!anim.primed && frameCount >= 1) {
          anim.primed = true;
          anim.startTime = now;
        }
      }

      if (frameCount < 2) anyActive = true;

      setNodeStyles((prev) => {
        const next = new Map(prev);
        for (const anim of animationsRef.current) {
          if (!anim.primed) { anyActive = true; continue; }
          const elapsed = now - anim.startTime;
          let allDone = true;

          for (let i = 0; i < anim.orderedNodeIds.length; i++) {
            const { style, done } = computeStyle(anim, i, elapsed, true);
            next.set(anim.orderedNodeIds[i], style);
            if (!done) { allDone = false; anyActive = true; }
          }
          if (allDone) completedLayers.push(anim.layerId);
        }
        return next;
      });

      setConnectionStyles((prev) => {
        const next = new Map(prev);
        for (const anim of animationsRef.current) {
          if (!anim.primed) continue;
          const elapsed = now - anim.startTime;
          for (const ck of anim.connectionKeys) {
            const tiedNodeId = anim.connectionToNode.get(ck);
            if (!tiedNodeId) continue;
            const nodeIdx = anim.orderedNodeIds.indexOf(tiedNodeId);
            if (nodeIdx === -1) continue;
            const { style } = computeStyle(anim, nodeIdx, elapsed, false);
            next.set(ck, style);
          }
        }
        return next;
      });

      if (completedLayers.length > 0) {
        setAnimations((prev) => prev.filter((a) => !completedLayers.includes(a.layerId)));
        const doneNodeIds = new Set<string>();
        const doneConnKeys = new Set<string>();
        const doneDirections = new Map<string, 'show' | 'hide'>();
        
        for (const anim of animationsRef.current) {
          if (completedLayers.includes(anim.layerId)) {
            for (const id of anim.orderedNodeIds) {
              doneNodeIds.add(id);
              doneDirections.set(id, anim.direction);
            }
            for (const k of anim.connectionKeys) {
              doneConnKeys.add(k);
              doneDirections.set(k, anim.direction);
            }
          }
        }
        
        setNodeStyles((prev) => {
          const next = new Map(prev);
          for (const id of doneNodeIds) {
            const dir = doneDirections.get(id);
            next.set(id, {
              opacity: dir === 'show' ? 1 : 0,
              transition: 'none',
              transform: dir === 'show' ? 'translateY(0px)' : 'translateY(30px)',
            });
          }
          return next;
        });

        setConnectionStyles((prev) => {
          const next = new Map(prev);
          for (const k of doneConnKeys) {
            const dir = doneDirections.get(k);
            next.set(k, { opacity: dir === 'show' ? 1 : 0, transition: 'none' });
          }
          return next;
        });

        requestAnimationFrame(() => {
          setNodeStyles((prev) => {
            const next = new Map(prev);
            for (const id of doneNodeIds) next.delete(id);
            return next;
          });
          setConnectionStyles((prev) => {
            const next = new Map(prev);
            for (const k of doneConnKeys) next.delete(k);
            return next;
          });
          setFadingOutNodes((prev) => prev.filter((n) => !doneNodeIds.has(n.id)));
          setFadingOutConns((prev) => prev.filter((c) => !doneConnKeys.has(connKey(c))));
        });
      }

      if (anyActive) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [animations.length]);

  // When a show animation is running and the layer was toggled hidden (user clicked during anim),
  // diagramData no longer has these nodes. Keep them in fadingOutNodes so they stay visible
  // until the show animation completes.
  useEffect(() => {
    const source = snapshotRef.current;
    const showAnims = animationsRef.current.filter((a) => a.direction === 'show');
    if (showAnims.length === 0) return;
    const existingIds = new Set((diagramData.nodes || []).map((n) => n.id));
    const existingConnKeys = new Set((diagramData.connections || []).map((c) => connKey(c)));
    let shouldUpdate = false;
    const nodesToAdd: DiagramNodeData[] = [];
    const connsToAdd: DiagramConnectionData[] = [];
    for (const anim of showAnims) {
      for (const nodeId of anim.orderedNodeIds) {
        if (!existingIds.has(nodeId)) {
          const node = (source.nodes || []).find((n) => n.id === nodeId);
          if (node) {
            nodesToAdd.push(node);
            shouldUpdate = true;
          }
        }
      }
      for (const ck of anim.connectionKeys) {
        if (!existingConnKeys.has(ck)) {
          const conn = (source.connections || []).find(
            (c) => connKey(c) === ck,
          );
          if (conn) {
            connsToAdd.push(conn);
            shouldUpdate = true;
          }
        }
      }
    }
    if (shouldUpdate) {
      setFadingOutNodes((prev) => {
        const nextIds = new Set(nodesToAdd.map((n) => n.id));
        const merged = [...prev.filter((n) => !nextIds.has(n.id)), ...nodesToAdd];
        return merged.length > 0 ? merged : prev;
      });
      setFadingOutConns((prev) => {
        const nextKeys = new Set(connsToAdd.map((c) => connKey(c)));
        const merged = [...prev.filter((c) => !nextKeys.has(connKey(c))), ...connsToAdd];
        return merged.length > 0 ? merged : prev;
      });
    }
  }, [animations, diagramData.nodes, diagramData.connections]);

  const animatingDiagramData = useMemo(() => {
    if (fadingOutNodes.length === 0 && fadingOutConns.length === 0) return null;
    const existingNodeIds = new Set((diagramData.nodes || []).map((n) => n.id));
    const extraNodes = fadingOutNodes.filter((n) => !existingNodeIds.has(n.id));
    const existingConnKeys = new Set((diagramData.connections || []).map((c) => connKey(c)));
    const extraConns = fadingOutConns.filter((c) => !existingConnKeys.has(connKey(c)));

    if (extraNodes.length === 0 && extraConns.length === 0) return null;

    return {
      ...diagramData,
      nodes: [...(diagramData.nodes || []), ...extraNodes],
      connections: [...(diagramData.connections || []), ...extraConns],
    } as DiagramData;
  }, [diagramData, fadingOutNodes, fadingOutConns]);

  return {
    nodeAnimationStyles: nodeStyles,
    connectionAnimationStyles: connectionStyles,
    animatingDiagramData,
    onLayerVisibilityWillChange,
    updateSnapshot,
    isAnimating: animations.length > 0,
    connectionKey: connKey,
  };
}