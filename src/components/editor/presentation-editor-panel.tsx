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
  snapshotsCollapsed: boolean;
  onDeleteSlide: (slideId: string) => void;
  onMoveSlide: (fromIndex: number, toIndex: number) => void;
  onSelectSlide: (slideId: string) => void;
  onSelectBaseSlide: () => void;
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
    </div>
  );
}
