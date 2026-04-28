import type { PresentationDeck, Slide } from '@/lib/types';

/** Stable id prefix so we can detect the deck’s first slide (main diagram) after migration. */
const PRIMARY_SLIDE_PREFIX = '__dw_primary__-';

export function isPresentationPrimarySlideId(slideId: string): boolean {
  return slideId.startsWith(PRIMARY_SLIDE_PREFIX);
}

export function createPresentationPrimarySlide(deckId: string, opts?: { createdAt?: number }): Slide {
  const now = opts?.createdAt ?? Date.now();
  return {
    id: `${PRIMARY_SLIDE_PREFIX}${deckId}`,
    diagramDelta: { version: '1.0', operations: [], compressed: true },
    createdAt: now,
    title: 'Diagram',
  };
}

/**
 * Legacy decks: implicit main diagram + `slides` = snapshot-only list.
 * Unified model: `slides[0]` is always the main slide (empty delta vs master); rest are unchanged snapshots.
 */
export function migratePresentationDeckToUnifiedSlides(deck: PresentationDeck): PresentationDeck {
  if (deck.slides[0] && isPresentationPrimarySlideId(deck.slides[0].id)) {
    const next: PresentationDeck = { ...deck, baseSnapshotImage: undefined };
    return next;
  }

  const baseThumb = deck.baseSnapshotImage;
  const primary = createPresentationPrimarySlide(deck.id, { createdAt: deck.createdAt });
  if (baseThumb) {
    primary.snapshotImage = baseThumb;
  }

  return {
    ...deck,
    slides: [primary, ...deck.slides],
    baseSnapshotImage: undefined,
    updatedAt: Date.now(),
  };
}

export function migratePresentationDecks(decks: PresentationDeck[]): PresentationDeck[] {
  return decks.map(migratePresentationDeckToUnifiedSlides);
}
