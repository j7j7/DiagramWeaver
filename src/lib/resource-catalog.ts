import type { ResourceMapping } from '@/lib/resource-mapping';
import type { DiagramData, DiagramNodeData } from '@/lib/types';
import { isConnectorLineNodeType } from '@/lib/utils';

interface CatalogResource {
  name: string;
  file: string;
}

export interface ProviderCatalog {
  categories?: Record<string, { resources?: CatalogResource[] }>;
}

const catalogLoadCache = new Map<string, Promise<ProviderCatalog | null>>();

/** Types that resolve icons via the resource catalog (not Lucide, shapes, charts, etc.). */
export function typeNeedsCatalogMetadata(type: string | undefined): boolean {
  if (!type || typeof type !== 'string') return false;
  if (type === 'user' || type === 'generic.server') return false;
  if (type.startsWith('generic.icon.') || type.startsWith('generic.emoji.')) return false;
  if (type.startsWith('generic.object.') || type.startsWith('generic.text.')) return false;
  if (type.startsWith('generic.chart.') || type.startsWith('generic.grouping.')) return false;
  if (isConnectorLineNodeType(type)) return false;
  return type.split('.').length >= 3;
}

export function nodeHasCompleteResourceMetadata(node: DiagramNodeData): boolean {
  return !!(node.provider?.trim() && node.category?.trim() && node.file?.trim());
}

function normalizeResourceName(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase();
}

function parseTypeParts(type: string): { provider: string; category: string; resourceName: string } | null {
  const parts = type.split('.');
  if (parts.length < 3) return null;
  return {
    provider: parts[0].toLowerCase(),
    category: parts[1].toLowerCase(),
    resourceName: parts.slice(2).join('-').toLowerCase(),
  };
}

/** Load and cache a provider catalog JSON (`/resources/resource-{provider}.json`). */
export function loadProviderCatalog(provider: string): Promise<ProviderCatalog | null> {
  const key = provider.toLowerCase();
  let pending = catalogLoadCache.get(key);
  if (!pending) {
    pending = fetch(`/resources/resource-${key}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<ProviderCatalog>) : null))
      .catch(() => null);
    catalogLoadCache.set(key, pending);
  }
  return pending;
}

/** Resolve icon file metadata from a loaded catalog and node type string. */
export function lookupResourceInCatalog(catalog: ProviderCatalog | null, type: string): ResourceMapping | null {
  if (!catalog?.categories) return null;
  const parsed = parseTypeParts(type);
  if (!parsed) return null;

  const findInResources = (resources: CatalogResource[] | undefined) =>
    resources?.find((r) => normalizeResourceName(r.name) === parsed.resourceName);

  let categoryData = catalog.categories[parsed.category];
  let resource = findInResources(categoryData?.resources);

  if (
    !resource?.file &&
    parsed.provider === 'generic' &&
    parsed.category === 'object' &&
    parsed.resourceName === 'text-box-heading'
  ) {
    categoryData = catalog.categories.text;
    resource = findInResources(categoryData?.resources);
  }

  if (!resource?.file) return null;

  return {
    provider: parsed.provider,
    category: parsed.category,
    file: resource.file,
  };
}

/** Resolve provider / category / file for a catalog-backed node type. */
export async function resolveResourceMetadataForType(type: string): Promise<ResourceMapping | null> {
  if (!typeNeedsCatalogMetadata(type)) return null;
  const parsed = parseTypeParts(type);
  if (!parsed) return null;
  const catalog = await loadProviderCatalog(parsed.provider);
  return lookupResourceInCatalog(catalog, type);
}

function collectTypesNeedingMetadata(diagram: DiagramData, out: Set<string>): void {
  for (const node of diagram.nodes ?? []) {
    if (!nodeHasCompleteResourceMetadata(node) && typeNeedsCatalogMetadata(node.type)) {
      out.add(node.type);
    }
  }
  if (diagram.subDiagrams) {
    for (const sub of Object.values(diagram.subDiagrams)) {
      collectTypesNeedingMetadata(sub, out);
    }
  }
}

function applyMetadataToNodes(
  nodes: DiagramNodeData[],
  resolvedByType: Map<string, ResourceMapping>
): DiagramNodeData[] {
  return nodes.map((node) => {
    if (nodeHasCompleteResourceMetadata(node) || !typeNeedsCatalogMetadata(node.type)) {
      return node;
    }
    const mapping = resolvedByType.get(node.type.toLowerCase());
    if (!mapping) return node;
    return {
      ...node,
      provider: mapping.provider,
      category: mapping.category,
      file: mapping.file,
    };
  });
}

function enrichDiagramTree(diagram: DiagramData, resolvedByType: Map<string, ResourceMapping>): DiagramData {
  const next: DiagramData = {
    ...diagram,
    nodes: applyMetadataToNodes(diagram.nodes ?? [], resolvedByType),
  };
  if (diagram.subDiagrams) {
    const subDiagrams: DiagramData['subDiagrams'] = {};
    for (const [key, sub] of Object.entries(diagram.subDiagrams)) {
      subDiagrams[key] = enrichDiagramTree(sub, resolvedByType);
    }
    next.subDiagrams = subDiagrams;
  }
  return next;
}

/**
 * Fill missing `provider` / `category` / `file` on catalog-backed nodes using resource JSON catalogs.
 * Safe to call on already-enriched diagrams (no-op when metadata is complete).
 */
export async function enrichDiagramResourceMetadata(diagram: DiagramData): Promise<DiagramData> {
  const typesNeeding = new Set<string>();
  collectTypesNeedingMetadata(diagram, typesNeeding);
  if (typesNeeding.size === 0) return diagram;

  const providers = new Set<string>();
  for (const type of typesNeeding) {
    const parsed = parseTypeParts(type);
    if (parsed) providers.add(parsed.provider);
  }
  await Promise.all([...providers].map((provider) => loadProviderCatalog(provider)));

  const resolvedByType = new Map<string, ResourceMapping>();
  await Promise.all(
    [...typesNeeding].map(async (type) => {
      const mapping = await resolveResourceMetadataForType(type);
      if (mapping) resolvedByType.set(type.toLowerCase(), mapping);
    })
  );

  if (resolvedByType.size === 0) return diagram;
  return enrichDiagramTree(diagram, resolvedByType);
}
