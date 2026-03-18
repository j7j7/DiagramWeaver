import type { DiagramData, DiagramConnectionData } from './types';
import { ensureConnectionIds } from './connection-order-utils';

export interface SubDiagramStackSegment {
  diagramId: string | null;
  fromNodeId?: string;
  fromNodeLabel?: string;
}

/** Get the diagram at the given stack path (traverses nested subDiagrams).
 * When sub not found at current level, falls back to root (legacy diagrams). */
export function getDiagramAtStack(
  root: DiagramData,
  stack: SubDiagramStackSegment[]
): DiagramData {
  if (stack.length === 0) return root;
  let current: DiagramData = root;
  for (const seg of stack) {
    if (!seg.diagramId) continue;
    let sub = current.subDiagrams?.[seg.diagramId];
    if (!sub && root.subDiagrams?.[seg.diagramId]) sub = root.subDiagrams[seg.diagramId];
    current = sub ?? { nodes: [], connections: [] };
  }
  return current;
}

/** Immutably update the diagram at the given stack path */
export function updateDiagramAtStack(
  root: DiagramData,
  stack: SubDiagramStackSegment[],
  updater: (data: DiagramData) => DiagramData
): DiagramData {
  if (stack.length === 0) return updater(root);

  const [first, ...rest] = stack;
  const subId = first.diagramId;
  if (!subId) return root;

  const current = root.subDiagrams?.[subId] ?? { nodes: [], connections: [] };
  const updated = updateDiagramAtStack(current, rest, updater);

  const connections = updated.connections || [];
  const ensuredConnections = connections.some((c) => !(c as DiagramConnectionData).id)
    ? ensureConnectionIds(connections)
    : connections;

  return {
    ...root,
    subDiagrams: {
      ...(root.subDiagrams || {}),
      [subId]: { ...updated, connections: ensuredConnections },
    },
  };
}

/** Add a new sub-diagram to the diagram at the given stack path */
export function addSubDiagramAtStack(
  root: DiagramData,
  stack: SubDiagramStackSegment[],
  subId: string,
  subContent: DiagramData
): DiagramData {
  return updateDiagramAtStack(root, stack, (current) => ({
    ...current,
    subDiagrams: {
      ...(current.subDiagrams || {}),
      [subId]: subContent,
    },
  }));
}

/** Remove a sub-diagram from the diagram at the given stack path */
export function removeSubDiagramAtStack(
  root: DiagramData,
  stack: SubDiagramStackSegment[],
  subId: string
): DiagramData {
  return updateDiagramAtStack(root, stack, (current) => {
    const next = { ...current };
    if (next.subDiagrams) {
      const { [subId]: _, ...rest } = next.subDiagrams;
      next.subDiagrams = Object.keys(rest).length ? rest : undefined;
    }
    return next;
  });
}
