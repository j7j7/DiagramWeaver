"use client";

import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PresentationDeck, Slide } from '@/lib/types';
import { cn } from '@/lib/utils';

const DND_TYPE = 'presentation-slide-item';
const SLIDE_THUMBNAIL_PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="%2311141a"/><text x="160" y="90" text-anchor="middle" dominant-baseline="middle" fill="%23d1d5db" font-family="Arial, sans-serif" font-size="14">Slide</text></svg>';

interface SlideStripItemProps {
  slide: Slide;
  index: number;
  active: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
  onSelect: () => void;
  onDelete?: (slideId: string) => void;
  onRename?: (slideId: string, title: string) => void;
  onReorderDragBegin?: () => void;
  onReorderDragEnd?: () => void;
}

/** One strip item for every slide (incl. primary) so DnD targets keep stable keys across reorder. */
function SlideStripItem({
  slide,
  index,
  active,
  onMove,
  onSelect,
  onDelete,
  onRename,
  onReorderDragBegin,
  onReorderDragEnd,
}: SlideStripItemProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const isPrimary = index === 0;
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState('');
  const editingRef = React.useRef(false);

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
    canDrag: () => !editingRef.current,
    item: () => {
      onReorderDragBegin?.();
      return { index };
    },
    end: () => {
      onReorderDragEnd?.();
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));

  const startEditing = React.useCallback(
    (e: React.MouseEvent) => {
      if (!onRename) return;
      e.stopPropagation();
      e.preventDefault();
      editingRef.current = true;
      setEditValue(slide.title ?? '');
      setIsEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    },
    [onRename, slide.title],
  );

  const commitRename = React.useCallback(() => {
    if (!editingRef.current) return;
    editingRef.current = false;
    const trimmed = editValue.trim();
    const prev = (slide.title ?? '').trim();
    if (onRename && trimmed !== prev) {
      onRename(slide.id, trimmed);
    }
    setIsEditing(false);
  }, [editValue, onRename, slide.id, slide.title]);

  const cancelRename = React.useCallback(() => {
    editingRef.current = false;
    setIsEditing(false);
    setEditValue(slide.title ?? '');
  }, [slide.title]);

  const displayTitle = slide.title?.trim() || '';

  return (
    <div
      ref={ref}
      className={cn(
        'group flex w-[140px] shrink-0 cursor-pointer flex-col rounded-md border p-1 transition-all',
        active ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-accent/40',
        isDragging && 'opacity-50',
      )}
      onClick={onSelect}
      title={
        isPrimary
          ? 'Main diagram (slide 1). Drag here to make a snapshot the main diagram, or drag to reorder.'
          : slide.title || `Slide ${index + 1}`
      }
    >
      <div className="relative w-full shrink-0 overflow-hidden rounded-md border bg-muted">
        {/* PNG uses per-slide tight fit; strip is 16:9 — stretch to fill frame (minor skew if PNG aspect differs). */}
        <div className="aspect-video w-full">
          <img
            src={slide.snapshotImage || SLIDE_THUMBNAIL_PLACEHOLDER}
            alt={slide.title || `Slide ${index + 1}`}
            className="h-full w-full object-fill object-center"
            loading="lazy"
            decoding="async"
          />
        </div>
        {onDelete ? (
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
        ) : null}
      </div>
      <div
        className="flex min-w-0 shrink-0 items-center gap-1 pt-0.5 text-left"
        onDoubleClick={onRename ? startEditing : undefined}
        title={onRename ? 'Double-click to rename' : undefined}
      >
        <span className="shrink-0 text-[11px] font-medium text-foreground">#{index + 1}</span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            spellCheck
            aria-label={`Rename slide ${index + 1}`}
            className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-0 text-[11px] leading-tight text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelRename();
              }
            }}
            autoFocus
          />
        ) : displayTitle ? (
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">{displayTitle}</span>
        ) : null}
      </div>
    </div>
  );
}

interface PresentationEditorPanelProps {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId: string | null;
  snapshotsCollapsed: boolean;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onSelectSlide: (slideId: string) => void;
  onSelectBaseSlide: () => void;
  onRenameSlide?: (slideId: string, title: string) => void;
  onReorderDragBegin?: () => void;
  onReorderDragEnd?: () => void;
}

export function PresentationEditorPanel({
  decks,
  activeDeckId,
  activeSlideId,
  snapshotsCollapsed,
  onDeleteSlide,
  onMoveSlide,
  onSelectSlide,
  onSelectBaseSlide,
  onRenameSlide,
  onReorderDragBegin,
  onReorderDragEnd,
}: PresentationEditorPanelProps) {
  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? null;

  if (snapshotsCollapsed) {
    return null;
  }

  return (
    <div className="border-b bg-card/95 px-2 py-1 backdrop-blur">
      <div className="mt-0.5">
        <div className="overflow-x-auto rounded-md border bg-background/60 p-1">
          <div className="flex min-h-[88px] flex-nowrap gap-2">
            {activeDeck && activeDeck.slides.length > 0
              ? activeDeck.slides.map((slide, index) => (
                  <SlideStripItem
                    key={slide.id}
                    slide={slide}
                    index={index}
                    active={activeSlideId === slide.id}
                    onMove={onMoveSlide}
                    onSelect={
                      index === 0
                        ? onSelectBaseSlide
                        : () => onSelectSlide(slide.id)
                    }
                    onDelete={index === 0 ? undefined : onDeleteSlide}
                    onRename={onRenameSlide}
                    onReorderDragBegin={onReorderDragBegin}
                    onReorderDragEnd={onReorderDragEnd}
                  />
                ))
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}
