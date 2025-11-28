import type { DiagramData, DiagramGroupingData } from './types';
import { generateSequentialId } from './id-generator';

export function createGroup(
  itemIds: string[],
  diagramData: DiagramData,
  label?: string
): DiagramData {
  if (itemIds.length < 2) {
    throw new Error('At least 2 items are required to create a group.');
  }

  const existingGroupings = itemIds
    .map(id => getItemGroup(id, diagramData))
    .filter(g => g !== null);

  // Check if items are from different groups (not allowed)
  const uniqueGroupIds = new Set(existingGroupings.map(g => g!.id));
  if (uniqueGroupIds.size > 1) {
    throw new Error('Selected items are from different groups. Remove from groups first.');
  }
  
  // If all items are already in the same group, no need to recreate
  if (uniqueGroupIds.size === 1 && existingGroupings.length === itemIds.length) {
    throw new Error('All selected items are already in this group.');
  }

  // Only allow creating new groups with ungrouped items or items from same group
  // Don't automatically add to existing groups - user should explicitly use "Add to Group"
  if (uniqueGroupIds.size === 1 && existingGroupings.length > 0 && existingGroupings.length < itemIds.length) {
    // Some items are in a group but not all - this is mixing groups, not allowed
    throw new Error('Selected items are from different groups. Remove from groups first.');
  }

  // Create a new group with all items
  const newGrouping: DiagramGroupingData = {
    id: generateSequentialId('grouping', diagramData),
    type: 'grouping',
    memberIds: [...itemIds],
    label,
  };

  const updatedNodes = diagramData.nodes.map(node =>
    itemIds.includes(node.id) ? { ...node, groupId: newGrouping.id } : node
  );

  const updatedZones = diagramData.zones.map(zone =>
    itemIds.includes(zone.id) ? { ...zone, groupId: newGrouping.id } : zone
  );

  return {
    ...diagramData,
    nodes: updatedNodes,
    zones: updatedZones,
    groupings: [...(diagramData.groupings || []), newGrouping],
  };
}

export function addToGroup(
  itemIds: string[],
  groupId: string,
  diagramData: DiagramData
): DiagramData {
  const targetGroup = (diagramData.groupings || []).find(g => g.id === groupId);
  if (!targetGroup) {
    throw new Error(`Group ${groupId} not found`);
  }

  if (targetGroup.locked) {
    throw new Error('Cannot modify a locked group');
  }

  const alreadyInOtherGroup = itemIds.some(id => {
    const existingGroup = getItemGroup(id, diagramData);
    return existingGroup && existingGroup.id !== groupId;
  });

  if (alreadyInOtherGroup) {
    throw new Error('One or more items are already in a different group');
  }

  const newMemberIds = Array.from(
    new Set([...targetGroup.memberIds, ...itemIds])
  );

  const updatedGroupings = (diagramData.groupings || []).map(g =>
    g.id === groupId ? { ...g, memberIds: newMemberIds } : g
  );

  const updatedNodes = diagramData.nodes.map(node =>
    itemIds.includes(node.id) ? { ...node, groupId: groupId } : node
  );

  const updatedZones = diagramData.zones.map(zone =>
    itemIds.includes(zone.id) ? { ...zone, groupId: groupId } : zone
  );

  return {
    ...diagramData,
    nodes: updatedNodes,
    zones: updatedZones,
    groupings: updatedGroupings,
  };
}

export function removeFromGroup(
  itemIds: string[],
  diagramData: DiagramData
): DiagramData {
  const affectedGroupIds = new Set<string>();

  itemIds.forEach(id => {
    const group = getItemGroup(id, diagramData);
    if (group) {
      if (group.locked) {
        throw new Error(`Cannot modify locked group "${group.label || group.id}"`);
      }
      affectedGroupIds.add(group.id);
    }
  });

  const updatedGroupings = (diagramData.groupings || [])
    .map(g => {
      if (!affectedGroupIds.has(g.id)) return g;
      return {
        ...g,
        memberIds: g.memberIds.filter(id => !itemIds.includes(id)),
      };
    })
    .filter(g => g.memberIds.length >= 2);

  const updatedNodes = diagramData.nodes.map(node =>
    itemIds.includes(node.id) ? { ...node, groupId: undefined } : node
  );

  const updatedZones = diagramData.zones.map(zone =>
    itemIds.includes(zone.id) ? { ...zone, groupId: undefined } : zone
  );

  return {
    ...diagramData,
    nodes: updatedNodes,
    zones: updatedZones,
    groupings: updatedGroupings,
  };
}

export function ungroup(groupId: string, diagramData: DiagramData): DiagramData {
  const targetGroup = (diagramData.groupings || []).find(g => g.id === groupId);
  if (!targetGroup) {
    throw new Error(`Group ${groupId} not found`);
  }

  if (targetGroup.locked) {
    throw new Error('Cannot ungroup a locked group');
  }

  const memberIds = targetGroup.memberIds;

  const updatedGroupings = (diagramData.groupings || []).filter(
    g => g.id !== groupId
  );

  const updatedNodes = diagramData.nodes.map(node =>
    memberIds.includes(node.id) ? { ...node, groupId: undefined } : node
  );

  const updatedZones = diagramData.zones.map(zone =>
    memberIds.includes(zone.id) ? { ...zone, groupId: undefined } : zone
  );

  return {
    ...diagramData,
    nodes: updatedNodes,
    zones: updatedZones,
    groupings: updatedGroupings,
  };
}

export function getGroupMembers(
  groupId: string,
  diagramData: DiagramData
): string[] {
  const group = (diagramData.groupings || []).find(g => g.id === groupId);
  return group ? [...group.memberIds] : [];
}

export function getItemGroup(
  itemId: string,
  diagramData: DiagramData
): DiagramGroupingData | null {
  const node = diagramData.nodes.find(n => n.id === itemId);
  if (node?.groupId) {
    const group = (diagramData.groupings || []).find(g => g.id === node.groupId);
    return group || null;
  }

  const zone = diagramData.zones.find(z => z.id === itemId);
  if (zone?.groupId) {
    const group = (diagramData.groupings || []).find(g => g.id === zone.groupId);
    return group || null;
  }

  return null;
}

export function calculateRelativePositions(
  itemIds: string[],
  diagramData: DiagramData
): Map<string, { dx: number; dy: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  itemIds.forEach(id => {
    const node = diagramData.nodes.find(n => n.id === id);
    if (node && node.x !== undefined && node.y !== undefined) {
      positions.set(id, { x: node.x, y: node.y });
      return;
    }

    const zone = diagramData.zones.find(z => z.id === id);
    if (zone && zone.x !== undefined && zone.y !== undefined) {
      positions.set(id, { x: zone.x, y: zone.y });
    }
  });

  if (positions.size === 0) {
    return new Map();
  }

  const allPositions = Array.from(positions.values());
  const minX = Math.min(...allPositions.map(p => p.x));
  const minY = Math.min(...allPositions.map(p => p.y));

  const relativePositions = new Map<string, { dx: number; dy: number }>();
  positions.forEach((pos, id) => {
    relativePositions.set(id, {
      dx: pos.x - minX,
      dy: pos.y - minY,
    });
  });

  return relativePositions;
}

export function moveGroupMembers(
  groupId: string,
  deltaX: number,
  deltaY: number,
  diagramData: DiagramData
): DiagramData {
  const group = (diagramData.groupings || []).find(g => g.id === groupId);
  if (!group) {
    return diagramData;
  }

  const updatedNodes = diagramData.nodes.map(node => {
    if (group.memberIds.includes(node.id) && node.x !== undefined && node.y !== undefined) {
      return {
        ...node,
        x: node.x + deltaX,
        y: node.y + deltaY,
      };
    }
    return node;
  });

  const updatedZones = diagramData.zones.map(zone => {
    if (group.memberIds.includes(zone.id) && zone.x !== undefined && zone.y !== undefined) {
      return {
        ...zone,
        x: zone.x + deltaX,
        y: zone.y + deltaY,
      };
    }
    return zone;
  });

  return {
    ...diagramData,
    nodes: updatedNodes,
    zones: updatedZones,
  };
}

export function isItemInGroup(itemId: string, diagramData: DiagramData): boolean {
  return getItemGroup(itemId, diagramData) !== null;
}

export function getAllGroupedItems(diagramData: DiagramData): Set<string> {
  const groupedItems = new Set<string>();
  (diagramData.groupings || []).forEach(group => {
    group.memberIds.forEach(id => groupedItems.add(id));
  });
  return groupedItems;
}

export function handleItemDeletion(
  deletedItemIds: string[],
  diagramData: DiagramData
): DiagramData {
  const affectedGroupIds = new Set<string>();

  deletedItemIds.forEach(id => {
    const group = getItemGroup(id, diagramData);
    if (group) {
      affectedGroupIds.add(group.id);
    }
  });

  const updatedGroupings = (diagramData.groupings || [])
    .map(g => {
      if (!affectedGroupIds.has(g.id)) return g;
      return {
        ...g,
        memberIds: g.memberIds.filter(id => !deletedItemIds.includes(id)),
      };
    })
    .filter(g => g.memberIds.length >= 2);

  return {
    ...diagramData,
    groupings: updatedGroupings,
  };
}
