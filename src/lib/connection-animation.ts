import type { DiagramConnectionData } from '@/lib/types';

export type ConnectionAnimationShape = 'dot' | 'square' | 'arrow' | 'triangle' | 'hexagon';

export interface NormalizedConnectionAnimation {
  enabled: boolean;
  shape: ConnectionAnimationShape;
  speed: number;
  size: number;
  color?: string;
  autoCount: boolean;
  shapeCount: number;
  spacing: number;
}

export const DEFAULT_CONNECTION_ANIMATION: NormalizedConnectionAnimation = {
  enabled: false,
  shape: 'dot',
  speed: 20,
  size: 2,
  autoCount: true,
  shapeCount: 5,
  spacing: 2,
};

const roundToStep = (value: number, step: number) => Math.round(value / step) * step;

export function clampConnectionAnimation(animation?: DiagramConnectionData['animation']): NormalizedConnectionAnimation {
  const hasLegacyAnimationConfig = !!animation && (
    animation.shape !== undefined ||
    animation.speed !== undefined ||
    animation.size !== undefined ||
    animation.color !== undefined ||
    animation.autoCount !== undefined ||
    animation.shapeCount !== undefined ||
    animation.spacing !== undefined
  );
  const enabled = animation?.enabled ?? hasLegacyAnimationConfig;
  const shape = animation?.shape ?? DEFAULT_CONNECTION_ANIMATION.shape;
  const speed = roundToStep(Math.max(-100, Math.min(100, animation?.speed ?? DEFAULT_CONNECTION_ANIMATION.speed)), 5);
  const size = Math.max(0, Math.min(10, roundToStep(animation?.size ?? DEFAULT_CONNECTION_ANIMATION.size, 0.5)));
  const autoCount = animation?.autoCount ?? DEFAULT_CONNECTION_ANIMATION.autoCount;
  const shapeCount = Math.max(0, Math.min(2000, Math.round(animation?.shapeCount ?? DEFAULT_CONNECTION_ANIMATION.shapeCount)));
  const spacing = Math.max(0, Math.min(10, roundToStep(animation?.spacing ?? DEFAULT_CONNECTION_ANIMATION.spacing, 0.5)));

  return {
    enabled,
    shape,
    speed,
    size,
    color: animation?.color,
    autoCount,
    shapeCount,
    spacing,
  };
}

export function toConnectionAnimationPatch(animation: DiagramConnectionData['animation']): DiagramConnectionData['animation'] {
  const normalized = clampConnectionAnimation(animation);
  return {
    enabled: normalized.enabled,
    shape: normalized.shape,
    speed: normalized.speed,
    size: normalized.size,
    color: normalized.color,
    autoCount: normalized.autoCount,
    shapeCount: normalized.shapeCount,
    spacing: normalized.spacing,
  };
}

export function connectionAnimationStylePatch(connection: DiagramConnectionData): DiagramConnectionData['animation'] {
  const normalized = clampConnectionAnimation(connection.animation);
  return {
    enabled: normalized.enabled,
    shape: normalized.shape,
    speed: normalized.speed,
    size: normalized.size,
    color: normalized.color,
    autoCount: normalized.autoCount,
    shapeCount: normalized.shapeCount,
    spacing: normalized.spacing,
  };
}

/**
 * Returns the set of node IDs in the downstream animation chain from the given root.
 * Includes rootId and all nodes reachable by following outbound connections that have animation defined.
 * Used for click-to-toggle: when clicking a node, we enable/disable animations for the whole chain.
 */
export function getDownstreamAnimationChainNodes(
  rootId: string,
  connections: DiagramConnectionData[]
): Set<string> {
  const result = new Set<string>([rootId]);
  const frontier: string[] = [rootId];
  const visited = new Set<string>([rootId]);

  while (frontier.length > 0) {
    const current = frontier.shift()!;
    for (const conn of connections) {
      if (conn.from !== current) continue;
      if (!clampConnectionAnimation(conn.animation).enabled) continue;
      if (visited.has(conn.to)) continue;
      visited.add(conn.to);
      result.add(conn.to);
      frontier.push(conn.to);
    }
  }
  return result;
}
