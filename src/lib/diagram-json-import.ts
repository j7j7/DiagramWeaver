import type { DiagramData, DiagramNodeData } from '@/lib/types';
import { DiagramDataSchema } from '@/lib/schemas';
import { flattenDiagramOnImport, type RawDiagramData } from '@/lib/flatten-on-import';
import { ensureConnectionIds } from '@/lib/connection-order-utils';
import { ensureDiagramLayersPersisted } from '@/lib/layers-utils';
import { normalizeHttpImageUrl, sanitizeCustomIconsInDiagram } from '@/lib/custom-icon-utils';
import { assertSubDiagramDepthWithinLimit } from '@/lib/import-json-limits';
import { cleanupStaleGroupings } from '@/lib/grouping-utils';
import { enrichDiagramResourceMetadata } from '@/lib/resource-catalog';

/**
 * Parse imported JSON into validated DiagramData (flatten zones, schema, custom-icon sanitize).
 * Does not enrich resource icon metadata — use {@link parseDiagramJson} for full import.
 */
export function parseDiagramJsonSync(json: unknown): DiagramData {
  assertSubDiagramDepthWithinLimit(json);
  const flattened = flattenDiagramOnImport((json || {}) as RawDiagramData);
  assertSubDiagramDepthWithinLimit(flattened);

  const preSanitized = {
    ...flattened,
    nodes: (flattened.nodes || []).map((node) => {
      const n = node as DiagramNodeData & { imageUrl?: string };
      if (n?.type !== 'generic.icon.custom') return node;
      const normalizedUrl = normalizeHttpImageUrl(n?.imageUrl);
      if (!normalizedUrl) {
        const { imageUrl: _discard, ...rest } = n;
        return rest as typeof node;
      }
      return { ...node, imageUrl: normalizedUrl };
    }),
  };

  const result = DiagramDataSchema.safeParse(preSanitized);
  if (!result.success) {
    throw new Error(`Invalid diagram format: ${result.error.message}`);
  }
  const data = result.data as DiagramData;
  return cleanupStaleGroupings(
    ensureDiagramLayersPersisted(
      sanitizeCustomIconsInDiagram({
        ...data,
        connections: ensureConnectionIds(data.connections || []),
      }),
    ),
  );
}

/** Parse imported JSON and backfill missing resource icon metadata from catalogs. */
export async function parseDiagramJson(json: unknown): Promise<DiagramData> {
  const parsed = parseDiagramJsonSync(json);
  return enrichDiagramResourceMetadata(parsed);
}
