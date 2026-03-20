import type { DiagramData, DiagramDelta, PresentationDeck, Slide } from '@/lib/types';
import { PresentationDeckListSchema } from '@/lib/schemas';
import { projectVisibleDiagram } from '@/lib/presentation-delta';

const PRESENTATION_THUMBNAIL_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%2311141a"/><text x="160" y="90" text-anchor="middle" dominant-baseline="middle" fill="%23d1d5db" font-family="Arial, sans-serif" font-size="14">Slide</text></svg>';

function safeClone<T>(value: T): T {
  if (value === undefined) return value;

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to JSON cloning for plain serializable data.
    }
  }

  const serialized = JSON.stringify(value);
  if (serialized === undefined) return value;
  return JSON.parse(serialized) as T;
}

function buildBaseNodeMap(baseDiagram: DiagramData): Map<string, DiagramData['nodes'][number]> {
  const map = new Map<string, DiagramData['nodes'][number]>();
  for (const node of baseDiagram.nodes || []) {
    if (node?.id) map.set(node.id, node);
  }
  return map;
}

function expandNodeIdsToNodes(ids: string[], baseDiagram: DiagramData): DiagramData['nodes'] {
  const baseNodeMap = buildBaseNodeMap(baseDiagram);
  const expanded: DiagramData['nodes'] = [];
  for (const id of ids) {
    const node = baseNodeMap.get(id);
    if (node) expanded.push(safeClone(node));
  }
  return expanded;
}

function expandVisibleLayerIdsToLayers(
  visibleIds: string[],
  baseDiagram: DiagramData
): NonNullable<DiagramData['layers']>['layers'] {
  const visibleSet = new Set(visibleIds);
  const baseLayers = baseDiagram.layers?.layers || [];
  return baseLayers.map((layer) => ({
    ...safeClone(layer),
    visible: visibleSet.has(layer.id),
  }));
}

type CompactAnimationStateV2 = {
  e?: 0;
  f?: string[];
  x?: string[];
};

type CompactSlideV2 = {
  d?: { o: [number, string, unknown?][] };
  r?: {
    n?: string[];
    l?: string[];
    c?: unknown[];
    ni?: number;
    li?: number;
    ci?: number;
  };
  t?: string;
  a?: CompactAnimationStateV2;
  z?: number;
};

type CompactDeckV2 = {
  n?: string;
  tn?: string[][];
  tl?: string[][];
  tc?: unknown[][];
  s: CompactSlideV2[];
};

export interface ExtractedEmbeddedPresentations {
  decks: PresentationDeck[];
  activeDeckId: string | null;
}

/**
 * Hydrates `presentations` embedded in saved diagram JSON (v2 compact format or legacy full decks).
 * `baseDiagram` must match the diagram payload used when the file was saved (same nodes/layers for id expansion).
 */
export function extractEmbeddedPresentations(
  rawJson: unknown,
  baseDiagram: DiagramData
): ExtractedEmbeddedPresentations {
  if (!rawJson || typeof rawJson !== 'object') {
    return { decks: [], activeDeckId: null };
  }

  const raw = rawJson as {
    presentations?: {
      v?: number;
      ai?: number;
      d?: unknown;
      decks?: unknown;
      activeDeckId?: string | null;
    };
  };

  const compactRaw = raw.presentations;
  if (compactRaw?.v === 2 && Array.isArray(compactRaw.d)) {
    const now = Date.now();
    const baseForPresentationExpansion = projectVisibleDiagram(baseDiagram);

    const hydratedDecks: PresentationDeck[] = (compactRaw.d as CompactDeckV2[]).map((rawDeck, deckIndex) => {
      const deck = (rawDeck && typeof rawDeck === 'object' ? rawDeck : {}) as CompactDeckV2;
      const slidesRaw = Array.isArray(deck.s) ? deck.s : [];

      const slides: Slide[] = slidesRaw.map((rawSlide, slideIndex) => {
        const slide = (rawSlide && typeof rawSlide === 'object' ? rawSlide : {}) as CompactSlideV2;
        const opsRaw = Array.isArray(slide.d?.o) ? slide.d.o : [];
        const operations: DiagramDelta['operations'] = opsRaw
          .map((entry) => {
            if (!Array.isArray(entry) || entry.length < 2) return null;
            const [code, path, value] = entry;
            if (typeof path !== 'string') return null;
            let op: 'add' | 'remove' | 'replace' | null = null;
            if (code === 0) op = 'add';
            if (code === 1) op = 'remove';
            if (code === 2) op = 'replace';
            if (!op) return null;
            return value === undefined ? { op, path } : { op, path, value };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

        const deckNodeTable = Array.isArray(deck.tn) ? deck.tn : [];
        const deckLayerTable = Array.isArray(deck.tl) ? deck.tl : [];
        const deckConnectionTable = Array.isArray(deck.tc) ? deck.tc : [];
        const nodeIdsFromRefs = Array.isArray(slide.r?.n)
          ? slide.r?.n
          : typeof slide.r?.ni === 'number' && slide.r.ni >= 0
            ? deckNodeTable[slide.r.ni]
            : undefined;

        if (nodeIdsFromRefs && Array.isArray(nodeIdsFromRefs)) {
          operations.push({
            op: 'replace',
            path: '/nodes',
            value: expandNodeIdsToNodes(nodeIdsFromRefs, baseForPresentationExpansion),
          });
        }

        const layerIdsFromRefs = Array.isArray(slide.r?.l)
          ? slide.r?.l
          : typeof slide.r?.li === 'number' && slide.r.li >= 0
            ? deckLayerTable[slide.r.li]
            : undefined;

        if (layerIdsFromRefs && Array.isArray(layerIdsFromRefs) && baseForPresentationExpansion.layers?.layers) {
          operations.push({
            op: 'replace',
            path: '/layers/layers',
            value: expandVisibleLayerIdsToLayers(layerIdsFromRefs, baseForPresentationExpansion),
          });
        }

        const connectionsFromRefs = Array.isArray(slide.r?.c)
          ? slide.r?.c
          : typeof slide.r?.ci === 'number' && slide.r.ci >= 0
            ? deckConnectionTable[slide.r.ci]
            : undefined;

        if (connectionsFromRefs && Array.isArray(connectionsFromRefs)) {
          operations.push({
            op: 'replace',
            path: '/connections',
            value: connectionsFromRefs,
          });
        }

        const animationState = slide.a
          ? {
              enabled: slide.a.e === 0 ? false : true,
              filterSourceIds: Array.isArray(slide.a.f) && slide.a.f.length > 0 ? slide.a.f : undefined,
              disabledSourceIds: Array.isArray(slide.a.x) && slide.a.x.length > 0 ? slide.a.x : undefined,
            }
          : undefined;

        return {
          id: `slide-${now}-${deckIndex}-${slideIndex}`,
          title: slide.t || `Snapshot ${slideIndex + 1}`,
          snapshotImage: PRESENTATION_THUMBNAIL_PLACEHOLDER,
          diagramDelta: {
            version: '1.0',
            operations,
            compressed: true,
          },
          animationState,
          autoZoomLevel: typeof slide.z === 'number' && Number.isFinite(slide.z) ? slide.z : undefined,
          createdAt: now,
        };
      });

      return {
        id: `deck-${now}-${deckIndex}`,
        name: (deck.n && String(deck.n).trim()) || `Presentation ${deckIndex + 1}`,
        slides,
        createdAt: now,
        updatedAt: now,
      };
    });

    const activeDeckId =
      typeof compactRaw.ai === 'number' && compactRaw.ai >= 0
        ? (hydratedDecks[compactRaw.ai]?.id ?? hydratedDecks[0]?.id ?? null)
        : (hydratedDecks[0]?.id ?? null);

    return { decks: hydratedDecks, activeDeckId };
  }

  const parsedDecks = PresentationDeckListSchema.safeParse(raw.presentations?.decks ?? []);
  if (!parsedDecks.success) {
    return { decks: [], activeDeckId: null };
  }

  const hydratedDecks: PresentationDeck[] = parsedDecks.data.map((deck) => ({
    ...deck,
    slides: deck.slides.map((slide) => ({
      ...slide,
      snapshotImage: slide.snapshotImage || PRESENTATION_THUMBNAIL_PLACEHOLDER,
    })),
  }));

  const activeDeckId = raw.presentations?.activeDeckId ?? hydratedDecks[0]?.id ?? null;
  return { decks: hydratedDecks, activeDeckId };
}
