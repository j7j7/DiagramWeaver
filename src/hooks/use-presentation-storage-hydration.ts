"use client";

import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { DiagramData, PresentationDeck } from "@/lib/types";
import { loadPresentationsByTab } from "@/lib/presentation-storage";
import { collapsePresentationDecksToOne } from "@/lib/presentation-deck-merge";

type TabPresentationState = Record<
  string,
  {
    decks: PresentationDeck[];
    activeDeckId: string | null;
    activeSlideId: string | null;
    selectedSlideIds: string[];
    masterDiagram: DiagramData | null;
    draftDiagram: DiagramData | null;
  }
>;

export interface UsePresentationStorageHydrationParams {
  isLoaded: boolean;
  presentationStorageHydrated: boolean;
  setPresentationStorageHydrated: Dispatch<SetStateAction<boolean>>;
  activeTabId: string | null;
  presentationStateByTabRef: MutableRefObject<TabPresentationState>;
  setPresentationDecks: Dispatch<SetStateAction<PresentationDeck[]>>;
  setActivePresentationDeckId: Dispatch<SetStateAction<string | null>>;
  setActivePresentationSlideId: Dispatch<SetStateAction<string | null>>;
}

/**
 * IndexedDB load of per-tab presentation decks once the tab store is ready.
 */
export function usePresentationStorageHydration({
  isLoaded,
  presentationStorageHydrated,
  setPresentationStorageHydrated,
  activeTabId,
  presentationStateByTabRef,
  setPresentationDecks,
  setActivePresentationDeckId,
  setActivePresentationSlideId,
}: UsePresentationStorageHydrationParams): void {
  const presentationHydrationStartedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || presentationStorageHydrated || presentationHydrationStartedRef.current) return;
    presentationHydrationStartedRef.current = true;

    let cancelled = false;

    loadPresentationsByTab()
      .then((byTab) => {
        if (cancelled || !byTab) return;

        for (const [tabId, entry] of Object.entries(byTab)) {
          const collapsed = collapsePresentationDecksToOne(entry.decks, entry.activeDeckId);
          const existing = presentationStateByTabRef.current[tabId];
          const deckForTab = collapsed.decks.find((d) => d.id === collapsed.activeDeckId) ?? collapsed.decks[0];
          const primaryId = deckForTab?.slides[0]?.id ?? null;
          const loadedSlideId = entry.activeSlideId ?? existing?.activeSlideId ?? primaryId;
          presentationStateByTabRef.current[tabId] = {
            decks: collapsed.decks,
            activeDeckId: collapsed.activeDeckId,
            activeSlideId: loadedSlideId,
            selectedSlideIds: existing?.selectedSlideIds ?? [],
            masterDiagram: existing?.masterDiagram ?? null,
            draftDiagram: existing?.draftDiagram ?? null,
          };
        }

        if (activeTabId && byTab[activeTabId]) {
          const collapsed = collapsePresentationDecksToOne(byTab[activeTabId].decks, byTab[activeTabId].activeDeckId);
          setPresentationDecks(collapsed.decks);
          setActivePresentationDeckId(collapsed.activeDeckId);
          const deckNow =
            collapsed.decks.find((d) => d.id === collapsed.activeDeckId) ?? collapsed.decks[0];
          const primaryNow = deckNow?.slides[0]?.id ?? null;
          setActivePresentationSlideId(byTab[activeTabId].activeSlideId ?? primaryNow);
        }
      })
      .catch(() => {
        /* Storage unavailable; keep in-memory behavior. */
      })
      .finally(() => {
        if (!cancelled) {
          setPresentationStorageHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    presentationStorageHydrated,
    activeTabId,
    presentationStateByTabRef,
    setPresentationDecks,
    setActivePresentationDeckId,
    setActivePresentationSlideId,
    setPresentationStorageHydrated,
  ]);
}
