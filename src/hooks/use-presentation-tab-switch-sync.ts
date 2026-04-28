"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { DiagramData, PresentationDeck } from "@/lib/types";
import type { BreadcrumbSegment } from "@/components/editor/diagram-breadcrumb";

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

export interface UsePresentationTabSwitchSyncParams {
  activeTabId: string | null;
  presentationStateByTabRef: MutableRefObject<TabPresentationState>;
  presentationPrevBaseJsonRef: MutableRefObject<string | null>;
  presentationMasterFromTabSyncKeyRef: MutableRefObject<string | null>;
  lastRestoredStackRef: MutableRefObject<string | null>;
  setPresentationDecks: Dispatch<SetStateAction<PresentationDeck[]>>;
  setActivePresentationDeckId: Dispatch<SetStateAction<string | null>>;
  setActivePresentationSlideId: Dispatch<SetStateAction<string | null>>;
  setSelectedPresentationSlideIds: Dispatch<SetStateAction<Set<string>>>;
  setPresentationMasterDiagram: Dispatch<SetStateAction<DiagramData | null>>;
  setPresentationDraftDiagram: Dispatch<SetStateAction<DiagramData | null>>;
  setActiveDiagramStack: Dispatch<SetStateAction<BreadcrumbSegment[]>>;
}

/**
 * When the active tab changes, reset presentation breadcrumb sync keys and load that tab’s persisted deck/slide/master/draft snapshot.
 */
export function usePresentationTabSwitchSync({
  activeTabId,
  presentationStateByTabRef,
  presentationPrevBaseJsonRef,
  presentationMasterFromTabSyncKeyRef,
  lastRestoredStackRef,
  setPresentationDecks,
  setActivePresentationDeckId,
  setActivePresentationSlideId,
  setSelectedPresentationSlideIds,
  setPresentationMasterDiagram,
  setPresentationDraftDiagram,
  setActiveDiagramStack,
}: UsePresentationTabSwitchSyncParams): void {
  useEffect(() => {
    presentationPrevBaseJsonRef.current = null;
    presentationMasterFromTabSyncKeyRef.current = null;
    if (!activeTabId) {
      setPresentationDecks([]);
      setActivePresentationDeckId(null);
      setActivePresentationSlideId(null);
      setSelectedPresentationSlideIds(new Set());
      setPresentationMasterDiagram(null);
      setPresentationDraftDiagram(null);
      setActiveDiagramStack([]);
      lastRestoredStackRef.current = null;
      return;
    }
    setActiveDiagramStack([]);

    const scoped = presentationStateByTabRef.current[activeTabId];
    if (!scoped) {
      setPresentationDecks([]);
      setActivePresentationDeckId(null);
      setActivePresentationSlideId(null);
      setSelectedPresentationSlideIds(new Set());
      setPresentationMasterDiagram(null);
      setPresentationDraftDiagram(null);
      return;
    }

    setPresentationDecks(scoped.decks);
    setActivePresentationDeckId(scoped.activeDeckId);
    const tabDeck =
      scoped.decks.find((d) => d.id === scoped.activeDeckId) ?? scoped.decks[0];
    const tabPrimaryId = tabDeck?.slides[0]?.id ?? null;
    setActivePresentationSlideId(scoped.activeSlideId ?? tabPrimaryId);
    setSelectedPresentationSlideIds(new Set(scoped.selectedSlideIds));
    setPresentationMasterDiagram(scoped.masterDiagram);
    setPresentationDraftDiagram(scoped.draftDiagram);
  }, [
    activeTabId,
    presentationPrevBaseJsonRef,
    presentationMasterFromTabSyncKeyRef,
    presentationStateByTabRef,
    lastRestoredStackRef,
    setPresentationDecks,
    setActivePresentationDeckId,
    setActivePresentationSlideId,
    setSelectedPresentationSlideIds,
    setPresentationMasterDiagram,
    setPresentationDraftDiagram,
    setActiveDiagramStack,
  ]);
}
