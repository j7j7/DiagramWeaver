import type { DiagramData, DiagramGroupingData } from './types';
import { generateSequentialId } from './id-generator';
import {
  nodeBoundingBoxForFit,
  type PositionedGroup,
  type PositionedNode,
} from '@/components/editor/canvas-constants';

export type GroupMemberBounds = { x: number; y: number; width: number; height: number };

/** Union axis-aligned bounds for all group members (nodes + zones), with optional padding. */
export function computeGroupMemberBounds(
  memberIds: string[],
  nodesById: Record<string, PositionedNode>,
  zonesById: Record<string, PositionedGroup>,
  padding = 4,
): GroupMemberBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasAny = false;

  for (const id of memberIds) {
    const node = nodesById[id];
    if (node) {
      const b = nodeBoundingBoxForFit(node);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
      hasAny = true;
      continue;
    }

    const zone = zonesById[id];
    if (zone && zone.x !== undefined && zone.y !== undefined) {
      const w = zone.width ?? 300;
      const h = zone.height ?? 220;
      minX = Math.min(minX, zone.x);
      minY = Math.min(minY, zone.y);
      maxX = Math.max(maxX, zone.x + w);
      maxY = Math.max(maxY, zone.y + h);
      hasAny = true;
    }
  }

  if (!hasAny || !Number.isFinite(minX)) return null;

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * When the primary selection is in a group, return that group for a canvas outline.
 * Hides the outline if multi-select spans items outside the group.
 */
export function resolveGroupSelectionForOutline(
  selectedItemId: string | undefined,
  selectedItemIds: Set<string> | undefined,
  diagramData: DiagramData,
): DiagramGroupingData | null {
  if (!selectedItemId) return null;
  const group = getItemGroup(selectedItemId, diagramData);
  if (!group || group.memberIds.length < 2) return null;

  const ids = selectedItemIds;
  if (ids && ids.size > 1) {
    for (const id of ids) {
      if (!group.memberIds.includes(id)) return null;
    }
  }

  return group;
}

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

  const updatedZones = (diagramData.zones || []).map(zone =>
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

  const updatedZones = (diagramData.zones || []).map(zone =>
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

  const updatedZones = (diagramData.zones || []).map(zone =>
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

  const updatedZones = (diagramData.zones || []).map(zone =>
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

  const zone = (diagramData.zones || []).find(z => z.id === itemId);
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

    const zone = (diagramData.zones || []).find(z => z.id === id);
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

  const updatedZones = (diagramData.zones || []).map(zone => {
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

/**
 * Cleans up empty zones after item deletion
 * Removes zones that have no children left and updates parent zones
 */
export function cleanupEmptyZones(
  diagramData: DiagramData
): DiagramData {
  if (!diagramData.zones || diagramData.zones.length === 0) {
    return diagramData;
  }

  // Create a map of zone IDs to zones for quick lookup
  const zoneMap = new Map(diagramData.zones.map(zone => [zone.id, zone]));
  
  // Find zones that should be deleted (empty or only contain deleted zones)
  const zonesToDelete = new Set<string>();
  
  // Check each zone for emptiness
  const checkZoneEmptiness = (zoneId: string): boolean => {
    const zone = zoneMap.get(zoneId);
    if (!zone) return true;
    
    if (!zone.children || zone.children.length === 0) {
      return true; // Empty zone
    }
    
    // Check if all children are zones that will be deleted
    const remainingChildren = zone.children.filter(childId => {
      const childZone = zoneMap.get(childId);
      if (childZone) {
        return !checkZoneEmptiness(childId); // Recursively check child zones
      }
      return true; // Node (not a zone) - keep it
    });
    
    return remainingChildren.length === 0;
  };
  
  // Find all empty zones
  diagramData.zones.forEach(zone => {
    if (checkZoneEmptiness(zone.id)) {
      zonesToDelete.add(zone.id);
    }
  });
  
  // Remove empty zones and update parent zones
  const remainingZones = diagramData.zones
    .filter(zone => !zonesToDelete.has(zone.id))
    .map(zone => ({
      ...zone,
      children: (zone.children || []).filter(childId => !zonesToDelete.has(childId))
    }));
  
  return {
    ...diagramData,
    zones: remainingZones
  };
}

/**
 * Expands delete targets so removing a grouping or zone removes its contained items.
 * - **Grouping**: all members are deleted when every member is already in the set, or when
 *   a single member is the sole delete target (same “group as unit” behavior as copy/drag).
 * - **Zone**: deleting a zone also deletes its descendant nodes and nested zones.
 */
export function expandIdsForDeletion(
  itemIds: string[],
  diagramData: DiagramData
): string[] {
  const result = new Set(itemIds);
  const zones = diagramData.zones || [];

  const collectZoneSubtree = (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone?.children?.length) return;
    for (const childId of zone.children) {
      if (zones.some((z) => z.id === childId)) {
        result.add(childId);
        collectZoneSubtree(childId);
      } else {
        result.add(childId);
      }
    }
  };

  for (const id of [...result]) {
    if (zones.some((z) => z.id === id)) {
      collectZoneSubtree(id);
    }
  }

  for (const grouping of diagramData.groupings || []) {
    const touched = grouping.memberIds.filter((id) => result.has(id));
    if (touched.length === 0) continue;

    const deleteWholeGrouping =
      grouping.memberIds.every((id) => result.has(id)) ||
      (itemIds.length === 1 && touched.length === 1);

    if (!deleteWholeGrouping || grouping.locked) continue;

    grouping.memberIds.forEach((id) => result.add(id));
  }

  return [...result];
}

/** Remove nodes, zones, connections, groupings, and empty zones for the given ids (after expansion). */
export function deleteDiagramItemsByIds(
  diagramData: DiagramData,
  itemIds: string[]
): DiagramData | null {
  const expanded = expandIdsForDeletion(itemIds, diagramData);
  const deletableIds = expanded.filter((id) => {
    const node = diagramData.nodes.find((n) => n.id === id);
    return !node?.locked;
  });
  if (deletableIds.length === 0) return null;

  const idsToDelete = new Set(deletableIds);

  const edgeIdsToDelete = new Set<string>();
  const edgeKeysToDelete = new Set<string>();
  idsToDelete.forEach((id) => {
    if (diagramData.connections.some((e) => e.id === id)) edgeIdsToDelete.add(id);
    else if (diagramData.connections.some((e) => `${e.from}-${e.to}` === id)) {
      edgeKeysToDelete.add(id);
    }
  });

  const remainingNodes = diagramData.nodes.filter((n) => !idsToDelete.has(n.id));
  const remainingZones = (diagramData.zones ?? []).filter((zone) => !idsToDelete.has(zone.id));
  const updatedZones = remainingZones.map((zone) => ({
    ...zone,
    children: zone.children.filter((childId) => !idsToDelete.has(childId)),
  }));
  const remainingConnections = (diagramData.connections ?? []).filter(
    (e) =>
      !idsToDelete.has(e.from) &&
      !idsToDelete.has(e.to) &&
      !(e.id && edgeIdsToDelete.has(e.id)) &&
      !edgeKeysToDelete.has(`${e.from}-${e.to}`)
  );

  const dataBeforeCleanup: DiagramData = {
    ...diagramData,
    nodes: remainingNodes,
    zones: updatedZones,
    connections: remainingConnections,
  };

  return cleanupEmptyZones(handleItemDeletion(deletableIds, dataBeforeCleanup));
}

/**
 * Prune groupings whose members no longer exist, dissolve groups below two members,
 * and drop grouping records nothing references via `groupId`.
 */
export function cleanupStaleGroupings(diagramData: DiagramData): DiagramData {
  const existingItemIds = new Set([
    ...diagramData.nodes.map((n) => n.id),
    ...(diagramData.zones ?? []).map((z) => z.id),
  ]);

  const referencedGroupIds = new Set<string>();
  for (const node of diagramData.nodes) {
    if (node.groupId) referencedGroupIds.add(node.groupId);
  }
  for (const zone of diagramData.zones ?? []) {
    if (zone.groupId) referencedGroupIds.add(zone.groupId);
  }

  const updatedGroupings = (diagramData.groupings ?? [])
    .filter((g) => referencedGroupIds.has(g.id))
    .map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => existingItemIds.has(id)),
    }))
    .filter((g) => g.memberIds.length >= 2);

  const validGroupIds = new Set(updatedGroupings.map((g) => g.id));

  const updatedNodes = diagramData.nodes.map((node) => {
    if (!node.groupId || !validGroupIds.has(node.groupId)) {
      return node.groupId ? { ...node, groupId: undefined } : node;
    }
    const group = updatedGroupings.find((g) => g.id === node.groupId);
    if (group && !group.memberIds.includes(node.id)) {
      return { ...node, groupId: undefined };
    }
    return node;
  });

  const updatedZones = (diagramData.zones ?? []).map((zone) => {
    if (!zone.groupId || !validGroupIds.has(zone.groupId)) {
      return zone.groupId ? { ...zone, groupId: undefined } : zone;
    }
    const group = updatedGroupings.find((g) => g.id === zone.groupId);
    if (group && !group.memberIds.includes(zone.id)) {
      return { ...zone, groupId: undefined };
    }
    return zone;
  });

  return {
    ...diagramData,
    nodes: updatedNodes,
    zones: diagramData.zones ? updatedZones : undefined,
    groupings: updatedGroupings,
  };
}

export function handleItemDeletion(
  deletedItemIds: string[],
  diagramData: DiagramData
): DiagramData {
  const deletedSet = new Set(deletedItemIds);

  const withMembersRemoved: DiagramData = {
    ...diagramData,
    groupings: (diagramData.groupings ?? []).map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => !deletedSet.has(id)),
    })),
  };

  return cleanupStaleGroupings(withMembersRemoved);
}
