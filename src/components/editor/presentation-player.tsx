"use client";

import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Check, ChevronLeft, ChevronRight, ChevronUp, Clock3, Copy, Maximize2, MoreHorizontal, MonitorPlay, Play, Wand2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ViewerCanvas } from '@/components/viewer/viewer-canvas';
import type { DiagramData, Slide } from '@/lib/types';
import type { Transform } from '@/hooks/use-canvas-transform';
import { useSlideTransition } from '@/hooks/use-slide-transition';
import { isEventFromEditableElement } from '@/lib/keyboard-utils';
import {
  computeSlidePlaybackTransform,
  computeUnionFitTransformForDiagrams,
  pruneConnectionsToVisibleNodes,
} from '@/lib/presentation-viewport-fit';

const PLAYBACK_CAMERA_DURATION_MS = 300;

const SLIDE_IMAGE_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="%23000000"/><text x="640" y="360" text-anchor="middle" dominant-baseline="middle" fill="%23d1d5db" font-family="Arial, sans-serif" font-size="28">Slide</text></svg>';

interface PresentationPlayerProps {
  open: boolean;
  slides: Slide[];
  slideDiagrams?: DiagramData[];
  currentIndex: number;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  onApplyZoomToCurrentSlide?: (zoomLevel: number) => void;
  onApplyZoomToAllSlides?: (zoomLevel: number) => void;
  /** When false, bottom playback toolbar is hidden (viewer fullscreen uses keyboard + top exit only). Default true. */
  showPlaybackToolbar?: boolean;
}

export function PresentationPlayer({
  open,
  slides,
  slideDiagrams,
  currentIndex,
  onOpenChange,
  onIndexChange,
  onApplyZoomToCurrentSlide,
  onApplyZoomToAllSlides,
  showPlaybackToolbar = true,
}: PresentationPlayerProps) {
  const [playbackTransform, setPlaybackTransform] = React.useState<Transform>({ x: 0, y: 0, k: 1 });
  const [useSlideZoom, setUseSlideZoom] = React.useState(true);
  const [autoPlayEnabled, setAutoPlayEnabled] = React.useState(false);
  const [autoPlaySeconds, setAutoPlaySeconds] = React.useState(4);
  const [manualZoomPercentDraft, setManualZoomPercentDraft] = React.useState('100');
  const [panelHidden, setPanelHidden] = React.useState(false);
  const [previousSlideIndex, setPreviousSlideIndex] = React.useState(currentIndex);
  const [previousDiagram, setPreviousDiagram] = React.useState<DiagramData | null>(null);
  const playbackTransformRef = React.useRef(playbackTransform);
  playbackTransformRef.current = playbackTransform;
  const skipPlaybackCameraLerpRef = React.useRef(true);
  const prevUseSlideZoomRef = React.useRef(useSlideZoom);

  const totalSlides = slides.length;
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(totalSlides - 1, 0));
  const currentSlide = slides[safeIndex] ?? null;
  const currentSlideDiagram = slideDiagrams?.[safeIndex] ?? null;
  const playbackAnimationEnabled = currentSlide?.animationState?.enabled ?? true;
  const playbackAnimationFilterSourceIds = currentSlide?.animationState?.filterSourceIds;
  const playbackAnimationDisabledSourceIds = currentSlide?.animationState?.disabledSourceIds;
  const renderedDiagram = React.useMemo(() => {
    if (!currentSlideDiagram) return null;
    return pruneConnectionsToVisibleNodes(currentSlideDiagram);
  }, [currentSlideDiagram]);

  const slideTransition = useSlideTransition({
    enabled: open && safeIndex !== previousSlideIndex,
    currentDiagram: renderedDiagram,
    previousDiagram: previousDiagram,
  });

  // Layout effect: apply transition styles before paint — avoids one frame at final connection geometry.
  React.useLayoutEffect(() => {
    if (!open || !renderedDiagram) return;

    if (previousSlideIndex !== safeIndex && previousDiagram !== null) {
      slideTransition.startTransition();
    }
  }, [open, safeIndex, previousSlideIndex, previousDiagram, renderedDiagram, slideTransition]);

  React.useEffect(() => {
    if (!open || !renderedDiagram) return;

    setPreviousDiagram(renderedDiagram);
    setPreviousSlideIndex(safeIndex);
  }, [safeIndex, renderedDiagram, open]);

  const animationFilterSourceIds = React.useMemo(() => {
    if (!playbackAnimationFilterSourceIds || playbackAnimationFilterSourceIds.length === 0) {
      return undefined;
    }
    return new Set(playbackAnimationFilterSourceIds);
  }, [playbackAnimationFilterSourceIds]);
  const animationDisabledSources = React.useMemo(
    () => new Set(playbackAnimationDisabledSourceIds ?? []),
    [playbackAnimationDisabledSourceIds]
  );

  const goNext = React.useCallback(() => {
    if (totalSlides === 0) return;
    onIndexChange((safeIndex + 1) % totalSlides);
  }, [totalSlides, safeIndex, onIndexChange]);

  const goPrevious = React.useCallback(() => {
    if (totalSlides === 0) return;
    onIndexChange((safeIndex - 1 + totalSlides) % totalSlides);
  }, [totalSlides, safeIndex, onIndexChange]);

  const goFirst = React.useCallback(() => {
    if (totalSlides === 0) return;
    onIndexChange(0);
  }, [totalSlides, onIndexChange]);

  const goLast = React.useCallback(() => {
    if (totalSlides === 0) return;
    onIndexChange(Math.max(totalSlides - 1, 0));
  }, [totalSlides, onIndexChange]);

  React.useEffect(() => {
    if (!open || !autoPlayEnabled || totalSlides <= 1) return;
    const delay = Math.max(1, autoPlaySeconds) * 1000;
    const timer = window.setInterval(goNext, delay);
    return () => window.clearInterval(timer);
  }, [open, autoPlayEnabled, autoPlaySeconds, totalSlides, goNext]);

  const slideDiagramsForUnionFit = React.useMemo(() => {
    if (!slideDiagrams?.length) return [];
    return slideDiagrams.map((d) => pruneConnectionsToVisibleNodes(d));
  }, [slideDiagrams]);

  const applyViewerUnionFit = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    if (slideDiagramsForUnionFit.length === 0) return;
    const t = computeUnionFitTransformForDiagrams(
      slideDiagramsForUnionFit,
      window.innerWidth,
      window.innerHeight
    );
    if (t) setPlaybackTransform(t);
  }, [slideDiagramsForUnionFit]);

  React.useLayoutEffect(() => {
    if (!open || showPlaybackToolbar || slideDiagramsForUnionFit.length === 0) return;
    if (useSlideZoom) return;
    applyViewerUnionFit();
  }, [open, showPlaybackToolbar, slideDiagramsForUnionFit, applyViewerUnionFit, useSlideZoom]);

  React.useEffect(() => {
    if (!open || showPlaybackToolbar) return;
    const onResize = () => {
      if (!useSlideZoom) applyViewerUnionFit();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, showPlaybackToolbar, applyViewerUnionFit, useSlideZoom]);

  React.useEffect(() => {
    if (!open) {
      skipPlaybackCameraLerpRef.current = true;
    }
  }, [open]);

  React.useEffect(() => {
    if (useSlideZoom && !prevUseSlideZoomRef.current) {
      skipPlaybackCameraLerpRef.current = true;
    }
    prevUseSlideZoomRef.current = useSlideZoom;
  }, [useSlideZoom]);

  React.useEffect(() => {
    if (!open || !currentSlide || !renderedDiagram) return;
    if (!useSlideZoom) return;
    if (typeof window === 'undefined') return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const target = computeSlidePlaybackTransform(currentSlide, renderedDiagram, vw, vh);
    if (!target) return;

    if (skipPlaybackCameraLerpRef.current) {
      setPlaybackTransform(target);
      skipPlaybackCameraLerpRef.current = false;
      return;
    }

    const start = { ...playbackTransformRef.current };
    let alive = true;
    const easeOut = (t: number) => 1 - (1 - t) ** 3;
    const startTime = performance.now();

    const tick = (now: number) => {
      if (!alive) return;
      const elapsed = now - startTime;
      const u = Math.min(1, elapsed / PLAYBACK_CAMERA_DURATION_MS);
      const e = easeOut(u);
      const next = {
        x: start.x + (target.x - start.x) * e,
        y: start.y + (target.y - start.y) * e,
        k: start.k + (target.k - start.k) * e,
      };
      setPlaybackTransform(next);
      if (u < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      alive = false;
    };
  }, [
    open,
    useSlideZoom,
    currentSlide?.id,
    currentSlide?.autoZoomLevel,
    currentSlide?.viewPanX,
    currentSlide?.viewPanY,
    renderedDiagram,
  ]);

  React.useEffect(() => {
    if (!open) return;
    const zoom = currentSlide?.autoZoomLevel ?? playbackTransform.k;
    if (!Number.isFinite(zoom) || zoom <= 0) return;
    setManualZoomPercentDraft(String(Number((zoom * 100).toFixed(1))));
  }, [open, currentSlide?.id, currentSlide?.autoZoomLevel, playbackTransform.k]);

  const parseManualZoomLevel = React.useCallback(() => {
    const parsed = Number(manualZoomPercentDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const clampedPercent = Math.min(250, Math.max(10, parsed));
    return Number((clampedPercent / 100).toFixed(4));
  }, [manualZoomPercentDraft]);

  const handleApplyZoomToCurrent = React.useCallback(() => {
    const zoomLevel = parseManualZoomLevel();
    if (zoomLevel === null) return;
    setPlaybackTransform((prev) => ({ ...prev, k: zoomLevel }));
    setManualZoomPercentDraft(String(Number((zoomLevel * 100).toFixed(1))));
    onApplyZoomToCurrentSlide?.(zoomLevel);
  }, [parseManualZoomLevel, onApplyZoomToCurrentSlide]);

  const handleApplyZoomToAll = React.useCallback(() => {
    const zoomLevel = parseManualZoomLevel();
    if (zoomLevel === null) return;
    setPlaybackTransform((prev) => ({ ...prev, k: zoomLevel }));
    setManualZoomPercentDraft(String(Number((zoomLevel * 100).toFixed(1))));
    onApplyZoomToAllSlides?.(zoomLevel);
  }, [parseManualZoomLevel, onApplyZoomToAllSlides]);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEventFromEditableElement(event)) return;

      if (event.key === ' ') {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        goFirst();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        goLast();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, goNext, goPrevious, goFirst, goLast, onOpenChange]);

  const blockInteractOutside = !showPlaybackToolbar;

  const slideBarLabel = currentSlide?.title || (totalSlides > 0 ? `Slide ${safeIndex + 1}` : 'Presentation');

  const playbackBarClassName =
    'pointer-events-auto fixed bottom-4 left-1/2 z-[60] flex max-w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-foreground shadow-lg backdrop-blur-sm';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-screen max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 p-0"
        onPointerDownOutside={blockInteractOutside ? (e) => e.preventDefault() : undefined}
        onInteractOutside={blockInteractOutside ? (e) => e.preventDefault() : undefined}
      >
        <DialogTitle className="sr-only">
          {currentSlide?.title || 'Presentation Player'}
        </DialogTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="fixed top-4 right-4 z-[200] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/50"
          aria-label="Exit fullscreen"
          title="Exit fullscreen"
        >
          <X className="h-4 w-4 opacity-90" strokeWidth={2.25} />
        </button>
        <div className="relative flex h-full w-full flex-col bg-black">
          {currentSlide ? (
            renderedDiagram ? (
              <div className="min-h-0 flex-1">
                <DndProvider backend={HTML5Backend}>
                  <ViewerCanvas
                    diagramData={slideTransition.animatingDiagramData || renderedDiagram}
                    showRulers={false}
                    showDotGrid={false}
                    transform={playbackTransform}
                    onTransformChange={setPlaybackTransform}
                    onFitToView={() => {}}
                    skipInitialFitToView={!showPlaybackToolbar}
                    metadataPopupsEnabled={false}
                    openNodeLinksOnClick={true}
                    animationConnectionsEnabled={playbackAnimationEnabled}
                    animationFilterSourceIds={animationFilterSourceIds}
                    animationDisabledSources={animationDisabledSources}
                    nodeTransitionStyles={slideTransition.nodeTransitionStyles}
                    connectionTransitionStyles={slideTransition.connectionTransitionStyles}
                    connectionRenderRevision={`${safeIndex}-${currentSlide?.id ?? ''}`}
                  />
                </DndProvider>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <img
                  key={currentSlide.id}
                  src={currentSlide.snapshotImage || SLIDE_IMAGE_PLACEHOLDER}
                  alt={currentSlide.title || `Slide ${safeIndex + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
              No slides to present.
            </div>
          )}

          {showPlaybackToolbar &&
            (panelHidden ? (
              <Button
                variant="outline"
                size="sm"
                className="pointer-events-auto fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 border border-border bg-card/95 px-3 py-1.5 text-foreground shadow-lg backdrop-blur-sm hover:bg-accent"
                onClick={() => setPanelHidden(false)}
                title="Show controls"
                aria-label="Show controls"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            ) : (
              <div className={playbackBarClassName}>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <MonitorPlay className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{slideBarLabel}</span>
                  <span className="shrink-0 rounded border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                    {totalSlides > 0 ? safeIndex + 1 : 0} / {totalSlides}
                  </span>
                </div>

                <label className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-md border border-border bg-muted/40 px-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border"
                    checked={useSlideZoom}
                    onChange={(e) => setUseSlideZoom(e.target.checked)}
                  />
                  Use slide zoom
                </label>

                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" className="h-8 gap-1 px-2" onClick={goPrevious} disabled={totalSlides === 0}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </Button>
                  <Button size="sm" variant="secondary" className="h-8 gap-1 px-2" onClick={goNext} disabled={totalSlides === 0}>
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 px-2"
                    onClick={() => setPanelHidden(true)}
                    disabled={totalSlides === 0}
                    title="Hide controls (fullscreen slide)"
                    aria-label="Hide controls"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </Button>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 w-8 shrink-0 px-0" title="More playback options" aria-label="More playback options">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 space-y-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-full justify-start gap-2"
                        onClick={() => {
                          applyViewerUnionFit();
                          setUseSlideZoom(false);
                        }}
                        disabled={slideDiagramsForUnionFit.length === 0}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Auto zoom (fit all slides)
                      </Button>

                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-border"
                          checked={autoPlayEnabled}
                          onChange={(e) => setAutoPlayEnabled(e.target.checked)}
                        />
                        <Play className="h-3.5 w-3.5 text-muted-foreground" />
                        Auto-play
                      </label>

                      <div className="flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          value={autoPlaySeconds}
                          onChange={(e) => setAutoPlaySeconds(Number(e.target.value) || 1)}
                          className="h-8 w-16 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">sec per slide</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Manual zoom %</div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={10}
                            max={250}
                            value={manualZoomPercentDraft}
                            onChange={(e) => setManualZoomPercentDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyZoomToCurrent();
                              }
                            }}
                            className="h-8 w-20 text-xs"
                          />
                          <Button size="sm" variant="outline" className="h-8 w-8 px-0" onClick={handleApplyZoomToCurrent} disabled={!currentSlide} title="Apply to current snapshot">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 px-0" onClick={handleApplyZoomToAll} disabled={!currentSlide || totalSlides === 0} title="Apply to all snapshots">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Space = next · ← → = prev/next · ↑ ↓ = first/last · Esc = exit
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
