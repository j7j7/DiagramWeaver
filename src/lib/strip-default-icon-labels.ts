import { EMOJI_ICONS, SYMBOL_ICONS } from "@/lib/icon-resources";
import {
  loadProviderCatalog,
  typeNeedsCatalogMetadata,
  type ProviderCatalog,
} from "@/lib/resource-catalog";
import type { DiagramData, DiagramNodeData } from "@/lib/types";
import { isDiagramIconTileNodeType } from "@/lib/utils";

function slugify(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

function normalizeLabelCompare(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Lucide type slug (`generic.icon.user`) → palette display name (`Person`). */
const LUCIDE_TYPE_SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  SYMBOL_ICONS.map((item) => [slugify(item.iconName), item.name]),
);

/** Emoji type slug → palette display name. */
const EMOJI_TYPE_SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  EMOJI_ICONS.map((item) => [slugify(item.name), item.name]),
);

function parseTypeParts(
  type: string,
): { provider: string; category: string; resourceName: string } | null {
  const parts = type.split(".");
  if (parts.length < 3) return null;
  return {
    provider: parts[0].toLowerCase(),
    category: parts[1].toLowerCase(),
    resourceName: parts.slice(2).join("-").toLowerCase(),
  };
}

function lookupCatalogDisplayName(catalog: ProviderCatalog | null, type: string): string | null {
  if (!catalog?.categories) return null;
  const parsed = parseTypeParts(type);
  if (!parsed) return null;

  const findInResources = (resources: { name: string; file: string }[] | undefined) =>
    resources?.find((r) => slugify(r.name) === parsed.resourceName);

  let categoryData = catalog.categories[parsed.category];
  let resource = findInResources(categoryData?.resources);

  if (
    !resource?.file &&
    parsed.provider === "generic" &&
    parsed.category === "object" &&
    parsed.resourceName === "text-box-heading"
  ) {
    categoryData = catalog.categories.text;
    resource = findInResources(categoryData?.resources);
  }

  return resource?.name ?? null;
}

function resolveSyncDefaultIconLabel(node: DiagramNodeData): string | null {
  const type = node.type;
  if (!type) return null;

  if (type.startsWith("generic.icon.") || node.iconType === "lucide") {
    const slug = type.startsWith("generic.icon.")
      ? type.slice("generic.icon.".length).toLowerCase()
      : slugify(node.iconName ?? "");
    return LUCIDE_TYPE_SLUG_TO_LABEL[slug] ?? null;
  }

  if (type.startsWith("generic.emoji.") || node.iconType === "emoji") {
    const slug = type.startsWith("generic.emoji.")
      ? type.slice("generic.emoji.".length).toLowerCase()
      : slugify(node.label ?? "");
    return EMOJI_TYPE_SLUG_TO_LABEL[slug] ?? null;
  }

  return null;
}

function isDefaultInfoForLabel(
  info: string | undefined,
  defaultLabel: string,
): boolean {
  const normalizedInfo = normalizeLabelCompare(info);
  if (!normalizedInfo) return false;
  const label = normalizeLabelCompare(defaultLabel);
  if (!label) return false;
  if (normalizedInfo === `a new ${label}`) return true;
  // Palette sets `"{name} from {providerKey}"`; accept any trailing provider token.
  return normalizedInfo.startsWith(`${label} from `);
}

function stripNodeDefaultIconText(
  node: DiagramNodeData,
  defaultLabel: string | null,
): DiagramNodeData {
  if (!defaultLabel) return node;

  const labelIsDefault =
    normalizeLabelCompare(node.label) === normalizeLabelCompare(defaultLabel);
  const infoIsDefault = isDefaultInfoForLabel(node.info, defaultLabel);

  if (!labelIsDefault && !infoIsDefault) return node;

  const next: DiagramNodeData = { ...node };
  if (labelIsDefault) {
    next.label = "";
  }
  if (infoIsDefault) {
    next.info = undefined;
  }
  return next;
}

export type StripDefaultIconLabelsResult = {
  diagram: DiagramData;
  /** Nodes whose label and/or info were cleared. */
  clearedCount: number;
};

/**
 * Clear icon/resource labels (and matching auto `info`) that still equal the palette default.
 * Customized labels/descriptions are left alone. Shapes, charts, cards, and text nodes are skipped.
 */
export async function stripDefaultIconLabelsFromDiagram(
  diagram: DiagramData,
): Promise<StripDefaultIconLabelsResult> {
  const nodes = diagram.nodes ?? [];
  const iconNodes = nodes.filter((n) => isDiagramIconTileNodeType(n.type, n.iconType));
  if (iconNodes.length === 0) {
    return { diagram, clearedCount: 0 };
  }

  const providersNeeded = new Set<string>();
  for (const node of iconNodes) {
    if (typeNeedsCatalogMetadata(node.type)) {
      const parsed = parseTypeParts(node.type);
      if (parsed) providersNeeded.add(parsed.provider);
    }
  }

  const catalogs = new Map<string, ProviderCatalog | null>();
  await Promise.all(
    [...providersNeeded].map(async (provider) => {
      catalogs.set(provider, await loadProviderCatalog(provider));
    }),
  );

  let clearedCount = 0;
  const nextNodes = nodes.map((node) => {
    if (!isDiagramIconTileNodeType(node.type, node.iconType)) return node;

    let defaultLabel = resolveSyncDefaultIconLabel(node);
    if (!defaultLabel && typeNeedsCatalogMetadata(node.type)) {
      const parsed = parseTypeParts(node.type);
      if (parsed) {
        defaultLabel = lookupCatalogDisplayName(catalogs.get(parsed.provider) ?? null, node.type);
      }
    }

    const stripped = stripNodeDefaultIconText(node, defaultLabel);
    if (stripped !== node) clearedCount += 1;
    return stripped;
  });

  if (clearedCount === 0) {
    return { diagram, clearedCount: 0 };
  }

  return {
    diagram: { ...diagram, nodes: nextNodes },
    clearedCount,
  };
}
