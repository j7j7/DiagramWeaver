import type { DiagramData, DiagramGroupData, DiagramNodeData, HierarchicalDiagramData, DiagramGroupItem, DiagramNodeItem, DiagramZoneItem, DiagramZoneData } from './types';

/**
 * Convert flat diagram data to nested hierarchical structure
 */
export function convertToNestedHierarchy(data: DiagramData): HierarchicalDiagramData {
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  const zoneMap = new Map(data.zones.map(g => [g.id, g]));
  
  // Build parent-child relationships
  const parentMap = new Map<string, string[]>();
  data.zones.forEach(zone => {
    // Handle both children (new format) and nodes (old format)
    const childIds = zone.children || (zone as any).nodes || [];
    childIds.forEach((childId: string) => {
      if (!parentMap.has(zone.id)) {
        parentMap.set(zone.id, []);
      }
      parentMap.get(zone.id)!.push(childId);
    });
  });
  
  // Find root zones (zones without parents)
  const rootZoneIds = data.zones
    .filter(z => !z.parentId)
    .map(z => z.id);
  
  // Convert each root group to nested structure
  const nestedGroups: DiagramGroupItem[] = rootZoneIds.map(rootId => 
    convertGroupToNested(rootId, zoneMap, nodeMap, parentMap)
  );
  
  // Find orphan nodes (nodes not in any group) and create a group for them
  const allChildNodeIds = new Set<string>();
  data.zones.forEach(zone => {
    // Skip orphan-nodes zones when checking for children
    if (zone.id === 'orphan-nodes') return;
    
    // Handle both children (new format) and nodes (old format)
    const childIds = zone.children || (zone as any).nodes || [];
    childIds.forEach((childId: string) => {
      if (nodeMap.has(childId)) {
        allChildNodeIds.add(childId);
      }
    });
  });
  
  const orphanNodes = data.nodes.filter(n => !allChildNodeIds.has(n.id) && n.type !== 'zone');
  if (orphanNodes.length > 0) {
    const orphanGroup: DiagramZoneItem = {
      id: 'orphan-nodes',
      type: 'zone',
      label: '', // Invisible container
        children: orphanNodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        info: node.info,
        // Orphan nodes keep their x,y coordinates since they're not in a zone
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
         textVerticalPosition: node.textVerticalPosition,
         tag: node.tag,
         tagPosition: node.tagPosition,
         layer: node.layer, // Preserve layer information
         groupId: node.groupId, // Preserve grouping information
         // Text styling properties
         fontFamily: node.fontFamily,
         fontSize: node.fontSize,
         fontWeight: node.fontWeight,
         fontStyle: node.fontStyle,
         textDecoration: node.textDecoration,
         textTransform: node.textTransform,
         letterSpacing: node.letterSpacing,
         lineHeight: node.lineHeight,
         textOpacity: node.textOpacity,
         // Line shape specific properties
         startPos: node.startPos,
         endPos: node.endPos,
         startCap: node.startCap,
         endCap: node.endCap,
         lineThickness: node.lineThickness,
         lineTextVerticalPosition: node.lineTextVerticalPosition,
         // Lock property
         locked: node.locked
       }))
    };
    nestedGroups.push(orphanGroup);
  }
  
  return {
    zones: nestedGroups,
    connections: data.connections,
    groupings: data.groupings, // Preserve groupings
    layers: data.layers // Preserve layers configuration
  };
}

/**
 * Convert a single group and its children to nested structure
 */
function convertGroupToNested(
  groupId: string,
  zoneMap: Map<string, DiagramGroupData>,
  nodeMap: Map<string, DiagramNodeData>,
  parentMap: Map<string, string[]>
): DiagramGroupItem {
  const zone = zoneMap.get(groupId);
  if (!zone) {
    throw new Error(`Zone ${groupId} not found`);
  }
  
  const children = parentMap.get(groupId) || [];
  const nestedChildren: (DiagramNodeItem | DiagramGroupItem)[] = [];
  
  children.forEach(childId => {
    const node = nodeMap.get(childId);
    if (node) {
      // This is a node - in hierarchical format, nodes inside zones don't have x,y coordinates
      nestedChildren.push({
        id: node.id,
        type: node.type,
        label: node.label,
        info: node.info,
        // x and y are omitted for hierarchical format - position is determined by zone layout
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
         textVerticalPosition: node.textVerticalPosition,
         tag: node.tag,
         tagPosition: node.tagPosition,
         layer: node.layer, // Preserve layer information
         groupId: node.groupId, // Preserve grouping information
         // Text styling properties
         fontFamily: node.fontFamily,
         fontSize: node.fontSize,
         fontWeight: node.fontWeight,
         fontStyle: node.fontStyle,
         textDecoration: node.textDecoration,
         textTransform: node.textTransform,
         letterSpacing: node.letterSpacing,
         lineHeight: node.lineHeight,
         textOpacity: node.textOpacity,
         // Line shape specific properties
         startPos: node.startPos,
         endPos: node.endPos,
         startCap: node.startCap,
         endCap: node.endCap,
         lineThickness: node.lineThickness,
         lineTextVerticalPosition: node.lineTextVerticalPosition,
         // Lock property
         locked: node.locked
      });
    } else {
      // This is a nested group
      const nestedGroup = convertGroupToNested(childId, zoneMap, nodeMap, parentMap);
      nestedChildren.push(nestedGroup);
    }
  });
  
  return {
    id: zone.id,
    type: 'zone',
    label: zone.label,
    info: zone.info,
    children: nestedChildren,
    x: zone.x,
    y: zone.y,
    subType: (zone as any).subType,
    color: zone.color,
    borderColor: zone.borderColor,
    textColor: zone.textColor,
    backgroundColor: zone.backgroundColor,
    borderStyle: zone.borderStyle,
    borderColors: zone.borderColors,
    backgroundStyle: zone.backgroundStyle,
    backgroundColors: zone.backgroundColors,
    gradientAngle: zone.gradientAngle,
    orientation: zone.orientation,
    maxItemsPerRow: zone.maxItemsPerRow,
    lineColor: zone.lineColor,
    shadow: zone.shadow,
    objectStyle: (zone as any).objectStyle,
    textPosition: zone.textPosition,
    width: zone.width,
    height: zone.height,
    sizeMode: zone.sizeMode,
    minWidth: zone.minWidth,
    minHeight: zone.minHeight,
    rotation: zone.rotation,
     borderWidth: zone.borderWidth,
     textJustify: zone.textJustify,
     textVerticalPosition: zone.textVerticalPosition,
     tag: zone.tag,
     tagPosition: zone.tagPosition,
     layer: zone.layer, // Preserve layer information
     groupId: zone.groupId, // Preserve grouping information
     // Text styling properties
     fontFamily: zone.fontFamily,
     fontSize: zone.fontSize,
     fontWeight: zone.fontWeight,
     fontStyle: zone.fontStyle,
     textDecoration: zone.textDecoration,
     textTransform: zone.textTransform,
     letterSpacing: zone.letterSpacing,
     lineHeight: zone.lineHeight,
     textOpacity: zone.textOpacity
   };
}

/**
 * Convert nested hierarchical structure back to flat format
 */
export function convertFromNestedHierarchy(nestedData: HierarchicalDiagramData): DiagramData {
  const nodes: DiagramNodeData[] = [];
  const zones: DiagramZoneData[] = [];
  const nodeMap = new Map<string, DiagramNodeData>();
  const zoneMap = new Map<string, DiagramGroupData>();
  
  // Process all zones and collect nodes
  nestedData.zones.forEach(zone => {
    // Special handling for orphan-nodes zone - convert its children directly to nodes
    if (zone.id === 'orphan-nodes') {
      zone.children?.forEach(child => {
        if (child.type !== 'zone') {
          const nodeChild = child as DiagramNodeItem;
          // Skip if node already exists (prevent duplicates)
          if (nodeMap.has(nodeChild.id)) {
            console.warn('Duplicate node detected and skipped:', nodeChild.id);
            return;
          }
          
          const node: DiagramNodeData = {
            id: nodeChild.id,
            type: nodeChild.type,
            label: nodeChild.label,
            info: nodeChild.info,
            // Orphan nodes should preserve their absolute x,y coordinates if present
            // Otherwise default to undefined to let calculateLayout position them
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
             textVerticalPosition: nodeChild.textVerticalPosition,
             tag: nodeChild.tag,
             tagPosition: nodeChild.tagPosition,
             layer: nodeChild.layer, // Preserve layer information
             groupId: nodeChild.groupId, // Preserve grouping information
             // Text styling properties
             fontFamily: nodeChild.fontFamily,
             fontSize: nodeChild.fontSize,
             fontWeight: nodeChild.fontWeight,
             fontStyle: nodeChild.fontStyle,
             textDecoration: nodeChild.textDecoration,
             textTransform: nodeChild.textTransform,
             letterSpacing: nodeChild.letterSpacing,
             lineHeight: nodeChild.lineHeight,
             textOpacity: nodeChild.textOpacity,
             // Line shape specific properties
             startPos: nodeChild.startPos,
             endPos: nodeChild.endPos,
             startCap: nodeChild.startCap,
             endCap: nodeChild.endCap,
             lineThickness: nodeChild.lineThickness,
             lineTextVerticalPosition: nodeChild.lineTextVerticalPosition,
             // Lock property
             locked: nodeChild.locked
          };
          nodes.push(node);
          nodeMap.set(nodeChild.id, node);
        }
      });
    } else {
      processNestedGroup(zone, nodes, zones, nodeMap, zoneMap, null);
    }
  });
  
  // Final deduplication check to ensure no duplicates
  const uniqueNodes = Array.from(nodeMap.values());
  const uniqueZones = Array.from(zoneMap.values());
  
  // Filter out orphan-nodes zone - it's just a container and shouldn't be rendered
  const filteredZones = uniqueZones.filter(zone => zone.id !== 'orphan-nodes');
  
  return {
    nodes: uniqueNodes,
    connections: nestedData.connections,
    zones: filteredZones,
    groupings: nestedData.groupings, // Preserve groupings
    rootZoneId: filteredZones.find(g => !g.parentId)?.id,
    layers: nestedData.layers // Preserve layers configuration
  };
}

/**
 * Process a nested group and convert to flat format
 */
function processNestedGroup(
  zone: DiagramZoneItem,
  nodes: DiagramNodeData[],
  zones: DiagramZoneData[],
  nodeMap: Map<string, DiagramNodeData>,
  zoneMap: Map<string, DiagramGroupData>,
  parentId: string | null
): void {
  // Skip if zone already exists (prevent duplicates)
  if (zoneMap.has(zone.id)) {
    console.warn('Duplicate zone detected and skipped:', zone.id);
    return;
  }
  
  // Create flat zone
  const flatZone: DiagramZoneData = {
    id: zone.id,
    type: 'zone',
    label: zone.label,
    children: [],
    info: zone.info,
    x: zone.x,
    y: zone.y,
    subType: zone.subType,
    color: zone.color,
    borderColor: zone.borderColor,
    textColor: zone.textColor,
    backgroundColor: zone.backgroundColor,
    borderStyle: zone.borderStyle,
    borderColors: zone.borderColors,
    backgroundStyle: zone.backgroundStyle,
    backgroundColors: zone.backgroundColors,
    gradientAngle: zone.gradientAngle,
    orientation: zone.orientation,
    maxItemsPerRow: zone.maxItemsPerRow,
    lineColor: zone.lineColor,
    shadow: zone.shadow,
    objectStyle: zone.objectStyle,
    textPosition: zone.textPosition,
    width: zone.width,
    height: zone.height,
    sizeMode: zone.sizeMode,
    minWidth: zone.minWidth,
    minHeight: zone.minHeight,
    rotation: zone.rotation,
    borderWidth: zone.borderWidth,
    parentId: parentId || undefined,
     textJustify: zone.textJustify,
     textVerticalPosition: zone.textVerticalPosition,
     tag: zone.tag,
     tagPosition: zone.tagPosition,
     layer: zone.layer, // Preserve layer information
     groupId: zone.groupId, // Preserve grouping information
     // Text styling properties
     fontFamily: zone.fontFamily,
     fontSize: zone.fontSize,
     fontWeight: zone.fontWeight,
     fontStyle: zone.fontStyle,
     textDecoration: zone.textDecoration,
     textTransform: zone.textTransform,
     letterSpacing: zone.letterSpacing,
     lineHeight: zone.lineHeight,
     textOpacity: zone.textOpacity
  };
  
  zones.push(flatZone);
  zoneMap.set(zone.id, flatZone);
  
  // Process children
  zone.children?.forEach(child => {
    if (child.type === 'zone') {
      // This is a nested zone
      processNestedGroup(child as DiagramZoneItem, nodes, zones, nodeMap, zoneMap, zone.id);
      flatZone.children.push(child.id);
    } else {
      // This is a node
      const nodeChild = child as DiagramNodeItem;
      
      // Skip if node already exists (prevent duplicates)
      if (nodeMap.has(nodeChild.id)) {
        console.warn('Duplicate node detected and skipped:', nodeChild.id);
        // Still add to zone's children list
        flatZone.children.push(child.id);
        return;
      }
      
      const node: DiagramNodeData = {
        id: nodeChild.id,
        type: nodeChild.type,
        label: nodeChild.label,
        info: nodeChild.info,
        // In nested format, nodes inside zones don't have x,y coordinates
        // Use 0,0 as default relative position - layoutZone will recalculate proper grid positions
        x: nodeChild.x ?? 0,
        y: nodeChild.y ?? 0,
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
         textVerticalPosition: nodeChild.textVerticalPosition,
         tag: nodeChild.tag,
         tagPosition: nodeChild.tagPosition,
         layer: nodeChild.layer, // Preserve layer information
         groupId: nodeChild.groupId, // Preserve grouping information
         // Text styling properties
         fontFamily: nodeChild.fontFamily,
         fontSize: nodeChild.fontSize,
         fontWeight: nodeChild.fontWeight,
         fontStyle: nodeChild.fontStyle,
         textDecoration: nodeChild.textDecoration,
         textTransform: nodeChild.textTransform,
         letterSpacing: nodeChild.letterSpacing,
         lineHeight: nodeChild.lineHeight,
         textOpacity: nodeChild.textOpacity,
         // Line shape specific properties
         startPos: nodeChild.startPos,
         endPos: nodeChild.endPos,
         startCap: nodeChild.startCap,
         endCap: nodeChild.endCap,
         lineThickness: nodeChild.lineThickness,
         lineTextVerticalPosition: nodeChild.lineTextVerticalPosition,
         // Lock property
         locked: nodeChild.locked
      };
    
      nodes.push(node);
      nodeMap.set(child.id, node);
      flatZone.children.push(child.id);
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
  const childZones = group.children.filter(child => child.type === 'group') as DiagramGroupItem[];
  
  // If no children, return minimum size
  if (childNodes.length === 0 && childZones.length === 0) {
    return {
      width: nodeWidth + groupPadding * 2,
      height: nodeHeight + groupPadding * 2
    };
  }
  
  // Calculate dimensions for child groups first
  const laidOutChildGroups = childZones.map(cg => {
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
  
  const processGroup = (group: DiagramZoneItem, parentX: number = 0, parentY: number = 0) => {
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
    };
    
    positionedGroups.push(positionedGroup);
    
    // Process children
    group.children?.forEach(child => {
      if (child.type === 'zone') {
        processGroup(child as DiagramZoneItem, groupX, groupY);
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
  
  // Process all root zones
  nestedData.zones.forEach(zone => {
    processGroup(zone);
  });
  
  return { positionedGroups, positionedNodes };
}