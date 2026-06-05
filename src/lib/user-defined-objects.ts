import type {
  DiagramConnectionData,
  DiagramData,
  DiagramGroupingData,
  DiagramNodeData,
  UserDefinedObject,
  UserDefinedObjectTemplate,
} from '@/lib/types';
import {
  computeGroupMemberBounds,
  getItemGroup,
} from '@/lib/grouping-utils';
import {
  measureNodeDims,
  snapToGrid,
  type PositionedNode,
} from '@/components/editor/canvas-constants';
import { collectOccupiedDiagramIds, generateGroupId, generateSequentialId } from '@/lib/id-generator';
import { generateConnectionId } from '@/lib/connection-order-utils';
import { isConnectorLineNodeType } from '@/lib/utils';
import { getJSONSafe, setItemImmediate, setJSONDebounced } from '@/lib/local-storage-debounce';

export const USER_DEFINED_OBJECTS_STORAGE_KEY = 'dw:userDefinedObjects';
export const USER_DEFINED_PALETTE_ITEM_TYPE = 'user-defined-object';
/** Resource browser hierarchy: `generic` / `user-defined` (above `object`). */
export const USER_DEFINED_RESOURCE_PROVIDER = 'generic';
export const USER_DEFINED_RESOURCE_CATEGORY = 'user-defined';

const ICON_VIEW_SIZE = 48;

function deepCloneNode(node: DiagramNodeData): DiagramNodeData {
  return JSON.parse(JSON.stringify(node)) as DiagramNodeData;
}

function deepCloneConnection(conn: DiagramConnectionData): DiagramConnectionData {
  return JSON.parse(JSON.stringify(conn)) as DiagramConnectionData;
}

export function loadUserDefinedObjectsLibrary(): Record<string, UserDefinedObject> {
  return getJSONSafe<Record<string, UserDefinedObject>>(USER_DEFINED_OBJECTS_STORAGE_KEY, {});
}

export function saveUserDefinedObjectsLibrary(objects: Record<string, UserDefinedObject>): void {
  setJSONDebounced(USER_DEFINED_OBJECTS_STORAGE_KEY, objects);
}

export function saveUserDefinedObjectsLibraryImmediate(objects: Record<string, UserDefinedObject>): void {
  setItemImmediate(USER_DEFINED_OBJECTS_STORAGE_KEY, JSON.stringify(objects));
}

export function listUserDefinedObjects(
  library: Record<string, UserDefinedObject>,
  diagram?: DiagramData | null,
): UserDefinedObject[] {
  const merged = mergeLibraryWithDiagramObjects(library, diagram);
  return Object.values(merged).sort((a, b) => a.name.localeCompare(b.name));
}

/** Resource sidebar palette — library only (not diagram-embedded copies). */
export function listUserDefinedObjectsForPalette(
  library: Record<string, UserDefinedObject>,
  searchTerm?: string,
): UserDefinedObject[] {
  const term = searchTerm?.trim().toLowerCase() || '';
  let objects = Object.values(library);
  if (term) {
    objects = objects.filter(
      (obj) =>
        obj.name.toLowerCase().includes(term) ||
        obj.id.toLowerCase().includes(term),
    );
  }
  return objects.sort((a, b) => a.name.localeCompare(b.name));
}

/** Drop embedded definition from diagram JSON (canvas node instances are unchanged). */
export function removeUserDefinedObjectFromDiagram(
  diagram: DiagramData,
  objectId: string,
): DiagramData {
  if (!diagram.userDefinedObjects?.[objectId]) return diagram;
  const next = { ...diagram.userDefinedObjects };
  delete next[objectId];
  return {
    ...diagram,
    userDefinedObjects: Object.keys(next).length > 0 ? next : undefined,
  };
}

export function mergeLibraryWithDiagramObjects(
  library: Record<string, UserDefinedObject>,
  diagram?: DiagramData | null,
): Record<string, UserDefinedObject> {
  const merged = { ...library };
  const embedded = diagram?.userDefinedObjects;
  if (!embedded) return merged;
  for (const [id, obj] of Object.entries(embedded)) {
    if (!merged[id]) merged[id] = obj;
  }
  return merged;
}

export function collectReferencedUserDefinedObjectIds(diagram: DiagramData): Set<string> {
  const ids = new Set<string>();
  for (const node of diagram.nodes) {
    if (node.userDefinedObjectId) ids.add(node.userDefinedObjectId);
  }
  return ids;
}

export function embedUsedUserDefinedObjects(
  diagram: DiagramData,
  library: Record<string, UserDefinedObject>,
): DiagramData {
  const referenced = collectReferencedUserDefinedObjectIds(diagram);
  if (referenced.size === 0 && !diagram.userDefinedObjects) return diagram;

  const embedded: Record<string, UserDefinedObject> = { ...(diagram.userDefinedObjects ?? {}) };
  for (const id of referenced) {
    const fromLib = library[id] ?? embedded[id];
    if (fromLib) embedded[id] = fromLib;
  }

  const pruned: Record<string, UserDefinedObject> = {};
  for (const id of referenced) {
    if (embedded[id]) pruned[id] = embedded[id];
  }

  return Object.keys(pruned).length > 0
    ? { ...diagram, userDefinedObjects: pruned }
    : { ...diagram, userDefinedObjects: undefined };
}

/** Diagram JSON ready to save/share — embeds user-defined definitions for every referenced id (incl. sub-diagrams). */
export function prepareDiagramDataForJsonExport(
  diagram: DiagramData,
  library?: Record<string, UserDefinedObject>,
): DiagramData {
  const lib = library ?? loadUserDefinedObjectsLibrary();
  const embedLevel = (data: DiagramData): DiagramData => embedUsedUserDefinedObjects(data, lib);
  let result = embedLevel(diagram);
  if (result.subDiagrams && Object.keys(result.subDiagrams).length > 0) {
    result = {
      ...result,
      subDiagrams: Object.fromEntries(
        Object.entries(result.subDiagrams).map(([id, sub]) => [id, embedLevel(sub)]),
      ),
    };
  }
  return result;
}

/** After creating from a canvas group: tag members and embed the definition on this diagram. */
export function attachUserDefinedObjectToDiagram(
  diagram: DiagramData,
  object: UserDefinedObject,
  memberNodeIds: string[],
): DiagramData {
  const memberSet = new Set(memberNodeIds);
  return {
    ...diagram,
    nodes: diagram.nodes.map((n) =>
      memberSet.has(n.id) ? { ...n, userDefinedObjectId: object.id } : n,
    ),
    userDefinedObjects: {
      ...(diagram.userDefinedObjects ?? {}),
      [object.id]: object,
    },
  };
}

/** Gather embedded definitions from a diagram and all nested sub-diagrams. */
export function collectUserDefinedObjectsFromDiagramTree(
  diagram: DiagramData,
): Record<string, UserDefinedObject> {
  const collected: Record<string, UserDefinedObject> = {};
  const visit = (data: DiagramData) => {
    if (data.userDefinedObjects) {
      for (const [id, obj] of Object.entries(data.userDefinedObjects)) {
        collected[id] = obj;
      }
    }
    if (data.subDiagrams) {
      for (const sub of Object.values(data.subDiagrams)) {
        visit(sub);
      }
    }
  };
  visit(diagram);
  return collected;
}

export function mergeDiagramObjectsIntoLibrary(
  library: Record<string, UserDefinedObject>,
  diagram?: DiagramData | null,
): Record<string, UserDefinedObject> {
  if (!diagram) return library;
  const fromDiagram = collectUserDefinedObjectsFromDiagramTree(diagram);
  if (Object.keys(fromDiagram).length === 0) return library;
  const next = { ...library };
  for (const [id, obj] of Object.entries(fromDiagram)) {
    const existing = next[id];
    if (!existing || obj.updatedAt >= existing.updatedAt) {
      next[id] = obj;
    }
  }
  return next;
}

/** Objects present in diagram JSON but not yet in the user's library. */
export function findNewUserDefinedObjectsForLibrary(
  library: Record<string, UserDefinedObject>,
  diagram: DiagramData,
): UserDefinedObject[] {
  const fromDiagram = collectUserDefinedObjectsFromDiagramTree(diagram);
  return Object.entries(fromDiagram)
    .filter(([id]) => !library[id])
    .map(([, obj]) => obj);
}

/** Refresh embedded definition on a diagram when the library object was edited. */
export function propagateUserDefinedObjectToDiagram(
  diagram: DiagramData,
  updated: UserDefinedObject,
): DiagramData {
  const hasEmbedded = Boolean(diagram.userDefinedObjects?.[updated.id]);
  const hasReferencedNodes = diagram.nodes.some((n) => n.userDefinedObjectId === updated.id);
  if (!hasEmbedded && !hasReferencedNodes) return diagram;
  return {
    ...diagram,
    userDefinedObjects: {
      ...(diagram.userDefinedObjects ?? {}),
      [updated.id]: updated,
    },
  };
}

/** Resolve the group whose members become a user-defined object template. */
export function resolveGroupForUserDefinedCreation(
  selectedIds: Set<string>,
  diagram: DiagramData,
): DiagramGroupingData | null {
  if (selectedIds.size === 0) return null;

  let resolved: DiagramGroupingData | null = null;
  for (const id of selectedIds) {
    const group = getItemGroup(id, diagram);
    if (!group || group.memberIds.length < 2) return null;
    if (resolved && resolved.id !== group.id) return null;
    resolved = group;
  }
  return resolved;
}

function nodesByIdMap(nodes: DiagramNodeData[]): Record<string, PositionedNode> {
  const map: Record<string, PositionedNode> = {};
  for (const n of nodes) {
    if (n.x !== undefined && n.y !== undefined) map[n.id] = n as PositionedNode;
  }
  return map;
}

function computeTemplateBounds(memberIds: string[], nodes: DiagramNodeData[]) {
  const nodesById = nodesByIdMap(nodes.filter((n) => memberIds.includes(n.id)));
  return computeGroupMemberBounds(memberIds, nodesById, {}, 0);
}

function stripNodeForTemplate(node: DiagramNodeData): DiagramNodeData {
  const {
    groupId: _g,
    userDefinedObjectId: _u,
    importId: _i,
    ...rest
  } = node;
  return rest;
}

function normalizeTemplateToOrigin(template: UserDefinedObjectTemplate): UserDefinedObjectTemplate {
  const minX = Math.min(...template.nodes.map((n) => n.x ?? 0));
  const minY = Math.min(...template.nodes.map((n) => n.y ?? 0));

  const nodes = template.nodes.map((node) => {
    const next: DiagramNodeData = {
      ...node,
      x: snapToGrid((node.x ?? 0) - minX),
      y: snapToGrid((node.y ?? 0) - minY),
    };
    if (node.startPos) {
      next.startPos = {
        x: snapToGrid(node.startPos.x - minX),
        y: snapToGrid(node.startPos.y - minY),
      };
    }
    if (node.endPos) {
      next.endPos = {
        x: snapToGrid(node.endPos.x - minX),
        y: snapToGrid(node.endPos.y - minY),
      };
    }
    if (node.lineControlPoints?.length) {
      next.lineControlPoints = node.lineControlPoints.map((c) => ({
        ...c,
        x: snapToGrid(c.x - minX),
        y: snapToGrid(c.y - minY),
      }));
    }
    return next;
  });

  const bounds = computeTemplateBounds(
    nodes.map((n) => n.id),
    nodes,
  );
  const width = Math.max(20, snapToGrid(bounds?.width ?? 80));
  const height = Math.max(20, snapToGrid(bounds?.height ?? 80));

  return { ...template, nodes, width, height };
}

export function extractTemplateFromGroup(
  group: DiagramGroupingData,
  diagram: DiagramData,
): UserDefinedObjectTemplate {
  const memberSet = new Set(group.memberIds);
  const nodes = diagram.nodes
    .filter((n) => memberSet.has(n.id))
    .map((n) => stripNodeForTemplate(deepCloneNode(n)));

  const connections = (diagram.connections || [])
    .filter((c) => memberSet.has(c.from) && memberSet.has(c.to))
    .map((c) => deepCloneConnection(c));

  const groupings = (diagram.groupings || [])
    .filter((g) => g.memberIds.every((id) => memberSet.has(id)))
    .map((g) => ({
      ...g,
      memberIds: [...g.memberIds],
    }));

  const bounds = computeTemplateBounds(group.memberIds, diagram.nodes);
  const raw: UserDefinedObjectTemplate = {
    nodes,
    connections,
    groupings: groupings.length > 0 ? groupings : undefined,
    width: bounds?.width ?? 80,
    height: bounds?.height ?? 80,
  };

  return normalizeTemplateToOrigin(raw);
}

export function generateUserDefinedObjectIconSvg(template: UserDefinedObjectTemplate): string {
  const { width, height, nodes, connections = [] } = template;
  const scale = Math.min(ICON_VIEW_SIZE / Math.max(width, 1), ICON_VIEW_SIZE / Math.max(height, 1), 1);
  const offsetX = (ICON_VIEW_SIZE - width * scale) / 2;
  const offsetY = (ICON_VIEW_SIZE - height * scale) / 2;

  const nodeCenter = (node: DiagramNodeData) => {
    const dims = measureNodeDims({ ...node, x: node.x ?? 0, y: node.y ?? 0 });
    const w = node.sizeMode === 'custom' && node.width ? node.width : dims.width;
    const h = node.sizeMode === 'custom' && node.height ? node.height : dims.height;
    const x = offsetX + (node.x ?? 0) * scale;
    const y = offsetY + (node.y ?? 0) * scale;
    return { x: x + (w * scale) / 2, y: y + (h * scale) / 2, w: w * scale, h: h * scale, x0: x, y0: y };
  };

  const connLines = connections
    .map((c) => {
      const from = nodes.find((n) => n.id === c.from);
      const to = nodes.find((n) => n.id === c.to);
      if (!from || !to) return '';
      const a = nodeCenter(from);
      const b = nodeCenter(to);
      const color = c.color ?? '#64748b';
      return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${color}" stroke-width="1"/>`;
    })
    .join('');

  const shapes = nodes
    .map((node) => {
      const { x0, y0, w, h } = nodeCenter(node);
      const fill = node.backgroundColors?.[0] ?? node.backgroundColor ?? '#cbd5e1';
      const stroke = node.borderColor ?? '#64748b';
      if (isConnectorLineNodeType(node.type)) {
        if (node.startPos && node.endPos) {
          const x1 = offsetX + node.startPos.x * scale;
          const y1 = offsetY + node.startPos.y * scale;
          const x2 = offsetX + node.endPos.x * scale;
          const y2 = offsetY + node.endPos.y * scale;
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${node.lineColor ?? stroke}" stroke-width="1.5"/>`;
        }
        return '';
      }
      const isCircle = node.type?.includes('circle') || node.type?.includes('point');
      if (isCircle) {
        const cx = x0 + w / 2;
        const cy = y0 + h / 2;
        const r = Math.min(w, h) / 2;
        return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
      }
      return `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1" rx="2"/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_VIEW_SIZE} ${ICON_VIEW_SIZE}">${connLines}${shapes}</svg>`;
}

export function createUserDefinedObjectFromGroup(
  name: string,
  group: DiagramGroupingData,
  diagram: DiagramData,
): UserDefinedObject {
  const template = extractTemplateFromGroup(group, diagram);
  const now = Date.now();
  const id = generateSequentialId('user-defined-object', diagram);
  return {
    id,
    name: name.trim(),
    iconSvg: generateUserDefinedObjectIconSvg(template),
    template,
    createdAt: now,
    updatedAt: now,
  };
}

function remapNodeInternalIds(node: DiagramNodeData, idMap: Map<string, string>): DiagramNodeData {
  const next = { ...node };
  if (next.mindmapParentId && idMap.has(next.mindmapParentId)) {
    next.mindmapParentId = idMap.get(next.mindmapParentId);
  }
  if (next.mindmapChildIds?.length) {
    next.mindmapChildIds = next.mindmapChildIds.map((id) => idMap.get(id) ?? id);
  }
  return next;
}

export function instantiateUserDefinedObjectAt(
  object: UserDefinedObject,
  position: { x: number; y: number },
  diagram: DiagramData,
): DiagramData {
  const template = object.template;
  const dropX = snapToGrid(position.x);
  const dropY = snapToGrid(position.y);
  const occupied = collectOccupiedDiagramIds(diagram);
  const idMap = new Map<string, string>();

  for (const node of template.nodes) {
    const newId = generateSequentialId(node.type, diagram, idMap.values());
    idMap.set(node.id, newId);
    occupied.add(newId);
  }

  const newNodes: DiagramNodeData[] = template.nodes.map((node) => {
    const cloned = remapNodeInternalIds(deepCloneNode(node), idMap);
    return {
      ...cloned,
      id: idMap.get(node.id)!,
      x: snapToGrid(dropX + (node.x ?? 0)),
      y: snapToGrid(dropY + (node.y ?? 0)),
      userDefinedObjectId: object.id,
      groupId: undefined,
      importId: undefined,
      startPos: node.startPos
        ? { x: snapToGrid(dropX + node.startPos.x), y: snapToGrid(dropY + node.startPos.y) }
        : undefined,
      endPos: node.endPos
        ? { x: snapToGrid(dropX + node.endPos.x), y: snapToGrid(dropY + node.endPos.y) }
        : undefined,
      lineControlPoints: node.lineControlPoints?.map((c) => ({
        ...c,
        x: snapToGrid(dropX + c.x),
        y: snapToGrid(dropY + c.y),
      })),
    };
  });

  const newConnections: DiagramConnectionData[] = (template.connections || []).map((conn) => ({
    ...deepCloneConnection(conn),
    id: generateConnectionId(),
    from: idMap.get(conn.from) ?? conn.from,
    to: idMap.get(conn.to) ?? conn.to,
  }));

  let newGroupings = [...(diagram.groupings || [])];

  if (template.groupings?.length) {
    for (const grouping of template.groupings) {
      const mappedMembers = grouping.memberIds
        .map((id) => idMap.get(id))
        .filter((id): id is string => Boolean(id));
      if (mappedMembers.length < 2) continue;
      const newGroupId = generateGroupId('group', diagram, newGroupings.map((g) => g.id));
      const newGrouping: DiagramGroupingData = {
        id: newGroupId,
        type: 'grouping',
        memberIds: mappedMembers,
        label: grouping.label,
      };
      newGroupings.push(newGrouping);
      for (const memberId of mappedMembers) {
        const idx = newNodes.findIndex((n) => n.id === memberId);
        if (idx >= 0) newNodes[idx] = { ...newNodes[idx], groupId: newGroupId };
      }
    }
  } else if (newNodes.length >= 2) {
    const newGroupId = generateGroupId('group', diagram, newGroupings.map((g) => g.id));
    const memberIds = newNodes.map((n) => n.id);
    newGroupings.push({
      id: newGroupId,
      type: 'grouping',
      memberIds,
      label: object.name,
    });
    for (let i = 0; i < newNodes.length; i++) {
      newNodes[i] = { ...newNodes[i], groupId: newGroupId };
    }
  }

  const embedded = { ...(diagram.userDefinedObjects ?? {}), [object.id]: object };

  return {
    ...diagram,
    nodes: [...diagram.nodes, ...newNodes],
    connections: [...(diagram.connections || []), ...newConnections],
    groupings: newGroupings,
    userDefinedObjects: embedded,
  };
}

export function buildEditDiagramFromUserDefinedObject(object: UserDefinedObject): DiagramData {
  const template = normalizeTemplateToOrigin(object.template);
  const nodes: DiagramNodeData[] = template.nodes.map((n) => {
    const cloned = deepCloneNode(n);
    delete cloned.groupId;
    delete cloned.userDefinedObjectId;
    return cloned;
  });

  let groupings: DiagramGroupingData[] | undefined;
  if (nodes.length >= 2) {
    const groupId = 'grouping-edit-1';
    groupings = [{ id: groupId, type: 'grouping', memberIds: nodes.map((n) => n.id) }];
    for (let i = 0; i < nodes.length; i++) {
      nodes[i] = { ...nodes[i], groupId: groupId };
    }
  }

  return {
    nodes,
    connections: (template.connections || []).map((c) => deepCloneConnection(c)),
    groupings,
    canvasBackgroundColor: '#ffffff',
  };
}

export function updateUserDefinedObjectFromEditDiagram(
  object: UserDefinedObject,
  editDiagram: DiagramData,
): UserDefinedObject {
  const memberIds = editDiagram.nodes.map((n) => n.id);
  if (memberIds.length === 0) {
    return object;
  }
  const pseudoGroup: DiagramGroupingData = {
    id: 'grouping-edit',
    type: 'grouping',
    memberIds,
  };
  const template = extractTemplateFromGroup(pseudoGroup, editDiagram);
  const now = Date.now();
  return {
    ...object,
    template,
    iconSvg: generateUserDefinedObjectIconSvg(template),
    updatedAt: now,
  };
}

export function getUserDefinedObjectDragItem(object: UserDefinedObject) {
  return {
    type: USER_DEFINED_PALETTE_ITEM_TYPE,
    userDefinedObjectId: object.id,
    label: object.name,
    provider: USER_DEFINED_RESOURCE_PROVIDER,
    category: USER_DEFINED_RESOURCE_CATEGORY,
    userDefinedObject: object,
  };
}
