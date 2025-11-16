import type { DiagramData, HierarchicalDiagramData, DiagramZoneItem, DiagramNodeItem, DiagramConnectionData } from './types';

export interface JsonDiff {
  type: 'zone' | 'node' | 'connection' | 'zone_structure' | 'connection_structure';
  id?: string;
  path?: string[];
  oldValue?: any;
  newValue?: any;
  change?: 'added' | 'removed' | 'modified' | 'moved';
}

export interface JsonPatch {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?: any;
}

/**
 * Compute differences between two hierarchical diagram data structures
 */
export function computeHierarchicalDiff(
  oldData: HierarchicalDiagramData,
  newData: HierarchicalDiagramData
): JsonDiff[] {
  const diffs: JsonDiff[] = [];
  
  // Diff connections (flat array comparison)
  const connectionDiffs = computeArrayDiff(
    oldData.connections || [],
    newData.connections || [],
    'connection',
    (conn) => `${conn.from}-${conn.to}`
  );
  diffs.push(...connectionDiffs);
  
  // Diff zones (hierarchical comparison)
  const zoneDiffs = computeHierarchicalZoneDiff(
    oldData.zones || [],
    newData.zones || []
  );
  diffs.push(...zoneDiffs);
  
  return diffs;
}

/**
 * Compute differences between two flat arrays
 */
function computeArrayDiff<T>(
  oldArray: T[],
  newArray: T[],
  type: 'node' | 'connection',
  getKey: (item: T) => string
): JsonDiff[] {
  const diffs: JsonDiff[] = [];
  const oldMap = new Map(oldArray.map(item => [getKey(item), item]));
  const newMap = new Map(newArray.map(item => [getKey(item), item]));
  
  // Find removed items
  for (const [key, oldItem] of oldMap) {
    if (!newMap.has(key)) {
      diffs.push({
        type,
        id: (oldItem as any).id || key,
        change: 'removed',
        oldValue: oldItem
      });
    }
  }
  
  // Find added items
  for (const [key, newItem] of newMap) {
    if (!oldMap.has(key)) {
      diffs.push({
        type,
        id: (newItem as any).id || key,
        change: 'added',
        newValue: newItem
      });
    }
  }
  
  // Find modified items
  for (const [key, newItem] of newMap) {
    const oldItem = oldMap.get(key);
    if (oldItem && !deepEqual(oldItem, newItem)) {
      diffs.push({
        type,
        id: (newItem as any).id || key,
        change: 'modified',
        oldValue: oldItem,
        newValue: newItem
      });
    }
  }
  
  return diffs;
}

/**
 * Compute differences between hierarchical zone structures
 */
function computeHierarchicalZoneDiff(
  oldZones: DiagramZoneItem[],
  newZones: DiagramZoneItem[]
): JsonDiff[] {
  const diffs: JsonDiff[] = [];
  const oldMap = new Map(oldZones.map(zone => [zone.id, zone]));
  const newMap = new Map(newZones.map(zone => [zone.id, zone]));
  
  // Find removed zones
  for (const [id, oldZone] of oldMap) {
    if (!newMap.has(id)) {
      diffs.push({
        type: 'zone',
        id,
        change: 'removed',
        oldValue: oldZone
      });
    }
  }
  
  // Find added zones
  for (const [id, newZone] of newMap) {
    if (!oldMap.has(id)) {
      diffs.push({
        type: 'zone',
        id,
        change: 'added',
        newValue: newZone
      });
    }
  }
  
  // Find modified zones (including structural changes)
  for (const [id, newZone] of newMap) {
    const oldZone = oldMap.get(id);
    if (oldZone) {
      // Check for zone-level property changes
      const zoneDiff = computeZonePropertyDiff(oldZone, newZone);
      if (zoneDiff.length > 0) {
        diffs.push(...zoneDiff);
      }
      
      // Check for children structure changes
      const childrenDiff = computeChildrenDiff(oldZone.children || [], newZone.children || [], id);
      diffs.push(...childrenDiff);
    }
  }
  
  return diffs;
}

/**
 * Compute differences in zone properties (excluding children)
 */
function computeZonePropertyDiff(
  oldZone: DiagramZoneItem,
  newZone: DiagramZoneItem
): JsonDiff[] {
  const diffs: JsonDiff[] = [];
  
  // Create copies without children to compare properties
  const { children: oldChildren, ...oldProps } = oldZone;
  const { children: newChildren, ...newProps } = newZone;
  
  if (!deepEqual(oldProps, newProps)) {
    diffs.push({
      type: 'zone',
      id: oldZone.id,
      change: 'modified',
      oldValue: oldProps,
      newValue: newProps
    });
  }
  
  return diffs;
}

/**
 * Compute differences in children arrays
 */
function computeChildrenDiff(
  oldChildren: (DiagramNodeItem | DiagramZoneItem)[],
  newChildren: (DiagramNodeItem | DiagramZoneItem)[],
  parentId: string
): JsonDiff[] {
  const diffs: JsonDiff[] = [];
  
  const oldMap = new Map(oldChildren.map(child => [child.id, child]));
  const newMap = new Map(newChildren.map(child => [child.id, child]));
  
  // Find removed children
  for (const [id, oldChild] of oldMap) {
    if (!newMap.has(id)) {
      diffs.push({
        type: oldChild.type === 'zone' ? 'zone' : 'node',
        id,
        change: 'removed',
        path: [parentId, 'children'],
        oldValue: oldChild
      });
    }
  }
  
  // Find added children
  for (const [id, newChild] of newMap) {
    if (!oldMap.has(id)) {
      diffs.push({
        type: newChild.type === 'zone' ? 'zone' : 'node',
        id,
        change: 'added',
        path: [parentId, 'children'],
        newValue: newChild
      });
    }
  }
  
  // Find modified children
  for (const [id, newChild] of newMap) {
    const oldChild = oldMap.get(id);
    if (oldChild && !deepEqual(oldChild, newChild)) {
      diffs.push({
        type: newChild.type === 'zone' ? 'zone' : 'node',
        id,
        change: 'modified',
        path: [parentId, 'children'],
        oldValue: oldChild,
        newValue: newChild
      });
    }
  }
  
  // Check for order changes (if same children but different order)
  if (oldChildren.length === newChildren.length && 
      oldChildren.every(child => newMap.has(child.id))) {
    const oldOrder = oldChildren.map(child => child.id);
    const newOrder = newChildren.map(child => child.id);
    
    if (!deepEqual(oldOrder, newOrder)) {
      diffs.push({
        type: 'zone_structure',
        id: parentId,
        change: 'modified',
        path: [parentId, 'children'],
        oldValue: { order: oldOrder },
        newValue: { order: newOrder }
      });
    }
  }
  
  return diffs;
}

/**
 * Convert diffs to JSON Patch operations for efficient updates
 */
export function diffsToPatches(diffs: JsonDiff[]): JsonPatch[] {
  const patches: JsonPatch[] = [];
  
  for (const diff of diffs) {
    if (diff.change === 'removed') {
      patches.push({
        op: 'remove',
        path: getJsonPath(diff)
      });
    } else if (diff.change === 'added') {
      patches.push({
        op: 'add',
        path: getJsonPath(diff),
        value: diff.newValue
      });
    } else if (diff.change === 'modified') {
      patches.push({
        op: 'replace',
        path: getJsonPath(diff),
        value: diff.newValue
      });
    }
  }
  
  return patches;
}

/**
 * Convert diff to JSON Pointer path
 */
function getJsonPath(diff: JsonDiff): string {
  if (diff.type === 'connection') {
    const id = diff.id || '';
    const [from, to] = id.split('-');
    return `/connections/${findConnectionIndex(from, to)}`;
  }
  
  if (diff.type === 'zone' || diff.type === 'node') {
    if (diff.path && diff.path.length > 0) {
      // Nested item
      const zonePath = diff.path.map(id => `/zones/${findZoneIndex(id)}`).join('');
      return `${zonePath}/children/${findChildIndex(diff.path[diff.path.length - 1], diff.id!)}`;
    } else {
      // Root zone
      return `/zones/${findZoneIndex(diff.id!)}`;
    }
  }
  
  return '';
}

// Helper functions (these would need access to the data structure)
function findConnectionIndex(from: string, to: string): number {
  // This would need access to the current data structure
  // For now, return a placeholder
  return 0;
}

function findZoneIndex(id: string): number {
  // This would need access to the current data structure
  // For now, return a placeholder
  return 0;
}

function findChildIndex(parentId: string, childId: string): number {
  // This would need access to the current data structure
  // For now, return a placeholder
  return 0;
}

/**
 * Deep equality check for objects
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Apply selective updates to JSON string based on patches
 */
export function applySelectiveUpdates(
  jsonString: string,
  patches: JsonPatch[]
): string {
  if (patches.length === 0) return jsonString;
  
  try {
    const data = JSON.parse(jsonString);
    
    for (const patch of patches) {
      applyPatch(data, patch);
    }
    
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('Failed to apply selective updates:', error);
    return jsonString;
  }
}

/**
 * Apply a single JSON Patch operation
 */
function applyPatch(data: any, patch: JsonPatch): void {
  const path = parseJsonPointer(patch.path);
  let current = data;
  
  // Navigate to the parent of the target
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (current[segment] === undefined) {
      current[segment] = {};
    }
    current = current[segment];
  }
  
  const targetSegment = path[path.length - 1];
  
  if (patch.op === 'remove') {
    if (Array.isArray(current)) {
      const index = parseInt(targetSegment);
      if (!isNaN(index)) {
        current.splice(index, 1);
      }
    } else {
      delete current[targetSegment];
    }
  } else if (patch.op === 'add') {
    if (Array.isArray(current)) {
      const index = parseInt(targetSegment);
      if (!isNaN(index)) {
        current.splice(index, 0, patch.value);
      } else {
        current.push(patch.value);
      }
    } else {
      current[targetSegment] = patch.value;
    }
  } else if (patch.op === 'replace') {
    current[targetSegment] = patch.value;
  }
}

/**
 * Parse JSON Pointer path into array of segments
 */
function parseJsonPointer(path: string): string[] {
  if (path === '') return [];
  
  return path
    .split('/')
    .slice(1)
    .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}