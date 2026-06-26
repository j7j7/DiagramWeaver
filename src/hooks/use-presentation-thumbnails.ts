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
  buildPresentationThumbnailCaptureOptions,
  buildPresentationThumbnailDiagramContentKey,
  diagramForPresentationThumbnailFingerprint,
  presentationThumbnailCaptureBackground,
  withPresentationThumbnailThemeFingerprintTag,
} from "@/lib/diagram-editor/editor-support";
import { useTheme } from "@/components/theme-provider";

/** Low-priority strip PNG work — defer until the browser is idle (or after timeout). */
function runPresentationThumbnailCaptureWhenIdle(run: () => void): void {
  if (typeof window === "undefined") return;
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 10_000 });
  } else {
    window.setTimeout(run, 0);
  }
}

function isThumbnailCaptureAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

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
  /** Parent receives synchronous pause API (before React state commits on pan mousedown). */
  presentationThumbnailInteractionRef?: MutableRefObject<
    PresentationThumbnailInteractionRef | null
  >;
  /** When false, skip all strip PNG capture (debounce, interval, backfill, slide change). */
  presentationThumbnailUpdatesEnabled?: boolean;
  /** Fired when any thumbnail PNG capture starts or finishes (in-flight count crosses zero). */
  onPresentationThumbnailGeneratingChange?: (generating: boolean) => void;
}

export interface PresentationThumbnailInteractionRef {
  pauseForCanvasInteraction: () => void;
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
  presentationThumbnailInteractionRef,
  presentationThumbnailUpdatesEnabled = true,
  onPresentationThumbnailGeneratingChange,
}: UsePresentationThumbnailsParams): UsePresentationThumbnailsResult {
  const { resolvedTheme } = useTheme();
  const presentationThumbnailUpdatesEnabledRef = React.useRef(
    presentationThumbnailUpdatesEnabled,
  );
  presentationThumbnailUpdatesEnabledRef.current = presentationThumbnailUpdatesEnabled;
  const thumbnailGeneratingCountRef = React.useRef(0);
  const notifyThumbnailGenerating = React.useCallback(
    (delta: 1 | -1) => {
      thumbnailGeneratingCountRef.current = Math.max(
        0,
        thumbnailGeneratingCountRef.current + delta,
      );
      onPresentationThumbnailGeneratingChange?.(
        thumbnailGeneratingCountRef.current > 0,
      );
    },
    [onPresentationThumbnailGeneratingChange],
  );
  const presentationThumbCaptureInFlightRef = React.useRef(false);
  const canvasGeometryInteractionActiveRef = React.useRef(false);
  /** True after sync pause until React props confirm interaction ended. */
  const canvasGeometryInteractionSyncPausedRef = React.useRef(false);
  /** Bumped when canvas interaction starts — stale in-flight captures must not apply or chain. */
  const presentationThumbCaptureGenerationRef = React.useRef(0);
  const prevCanvasGeometryInteractionActiveRef = React.useRef(false);
  /** Set when diagram content key changes; cleared when a debounced capture is scheduled. */
  const presentationThumbPendingContentCaptureRef = React.useRef(false);
  const prevPresentationThumbDiagramContentKeyRef = React.useRef("");
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
      !editorRef.current?.isCanvasPerfInteractionActive?.() &&
      captureGeneration === presentationThumbCaptureGenerationRef.current,
    [editorRef],
  );

  const isThumbnailCaptureBlockedByCanvasInteraction = React.useCallback(() => {
    if (!presentationThumbnailUpdatesEnabledRef.current) return true;
    if (canvasGeometryInteractionActiveRef.current) return true;
    if (editorRef.current?.isCanvasPerfInteractionActive?.()) return true;
    return false;
  }, [editorRef]);

  const runPresentationThumbnailCaptureIfNeeded =
    React.useCallback(async () => {
      if (presentationThumbBackfillRunningRef.current) return;
      if (presentationThumbCaptureInFlightRef.current) return;
      if (isThumbnailCaptureBlockedByCanvasInteraction()) return;
      if (!editorRef.current?.captureSnapshotPng) return;

      const ctx = presentationThumbCtxRef.current;
      if (!ctx.deckId) return;

      const captureGeneration = presentationThumbCaptureGenerationRef.current;
      presentationThumbCaptureInFlightRef.current = true;
      notifyThumbnailGenerating(1);
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
                  await editorRef.current.captureSnapshotPng(
                    buildPresentationThumbnailCaptureOptions(thumbBg, [visibleMain]),
                  );
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
              } catch (err) {
                if (isThumbnailCaptureAbortError(err)) return;
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

        if (isThumbnailCaptureBlockedByCanvasInteraction()) return;

        const snapshotImage = await editorRef.current.captureSnapshotPng(
          buildPresentationThumbnailCaptureOptions(
            thumbBg,
            presentationThumbnailFitUnionDiagrams,
          ),
        );

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
      } catch (err) {
        if (isThumbnailCaptureAbortError(err)) return;
        // Retry on a later interval or slide change
      } finally {
        presentationThumbCaptureInFlightRef.current = false;
        notifyThumbnailGenerating(-1);
      }
    }, [
      editorRef,
      presentationDecksRef,
      presentationThumbnailFitUnionDiagrams,
      resolvedTheme,
      setPresentationDecks,
      shouldApplyPresentationThumbnailCapture,
      isThumbnailCaptureBlockedByCanvasInteraction,
      notifyThumbnailGenerating,
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

  const pauseForCanvasInteraction = React.useCallback(() => {
    editorRef.current?.abortPresentationThumbnailCapture?.();
    canvasGeometryInteractionSyncPausedRef.current = true;
    canvasGeometryInteractionActiveRef.current = true;
    cancelPendingDebouncedThumbnailCapture();
    presentationThumbCaptureGenerationRef.current += 1;
  }, [editorRef, cancelPendingDebouncedThumbnailCapture]);

  React.useLayoutEffect(() => {
    if (!presentationThumbnailInteractionRef) return;
    presentationThumbnailInteractionRef.current = { pauseForCanvasInteraction };
  }, [presentationThumbnailInteractionRef, pauseForCanvasInteraction]);

  React.useEffect(() => {
    if (presentationThumbnailUpdatesEnabled) return;
    cancelPendingDebouncedThumbnailCapture();
    presentationThumbCaptureGenerationRef.current += 1;
  }, [
    presentationThumbnailUpdatesEnabled,
    cancelPendingDebouncedThumbnailCapture,
  ]);

  React.useLayoutEffect(() => {
    if (canvasGeometryInteractionActive) {
      canvasGeometryInteractionSyncPausedRef.current = false;
      canvasGeometryInteractionActiveRef.current = true;
      return;
    }
    if (canvasGeometryInteractionSyncPausedRef.current) {
      canvasGeometryInteractionActiveRef.current = true;
      return;
    }
    canvasGeometryInteractionActiveRef.current = false;
  }, [canvasGeometryInteractionActive]);

  const scheduleIdlePresentationThumbnailCapture = React.useCallback(
    (immediate: boolean) => {
      cancelPendingDebouncedThumbnailCapture();
      if (isThumbnailCaptureBlockedByCanvasInteraction()) return;

      const queueCapture = () => {
        if (isThumbnailCaptureBlockedByCanvasInteraction()) return;
        runPresentationThumbnailCaptureWhenIdle(() => {
          if (isThumbnailCaptureBlockedByCanvasInteraction()) return;
          void runPresentationThumbnailCaptureRef.current();
        });
      };

      if (immediate) {
        queueCapture();
        return;
      }

      presentationThumbDebounceTimerRef.current = window.setTimeout(() => {
        presentationThumbDebounceTimerRef.current = null;
        queueCapture();
      }, PRESENTATION_THUMB_DEBOUNCE_MS);
    },
    [cancelPendingDebouncedThumbnailCapture, isThumbnailCaptureBlockedByCanvasInteraction],
  );

  const scheduleIdlePresentationThumbnailCaptureRef = React.useRef(
    scheduleIdlePresentationThumbnailCapture,
  );
  scheduleIdlePresentationThumbnailCaptureRef.current =
    scheduleIdlePresentationThumbnailCapture;

  const trySchedulePendingContentThumbnailCapture = React.useCallback(() => {
    if (!activePresentationDeckId) return;
    if (isThumbnailCaptureBlockedByCanvasInteraction()) return;
    if (!presentationThumbPendingContentCaptureRef.current) return;
    presentationThumbPendingContentCaptureRef.current = false;
    scheduleIdlePresentationThumbnailCaptureRef.current(false);
  }, [activePresentationDeckId, isThumbnailCaptureBlockedByCanvasInteraction]);

  const trySchedulePendingContentThumbnailCaptureRef = React.useRef(
    trySchedulePendingContentThumbnailCapture,
  );
  trySchedulePendingContentThumbnailCaptureRef.current =
    trySchedulePendingContentThumbnailCapture;

  /** Interaction started — cancel pending idle capture and invalidate any in-flight work. */
  React.useEffect(() => {
    const wasActive = prevCanvasGeometryInteractionActiveRef.current;
    prevCanvasGeometryInteractionActiveRef.current =
      canvasGeometryInteractionActive;

    if (canvasGeometryInteractionActive && !wasActive) {
      cancelPendingDebouncedThumbnailCapture();
      presentationThumbCaptureGenerationRef.current += 1;
      return;
    }

    if (!canvasGeometryInteractionActive && wasActive) {
      trySchedulePendingContentThumbnailCaptureRef.current();
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
      queueMicrotask(() => {
        scheduleIdlePresentationThumbnailCaptureRef.current(true);
      });
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

  /** Schedule capture only when slide diagram content changes — not on pan/viewport interaction end. */
  React.useEffect(() => {
    if (!activePresentationDeckId) {
      cancelPendingDebouncedThumbnailCapture();
      presentationThumbPendingContentCaptureRef.current = false;
      prevPresentationThumbDiagramContentKeyRef.current = "";
      return;
    }

    if (
      prevPresentationThumbDiagramContentKeyRef.current ===
      presentationThumbDiagramContentKey
    ) {
      return;
    }
    prevPresentationThumbDiagramContentKeyRef.current =
      presentationThumbDiagramContentKey;
    presentationThumbPendingContentCaptureRef.current = true;

    if (canvasGeometryInteractionActive) {
      cancelPendingDebouncedThumbnailCapture();
      return;
    }

    trySchedulePendingContentThumbnailCaptureRef.current();

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
    if (!presentationThumbnailUpdatesEnabled) return;

    const id = window.setInterval(() => {
      if (isThumbnailCaptureBlockedByCanvasInteraction()) return;
      runPresentationThumbnailCaptureWhenIdle(() => {
        if (isThumbnailCaptureBlockedByCanvasInteraction()) return;
        void runPresentationThumbnailCaptureRef.current();
      });
    }, PRESENTATION_THUMB_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [
    activePresentationDeckId,
    presentationThumbnailUpdatesEnabled,
    isThumbnailCaptureBlockedByCanvasInteraction,
  ]);

  const captureOutgoingSlideThumbnailIfNeeded = React.useCallback(async () => {
    if (presentationThumbBackfillRunningRef.current) return;
    await runPresentationThumbnailCaptureRef.current();
  }, []);

  React.useEffect(() => {
    if (!presentationMasterDiagram) return;
    if (!presentationThumbnailUpdatesEnabled) return;

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
    notifyThumbnailGenerating(1);

    void (async () => {
      const ready = await waitForEditor();
      if (!ready || cancelled) {
        presentationThumbBackfillRunningRef.current = false;
        notifyThumbnailGenerating(-1);
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
                  await editorRef.current!.captureSnapshotPng!(
                    buildPresentationThumbnailCaptureOptions(thumbBg, [visibleMain]),
                  );
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
                await editorRef.current!.captureSnapshotPng!(
                  buildPresentationThumbnailCaptureOptions(thumbBg, [draftDiagram]),
                );

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
        notifyThumbnailGenerating(-1);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- active deck/slide are restore targets for this run only; omitting avoids re-entry on every slide change.
  }, [
    presentationMasterDiagram,
    presentationDeckIdentityKey,
    resolvedTheme,
    presentationThumbnailUpdatesEnabled,
    notifyThumbnailGenerating,
  ]);

  return { captureOutgoingSlideThumbnailIfNeeded };
}
