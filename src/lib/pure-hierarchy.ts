import type { DiagramData, DiagramGroupData, DiagramNodeData } from './types';
import { generateGroupId } from './id-generator';

/**
 * Create a pure hierarchical structure from any diagram data
 */
export function createPureHierarchy(data: DiagramData): DiagramData {
  const nodes = [...(data.nodes || [])];
  let groups = [...(data.groups || [])];
  
  // If no groups exist, create an invisible root group
  if (groups.length === 0) {
    const rootGroup: DiagramGroupData = {
      id: generateGroupId('group', data),
      type: 'group',
      label: '', // No label = invisible container
      children: nodes.map(n => n.id),
      subType: 'group',
      x: 0,
      y: 0
    };
    groups = [rootGroup];
  } else {
    // Migrate existing groups to pure hierarchy
    groups = migrateToPureHierarchy(groups, nodes);
  }
  
  return {
    nodes,
    connections: data.connections || [],
    groups,
    rootGroupId: groups.find(g => !g.parentId)?.id
  };
}

/**
 * Migrate existing groups to pure hierarchical format
 */
function migrateToPureHierarchy(groups: DiagramGroupData[], nodes: DiagramNodeData[]): DiagramGroupData[] {
  const groupMap = new Map(groups.map(g => [g.id, { ...g, children: (g as any).nodes || [] }]));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // Build parent-child relationships
  groups.forEach(group => {
    const migratedGroup = groupMap.get(group.id)!;
    
    migratedGroup.children.forEach((childId: string) => {
      const childGroup = groupMap.get(childId);
      if (childGroup) {
        // This is a nested group
        childGroup.parentId = group.id;
      }
    });
  });
  
  // Find orphan nodes (nodes not in any group) and create a group for them
  const allChildNodeIds = new Set<string>();
  groups.forEach(group => {
    group.children?.forEach((childId: string) => {
      if (nodeMap.has(childId)) {
        allChildNodeIds.add(childId);
      }
    });
  });
  
  const orphanNodes = nodes.filter(n => !allChildNodeIds.has(n.id));
  if (orphanNodes.length > 0) {
    const orphanGroup: DiagramGroupData = {
      id: generateGroupId('group', { nodes, connections: [], groups: [] }),
      type: 'group',
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
export function buildHierarchyTree(groups: DiagramGroupData[]): Map<string, DiagramGroupData[]> {
  const hierarchy = new Map<string, DiagramGroupData[]>();
  
  // Initialize root level
  hierarchy.set('root', []);
  
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
 * Calculate group dimensions with minimum size
 */
export function calculateGroupDimensions(
  group: DiagramGroupData,
  allGroups: DiagramGroupData[],
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
    .filter(Boolean) as DiagramGroupData[];

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
 * Flatten hierarchy for rendering
 */
export function flattenPureHierarchy(
  groups: DiagramGroupData[],
  nodes: DiagramNodeData[]
): { positionedGroups: DiagramGroupData[], positionedNodes: DiagramNodeData[] } {
  const hierarchy = buildHierarchyTree(groups);
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  const positionedGroups: DiagramGroupData[] = [];
  const positionedNodes: DiagramNodeData[] = [];
  const processedNodeIds = new Set<string>();
  
  const processGroup = (groupId: string, parentX: number = 0, parentY: number = 0) => {
    const group = groupMap.get(groupId);
    if (!group) return;
    
    const groupX = (group.x || 0) + parentX;
    const groupY = (group.y || 0) + parentY;
    
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
  
  return { positionedGroups, positionedNodes };
}

/**
 * Check if a group is a descendant of another group
 */
export function isDescendant(childId: string, parentId: string, groups: DiagramGroupData[]): boolean {
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
 * Add a node to a group (creates group if needed)
 */
export function addNodeToGroup(
  nodeId: string,
  groupId: string | null,
  data: DiagramData
): DiagramData {
  const pureData = createPureHierarchy(data);
  const groups = [...pureData.groups];
  const targetGroupId = groupId || groups.find(g => !g.parentId)?.id;
  
  if (!targetGroupId) {
    // Create a new group for this node
    const newGroup: DiagramGroupData = {
      id: generateGroupId('group', data),
      type: 'group',
      label: 'Group',
      children: [nodeId],
      subType: 'group',
      x: 50,
      y: 50
    };
    groups.push(newGroup);
  } else {
    // Add to existing group
    const targetGroup = groups.find(g => g.id === targetGroupId);
    if (targetGroup) {
      targetGroup.children = [...(targetGroup.children || []), nodeId];
    }
  }
  
  return { ...pureData, groups };
}