import dagre from "@dagrejs/dagre";
import { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData, DiagramGroupingData } from "./types";
import { measureNodeDims, PositionedNode } from "../components/editor/canvas-constants";

// Layout Constants
const MIN_NODE_SPACING = 60;
const LAYER_SPACING = 100;
const ZONE_PADDING = 40;
const COMPONENT_SPACING = 80;
const GRID_COLS_SQRT_FACTOR = 1.4;
/** Horizontal offset for alternating ranks when layout is a thin vertical chain (one node per rank). */
const CHAIN_ZIGZAG_OFFSET = 120;

interface LayoutItem {
  id: string;
  type: 'node' | 'zone' | 'grouping';
  width: number;
  height: number;
  x: number;
  y: number;
  originalX?: number;
  originalY?: number;
  data: DiagramNodeData | DiagramZoneData | DiagramGroupingData;
}

interface GraphEdge {
  from: string;
  to: string;
}

// Helper for randomness
function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

interface ComponentLayoutBox {
    items: LayoutItem[];
    width: number;
    height: number;
}

/** Pack disconnected graph components in a grid instead of a single shelf row (avoids one long line). */
function packComponentsInGrid(componentLayouts: ComponentLayoutBox[]): { width: number; height: number } {
    if (componentLayouts.length === 0) return { width: 0, height: 0 };
    if (componentLayouts.length === 1) {
        const c = componentLayouts[0];
        return { width: c.width, height: c.height };
    }

    const n = componentLayouts.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * GRID_COLS_SQRT_FACTOR)));
    const rows: ComponentLayoutBox[][] = [];
    for (let i = 0; i < n; i += cols) {
        rows.push(componentLayouts.slice(i, i + cols));
    }

    const rowHeights: number[] = [];
    const rowWidths: number[] = [];
    rows.forEach(rowComps => {
        const rowW =
            rowComps.reduce((s, c) => s + c.width + COMPONENT_SPACING, 0) -
            (rowComps.length > 0 ? COMPONENT_SPACING : 0);
        const rowH = Math.max(...rowComps.map(c => c.height), 0);
        rowWidths.push(rowW);
        rowHeights.push(rowH);
    });

    const maxGridW = Math.max(0, ...rowWidths);

    let yOff = 0;
    rows.forEach((rowComps, rowIdx) => {
        const rowH = rowHeights[rowIdx];
        const rowW = rowWidths[rowIdx];
        let xOff = (maxGridW - rowW) / 2;
        rowComps.forEach(comp => {
            comp.items.forEach(item => {
                item.x += xOff;
                item.y += yOff;
            });
            xOff += comp.width + COMPONENT_SPACING;
        });
        yOff += rowH + COMPONENT_SPACING;
    });

    const totalHeight = yOff > 0 ? yOff - COMPONENT_SPACING : 0;
    return { width: maxGridW, height: totalHeight };
}

/**
 * Main entry point for Auto Layout
 */
export function performAutoLayout(data: DiagramData): DiagramData {
  // Deep copy to avoid mutating original while processing
  const newData: DiagramData = JSON.parse(JSON.stringify(data));
  
  // 1. Build a map of all items for easy access
  const itemMap = new Map<string, LayoutItem>();
  
  newData.nodes.forEach(node => {
    const dims = measureNodeDims(node as PositionedNode);
    itemMap.set(node.id, {
      id: node.id,
      type: 'node',
      width: dims.width,
      height: dims.height,
      x: 0,
      y: 0,
      data: node
    });
  });
  
  (newData.zones ?? []).forEach(zone => {
    // Initial size, will be updated by recursive layout
    itemMap.set(zone.id, {
      id: zone.id,
      type: 'zone',
      width: 300, // Default, will be calculated
      height: 200,
      x: 0,
      y: 0,
      data: zone
    });
  });

  // 2. Identify hierarchy
  // Map parentId -> children IDs
  const hierarchy = new Map<string, string[]>();
  const allChildIds = new Set<string>();
  const itemToGroupingId = new Map<string, string>();
  
  (newData.zones ?? []).forEach(zone => {
    hierarchy.set(zone.id, [...zone.children]);
    zone.children.forEach(childId => allChildIds.add(childId));
  });

  (newData.groupings || []).forEach(group => {
      group.memberIds.forEach(memberId => {
          itemToGroupingId.set(memberId, group.id);
      });
  });
  
  // Root items are those not in any zone
  let rootItems = [
    ...newData.nodes.filter(n => !allChildIds.has(n.id)).map(n => n.id),
    ...(newData.zones ?? []).filter(z => !allChildIds.has(z.id)).map(z => z.id)
  ];
  
  // Randomize root items order to produce variety in layout
  rootItems = shuffleArray(rootItems);

  // Helper to calculate bounding box of a zone based on its children
  const calculateZoneDimensions = (zoneId: string): { width: number, height: number } => {
    const zone = (newData.zones ?? []).find(z => z.id === zoneId);
    if (!zone) return { width: 300, height: 200 };

    // If sizeMode is custom, use explicit dimensions
    if (zone.sizeMode === 'custom' && zone.width && zone.height) {
        return { width: zone.width, height: zone.height };
    }

    // Otherwise, calculate from children
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasChildren = false;

    const processChild = (childId: string) => {
        const childNode = newData.nodes.find(n => n.id === childId);
        if (childNode) {
            hasChildren = true;
            const dims = measureNodeDims(childNode as PositionedNode);
            const x = childNode.x || 0;
            const y = childNode.y || 0;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + dims.width);
            maxY = Math.max(maxY, y + dims.height);
            return;
        }

        const childZone = (newData.zones ?? []).find(z => z.id === childId);
        if (childZone) {
            hasChildren = true;
            // Recursively calculate dimensions for child zone
            const dims = calculateZoneDimensions(childId);
            const x = childZone.x || 0;
            const y = childZone.y || 0;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + dims.width);
            maxY = Math.max(maxY, y + dims.height);
        }
    };

    zone.children.forEach(processChild);

    if (!hasChildren) {
        return { width: zone.width || 300, height: zone.height || 200 };
    }

    // Add padding
    const width = Math.max((maxX - minX) + ZONE_PADDING * 2, 150);
    const height = Math.max((maxY - minY) + ZONE_PADDING * 2, 100);
    return { width, height };
  };

  // Update dimensions for all zones in the itemMap based on current content
  // We need to do this bottom-up conceptually, but calculateZoneDimensions handles recursion
  rootItems.forEach(id => {
      const item = itemMap.get(id);
      if (item && item.type === 'zone') {
          const dims = calculateZoneDimensions(id);
          item.width = dims.width;
          item.height = dims.height;
      }
  });

  // 2.5 Process Groupings at Root Level
  // Consolidate grouped root items into single LayoutItems
  const finalRootItems: string[] = [];
  const processedGroupIds = new Set<string>();

  rootItems.forEach(itemId => {
      const groupingId = itemToGroupingId.get(itemId);
      if (groupingId) {
          if (!processedGroupIds.has(groupingId)) {
              processedGroupIds.add(groupingId);
              finalRootItems.push(groupingId);
              
              const group = newData.groupings?.find(g => g.id === groupingId);
              if (group) {
                  // Calculate bounding box of the group
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  let hasMembers = false;

                  group.memberIds.forEach(mId => {
                      // Check if member is a node or zone
                      const node = newData.nodes.find(n => n.id === mId);
                      if (node) {
                          hasMembers = true;
                          const dims = measureNodeDims(node as PositionedNode);
                          minX = Math.min(minX, node.x || 0);
                          minY = Math.min(minY, node.y || 0);
                          maxX = Math.max(maxX, (node.x || 0) + dims.width);
                          maxY = Math.max(maxY, (node.y || 0) + dims.height);
                      } else {
                          const zone = (newData.zones ?? []).find(z => z.id === mId);
                          if (zone) {
                              hasMembers = true;
                              // Use calculated dimensions from itemMap if available
                              const item = itemMap.get(mId);
                              const width = item ? item.width : (zone.width || 300);
                              const height = item ? item.height : (zone.height || 200);
                              
                              minX = Math.min(minX, zone.x || 0);
                              minY = Math.min(minY, zone.y || 0);
                              maxX = Math.max(maxX, (zone.x || 0) + width);
                              maxY = Math.max(maxY, (zone.y || 0) + height);
                          }
                      }
                  });

                  if (hasMembers) {
                      itemMap.set(groupingId, {
                          id: groupingId,
                          type: 'grouping',
                          width: Math.max(maxX - minX, 100),
                          height: Math.max(maxY - minY, 100),
                          x: minX,
                          y: minY,
                          originalX: minX,
                          originalY: minY,
                          data: group
                      });
                  } else {
                      // Empty group? Should not happen if valid
                      itemMap.set(groupingId, {
                          id: groupingId,
                          type: 'grouping',
                          width: 100,
                          height: 100,
                          x: 0, 
                          y: 0,
                          originalX: 0,
                          originalY: 0,
                          data: group
                      });
                  }
              }
          }
      } else {
          finalRootItems.push(itemId);
      }
  });
  
  // Replace root items with the consolidated list
  rootItems = finalRootItems;

  // 3. Helper to get edges relevant to a set of items
  // An edge is relevant if both endpoints are in the set, OR if an endpoint is a descendant of an item in the set
  // For high-level layout, we treat connections to descendants as connections to the container
  const getEffectiveEdges = (scopeItemIds: string[]): GraphEdge[] => {
    const scopeSet = new Set(scopeItemIds);
    const effectiveEdges: GraphEdge[] = [];
    
    // Map every node/zone ID to its top-level ancestor within this scope
    const ancestorMap = new Map<string, string>();
    
    const findAncestorInScope = (id: string): string | null => {
        if (scopeSet.has(id)) return id;
        // If not in scope, it might be a child of something in scope
        // But we need to know the parent. 
        // We can reverse map hierarchy.
        return null;
    };

    // Build reverse lookup: child -> parent (within the whole diagram)
    const parentMap = new Map<string, string>();
    (newData.zones ?? []).forEach(z => {
        z.children.forEach(c => parentMap.set(c, z.id));
    });

    const resolveToScope = (id: string): string | null => {
        let current = id;
        while (current) {
            if (scopeSet.has(current)) return current;
            
            // Check if current item belongs to a grouping that is in scope
            const groupingId = itemToGroupingId.get(current);
            if (groupingId && scopeSet.has(groupingId)) return groupingId;

            current = parentMap.get(current) || '';
            if (!current) break;
        }
        return null;
    };

    newData.connections.forEach(conn => {
        const source = resolveToScope(conn.from);
        const target = resolveToScope(conn.to);
        
        if (source && target && source !== target) {
            effectiveEdges.push({ from: source, to: target });
        }
    });

    return effectiveEdges;
  };

  // 4. Layout ONLY the root items
  const edges = getEffectiveEdges(rootItems);
  const items = rootItems.map(id => itemMap.get(id)).filter(Boolean) as LayoutItem[];
  
  const { width, height } = performLayeredLayout(items, edges);

  // 5. Apply positions back to DiagramData - ONLY for root items
  const applyRootPositions = () => {
      rootItems.forEach(id => {
          const item = itemMap.get(id);
          if (!item) return;

          // Update item data
          if (item.type === 'grouping') {
             // Apply delta to all members
             const group = newData.groupings?.find(g => g.id === id);
             const deltaX = (item.x + 50) - (item.originalX || 0);
             const deltaY = (item.y + 50) - (item.originalY || 0);
             
             group?.memberIds.forEach(mId => {
                 const node = newData.nodes.find(n => n.id === mId);
                 if (node) {
                     node.x = (node.x || 0) + deltaX;
                     node.y = (node.y || 0) + deltaY;
                 } else {
                     const zone = (newData.zones ?? []).find(z => z.id === mId);
                     if (zone) {
                         zone.x = (zone.x || 0) + deltaX;
                         zone.y = (zone.y || 0) + deltaY;
                         // No need to recurse for children of zone, as zone X/Y shift moves children
                     }
                 }
             });
          } else if (item.type === 'node') {
             const node = newData.nodes.find(n => n.id === id);
             if (node) {
                 node.x = item.x + 50; // Add margin
                 node.y = item.y + 50;
             }
          } else {
             const zone = (newData.zones ?? []).find(z => z.id === id);
             if (zone) {
                 zone.x = item.x + 50;
                 zone.y = item.y + 50;
                 // DO NOT RECURSE - preserve internal layout relative to zone
             }
          }
      });
  };

  applyRootPositions();

  return newData;
}

/**
 * Layered layout per connected component (dagre inside each component), then grid-pack components.
 */
function performLayeredLayout(items: LayoutItem[], edges: GraphEdge[]): { width: number, height: number } {
    if (items.length === 0) return { width: 0, height: 0 };

    // 1. Separate into connected components
    const components = getConnectedComponents(items, edges);
    
    // Sort components by size (area) descending to pack larger ones first
    // But adding some randomness to the sort if sizes are similar could be nice?
    // For now, just shuffle them first to add variety before packing
    shuffleArray(components);

    // Calculate component dimensions
    const componentLayouts: ComponentLayoutBox[] = components.map(componentItems => {
        const componentIds = new Set(componentItems.map(i => i.id));
        const componentEdges = edges.filter(e => componentIds.has(e.from) && componentIds.has(e.to));

        const layout = layoutComponent(componentItems, componentEdges);
        return { items: componentItems, ...layout };
    });

    return packComponentsInGrid(componentLayouts);
}

function getConnectedComponents(items: LayoutItem[], edges: GraphEdge[]): LayoutItem[][] {
    const adj = new Map<string, string[]>();
    items.forEach(i => adj.set(i.id, []));
    
    edges.forEach(e => {
        if (adj.has(e.from)) adj.get(e.from)?.push(e.to);
        if (adj.has(e.to)) adj.get(e.to)?.push(e.from); // Undirected for connectivity
    });
    
    const visited = new Set<string>();
    const components: LayoutItem[][] = [];
    
    items.forEach(item => {
        if (!visited.has(item.id)) {
            const component: LayoutItem[] = [];
            const stack = [item.id];
            visited.add(item.id);
            
            while (stack.length > 0) {
                const curr = stack.pop()!;
                const currItem = items.find(i => i.id === curr);
                if (currItem) component.push(currItem);
                
                adj.get(curr)?.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        stack.push(neighbor);
                    }
                });
            }
            components.push(component);
        }
    });
    
    return components;
}

function normalizeItemPositionsTopLeft(items: LayoutItem[]): void {
    let minX = Infinity;
    let minY = Infinity;
    items.forEach((item) => {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
    });
    if (minX === Infinity) return;
    items.forEach((item) => {
        item.x -= minX;
        item.y -= minY;
    });
}

function boundingBoxForItems(items: LayoutItem[]): { width: number; height: number } {
    let maxX = 0;
    let maxY = 0;
    items.forEach((item) => {
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + item.height);
    });
    return { width: maxX, height: maxY };
}

/**
 * If dagre produced a "spine" (one node per horizontal band), stagger X so edges are not all collinear.
 */
function applyChainZigZagIfNeeded(items: LayoutItem[]): void {
    if (items.length < 3) return;
    const sorted = [...items].sort((a, b) => a.y - b.y);
    const clusters: LayoutItem[][] = [];
    for (const item of sorted) {
        const last = clusters[clusters.length - 1];
        if (!last || Math.abs(item.y - last[0].y) > 8) {
            clusters.push([item]);
        } else {
            last.push(item);
        }
    }
    if (clusters.length < 3 || !clusters.every((c) => c.length === 1)) return;

    const stagger = Math.min(CHAIN_ZIGZAG_OFFSET, Math.max(80, LAYER_SPACING * 0.75));
    clusters.forEach((c, i) => {
        c[0].x += (i % 2) * stagger;
    });
}

function layoutComponentGridFallback(items: LayoutItem[]): { width: number; height: number } {
    const n = items.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * GRID_COLS_SQRT_FACTOR)));
    let rowY = 0;
    for (let i = 0; i < n; i += cols) {
        const row = items.slice(i, i + cols);
        let x = 0;
        let rowH = 0;
        row.forEach((item) => {
            item.x = x;
            item.y = rowY;
            x += item.width + MIN_NODE_SPACING;
            rowH = Math.max(rowH, item.height);
        });
        rowY += rowH + MIN_NODE_SPACING;
    }
    normalizeItemPositionsTopLeft(items);
    return boundingBoxForItems(items);
}

/**
 * Layered layout via dagre (same engine as Mermaid flowcharts): fan-out keeps siblings on one rank
 * with horizontal spread (e.g. 2×2 style), instead of a custom DFS tree that collapses to a line.
 */
function layoutComponent(items: LayoutItem[], edges: GraphEdge[]): { width: number; height: number } {
    if (items.length === 1) {
        return { width: items[0].width, height: items[0].height };
    }

    const idSet = new Set(items.map((i) => i.id));
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: "TB",
        nodesep: MIN_NODE_SPACING,
        ranksep: LAYER_SPACING,
        marginx: 20,
        marginy: 20,
        edgesep: MIN_NODE_SPACING,
    });

    items.forEach((item) => {
        g.setNode(item.id, { width: item.width, height: item.height });
    });

    const edgeKeySeen = new Set<string>();
    edges.forEach((e) => {
        if (!idSet.has(e.from) || !idSet.has(e.to) || e.from === e.to) return;
        const key = `${e.from}\0${e.to}`;
        if (edgeKeySeen.has(key)) return;
        edgeKeySeen.add(key);
        g.setEdge(e.from, e.to);
    });

    try {
        dagre.layout(g);
    } catch {
        return layoutComponentGridFallback(items);
    }

    items.forEach((item) => {
        const n = g.node(item.id);
        if (n && typeof n.x === "number" && typeof n.y === "number") {
            item.x = n.x - item.width / 2;
            item.y = n.y - item.height / 2;
        }
    });

    normalizeItemPositionsTopLeft(items);
    applyChainZigZagIfNeeded(items);
    normalizeItemPositionsTopLeft(items);

    return boundingBoxForItems(items);
}
