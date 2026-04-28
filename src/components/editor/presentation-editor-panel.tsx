"use client";

import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Check, ChevronLeft, ChevronRight, Copy, FilePlus, GripVertical, Maximize2, Minimize2, Pin, PinOff, Play, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PresentationDeck, Slide } from '@/lib/types';
import { cn } from '@/lib/utils';

const DND_TYPE = 'presentation-slide-item';
const PANEL_SETTINGS_KEY = 'dw:presentation:panelSettings';
const SLIDE_THUMBNAIL_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%2311141a"/><text x="160" y="90" text-anchor="middle" dominant-baseline="middle" fill="%23d1d5db" font-family="Arial, sans-serif" font-size="14">Slide</text></svg>';

interface PrimarySlideStripProps {
  slide: Slide;
  active: boolean;
  onSelect: () => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
}

function PrimarySlideStripItem({ slide, active, onSelect, onMoveSlide }: PrimarySlideStripProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: { index: 0 },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop<{ index: number }>({
    accept: DND_TYPE,
    hover(item) {
      if (item.index <= 0) return;
      onMoveSlide(item.index, 0);
      item.index = 0;
    },
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={cn(
        'group flex w-[140px] shrink-0 cursor-pointer flex-col rounded-md border p-1 transition-all',
        active ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-accent/40',
        isDragging && 'opacity-50',
      )}
      onClick={onSelect}
      title="Main diagram (slide 1). Drag here to make a snapshot the main diagram, or drag to reorder."
    >
      <div className="relative w-full shrink-0 overflow-hidden rounded-md border bg-muted">
        <div className="aspect-video w-full">
          <img
            src={slide.snapshotImage || SLIDE_THUMBNAIL_PLACEHOLDER}
            alt={slide.title || 'Slide 1'}
            className="h-full w-full object-contain object-center"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-left">
        <span className="text-[11px] font-medium text-foreground">#1</span>
        <span className="truncate text-[10px] text-muted-foreground">{slide.title || 'Diagram'}</span>
      </div>
    </div>
  );
}

interface DraggableSlideProps {
  slide: Slide;
  index: number;
  active: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
  onSelect: (slideId: string) => void;
  onDelete: (slideId: string) => void;
}

function DraggableSlideItem({
  slide,
  index,
  active,
  onMove,
  onSelect,
  onDelete,
}: DraggableSlideProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  const [, drop] = useDrop<{ index: number }>({
    accept: DND_TYPE,
    hover(item) {
      if (item.index === index) return;
      onMove(item.index, index);
      item.index = index;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={cn(
        'group flex w-[140px] shrink-0 cursor-pointer flex-col rounded-md border p-1 transition-all',
        active ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-accent/40',
        isDragging && 'opacity-50'
      )}
      onClick={() => onSelect(slide.id)}
      title={slide.title || `Slide ${index + 1}`}
    >
      <div className="relative w-full shrink-0 overflow-hidden rounded-md border bg-muted">
        {/* object-contain (not cover): canvas PNGs are not 16:9; cover cropped top/bottom in the strip */}
        <div className="aspect-video w-full">
          <img
            src={slide.snapshotImage || SLIDE_THUMBNAIL_PLACEHOLDER}
            alt={slide.title || `Slide ${index + 1}`}
            className="h-full w-full object-contain object-center"
            loading="lazy"
            decoding="async"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="destructive"
              className="absolute right-1 top-1 h-6 w-6 rounded-full p-0 opacity-70 shadow-md hover:opacity-100"
              aria-label="Delete snapshot"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(slide.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete snapshot</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-left">
        <span className="text-[11px] font-medium text-foreground">#{index + 1}</span>
      </div>
    </div>
  );
}

interface PresentationEditorPanelProps {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId: string | null;
  onAutoZoom: () => void;
  onApplyZoomToCurrent: () => void;
  onApplyZoomToAll: () => void;
  onAddSnapshot: () => void;
  onAddBlankSlide: () => void;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onSelectSlide: (slideId: string) => void;
  onSelectBaseSlide: () => void;
  onPreviousSlide: () => void;
  onNextSlide: () => void;
  onEnterPlayMode: () => void;
}

export function PresentationEditorPanel({
  decks,
  activeDeckId,
  activeSlideId,
  onAutoZoom,
  onApplyZoomToCurrent,
  onApplyZoomToAll,
  onAddSnapshot,
  onAddBlankSlide,
  onDeleteSlide,
  onMoveSlide,
  onSelectSlide,
  onSelectBaseSlide,
  onPreviousSlide,
  onNextSlide,
  onEnterPlayMode,
}: PresentationEditorPanelProps) {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const snapshotsPanelRef = React.useRef<HTMLDivElement | null>(null);
  const snapshotsViewportRef = React.useRef<HTMLDivElement | null>(null);
  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null;
  const stripTotal = activeDeck?.slides.length ?? 0;
  const activeStripIndex =
    activeDeck && activeSlideId ? activeDeck.slides.findIndex((s) => s.id === activeSlideId) : -1;
  const slideReadoutIndex = activeStripIndex >= 0 ? activeStripIndex + 1 : stripTotal > 0 ? 1 : 0;
  const canStepSlides = stripTotal > 1;

  const [toolbarFloating, setToolbarFloating] = React.useState(false);
  const [toolbarPosition, setToolbarPosition] = React.useState({ x: 20, y: 96 });
  const [draggingToolbar, setDraggingToolbar] = React.useState(false);
  const [snapshotsCollapsed, setSnapshotsCollapsed] = React.useState(false);
  const [snapshotsFloating, setSnapshotsFloating] = React.useState(false);
  const [snapshotsPosition, setSnapshotsPosition] = React.useState({ x: 20, y: 220 });
  const [draggingSnapshots, setDraggingSnapshots] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(PANEL_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        if (typeof parsed.toolbarFloating === 'boolean') setToolbarFloating(parsed.toolbarFloating);
        if (parsed.toolbarPosition && typeof (parsed.toolbarPosition as any).x === 'number' && typeof (parsed.toolbarPosition as any).y === 'number') {
          setToolbarPosition(parsed.toolbarPosition as { x: number; y: number });
        }
        if (typeof parsed.snapshotsCollapsed === 'boolean') setSnapshotsCollapsed(parsed.snapshotsCollapsed);
        if (typeof parsed.snapshotsFloating === 'boolean') setSnapshotsFloating(parsed.snapshotsFloating);
        if (parsed.snapshotsPosition && typeof (parsed.snapshotsPosition as any).x === 'number' && typeof (parsed.snapshotsPosition as any).y === 'number') {
          setSnapshotsPosition(parsed.snapshotsPosition as { x: number; y: number });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(PANEL_SETTINGS_KEY, JSON.stringify({
        toolbarFloating,
        toolbarPosition,
        snapshotsCollapsed,
        snapshotsFloating,
        snapshotsPosition,
      }));
    } catch {
      // ignore
    }
  }, [toolbarFloating, toolbarPosition, snapshotsCollapsed, snapshotsFloating, snapshotsPosition]);

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

  const snapSnapshotsToToolbar = React.useCallback((nextPosition: { x: number; y: number }) => {
    const toolbarRect = toolbarRef.current?.getBoundingClientRect();
    const panelRect = snapshotsPanelRef.current?.getBoundingClientRect();

    if (!toolbarRect || !panelRect) {
      return nextPosition;
    }

    const spacing = 8;
    const threshold = 28;
    const panelWidth = panelRect.width;
    const panelHeight = panelRect.height;

    const candidates = [
      {
        distance: Math.abs(nextPosition.y - (toolbarRect.bottom + spacing)),
        position: {
          x: Math.max(8, Math.min(window.innerWidth - panelWidth - 8, nextPosition.x)),
          y: toolbarRect.bottom + spacing,
        },
      },
      {
        distance: Math.abs((nextPosition.y + panelHeight + spacing) - toolbarRect.top),
        position: {
          x: Math.max(8, Math.min(window.innerWidth - panelWidth - 8, nextPosition.x)),
          y: toolbarRect.top - panelHeight - spacing,
        },
      },
      {
        distance: Math.abs(nextPosition.x - (toolbarRect.right + spacing)),
        position: {
          x: toolbarRect.right + spacing,
          y: Math.max(8, Math.min(window.innerHeight - panelHeight - 8, nextPosition.y)),
        },
      },
      {
        distance: Math.abs((nextPosition.x + panelWidth + spacing) - toolbarRect.left),
        position: {
          x: toolbarRect.left - panelWidth - spacing,
          y: Math.max(8, Math.min(window.innerHeight - panelHeight - 8, nextPosition.y)),
        },
      },
    ];

    const best = candidates.reduce((prev, current) => (current.distance < prev.distance ? current : prev));
    if (best.distance > threshold) {
      return nextPosition;
    }

    return {
      x: Math.max(8, Math.min(window.innerWidth - panelWidth - 8, best.position.x)),
      y: Math.max(8, Math.min(window.innerHeight - panelHeight - 8, best.position.y)),
    };
  }, []);

  const handleSnapshotsMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!snapshotsFloating) return;
    if (event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [role="button"]')) return;

    event.preventDefault();
    setDraggingSnapshots(true);

    const panelRect = snapshotsPanelRef.current?.getBoundingClientRect();
    const panelWidth = panelRect?.width ?? 620;
    const panelHeight = panelRect?.height ?? 320;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = snapshotsPosition.x;
    const originY = snapshotsPosition.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextX = Math.max(8, Math.min(window.innerWidth - panelWidth - 8, originX + (moveEvent.clientX - startX)));
      const nextY = Math.max(8, Math.min(window.innerHeight - panelHeight - 8, originY + (moveEvent.clientY - startY)));
      setSnapshotsPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      setDraggingSnapshots(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setSnapshotsPosition((prev) => snapSnapshotsToToolbar(prev));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [snapshotsFloating, snapshotsPosition.x, snapshotsPosition.y, snapSnapshotsToToolbar]);

  const panelClassName = toolbarFloating
    ? 'fixed z-50 rounded-lg border bg-card/95 p-2 shadow-2xl backdrop-blur'
    : 'border-b bg-card/95 px-2 py-1 backdrop-blur';

  const panelStyle = toolbarFloating
    ? ({ left: toolbarPosition.x, top: toolbarPosition.y, width: 'min(1120px, calc(100vw - 16px))' } as React.CSSProperties)
    : undefined;

  const snapshotsPanelClassName = snapshotsFloating
    ? 'fixed z-50 rounded-lg border bg-card/95 p-2 shadow-2xl backdrop-blur'
    : '';

  const snapshotsPanelStyle = snapshotsFloating
    ? ({ left: snapshotsPosition.x, top: snapshotsPosition.y, width: 'min(720px, calc(100vw - 16px))' } as React.CSSProperties)
    : undefined;

  const snapshotsList = (
    <div className="mt-0.5">
      <div
        ref={snapshotsViewportRef}
        className="overflow-x-auto rounded-md border bg-background/60 p-1"
      >
        <div className="flex min-h-[88px] flex-nowrap gap-2">
          {activeDeck && activeDeck.slides.length > 0
            ? activeDeck.slides.map((slide, index) =>
                index === 0 ? (
                  <PrimarySlideStripItem
                    key={slide.id}
                    slide={slide}
                    active={activeSlideId === slide.id}
                    onSelect={onSelectBaseSlide}
                    onMoveSlide={onMoveSlide}
                  />
                ) : (
                  <DraggableSlideItem
                    key={slide.id}
                    slide={slide}
                    index={index}
                    active={activeSlideId === slide.id}
                    onMove={onMoveSlide}
                    onSelect={onSelectSlide}
                    onDelete={onDeleteSlide}
                  />
                ),
              )
            : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={panelClassName} style={panelStyle}>
        <div
          ref={toolbarRef}
          className={cn(
            'mb-0.5 flex items-center gap-2 rounded-md border bg-background/80 p-1',
            toolbarFloating && 'cursor-move bg-background/70'
          )}
          onMouseDown={handleToolbarMouseDown}
        >
        {toolbarFloating && (
          <GripVertical className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', draggingToolbar && 'text-primary')} />
        )}
        <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1.5 whitespace-nowrap">
              <span className="hidden shrink-0 px-1 text-[11px] text-muted-foreground sm:inline">Slides</span>
              <span className="mx-0.5 h-5 w-px bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={onAddSnapshot} disabled={!activeDeck} aria-label="Add snapshot">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add snapshot</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={onAddBlankSlide} disabled={!activeDeck} aria-label="Add blank slide after current">
                    <FilePlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add blank slide after current</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onAutoZoom} disabled={!activeDeck} aria-label="Auto zoom">
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Auto zoom</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={() => onApplyZoomToCurrent()} disabled={!activeDeck} aria-label="Apply zoom to current slide">
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apply zoom to current slide</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={() => onApplyZoomToAll()} disabled={!activeDeck || activeDeck.slides.length === 0} aria-label="Apply zoom to all snapshots">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apply zoom to all snapshots</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onPreviousSlide} disabled={!activeDeck || !canStepSlides} aria-label="Previous slide">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous slide</TooltipContent>
              </Tooltip>
              <span
                className="min-w-[2.75rem] shrink-0 text-center tabular-nums text-[11px] text-muted-foreground"
                aria-live="polite"
                aria-label={
                  activeDeck
                    ? `Slide ${slideReadoutIndex} of ${stripTotal}`
                    : 'No deck'
                }
              >
                {activeDeck ? `${slideReadoutIndex} / ${stripTotal}` : '—'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onNextSlide} disabled={!activeDeck || !canStepSlides} aria-label="Next slide">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next slide</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="secondary" className="h-7 w-7 px-0" onClick={onEnterPlayMode} disabled={!activeDeck} aria-label="Enter play mode">
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enter play mode</TooltipContent>
              </Tooltip>
            </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 px-0"
                onClick={() => setSnapshotsCollapsed((prev) => !prev)}
                aria-label={snapshotsCollapsed ? 'Show snapshot previews' : 'Hide snapshot previews'}
              >
                {snapshotsCollapsed ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{snapshotsCollapsed ? 'Show snapshot previews' : 'Hide snapshot previews'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 px-0"
                onClick={() => setToolbarFloating((prev) => !prev)}
                aria-label={toolbarFloating ? 'Switch to fixed toolbar' : 'Switch to floating toolbar'}
              >
                {toolbarFloating ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{toolbarFloating ? 'Fix to window' : 'Float + drag toolbar'}</TooltipContent>
          </Tooltip>
        </div>
        </div>

        {!snapshotsFloating && !snapshotsCollapsed && snapshotsList}
      </div>

      {snapshotsFloating && (
        <div
          ref={snapshotsPanelRef}
          className={snapshotsPanelClassName}
          style={snapshotsPanelStyle}
        >
          <div
            className="mb-0.5 flex cursor-move items-center justify-end gap-1 rounded-md border bg-background/70 px-1 py-0.5"
            onMouseDown={handleSnapshotsMouseDown}
          >
            <GripVertical className={cn('h-3 w-3 text-muted-foreground', draggingSnapshots && 'text-primary')} />
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 px-0"
                    onClick={() => setSnapshotsCollapsed((prev) => !prev)}
                    aria-label={snapshotsCollapsed ? 'Expand snapshots' : 'Collapse snapshots'}
                  >
                    {snapshotsCollapsed ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{snapshotsCollapsed ? 'Expand snapshots' : 'Collapse snapshots'}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 px-0"
                    onClick={() => setSnapshotsFloating(false)}
                    aria-label="Fix snapshots below toolbar"
                  >
                    <Pin className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Fix snapshots pane</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {!snapshotsCollapsed && snapshotsList}
        </div>
      )}
    </>
  );
}
