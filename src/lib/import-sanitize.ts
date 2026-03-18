import type { DiagramData, DiagramNodeData, DiagramConnectionData, DiagramGroupingData, LayersConfig } from './types';

/** Collects all IDs used in a diagram tree (root + nested subDiagrams) */
export function collectAllIdsInDiagram(root: DiagramData): {
  nodeIds: Set<string>;
  subDiagramKeys: Set<string>;
  groupingIds: Set<string>;
  layerIds: Set<string>;
} {
  const nodeIds = new Set<string>();
  const subDiagramKeys = new Set<string>();
  const groupingIds = new Set<string>();
  const layerIds = new Set<string>();

  function walk(data: DiagramData): void {
    (data.nodes || []).forEach((n) => nodeIds.add(n.id));
    (data.groupings || []).forEach((g) => {
      groupingIds.add(g.id);
      g.memberIds.forEach((id) => nodeIds.add(id));
    });
    data.layers?.layers?.forEach((l) => layerIds.add(l.id));
    if (data.subDiagrams) {
      Object.keys(data.subDiagrams).forEach((k) => subDiagramKeys.add(k));
      Object.values(data.subDiagrams).forEach(walk);
    }
  }

  walk(root);
  return { nodeIds, subDiagramKeys, groupingIds, layerIds };
}

/** Generate a unique ID that doesn't exist in the given set */
function uniqueId(base: string, existing: Set<string>): string {
  let candidate = base;
  let i = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${i}`;
    i++;
  }
  existing.add(candidate);
  return candidate;
}

/**
 * Remaps all IDs in an imported diagram so they don't collide with existing IDs.
 * Use when merging/importing a diagram into a sub-diagram.
 */
export function sanitizeImportedDiagram(
  imported: DiagramData,
  existingIds: {
    nodeIds: Set<string>;
    subDiagramKeys: Set<string>;
    groupingIds: Set<string>;
    layerIds: Set<string>;
  }
): DiagramData {
  const prefix = `imp-${Date.now().toString(36)}-`;
  const nodeMap = new Map<string, string>();
  const subDiagramKeyMap = new Map<string, string>();
  const groupingMap = new Map<string, string>();
  const layerMap = new Map<string, string>();

  const usedNodeIds = new Set(existingIds.nodeIds);
  const usedSubKeys = new Set(existingIds.subDiagramKeys);
  const usedGroupingIds = new Set(existingIds.groupingIds);
  const usedLayerIds = new Set(existingIds.layerIds);

  function mapNodeId(id: string): string {
    let mapped = nodeMap.get(id);
    if (!mapped) {
      mapped = uniqueId(`${prefix}${id.replace(/[^a-zA-Z0-9-]/g, '-')}`, usedNodeIds);
      nodeMap.set(id, mapped);
    }
    return mapped;
  }

  function mapSubDiagramKey(key: string): string {
    let mapped = subDiagramKeyMap.get(key);
    if (!mapped) {
      mapped = uniqueId(`${prefix}sub-${key}`, usedSubKeys);
      subDiagramKeyMap.set(key, mapped);
    }
    return mapped;
  }

  function mapGroupingId(id: string): string {
    let mapped = groupingMap.get(id);
    if (!mapped) {
      mapped = uniqueId(`${prefix}grp-${id}`, usedGroupingIds);
      groupingMap.set(id, mapped);
    }
    return mapped;
  }

  function mapLayerId(id: string): string {
    let mapped = layerMap.get(id);
    if (!mapped) {
      mapped = uniqueId(`${prefix}layer-${id}`, usedLayerIds);
      layerMap.set(id, mapped);
    }
    return mapped;
  }

  function sanitizeDiagram(data: DiagramData): DiagramData {
    const nodes: DiagramNodeData[] = (data.nodes || []).map((n) => {
      const mapped: DiagramNodeData = {
        ...n,
        id: mapNodeId(n.id),
        groupId: n.groupId ? mapGroupingId(n.groupId) : undefined,
        layer: n.layer ? mapLayerId(n.layer) : undefined,
        subDiagramId: n.subDiagramId ? mapSubDiagramKey(n.subDiagramId) : undefined,
      };
      return mapped;
    });

    const connections: DiagramConnectionData[] = (data.connections || []).map((c) => ({
      ...c,
      from: mapNodeId(c.from),
      to: mapNodeId(c.to),
    }));

    const groupings: DiagramGroupingData[] | undefined = data.groupings?.length
      ? data.groupings.map((g) => ({
          ...g,
          id: mapGroupingId(g.id),
          memberIds: g.memberIds.map((id) => mapNodeId(id)),
        }))
      : undefined;

    let layers: LayersConfig | undefined;
    if (data.layers) {
      const layerIdMap = new Map<string, string>();
      data.layers.layers.forEach((l) => {
        layerIdMap.set(l.id, mapLayerId(l.id));
      });
      layers = {
        ...data.layers,
        layers: data.layers.layers.map((l) => ({
          ...l,
          id: layerIdMap.get(l.id) ?? l.id,
        })),
        activeLayerId: layerIdMap.get(data.layers.activeLayerId) ?? data.layers.activeLayerId,
        defaultLayerId: layerIdMap.get(data.layers.defaultLayerId) ?? data.layers.defaultLayerId,
      };
    }

    let subDiagrams: Record<string, DiagramData> | undefined;
    if (data.subDiagrams && Object.keys(data.subDiagrams).length > 0) {
      subDiagrams = {};
      for (const [key, sub] of Object.entries(data.subDiagrams)) {
        const newKey = mapSubDiagramKey(key);
        subDiagrams[newKey] = sanitizeDiagram(sub);
      }
    }

    return {
      nodes,
      connections,
      groupings,
      layers,
      recentColors: data.recentColors,
      subDiagrams,
    };
  }

  return sanitizeDiagram(imported);
}
