import type { DiagramData, DiagramNodeData, DiagramConnectionData, DiagramGroupingData, LayersConfig } from './types';

/** Zone-like structure for parsing - supports both flat (children as IDs) and nested (children as objects) */
interface ParsedZone {
  id: string;
  type?: string;
  children: (string | { id: string; type?: string; x?: number; y?: number; [k: string]: unknown })[];
  x?: number;
  y?: number;
  parentId?: string;
  [k: string]: unknown;
}

/** Raw diagram data as parsed from JSON - may include zones */
export interface RawDiagramData {
  nodes?: DiagramNodeData[];
  connections?: DiagramConnectionData[];
  zones?: ParsedZone[] | { id: string; children: string[]; x?: number; y?: number; parentId?: string; [k: string]: unknown }[];
  groupings?: DiagramGroupingData[];
  layers?: unknown;
  [k: string]: unknown;
}

/**
 * Flatten diagram data: if zones exist, extract all nodes with computed absolute positions
 * and discard zones. Connections/groupings referencing zone IDs are filtered out.
 * Use when importing JSON that may contain the legacy zones feature.
 */
export function flattenDiagramOnImport(raw: RawDiagramData): DiagramData {
  if (!raw.zones || !Array.isArray(raw.zones) || raw.zones.length === 0) {
    return normalizeDiagramData(raw);
  }

  const nodeMap = new Map<string, DiagramNodeData>(
    (raw.nodes || []).map(n => [n.id, { ...n }])
  );
  raw.zones.forEach((z: ParsedZone) => {
    (z.children || []).forEach((child: unknown) => {
      if (typeof child === 'object' && child !== null && 'id' in (child as object)) {
        const obj = child as Record<string, unknown> & { id: string; type?: string };
        if (obj.type !== 'zone' && !nodeMap.has(obj.id)) {
          nodeMap.set(obj.id, obj as unknown as DiagramNodeData);
        }
      }
    });
  });
  const zoneMap = new Map<string, ParsedZone>();
  raw.zones.forEach(z => {
    const zone = z as ParsedZone;
    zoneMap.set(zone.id, zone);
  });

  const allChildIds = new Set<string>();
  raw.zones.forEach((z: ParsedZone) => {
    if (z.id === 'orphan-nodes') return;
    (z.children || []).forEach((child: unknown) => {
      const id = typeof child === 'object' && child !== null && 'id' in (child as object)
        ? (child as { id: string }).id
        : String(child);
      allChildIds.add(id);
    });
  });

  const flatNodes: DiagramNodeData[] = [];
  const processedNodeIds = new Set<string>();

  function collectNodesFromZone(
    zone: ParsedZone,
    parentOffset: { x: number; y: number }
  ): void {
    const zoneX = (zone.x ?? 0) + parentOffset.x;
    const zoneY = (zone.y ?? 0) + parentOffset.y;

    (zone.children || []).forEach((child: unknown) => {
      if (typeof child === 'object' && child !== null && 'id' in (child as object)) {
        const obj = child as { id: string; type?: string; x?: number; y?: number; [k: string]: unknown };
        const node = nodeMap.get(obj.id);
        if (node && !processedNodeIds.has(obj.id)) {
          processedNodeIds.add(obj.id);
          const absX = zoneX + (obj.x ?? 0);
          const absY = zoneY + (obj.y ?? 0);
          flatNodes.push({ ...node, x: absX, y: absY });
        } else if (obj.type === 'zone') {
          const childZone = zoneMap.get(obj.id);
          if (childZone) {
            collectNodesFromZone(childZone, { x: zoneX, y: zoneY });
          }
        }
      } else {
        const id = String(child);
        const node = nodeMap.get(id);
        const childZone = zoneMap.get(id);
        if (node && !processedNodeIds.has(id)) {
          processedNodeIds.add(id);
          flatNodes.push({
            ...node,
            x: (node.x ?? 0) + zoneX,
            y: (node.y ?? 0) + zoneY
          });
        } else if (childZone) {
          collectNodesFromZone(childZone, { x: zoneX, y: zoneY });
        }
      }
    });
  }

  raw.zones.forEach((z: ParsedZone) => {
    if (z.parentId) return;
    if (z.id === 'orphan-nodes') {
      (z.children || []).forEach((child: unknown) => {
        if (typeof child === 'object' && child !== null && 'id' in (child as object)) {
          const obj = child as { id: string; x?: number; y?: number; [k: string]: unknown };
          const node = nodeMap.get(obj.id);
          if (node && !processedNodeIds.has(obj.id)) {
            processedNodeIds.add(obj.id);
            flatNodes.push({ ...node, x: obj.x ?? node.x, y: obj.y ?? node.y });
          }
        }
      });
      return;
    }
    collectNodesFromZone(z, { x: 0, y: 0 });
  });

  const orphanNodes = (raw.nodes || []).filter(
    n => !allChildIds.has(n.id) && n.type !== 'zone'
  );
  orphanNodes.forEach(n => {
    if (!processedNodeIds.has(n.id)) {
      processedNodeIds.add(n.id);
      flatNodes.push({ ...n });
    }
  });

  const zoneIds = new Set(raw.zones.map((z: ParsedZone) => z.id));
  const connections = (raw.connections || []).filter(
    c => !zoneIds.has(c.from) && !zoneIds.has(c.to)
  );

  const groupings = (raw.groupings || []).map(g => ({
    ...g,
    memberIds: g.memberIds.filter(id => !zoneIds.has(id))
  })).filter(g => g.memberIds.length > 0);

  return {
    nodes: flatNodes,
    connections,
    groupings: groupings.length > 0 ? groupings : undefined,
    layers: raw.layers as LayersConfig | undefined,
    recentColors: raw.recentColors as string[] | undefined,
    subDiagrams: raw.subDiagrams as Record<string, DiagramData> | undefined,
    viewState: raw.viewState as DiagramData['viewState'],
  };
}

/** Normalize diagram data when no zones are present */
function normalizeDiagramData(raw: RawDiagramData): DiagramData {
  return {
    nodes: raw.nodes || [],
    connections: raw.connections || [],
    groupings: raw.groupings,
    layers: raw.layers as LayersConfig | undefined,
    recentColors: raw.recentColors as string[] | undefined,
    subDiagrams: raw.subDiagrams as Record<string, DiagramData> | undefined,
    viewState: raw.viewState as DiagramData['viewState'],
  };
}
