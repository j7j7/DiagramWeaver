/**
 * Mermaid-compatible layout using dagre (default) or elkjs.
 * Matches Mermaid flowchart config: layout, nodeSpacing, rankSpacing, direction.
 */

import dagre from '@dagrejs/dagre';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { MermaidDirection, MermaidFlowchartConfig } from './mermaid-parser';

const NODE_WIDTH = 100;
const NODE_HEIGHT = 60;

/** Mermaid defaults per flowchart config schema */
const MERMAID_NODE_SPACING = 50;
const MERMAID_RANK_SPACING = 50;

/** Map Mermaid direction to dagre rankdir */
function toRankDir(direction: MermaidDirection): string {
  return direction === 'TD' ? 'TB' : direction;
}

/** Map Mermaid direction to ELK direction (DOWN/UP/RIGHT/LEFT) */
function toElkDirection(direction: MermaidDirection): string {
  switch (direction) {
    case 'LR': return 'RIGHT';
    case 'RL': return 'LEFT';
    case 'BT': return 'UP';
    default: return 'DOWN'; // TD
  }
}

/** Per-node dimensions for layout (optional) */
export type NodeDimensions = Map<string, { width: number; height: number }>;

/** Layout nodes using dagre (Mermaid default) */
function layoutWithDagre(
  nodeIds: string[],
  edges: { from: string; to: string }[],
  direction: MermaidDirection,
  config?: MermaidFlowchartConfig,
  nodeDimensions?: NodeDimensions
): Map<string, { x: number; y: number }> {
  const nodesep = config?.nodeSpacing ?? MERMAID_NODE_SPACING;
  const ranksep = config?.rankSpacing ?? MERMAID_RANK_SPACING;

  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: toRankDir(direction),
    nodesep,
    ranksep,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodeIds.forEach((id) => {
    const dims = nodeDimensions?.get(id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
    g.setNode(id, { width: dims.width, height: dims.height });
  });
  edges.forEach((e) => {
    g.setEdge(e.from, e.to);
  });

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  nodeIds.forEach((id) => {
    const node = g.node(id);
    const dims = nodeDimensions?.get(id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
    if (node) {
      positions.set(id, { x: node.x - dims.width / 2, y: node.y - dims.height / 2 });
    }
  });
  return positions;
}

/** Layout nodes using elkjs (when layout: elk in config) */
async function layoutWithElk(
  nodeIds: string[],
  edges: { from: string; to: string }[],
  direction: MermaidDirection,
  config?: MermaidFlowchartConfig,
  nodeDimensions?: NodeDimensions
): Promise<Map<string, { x: number; y: number }>> {
  const nodeSpacing = config?.nodeSpacing ?? MERMAID_NODE_SPACING;
  const rankSpacing = config?.rankSpacing ?? MERMAID_RANK_SPACING;

  const elk = new ELK();
  const elkOptions: Record<string, string> = {
    'elk.algorithm': 'layered',
    'elk.direction': toElkDirection(direction),
    'elk.spacing.nodeNode': String(nodeSpacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(rankSpacing),
  };
  if (config?.elk?.nodePlacementStrategy) {
    elkOptions['elk.nodePlacementStrategy'] = config.elk.nodePlacementStrategy;
  }
  if (config?.elk?.mergeEdges !== undefined) {
    elkOptions['elk.mergeEdges'] = String(config.elk.mergeEdges);
  }

  const children = nodeIds.map((id) => {
    const dims = nodeDimensions?.get(id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };
    return { id, width: dims.width, height: dims.height };
  });

  const elkEdges = edges.map((e, i) => ({
    id: `e${i}`,
    sources: [e.from],
    targets: [e.to],
  }));

  const graph = {
    id: 'root',
    layoutOptions: elkOptions,
    children,
    edges: elkEdges,
  };

  const result = await elk.layout(graph);
  const positions = new Map<string, { x: number; y: number }>();
  ;(result.children ?? []).forEach((node) => {
    if (node.id && typeof node.x === 'number' && typeof node.y === 'number') {
      positions.set(node.id, { x: node.x, y: node.y });
    }
  });
  return positions;
}

/**
 * Compute node positions using Mermaid layout config.
 * Uses dagre by default, or elkjs when config.layout === 'elk'.
 * Optional nodeDimensions map provides per-node width/height for proper spacing.
 */
export async function computeMermaidLayout(
  nodeIds: string[],
  edges: { from: string; to: string }[],
  direction: MermaidDirection,
  config?: MermaidFlowchartConfig,
  nodeDimensions?: NodeDimensions
): Promise<Map<string, { x: number; y: number }>> {
  if (config?.layout === 'elk') {
    return layoutWithElk(nodeIds, edges, direction, config, nodeDimensions);
  }
  return Promise.resolve(layoutWithDagre(nodeIds, edges, direction, config, nodeDimensions));
}

export { NODE_WIDTH, NODE_HEIGHT };
