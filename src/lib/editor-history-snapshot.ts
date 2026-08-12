import type { DiagramData, PresentationDeck } from '@/lib/types';
import { slideNeedsPresentationThumbnailSnapshot } from '@/lib/extract-embedded-presentations';

/** Presentation fields needed to undo/redo slide structure (add/delete/reorder) and non-primary drafts. */
export interface EditorHistoryPresentationSlice {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId: string | null;
  draftDiagram: DiagramData | null;
}

export interface EditorHistorySnapshotV1 {
  v: 1;
  diagram: DiagramData;
  presentation?: EditorHistoryPresentationSlice | null;
}

export interface ParsedEditorHistorySnapshot {
  diagram: DiagramData;
  presentation: EditorHistoryPresentationSlice | null;
  /** True when the stored entry included a presentation slice (even if empty decks). */
  hasPresentation: boolean;
}

/**
 * Drop thumbs + volatile timestamps so thumbnail capture / touch updates do not
 * invent extra undo steps (which previously made the first Ctrl+Z after delete
 * land on another "slide still deleted" entry).
 */
export function stripPresentationImagesForHistory(
  decks: PresentationDeck[],
): PresentationDeck[] {
  return decks.map((deck) => {
    const { baseSnapshotImage: _base, updatedAt: _updatedAt, ...deckRest } = deck;
    return {
      ...deckRest,
      // Keep a stable placeholder so JSON shape stays consistent across commits.
      updatedAt: 0,
      slides: deck.slides.map((slide) => {
        const { snapshotImage: _img, createdAt: _createdAt, ...slideRest } = slide;
        return {
          ...slideRest,
          createdAt: 0,
        };
      }),
    };
  });
}

export function normalizePresentationForHistory(
  presentation: EditorHistoryPresentationSlice | null | undefined,
): EditorHistoryPresentationSlice | null {
  if (!presentation || presentation.decks.length === 0) return null;
  return {
    decks: stripPresentationImagesForHistory(presentation.decks),
    activeDeckId: presentation.activeDeckId,
    activeSlideId: presentation.activeSlideId,
    draftDiagram: presentation.draftDiagram,
  };
}

export function serializeEditorHistorySnapshot(args: {
  diagram: DiagramData;
  presentation?: EditorHistoryPresentationSlice | null;
}): string {
  const presentation = normalizePresentationForHistory(args.presentation);
  const payload: EditorHistorySnapshotV1 = {
    v: 1,
    diagram: args.diagram,
    ...(presentation ? { presentation } : {}),
  };
  return JSON.stringify(payload);
}

function isDiagramDataShape(value: unknown): value is DiagramData {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return Array.isArray(o.nodes) && Array.isArray(o.connections);
}

export function parseEditorHistorySnapshot(raw: string): ParsedEditorHistorySnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      diagram: { nodes: [], connections: [], groupings: [] },
      presentation: null,
      hasPresentation: false,
    };
  }

  if (parsed && typeof parsed === 'object' && (parsed as EditorHistorySnapshotV1).v === 1) {
    const snap = parsed as EditorHistorySnapshotV1;
    const diagram = isDiagramDataShape(snap.diagram)
      ? snap.diagram
      : { nodes: [], connections: [], groupings: [] };
    const hasPresentation = Object.prototype.hasOwnProperty.call(snap, 'presentation');
    const presentation = normalizePresentationForHistory(snap.presentation ?? null);
    return { diagram, presentation, hasPresentation };
  }

  if (isDiagramDataShape(parsed)) {
    return { diagram: parsed, presentation: null, hasPresentation: false };
  }

  return {
    diagram: { nodes: [], connections: [], groupings: [] },
    presentation: null,
    hasPresentation: false,
  };
}

/**
 * When history still has a legacy diagram-only entry and presentation state first appears
 * with the same diagram, upgrade the current slot in place (avoid a fake undo step).
 */
export function shouldUpgradeLegacyHistoryEntry(
  currentRaw: string,
  nextRaw: string,
): boolean {
  const current = parseEditorHistorySnapshot(currentRaw);
  const next = parseEditorHistorySnapshot(nextRaw);
  if (current.hasPresentation || !next.hasPresentation) return false;
  return JSON.stringify(current.diagram) === JSON.stringify(next.diagram);
}

/** True when deck/slide structure matches after stripping volatile thumbs/timestamps. */
export function presentationDecksStructurallyEqual(
  a: PresentationDeck[],
  b: PresentationDeck[],
): boolean {
  return (
    JSON.stringify(stripPresentationImagesForHistory(a)) ===
    JSON.stringify(stripPresentationImagesForHistory(b))
  );
}

/**
 * History snapshots omit PNG thumbs; copy live strip images onto a restored deck list
 * so undo of a canvas edit does not blank every slide and force a full re-capture.
 */
export function mergePresentationDeckThumbnails(
  restored: PresentationDeck[],
  current: PresentationDeck[],
): PresentationDeck[] {
  const currentByDeckId = new Map(current.map((d) => [d.id, d]));
  return restored.map((deck) => {
    const live = currentByDeckId.get(deck.id);
    if (!live) return deck;
    const liveSlideById = new Map(live.slides.map((s) => [s.id, s]));
    return {
      ...deck,
      baseSnapshotImage: deck.baseSnapshotImage ?? live.baseSnapshotImage,
      updatedAt: live.updatedAt || deck.updatedAt,
      slides: deck.slides.map((slide) => {
        const liveSlide = liveSlideById.get(slide.id);
        if (!liveSlide?.snapshotImage) return slide;
        if (!slideNeedsPresentationThumbnailSnapshot(slide.snapshotImage)) {
          return slide;
        }
        return {
          ...slide,
          snapshotImage: liveSlide.snapshotImage,
          createdAt: liveSlide.createdAt || slide.createdAt,
        };
      }),
    };
  });
}

function countNodes(diagram: DiagramData): number {
  return diagram.nodes?.length ?? 0;
}

function slideCount(presentation: EditorHistoryPresentationSlice | null): number {
  if (!presentation?.decks.length) return 0;
  const deck =
    presentation.decks.find((d) => d.id === presentation.activeDeckId) ??
    presentation.decks[0];
  return deck?.slides.length ?? 0;
}

function truncateLabel(text: string, max = 28): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function nodeDisplayName(node: { id: string; label?: string; type?: string }): string {
  if (node.label?.trim()) return truncateLabel(node.label);
  const typeLeaf = node.type?.split('.').filter(Boolean).pop();
  if (typeLeaf) return typeLeaf;
  return truncateLabel(node.id, 12);
}

function formatNameList(names: string[], limit = 2): string {
  if (names.length === 0) return '';
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} +${names.length - limit}`;
}

function connectionKey(c: { id?: string; from: string; to: string }): string {
  return c.id || `${c.from}->${c.to}`;
}

function omitVolatileNodeFields(node: Record<string, unknown>): Record<string, unknown> {
  const { x: _x, y: _y, width: _w, height: _h, label: _l, richLabel: _r, ...rest } = node;
  return rest;
}

/**
 * Concise phrases describing what changed between two diagram snapshots.
 */
export function summarizeDiagramDiff(prev: DiagramData, curr: DiagramData): string[] {
  const parts: string[] = [];
  const prevNodes = new Map((prev.nodes ?? []).map((n) => [n.id, n]));
  const currNodes = new Map((curr.nodes ?? []).map((n) => [n.id, n]));

  const addedNames: string[] = [];
  for (const [id, node] of currNodes) {
    if (!prevNodes.has(id)) addedNames.push(nodeDisplayName(node));
  }
  const removedNames: string[] = [];
  for (const [id, node] of prevNodes) {
    if (!currNodes.has(id)) removedNames.push(nodeDisplayName(node));
  }
  if (addedNames.length) parts.push(`Added ${formatNameList(addedNames)}`);
  if (removedNames.length) parts.push(`Removed ${formatNameList(removedNames)}`);

  const moved: string[] = [];
  const resized: string[] = [];
  const renamed: string[] = [];
  const restyled: string[] = [];
  const edited: string[] = [];

  for (const [id, currNode] of currNodes) {
    const prevNode = prevNodes.get(id);
    if (!prevNode) continue;
    if (JSON.stringify(prevNode) === JSON.stringify(currNode)) continue;

    const name = nodeDisplayName(currNode);
    const posChanged =
      Number(prevNode.x) !== Number(currNode.x) || Number(prevNode.y) !== Number(currNode.y);
    const sizeChanged =
      Number(prevNode.width) !== Number(currNode.width) ||
      Number(prevNode.height) !== Number(currNode.height);
    const labelChanged =
      (prevNode.label ?? '') !== (currNode.label ?? '') ||
      JSON.stringify(prevNode.richLabel ?? null) !== JSON.stringify(currNode.richLabel ?? null);

    const prevRest = omitVolatileNodeFields(prevNode as unknown as Record<string, unknown>);
    const currRest = omitVolatileNodeFields(currNode as unknown as Record<string, unknown>);
    const otherChanged = JSON.stringify(prevRest) !== JSON.stringify(currRest);

    if (labelChanged) renamed.push(name);
    if (posChanged) moved.push(name);
    if (sizeChanged) resized.push(name);
    if (otherChanged && !labelChanged) restyled.push(name);
    if (!posChanged && !sizeChanged && !labelChanged && !otherChanged) edited.push(name);
  }

  if (moved.length) parts.push(`Moved ${formatNameList(moved)}`);
  if (resized.length) parts.push(`Resized ${formatNameList(resized)}`);
  if (renamed.length) parts.push(`Renamed ${formatNameList(renamed)}`);
  if (restyled.length) parts.push(`Styled ${formatNameList(restyled)}`);
  if (edited.length) parts.push(`Edited ${formatNameList(edited)}`);

  const prevConns = new Map(
    (prev.connections ?? []).map((c) => [connectionKey(c), c] as const),
  );
  const currConns = new Map(
    (curr.connections ?? []).map((c) => [connectionKey(c), c] as const),
  );
  let connAdded = 0;
  let connRemoved = 0;
  let connEdited = 0;
  for (const key of currConns.keys()) {
    if (!prevConns.has(key)) connAdded += 1;
  }
  for (const key of prevConns.keys()) {
    if (!currConns.has(key)) connRemoved += 1;
  }
  for (const [key, currC] of currConns) {
    const prevC = prevConns.get(key);
    if (!prevC) continue;
    if (JSON.stringify(prevC) !== JSON.stringify(currC)) connEdited += 1;
  }
  if (connAdded) parts.push(`Added ${connAdded} connection${connAdded === 1 ? '' : 's'}`);
  if (connRemoved) {
    parts.push(`Removed ${connRemoved} connection${connRemoved === 1 ? '' : 's'}`);
  }
  if (connEdited) parts.push(`Edited ${connEdited} connection${connEdited === 1 ? '' : 's'}`);

  const prevGroups = prev.groupings?.length ?? 0;
  const currGroups = curr.groupings?.length ?? 0;
  if (currGroups !== prevGroups) {
    const d = currGroups - prevGroups;
    parts.push(d > 0 ? `Added ${d} group${d === 1 ? '' : 's'}` : `Removed ${Math.abs(d)} group${d === -1 ? '' : 's'}`);
  }

  if (
    JSON.stringify(prev.viewState ?? null) !== JSON.stringify(curr.viewState ?? null) &&
    parts.length === 0
  ) {
    parts.push('View change');
  }

  if (
    (prev.canvasBackgroundColor ?? '') !== (curr.canvasBackgroundColor ?? '') &&
    !parts.some((p) => p.startsWith('Styled'))
  ) {
    parts.push('Canvas background');
  }

  return parts;
}

/**
 * Short label for a history entry relative to the previous snapshot (for the history browser).
 */
export function describeEditorHistoryStep(
  previousRaw: string | null | undefined,
  currentRaw: string,
): string {
  const curr = parseEditorHistorySnapshot(currentRaw);
  if (!previousRaw) {
    const nodes = countNodes(curr.diagram);
    const slides = slideCount(curr.presentation);
    if (slides > 0) return `Initial state (${nodes} objects, ${slides} slides)`;
    return `Initial state (${nodes} objects)`;
  }

  const prev = parseEditorHistorySnapshot(previousRaw);
  const parts: string[] = [];

  const diagramParts = summarizeDiagramDiff(prev.diagram, curr.diagram);
  parts.push(...diagramParts);

  const prevDraft = prev.presentation?.draftDiagram ?? null;
  const currDraft = curr.presentation?.draftDiagram ?? null;
  if (prevDraft || currDraft) {
    const draftPrev = prevDraft ?? { nodes: [], connections: [], groupings: [] };
    const draftCurr = currDraft ?? { nodes: [], connections: [], groupings: [] };
    if (JSON.stringify(draftPrev) !== JSON.stringify(draftCurr)) {
      const draftParts = summarizeDiagramDiff(draftPrev, draftCurr);
      if (draftParts.length) {
        parts.push(...draftParts.map((p) => `Slide: ${p}`));
      } else {
        parts.push('Slide content');
      }
    }
  }

  const prevSlides = slideCount(prev.presentation);
  const currSlides = slideCount(curr.presentation);
  if (currSlides !== prevSlides) {
    if (currSlides > prevSlides) {
      parts.push(
        `Added ${currSlides - prevSlides} slide${currSlides - prevSlides === 1 ? '' : 's'}`,
      );
    } else {
      parts.push(
        `Removed ${prevSlides - currSlides} slide${prevSlides - currSlides === 1 ? '' : 's'}`,
      );
    }
  }

  const prevActive = prev.presentation?.activeSlideId ?? null;
  const currActive = curr.presentation?.activeSlideId ?? null;
  if (prevActive !== currActive && (prevActive || currActive)) {
    parts.push('Changed active slide');
  }

  // Deduplicate while preserving order
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (seen.has(part)) continue;
    seen.add(part);
    unique.push(part);
  }

  if (unique.length === 0) {
    if (JSON.stringify(prev.diagram) !== JSON.stringify(curr.diagram)) {
      return 'Diagram edit';
    }
    if (JSON.stringify(prev.presentation) !== JSON.stringify(curr.presentation)) {
      return 'Presentation update';
    }
    return 'State update';
  }

  // Keep the list readable in the narrow history panel
  if (unique.length > 3) {
    return `${unique.slice(0, 3).join(' · ')} · +${unique.length - 3}`;
  }
  return unique.join(' · ');
}

export interface EditorHistoryBrowserEntry {
  index: number;
  label: string;
  isCurrent: boolean;
  /** Entries after the current index are redo targets. */
  isFuture: boolean;
}

export function buildEditorHistoryBrowserEntries(
  history: string[],
  historyIndex: number,
): EditorHistoryBrowserEntry[] {
  const entries: EditorHistoryBrowserEntry[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    entries.push({
      index: i,
      label: describeEditorHistoryStep(i > 0 ? history[i - 1] : null, history[i] ?? ''),
      isCurrent: i === historyIndex,
      isFuture: i > historyIndex,
    });
  }
  return entries;
}
