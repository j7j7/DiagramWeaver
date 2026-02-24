/**
 * Converts parsed Mermaid flowchart data to DiagramWeaver DiagramData.
 * Maps Mermaid shapes to generic.object.* types, uses dagre/elkjs for
 * Mermaid-compatible layout, and creates connections.
 * Node dimensions are computed from labels so text is not truncated.
 */

import type { DiagramData, DiagramNodeData, DiagramConnectionData } from '@/lib/types';
import type { ParsedMermaid, MermaidNode, MermaidEdge } from './mermaid-parser';
import { computeMermaidLayout } from './mermaid-layout';

const GRID_STEP = 10;
const GRID_SNAP = 20; // Match canvas-constants for position alignment
const AVG_CHAR_WIDTH = 8;
const TEXT_PADDING = 20;
const MIN_WIDTH = 80;
const MAX_WIDTH = 220;
const BASE_HEIGHT = 56;

function snapToGrid(v: number, minVal = 20): number {
  const snapped = Math.round(v / GRID_STEP) * GRID_STEP;
  return Math.max(minVal, snapped);
}

function snapPosToGrid(v: number): number {
  return Math.round(v / GRID_SNAP) * GRID_SNAP;
}

/** Estimate node dimensions from label so text fits (no truncation) */
function estimateNodeDimensions(label: string): { width: number; height: number } {
  const lines = (label || '').split('\n');
  const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
  const width = snapToGrid(
    Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, maxLineLen * AVG_CHAR_WIDTH + TEXT_PADDING))
  );
  const height = snapToGrid(BASE_HEIGHT + (lines.length - 1) * 18);
  return { width, height };
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

const DECISION_SHAPE_MULTIPLIER = 3; // Decision nodes (diamond) 3x larger

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

  // Compute dimensions from labels; decision nodes (diamond) are 3x larger
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  nodes.forEach((n) => {
    let dims = estimateNodeDimensions(n.label || n.id);
    if (n.shape === 'diamond') {
      dims = {
        width: snapToGrid(dims.width * DECISION_SHAPE_MULTIPLIER),
        height: snapToGrid(dims.height * DECISION_SHAPE_MULTIPLIER),
      };
    }
    nodeDimensions.set(n.id, dims);
  });
  allNodeIds.forEach((id) => {
    if (!nodeDimensions.has(id)) {
      const mNode = nodesById.get(id);
      let dims = estimateNodeDimensions(mNode?.label ?? id);
      if (mNode?.shape === 'diamond') {
        dims = {
          width: snapToGrid(dims.width * DECISION_SHAPE_MULTIPLIER),
          height: snapToGrid(dims.height * DECISION_SHAPE_MULTIPLIER),
        };
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
    const pos = positions.get(mNode.id) ?? { x: idx * (dims.width + fallbackSpacing), y: 0 };
    const type = mermaidShapeToDiagramType(mNode.shape);
    diagramNodes.push({
      id: diagramId,
      type,
      label: mNode.label || mNode.id,
      x: snapPosToGrid(pos.x),
      y: snapPosToGrid(pos.y),
      width: dims.width,
      height: dims.height,
      sizeMode: 'custom',
    });
  });

  // Add nodes that were only referenced in edges (implicit nodes)
  let implicitIdx = 0;
  Array.from(allNodeIds).forEach(mId => {
    if (nodesById.has(mId)) return;
    const diagramId = `mermaid-${sanitizeId(mId)}-${++implicitIdx}`;
    idMap.set(mId, diagramId);
    const dims = nodeDimensions.get(mId)!;
    const pos = positions.get(mId) ?? { x: diagramNodes.length * (dims.width + fallbackSpacing), y: 0 };
    diagramNodes.push({
      id: diagramId,
      type: 'generic.object.rectangle',
      label: mId,
      x: snapPosToGrid(pos.x),
      y: snapPosToGrid(pos.y),
      width: dims.width,
      height: dims.height,
      sizeMode: 'custom',
    });
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
