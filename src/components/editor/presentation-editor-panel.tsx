"use client";

import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Download, GripVertical, Maximize2, Minimize2, Pin, PinOff, Play, Plus, Save, Trash2, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PresentationDeck, Slide } from '@/lib/types';
import { cn } from '@/lib/utils';

const DND_TYPE = 'presentation-slide-item';
const SLIDE_THUMBNAIL_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%2311141a"/><text x="160" y="90" text-anchor="middle" dominant-baseline="middle" fill="%23d1d5db" font-family="Arial, sans-serif" font-size="14">Slide</text></svg>';

interface DraggableSlideProps {
  slide: Slide;
  index: number;
  active: boolean;
  compact: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
  onSelect: (slideId: string) => void;
  onDelete: (slideId: string) => void;
}

function DraggableSlideItem({
  slide,
  index,
  active,
  compact,
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
        'group flex cursor-pointer flex-col gap-2 rounded-md border p-2 transition-all',
        active ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-accent/40',
        isDragging && 'opacity-50'
      )}
      onClick={() => onSelect(slide.id)}
      title={slide.title || `Slide ${index + 1}`}
    >
      <img
        src={slide.snapshotImage || SLIDE_THUMBNAIL_PLACEHOLDER}
        alt={slide.title || `Slide ${index + 1}`}
        className="aspect-video w-full rounded border object-cover"
      />

      {!compact ? (
        <div className="min-w-0 w-full text-left">
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-muted-foreground">Slide {index + 1}</div>
            {slide.autoZoomLevel && (
              <span className="rounded border bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                Zoom {(slide.autoZoomLevel * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="truncate text-xs font-medium">{slide.title || `Snapshot ${index + 1}`}</div>
        </div>
      ) : (
        <div className="text-[10px] font-medium text-muted-foreground">#{index + 1}</div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="destructive"
            className={cn('self-end px-0 opacity-85 group-hover:opacity-100', compact ? 'h-5 w-5' : 'h-6 w-6')}
            aria-label="Delete snapshot"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(slide.id);
            }}
          >
            <Trash2 className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete snapshot</TooltipContent>
      </Tooltip>
    </div>
  );
}

interface PresentationEditorPanelProps {
  isOpen: boolean;
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId: string | null;
  onCreateDeck: () => void;
  onDeleteDeck: () => void;
  onRenameDeck: (name: string) => void;
  onSelectDeck: (deckId: string) => void;
  onAutoZoom: () => void;
  zoomPercentDraft: string;
  onZoomPercentDraftChange: (value: string) => void;
  onApplyZoomToCurrent: () => void;
  onApplyZoomToAll: () => void;
  onAddSnapshot: () => void;
  onSaveSnapshot: () => void;
  onRemoveSlides: () => void;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onSelectSlide: (slideId: string) => void;
  onPreviousSlide: () => void;
  onNextSlide: () => void;
  onEnterPlayMode: () => void;
  onExportDecks: () => void;
  onImportDecks: (file: File) => void;
}

export function PresentationEditorPanel({
  isOpen,
  decks,
  activeDeckId,
  activeSlideId,
  onCreateDeck,
  onDeleteDeck,
  onRenameDeck,
  onSelectDeck,
  onAutoZoom,
  zoomPercentDraft,
  onZoomPercentDraftChange,
  onApplyZoomToCurrent,
  onApplyZoomToAll,
  onAddSnapshot,
  onSaveSnapshot,
  onRemoveSlides,
  onDeleteSlide,
  onMoveSlide,
  onSelectSlide,
  onPreviousSlide,
  onNextSlide,
  onEnterPlayMode,
  onExportDecks,
  onImportDecks,
}: PresentationEditorPanelProps) {
  const SNAPSHOT_MIN_WIDTH = 88;
  const SNAPSHOT_MAX_WIDTH = 210;
  const SNAPSHOT_GAP = 8;
  const SNAPSHOT_PANE_HEIGHT_MIN = 140;
  const SNAPSHOT_PANE_HEIGHT_MAX = 540;
  const SNAPSHOT_PANE_HEIGHT_STEP = 40;

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);
  const snapshotsPanelRef = React.useRef<HTMLDivElement | null>(null);
  const snapshotsViewportRef = React.useRef<HTMLDivElement | null>(null);
  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null;
  const activeSlideIndex = activeDeck
    ? Math.max(0, activeDeck.slides.findIndex((slide) => slide.id === activeSlideId))
    : -1;

  const [renameDraft, setRenameDraft] = React.useState('');
  const [toolbarCollapsed, setToolbarCollapsed] = React.useState(false);
  const [toolbarFloating, setToolbarFloating] = React.useState(false);
  const [toolbarPosition, setToolbarPosition] = React.useState({ x: 20, y: 96 });
  const [draggingToolbar, setDraggingToolbar] = React.useState(false);
  const [snapshotsCollapsed, setSnapshotsCollapsed] = React.useState(false);
  const [snapshotsFloating, setSnapshotsFloating] = React.useState(false);
  const [snapshotsPosition, setSnapshotsPosition] = React.useState({ x: 20, y: 220 });
  const [draggingSnapshots, setDraggingSnapshots] = React.useState(false);
  const [snapshotsPaneHeight, setSnapshotsPaneHeight] = React.useState(256);
  const [snapshotTileMinWidth, setSnapshotTileMinWidth] = React.useState(170);

  React.useEffect(() => {
    setRenameDraft(activeDeck?.name ?? '');
  }, [activeDeck?.id, activeDeck?.name]);

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

  React.useEffect(() => {
    if (!activeDeck || snapshotsCollapsed) {
      return;
    }

    const viewport = snapshotsViewportRef.current;
    if (!viewport) {
      return;
    }

    const computeTileWidth = () => {
      const containerWidth = Math.max(0, viewport.clientWidth - 8);
      const containerHeight = Math.max(0, viewport.clientHeight - 8);
      const count = activeDeck.slides.length;

      if (!containerWidth || !containerHeight || count <= 0) {
        setSnapshotTileMinWidth(170);
        return;
      }

      let best = SNAPSHOT_MAX_WIDTH;

      for (let width = SNAPSHOT_MAX_WIDTH; width >= SNAPSHOT_MIN_WIDTH; width -= 2) {
        const columns = Math.max(1, Math.floor((containerWidth + SNAPSHOT_GAP) / (width + SNAPSHOT_GAP)));
        const rows = Math.ceil(count / columns);
        const contentHeight = width * (9 / 16) + (width <= 100 ? 34 : 74);
        const totalHeight = rows * contentHeight + Math.max(0, rows - 1) * SNAPSHOT_GAP;

        if (totalHeight <= containerHeight) {
          best = width;
          break;
        }

        best = width;
      }

      setSnapshotTileMinWidth(Math.max(SNAPSHOT_MIN_WIDTH, Math.min(SNAPSHOT_MAX_WIDTH, best)));
    };

    computeTileWidth();

    const resizeObserver = new ResizeObserver(() => {
      computeTileWidth();
    });

    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [activeDeck, snapshotsCollapsed, snapshotsPaneHeight]);

  if (!isOpen) return null;

  const panelClassName = toolbarFloating
    ? 'fixed z-50 rounded-lg border bg-card/95 p-2 shadow-2xl backdrop-blur'
    : 'border-b bg-card/95 px-2 py-1.5 backdrop-blur';

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
    <div
      ref={snapshotsViewportRef}
      className="overflow-y-auto rounded-md border bg-background/60 p-2"
      style={{ height: snapshotsPaneHeight }}
    >
      {activeDeck && activeDeck.slides.length > 0 ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${snapshotTileMinWidth}px, 1fr))` }}
        >
          {activeDeck.slides.map((slide, index) => (
            <DraggableSlideItem
              key={slide.id}
              slide={slide}
              index={index}
              active={activeSlideIndex === index}
              compact={snapshotTileMinWidth <= 100}
              onMove={onMoveSlide}
              onSelect={onSelectSlide}
              onDelete={onDeleteSlide}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No snapshots yet. Add Snapshot to capture the current visible canvas.
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className={panelClassName} style={panelStyle}>
      <div
        ref={toolbarRef}
        className={cn('mb-1 flex items-center justify-between gap-2 rounded-md px-1 py-0.5', toolbarFloating && 'cursor-move border bg-background/70')}
        onMouseDown={handleToolbarMouseDown}
      >
        <div className="flex items-center gap-1.5">
          {toolbarFloating && <GripVertical className={cn('h-3.5 w-3.5 text-muted-foreground', draggingToolbar && 'text-primary')} />}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presentation Mode</h3>
          <div className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {activeDeck ? `${activeDeck.name} · ${activeDeck.slides.length} slides` : 'No presentation selected'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 px-0"
                onClick={() => setToolbarCollapsed((prev) => !prev)}
                aria-label={toolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
              >
                {toolbarCollapsed ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{toolbarCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 px-0"
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

      {!toolbarCollapsed && (
        <>
          <div className="mb-1.5 overflow-x-auto rounded-md border bg-background/80 p-1.5">
            <div className="flex min-w-max items-center gap-1.5 whitespace-nowrap">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Toolbar</div>
              <select
                className="h-7 min-w-[180px] rounded-md border bg-background px-2 text-[11px]"
                value={activeDeckId ?? ''}
                onChange={(e) => onSelectDeck(e.target.value)}
              >
                <option value="" disabled>
                  Select Presentation
                </option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
              <Input
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeDeck && renameDraft.trim()) {
                    onRenameDeck(renameDraft.trim());
                  }
                }}
                placeholder="Rename presentation"
                className="h-7 w-44 text-[11px]"
                disabled={!activeDeck}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 px-0"
                    disabled={!activeDeck || !renameDraft.trim()}
                    onClick={() => onRenameDeck(renameDraft.trim())}
                    aria-label="Apply presentation name"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apply presentation name</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onCreateDeck} aria-label="Create new presentation">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create presentation</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onDeleteDeck} disabled={!activeDeck} aria-label="Delete selected presentation">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete presentation</TooltipContent>
              </Tooltip>
              <span className="mx-0.5 h-5 w-px bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="h-7 w-7 px-0" onClick={onAddSnapshot} disabled={!activeDeck} aria-label="Add snapshot">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add snapshot</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onSaveSnapshot} disabled={!activeDeck || !activeSlideId} aria-label="Save current snapshot">
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save snapshot</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onAutoZoom} disabled={!activeDeck} aria-label="Auto zoom">
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Auto zoom</TooltipContent>
              </Tooltip>
              <Input
                value={zoomPercentDraft}
                onChange={(e) => onZoomPercentDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApplyZoomToCurrent();
                  }
                }}
                className="h-7 w-16 px-1.5 text-[11px]"
                placeholder="100"
                aria-label="Zoom percent"
                disabled={!activeDeck}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={() => onApplyZoomToCurrent()} disabled={!activeDeck || !activeSlideId} aria-label="Apply zoom to active snapshot">
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apply zoom to active snapshot</TooltipContent>
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
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onPreviousSlide} disabled={!activeDeck || activeDeck.slides.length === 0} aria-label="Previous snapshot">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous snapshot</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onNextSlide} disabled={!activeDeck || activeDeck.slides.length === 0} aria-label="Next snapshot">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next snapshot</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="secondary" className="h-7 w-7 px-0" onClick={onEnterPlayMode} disabled={!activeDeck || activeDeck.slides.length === 0} aria-label="Enter play mode">
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enter play mode</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="destructive" className="h-7 w-7 px-0" onClick={onRemoveSlides} disabled={!activeDeck || activeDeck.slides.length === 0} aria-label="Remove active snapshot">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove active snapshot</TooltipContent>
              </Tooltip>
              <span className="mx-0.5 h-5 w-px bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={onExportDecks} aria-label="Export presentations">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export presentations</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 w-7 px-0" onClick={() => fileInputRef.current?.click()} aria-label="Import presentations">
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import presentations</TooltipContent>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportDecks(file);
                  e.currentTarget.value = '';
                }}
              />
            </div>
          </div>

          <div className="mb-1 flex items-center justify-between px-0.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Snapshots</div>
            {activeSlideIndex >= 0 && (
              <div className="text-[11px] text-muted-foreground">Active: #{activeSlideIndex + 1}</div>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 px-0"
                    onClick={() => setSnapshotsPaneHeight((prev) => Math.max(SNAPSHOT_PANE_HEIGHT_MIN, prev - SNAPSHOT_PANE_HEIGHT_STEP))}
                    aria-label="Decrease snapshots pane height"
                    disabled={snapshotsPaneHeight <= SNAPSHOT_PANE_HEIGHT_MIN}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Shrink snapshots pane</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 px-0"
                    onClick={() => setSnapshotsPaneHeight((prev) => Math.min(SNAPSHOT_PANE_HEIGHT_MAX, prev + SNAPSHOT_PANE_HEIGHT_STEP))}
                    aria-label="Increase snapshots pane height"
                    disabled={snapshotsPaneHeight >= SNAPSHOT_PANE_HEIGHT_MAX}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grow snapshots pane</TooltipContent>
              </Tooltip>
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
                    onClick={() => setSnapshotsFloating((prev) => !prev)}
                    aria-label={snapshotsFloating ? 'Fix snapshots below toolbar' : 'Float snapshots pane'}
                  >
                    {snapshotsFloating ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{snapshotsFloating ? 'Fix snapshots pane' : 'Float + drag snapshots pane'}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {!snapshotsFloating && !snapshotsCollapsed && snapshotsList}
        </>
      )}
      </div>

      {isOpen && snapshotsFloating && !toolbarCollapsed && (
        <div
          ref={snapshotsPanelRef}
          className={snapshotsPanelClassName}
          style={snapshotsPanelStyle}
        >
          <div
            className="mb-1 flex cursor-move items-center justify-between gap-2 rounded-md border bg-background/70 px-1 py-0.5"
            onMouseDown={handleSnapshotsMouseDown}
          >
            <div className="flex items-center gap-1.5">
              <GripVertical className={cn('h-3.5 w-3.5 text-muted-foreground', draggingSnapshots && 'text-primary')} />
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Snapshots</div>
              {activeSlideIndex >= 0 && (
                <div className="text-[11px] text-muted-foreground">Active: #{activeSlideIndex + 1}</div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 px-0"
                    onClick={() => setSnapshotsPaneHeight((prev) => Math.max(SNAPSHOT_PANE_HEIGHT_MIN, prev - SNAPSHOT_PANE_HEIGHT_STEP))}
                    aria-label="Decrease snapshots pane height"
                    disabled={snapshotsPaneHeight <= SNAPSHOT_PANE_HEIGHT_MIN}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Shrink snapshots pane</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 w-6 px-0"
                    onClick={() => setSnapshotsPaneHeight((prev) => Math.min(SNAPSHOT_PANE_HEIGHT_MAX, prev + SNAPSHOT_PANE_HEIGHT_STEP))}
                    aria-label="Increase snapshots pane height"
                    disabled={snapshotsPaneHeight >= SNAPSHOT_PANE_HEIGHT_MAX}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Grow snapshots pane</TooltipContent>
              </Tooltip>
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
