"use client";

import { useLayoutEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { DiagramData, PresentationDeck, Slide } from "@/lib/types";
import { applyDiagramDelta, projectVisibleDiagram } from "@/lib/presentation-delta";
import { getPresentationDeltaMode, resolvePresentationSlideDiagrams } from "@/lib/presentation-slide-chain";
import {
  computeSlidePlaybackTransform,
  pruneConnectionsToVisibleNodes,
} from "@/lib/presentation-viewport-fit";

export interface UsePresentationSlideViewportSyncParams {
  activeTabId: string | null;
  activePresentationDeckId: string | null;
  activePresentationSlideId: string | null;
  presentationDecks: PresentationDeck[];
  presentationMasterDiagram: DiagramData | null;
  tabDiagramData: DiagramData;
  prevPresentationSlideIdForViewportRef: MutableRefObject<string | null>;
  canvasTransformRef: MutableRefObject<{ x: number; y: number; k: number }>;
  setPresentationDecks: Dispatch<SetStateAction<PresentationDeck[]>>;
  setCanvasTransform: (transform: { x: number; y: number; k: number }) => void;
  sanitizeCanvasTransform: (transform?: { x: number; y: number; k: number } | null) => {
    x: number;
    y: number;
    k: number;
  };
}

/**
 * On slide change within a presentation deck: persist prior slide viewport on the slide, fit next slide (`computeSlidePlaybackTransform`).
 */
export function usePresentationSlideViewportSync({
  activeTabId,
  activePresentationDeckId,
  activePresentationSlideId,
  presentationDecks,
  presentationMasterDiagram,
  tabDiagramData,
  prevPresentationSlideIdForViewportRef,
  canvasTransformRef,
  setPresentationDecks,
  setCanvasTransform,
  sanitizeCanvasTransform,
}: UsePresentationSlideViewportSyncParams): void {
  useLayoutEffect(() => {
    if (!activeTabId) {
      prevPresentationSlideIdForViewportRef.current = null;
      return;
    }
    if (!activePresentationDeckId || !activePresentationSlideId) {
      prevPresentationSlideIdForViewportRef.current = null;
      return;
    }

    const prevSlideId = prevPresentationSlideIdForViewportRef.current;
    if (prevSlideId === activePresentationSlideId) {
      return;
    }

    const deck = presentationDecks.find((d) => d.id === activePresentationDeckId);
    const slide = deck?.slides.find((s) => s.id === activePresentationSlideId);
    if (!deck || !slide) {
      return;
    }

    if (prevSlideId && prevSlideId !== activePresentationSlideId) {
      const c = canvasTransformRef.current;
      setPresentationDecks((prevDecks) =>
        prevDecks.map((d) => {
          if (d.id !== activePresentationDeckId) return d;
          return {
            ...d,
            slides: d.slides.map((s: Slide) =>
              s.id === prevSlideId ? { ...s, autoZoomLevel: c.k, viewPanX: c.x, viewPanY: c.y } : s,
            ),
            updatedAt: Date.now(),
          };
        }),
      );
    }

    const masterBase = projectVisibleDiagram(presentationMasterDiagram ?? tabDiagramData);
    const mode = getPresentationDeltaMode(deck);
    const idx = deck.slides.findIndex((s) => s.id === slide.id);
    const diagrams =
      idx >= 0 ? resolvePresentationSlideDiagrams(masterBase, deck.slides, mode) : [];
    const diagramRaw =
      idx >= 0 ? diagrams[idx] ?? applyDiagramDelta(masterBase, slide.diagramDelta) : applyDiagramDelta(masterBase, slide.diagramDelta);
    const diagramForSlide = pruneConnectionsToVisibleNodes(diagramRaw);
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 720;
    const t = computeSlidePlaybackTransform(slide, diagramForSlide, vw, vh);
    if (t) {
      setCanvasTransform(t);
      canvasTransformRef.current = sanitizeCanvasTransform(t);
    }

    prevPresentationSlideIdForViewportRef.current = activePresentationSlideId;
  }, [
    activeTabId,
    activePresentationDeckId,
    activePresentationSlideId,
    presentationDecks,
    presentationMasterDiagram,
    tabDiagramData,
    setPresentationDecks,
    setCanvasTransform,
    sanitizeCanvasTransform,
    prevPresentationSlideIdForViewportRef,
    canvasTransformRef,
  ]);
}
