import type { DiagramData, DiagramNodeData, DiagramZoneData, DiagramGroupData } from "@/lib/types";
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  BASE_NODE_HEIGHT,
  TEXT_NODE_HEIGHT,
  EXTRA_LINE_HEIGHT,
  ZONE_PADDING,
  ZONE_NODE_SPACING,
  MULTI_LINE_SPACING_BONUS,
  measureNodeDims,
  type PositionedNode,
  type PositionedGroup,
} from "./canvas-constants";

export function recalculateGroupSize(
  zone: DiagramGroupData,
  allNodes: DiagramNodeData[],
  allGroups: DiagramZoneData[]
): DiagramGroupData {
  // If zone is in custom sizing mode, don't resize it - just return as-is
  if (zone.sizeMode === 'custom') {
    return zone;
  }
  
  const childNodes = allNodes.filter(n => zone.children.includes(n.id));
  const childZones = allGroups.filter((g: DiagramGroupData) => zone.children.includes(zone.id));
  
  if (childNodes.length === 0 && childZones.length === 0) {
    // Empty zone - use larger minimum size to accommodate potential textbox nodes
    return {
      ...zone,
      width: Math.max(NODE_WIDTH + ZONE_PADDING * 2, 300), // Larger minimum width
      height: Math.max(NODE_HEIGHT + ZONE_PADDING * 2, 200) // Larger minimum height
    };
  }
  
  // Calculate maximum dimensions among all children
  const allChildDims = [
    ...childNodes.map(n => measureNodeDims(n as PositionedNode)),
    ...childZones.map(zone => ({ width: zone.width || 300, height: zone.height || 220 }))
  ];
  
  const maxChildWidth = Math.max(...allChildDims.map(d => d.width));
  const maxChildHeight = Math.max(...allChildDims.map(d => d.height));
  
  // Calculate required group size based on actual grid layout
  const allChildren = [...childNodes, ...childZones];
  const numChildren = allChildren.length;
  const itemsPerRow = zone.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numChildren) * 1.2));
  const numRows = Math.ceil(numChildren / itemsPerRow);
  
  // Calculate actual grid layout to determine proper dimensions
  let totalWidth = 0;
  let totalHeight = 0;
  let maxRowWidth = 0;
  let maxRowHeight = 0;
  
  for (let row = 0; row < numRows; row++) {
    const startIndex = row * itemsPerRow;
    const endIndex = Math.min(startIndex + itemsPerRow, numChildren);
    const rowChildren = allChildren.slice(startIndex, endIndex);
    
    // Calculate dimensions for this row
    let rowWidth = 0;
    let rowHeight = 0;
    
    rowChildren.forEach(child => {
      const dims = 'type' in child 
        ? measureNodeDims(child as PositionedNode)
        : { width: (child as DiagramGroupData).width || 300, height: (child as DiagramGroupData).height || 220 };
      
      rowWidth += dims.width;
      rowHeight = Math.max(rowHeight, dims.height);
    });
    
    // Add spacing between items in row
    if (rowChildren.length > 1) {
      rowWidth += ZONE_NODE_SPACING * (rowChildren.length - 1);
    }
    
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
    totalHeight += rowHeight;
    
    // Add dynamic spacing between rows (except for last row)
    if (row < numRows - 1) {
      let spacing = ZONE_NODE_SPACING;
      
      // Calculate height excess for current and next row
      const getMaxHeightExcess = (rowItems: any[]): number => {
        let maxExcess = 0;
        rowItems.forEach((child: any) => {
          if ('type' in child && (child as any).type === 'zone') return;
          const dims = 'type' in child 
            ? measureNodeDims(child as PositionedNode)
            : { width: (child as DiagramGroupData).width || 300, height: (child as DiagramGroupData).height || 220 };
          
          const node = child as PositionedNode;
          let baseHeight = NODE_HEIGHT;
          if (node.type === 'generic.text.text') {
            baseHeight = TEXT_NODE_HEIGHT;
          } else if (node.type === 'generic.text.textbox') {
            baseHeight = 40;
          }
          
          const excess = Math.max(0, dims.height - baseHeight);
          maxExcess = Math.max(maxExcess, excess);
        });
        return maxExcess;
      };
      
      const currentRowExcess = getMaxHeightExcess(rowChildren);
      const nextRowChildren = allChildren.slice((row + 1) * itemsPerRow, Math.min((row + 2) * itemsPerRow, numChildren));
      const nextRowExcess = getMaxHeightExcess(nextRowChildren);
      
      const maxExcess = Math.max(currentRowExcess, nextRowExcess);
      if (maxExcess > 0) {
        spacing += MULTI_LINE_SPACING_BONUS + Math.min(maxExcess * 0.5, 10);
      }
      
      totalHeight += spacing;
    }
  }
  
  const requiredWidth = maxRowWidth + ZONE_PADDING * 2;
  const requiredHeight = totalHeight + ZONE_PADDING * 2;
  
  return {
    ...zone,
    width: Math.max(requiredWidth, maxChildWidth + ZONE_PADDING * 2),
    height: Math.max(requiredHeight, maxChildHeight + ZONE_PADDING * 2)
  };
}

function redistributeItemsInCustomZone(
  zone: DiagramZoneData,
  childNodes: DiagramNodeData[],
  childZones: DiagramZoneData[],
  measureNodeDimsFn: (n: PositionedNode) => { width: number; height: number }
) {
  if (!zone.width || !zone.height) return;

  // Cache node measurements so dynamic text nodes are consistent within this pass
  const nodeDimsCache = new Map<string, { width: number; height: number }>();
  const getNodeDims = (node: DiagramNodeData) => {
    if (!nodeDimsCache.has(node.id)) {
      nodeDimsCache.set(node.id, measureNodeDimsFn(node as PositionedNode));
    }
    return nodeDimsCache.get(node.id)!;
  };
  const getChildDims = (child: DiagramNodeData | DiagramZoneData) => {
    if ((child as DiagramZoneData).type === 'zone') {
      return {
        width: (child as PositionedGroup).width || 300,
        height: (child as PositionedGroup).height || 220,
      };
    }
    return getNodeDims(child as DiagramNodeData);
  };

  // Separate edge-positioned nodes from regular nodes
  const regularNodes = childNodes.filter(n => !n.edgePosition);
  const edgeNodes = childNodes.filter(n => n.edgePosition);

  // All regular children (nodes and zones)
  const regularChildren = [...regularNodes, ...childZones];

  if (regularChildren.length > 0) {
    const childLayouts = regularChildren.map(child => ({ child, dims: getChildDims(child) }));
    const availableWidth = Math.max(0, zone.width - (ZONE_PADDING * 2));
    const widestChildWidth = Math.max(...childLayouts.map(({ dims }) => dims.width), NODE_WIDTH);
    const widthPerItem = widestChildWidth + ZONE_NODE_SPACING;
    const widthBasedLimit = Math.max(1, Math.floor(availableWidth / Math.max(widthPerItem, 1))); // Ensure at least one per row

    // Determine items per row based on available space and orientation
    let itemsPerRow: number;
    if (zone.orientation === 'vertical') {
      itemsPerRow = 1;
    } else if (zone.orientation === 'horizontal') {
      itemsPerRow = zone.maxItemsPerRow || widthBasedLimit;
    } else {
      const approxSquare = Math.max(1, Math.floor(Math.sqrt(childLayouts.length) * 1.2));
      itemsPerRow = zone.maxItemsPerRow || Math.min(approxSquare, widthBasedLimit);
    }

    itemsPerRow = Math.max(1, Math.min(itemsPerRow, childLayouts.length));

    // Organize children into rows
    let rowMaxHeight = 0;
    const rows: Array<{ children: any[]; rowWidth: number; rowHeight: number }> = [];
    let currentRow: any[] = [];

    // First pass: organize children into rows and calculate row dimensions
    childLayouts.forEach(({ child, dims }, index) => {
      currentRow.push({ child, width: dims.width, height: dims.height });
      rowMaxHeight = Math.max(rowMaxHeight, dims.height);
      
      // End of row
      if (index === childLayouts.length - 1 || (index + 1) % itemsPerRow === 0) {
        const rowWidth = currentRow.reduce((sum, item) => sum + item.width + ZONE_NODE_SPACING, 0) - ZONE_NODE_SPACING;
        rows.push({
          children: currentRow,
          rowWidth: rowWidth,
          rowHeight: rowMaxHeight
        });
        currentRow = [];
        rowMaxHeight = 0;
      }
    });

    // Calculate minimum total height needed with dynamic spacing
    let minTotalHeight = 0;
    const rowSpacings: number[] = [];
    
    rows.forEach((row, rowIndex) => {
      // Calculate dynamic spacing based on node heights
      let spacing = ZONE_NODE_SPACING;
      
      // Calculate maximum height excess (how much taller than base height) for current and next row
      const getMaxHeightExcess = (rowItems: any[]): number => {
        let maxExcess = 0;
        rowItems.forEach((item: any) => {
          if ((item.child as any).type === 'zone') return;
          const node = item.child as PositionedNode;
          const height = item.height;
          
          // Calculate how much taller this node is than its base height
          let baseHeight = NODE_HEIGHT;
          if (node.type === 'generic.text.text') {
            baseHeight = TEXT_NODE_HEIGHT;
          } else if (node.type === 'generic.text.textbox') {
            baseHeight = 40;
          }
          
          const excess = Math.max(0, height - baseHeight);
          maxExcess = Math.max(maxExcess, excess);
        });
        return maxExcess;
      };
      
      const currentRowExcess = getMaxHeightExcess(row.children);
      let nextRowExcess = 0;
      
      if (rowIndex < rows.length - 1) {
        nextRowExcess = getMaxHeightExcess(rows[rowIndex + 1].children);
      }
      
      // Add extra spacing proportional to height excess (minimum bonus if any excess exists)
      const maxExcess = Math.max(currentRowExcess, nextRowExcess);
      if (maxExcess > 0) {
        // Add base bonus plus proportional amount based on excess height
        spacing += MULTI_LINE_SPACING_BONUS + Math.min(maxExcess * 0.5, 10);
      } else {
        // Fallback: also add spacing if row height itself is above threshold (catches edge cases)
        const rowHeightThreshold = NODE_HEIGHT + EXTRA_LINE_HEIGHT * 0.5; // 90px
        if (row.rowHeight > rowHeightThreshold || (rowIndex < rows.length - 1 && rows[rowIndex + 1].rowHeight > rowHeightThreshold)) {
          spacing += MULTI_LINE_SPACING_BONUS;
        }
      }
      
      rowSpacings.push(spacing);
      minTotalHeight += row.rowHeight;
      if (rowIndex < rows.length - 1) {
        minTotalHeight += spacing;
      }
    });

    // Calculate available space for distribution
    const availableHeight = (zone.height || 0) - (ZONE_PADDING * 2);
    const extraHeight = Math.max(0, availableHeight - minTotalHeight);
    
    // Distribute extra space evenly between rows AND at top/bottom
    const numSpaces = Math.max(1, rows.length - 1);
    let extraSpacingPerGap = 0;
    let topPadding = ZONE_PADDING;
    
    if (extraHeight > 0) {
      // Distribute extra height evenly: between rows and at top/bottom
      extraSpacingPerGap = extraHeight / (numSpaces + 2); // +2 for top and bottom padding
      topPadding = ZONE_PADDING + extraSpacingPerGap;
    }
    
    // Second pass: position children with distribution across available space
    let currentY = topPadding;
    rows.forEach((row, rowIndex) => {
      // Calculate horizontal distribution for items in row
      const availableRowWidth = (zone.width || 0) - (ZONE_PADDING * 2);
      const totalRowItemWidth = row.children.reduce((sum, item) => sum + item.width, 0);
      
      // For vertical orientation (single item per row), center each item
      if (zone.orientation === 'vertical' && row.children.length === 1) {
        // Center the single item horizontally
        const item = row.children[0];
        item.child.x = ZONE_PADDING + (availableRowWidth - item.width) / 2;
        item.child.y = currentY;
      } else {
        // Calculate spacing between items - distribute extra space evenly
        const numItemSpaces = Math.max(1, row.children.length - 1);
        const minTotalWidth = totalRowItemWidth + (ZONE_NODE_SPACING * numItemSpaces);
        
        let itemSpacing: number;
        let rowStartX: number;
        
        if (availableRowWidth > minTotalWidth) {
          // Distribute evenly across available width with equal padding on both sides
          const extraWidth = availableRowWidth - minTotalWidth;
          // Add extra space to both sides and between items
          const extraSpacingPerGap = extraWidth / (numItemSpaces + 2); // +2 for left and right padding
          itemSpacing = ZONE_NODE_SPACING + extraSpacingPerGap;
          const sidePadding = ZONE_PADDING + extraSpacingPerGap;
          rowStartX = sidePadding;
        } else {
          // Use minimum spacing, center if content is wider than available space
          itemSpacing = ZONE_NODE_SPACING;
          if (availableRowWidth > totalRowItemWidth) {
            rowStartX = ZONE_PADDING + (availableRowWidth - minTotalWidth) / 2;
          } else {
            rowStartX = ZONE_PADDING;
          }
        }
        
        row.children.forEach((item, itemIndex) => {
          if (itemIndex === 0) {
            item.child.x = rowStartX;
          } else {
            item.child.x = rowStartX + row.children.slice(0, itemIndex).reduce((sum, prevItem) => {
              return sum + prevItem.width + itemSpacing;
            }, 0);
          }
          item.child.y = currentY;
        });
      }
      
      // Use distributed spacing (minimum spacing + extra space distribution)
      const spacing = rowIndex < rows.length - 1 
        ? rowSpacings[rowIndex] + extraSpacingPerGap 
        : 0;
      
      currentY += row.rowHeight + spacing;
    });
  }

  // Position edge nodes on the boundaries
  if (edgeNodes.length > 0) {
    const nodesByEdge = {
      top: edgeNodes.filter(n => n.edgePosition === 'top'),
      bottom: edgeNodes.filter(n => n.edgePosition === 'bottom'),
      left: edgeNodes.filter(n => n.edgePosition === 'left'),
      right: edgeNodes.filter(n => n.edgePosition === 'right'),
    };

    Object.entries(nodesByEdge).forEach(([edge, nodes]) => {
      if (nodes.length === 0) return;

      nodes.forEach((node, index) => {
        const dims = getNodeDims(node);

        switch (edge) {
          case 'top': {
            const segmentWidth = zone.width! / nodes.length;
            const centerX = segmentWidth * index + segmentWidth / 2;
            node.x = centerX - dims.width / 2;
            node.y = -dims.height / 2 + dims.height * 0.1;
            break;
          }
          case 'bottom': {
            const segmentWidth = zone.width! / nodes.length;
            const centerX = segmentWidth * index + segmentWidth / 2;
            node.x = centerX - dims.width / 2;
            node.y = zone.height! - dims.height / 2 + dims.height * 0.1;
            break;
          }
          case 'left': {
            const segmentHeight = zone.height! / nodes.length;
            const centerY = segmentHeight * index + segmentHeight / 2;
            node.x = -dims.width / 2;
            node.y = centerY - dims.height / 2;
            break;
          }
          case 'right': {
            const segmentHeight = zone.height! / nodes.length;
            const centerY = segmentHeight * index + segmentHeight / 2;
            node.x = zone.width! - dims.width / 2;
            node.y = centerY - dims.height / 2;
            break;
          }
        }
      });
    });
  }
}

function layoutZone(
  zone: DiagramZoneData,
  allItems: { [id: string]: DiagramNodeData | DiagramZoneData | PositionedNode | PositionedGroup },
  measureNodeDimsFn: (n: PositionedNode) => { width: number; height: number }
): { width: number; height: number } {
  // If zone has free layout mode or circular layout, respect existing positions and just calculate size
  if (zone.layoutMode === 'free' || zone.layoutType === 'circular') {
    const childNodes = zone.children
      .map((id: string) => allItems[id])
      .filter(Boolean)
      .filter((c: any) => !c.type || c.type !== 'zone') as DiagramNodeData[];
    
    const childZones = zone.children
      .map((id: string) => allItems[id])
      .filter(Boolean)
      .filter((c: any) => c.type === 'zone') as DiagramZoneData[];
      
    // Layout child zones first
    childZones.forEach(cz => {
      const dims = layoutZone(cz, allItems, measureNodeDimsFn);
      (cz as any).width = dims.width;
      (cz as any).height = dims.height;
    });
    
    // Calculate bounds based on children positions
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const allChildren = [...childNodes, ...childZones];
    
    if (allChildren.length === 0) {
      // Default size for empty free zone
      const minWidth = 300;
      const minHeight = 200;
      (zone as PositionedGroup).width = minWidth;
      (zone as PositionedGroup).height = minHeight;
      return { width: minWidth, height: minHeight };
    }

    allChildren.forEach(child => {
       const dims = (child as any).type === 'zone' 
         ? { width: (child as any).width || 300, height: (child as any).height || 220 }
         : measureNodeDimsFn(child as PositionedNode);
       
       const x = (child.x || 0);
       const y = (child.y || 0);
       minX = Math.min(minX, x);
       minY = Math.min(minY, y);
       maxX = Math.max(maxX, x + dims.width);
       maxY = Math.max(maxY, y + dims.height);
    });
    
    // Add padding
    let width = Math.max(maxX - minX + ZONE_PADDING, 150);
    let height = Math.max(maxY - minY + ZONE_PADDING, 100);

    // If it's a circular layout, force width and height to be equal (max of both) to ensure a circle
    if (zone.layoutType === 'circular') {
        const diameter = Math.max(width, height);
        width = diameter;
        height = diameter;
    }
    
    (zone as PositionedGroup).width = width;
    (zone as PositionedGroup).height = height;

    // Shift children to align them within the bounds
    // For circular zones: Normalize positions to be relative to zone origin
    // For free layout zones: align with padding
    if (zone.layoutType === 'circular') {
        // For circular zones, normalize child positions to be zone-relative
        // The center of the circular zone should be at (width/2, height/2) in zone-relative coords
        // If items appear offset, it's because they have absolute coordinates that need normalization
        
        // Calculate where the center should be in zone-relative coordinates
        const centerX = width / 2;
        const centerY = height / 2;
        
        // If children have absolute positions (e.g., after moving the zone),
        // we need to normalize them by removing the zone's position
        // The zone's position is added to child positions by setAbsolutePositionsForZone
        // So we need to subtract it to get back to zone-relative
        
        // Calculate the current bounds center (in absolute coordinates)
        const currentCenterX = minX + (maxX - minX) / 2;
        const currentCenterY = minY + (maxY - minY) / 2;
        
        // Calculate shift needed to center items within the zone
        const shiftX = centerX - currentCenterX;
        const shiftY = centerY - currentCenterY;

        if (shiftX !== 0 || shiftY !== 0) {
            allChildren.forEach(child => {
                child.x = (child.x || 0) + shiftX;
                child.y = (child.y || 0) + shiftY;
            });
        }
    } else if (zone.layoutMode === 'free') {
        const shiftX = ZONE_PADDING - minX;
        const shiftY = ZONE_PADDING - minY;

        if (shiftX !== 0 || shiftY !== 0) {
            allChildren.forEach(child => {
                child.x = (child.x || 0) + shiftX;
                child.y = (child.y || 0) + shiftY;
            });
        }
    }

    return { width, height };
  }

  // If zone has custom sizing, use those dimensions and redistribute content within
  if (zone.sizeMode === 'custom' && zone.width && zone.height) {
    const childNodes = zone.children
      .map((id: string) => allItems[id])
      .filter(Boolean)
      .filter((c: any) => !c.type || c.type !== 'zone') as DiagramNodeData[];
    
    const childZones = zone.children
      .map((id: string) => allItems[id])
      .filter(Boolean)
      .filter((c: any) => c.type === 'zone') as DiagramZoneData[];
      
    // Layout child zones first
    childZones.forEach(cz => {
      const dims = layoutZone(cz, allItems, measureNodeDimsFn);
      (cz as any).width = dims.width;
      (cz as any).height = dims.height;
    });
    
    // Redistribute items within the custom size
    redistributeItemsInCustomZone(zone, childNodes, childZones, measureNodeDimsFn);
    
    return { width: zone.width, height: zone.height };
  }
  
  // Auto-sizing logic (only for non-custom zones)
  const childNodes = zone.children
    .map((id: string) => allItems[id])
    .filter(Boolean)
    .filter((c: any) => !c.type || c.type !== 'zone') as DiagramNodeData[];
  
  const childZones = zone.children
    .map((id: string) => allItems[id])
    .filter(Boolean)
    .filter((c: any) => c.type === 'zone') as DiagramZoneData[];

  // Separate edge-positioned nodes from regular nodes
  const regularNodes = childNodes.filter(n => !n.edgePosition);
  const edgeNodes = childNodes.filter(n => n.edgePosition);

  let contentWidth = 0;
  let contentHeight = 0;

  // Layout child zones first and get their dimensions (mutate originals so positions persist)
  const laidOutChildGroups = childZones.map(cz => {
    const dims = layoutZone(cz, allItems, measureNodeDimsFn);
    (cz as any).width = dims.width;
    (cz as any).height = dims.height;
    return cz; // IMPORTANT: return original reference so x/y set below apply to allItems
  });

  // Grid layout for regular children (nodes and zones) with orientation and maxItemsPerRow support
  // Edge-positioned nodes are handled separately
  const allChildren = [...regularNodes, ...laidOutChildGroups];
  const numItems = allChildren.length;
  
  // Determine items per row based on orientation and maxItemsPerRow
  let itemsPerRow: number;
  if (zone.orientation === 'vertical') {
    // Vertical orientation: single column, but respect maxItemsPerRow for column height
    itemsPerRow = 1;
  } else if (zone.orientation === 'horizontal') {
    // Horizontal orientation: use a reasonable default to create multiple rows but maintain width
    itemsPerRow = zone.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
  } else {
    // Square orientation: use maxItemsPerRow if specified, otherwise calculate
    itemsPerRow = zone.maxItemsPerRow || Math.max(1, Math.floor(Math.sqrt(numItems) * 1.2));
  }
  
  // For zones with no regular children, ensure minimum size to accommodate content
  // Consider edge nodes when determining if zone is truly empty
  if (numItems === 0) {
    // Calculate maximum dimensions among all nodes (including edge nodes) for proper zone sizing
    const allNodesInGroup = [...regularNodes, ...edgeNodes];
    const maxNodeWidth = allNodesInGroup.length > 0 
      ? Math.max(...allNodesInGroup.map(n => measureNodeDimsFn(n as PositionedNode).width))
      : NODE_WIDTH;
    const maxNodeHeight = allNodesInGroup.length > 0 
      ? Math.max(...allNodesInGroup.map(n => measureNodeDimsFn(n as PositionedNode).height))
      : NODE_HEIGHT;
    
    let minGroupWidth = maxNodeWidth + (ZONE_PADDING * 2);
    let minGroupHeight = maxNodeHeight + (ZONE_PADDING * 2);
    
    // If we have edge nodes but no regular nodes, ensure adequate space for edge positioning
    if (edgeNodes.length > 0) {
      // Use orientation-specific minimum dimensions for edge nodes
      if (zone.orientation === 'vertical') {
        // Vertical: need enough width for edge nodes, but keep it tall and thin
        minGroupWidth = Math.max(minGroupWidth, maxNodeWidth + ZONE_PADDING * 1.5);
        minGroupHeight = Math.max(minGroupHeight, maxNodeHeight * 3 + ZONE_PADDING * 2);
      } else if (zone.orientation === 'horizontal') {
        // Horizontal: need enough height for edge nodes, but keep it wide and short
        minGroupWidth = Math.max(minGroupWidth, maxNodeWidth * 3 + ZONE_PADDING * 2);
        minGroupHeight = Math.max(minGroupHeight, maxNodeHeight + ZONE_PADDING * 1.5);
      } else {
        // Square: use balanced dimensions
        minGroupWidth = Math.max(minGroupWidth, maxNodeWidth * 2 + ZONE_PADDING * 2);
        minGroupHeight = Math.max(minGroupHeight, maxNodeHeight * 2 + ZONE_PADDING * 2);
      }
    }
    
    (zone as PositionedGroup).width = minGroupWidth;
    (zone as PositionedGroup).height = minGroupHeight;
    
    // Position edge nodes even when there are no regular children
    // Group nodes by edge position for even distribution
    const nodesByEdge = {
      top: edgeNodes.filter(n => n.edgePosition === 'top'),
      bottom: edgeNodes.filter(n => n.edgePosition === 'bottom'),
      left: edgeNodes.filter(n => n.edgePosition === 'left'),
      right: edgeNodes.filter(n => n.edgePosition === 'right')
    };
    
    // Position nodes evenly along each edge
    Object.entries(nodesByEdge).forEach(([edge, nodes]) => {
      if (nodes.length === 0) return;
      
      // Use actual node dimensions for edge positioning
      const nodeWidth = nodes.length > 0 ? measureNodeDimsFn(nodes[0] as PositionedNode).width : NODE_WIDTH;
      const nodeHeight = nodes.length > 0 ? measureNodeDimsFn(nodes[0] as PositionedNode).height : NODE_HEIGHT;
      
      nodes.forEach((node, index) => {
        switch (edge) {
          case 'top':
          case 'bottom':
          // Distribute horizontally along top/bottom edges
          if (nodes.length === 1) {
            node.x = (minGroupWidth - nodeWidth) / 2;
          } else {
            const spacing = minGroupWidth / (nodes.length + 1);
            node.x = spacing * (index + 1) - (nodeWidth / 2);
          }
            node.y = edge === 'top' 
              ? -nodeHeight / 2 + nodeHeight * 0.1
              : minGroupHeight - nodeHeight / 2 + nodeHeight * 0.1;
            break;
            
          case 'left':
          case 'right':
            // Distribute vertically along left/right edges
            node.x = edge === 'left'
              ? -nodeWidth / 2
              : minGroupWidth - nodeWidth / 2;
            if (nodes.length === 1) {
              node.y = (minGroupHeight - nodeHeight) / 2;
            } else {
              const spacing = minGroupHeight / (nodes.length + 1);
              node.y = spacing * (index + 1) - (nodeHeight / 2);
            }
            break;
        }
      });
    });
    
    return { width: minGroupWidth, height: minGroupHeight };
  }
  
  let currentY = ZONE_PADDING;
  let rowMaxHeight = 0;
  const rows: Array<{ children: any[]; rowWidth: number; rowHeight: number }> = [];
  let currentRow: any[] = [];

  // First pass: organize children into rows and calculate row dimensions
  allChildren.forEach((child, index) => {
    // Use different dimension calculation for zones vs nodes
    let childWidth: number;
    let childHeight: number;
    
    if ((child as any).type === 'zone') {
      // For zones, use their calculated width and height from the recursive layout call
      childWidth = (child as any).width || 300;
      childHeight = (child as any).height || 220;
    } else {
      // For nodes, use the measureNodeDims function
      const childDims = measureNodeDimsFn(child as PositionedNode);
      childWidth = childDims.width;
      childHeight = childDims.height;
    }
    
    currentRow.push({ child, width: childWidth, height: childHeight });
    rowMaxHeight = Math.max(rowMaxHeight, childHeight);
    
    // End of row
    if (index === allChildren.length - 1 || (index + 1) % itemsPerRow === 0) {
      const rowWidth = currentRow.reduce((sum, item) => sum + item.width + ZONE_NODE_SPACING, 0) - ZONE_NODE_SPACING;
      rows.push({
        children: currentRow,
        rowWidth: rowWidth,
        rowHeight: rowMaxHeight
      });
      currentRow = [];
      rowMaxHeight = 0;
    }
  });

  // Calculate total content width for auto-sized zones
  let calculatedContentWidth: number;
  if (zone.orientation === 'horizontal') {
    // For horizontal orientation, calculate width based on itemsPerRow to maintain consistent width
    // Get the dimensions of the first few items to estimate width
    const sampleItems = allChildren.slice(0, Math.min(itemsPerRow, allChildren.length));
    const estimatedWidth = sampleItems.reduce((sum, child) => {
      let childWidth: number;
      if ((child as any).type === 'zone') {
        childWidth = (child as any).width || 300;
      } else {
        const childDims = measureNodeDimsFn(child as PositionedNode);
        childWidth = childDims.width;
      }
      return sum + childWidth + ZONE_NODE_SPACING;
    }, 0) - ZONE_NODE_SPACING;
    calculatedContentWidth = estimatedWidth;
  } else {
    // For other orientations, use the maximum row width
    calculatedContentWidth = Math.max(...rows.map(row => row.rowWidth), 0);
  }

  // Determine the actual zone width to use for layout
  // Use reduced padding for both vertical and horizontal orientations to make them tighter
  const horizontalPadding = zone.orientation === 'vertical' ? ZONE_PADDING * 0.5 : 
                           zone.orientation === 'horizontal' ? ZONE_PADDING * 0.5 : 
                           ZONE_PADDING;
  const actualGroupWidth = zone.sizeMode === 'custom' && zone.width ? 
                         zone.width : 
                         calculatedContentWidth + horizontalPadding * 2;

  // Second pass: position children with centering
  let lastSpacing = ZONE_NODE_SPACING;
  rows.forEach((row, rowIndex) => {
    // Calculate horizontal offset to center the row within the zone
    const horizontalOffset = horizontalPadding + (actualGroupWidth - horizontalPadding * 2 - row.rowWidth) / 2;
    
    row.children.forEach((item, itemIndex) => {
      item.child.x = horizontalOffset + (itemIndex > 0 ? 
        row.children.slice(0, itemIndex).reduce((sum, prevItem) => sum + prevItem.width + ZONE_NODE_SPACING, 0) : 0);
      item.child.y = currentY;
    });
    
    // Calculate dynamic spacing based on node heights
    let spacing = ZONE_NODE_SPACING;
    
    // Calculate maximum height excess (how much taller than base height) for current and next row
    const getMaxHeightExcess = (rowItems: any[]): number => {
      let maxExcess = 0;
      rowItems.forEach((item: any) => {
        if ((item.child as any).type === 'zone') return;
        const node = item.child as PositionedNode;
        const height = item.height;
        
        // Calculate how much taller this node is than its base height
        let baseHeight = NODE_HEIGHT;
        if (node.type === 'generic.text.text') {
          baseHeight = TEXT_NODE_HEIGHT;
        } else if (node.type === 'generic.text.textbox') {
          baseHeight = 40;
        }
        
        const excess = Math.max(0, height - baseHeight);
        maxExcess = Math.max(maxExcess, excess);
      });
      return maxExcess;
    };
    
    const currentRowExcess = getMaxHeightExcess(row.children);
    let nextRowExcess = 0;
    
    if (rowIndex < rows.length - 1) {
      nextRowExcess = getMaxHeightExcess(rows[rowIndex + 1].children);
    }
    
    // Add extra spacing proportional to height excess (minimum bonus if any excess exists)
    const maxExcess = Math.max(currentRowExcess, nextRowExcess);
    if (maxExcess > 0) {
      // Add base bonus plus proportional amount based on excess height
      spacing += MULTI_LINE_SPACING_BONUS + Math.min(maxExcess * 0.5, 10);
    } else {
      // Fallback: also add spacing if row height itself is above threshold (catches edge cases)
      const rowHeightThreshold = NODE_HEIGHT + EXTRA_LINE_HEIGHT * 0.5; // 90px
      if (row.rowHeight > rowHeightThreshold || (rowIndex < rows.length - 1 && rows[rowIndex + 1].rowHeight > rowHeightThreshold)) {
        spacing += MULTI_LINE_SPACING_BONUS;
      }
    }
    
    lastSpacing = spacing;
    currentY += row.rowHeight + spacing;
  });

  contentHeight = currentY - lastSpacing;
  contentWidth = calculatedContentWidth;

  // Calculate zone dimensions
  let zoneWidth = actualGroupWidth;
  // Use reduced padding for both vertical and horizontal orientations to make them tighter
  const verticalPadding = zone.orientation === 'vertical' ? ZONE_PADDING * 0.5 : 
                         zone.orientation === 'horizontal' ? ZONE_PADDING * 0.5 : 
                         ZONE_PADDING;
  let zoneHeight = contentHeight + verticalPadding * 2;
  
  // For auto-sized zones, apply orientation-specific aspect ratios
  if (zone.sizeMode !== 'custom') {
    const originalWidth = zoneWidth;
    const originalHeight = zoneHeight;
    
    if (zone.orientation === 'vertical') {
      // Vertical orientation: keep width tight to content, only adjust height if needed
      // Don't force aspect ratio - let content determine width, only ensure minimum height
      zoneWidth = originalWidth; // Keep width tight to content
      // Only increase height if content is too tall for the width
      const minHeightForVertical = originalWidth * 1.5; // Minimum 1.5:1 height:width ratio
      if (originalHeight < minHeightForVertical) {
        zoneHeight = minHeightForVertical;
      } else {
        zoneHeight = originalHeight;
      }
    } else if (zone.orientation === 'horizontal') {
      // Horizontal orientation: keep height tight to content, only adjust width if needed
      // Don't force aspect ratio - let content determine height, only ensure minimum width
      zoneHeight = originalHeight; // Keep height tight to content
      // Only increase width if content is too wide for the height
      const minWidthForHorizontal = originalHeight * 1.8; // Minimum 1.8:1 width:height ratio
      if (originalWidth < minWidthForHorizontal) {
        zoneWidth = minWidthForHorizontal;
      } else {
        zoneWidth = originalWidth;
      }
    } else {
      // Square orientation: enforce square aspect ratio by using the larger dimension
      const maxDimension = Math.max(zoneWidth, zoneHeight);
      zoneWidth = maxDimension;
      zoneHeight = maxDimension;
    }
    
    // Re-center content within the zone
    const horizontalOffset = (zoneWidth - originalWidth) / 2;
    const verticalOffset = (zoneHeight - originalHeight) / 2;
    
    // Reposition all children to center them in the group
    rows.forEach((row) => {
      row.children.forEach((item) => {
        item.child.x += horizontalOffset;
        item.child.y += verticalOffset;
      });
    });
  }
  
  // For custom-sized zones, use the custom dimensions and apply vertical centering
  if (zone.sizeMode === 'custom') {
    zoneHeight = zone.height || zoneHeight;
    
    // Apply vertical centering for all rows within the custom-sized group
    const totalContentHeight = contentHeight;
    const verticalOffset = verticalPadding + (zoneHeight - verticalPadding * 2 - totalContentHeight) / 2;
    
    // Reposition all children with vertical offset
    rows.forEach((row) => {
      row.children.forEach((item) => {
        item.child.y += verticalOffset - verticalPadding;
      });
    });
  }
  
  // If we have edge nodes, ensure minimum size for proper edge positioning using dynamic dimensions
  if (edgeNodes.length > 0) {
    const edgeNodeDims = edgeNodes.map(n => measureNodeDimsFn(n as PositionedNode));
    const maxEdgeNodeWidth = Math.max(...edgeNodeDims.map(d => d.width));
    const maxEdgeNodeHeight = Math.max(...edgeNodeDims.map(d => d.height));
    // Use orientation-specific minimum dimensions for edge nodes
    if (zone.orientation === 'vertical') {
      // Vertical: need enough width for edge nodes, but keep it tall and thin
      const minWidthForEdges = maxEdgeNodeWidth + ZONE_PADDING * 1.5;
      const minHeightForEdges = maxEdgeNodeHeight * 3 + ZONE_PADDING * 2;
      zoneWidth = Math.max(zoneWidth, minWidthForEdges);
      zoneHeight = Math.max(zoneHeight, minHeightForEdges);
    } else if (zone.orientation === 'horizontal') {
      // Horizontal: need enough height for edge nodes, but keep it wide and short
      const minWidthForEdges = maxEdgeNodeWidth * 3 + ZONE_PADDING * 2;
      const minHeightForEdges = maxEdgeNodeHeight + ZONE_PADDING * 1.5;
      zoneWidth = Math.max(zoneWidth, minWidthForEdges);
      zoneHeight = Math.max(zoneHeight, minHeightForEdges);
    } else {
      // Square: use balanced dimensions
      const minWidthForEdges = maxEdgeNodeWidth * 2 + ZONE_PADDING * 2;
      const minHeightForEdges = maxEdgeNodeHeight * 2 + ZONE_PADDING * 2;
      zoneWidth = Math.max(zoneWidth, minWidthForEdges);
      zoneHeight = Math.max(zoneHeight, minHeightForEdges);
    }
  }
  
  (zone as PositionedGroup).width = zoneWidth;
  (zone as PositionedGroup).height = zoneHeight;

  // Position edge nodes on the boundaries of the group
  // Group nodes by edge position for even distribution
  const nodesByEdge = {
    top: edgeNodes.filter(n => n.edgePosition === 'top'),
    bottom: edgeNodes.filter(n => n.edgePosition === 'bottom'),
    left: edgeNodes.filter(n => n.edgePosition === 'left'),
    right: edgeNodes.filter(n => n.edgePosition === 'right')
  };
  
  // Position nodes evenly along each edge
  Object.entries(nodesByEdge).forEach(([edge, nodes]) => {
    if (nodes.length === 0) return;
    
    // Use actual node dimensions for edge positioning
    const nodeWidth = nodes.length > 0 ? measureNodeDimsFn(nodes[0] as PositionedNode).width : NODE_WIDTH;
    const nodeHeight = nodes.length > 0 ? measureNodeDimsFn(nodes[0] as PositionedNode).height : NODE_HEIGHT;
    
    nodes.forEach((node, index) => {
      switch (edge) {
        case 'top':
        case 'bottom':
          // Distribute horizontally along top/bottom edges
          if (nodes.length === 1) {
            node.x = (zoneWidth - nodeWidth) / 2;
          } else {
            const spacing = zoneWidth / (nodes.length + 1);
            node.x = spacing * (index + 1) - (nodeWidth / 2);
          }
          node.y = edge === 'top' 
            ? -nodeHeight / 2 + nodeHeight * 0.1
            : zoneHeight - nodeHeight / 2 + nodeHeight * 0.1;
          break;
          
        case 'left':
        case 'right':
          // Distribute vertically along left/right edges
          node.x = edge === 'left'
            ? -nodeWidth / 2
            : zoneWidth - nodeWidth / 2;
          if (nodes.length === 1) {
            node.y = (zoneHeight - nodeHeight) / 2;
          } else {
            const spacing = zoneHeight / (nodes.length + 1);
            node.y = spacing * (index + 1) - (nodeHeight / 2);
          }
          break;
      }
    });
  });

  return { width: zoneWidth, height: zoneHeight };
}

function setAbsolutePositionsForZone(
  zone: DiagramZoneData,
  parentX: number,
  parentY: number,
  allItems: { [id: string]: DiagramNodeData | DiagramZoneData | PositionedNode | PositionedGroup }
) {
  zone.x = (zone.x ?? 0) + parentX;
  zone.y = (zone.y ?? 0) + parentY;

  zone.children.forEach((childId: string) => {
    const child = allItems[childId];
    if (!child) return;
    
    if (child.type === 'zone') {
      setAbsolutePositionsForZone(child as DiagramZoneData, zone.x!, zone.y!, allItems);
    } else {
      child.x = (child.x ?? 0) + zone.x!;
      child.y = (child.y ?? 0) + zone.y!;
    }
  });
}

export function calculateLayout(diagramData: DiagramData): {
  processedNodes: PositionedNode[];
  processedZones: PositionedGroup[];
  width: number;
  height: number;
} {
  const nodes: DiagramNodeData[] = JSON.parse(JSON.stringify(diagramData.nodes || []));
  let zones: DiagramZoneData[] = JSON.parse(JSON.stringify(diagramData.zones || []));
  
  // Remove duplicate zones by ID (can happen during drag operations)
  const uniqueZoneIds = new Set<string>();
  zones = zones.filter(zone => {
    if (uniqueZoneIds.has(zone.id)) {
      console.warn('Duplicate zone detected and removed:', zone.id);
      return false;
    }
    uniqueZoneIds.add(zone.id);
    return true;
  });
  
  
  const allItems: { [id: string]: DiagramNodeData | DiagramZoneData | PositionedNode | PositionedGroup } = {};
  nodes.forEach(item => allItems[item.id] = item);
  zones.forEach(item => allItems[item.id] = item);
  
  const rootGroups = zones.filter(zone => !zones.some(parentZone => parentZone.children.includes(zone.id)));
  rootGroups.forEach(zone => layoutZone(zone, allItems, measureNodeDims));

  // Position root groups and orphan nodes
  let currentX = 50;
  const allChildIds = new Set(zones.flatMap(zone => zone.children));
  const orphanNodes = nodes.filter(n => !allChildIds.has(n.id));
  const topLevelItems = [...rootGroups, ...orphanNodes];

  topLevelItems.forEach(item => {
    // Only assign position if it doesn't have one
    if (item.x === undefined || item.y === undefined) {
      item.x = currentX;
      item.y = 50;
    }
    if (item.type === 'zone') {
      setAbsolutePositionsForZone(item as DiagramGroupData, 0, 0, allItems);
    }
    const itemWidth = item.type === 'zone' 
      ? (item as any).width || 300 
      : measureNodeDims(item as PositionedNode).width;
    currentX += itemWidth + 50;
  });

  const finalNodes = Object.values(allItems).filter(i => i.type !== 'zone') as PositionedNode[];
  const finalGroups = Object.values(allItems).filter(i => i.type === 'zone') as PositionedGroup[];

  const allElementsX = [
    ...finalNodes.map(n => (n.x || 0) + measureNodeDims(n).width),
    ...finalGroups.map(zone => (zone.x || 0) + zone.width)
  ];
  const allElementsY = [
    ...finalNodes.map(n => (n.y || 0) + measureNodeDims(n).height),
    ...finalGroups.map(zone => (zone.y || 0) + zone.height)
  ];

  const canvasWidth = Math.max(2000, ...allElementsX);
  const canvasHeight = Math.max(1500, ...allElementsY);
  
  return { 
    processedNodes: finalNodes, 
    processedZones: finalGroups, 
    width: canvasWidth, 
    height: canvasHeight 
  };
}

