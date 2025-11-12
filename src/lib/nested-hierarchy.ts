import type { DiagramData, DiagramGroupData, DiagramNodeData, HierarchicalDiagramData, DiagramGroupItem, DiagramNodeItem } from './types';

/**
 * Convert flat diagram data to nested hierarchical structure
 */
export function convertToNestedHierarchy(data: DiagramData): HierarchicalDiagramData {
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  const groupMap = new Map(data.groups.map(g => [g.id, g]));
  
  // Build parent-child relationships
  const parentMap = new Map<string, string[]>();
  data.groups.forEach(group => {
    // Handle both children (new format) and nodes (old format)
    const childIds = group.children || (group as any).nodes || [];
    childIds.forEach((childId: string) => {
      if (!parentMap.has(group.id)) {
        parentMap.set(group.id, []);
      }
      parentMap.get(group.id)!.push(childId);
    });
  });
  
  // Find root groups (groups without parents)
  const rootGroupIds = data.groups
    .filter(g => !g.parentId)
    .map(g => g.id);
  
  // Convert each root group to nested structure
  const nestedGroups: DiagramGroupItem[] = rootGroupIds.map(rootId => 
    convertGroupToNested(rootId, groupMap, nodeMap, parentMap)
  );
  
  // Find orphan nodes (nodes not in any group) and create a group for them
  const allChildNodeIds = new Set<string>();
  data.groups.forEach(group => {
    // Skip orphan-nodes groups when checking for children
    if (group.id === 'orphan-nodes') return;
    
    // Handle both children (new format) and nodes (old format)
    const childIds = group.children || (group as any).nodes || [];
    childIds.forEach((childId: string) => {
      if (nodeMap.has(childId)) {
        allChildNodeIds.add(childId);
      }
    });
  });
  
  const orphanNodes = data.nodes.filter(n => !allChildNodeIds.has(n.id) && n.type !== 'group');
  if (orphanNodes.length > 0) {
    const orphanGroup: DiagramGroupItem = {
      id: 'orphan-nodes',
      type: 'group',
      label: '', // Invisible container
        children: orphanNodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        info: node.info,
        x: node.x,
        y: node.y,
        lineColor: node.lineColor,
        edgePosition: node.edgePosition,
        borderColor: node.borderColor,
        backgroundColor: node.backgroundColor,
        textColor: node.textColor,
        borderStyle: node.borderStyle,
        borderColors: node.borderColors,
        backgroundStyle: node.backgroundStyle,
        backgroundColors: node.backgroundColors,
        gradientAngle: node.gradientAngle,
        shadow: node.shadow,
        rotation: node.rotation,
        textPosition: node.textPosition,
        freeflow: node.freeflow,
        borderWidth: node.borderWidth,
        width: node.width,
        height: node.height,
        sizeMode: node.sizeMode,
        noIconBackground: node.noIconBackground,
        textJustify: node.textJustify,
        textVerticalPosition: node.textVerticalPosition
      }))
    };
    nestedGroups.push(orphanGroup);
  }
  
  return {
    groups: nestedGroups,
    connections: data.connections
  };
}

/**
 * Convert a single group and its children to nested structure
 */
function convertGroupToNested(
  groupId: string,
  groupMap: Map<string, DiagramGroupData>,
  nodeMap: Map<string, DiagramNodeData>,
  parentMap: Map<string, string[]>
): DiagramGroupItem {
  const group = groupMap.get(groupId);
  if (!group) {
    throw new Error(`Group ${groupId} not found`);
  }
  
  const children = parentMap.get(groupId) || [];
  const nestedChildren: (DiagramNodeItem | DiagramGroupItem)[] = [];
  
  children.forEach(childId => {
    const node = nodeMap.get(childId);
    if (node) {
      // This is a node
      nestedChildren.push({
        id: node.id,
        type: node.type,
        label: node.label,
        info: node.info,
        x: node.x,
        y: node.y,
        lineColor: node.lineColor,
        edgePosition: node.edgePosition,
        borderColor: node.borderColor,
        backgroundColor: node.backgroundColor,
        textColor: node.textColor,
        borderStyle: node.borderStyle,
        borderColors: node.borderColors,
        backgroundStyle: node.backgroundStyle,
        backgroundColors: node.backgroundColors,
        gradientAngle: node.gradientAngle,
        shadow: node.shadow,
        rotation: node.rotation,
        textPosition: node.textPosition,
        freeflow: node.freeflow,
        borderWidth: node.borderWidth,
        width: node.width,
        height: node.height,
        sizeMode: node.sizeMode,
        noIconBackground: node.noIconBackground,
        textJustify: node.textJustify,
        textVerticalPosition: node.textVerticalPosition
      });
    } else {
      // This is a nested group
      const nestedGroup = convertGroupToNested(childId, groupMap, nodeMap, parentMap);
      nestedChildren.push(nestedGroup);
    }
  });
  
  return {
    id: group.id,
    type: 'group',
    label: group.label,
    info: group.info,
    children: nestedChildren,
    x: group.x,
    y: group.y,
    subType: group.subType,
    color: group.color,
    borderColor: group.borderColor,
    textColor: group.textColor,
    backgroundColor: group.backgroundColor,
    borderStyle: group.borderStyle,
    borderColors: group.borderColors,
    backgroundStyle: group.backgroundStyle,
    backgroundColors: group.backgroundColors,
    gradientAngle: group.gradientAngle,
    orientation: group.orientation,
    maxItemsPerRow: group.maxItemsPerRow,
    lineColor: group.lineColor,
    shadow: group.shadow,
    textPosition: group.textPosition,
    width: group.width,
    height: group.height,
    sizeMode: group.sizeMode,
    minWidth: group.minWidth,
    minHeight: group.minHeight,
    rotation: group.rotation,
    borderWidth: group.borderWidth,
    textJustify: group.textJustify,
    textVerticalPosition: group.textVerticalPosition
  };
}

/**
 * Convert nested hierarchical structure back to flat format
 */
export function convertFromNestedHierarchy(nestedData: HierarchicalDiagramData): DiagramData {
  const nodes: DiagramNodeData[] = [];
  const groups: DiagramGroupData[] = [];
  const nodeMap = new Map<string, DiagramNodeData>();
  const groupMap = new Map<string, DiagramGroupData>();
  
  // Process all groups and collect nodes
  nestedData.groups.forEach(group => {
    // Special handling for orphan-nodes group - convert its children directly to nodes
    if (group.id === 'orphan-nodes') {
      group.children.forEach(child => {
        if (child.type !== 'group') {
          const nodeChild = child as DiagramNodeItem;
          const node: DiagramNodeData = {
            id: nodeChild.id,
            type: nodeChild.type,
            label: nodeChild.label,
            info: nodeChild.info,
            x: nodeChild.x,
            y: nodeChild.y,
            lineColor: nodeChild.lineColor,
            edgePosition: nodeChild.edgePosition,
            borderColor: nodeChild.borderColor,
            backgroundColor: nodeChild.backgroundColor,
            textColor: nodeChild.textColor,
            borderStyle: nodeChild.borderStyle,
            borderColors: nodeChild.borderColors,
            backgroundStyle: nodeChild.backgroundStyle,
            backgroundColors: nodeChild.backgroundColors,
            gradientAngle: nodeChild.gradientAngle,
            shadow: nodeChild.shadow,
            rotation: nodeChild.rotation,
            textPosition: nodeChild.textPosition,
            freeflow: nodeChild.freeflow,
            borderWidth: nodeChild.borderWidth,
            width: nodeChild.width,
            height: nodeChild.height,
            sizeMode: nodeChild.sizeMode,
            noIconBackground: nodeChild.noIconBackground,
            textJustify: nodeChild.textJustify,
            textVerticalPosition: nodeChild.textVerticalPosition
          };
          nodes.push(node);
        }
      });
    } else {
      processNestedGroup(group, nodes, groups, nodeMap, groupMap, null);
    }
  });
  
  return {
    nodes,
    connections: nestedData.connections,
    groups,
    rootGroupId: groups.find(g => !g.parentId)?.id
  };
}

/**
 * Process a nested group and convert to flat format
 */
function processNestedGroup(
  group: DiagramGroupItem,
  nodes: DiagramNodeData[],
  groups: DiagramGroupData[],
  nodeMap: Map<string, DiagramNodeData>,
  groupMap: Map<string, DiagramGroupData>,
  parentId: string | null
): void {
  // Create flat group
  const flatGroup: DiagramGroupData = {
    id: group.id,
    type: 'group',
    label: group.label,
    children: [],
    info: group.info,
    x: group.x,
    y: group.y,
    subType: group.subType,
    color: group.color,
    borderColor: group.borderColor,
    textColor: group.textColor,
    backgroundColor: group.backgroundColor,
    borderStyle: group.borderStyle,
    borderColors: group.borderColors,
    backgroundStyle: group.backgroundStyle,
    backgroundColors: group.backgroundColors,
    gradientAngle: group.gradientAngle,
    orientation: group.orientation,
    maxItemsPerRow: group.maxItemsPerRow,
    lineColor: group.lineColor,
    shadow: group.shadow,
    textPosition: group.textPosition,
    width: group.width,
    height: group.height,
    sizeMode: group.sizeMode,
    minWidth: group.minWidth,
    minHeight: group.minHeight,
    rotation: group.rotation,
    borderWidth: group.borderWidth,
    parentId: parentId || undefined,
    textJustify: group.textJustify,
    textVerticalPosition: group.textVerticalPosition
  };
  
  groups.push(flatGroup);
  groupMap.set(group.id, flatGroup);
  
  // Process children
  group.children.forEach(child => {
    if (child.type === 'group') {
      // This is a nested group
      processNestedGroup(child as DiagramGroupItem, nodes, groups, nodeMap, groupMap, group.id);
      flatGroup.children.push(child.id);
    } else {
      // This is a node
      const nodeChild = child as DiagramNodeItem;
          const node: DiagramNodeData = {
            id: nodeChild.id,
            type: nodeChild.type,
            label: nodeChild.label,
            info: nodeChild.info,
            x: nodeChild.x,
            y: nodeChild.y,
            lineColor: nodeChild.lineColor,
            edgePosition: nodeChild.edgePosition,
            borderColor: nodeChild.borderColor,
            backgroundColor: nodeChild.backgroundColor,
            textColor: nodeChild.textColor,
            borderStyle: nodeChild.borderStyle,
            borderColors: nodeChild.borderColors,
            backgroundStyle: nodeChild.backgroundStyle,
            backgroundColors: nodeChild.backgroundColors,
            gradientAngle: nodeChild.gradientAngle,
            shadow: nodeChild.shadow,
            rotation: nodeChild.rotation,
            textPosition: nodeChild.textPosition,
            freeflow: nodeChild.freeflow,
            borderWidth: nodeChild.borderWidth,
          width: nodeChild.width,
          height: nodeChild.height,
          sizeMode: nodeChild.sizeMode,
          noIconBackground: nodeChild.noIconBackground,
          textJustify: nodeChild.textJustify,
          textVerticalPosition: nodeChild.textVerticalPosition
        };
    
      nodes.push(node);
      nodeMap.set(child.id, node);
      flatGroup.children.push(child.id);
    }
  });
}

/**
 * Calculate dimensions for nested groups
 */
export function calculateNestedGroupDimensions(
  group: DiagramGroupItem,
  nodeWidth: number = 104,
  nodeHeight: number = 100,
  groupPadding: number = 40,
  groupNodeSpacing: number = 30
): { width: number, height: number } {
  // Separate nodes and groups
  const childNodes = group.children.filter(child => child.type !== 'group') as DiagramNodeItem[];
  const childGroups = group.children.filter(child => child.type === 'group') as DiagramGroupItem[];
  
  // If no children, return minimum size
  if (childNodes.length === 0 && childGroups.length === 0) {
    return {
      width: nodeWidth + groupPadding * 2,
      height: nodeHeight + groupPadding * 2
    };
  }
  
  // Calculate dimensions for child groups first
  const laidOutChildGroups = childGroups.map(cg => {
    const dims = calculateNestedGroupDimensions(cg, nodeWidth, nodeHeight, groupPadding, groupNodeSpacing);
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
 * Flatten nested hierarchy for rendering (calculate absolute positions)
 */
export function flattenNestedHierarchy(
  nestedData: HierarchicalDiagramData
): { positionedGroups: DiagramGroupItem[], positionedNodes: DiagramNodeItem[] } {
  const positionedGroups: DiagramGroupItem[] = [];
  const positionedNodes: DiagramNodeItem[] = [];
  const processedNodeIds = new Set<string>(); // Track processed nodes to avoid duplicates
  
  const processGroup = (group: DiagramGroupItem, parentX: number = 0, parentY: number = 0) => {
    const groupX = (group.x || 0) + parentX;
    const groupY = (group.y || 0) + parentY;
    
    // Calculate dimensions for this group
    const dimensions = calculateNestedGroupDimensions(group);
    
    const positionedGroup = { 
      ...group, 
      x: groupX, 
      y: groupY,
      width: dimensions.width,
      height: dimensions.height
    } as any;
    
    positionedGroups.push(positionedGroup);
    
    // Process children
    group.children.forEach(child => {
      if (child.type === 'group') {
        processGroup(child as DiagramGroupItem, groupX, groupY);
      } else {
        // Only add node if not already processed
        if (!processedNodeIds.has(child.id)) {
          processedNodeIds.add(child.id);
          const nodeChild = child as DiagramNodeItem;
          positionedNodes.push({
            ...nodeChild,
            x: (nodeChild.x || 0) + groupX,
            y: (nodeChild.y || 0) + groupY
          });
        }
      }
    });
  };
  
  // Process all root groups
  nestedData.groups.forEach(group => {
    processGroup(group);
  });
  
  return { positionedGroups, positionedNodes };
}