import type { DiagramConnectionData, DiagramNodeData } from "@/lib/types";
import { generateConnectionId } from "@/lib/connection-order-utils";
import { shiftHueOfColor } from "@/lib/color-shift";
import { snapToGrid, snapDimensionToGrid } from "@/components/editor/canvas-constants";

export const MINDMAP_NODE_TYPE = "generic.object.mind-map-node" as const;

export function isMindmapNodeType(type: string | undefined): boolean {
  return type === MINDMAP_NODE_TYPE || !!type?.endsWith(".mind-map-node");
}

/**
 * Next default label for a newly added mind-map node: `"1"`, `"2"`, …
 * Based on existing mind-map nodes whose `label` is entirely digits (manual text is ignored for counting).
 */
export function nextMindmapAutoNumericLabel(nodes: DiagramNodeData[]): string {
  let max = 0;
  for (const n of nodes) {
    if (!isMindmapNodeType(n.type)) continue;
    const raw = (n.label ?? "").trim();
    if (/^\d+$/.test(raw)) {
      const v = parseInt(raw, 10);
      if (Number.isFinite(v) && v > max) max = v;
    }
  }
  return String(max + 1);
}

/**
 * Ids listed on a mind-map parent that are mind-map nodes and reference that parent via
 * `mindmapParentId` (same filter as radial layout).
 */
export function mindmapValidDirectChildIds(parentId: string, nodes: DiagramNodeData[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parent = byId.get(parentId);
  if (!parent || !isMindmapNodeType(parent.type)) return [];
  return (parent.mindmapChildIds ?? []).filter((cid) => {
    const c = byId.get(cid);
    return c && isMindmapNodeType(c.type) && c.mindmapParentId === parentId;
  });
}

/**
 * Nodes that move together when dragging `rootId`: the node itself plus direct tree children that
 * are **leaves** (no mind-map children of their own). Branches (children with subtrees) stay on
 * the canvas so dragging the root recenters only simple cards; dragging a branch head still moves
 * its full subtree via the same rule applied at that node.
 */
export function collectMindmapDragCoMembers(rootId: string, nodes: DiagramNodeData[]): Set<string> {
  const root = nodes.find((n) => n.id === rootId);
  const out = new Set<string>([rootId]);
  if (!root || !isMindmapNodeType(root.type)) return out;
  for (const childId of mindmapValidDirectChildIds(rootId, nodes)) {
    if (mindmapValidDirectChildIds(childId, nodes).length === 0) {
      out.add(childId);
    }
  }
  return out;
}

/** All mind-map descendants of `rootId` following `mindmapChildIds` (BFS). */
export function collectMindmapSubtree(rootId: string, nodes: DiagramNodeData[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Set<string>();
  const stack: string[] = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const n = byId.get(id);
    if (!n || !isMindmapNodeType(n.type)) continue;
    const kids = n.mindmapChildIds ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}

/** True if making `parentId` the tree parent of `childId` would create a cycle. */
export function mindmapWouldBeCycle(parentId: string, childId: string, nodes: DiagramNodeData[]): boolean {
  return collectMindmapSubtree(childId, nodes).has(parentId);
}

export function defaultMindmapOrbitRadius(parent: DiagramNodeData, child: DiagramNodeData): number {
  const pw = parent.width ?? 80;
  const ph = parent.height ?? 50;
  const cw = child.width ?? 80;
  const ch = child.height ?? 50;
  const pr = Math.hypot(pw, ph) / 2;
  const cr = Math.hypot(cw, ch) / 2;
  return snapDimensionToGrid(pr + cr + 36, 24);
}

function parentCenter(parent: DiagramNodeData): { x: number; y: number } {
  const pw = parent.width ?? 80;
  const ph = parent.height ?? 50;
  return { x: (parent.x ?? 0) + pw / 2, y: (parent.y ?? 0) + ph / 2 };
}

function childTopLeftFromCenter(cx: number, cy: number, child: DiagramNodeData): { x: number; y: number } {
  const cw = child.width ?? 80;
  const ch = child.height ?? 50;
  return { x: cx - cw / 2, y: cy - ch / 2 };
}

export function polarFromParent(
  child: DiagramNodeData,
  parent: DiagramNodeData,
): { angleDeg: number; radiusPx: number } {
  const { x: Px, y: Py } = parentCenter(parent);
  const cw = child.width ?? 80;
  const ch = child.height ?? 50;
  const cx = (child.x ?? 0) + cw / 2;
  const cy = (child.y ?? 0) + ch / 2;
  const dx = cx - Px;
  const dy = cy - Py;
  const radius = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { angleDeg, radiusPx: radius };
}

export function syncMindmapChildPolarAfterMove(child: DiagramNodeData, nodes: DiagramNodeData[]): DiagramNodeData {
  const pid = child.mindmapParentId;
  if (!pid || !isMindmapNodeType(child.type)) return child;
  const parent = nodes.find((n) => n.id === pid);
  if (!parent) return child;
  const { angleDeg, radiusPx } = polarFromParent(child, parent);
  return { ...child, mindmapAngleDeg: angleDeg, mindmapRadiusPx: snapToGrid(radiusPx) };
}

/**
 * After a tree child is attached at its current top-left x/y, sync **`mindmapAngleDeg`** /
 * **`mindmapRadiusPx`** for that child only and refresh tree metadata — existing sibling positions stay fixed.
 */
export function finalizeMindmapTreeAttachPreserveSiblingPositions(
  nodes: DiagramNodeData[],
  parentId: string,
  childId: string,
): DiagramNodeData[] {
  const parent = nodes.find((n) => n.id === parentId);
  const child = nodes.find((n) => n.id === childId);
  if (!parent || !child || !isMindmapNodeType(parent.type) || !isMindmapNodeType(child.type)) {
    return recomputeMindmapMetadata(nodes);
  }
  const synced = syncMindmapChildPolarAfterMove(child, nodes);
  const next = nodes.map((n) => (n.id === childId ? synced : n));
  return recomputeMindmapMetadata(next);
}

export function reorderMindmapSiblingsByAngle(parentId: string | undefined, nodes: DiagramNodeData[]): DiagramNodeData[] {
  if (!parentId) return nodes;
  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return nodes;
  const ids = [...(parent.mindmapChildIds ?? [])];
  if (ids.length <= 1) return nodes;
  const sorted = [...ids].sort((a, b) => {
    const na = nodes.find((n) => n.id === a);
    const nb = nodes.find((n) => n.id === b);
    const ai = typeof na?.mindmapAngleDeg === "number" && Number.isFinite(na.mindmapAngleDeg) ? na.mindmapAngleDeg : 0;
    const bi = typeof nb?.mindmapAngleDeg === "number" && Number.isFinite(nb.mindmapAngleDeg) ? nb.mindmapAngleDeg : 0;
    return ai - bi;
  });
  if (sorted.every((id, i) => id === ids[i])) return nodes;
  return nodes.map((n) => (n.id === parentId ? { ...n, mindmapChildIds: sorted } : n));
}

/** Even radial layout for all valid tree children of `parentId`. */
export function layoutMindmapChildrenAroundParent(nodes: DiagramNodeData[], parentId: string): DiagramNodeData[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parent = byId.get(parentId);
  if (!parent || !isMindmapNodeType(parent.type)) return nodes;
  const childIds = mindmapValidDirectChildIds(parentId, nodes);
  if (childIds.length === 0) return recomputeMindmapMetadata(nodes);

  const { x: PCx, y: PCy } = parentCenter(parent);
  const startDeg =
    typeof parent.mindmapStartAngleDeg === "number" && Number.isFinite(parent.mindmapStartAngleDeg)
      ? parent.mindmapStartAngleDeg
      : 90;
  const phase0 = (startDeg * Math.PI) / 180;
  const n = childIds.length;

  const nextNodes = nodes.map((node) => {
    const idx = childIds.indexOf(node.id);
    if (idx < 0) return node;
    const c = byId.get(node.id)!;
    const theta = phase0 + (2 * Math.PI * idx) / n;
    const R =
      typeof c.mindmapRadiusPx === "number" && Number.isFinite(c.mindmapRadiusPx) && c.mindmapRadiusPx > 0
        ? c.mindmapRadiusPx
        : defaultMindmapOrbitRadius(parent, c);
    const cx = PCx + R * Math.cos(theta);
    const cy = PCy + R * Math.sin(theta);
    const tl = childTopLeftFromCenter(cx, cy, c);
    return {
      ...node,
      x: snapToGrid(tl.x),
      y: snapToGrid(tl.y),
      mindmapAngleDeg: (theta * 180) / Math.PI,
      mindmapRadiusPx: R,
    };
  });
  return recomputeMindmapMetadata(nextNodes);
}

export function recomputeMindmapMetadata(nodes: DiagramNodeData[]): DiagramNodeData[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const siblingHueIndexById = new Map<string, number>();
  for (const n of nodes) {
    if (!isMindmapNodeType(n.type)) continue;
    const kids = mindmapValidDirectChildIds(n.id, nodes);
    kids.forEach((cid, i) => siblingHueIndexById.set(cid, i));
  }

  function rootOf(id: string): string {
    let cur: string | undefined = id;
    const seen = new Set<string>();
    while (cur) {
      if (seen.has(cur)) return id;
      seen.add(cur);
      const p: string | undefined = byId.get(cur)?.mindmapParentId;
      if (!p) return cur;
      cur = p;
    }
    return id;
  }

  function depthOf(id: string): number {
    let d = 0;
    let cur: string | undefined = id;
    const seen = new Set<string>();
    while (cur) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const p: string | undefined = byId.get(cur)?.mindmapParentId;
      if (!p) break;
      d++;
      cur = p;
    }
    return d;
  }

  return nodes.map((n) => {
    if (!isMindmapNodeType(n.type)) return n;
    const sib = n.mindmapParentId ? siblingHueIndexById.get(n.id) ?? 0 : 0;
    return {
      ...n,
      mindmapRootId: rootOf(n.id),
      mindmapTreeDepth: depthOf(n.id),
      mindmapSiblingHueIndex: sib,
    };
  });
}

/** Closest ancestor (including `nodeId`) marked `mindmapHueAnchor`, else tree root id for theme-hues base. */
export function findNearestMindmapHueAnchorId(nodeId: string, nodes: DiagramNodeData[]): string | undefined {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cur: string | undefined = nodeId;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const n = byId.get(cur);
    if (!n) break;
    if (isMindmapNodeType(n.type) && n.mindmapHueAnchor) return cur;
    cur = n.mindmapParentId;
  }
  return byId.get(nodeId)?.mindmapRootId;
}

function relativeMindmapDepthToAncestor(
  ancestorId: string,
  nodeId: string,
  byId: Map<string, DiagramNodeData>,
): number | null {
  let d = 0;
  let cur: string | undefined = nodeId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === ancestorId) return d;
    if (seen.has(cur)) break;
    seen.add(cur);
    const curNode = byId.get(cur);
    const pid = curNode?.mindmapParentId;
    if (!pid) break;
    d++;
    cur = pid;
  }
  return null;
}

function mindmapHueDrivingVisualChanged(before: DiagramNodeData, after: DiagramNodeData): boolean {
  const keys = [
    "backgroundColor",
    "backgroundColors",
    "backgroundStyle",
    "meshGradientPoints",
    "borderColor",
    "borderColors",
    "borderStyle",
    "gradientAngle",
    "borderGradientAngle",
  ] as const;
  return keys.some((k) => JSON.stringify((before as any)[k]) !== JSON.stringify((after as any)[k]));
}

/**
 * After editing colors on a mind-map node: mark it the hue anchor for its subtree; if the tree
 * root was edited, clear other anchors in that tree so the whole map follows the root.
 */
export function applyMindmapHueAnchorForEditedNode(nodes: DiagramNodeData[], editedId: string): DiagramNodeData[] {
  const edited = nodes.find((n) => n.id === editedId);
  if (!edited || !isMindmapNodeType(edited.type)) return nodes;

  const rootId = edited.mindmapRootId;
  if (!rootId) return nodes;

  const treeIds = collectMindmapSubtree(rootId, nodes);
  if (!treeIds.has(editedId)) return nodes;

  if (editedId === rootId) {
    return nodes.map((n) => {
      if (!isMindmapNodeType(n.type) || !treeIds.has(n.id)) return n;
      if (n.id === rootId) return { ...n, mindmapHueAnchor: true };
      return { ...n, mindmapHueAnchor: false };
    });
  }

  const branchSubtree = collectMindmapSubtree(editedId, nodes);
  return nodes.map((n) => {
    if (!isMindmapNodeType(n.type)) return n;
    if (n.id === editedId) return { ...n, mindmapHueAnchor: true };
    if (branchSubtree.has(n.id) && n.id !== editedId && n.mindmapHueAnchor) {
      return { ...n, mindmapHueAnchor: false };
    }
    return n;
  });
}

/** After visual edits (single or multi): update hue anchors for touched mind-map nodes under theme-hues. */
export function applyMindmapHueAnchorsAfterVisualChanges(
  prevNodes: DiagramNodeData[],
  nextNodes: DiagramNodeData[],
  touchedIds: Set<string>,
): DiagramNodeData[] {
  const prevById = new Map(prevNodes.map((n) => [n.id, n]));
  const toProcess: string[] = [];
  for (const id of touchedIds) {
    const p = prevById.get(id);
    const n = nextNodes.find((x) => x.id === id);
    if (!p || !n || !isMindmapNodeType(n.type)) continue;
    if (n.mindmapFillMode !== "theme-hues") continue;
    if (!mindmapHueDrivingVisualChanged(p, n)) continue;
    toProcess.push(id);
  }
  if (toProcess.length === 0) return nextNodes;

  const depthOf = (id: string) => nextNodes.find((n) => n.id === id)?.mindmapTreeDepth ?? 0;
  toProcess.sort((a, b) => depthOf(a) - depthOf(b));

  let out = nextNodes;
  for (const id of toProcess) {
    out = applyMindmapHueAnchorForEditedNode(out, id);
  }
  return out;
}

export function resolveMindmapDisplayColors(
  node: DiagramNodeData,
  allNodes?: DiagramNodeData[],
): Partial<DiagramNodeData> {
  if (!isMindmapNodeType(node.type)) return {};
  if (node.mindmapHueLocked) return {};
  if (node.mindmapFillMode !== "theme-hues") return {};

  const sib = node.mindmapSiblingHueIndex ?? 0;
  const stepLocal = node.mindmapHueStepDeg ?? 14;

  const patchFromBase = (
    base: DiagramNodeData,
    dDeg: number,
  ): Partial<DiagramNodeData> => {
    const out: Partial<DiagramNodeData> = {};
    if (base.backgroundColor) out.backgroundColor = shiftHueOfColor(base.backgroundColor, dDeg);
    if (Array.isArray(base.backgroundColors) && base.backgroundColors.length) {
      out.backgroundColors = base.backgroundColors.map((c) => shiftHueOfColor(c, dDeg));
    }
    if (base.borderColor && base.borderStyle !== "gradient") {
      out.borderColor = shiftHueOfColor(base.borderColor, dDeg);
    }
    if (Array.isArray(base.borderColors) && base.borderColors.length) {
      out.borderColors = base.borderColors.map((c) => shiftHueOfColor(c, dDeg));
    }
    return out;
  };

  if (!allNodes?.length) {
    const depth = node.mindmapTreeDepth ?? 0;
    const d = (depth + sib) * stepLocal;
    return patchFromBase(node, d);
  }

  const anchorId = findNearestMindmapHueAnchorId(node.id, allNodes);
  if (!anchorId) return {};
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  const anchor = byId.get(anchorId);
  if (!anchor || !isMindmapNodeType(anchor.type)) return {};

  const step = node.mindmapHueStepDeg ?? anchor.mindmapHueStepDeg ?? 14;
  let dDeg = 0;
  if (node.id !== anchorId) {
    const rel = relativeMindmapDepthToAncestor(anchorId, node.id, byId);
    if (rel === null) return {};
    dDeg = (rel + sib) * step;
  }

  return patchFromBase(anchor, dDeg);
}

export function detachMindmapNode(
  nodes: DiagramNodeData[],
  connections: DiagramConnectionData[],
  childId: string,
): { nodes: DiagramNodeData[]; connections: DiagramConnectionData[] } {
  const child = nodes.find((n) => n.id === childId);
  const pid = child?.mindmapParentId;
  let next = nodes.map((n) => {
    if (n.id === childId) {
      return { ...n, mindmapParentId: undefined };
    }
    if (pid && n.id === pid) {
      return { ...n, mindmapChildIds: (n.mindmapChildIds ?? []).filter((id) => id !== childId) };
    }
    return n;
  });
  const conns = connections.filter((c) => {
    if (c.mindmapRole === "tree" && c.from === pid && c.to === childId) return false;
    return true;
  });
  next = recomputeMindmapMetadata(next);
  return { nodes: next, connections: conns };
}

export function attachMindmapTreeChild(
  nodes: DiagramNodeData[],
  connections: DiagramConnectionData[],
  parentId: string,
  childId: string,
  opts?: { relayoutSiblings?: boolean },
): { nodes: DiagramNodeData[]; connections: DiagramConnectionData[]; error?: "cycle" } {
  if (mindmapWouldBeCycle(parentId, childId, nodes)) {
    return { nodes, connections, error: "cycle" };
  }
  let next = [...nodes];
  let conns = [...connections];
  const child = next.find((n) => n.id === childId);
  if (child?.mindmapParentId) {
    const d = detachMindmapNode(next, conns, childId);
    next = d.nodes;
    conns = d.connections;
  }
  conns = conns.filter((c) => !(c.to === childId && c.mindmapRole === "tree"));

  const parent = next.find((n) => n.id === parentId);
  if (!parent || !isMindmapNodeType(parent.type)) return { nodes: next, connections: conns };

  const childIds = [...new Set([...(parent.mindmapChildIds ?? []), childId])];
  next = next.map((n) => {
    if (n.id === parentId) return { ...n, mindmapChildIds: childIds };
    if (n.id === childId) return { ...n, mindmapParentId: parentId };
    return n;
  });
  conns = [
    ...conns,
    {
      id: generateConnectionId(),
      from: parentId,
      to: childId,
      mindmapRole: "tree",
      mindmapPrimary: true,
    },
  ];
  const relayoutSiblings = opts?.relayoutSiblings !== false;
  next = relayoutSiblings
    ? layoutMindmapChildrenAroundParent(next, parentId)
    : finalizeMindmapTreeAttachPreserveSiblingPositions(next, parentId, childId);
  return { nodes: next, connections: conns };
}