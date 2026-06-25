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
import {
  PRESENTATION_THUMB_INTERVAL_MS,
  PRESENTATION_THUMB_DEBOUNCE_MS,
  PRESENTATION_THUMB_CAPTURE_QUALITY,
  buildPresentationThumbnailDiagramContentKey,
  diagramForPresentationThumbnailFingerprint,
  presentationThumbnailCaptureBackground,
  withPresentationThumbnailThemeFingerprintTag,
} from "@/lib/diagram-editor/editor-support";
import { useTheme } from "@/components/theme-provider";

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

  /** Current diagram tab — when it changes we flush thumbnails (no debounce) for the switched-to tab strip. */
  activeTabId: string | null;

  /** `[resolvedSlideDiagram]` for the active slide — fit math uses this slide's bounds only (not the whole deck). */
  presentationThumbnailFitUnionDiagrams: DiagramData[];
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

  /** True while canvas drag/move/resize (or chart value drag) is in progress — defer thumbnail PNG until idle. */
  canvasGeometryInteractionActive?: boolean;
}

export interface UsePresentationThumbnailsResult {
  captureOutgoingSlideThumbnailIfNeeded: () => Promise<void>;
}

/**
 * Presentation strip PNG thumbnails: idle-debounced after canvas/draft edits (PRESENTATION_THUMB_DEBOUNCE_MS),
 * immediate flush only on deck/slide/tab/theme navigation while idle, slow interval catch-up, placeholder backfill.
 * Paused while canvasGeometryInteractionActive; interaction restart cancels pending idle work and invalidates in-flight captures.
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
  activeTabId,
  presentationThumbnailFitUnionDiagrams,
  presentationDeckIdentityKey,
  setPresentationDecks,
  setActivePresentationDeckId,
  setActivePresentationSlideId,
  setPresentationDraftDiagram,
  canvasGeometryInteractionActive = false,
}: UsePresentationThumbnailsParams): UsePresentationThumbnailsResult {
  const { resolvedTheme } = useTheme();
  const presentationThumbCaptureInFlightRef = React.useRef(false);
  const canvasGeometryInteractionActiveRef = React.useRef(canvasGeometryInteractionActive);
  canvasGeometryInteractionActiveRef.current = canvasGeometryInteractionActive;
  /** Bumped when canvas interaction starts — stale in-flight captures must not apply or chain. */
  const presentationThumbCaptureGenerationRef = React.useRef(0);
  const prevCanvasGeometryInteractionActiveRef = React.useRef(false);
  /** Last deck/slide/tab/theme key we flushed for (skip flush when only interaction ends). */
  const presentationThumbNavKeyRef = React.useRef("");
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
    const fpSlideScopeKey = `${slideKey}|thumb:${resolvedTheme}`;
    if (presentationThumbFingerprintSlideKeyRef.current === fpSlideScopeKey) return;
    presentationThumbFingerprintSlideKeyRef.current = fpSlideScopeKey;

    const draft = presentationDraftDiagramRef.current;
    if (!draft) return;
    const master =
      presentationMasterDiagramRef.current ?? tabDiagramDataRef.current;
    try {
      const masterRaw = master;
      const deckFp = presentationDecksRef.current.find((d) => d.id === deckId);
      const slidesFp = deckFp?.slides ?? [];
      const mode = deckFp ? getPresentationDeltaMode(deckFp) : 'master';
      const slideIdxFp = slidesFp.findIndex((s) => s.id === slideId);
      const fpCore =
        mode === 'master' || slideIdxFp <= 0
          ? JSON.stringify(
              computeDiagramDelta(
                diagramForPresentationThumbnailFingerprint(masterRaw),
                diagramForPresentationThumbnailFingerprint(draft),
              ),
            )
          : JSON.stringify(
              computeDiagramDelta(
                diagramForPresentationThumbnailFingerprint(
                  cumulativeDiagramThroughSlideIndex(
                    masterRaw,
                    slidesFp,
                    slideIdxFp - 1,
                  ),
                ),
                diagramForPresentationThumbnailFingerprint(draft),
              ),
            );
      presentationThumbDeltaFingerprintBySlideRef.current[slideKey] =
        withPresentationThumbnailThemeFingerprintTag(fpCore, resolvedTheme);
    } catch {
      // ignore
    }
  }, [activePresentationDeckId, activePresentationSlideId, resolvedTheme]);

  const shouldApplyPresentationThumbnailCapture = React.useCallback(
    (captureGeneration: number) =>
      !canvasGeometryInteractionActiveRef.current &&
      captureGeneration === presentationThumbCaptureGenerationRef.current,
    [],
  );

  const runPresentationThumbnailCaptureIfNeeded =
    React.useCallback(async () => {
      if (presentationThumbBackfillRunningRef.current) return;
      if (presentationThumbCaptureInFlightRef.current) return;
      if (canvasGeometryInteractionActiveRef.current) return;
      if (!editorRef.current?.captureSnapshotPng) return;

      const ctx = presentationThumbCtxRef.current;
      if (!ctx.deckId) return;

      const captureGeneration = presentationThumbCaptureGenerationRef.current;
      presentationThumbCaptureInFlightRef.current = true;
      try {
        const thumbBg = presentationThumbnailCaptureBackground(resolvedTheme);
        const visibleMain = diagramForPresentationThumbnailFingerprint(ctx.tab);
        let baseFingerprint: string | null = null;
        try {
          baseFingerprint = withPresentationThumbnailThemeFingerprintTag(
            JSON.stringify(visibleMain),
            resolvedTheme,
          );
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
                    backgroundColor: thumbBg,
                    quality: PRESENTATION_THUMB_CAPTURE_QUALITY,
                    fitContent: true,
                    unionDiagrams: [visibleMain],
                    tightContentFrame: true,
                    fitPadding: 40,
                  });
                if (
                  !shouldApplyPresentationThumbnailCapture(captureGeneration)
                ) {
                  return;
                }
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

        if (!shouldApplyPresentationThumbnailCapture(captureGeneration)) {
          return;
        }

        const ctxSlide = presentationThumbCtxRef.current;
        if (!ctxSlide.draft || !ctxSlide.slideId || !ctxSlide.deckId) return;

        let deltaFpCore: string;
        try {
          const masterRaw = ctxSlide.master ?? ctxSlide.tab;
          const draftRaw = ctxSlide.draft;
          let deckForSlide = presentationDecksRef.current.find(
            (d) => d.id === ctxSlide.deckId,
          );
          if (!deckForSlide) deckForSlide = presentationDecksRef.current[0];
          const slidesForFp = deckForSlide?.slides ?? [];
          const mode =
            deckForSlide ? getPresentationDeltaMode(deckForSlide) : "master";
          const slideIdx = slidesForFp.findIndex((s) => s.id === ctxSlide.slideId);
          if (mode === "master" || slideIdx <= 0) {
            deltaFpCore = JSON.stringify(
              computeDiagramDelta(
                diagramForPresentationThumbnailFingerprint(masterRaw),
                diagramForPresentationThumbnailFingerprint(draftRaw),
              ),
            );
          } else {
            const prevBase = cumulativeDiagramThroughSlideIndex(
              masterRaw,
              slidesForFp,
              slideIdx - 1,
            );
            deltaFpCore = JSON.stringify(
              computeDiagramDelta(
                diagramForPresentationThumbnailFingerprint(prevBase),
                diagramForPresentationThumbnailFingerprint(draftRaw),
              ),
            );
          }
        } catch {
          return;
        }

        const deltaFingerprint = withPresentationThumbnailThemeFingerprintTag(
          deltaFpCore,
          resolvedTheme,
        );

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
          backgroundColor: thumbBg,
          quality: PRESENTATION_THUMB_CAPTURE_QUALITY,
          fitContent: true,
          unionDiagrams:
            presentationThumbnailFitUnionDiagrams,
          tightContentFrame: true,
          fitPadding: 40,
        });

        if (!shouldApplyPresentationThumbnailCapture(captureGeneration)) {
          return;
        }

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
      presentationThumbnailFitUnionDiagrams,
      resolvedTheme,
      setPresentationDecks,
      shouldApplyPresentationThumbnailCapture,
    ]);

  const runPresentationThumbnailCaptureRef = React.useRef(
    runPresentationThumbnailCaptureIfNeeded,
  );
  runPresentationThumbnailCaptureRef.current =
    runPresentationThumbnailCaptureIfNeeded;

  const presentationThumbDebounceTimerRef = React.useRef<number | null>(null);

  const cancelPendingDebouncedThumbnailCapture = React.useCallback(() => {
    if (presentationThumbDebounceTimerRef.current !== null) {
      window.clearTimeout(presentationThumbDebounceTimerRef.current);
      presentationThumbDebounceTimerRef.current = null;
    }
  }, []);

  const scheduleIdlePresentationThumbnailCapture = React.useCallback(
    (immediate: boolean) => {
      cancelPendingDebouncedThumbnailCapture();
      if (canvasGeometryInteractionActiveRef.current) return;

      if (immediate) {
        void runPresentationThumbnailCaptureRef.current();
        return;
      }

      presentationThumbDebounceTimerRef.current = window.setTimeout(() => {
        presentationThumbDebounceTimerRef.current = null;
        if (canvasGeometryInteractionActiveRef.current) return;
        void runPresentationThumbnailCaptureRef.current();
      }, PRESENTATION_THUMB_DEBOUNCE_MS);
    },
    [cancelPendingDebouncedThumbnailCapture],
  );

  const scheduleIdlePresentationThumbnailCaptureRef = React.useRef(
    scheduleIdlePresentationThumbnailCapture,
  );
  scheduleIdlePresentationThumbnailCaptureRef.current =
    scheduleIdlePresentationThumbnailCapture;

  /** Interaction started — cancel pending idle capture and invalidate any in-flight work. */
  React.useEffect(() => {
    const wasActive = prevCanvasGeometryInteractionActiveRef.current;
    prevCanvasGeometryInteractionActiveRef.current =
      canvasGeometryInteractionActive;

    if (canvasGeometryInteractionActive && !wasActive) {
      cancelPendingDebouncedThumbnailCapture();
      presentationThumbCaptureGenerationRef.current += 1;
    }
  }, [canvasGeometryInteractionActive, cancelPendingDebouncedThumbnailCapture]);

  const presentationThumbNavKey = `${activePresentationDeckId ?? ""}|${activePresentationSlideId ?? ""}|${activeTabId ?? ""}|${resolvedTheme}`;

  /** Deck / slide / tab / UI theme — flush immediately only when navigation changes while idle. */
  React.useEffect(() => {
    if (!activePresentationDeckId) {
      cancelPendingDebouncedThumbnailCapture();
      presentationThumbNavKeyRef.current = "";
      return;
    }
    if (canvasGeometryInteractionActive) {
      cancelPendingDebouncedThumbnailCapture();
      return;
    }
    const navChanged =
      presentationThumbNavKeyRef.current !== presentationThumbNavKey;
    presentationThumbNavKeyRef.current = presentationThumbNavKey;
    if (navChanged) {
      scheduleIdlePresentationThumbnailCaptureRef.current(true);
    }
  }, [
    activePresentationDeckId,
    presentationThumbNavKey,
    canvasGeometryInteractionActive,
    cancelPendingDebouncedThumbnailCapture,
  ]);

  const presentationThumbDiagramContentKey = React.useMemo(
    () =>
      buildPresentationThumbnailDiagramContentKey(
        tabDiagramData,
        presentationDraftDiagram,
      ),
    [tabDiagramData, presentationDraftDiagram],
  );

  /** Tab main diagram + presentation draft edits — idle debounce only (includes after interaction ends). */
  React.useEffect(() => {
    if (!activePresentationDeckId) {
      cancelPendingDebouncedThumbnailCapture();
      return;
    }
    if (canvasGeometryInteractionActive) {
      cancelPendingDebouncedThumbnailCapture();
      return;
    }
    scheduleIdlePresentationThumbnailCaptureRef.current(false);
    return () => {
      cancelPendingDebouncedThumbnailCapture();
    };
  }, [
    activePresentationDeckId,
    presentationThumbDiagramContentKey,
    canvasGeometryInteractionActive,
    cancelPendingDebouncedThumbnailCapture,
  ]);

  /** Slow safety net when fingerprint/capture skipped. */
  React.useEffect(() => {
    if (!activePresentationDeckId) return;

    const id = window.setInterval(() => {
      if (canvasGeometryInteractionActiveRef.current) return;
      void runPresentationThumbnailCaptureRef.current();
    }, PRESENTATION_THUMB_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [activePresentationDeckId]);

  const captureOutgoingSlideThumbnailIfNeeded = React.useCallback(async () => {
    if (presentationThumbBackfillRunningRef.current) return;
    await runPresentationThumbnailCaptureRef.current();
  }, []);

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
    const masterRaw = presentationMasterDiagram;
    const primaryThumbDiagram = projectVisibleDiagram(presentationMasterDiagram);

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
        const thumbBg = presentationThumbnailCaptureBackground(resolvedTheme);
        for (const deck of decksSnapshot) {
          const slidesNeeding = deck.slides.filter((s) =>
            slideNeedsPresentationThumbnailSnapshot(s.snapshotImage),
          );
          if (slidesNeeding.length === 0) continue;

          for (const slide of slidesNeeding) {
            if (cancelled) return;

            if (deck.slides[0]?.id === slide.id) {
              const visibleMain =
                diagramForPresentationThumbnailFingerprint(primaryThumbDiagram);
              try {
                const primaryPng =
                  await editorRef.current!.captureSnapshotPng!({
                    backgroundColor: thumbBg,
                    quality: PRESENTATION_THUMB_CAPTURE_QUALITY,
                    fitContent: true,
                    unionDiagrams: [visibleMain],
                    tightContentFrame: true,
                    fitPadding: 40,
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
                  ] = withPresentationThumbnailThemeFingerprintTag(
                    JSON.stringify(visibleMain),
                    resolvedTheme,
                  );
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
              masterRaw,
              deck.slides,
              mode,
            );
            const slideIdx = deck.slides.findIndex((s) => s.id === slide.id);
            const resolvedFullSlide =
              slideIdx >= 0
                ? resolvedAll[slideIdx]
                : applyDiagramDelta(masterRaw, slide.diagramDelta);
            const draftDiagram = projectVisibleDiagram(resolvedFullSlide);

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
                  backgroundColor: thumbBg,
                  quality: PRESENTATION_THUMB_CAPTURE_QUALITY,
                  fitContent: true,
                  unionDiagrams: [draftDiagram],
                  tightContentFrame: true,
                  fitPadding: 40,
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
                          diagramForPresentationThumbnailFingerprint(masterRaw),
                          diagramForPresentationThumbnailFingerprint(resolvedFullSlide),
                        ),
                      )
                    : JSON.stringify(
                        computeDiagramDelta(
                          diagramForPresentationThumbnailFingerprint(
                            cumulativeDiagramThroughSlideIndex(
                              masterRaw,
                              deck.slides,
                              slideIdxFp - 1,
                            ),
                          ),
                          diagramForPresentationThumbnailFingerprint(resolvedFullSlide),
                        ),
                      );
                presentationThumbDeltaFingerprintBySlideRef.current[
                  `${deck.id}:${slide.id}`
                ] = withPresentationThumbnailThemeFingerprintTag(fp, resolvedTheme);
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
                masterRaw,
                restoreDeck.slides,
                restoreMode,
              );
              const ridx = restoreDeck.slides.findIndex(
                (s) => s.id === restoreSlide.id,
              );
              const restoreDraft = projectVisibleDiagram(
                ridx >= 0
                  ? restoredResolved[ridx]
                  : applyDiagramDelta(masterRaw, restoreSlide.diagramDelta),
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
  }, [presentationMasterDiagram, presentationDeckIdentityKey, resolvedTheme]);

  return { captureOutgoingSlideThumbnailIfNeeded };
}
