import type { DiagramData, DiagramGroupData, DiagramNodeData, DiagramZoneData } from './types';
import { generateGroupId } from './id-generator';

/**
 * Create a pure hierarchical structure from any diagram data
 */
export function createPureHierarchy(data: DiagramData): DiagramData {
  const nodes = [...(data.nodes || [])];
  let zones = [...(data.zones || [])];
  
  // If no zones exist, create an invisible root zone
  if (zones.length === 0) {
    const rootZone: DiagramZoneData = {
      id: generateGroupId('zone', data),
      type: 'zone',
      label: '', // No label = invisible container
      children: nodes.map(n => n.id),
      subType: 'group',
      x: 0,
      y: 0
    };
    zones = [rootZone];
  } else {
    // Migrate existing zones to pure hierarchy
    zones = migrateToPureHierarchy(zones, nodes);
  }
  
  return {
    nodes,
    connections: data.connections || [],
    zones
  };
}

/**
 * Migrate existing zones to pure hierarchical format
 */
function migrateToPureHierarchy(zones: DiagramZoneData[], nodes: DiagramNodeData[]): DiagramZoneData[] {
  const groupMap = new Map(zones.map(g => [g.id, { ...g, children: (g as any).nodes || [] }]));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Build parent-child relationships
  zones.forEach(group => {
    const migratedGroup = groupMap.get(group.id)!;
    
    migratedGroup.children.forEach((childId: string) => {
      const childZone = groupMap.get(childId);
      if (childZone) {
        // This is a nested group
        childZone.parentId = group.id;
      }
    });
  });
  
  // Find orphan nodes (nodes not in any group) and create a group for them
  const allChildNodeIds = new Set<string>();
  zones.forEach(group => {
    group.children?.forEach((childId: string) => {
      if (nodeMap.has(childId)) {
        allChildNodeIds.add(childId);
      }
    });
  });
  
  const orphanNodes = nodes.filter(n => !allChildNodeIds.has(n.id));
  if (orphanNodes.length > 0) {
    const orphanGroup: DiagramZoneData = {
      id: generateGroupId('zone', { nodes, connections: [], zones: [], groupings: [] }),
      type: 'zone',
      label: 'Orphan Nodes',
      children: orphanNodes.map(n => n.id),
      subType: 'group',
      x: 50,
      y: 50
    };
    groupMap.set(orphanGroup.id, orphanGroup);
  }
  
  return Array.from(groupMap.values());
}

/**
 * Build complete hierarchy tree
 */
export function buildHierarchyTree(zones: DiagramZoneData[]): Map<string, DiagramZoneData[]> {
  const hierarchy = new Map<string, DiagramZoneData[]>();
  
  // Initialize root level
  hierarchy.set('root', []);
  
  // Build parent-child relationships
  zones.forEach(group => {
    const parentId = group.parentId || 'root';
    
    if (!hierarchy.has(parentId)) {
      hierarchy.set(parentId, []);
    }
    
    hierarchy.get(parentId)!.push(group);
  });
  
  return hierarchy;
}

/**
 * Calculate group dimensions with minimum size
 */
export function calculateGroupDimensions(
  group: DiagramGroupData,
  allGroups: DiagramZoneData[],
  allNodes: DiagramNodeData[],
  nodeWidth: number = 104,
  nodeHeight: number = 100,
  groupPadding: number = 40,
  groupNodeSpacing: number = 30
): { width: number, height: number } {
  const groupMap = new Map(allGroups.map(g => [g.id, g]));
  const nodeMap = new Map(allNodes.map(n => [n.id, n]));
  
  // Get child nodes and groups
  const childNodes = group.children
    .map(id => nodeMap.get(id))
    .filter(Boolean) as DiagramNodeData[];
  
  const childZones = group.children
    .map(id => groupMap.get(id))
    .filter(Boolean) as DiagramZoneData[];

  // If no children, return minimum size (as if it has one node)
  if (childNodes.length === 0 && childZones.length === 0) {
    return {
      width: nodeWidth + groupPadding * 2,
      height: nodeHeight + groupPadding * 2
    };
  }

  // Calculate dimensions for child groups first
  const laidOutChildGroups = childZones.map(cg => {
    const dims = calculateGroupDimensions(cg, allGroups, allNodes, nodeWidth, nodeHeight, groupPadding, groupNodeSpacing);
    (cg as any).width = dims.width;
    (cg as any).height = dims.height;
    return cg;
  });

  // Grid layout for all children
  const allChildren = [...childNodes, ...laidOutChildGroups];
  const numItems = allChildren.length;
  
  // Determine items per row based on orientation
  let itemsPerRow: number;
  if (group.orientation === 'vertical') {
    itemsPerRow = 1;
  } else if (group.orientation === 'horizontal') {
    itemsPerRow = group.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
  } else {
    itemsPerRow = group.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
  }
  
  let currentX = groupPadding;
  let currentY = groupPadding;
  let rowMaxHeight = 0;
  let contentWidth = 0;
  let contentHeight = 0;

  allChildren.forEach((child, index) => {
    if (index > 0 && index % itemsPerRow === 0) {
      currentX = groupPadding;
      currentY += rowMaxHeight + groupNodeSpacing;
      rowMaxHeight = 0;
    }
    
    const childWidth = (child as any).width || nodeWidth;
    const childHeight = (child as any).height || nodeHeight;
    
    child.x = currentX;
    child.y = currentY;

    currentX += childWidth + groupNodeSpacing;
    rowMaxHeight = Math.max(rowMaxHeight, childHeight);
    contentWidth = Math.max(contentWidth, currentX);
  });

  contentHeight = currentY + rowMaxHeight;

  const groupWidth = contentWidth - groupNodeSpacing + groupPadding;
  const groupHeight = contentHeight + groupPadding;
  
  return { width: groupWidth, height: groupHeight };
}

/**
 * Flatten hierarchy for rendering
 */
export function flattenPureHierarchy(
  zones: DiagramZoneData[],
  nodes: DiagramNodeData[]
): { positionedGroups: DiagramZoneData[], positionedNodes: DiagramNodeData[] } {
  const hierarchy = buildHierarchyTree(zones);
  const groupMap = new Map(zones.map(g => [g.id, g]));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  const positionedGroups: DiagramZoneData[] = [];
  const positionedNodes: DiagramNodeData[] = [];
  const processedNodeIds = new Set<string>();
  
  const processZone = (zoneId: string, parentX: number = 0, parentY: number = 0) => {
    const zone = groupMap.get(zoneId);
    if (!zone) return;
    
    const zoneX = (zone.x || 0) + parentX;
    const zoneY = (zone.y || 0) + parentY;
    
    // Calculate dimensions for this zone
    const dimensions = calculateGroupDimensions(zone, zones, nodes);
    
    positionedGroups.push({ 
      ...zone, 
      x: zoneX, 
      y: zoneY,
      width: dimensions.width,
      height: dimensions.height
    } as any);
    
    // Process children
    zone.children.forEach(childId => {
      const node = nodeMap.get(childId);
      if (node && !processedNodeIds.has(childId)) {
        processedNodeIds.add(childId);
        positionedNodes.push({
          ...node,
          x: (node.x || 0) + zoneX,
          y: (node.y || 0) + zoneY
        });
      } else if (!node) {
        // It's a sub-zone
        processZone(childId, zoneX, zoneY);
      }
    });
  };
  
  // Process root zones
  hierarchy.get('root')?.forEach(zone => {
    processZone(zone.id);
  });
  
  return { positionedGroups, positionedNodes };
}

/**
 * Check if a group is a descendant of another group
 */
export function isDescendant(childId: string, parentId: string, zones: DiagramZoneData[]): boolean {
  const visited = new Set<string>();
  
  const traverse = (id: string): boolean => {
    if (visited.has(id)) return false;
    visited.add(id);
    
    if (id === parentId) return true;
    
    const parent = zones.find(g => g.id === id);
    if (!parent || !parent.parentId) return false;
    
    return traverse(parent.parentId);
  };
  
  return traverse(childId);
}

/**
 * Add a node to a group (creates group if needed)
 */
export function addNodeToGroup(
  nodeId: string,
  groupId: string | null,
  data: DiagramData
): DiagramData {
  const pureData = createPureHierarchy(data);
  const zones = [...(pureData.zones ?? [])];
  const targetGroupId = groupId || zones.find(g => !g.parentId)?.id;
  
  if (!targetGroupId) {
    // Create a new group for this node
    const newZone: DiagramGroupData = {
      id: generateGroupId('zone', data),
      type: 'zone',
      label: 'Group',
      children: [nodeId],
      subType: 'group',
      x: 50,
      y: 50
    };
    zones.push(newZone);
  } else {
    // Add to existing zone
    const targetZone = zones.find(g => g.id === targetGroupId);
    if (targetZone) {
      targetZone.children = [...(targetZone.children || []), nodeId];
    }
  }
  
  return { ...pureData, zones };
}