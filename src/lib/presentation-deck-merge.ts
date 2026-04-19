import type { PresentationDeck } from '@/lib/types';
import { migratePresentationDeckToUnifiedSlides } from '@/lib/presentation-primary-slide';

/**
 * Collapse multiple persisted decks into one unnamed deck per tab.
 * Appends slides from non-primary decks (deduping slide ids).
 * Each deck’s `slides[0]` is the unified main slide; only `slides.slice(1)` from secondary decks are merged.
 */
export function collapsePresentationDecksToOne(
  decks: PresentationDeck[],
  preferredDeckId: string | null,
): { decks: PresentationDeck[]; activeDeckId: string | null } {
  const migrated = decks.map(migratePresentationDeckToUnifiedSlides);

  if (migrated.length === 0) {
    return { decks: [], activeDeckId: null };
  }
  if (migrated.length === 1) {
    const only = { ...migrated[0], name: '' };
    return { decks: [only], activeDeckId: only.id };
  }

  const primaryDeck = migrated.find((d) => d.id === preferredDeckId) ?? migrated[0];
  const others = migrated.filter((d) => d.id !== primaryDeck.id);
  const now = Date.now();
  const usedIds = new Set(primaryDeck.slides.map((s) => s.id));

  const mergedSlides = [
    ...primaryDeck.slides.slice(0, 1),
    ...primaryDeck.slides.slice(1),
    ...others.flatMap((d, di) =>
      d.slides.slice(1).map((s, si) => {
        let id = s.id;
        if (usedIds.has(id)) {
          id = `slide-${now}-${di}-${si}-${Math.random().toString(36).slice(2, 8)}`;
        }
        usedIds.add(id);
        return { ...s, id };
      }),
    ),
  ];

  const merged: PresentationDeck = {
    ...primaryDeck,
    name: '',
    slides: mergedSlides,
    updatedAt: Date.now(),
  };

  return { decks: [merged], activeDeckId: merged.id };
}
