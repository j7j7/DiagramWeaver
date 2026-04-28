"use client";

import React, { type MutableRefObject } from "react";
import { flushSync } from "react-dom";
import type {
  DiagramData,
  PresentationDeck,
  Slide,
} from "@/lib/types";
import {
  applyDiagramDelta,
  computeDiagramDelta,
  projectVisibleDiagram,
} from "@/lib/presentation-delta";
import {
  cumulativeDiagramThroughSlideIndex,
  getPresentationDeltaMode,
  resolvePresentationSlideDiagrams,
} from "@/lib/presentation-slide-chain";
import { slideNeedsPresentationThumbnailSnapshot } from "@/lib/extract-embedded-presentations";
import type { EditorCanvasHandle } from "@/components/editor/editor-canvas";
import { PRESENTATION_THUMB_INTERVAL_MS } from "@/lib/diagram-editor/editor-support";

export interface UsePresentationThumbnailsParams {
  editorRef: React.RefObject<EditorCanvasHandle | null>;
  presentationDecksRef: MutableRefObject<PresentationDeck[]>;
  presentationDraftDiagramRef: MutableRefObject<DiagramData | null>;
  presentationMasterDiagramRef: MutableRefObject<DiagramData | null>;
  tabDiagramDataRef: MutableRefObject<DiagramData>;
  /** Shared with IndexedDB hydrate effect in parent (writes fingerprints when rebuilding draft). */
  presentationThumbDeltaFingerprintBySlideRef: MutableRefObject<
    Record<string, string>
  >;
  /** Shared with hydrate effect — last slide key fingerprint layout ran for. */
  presentationThumbFingerprintSlideKeyRef: MutableRefObject<string | null>;

  presentationDraftDiagram: DiagramData | null;
  presentationMasterDiagram: DiagramData | null;
  tabDiagramData: DiagramData;

  activePresentationDeckId: string | null;
  activePresentationSlideId: string | null;

  activePresentationSlideDiagramsForThumbnailCapture: DiagramData[];
  presentationDeckIdentityKey: string;

  setPresentationDecks: React.Dispatch<React.SetStateAction<PresentationDeck[]>>;
  setActivePresentationDeckId: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setActivePresentationSlideId: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setPresentationDraftDiagram: React.Dispatch<
    React.SetStateAction<DiagramData | null>
  >;
}

export interface UsePresentationThumbnailsResult {
  captureOutgoingSlideThumbnailIfNeeded: () => Promise<void>;
}

/**
 * Presentation strip PNG thumbnails: periodic capture, slide-change capture, and placeholder backfill after load.
 */
export function usePresentationThumbnails({
  editorRef,
  presentationDecksRef,
  presentationDraftDiagramRef,
  presentationMasterDiagramRef,
  tabDiagramDataRef,
  presentationThumbDeltaFingerprintBySlideRef,
  presentationThumbFingerprintSlideKeyRef,
  presentationDraftDiagram,
  presentationMasterDiagram,
  tabDiagramData,
  activePresentationDeckId,
  activePresentationSlideId,
  activePresentationSlideDiagramsForThumbnailCapture,
  presentationDeckIdentityKey,
  setPresentationDecks,
  setActivePresentationDeckId,
  setActivePresentationSlideId,
  setPresentationDraftDiagram,
}: UsePresentationThumbnailsParams): UsePresentationThumbnailsResult {
  const presentationThumbCaptureInFlightRef = React.useRef(false);
  /** True while sequentially capturing PNG thumbnails for every slide (e.g. compact file load). */
  const presentationThumbBackfillRunningRef = React.useRef(false);
  const presentationThumbCtxRef = React.useRef<{
    draft: DiagramData | null;
    master: DiagramData | null;
    tab: DiagramData;
    deckId: string | null;
    slideId: string | null;
  }>({
    draft: null,
    master: null,
    tab: { nodes: [], connections: [], groupings: [] },
    deckId: null,
    slideId: null,
  });

  presentationThumbCtxRef.current = {
    draft: presentationDraftDiagram,
    master: presentationMasterDiagram,
    tab: tabDiagramData,
    deckId: activePresentationDeckId,
    slideId: activePresentationSlideId,
  };

  React.useLayoutEffect(() => {
    if (!activePresentationSlideId) return;
    const deckId = activePresentationDeckId;
    const slideId = activePresentationSlideId;
    if (!deckId || !slideId) {
      presentationThumbFingerprintSlideKeyRef.current = null;
      return;
    }
    const slideKey = `${deckId}:${slideId}`;
    if (presentationThumbFingerprintSlideKeyRef.current === slideKey) return;
    presentationThumbFingerprintSlideKeyRef.current = slideKey;

    const draft = presentationDraftDiagramRef.current;
    if (!draft) return;
    const master =
      presentationMasterDiagramRef.current ?? tabDiagramDataRef.current;
    try {
      const masterBase = projectVisibleDiagram(master);
      const deckFp = presentationDecksRef.current.find((d) => d.id === deckId);
      const slidesFp = deckFp?.slides ?? [];
      const mode = deckFp ? getPresentationDeltaMode(deckFp) : 'master';
      const slideIdxFp = slidesFp.findIndex((s) => s.id === slideId);
      const fp =
        mode === 'master' || slideIdxFp <= 0
          ? JSON.stringify(
              computeDiagramDelta(masterBase, projectVisibleDiagram(draft)),
            )
          : JSON.stringify(
              computeDiagramDelta(
                projectVisibleDiagram(
                  cumulativeDiagramThroughSlideIndex(
                    masterBase,
                    slidesFp,
                    slideIdxFp - 1,
                  ),
                ),
                projectVisibleDiagram(draft),
              ),
            );
      presentationThumbDeltaFingerprintBySlideRef.current[slideKey] = fp;
    } catch {
      // ignore
    }
  }, [activePresentationDeckId, activePresentationSlideId]);

  const runPresentationThumbnailCaptureIfNeeded =
    React.useCallback(async () => {
      if (presentationThumbBackfillRunningRef.current) return;
      if (presentationThumbCaptureInFlightRef.current) return;
      if (!editorRef.current?.captureSnapshotPng) return;

      const ctx = presentationThumbCtxRef.current;
      if (!ctx.deckId) return;

      presentationThumbCaptureInFlightRef.current = true;
      try {
        const visibleMain = projectVisibleDiagram(ctx.tab);
        let baseFingerprint: string | null = null;
        try {
          baseFingerprint = JSON.stringify(visibleMain);
        } catch {
          baseFingerprint = null;
        }
        if (baseFingerprint !== null) {
          const deckForBase = presentationDecksRef.current.find(
            (d) => d.id === ctx.deckId,
          );
          const primarySlide = deckForBase?.slides[0];
          if (primarySlide) {
            const primaryKey = `${ctx.deckId}:${primarySlide.id}`;
            const needsPrimaryPng = slideNeedsPresentationThumbnailSnapshot(
              primarySlide.snapshotImage,
            );
            if (
              presentationThumbDeltaFingerprintBySlideRef.current[
                primaryKey
              ] !== baseFingerprint ||
              needsPrimaryPng
            ) {
              const captureDeckId = ctx.deckId;
              const capturePrimaryId = primarySlide.id;
              try {
                const primaryPng =
                  await editorRef.current.captureSnapshotPng({
                    backgroundColor: "white",
                    quality: "medium",
                    fitContent: true,
                    unionDiagrams: [visibleMain],
                  });
                if (
                  presentationThumbCtxRef.current.deckId === captureDeckId
                ) {
                  setPresentationDecks((prev) =>
                    prev.map((d) =>
                      d.id !== captureDeckId
                        ? d
                        : {
                            ...d,
                            slides: d.slides.map((s) =>
                              s.id === capturePrimaryId
                                ? { ...s, snapshotImage: primaryPng }
                                : s,
                            ),
                            updatedAt: Date.now(),
                          },
                    ),
                  );
                  presentationThumbDeltaFingerprintBySlideRef.current[
                    primaryKey
                  ] = baseFingerprint;
                }
              } catch {
                // Retry later
              }
            }
          }
        }

        const ctxSlide = presentationThumbCtxRef.current;
        if (!ctxSlide.draft || !ctxSlide.slideId || !ctxSlide.deckId) return;

        let deltaFingerprint: string;
        try {
          const masterBase = projectVisibleDiagram(
            ctxSlide.master ?? ctxSlide.tab,
          );
          const nextVisible = projectVisibleDiagram(ctxSlide.draft);
          let deckForSlide = presentationDecksRef.current.find(
            (d) => d.id === ctxSlide.deckId,
          );
          if (!deckForSlide) deckForSlide = presentationDecksRef.current[0];
          const slidesForFp = deckForSlide?.slides ?? [];
          const mode =
            deckForSlide ? getPresentationDeltaMode(deckForSlide) : "master";
          const slideIdx = slidesForFp.findIndex((s) => s.id === ctxSlide.slideId);
          if (mode === "master" || slideIdx <= 0) {
            deltaFingerprint = JSON.stringify(
              computeDiagramDelta(masterBase, nextVisible),
            );
          } else {
            const prevBase = cumulativeDiagramThroughSlideIndex(
              masterBase,
              slidesForFp,
              slideIdx - 1,
            );
            deltaFingerprint = JSON.stringify(
              computeDiagramDelta(
                projectVisibleDiagram(prevBase),
                nextVisible,
              ),
            );
          }
        } catch {
          return;
        }

        const thumbKey = `${ctxSlide.deckId}:${ctxSlide.slideId}`;
        let slideForThumb: Slide | undefined;
        for (const d of presentationDecksRef.current) {
          if (d.id !== ctxSlide.deckId) continue;
          slideForThumb = d.slides.find((s) => s.id === ctxSlide.slideId);
          break;
        }
        const snapshotNeedsRealPng =
          slideForThumb &&
          slideNeedsPresentationThumbnailSnapshot(slideForThumb.snapshotImage);
        if (
          presentationThumbDeltaFingerprintBySlideRef.current[thumbKey] ===
            deltaFingerprint &&
          !snapshotNeedsRealPng
        ) {
          return;
        }

        const captureDeckId = ctxSlide.deckId;
        const captureSlideId = ctxSlide.slideId;

        const snapshotImage = await editorRef.current.captureSnapshotPng({
          backgroundColor: "white",
          quality: "medium",
          fitContent: true,
          unionDiagrams:
            activePresentationSlideDiagramsForThumbnailCapture,
        });

        if (
          presentationThumbCtxRef.current.slideId !== captureSlideId ||
          presentationThumbCtxRef.current.deckId !== captureDeckId
        ) {
          return;
        }

        setPresentationDecks((prev) =>
          prev.map((d) => {
            if (d.id !== captureDeckId) return d;
            return {
              ...d,
              slides: d.slides.map((s) =>
                s.id === captureSlideId ? { ...s, snapshotImage } : s,
              ),
              updatedAt: Date.now(),
            };
          }),
        );
        presentationThumbDeltaFingerprintBySlideRef.current[thumbKey] =
          deltaFingerprint;
      } catch {
        // Retry on a later interval or slide change
      } finally {
        presentationThumbCaptureInFlightRef.current = false;
      }
    }, [
      editorRef,
      presentationDecksRef,
      activePresentationSlideDiagramsForThumbnailCapture,
      setPresentationDecks,
    ]);

  const captureOutgoingSlideThumbnailIfNeeded = React.useCallback(async () => {
    if (presentationThumbBackfillRunningRef.current) return;
    await runPresentationThumbnailCaptureIfNeeded();
  }, [runPresentationThumbnailCaptureIfNeeded]);

  React.useEffect(() => {
    if (!activePresentationDeckId) return;

    const id = window.setInterval(() => {
      void runPresentationThumbnailCaptureIfNeeded();
    }, PRESENTATION_THUMB_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [activePresentationDeckId, runPresentationThumbnailCaptureIfNeeded]);

  React.useEffect(() => {
    if (!activePresentationDeckId) return;
    void runPresentationThumbnailCaptureIfNeeded();
  }, [
    activePresentationDeckId,
    activePresentationSlideId,
    tabDiagramData,
    runPresentationThumbnailCaptureIfNeeded,
  ]);

  React.useEffect(() => {
    if (!presentationMasterDiagram) return;

    const decksSnapshot = presentationDecksRef.current;
    if (decksSnapshot.length === 0) return;

    const needsAny = decksSnapshot.some((d) =>
      d.slides.some((s) =>
        slideNeedsPresentationThumbnailSnapshot(s.snapshotImage),
      ),
    );
    if (!needsAny) return;

    let cancelled = false;
    const savedDeckId = activePresentationDeckId;
    const savedSlideId = activePresentationSlideId;
    const masterBase = projectVisibleDiagram(presentationMasterDiagram);

    const waitForEditor = async () => {
      for (let i = 0; i < 45; i++) {
        if (cancelled) return false;
        if (editorRef.current?.captureSnapshotPng) return true;
        await new Promise<void>((r) =>
          requestAnimationFrame(() => r()),
        );
      }
      return Boolean(editorRef.current?.captureSnapshotPng);
    };

    presentationThumbBackfillRunningRef.current = true;

    void (async () => {
      const ready = await waitForEditor();
      if (!ready || cancelled) {
        presentationThumbBackfillRunningRef.current = false;
        return;
      }

      try {
        for (const deck of decksSnapshot) {
          const slidesNeeding = deck.slides.filter((s) =>
            slideNeedsPresentationThumbnailSnapshot(s.snapshotImage),
          );
          if (slidesNeeding.length === 0) continue;

          for (const slide of slidesNeeding) {
            if (cancelled) return;

            if (deck.slides[0]?.id === slide.id) {
              const visibleMain = masterBase;
              try {
                const primaryPng =
                  await editorRef.current!.captureSnapshotPng!({
                    backgroundColor: "white",
                    quality: "medium",
                    fitContent: true,
                    unionDiagrams: [visibleMain],
                  });
                if (cancelled) return;
                flushSync(() => {
                  setPresentationDecks((prev) =>
                    prev.map((d) =>
                      d.id !== deck.id
                        ? d
                        : {
                            ...d,
                            slides: d.slides.map((s) =>
                              s.id === slide.id
                                ? { ...s, snapshotImage: primaryPng }
                                : s,
                            ),
                            updatedAt: Date.now(),
                          },
                    ),
                  );
                });
                try {
                  presentationThumbDeltaFingerprintBySlideRef.current[
                    `${deck.id}:${slide.id}`
                  ] = JSON.stringify(visibleMain);
                } catch {
                  // ignore
                }
              } catch {
                // Next slide
              }
              await new Promise<void>((r) =>
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => r()),
                ),
              );
              continue;
            }

            const mode = getPresentationDeltaMode(deck);
            const resolvedAll = resolvePresentationSlideDiagrams(
              masterBase,
              deck.slides,
              mode,
            );
            const slideIdx = deck.slides.findIndex((s) => s.id === slide.id);
            const draftDiagram = projectVisibleDiagram(
              slideIdx >= 0
                ? resolvedAll[slideIdx]
                : applyDiagramDelta(masterBase, slide.diagramDelta),
            );
            const unionDiagrams = deck.slides.map((s, i) =>
              s.id === slide.id
                ? draftDiagram
                : projectVisibleDiagram(resolvedAll[i]),
            );

            flushSync(() => {
              setActivePresentationDeckId(deck.id);
              setActivePresentationSlideId(slide.id);
              setPresentationDraftDiagram(draftDiagram);
            });

            await new Promise<void>((r) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => r()),
              ),
            );
            if (cancelled) return;

            try {
              const snapshotImage =
                await editorRef.current!.captureSnapshotPng!({
                  backgroundColor: "white",
                  quality: "medium",
                  fitContent: true,
                  unionDiagrams,
                });

              if (cancelled) return;

              flushSync(() => {
                setPresentationDecks((prev) =>
                  prev.map((d) => {
                    if (d.id !== deck.id) return d;
                    return {
                      ...d,
                      slides: d.slides.map((s) =>
                        s.id === slide.id
                          ? { ...s, snapshotImage }
                          : s,
                      ),
                      updatedAt: Date.now(),
                    };
                  }),
                );
              });
              try {
                const slideIdxFp = deck.slides.findIndex((s) => s.id === slide.id);
                const fp =
                  mode === "master" || slideIdxFp <= 0
                    ? JSON.stringify(
                        computeDiagramDelta(
                          masterBase,
                          projectVisibleDiagram(draftDiagram),
                        ),
                      )
                    : JSON.stringify(
                        computeDiagramDelta(
                          projectVisibleDiagram(
                            cumulativeDiagramThroughSlideIndex(
                              masterBase,
                              deck.slides,
                              slideIdxFp - 1,
                            ),
                          ),
                          projectVisibleDiagram(draftDiagram),
                        ),
                      );
                presentationThumbDeltaFingerprintBySlideRef.current[
                  `${deck.id}:${slide.id}`
                ] = fp;
              } catch {
                // ignore
              }
            } catch {
              // Next slide or restore
            }
          }
        }
      } finally {
        if (savedDeckId && savedSlideId) {
          const restoreDeck = presentationDecksRef.current.find(
            (d) => d.id === savedDeckId,
          );
          const restoreSlide = restoreDeck?.slides.find(
            (s) => s.id === savedSlideId,
          );
          if (restoreDeck && restoreSlide) {
            if (restoreDeck.slides[0]?.id === restoreSlide.id) {
              flushSync(() => {
                setActivePresentationDeckId(savedDeckId);
                setActivePresentationSlideId(savedSlideId);
                setPresentationDraftDiagram(null);
              });
            } else {
              const restoreMode = getPresentationDeltaMode(restoreDeck);
              const restoredResolved = resolvePresentationSlideDiagrams(
                masterBase,
                restoreDeck.slides,
                restoreMode,
              );
              const ridx = restoreDeck.slides.findIndex(
                (s) => s.id === restoreSlide.id,
              );
              const restoreDraft = projectVisibleDiagram(
                ridx >= 0
                  ? restoredResolved[ridx]
                  : applyDiagramDelta(masterBase, restoreSlide.diagramDelta),
              );
              flushSync(() => {
                setActivePresentationDeckId(savedDeckId);
                setActivePresentationSlideId(savedSlideId);
                setPresentationDraftDiagram(restoreDraft);
              });
            }
          }
        }
        presentationThumbBackfillRunningRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- active deck/slide are restore targets for this run only; omitting avoids re-entry on every slide change.
  }, [presentationMasterDiagram, presentationDeckIdentityKey]);

  return { captureOutgoingSlideThumbnailIfNeeded };
}
