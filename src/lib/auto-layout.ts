import { DiagramData, DiagramNodeData, DiagramZoneData, DiagramConnectionData, DiagramGroupingData } from "./types";
import { measureNodeDims, PositionedNode } from "../components/editor/canvas-constants";

// Layout Constants
const MIN_NODE_SPACING = 60;
const LAYER_SPACING = 100;
const ZONE_PADDING = 40;
const COMPONENT_SPACING = 80;

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
  rank?: number;
  order?: number;
}

interface GraphEdge {
  from: string;
  to: string;
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
  
  newData.zones.forEach(zone => {
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
  
  newData.zones.forEach(zone => {
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
    ...newData.zones.filter(z => !allChildIds.has(z.id)).map(z => z.id)
  ];

  // Helper to calculate bounding box of a zone based on its children
  const calculateZoneDimensions = (zoneId: string): { width: number, height: number } => {
    const zone = newData.zones.find(z => z.id === zoneId);
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

        const childZone = newData.zones.find(z => z.id === childId);
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
                          const zone = newData.zones.find(z => z.id === mId);
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
    newData.zones.forEach(z => {
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
                     const zone = newData.zones.find(z => z.id === mId);
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
             const zone = newData.zones.find(z => z.id === id);
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
 * Sugiyama-style Layered Layout
 */
function performLayeredLayout(items: LayoutItem[], edges: GraphEdge[]): { width: number, height: number } {
    if (items.length === 0) return { width: 0, height: 0 };

    // 1. Separate into connected components
    const components = getConnectedComponents(items, edges);
    
    let currentX = 0;
    let maxHeight = 0;
    
    // Layout each component
    components.forEach(componentItems => {
        // Filter edges for this component
        const componentIds = new Set(componentItems.map(i => i.id));
        const componentEdges = edges.filter(e => componentIds.has(e.from) && componentIds.has(e.to));
        
        const { width, height } = layoutComponent(componentItems, componentEdges);
        
        // Shift component
        componentItems.forEach(item => {
            item.x += currentX;
        });
        
        currentX += width + COMPONENT_SPACING;
        maxHeight = Math.max(maxHeight, height);
    });
    
    return { width: currentX - COMPONENT_SPACING, height: maxHeight };
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

function layoutComponent(items: LayoutItem[], edges: GraphEdge[]): { width: number, height: number } {
    // If simple component (1 item), return size
    if (items.length === 1) {
        return { width: items[0].width, height: items[0].height };
    }

    // 1. Assign Layers (Longest Path)
    // First, build adjacency for directed graph
    const outEdges = new Map<string, string[]>();
    const inEdges = new Map<string, string[]>();
    items.forEach(i => {
        outEdges.set(i.id, []);
        inEdges.set(i.id, []);
    });
    
    edges.forEach(e => {
        outEdges.get(e.from)?.push(e.to);
        inEdges.get(e.to)?.push(e.from);
    });
    
    // Break cycles (Greedy DFS)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const validEdges: GraphEdge[] = [];
    
    const visit = (u: string) => {
        visited.add(u);
        recursionStack.add(u);
        
        outEdges.get(u)?.forEach(v => {
            if (recursionStack.has(v)) {
                // Cycle detected, ignore this edge for layering (treat as back-edge)
            } else {
                validEdges.push({ from: u, to: v });
                if (!visited.has(v)) visit(v);
            }
        });
        
        recursionStack.delete(u);
    };
    
    items.forEach(i => {
        if (!visited.has(i.id)) visit(i.id);
    });
    
    // Compute ranks using valid edges
    const ranks = new Map<string, number>();
    // Initialize sources with rank 0
    items.forEach(i => ranks.set(i.id, 0));
    
    // Simple longest path approach
    // Iterate a few times to propagate ranks
    for (let i = 0; i < items.length; i++) {
        let changed = false;
        validEdges.forEach(e => {
            const rU = ranks.get(e.from) || 0;
            const rV = ranks.get(e.to) || 0;
            if (rV < rU + 1) {
                ranks.set(e.to, rU + 1);
                changed = true;
            }
        });
        if (!changed) break;
    }
    
    // Group by rank
    const layers = new Map<number, LayoutItem[]>();
    items.forEach(i => {
        i.rank = ranks.get(i.id);
        if (!layers.has(i.rank!)) layers.set(i.rank!, []);
        layers.get(i.rank!)?.push(i);
    });
    
    const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b).map(r => layers.get(r)!);
    
    // 2. Order Vertices in Layers (Barycenter Heuristic) to minimize crossings
    // Simple heuristic: Sort layer L+1 based on average position of parents in layer L
    
    for (let i = 0; i < sortedLayers.length - 1; i++) {
        const currentLayer = sortedLayers[i];
        const nextLayer = sortedLayers[i+1];
        
        // Assign initial order in current layer if not set
        currentLayer.forEach((item, idx) => item.order = idx);
        
        // For each node in next layer, calculate barycenter of parents
        nextLayer.forEach(node => {
            const parents = inEdges.get(node.id)?.filter(pId => currentLayer.some(l => l.id === pId)) || [];
            if (parents.length > 0) {
                const sumOrder = parents.reduce((sum, pId) => {
                    const p = currentLayer.find(l => l.id === pId);
                    return sum + (p?.order || 0);
                }, 0);
                (node as any).barycenter = sumOrder / parents.length;
            } else {
                (node as any).barycenter = (node.order || 0);
            }
        });
        
        // Sort next layer
        nextLayer.sort((a, b) => ((a as any).barycenter || 0) - ((b as any).barycenter || 0));
        // Update order
        nextLayer.forEach((item, idx) => item.order = idx);
    }
    
    // 3. Assign Coordinates
    // Y coordinates
    let currentY = 0;
    sortedLayers.forEach(layer => {
        const maxH = Math.max(...layer.map(i => i.height));
        layer.forEach(item => {
            item.y = currentY + (maxH - item.height) / 2; // Vertically center in layer
        });
        currentY += maxH + LAYER_SPACING;
    });
    
    // X coordinates
    let maxW = 0;
    sortedLayers.forEach(layer => {
        let currentX = 0;
        layer.forEach(item => {
            item.x = currentX;
            currentX += item.width + MIN_NODE_SPACING;
        });
        maxW = Math.max(maxW, currentX - MIN_NODE_SPACING);
    });
    
    // Center layers
    sortedLayers.forEach(layer => {
        const layerWidth = layer.reduce((sum, item) => sum + item.width, 0) + (layer.length - 1) * MIN_NODE_SPACING;
        const offset = (maxW - layerWidth) / 2;
        
        let currentX = offset;
        layer.forEach(item => {
            item.x = currentX;
            currentX += item.width + MIN_NODE_SPACING;
        });
    });
    
    return { width: maxW, height: currentY - LAYER_SPACING };
}
