import type { DiagramData, DiagramNodeData, DiagramZoneData } from './types';

/**
 * Moves an item to the back (beginning) of the rendering order
 */
export function moveItemToBack(
  diagramData: DiagramData,
  itemId: string,
  itemType: 'node' | 'zone'
): DiagramData {
  const newData = { ...diagramData };
  
  if (itemType === 'node') {
    const nodes = [...newData.nodes];
    const itemIndex = nodes.findIndex(n => n.id === itemId);
    
    if (itemIndex > 0) {
      const [item] = nodes.splice(itemIndex, 1);
      nodes.unshift(item);
      newData.nodes = nodes;
    }
  } else if (itemType === 'zone') {
    const zones = [...(newData.zones || [])];
    const itemIndex = zones.findIndex(z => z.id === itemId);
    
    if (itemIndex > 0) {
      const [item] = zones.splice(itemIndex, 1);
      zones.unshift(item);
      newData.zones = zones;
    }
  }
  
  return newData;
}

/**
 * Moves an item to the front (end) of the rendering order
 */
export function moveItemToFront(
  diagramData: DiagramData,
  itemId: string,
  itemType: 'node' | 'zone'
): DiagramData {
  const newData = { ...diagramData };
  
  if (itemType === 'node') {
    const nodes = [...newData.nodes];
    const itemIndex = nodes.findIndex(n => n.id === itemId);
    
    if (itemIndex >= 0 && itemIndex < nodes.length - 1) {
      const [item] = nodes.splice(itemIndex, 1);
      nodes.push(item);
      newData.nodes = nodes;
    }
  } else if (itemType === 'zone') {
    const zones = [...(newData.zones || [])];
    const itemIndex = zones.findIndex(z => z.id === itemId);
    
    if (itemIndex >= 0 && itemIndex < zones.length - 1) {
      const [item] = zones.splice(itemIndex, 1);
      zones.push(item);
      newData.zones = zones;
    }
  }
  
  return newData;
}

/**
 * Moves an item one position back in the rendering order
 */
export function moveItemOneBack(
  diagramData: DiagramData,
  itemId: string,
  itemType: 'node' | 'zone'
): DiagramData {
  const newData = { ...diagramData };
  
  if (itemType === 'node') {
    const nodes = [...newData.nodes];
    const itemIndex = nodes.findIndex(n => n.id === itemId);
    
    if (itemIndex > 0) {
      [nodes[itemIndex - 1], nodes[itemIndex]] = [nodes[itemIndex], nodes[itemIndex - 1]];
      newData.nodes = nodes;
    }
  } else if (itemType === 'zone') {
    const zones = [...(newData.zones || [])];
    const itemIndex = zones.findIndex(z => z.id === itemId);
    
    if (itemIndex > 0) {
      [zones[itemIndex - 1], zones[itemIndex]] = [zones[itemIndex], zones[itemIndex - 1]];
      newData.zones = zones;
    }
  }
  
  return newData;
}

/**
 * Moves an item one position forward in the rendering order
 */
export function moveItemOneForward(
  diagramData: DiagramData,
  itemId: string,
  itemType: 'node' | 'zone'
): DiagramData {
  const newData = { ...diagramData };
  
  if (itemType === 'node') {
    const nodes = [...newData.nodes];
    const itemIndex = nodes.findIndex(n => n.id === itemId);
    
    if (itemIndex >= 0 && itemIndex < nodes.length - 1) {
      [nodes[itemIndex], nodes[itemIndex + 1]] = [nodes[itemIndex + 1], nodes[itemIndex]];
      newData.nodes = nodes;
    }
  } else if (itemType === 'zone') {
    const zones = [...(newData.zones || [])];
    const itemIndex = zones.findIndex(z => z.id === itemId);
    
    if (itemIndex >= 0 && itemIndex < zones.length - 1) {
      [zones[itemIndex], zones[itemIndex + 1]] = [zones[itemIndex + 1], zones[itemIndex]];
      newData.zones = zones;
    }
  }
  
  return newData;
}

/**
 * Gets the current position of an item in the rendering order
 */
export function getItemPosition(
  diagramData: DiagramData,
  itemId: string,
  itemType: 'node' | 'zone'
): number {
  if (itemType === 'node') {
    return diagramData.nodes.findIndex(n => n.id === itemId);
  } else if (itemType === 'zone') {
    return (diagramData.zones || []).findIndex(z => z.id === itemId);
  }
  return -1;
}

/**
 * Gets the total count of items of a specific type
 */
export function getItemCount(
  diagramData: DiagramData,
  itemType: 'node' | 'zone'
): number {
  if (itemType === 'node') {
    return diagramData.nodes.length;
  } else if (itemType === 'zone') {
    return (diagramData.zones || []).length;
  }
  return 0;
}