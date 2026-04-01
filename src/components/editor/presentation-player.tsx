"use client";

import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Copy, GripVertical, Maximize2, Minimize2, MonitorPlay, Pin, PinOff, Play, Wand2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ViewerCanvas } from '@/components/viewer/viewer-canvas';
import type { DiagramData, Slide } from '@/lib/types';
import { AnnotationCanvas } from './annotation-canvas';
import { AnnotationRenderer } from './annotation-renderer';
import { AnnotationToolbar } from './annotation-toolbar';
import { createEmptyAnnotations, type AnnotationToolConfig, type DiagramAnnotations, type SlideAnnotations } from '@/lib/annotation-types';
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
  onSlideAnnotationsChange?: (slideId: string, annotations: SlideAnnotations) => void;
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
  onSlideAnnotationsChange,
  showPlaybackToolbar = true,
}: PresentationPlayerProps) {
  const [playbackTransform, setPlaybackTransform] = React.useState<Transform>({ x: 0, y: 0, k: 1 });
  const [annotationToolConfig, setAnnotationToolConfig] = React.useState<AnnotationToolConfig>({
    enabled: false,
    color: '#000000',
    width: 2,
    opacity: 1,
    style: 'pen',
  });
  const [annotationIsDrawing, setAnnotationIsDrawing] = React.useState(false);
  const [annotationViewport, setAnnotationViewport] = React.useState({ width: 0, height: 0 });
  const [annotationsBySlideId, setAnnotationsBySlideId] = React.useState<Record<string, DiagramAnnotations>>({});
  const [useSlideZoom, setUseSlideZoom] = React.useState(true);
  const [autoPlayEnabled, setAutoPlayEnabled] = React.useState(false);
  const [autoPlaySeconds, setAutoPlaySeconds] = React.useState(4);
  const [isCompactScreen, setIsCompactScreen] = React.useState(false);
  const [controlsExpanded, setControlsExpanded] = React.useState(true);
  const [manualZoomPercentDraft, setManualZoomPercentDraft] = React.useState('100');
  const [toolbarCollapsed, setToolbarCollapsed] = React.useState(false);
  const [toolbarFloating, setToolbarFloating] = React.useState(false);
  const [toolbarPosition, setToolbarPosition] = React.useState({ x: 20, y: 20 });
  const [draggingToolbar, setDraggingToolbar] = React.useState(false);
  const [panelHidden, setPanelHidden] = React.useState(false);
  const [previousSlideIndex, setPreviousSlideIndex] = React.useState(currentIndex);
  const [previousDiagram, setPreviousDiagram] = React.useState<DiagramData | null>(null);
  const playbackTransformRef = React.useRef(playbackTransform);
  const presentationSurfaceRef = React.useRef<HTMLDivElement | null>(null);
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

  const currentAnnotations = React.useMemo<DiagramAnnotations>(() => {
    if (!currentSlide) return createEmptyAnnotations();
    const cached = annotationsBySlideId[currentSlide.id];
    if (cached) return cached;
    const fromSlide = (currentSlide as any).annotations;
    if (fromSlide && Array.isArray(fromSlide.strokes)) {
      return {
        enabled: Boolean(fromSlide.enabled),
        strokes: fromSlide.strokes,
        createdAt: typeof fromSlide.createdAt === 'number' ? fromSlide.createdAt : Date.now(),
        updatedAt: typeof fromSlide.updatedAt === 'number' ? fromSlide.updatedAt : Date.now(),
      };
    }
    return createEmptyAnnotations();
  }, [currentSlide, annotationsBySlideId]);

  const annotationPageToken = React.useMemo(
    () => `slide:${currentSlide?.id ?? 'none'}`,
    [currentSlide?.id]
  );

  const updateCurrentAnnotations = React.useCallback(
    (updater: DiagramAnnotations | ((prev: DiagramAnnotations) => DiagramAnnotations)) => {
      if (!currentSlide) return;
      setAnnotationsBySlideId((prev) => {
        const base = prev[currentSlide.id] ?? currentAnnotations;
        const next = typeof updater === 'function' ? updater(base) : updater;
        onSlideAnnotationsChange?.(currentSlide.id, {
          enabled: next.enabled,
          strokes: next.strokes,
          createdAt: next.createdAt,
          updatedAt: Date.now(),
        });
        return {
          ...prev,
          [currentSlide.id]: {
            ...next,
            updatedAt: Date.now(),
          },
        };
      });
    },
    [currentSlide, currentAnnotations, onSlideAnnotationsChange]
  );

  const slideTransition = useSlideTransition({
    enabled: open && safeIndex !== previousSlideIndex,
    currentDiagram: renderedDiagram,
    previousDiagram: previousDiagram,
  });

  React.useEffect(() => {
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
    if (!open || !presentationSurfaceRef.current) return;
    const element = presentationSurfaceRef.current;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setAnnotationViewport({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

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

  React.useEffect(() => {
    if (!open) return;

    const updateScreenMode = () => {
      const compact = window.innerWidth < 1024;
      setIsCompactScreen(compact);
      setControlsExpanded((prev) => (compact ? prev : true));
    };

    updateScreenMode();
    window.addEventListener('resize', updateScreenMode);
    return () => window.removeEventListener('resize', updateScreenMode);
  }, [open]);

  const showAdvancedControls = !isCompactScreen || controlsExpanded;

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

  const handleToolbarMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!toolbarFloating) return;
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [role="button"]')) return;

    event.preventDefault();
    setDraggingToolbar(true);

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = toolbarPosition.x;
    const originY = toolbarPosition.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextX = Math.max(8, Math.min(window.innerWidth - 420, originX + (moveEvent.clientX - startX)));
      const nextY = Math.max(8, Math.min(window.innerHeight - 120, originY + (moveEvent.clientY - startY)));
      setToolbarPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      setDraggingToolbar(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [toolbarFloating, toolbarPosition.x, toolbarPosition.y]);

  const toolbarShellClassName = toolbarFloating
    ? 'absolute z-50 rounded-lg border border-border bg-card p-1.5 text-foreground shadow-2xl backdrop-blur-sm'
    : 'absolute bottom-0 left-0 right-0 border-t border-border bg-card/95 p-1.5 text-foreground backdrop-blur-sm';

  const toolbarShellStyle = toolbarFloating
    ? ({ left: toolbarPosition.x, top: toolbarPosition.y, width: 'min(860px, calc(100vw - 16px))' } as React.CSSProperties)
    : undefined;

  const blockInteractOutside = !showPlaybackToolbar;

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
          <X className="h-5 w-5 opacity-90" strokeWidth={2.25} />
        </button>
        <div ref={presentationSurfaceRef} className="relative flex h-full w-full items-center justify-center bg-black">
          {currentSlide ? (
            renderedDiagram ? (
              <div
                className="h-full w-full"
              >
                <DndProvider backend={HTML5Backend}>
                  <ViewerCanvas
                    diagramData={slideTransition.animatingDiagramData || renderedDiagram}
                    showRulers={false}
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
                  />
                </DndProvider>
              </div>
            ) : (
              <img
                key={currentSlide.id}
                src={currentSlide.snapshotImage || SLIDE_IMAGE_PLACEHOLDER}
                alt={currentSlide.title || `Slide ${safeIndex + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            )
          ) : (
            <div className="text-sm text-muted-foreground">No slides to present.</div>
          )}

          {currentSlide && annotationViewport.width > 0 && annotationViewport.height > 0 && (
            <>
              <AnnotationRenderer
                width={annotationViewport.width}
                height={annotationViewport.height}
                annotations={currentAnnotations}
              />
              <AnnotationCanvas
                enabled={annotationToolConfig.enabled}
                width={annotationViewport.width}
                height={annotationViewport.height}
                toolConfig={annotationToolConfig}
                isDrawing={annotationIsDrawing}
                onDrawingChange={setAnnotationIsDrawing}
                resetToken={annotationPageToken}
                onStrokeComplete={(stroke) => {
                  updateCurrentAnnotations((prev) => ({
                    ...prev,
                    enabled: true,
                    strokes: [...prev.strokes, stroke],
                  }));
                }}
              />
            </>
          )}

          {currentSlide && (
            <div className="absolute top-16 left-4 z-[120] pointer-events-auto max-w-[calc(100vw-1rem)] overflow-x-auto">
              <AnnotationToolbar
                toolConfig={annotationToolConfig}
                onToolChange={(config) => {
                  setAnnotationToolConfig((prev) => ({ ...prev, ...config }));
                }}
                onToggleTool={() => {
                  setAnnotationToolConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
                }}
                onClearAll={() => {
                  updateCurrentAnnotations((prev) => ({ ...prev, enabled: false, strokes: [] }));
                }}
                onUndo={() => {
                  updateCurrentAnnotations((prev) => ({
                    ...prev,
                    strokes: prev.strokes.slice(0, -1),
                    enabled: prev.strokes.length > 1,
                  }));
                }}
                hasStrokes={currentAnnotations.strokes.length > 0}
                isDrawing={annotationIsDrawing}
              />
            </div>
          )}

          {showPlaybackToolbar && (panelHidden ? (
            <Button
              variant="outline"
              size="sm"
              className="absolute bottom-3 left-1/2 z-50 -translate-x-1/2 border border-border bg-card px-3 py-1.5 text-foreground hover:bg-accent"
              onClick={() => setPanelHidden(false)}
              title="Show panel"
              aria-label="Show panel"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          ) : (
          <div className={toolbarShellClassName} style={toolbarShellStyle}>
            <div
              className={toolbarFloating ? 'mb-1 flex cursor-move items-center justify-between gap-2 rounded border border-border bg-muted/50 px-1.5 py-1' : 'mb-1 flex items-center justify-between gap-2'}
              onMouseDown={handleToolbarMouseDown}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {toolbarFloating && <GripVertical className={draggingToolbar ? 'h-3.5 w-3.5 text-foreground' : 'h-3.5 w-3.5'} />}
                  <span>Playback Controls</span>
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <MonitorPlay className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{currentSlide?.title || 'Presentation'}</span>
                  <span className="shrink-0 rounded border border-border bg-muted/50 px-2 py-0.5 text-[10px]">
                    Slide {totalSlides > 0 ? safeIndex + 1 : 0} of {totalSlides}
                  </span>
                  {typeof currentSlide?.autoZoomLevel === 'number' && (
                    <span className="shrink-0 rounded border border-border bg-muted/50 px-2 py-0.5 text-[10px]">
                      {(currentSlide.autoZoomLevel * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 w-5 border-border bg-muted/50 px-0 text-foreground hover:bg-muted"
                  onClick={() => setToolbarCollapsed((prev) => !prev)}
                  title={toolbarCollapsed ? 'Expand controls' : 'Collapse controls'}
                >
                  {toolbarCollapsed ? <Maximize2 className="h-2.5 w-2.5" /> : <Minimize2 className="h-2.5 w-2.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 w-5 border-border bg-muted/50 px-0 text-foreground hover:bg-muted"
                  onClick={() => setToolbarFloating((prev) => !prev)}
                  title={toolbarFloating ? 'Fix controls to bottom' : 'Float and drag controls'}
                >
                  {toolbarFloating ? <Pin className="h-2.5 w-2.5" /> : <PinOff className="h-2.5 w-2.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 w-5 border-border bg-muted/50 px-0 text-foreground hover:bg-muted"
                  onClick={() => setPanelHidden(true)}
                  title="Hide panel"
                  aria-label="Hide panel"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
                {isCompactScreen && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 border-border bg-muted/50 px-1 text-[10px] text-foreground hover:bg-muted"
                    onClick={() => setControlsExpanded((prev) => !prev)}
                  >
                    {controlsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                    {controlsExpanded ? 'Compact' : 'Expand'}
                  </Button>
                )}
              </div>
            </div>

            {!toolbarCollapsed && (
              <div className="grid gap-1 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" className="h-6 px-1.5 text-[11px]" variant="secondary" onClick={goPrevious} disabled={totalSlides === 0}>
                    <ChevronLeft className="h-3 w-3" />
                    Previous
                  </Button>
                  <Button size="sm" className="h-6 px-1.5 text-[11px]" variant="secondary" onClick={goNext} disabled={totalSlides === 0}>
                    Next
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 border-border bg-muted/50 px-1.5 text-[11px] text-foreground hover:bg-muted" onClick={() => onOpenChange(false)}>
                    <X className="h-3 w-3" />
                    Exit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 border-border bg-muted/50 px-1.5 text-[11px] text-foreground hover:bg-muted"
                    onClick={() => {
                      applyViewerUnionFit();
                      setUseSlideZoom(false);
                    }}
                    disabled={slideDiagramsForUnionFit.length === 0}
                    title="Auto zoom — fit all slides in one view (same as viewer presentation)"
                    aria-label="Auto zoom"
                  >
                    <Wand2 className="h-3 w-3" />
                    Auto zoom
                  </Button>

                  {showAdvancedControls && (
                    <>
                      <label className="ml-0.5 flex h-6 items-center gap-1 rounded border border-border bg-muted/50 px-1.5 text-[10px]">
                        <input
                          type="checkbox"
                          checked={autoPlayEnabled}
                          onChange={(e) => setAutoPlayEnabled(e.target.checked)}
                        />
                        <Play className="h-2.5 w-2.5" />
                        Auto-play
                      </label>

                      <label className="flex h-6 items-center gap-1 rounded border border-border bg-muted/50 px-1.5 text-[10px]">
                        <input
                          type="checkbox"
                          checked={useSlideZoom}
                          onChange={(e) => setUseSlideZoom(e.target.checked)}
                        />
                        Use slide zoom
                      </label>

                      <div className="flex h-6 items-center gap-1 rounded border border-border bg-muted/50 px-1.5">
                        <Clock3 className="h-2.5 w-2.5 text-muted-foreground" />
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          value={autoPlaySeconds}
                          onChange={(e) => setAutoPlaySeconds(Number(e.target.value) || 1)}
                          className="h-5 w-12 border-border bg-muted px-1 text-[10px] text-foreground"
                        />
                        <span className="text-[10px] text-muted-foreground">sec</span>
                      </div>

                      <div className="flex h-6 items-center gap-1 rounded border border-border bg-muted/50 px-1">
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
                          className="h-5 w-12 border-border bg-muted px-1 text-[10px] text-foreground"
                        />
                        <span className="text-[10px] text-muted-foreground">%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 w-5 border-border bg-transparent px-0 text-foreground hover:bg-muted"
                          onClick={handleApplyZoomToCurrent}
                          disabled={!currentSlide}
                          title="Apply zoom to current snapshot"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 w-5 border-border bg-transparent px-0 text-foreground hover:bg-muted"
                          onClick={handleApplyZoomToAll}
                          disabled={!currentSlide || totalSlides === 0}
                          title="Apply zoom to all snapshots"
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-[10px] text-muted-foreground lg:text-right">
                  Space = next · ← → = prev/next · ↑ ↓ = first/last · Esc = exit
                </div>
              </div>
            )}
          </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
