import { DiagramData, DiagramZoneData } from './types';
import { measureNodeDims, PositionedNode, ZONE_PADDING } from '@/components/editor/canvas-constants';

/**
 * Recalculates the layout for a specific zone based on its layoutType and sorting preferences.
 * Returns updated diagram data.
 */
export function applyZoneLayout(
  zoneId: string,
  data: DiagramData
): DiagramData {
  const zone = data.zones.find((z) => z.id === zoneId);
  if (!zone) return data;

  // 1. Sort children if needed
  let orderedChildrenIds = [...zone.children];
  if (zone.sorting && zone.sorting !== 'manual') {
    orderedChildrenIds = sortChildrenIds(orderedChildrenIds, data, zone.sorting);
  }

  // 2. Apply layout
  if (zone.layoutType === 'circular') {
    return layoutCircularZone(zone, orderedChildrenIds, data);
  } else {
    // Default to grid/free layout (existing behavior or re-implmented grid)
    // For now, if it's 'grid', we might just leave it as is or implement a grid packer.
    // Given the requirement "change layout", we probably want a strict grid or just keep the current "free" but sorted.
    // If sorting was applied, we need to re-position items in a grid/list.
    if (zone.sorting !== 'manual') {
        return layoutGridZone(zone, orderedChildrenIds, data);
    }
    return data;
  }
}

/**
 * Sorts children IDs based on label or other criteria.
 */
function sortChildrenIds(
  childIds: string[],
  data: DiagramData,
  sorting: 'alpha-asc' | 'alpha-desc'
): string[] {
  return [...childIds].sort((a, b) => {
    const itemA = data.nodes.find((n) => n.id === a) || data.zones.find((z) => z.id === a);
    const itemB = data.nodes.find((n) => n.id === b) || data.zones.find((z) => z.id === b);

    const labelA = itemA?.label || '';
    const labelB = itemB?.label || '';

    if (sorting === 'alpha-asc') {
      return labelA.localeCompare(labelB);
    } else {
      return labelB.localeCompare(labelA);
    }
  });
}

/**
 * Cycles the order of children in the zone.
 * This shifts the items in the layout positions.
 */
export function cycleZoneItems(
  zoneId: string,
  data: DiagramData
): DiagramData {
    const zone = data.zones.find(z => z.id === zoneId);
    if (!zone) return data;

    // Shift children array: [A, B, C] -> [C, A, B]
    const children = [...zone.children];
    if (children.length < 2) return data;

    const last = children.pop()!;
    children.unshift(last);

    // Update zone with new children order
    const updatedZone = { ...zone, children };
    
    // Create intermediate data with updated zone order
    const intermediateData = {
        ...data,
        zones: data.zones.map(z => z.id === zoneId ? updatedZone : z)
    };

    // Re-apply layout to positions based on new order
    return applyZoneLayout(zoneId, intermediateData);
}

/**
 * Layout children in a circle centered in the zone.
 * Updates children (x,y) and zone (width, height).
 */
function layoutCircularZone(
  zone: DiagramZoneData,
  orderedChildIds: string[],
  data: DiagramData
): DiagramData {
  if (orderedChildIds.length === 0) return data;

  // 1. Calculate max item radius (approximate)
  let maxItemDim = 0;
  orderedChildIds.forEach(id => {
      const node = data.nodes.find(n => n.id === id);
      if (node) {
          const dims = measureNodeDims(node as PositionedNode);
          maxItemDim = Math.max(maxItemDim, Math.max(dims.width, dims.height));
      } else {
          // If child is a zone, we assume a default size or use its current size
          const z = data.zones.find(z => z.id === id);
          if (z) {
             maxItemDim = Math.max(maxItemDim, Math.max(z.width || 100, z.height || 100));
          }
      }
  });

  // 2. Calculate Circle Radius
  // Circumference approx = N * (ItemSize + Gap)
  // 2 * PI * R = N * (maxItemDim + 20)
  const gap = 20;
  const count = orderedChildIds.length;
  
  // Base radius on circumference needed
  let radius = (count * (maxItemDim + gap)) / (2 * Math.PI);
  
  // Ensure minimum radius so items don't overlap in center
  radius = Math.max(radius, maxItemDim); 
  
  // If only 1 item, place in center
  if (count === 1) radius = 0;

  // 3. Zone Dimensions (Diameter + Padding)
  // For items to fit inside circle, we need enough diameter to cover:
  // 2 * radius (diameter of circle where items are centered)
  // + maxItemDim (item extends beyond its center)
  // + ZONE_PADDING (extra buffer, multiplied for triangular layouts)
  const diameter = radius * 2 + maxItemDim + ZONE_PADDING * 4;
  
  // 4. Calculate Center relative to Zone
  // Zone (x,y) is top-left. Center is (width/2, height/2).
  const centerX = diameter / 2;
  const centerY = diameter / 2;

  // 5. Update Items
  const updatedNodes = [...data.nodes];
  const updatedZones = [...data.zones];

  orderedChildIds.forEach((childId, index) => {
      const angle = (index / count) * 2 * Math.PI - (Math.PI / 2); // Start at top
      
      // Calculate center position of the item relative to zone center
      const relX = count === 1 ? 0 : Math.cos(angle) * radius;
      const relY = count === 1 ? 0 : Math.sin(angle) * radius;

      // Item top-left relative to zone top-left
      // itemX = centerX + relX - itemWidth/2
      // itemY = centerY + relY - itemHeight/2
      
      const nodeIndex = updatedNodes.findIndex(n => n.id === childId);
      if (nodeIndex !== -1) {
          const node = updatedNodes[nodeIndex];
          const dims = measureNodeDims(node as PositionedNode);
          
          updatedNodes[nodeIndex] = {
              ...node,
              x: centerX + relX - dims.width / 2,
              y: centerY + relY - dims.height / 2
          };
      } else {
          const zoneIndex = updatedZones.findIndex(z => z.id === childId);
          if (zoneIndex !== -1) {
              const z = updatedZones[zoneIndex];
              const zWidth = z.width || 100;
              const zHeight = z.height || 100;
              
              updatedZones[zoneIndex] = {
                  ...z,
                  x: centerX + relX - zWidth / 2,
                  y: centerY + relY - zHeight / 2
              };
          }
      }
  });

  // 6. Update Zone Dimensions
  const zoneIndex = updatedZones.findIndex(z => z.id === zone.id);
  if (zoneIndex !== -1) {
      updatedZones[zoneIndex] = {
          ...updatedZones[zoneIndex],
          width: diameter,
          height: diameter,
          children: orderedChildIds // Ensure internal order matches
      };
  }

  return {
      ...data,
      nodes: updatedNodes,
      zones: updatedZones
  };
}

/**
 * Simple grid layout for zones (row by row).
 */
function layoutGridZone(
    zone: DiagramZoneData,
    orderedChildIds: string[],
    data: DiagramData
  ): DiagramData {
    // Just update the children order and clear layoutMode/layoutType to let auto-layout handle it
    const updatedZone: DiagramZoneData = {
        ...zone,
        children: orderedChildIds,
        layoutMode: undefined, // Let auto-layout handle it
    };
    
    // We don't need to calculate positions manually because canvas-layout-utils will do it
    // based on the new children order.
    
    return {
        ...data,
        zones: data.zones.map(z => z.id === zone.id ? updatedZone : z)
    };
}
