import type { DiagramGroupData, DiagramNodeData, DiagramZoneData } from './types';

/**
 * Build a hierarchical tree structure from flat groups array
 */
export function buildGroupHierarchy(groups: DiagramZoneData[]): Map<string, DiagramZoneData[]> {
  const hierarchy = new Map<string, DiagramZoneData[]>();
  
  // Initialize root level
  hierarchy.set('root', []);
  
  // Create a map for quick group lookup
  const groupMap: Map<string, DiagramZoneData> = new Map(groups.map(g => [g.id, g]));
  
  // Build parent-child relationships
  groups.forEach(group => {
    const parentId = group.parentId || 'root';
    
    if (!hierarchy.has(parentId)) {
      hierarchy.set(parentId, []);
    }
    
    hierarchy.get(parentId)!.push(group);
  });
  
  return hierarchy;
}

/**
 * Get all descendant groups of a given group
 */
export function getDescendantGroups(groupId: string, groups: DiagramZoneData[]): DiagramZoneData[] {
  const descendants: DiagramZoneData[] = [];
  const visited = new Set<string>();
  
  const traverse = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    
    const children = groups.filter(g => g.parentId === id);
    children.forEach(child => {
      descendants.push(child);
      traverse(child.id);
    });
  };
  
  traverse(groupId);
  return descendants;
}

/**
 * Check if a group is a descendant of another group
 */
export function isDescendant(childId: string, parentId: string, groups: DiagramZoneData[]): boolean {
  const visited = new Set<string>();
  
  const traverse = (id: string): boolean => {
    if (visited.has(id)) return false;
    visited.add(id);
    
    if (id === parentId) return true;
    
    const parent = groups.find(g => g.id === id);
    if (!parent || !parent.parentId) return false;
    
    return traverse(parent.parentId);
  };
  
  return traverse(childId);
}

/**
 * Get all nodes that are direct or indirect children of a group
 */
export function getAllNodesInGroup(groupId: string, groups: DiagramZoneData[], nodes: DiagramNodeData[]): DiagramNodeData[] {
  const result: DiagramNodeData[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  const traverse = (id: string) => {
    const group = groups.find(g => g.id === id);
    if (!group) return;
    
    // Add direct node children
    group.children.forEach(nodeId => {
      const node = nodeMap.get(nodeId);
      if (node) {
        result.push(node);
      } else {
        // If it's not a node, it might be a sub-group
        traverse(nodeId);
      }
    });
  };
  
  traverse(groupId);
  return result;
}

/**
 * Update parent relationships when moving groups
 */
export function updateGroupParenting(
  movedGroupId: string, 
  newParentId: string | undefined, 
  groups: DiagramZoneData[]
): DiagramZoneData[] {
  return groups.map(group => {
    if (group.id === movedGroupId) {
      return { ...group, parentId: newParentId };
    }
    return group;
  });
}

/**
 * Calculate group dimensions with minimum size for empty groups
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
  
  const childGroups = group.children
    .map(id => groupMap.get(id))
    .filter(Boolean) as DiagramZoneData[];

  // If no children, return minimum size (as if it has one node)
  if (childNodes.length === 0 && childGroups.length === 0) {
    return {
      width: nodeWidth + groupPadding * 2,
      height: nodeHeight + groupPadding * 2
    };
  }

  // Calculate dimensions for child groups first
  const laidOutChildGroups = childGroups.map(cg => {
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
 * Flatten hierarchy for rendering (calculate absolute positions)
 */
export function flattenHierarchy(
  groups: DiagramZoneData[],
  nodes: DiagramNodeData[]
): { positionedGroups: DiagramZoneData[], positionedNodes: DiagramNodeData[] } {
  const hierarchy = buildGroupHierarchy(groups);
  const groupMap: Map<string, DiagramZoneData> = new Map(groups.map(g => [g.id, g]));
  const nodeMap: Map<string, DiagramNodeData> = new Map(nodes.map(n => [n.id, n]));
  
  const positionedGroups: DiagramZoneData[] = [];
  const positionedNodes: DiagramNodeData[] = [];
  const processedNodeIds = new Set<string>();
  
  const processGroup = (groupId: string, parentX: number = 0, parentY: number = 0) => {
    const group = groupMap.get(groupId);
    if (!group) return;
    
    const groupX = (group.x ?? 0) + parentX;
    const groupY = (group.y ?? 0) + parentY;
    
    // Calculate dimensions for this group
    const dimensions = calculateGroupDimensions(group, groups, nodes);
    
    positionedGroups.push({ 
      ...group, 
      x: groupX, 
      y: groupY,
      width: dimensions.width,
      height: dimensions.height
    } as any);
    
    // Process children
    group.children.forEach(childId => {
      const node = nodeMap.get(childId);
      if (node && !processedNodeIds.has(childId)) {
        processedNodeIds.add(childId);
        positionedNodes.push({
          ...node,
          x: (node.x || 0) + groupX,
          y: (node.y || 0) + groupY
        });
      } else if (!node) {
        // It's a sub-group
        processGroup(childId, groupX, groupY);
      }
    });
  };
  
  // Process root groups
  hierarchy.get('root')?.forEach(group => {
    processGroup(group.id);
  });
  
  // Add orphan nodes (nodes not in any group)
  const allChildNodeIds = new Set<string>();
  groups.forEach(group => {
    group.children.forEach(nodeId => {
      const node = nodeMap.get(nodeId);
      if (node) {
        allChildNodeIds.add(nodeId);
      }
    });
  });
  
  nodes.forEach(node => {
    if (!allChildNodeIds.has(node.id) && !processedNodeIds.has(node.id)) {
      processedNodeIds.add(node.id);
      positionedNodes.push(node);
    }
  });
  
  return { positionedGroups, positionedNodes };
}

/**
 * Migrate legacy flat group structure to hierarchical model
 */
export function migrateToHierarchical(groups: DiagramZoneData[]): DiagramZoneData[] {
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const migrated = [...groups];
  
  // Build parent-child relationships
  groups.forEach(group => {
    group.children.forEach(nodeId => {
      const childGroup = groupMap.get(nodeId);
      if (childGroup) {
        // This is a nested group, update its parentId
        const childIndex = migrated.findIndex(g => g.id === nodeId);
        if (childIndex !== -1) {
          migrated[childIndex] = { ...migrated[childIndex], parentId: group.id };
        }
      }
    });
  });
  
  return migrated;
}