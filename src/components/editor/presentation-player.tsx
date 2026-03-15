"use client";

import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Copy, GripVertical, Maximize2, Minimize2, MonitorPlay, Pin, PinOff, Play, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ViewerCanvas } from '@/components/viewer/viewer-canvas';
import type { DiagramData, Slide } from '@/lib/types';
import type { Transform } from '@/hooks/use-canvas-transform';

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
}

function pruneConnectionsToVisibleNodes(diagram: DiagramData): DiagramData {
  const visibleNodeIds = new Set((diagram.nodes ?? []).map((node) => node.id));
  return {
    ...diagram,
    connections: (diagram.connections ?? []).filter((conn) => visibleNodeIds.has(conn.from) && visibleNodeIds.has(conn.to)),
  };
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
}: PresentationPlayerProps) {
  const [playbackTransform, setPlaybackTransform] = React.useState<Transform>({ x: 0, y: 0, k: 1 });
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

  React.useEffect(() => {
    if (!open || !autoPlayEnabled || totalSlides <= 1) return;
    const delay = Math.max(1, autoPlaySeconds) * 1000;
    const timer = window.setInterval(goNext, delay);
    return () => window.clearInterval(timer);
  }, [open, autoPlayEnabled, autoPlaySeconds, totalSlides, goNext]);

  React.useEffect(() => {
    if (!open || !useSlideZoom || !currentSlide) return;
    const slideZoom = currentSlide.autoZoomLevel;
    if (typeof slideZoom !== 'number' || !Number.isFinite(slideZoom)) return;
    const clampedZoom = Math.max(0.1, Math.min(2.5, slideZoom));

    setPlaybackTransform((prev) => {
      if (Math.abs(prev.k - clampedZoom) < 0.0001) return prev;
      return {
        ...prev,
        k: clampedZoom,
      };
    });
  }, [open, useSlideZoom, currentSlide?.id, currentSlide?.autoZoomLevel]);

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
      if (event.key === ' ') {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        goPrevious();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, goNext, goPrevious, onOpenChange]);

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
    ? 'absolute z-50 rounded-lg border border-white/20 bg-black/78 p-1.5 text-white shadow-2xl backdrop-blur-sm'
    : 'absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/70 p-1.5 text-white backdrop-blur-sm';

  const toolbarShellStyle = toolbarFloating
    ? ({ left: toolbarPosition.x, top: toolbarPosition.y, width: 'min(860px, calc(100vw - 16px))' } as React.CSSProperties)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 p-0">
        <DialogTitle className="sr-only">
          {currentSlide?.title || 'Presentation Player'}
        </DialogTitle>
        <div className="relative flex h-full w-full items-center justify-center bg-black">
          {currentSlide ? (
            renderedDiagram ? (
              <div
                className="h-full w-full"
              >
                <DndProvider backend={HTML5Backend}>
                  <ViewerCanvas
                    diagramData={renderedDiagram}
                    showRulers={false}
                    transform={playbackTransform}
                    onTransformChange={setPlaybackTransform}
                    metadataPopupsEnabled={false}
                    animationConnectionsEnabled={playbackAnimationEnabled}
                    animationFilterSourceIds={animationFilterSourceIds}
                    animationDisabledSources={animationDisabledSources}
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
            <div className="text-sm text-white/80">No slides to present.</div>
          )}

          <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-black/50 p-3 text-white">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MonitorPlay className="h-4 w-4 text-white/80" />
                <div className="truncate text-sm font-semibold">
                  {currentSlide?.title || 'Presentation'}
                </div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-white/70">
                <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5">
                  Slide {totalSlides > 0 ? safeIndex + 1 : 0} of {totalSlides}
                </span>
                {typeof currentSlide?.autoZoomLevel === 'number' && (
                  <span className="rounded border border-white/20 bg-white/10 px-2 py-0.5">
                    Saved Zoom {(currentSlide.autoZoomLevel * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm font-medium text-white/90">
              {totalSlides > 0 ? `${safeIndex + 1} / ${totalSlides}` : '0 / 0'}
            </div>
          </div>

          <div className={toolbarShellClassName} style={toolbarShellStyle}>
            <div
              className={toolbarFloating ? 'mb-1 flex cursor-move items-center justify-between gap-2 rounded border border-white/20 bg-white/5 px-1.5 py-1' : 'mb-1 flex items-center justify-between gap-2'}
              onMouseDown={handleToolbarMouseDown}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                {toolbarFloating && <GripVertical className={draggingToolbar ? 'h-3.5 w-3.5 text-white' : 'h-3.5 w-3.5'} />}
                <span>Playback Controls</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 w-5 border-white/30 bg-white/5 px-0 text-white hover:bg-white/10"
                  onClick={() => setToolbarCollapsed((prev) => !prev)}
                  title={toolbarCollapsed ? 'Expand controls' : 'Collapse controls'}
                >
                  {toolbarCollapsed ? <Maximize2 className="h-2.5 w-2.5" /> : <Minimize2 className="h-2.5 w-2.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-5 w-5 border-white/30 bg-white/5 px-0 text-white hover:bg-white/10"
                  onClick={() => setToolbarFloating((prev) => !prev)}
                  title={toolbarFloating ? 'Fix controls to bottom' : 'Float and drag controls'}
                >
                  {toolbarFloating ? <Pin className="h-2.5 w-2.5" /> : <PinOff className="h-2.5 w-2.5" />}
                </Button>
                {isCompactScreen && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-5 border-white/30 bg-white/5 px-1 text-[10px] text-white hover:bg-white/10"
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
                  <Button size="sm" variant="outline" className="h-6 border-white/30 bg-white/5 px-1.5 text-[11px] text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
                    <X className="h-3 w-3" />
                    Exit
                  </Button>

                  {showAdvancedControls && (
                    <>
                      <label className="ml-0.5 flex h-6 items-center gap-1 rounded border border-white/20 bg-white/5 px-1.5 text-[10px]">
                        <input
                          type="checkbox"
                          checked={autoPlayEnabled}
                          onChange={(e) => setAutoPlayEnabled(e.target.checked)}
                        />
                        <Play className="h-2.5 w-2.5" />
                        Auto-play
                      </label>

                      <label className="flex h-6 items-center gap-1 rounded border border-white/20 bg-white/5 px-1.5 text-[10px]">
                        <input
                          type="checkbox"
                          checked={useSlideZoom}
                          onChange={(e) => setUseSlideZoom(e.target.checked)}
                        />
                        Use slide zoom
                      </label>

                      <div className="flex h-6 items-center gap-1 rounded border border-white/20 bg-white/5 px-1.5">
                        <Clock3 className="h-2.5 w-2.5 text-white/80" />
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          value={autoPlaySeconds}
                          onChange={(e) => setAutoPlaySeconds(Number(e.target.value) || 1)}
                          className="h-5 w-12 border-white/20 bg-black/20 px-1 text-[10px] text-white"
                        />
                        <span className="text-[10px] text-white/80">sec</span>
                      </div>

                      <div className="flex h-6 items-center gap-1 rounded border border-white/20 bg-white/5 px-1">
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
                          className="h-5 w-12 border-white/20 bg-black/20 px-1 text-[10px] text-white"
                        />
                        <span className="text-[10px] text-white/80">%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 w-5 border-white/30 bg-transparent px-0 text-white hover:bg-white/10"
                          onClick={handleApplyZoomToCurrent}
                          disabled={!currentSlide}
                          title="Apply zoom to current snapshot"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 w-5 border-white/30 bg-transparent px-0 text-white hover:bg-white/10"
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

                <div className="text-[10px] text-white/70 lg:text-right">
                  Keyboard: Space = next, Backspace = previous, Escape = exit
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
