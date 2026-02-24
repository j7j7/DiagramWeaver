/**
 * Converts parsed Mermaid flowchart data to DiagramWeaver DiagramData.
 * Maps Mermaid shapes to generic.object.* types, uses dagre/elkjs for
 * Mermaid-compatible layout, and creates connections.
 * Node dimensions are computed from labels so text is not truncated.
 * Theme colours: decision/kite and other shapes use Forest Green;
 * standard box (rect) uses Ocean Blue.
 */

import type { DiagramData, DiagramNodeData, DiagramConnectionData } from '@/lib/types';
import type { ParsedMermaid, MermaidNode, MermaidEdge, ParsedMermaidClassDiagram, MermaidClassNode } from './mermaid-parser';
import { computeMermaidLayout } from './mermaid-layout';

const GRID_SNAP = 20; // Match canvas-constants; dimensions/positions align for straight connectors
const AVG_CHAR_WIDTH = 8;
const TEXT_PADDING = 20;
const MIN_WIDTH = 80;
const MAX_WIDTH = 220;
const BASE_HEIGHT = 60;

/** Snap dimension to GRID_SNAP, ensuring result is divisible by 2 for proper centering */
function snapDimensionToGrid(v: number, minVal = MIN_WIDTH): number {
  const snapped = Math.round(v / GRID_SNAP) * GRID_SNAP;
  const result = Math.max(minVal, snapped);
  return result % 2 === 0 ? result : result + 1;
}

/** Snap position to GRID_SNAP */
function snapPosToGrid(v: number): number {
  return Math.round(v / GRID_SNAP) * GRID_SNAP;
}

/** Snap a center point to grid, then return top-left position for given dimensions */
function centerToPosition(centerX: number, centerY: number, width: number, height: number): { x: number; y: number } {
  const snappedCenterX = snapPosToGrid(centerX);
  const snappedCenterY = snapPosToGrid(centerY);
  return {
    x: snappedCenterX - width / 2,
    y: snappedCenterY - height / 2,
  };
}

/** Estimate node dimensions from label so text fits (no truncation). Dimensions are grid-aligned and even for centering. */
function estimateNodeDimensions(label: string): { width: number; height: number } {
  const lines = (label || '').split('\n');
  const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
  const width = snapDimensionToGrid(
    Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, maxLineLen * AVG_CHAR_WIDTH + TEXT_PADDING))
  );
  const height = snapDimensionToGrid(BASE_HEIGHT + (lines.length - 1) * 18);
  return { width, height };
}

/** Inline theme properties for Mermaid import (no external deps) */
const MERMAID_OCEAN_BLUE = {
  borderStyle: 'solid' as const,
  borderColor: '#3b82f6',
  borderWidth: 1,
  backgroundStyle: 'solid' as const,
  backgroundColor: '#eff6ff',
  shadow: true,
  textColor: '#1e40af',
  gradientAngle: 135,
};

const MERMAID_FOREST_GREEN = {
  borderStyle: 'solid' as const,
  borderColor: '#16a34a',
  borderWidth: 1,
  backgroundStyle: 'solid' as const,
  backgroundColor: '#f0fdf4',
  shadow: true,
  textColor: '#14532d',
  gradientAngle: 90,
};

/** Get theme for Mermaid shape: standard box (rect/default) = Ocean Blue; decision/kite/shapes = Forest Green */
function getMermaidThemeForShape(shape: MermaidNode['shape']) {
  return (shape === 'rect' || shape === 'default') ? MERMAID_OCEAN_BLUE : MERMAID_FOREST_GREEN;
}

/** Apply theme properties to a node */
function applyMermaidTheme(node: DiagramNodeData, theme: typeof MERMAID_OCEAN_BLUE): DiagramNodeData {
  return { ...node, ...theme };
}

/** Map Mermaid shape to DiagramWeaver generic.object.* or generic.text.* type */
function mermaidShapeToDiagramType(shape: MermaidNode['shape']): string {
  switch (shape) {
    case 'circle':
      return 'generic.object.circle';
    case 'rounded':
    case 'stadium':
      return 'generic.object.rounded-rectangle';
    case 'diamond':
      return 'generic.object.kite'; // diamond/rhombus
    case 'hexagon':
      return 'generic.object.hexagon';
    case 'parallelogram':
    case 'parallelogram-alt':
      return 'generic.object.parallelogram';
    case 'trapezoid':
    case 'trapezoid-alt':
      return 'generic.object.trapezoid';
    case 'subroutine':
      return 'generic.object.rectangle'; // subroutine = double-rect
    case 'cylinder':
      return 'generic.object.rounded-rectangle'; // database/cylinder
    case 'rect':
    case 'default':
    default:
      return 'generic.object.rectangle';
  }
}

/** Sanitize ID for use as DiagramWeaver node id (alphanumeric, hyphens) */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || `node-${Math.random().toString(36).slice(2, 8)}`;
}

/** Map edge label to connector color during Mermaid import */
function edgeLabelToColor(label: string): string | undefined {
  const normalized = label.trim().toLowerCase();
  switch (normalized) {
    case 'yes':
      return '#22c55e'; // green
    case 'no':
      return '#ef4444'; // red
    case 'critical':
      return '#ef4444'; // red
    case 'high':
      return '#f97316'; // orange
    case 'medium':
    case 'medium/low':
      return '#f59e0b'; // amber
    case 'low':
      return '#22c55e'; // green
    default:
      return undefined;
  }
}

/**
 * Convert parsed Mermaid flowchart to DiagramWeaver DiagramData.
 * Uses generic.object.* shapes, dagre/elkjs for Mermaid-compatible layout.
 */
export async function mermaidToDiagramData(parsed: ParsedMermaid): Promise<DiagramData> {
  const { nodes, edges, direction, config } = parsed;
  const idMap = new Map<string, string>(); // mermaid id -> diagram id
  const diagramNodes: DiagramNodeData[] = [];
  const nodesById = new Map<string, MermaidNode>();
  nodes.forEach(n => nodesById.set(n.id, n));

  const allNodeIds = Array.from(new Set<string>([...nodes.map(n => n.id), ...edges.flatMap(e => [e.from, e.to])]));

  // Compute dimensions from labels; diamond (kite) nodes use square dims same size as process nodes
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  nodes.forEach((n) => {
    let dims = estimateNodeDimensions(n.label || n.id);
    if (n.shape === 'diamond') {
      const baseSize = snapDimensionToGrid(Math.max(dims.width, dims.height));
      dims = { width: baseSize, height: baseSize };
    }
    nodeDimensions.set(n.id, dims);
  });
  allNodeIds.forEach((id) => {
    if (!nodeDimensions.has(id)) {
      const mNode = nodesById.get(id);
      let dims = estimateNodeDimensions(mNode?.label ?? id);
      if (mNode?.shape === 'diamond') {
        const baseSize = snapDimensionToGrid(Math.max(dims.width, dims.height));
        dims = { width: baseSize, height: baseSize };
      }
      nodeDimensions.set(id, dims);
    }
  });

  const layoutEdges = edges.map(e => ({ from: e.from, to: e.to }));
  const positions = await computeMermaidLayout(allNodeIds, layoutEdges, direction, config, nodeDimensions);

  const fallbackSpacing = 80;
  nodes.forEach((mNode, idx) => {
    const diagramId = `${sanitizeId(mNode.id)}-${idx + 1}`;
    idMap.set(mNode.id, diagramId);
    const dims = nodeDimensions.get(mNode.id)!;
    const layoutPos = positions.get(mNode.id) ?? { x: idx * (dims.width + fallbackSpacing), y: 0 };
    const centerX = layoutPos.x + dims.width / 2;
    const centerY = layoutPos.y + dims.height / 2;
    const pos = centerToPosition(centerX, centerY, dims.width, dims.height);
    const type = mermaidShapeToDiagramType(mNode.shape);
    const baseNode: DiagramNodeData = {
      id: diagramId,
      type,
      label: mNode.label || mNode.id,
      x: pos.x,
      y: pos.y,
      width: dims.width,
      height: dims.height,
      sizeMode: 'custom',
    };
    diagramNodes.push(applyMermaidTheme(baseNode, getMermaidThemeForShape(mNode.shape)));
  });

  // Add nodes that were only referenced in edges (implicit nodes) - standard box = Ocean Blue
  let implicitIdx = 0;
  Array.from(allNodeIds).forEach(mId => {
    if (nodesById.has(mId)) return;
    const diagramId = `mermaid-${sanitizeId(mId)}-${++implicitIdx}`;
    idMap.set(mId, diagramId);
    const dims = nodeDimensions.get(mId)!;
    const layoutPos = positions.get(mId) ?? { x: diagramNodes.length * (dims.width + fallbackSpacing), y: 0 };
    const centerX = layoutPos.x + dims.width / 2;
    const centerY = layoutPos.y + dims.height / 2;
    const pos = centerToPosition(centerX, centerY, dims.width, dims.height);
    const baseNode: DiagramNodeData = {
      id: diagramId,
      type: 'generic.object.rectangle',
      label: mId,
      x: pos.x,
      y: pos.y,
      width: dims.width,
      height: dims.height,
      sizeMode: 'custom',
    };
    diagramNodes.push(applyMermaidTheme(baseNode, MERMAID_OCEAN_BLUE));
  });

  const connections: DiagramConnectionData[] = edges
    .map((e): DiagramConnectionData | null => {
      const fromId = idMap.get(e.from);
      const toId = idMap.get(e.to);
      if (!fromId || !toId) return null;
      const conn: DiagramConnectionData = { from: fromId, to: toId, toArrow: e.hasArrow, arrow: e.hasArrow };
      if (e.label) {
        conn.text = e.label;
        const color = edgeLabelToColor(e.label);
        if (color) conn.color = color;
      }
      return conn;
    })
    .filter((c): c is DiagramConnectionData => c !== null);

  return {
    nodes: diagramNodes,
    connections,
    groupings: undefined,
  };
}

/**
 * Build multi-line label for a class node (name + attributes + methods).
 */
function buildClassLabel(cls: MermaidClassNode): string {
  const parts: string[] = [cls.name];
  if (cls.attributes.length) parts.push(...cls.attributes);
  if (cls.methods.length) parts.push(...cls.methods);
  return parts.join('\n');
}

const CLASS_RANK_SPACING = 60;
const CLASS_CHILD_SPACING = 40;

/**
 * Deterministic layout for class diagrams: parent(s) centered at top, children in a horizontal row below.
 * Child order follows inheritance definition order (Duck, Fish, Zebra).
 */
function computeClassDiagramLayout(
  classIds: string[],
  edges: { from: string; to: string }[],
  nodeDimensions: Map<string, { width: number; height: number }>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const parentIds = new Set(edges.map(e => e.to));
  const childOrder = edges.map(e => e.from);
  const childIds = Array.from(new Set(childOrder));
  const parentIdsList = Array.from(parentIds);

  if (parentIdsList.length === 0 && childIds.length === 0) {
    classIds.forEach((id, i) => {
      const dims = nodeDimensions.get(id) ?? { width: 100, height: 60 };
      positions.set(id, { x: i * (dims.width + CLASS_CHILD_SPACING), y: 0 });
    });
    return positions;
  }

  let childY = 0;
  if (parentIdsList.length > 0) {
    const maxParentHeight = Math.max(
      ...parentIdsList.map(id => (nodeDimensions.get(id) ?? { height: 60 }).height)
    );
    childY = maxParentHeight + CLASS_RANK_SPACING;
  }

  let childX = 0;
  childIds.forEach((id) => {
    const dims = nodeDimensions.get(id) ?? { width: 100, height: 60 };
    positions.set(id, { x: childX, y: childY });
    childX += dims.width + CLASS_CHILD_SPACING;
  });

  const childrenTotalWidth = childX - (childIds.length > 0 ? CLASS_CHILD_SPACING : 0);
  const childrenCenterX = childrenTotalWidth / 2;

  parentIdsList.forEach((id) => {
    const dims = nodeDimensions.get(id) ?? { width: 100, height: 60 };
    const parentX = childrenCenterX - dims.width / 2;
    positions.set(id, { x: parentX, y: 0 });
  });

  const orphanIds = classIds.filter(id => !parentIds.has(id) && !childIds.includes(id));
  let orphanX = childX + CLASS_CHILD_SPACING;
  orphanIds.forEach((id) => {
    const dims = nodeDimensions.get(id) ?? { width: 100, height: 60 };
    positions.set(id, { x: orphanX, y: childY });
    orphanX += dims.width + CLASS_CHILD_SPACING;
  });

  return positions;
}

/**
 * Convert parsed Mermaid classDiagram to DiagramWeaver DiagramData.
 * Classes become simple rectangles with multi-line labels (name, attributes, methods).
 * Inheritance edges connect child to parent with arrow at parent.
 * Layout: parent above, children below in a horizontal row (Duck, Fish, Zebra).
 */
export function classDiagramToDiagramData(parsed: ParsedMermaidClassDiagram): DiagramData {
  const { classes, edges } = parsed;
  const idMap = new Map<string, string>();
  const diagramNodes: DiagramNodeData[] = [];
  const classesById = new Map<string, MermaidClassNode>();
  classes.forEach(c => classesById.set(c.id, c));

  const allClassIds = Array.from(new Set<string>([
    ...classes.map(c => c.id),
    ...edges.flatMap(e => [e.from, e.to]),
  ]));

  const nodeDimensions = new Map<string, { width: number; height: number }>();
  allClassIds.forEach((id) => {
    const cls = classesById.get(id);
    const label = cls ? buildClassLabel(cls) : id;
    nodeDimensions.set(id, estimateNodeDimensions(label));
  });

  const positions = computeClassDiagramLayout(allClassIds, edges, nodeDimensions);

  const fallbackSpacing = 80;
  classes.forEach((cls, idx) => {
    const diagramId = `${sanitizeId(cls.id)}-${idx + 1}`;
    idMap.set(cls.id, diagramId);
    const dims = nodeDimensions.get(cls.id)!;
    const layoutPos = positions.get(cls.id) ?? { x: idx * (dims.width + fallbackSpacing), y: 0 };
    const centerX = layoutPos.x + dims.width / 2;
    const centerY = layoutPos.y + dims.height / 2;
    const pos = centerToPosition(centerX, centerY, dims.width, dims.height);
    const baseNode: DiagramNodeData = {
      id: diagramId,
      type: 'generic.object.uml-class',
      label: cls.name,
      umlClass: { name: cls.name, attributes: cls.attributes, methods: cls.methods },
      x: pos.x,
      y: pos.y,
      width: dims.width,
      height: dims.height,
      sizeMode: 'custom',
    };
    diagramNodes.push(applyMermaidTheme(baseNode, MERMAID_OCEAN_BLUE));
  });

  // Classes only in edges (implicit)
  let implicitIdx = 0;
  allClassIds.forEach((mId) => {
    if (classesById.has(mId)) return;
    const diagramId = `class-${sanitizeId(mId)}-${++implicitIdx}`;
    idMap.set(mId, diagramId);
    const dims = nodeDimensions.get(mId)!;
    const layoutPos = positions.get(mId) ?? { x: diagramNodes.length * (dims.width + fallbackSpacing), y: 0 };
    const centerX = layoutPos.x + dims.width / 2;
    const centerY = layoutPos.y + dims.height / 2;
    const pos = centerToPosition(centerX, centerY, dims.width, dims.height);
    const baseNode: DiagramNodeData = {
      id: diagramId,
      type: 'generic.object.uml-class',
      label: mId,
      umlClass: { name: mId, attributes: [], methods: [] },
      x: pos.x,
      y: pos.y,
      width: dims.width,
      height: dims.height,
      sizeMode: 'custom',
    };
    diagramNodes.push(applyMermaidTheme(baseNode, MERMAID_OCEAN_BLUE));
  });

  const connections: DiagramConnectionData[] = edges
    .map((e): DiagramConnectionData | null => {
      const fromId = idMap.get(e.from);
      const toId = idMap.get(e.to);
      if (!fromId || !toId) return null;
      return { from: fromId, to: toId, toArrow: true };
    })
    .filter((c): c is DiagramConnectionData => c !== null);

  return {
    nodes: diagramNodes,
    connections,
    groupings: undefined,
  };
}
