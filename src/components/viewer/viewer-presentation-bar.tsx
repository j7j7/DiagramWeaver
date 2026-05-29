'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PresentationDeck } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  presentationPlaybackBarClassName,
  presentationPlaybackControlBtnClass,
  presentationPlaybackCounterClass,
  useDraggablePlaybackBar,
} from '@/hooks/use-draggable-playback-bar';

export interface ViewerPresentationBarProps {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  onDeckChange: (deckId: string) => void;
  slideIndex: number;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  /** When omitted, the exit control is hidden (slides are always available). */
  onExit?: () => void;
  onFullscreen: () => void;
  className?: string;
}

export function ViewerPresentationBar({
  decks,
  activeDeckId,
  onDeckChange,
  slideIndex,
  totalSlides,
  onPrevious,
  onNext,
  onExit,
  onFullscreen,
  className,
}: ViewerPresentationBarProps) {
  const showDeckSelect = decks.length > 1;
  const { barRef, barStyle, pointerHandlers } = useDraggablePlaybackBar({
    enabled: true,
    layoutRevision: `${slideIndex}-${totalSlides}-${showDeckSelect}-${activeDeckId ?? ''}`,
  });

  return (
    <div
      ref={barRef}
      className={cn(presentationPlaybackBarClassName, className)}
      style={barStyle}
      {...pointerHandlers}
    >
      <span className={presentationPlaybackCounterClass}>
        {totalSlides > 0 ? slideIndex + 1 : 0} / {totalSlides}
      </span>

      {showDeckSelect && activeDeckId && (
        <Select value={activeDeckId} onValueChange={onDeckChange}>
          <SelectTrigger className={cn(presentationPlaybackControlBtnClass, 'h-8 w-[min(200px,40vw)] border-border/30 bg-muted/30 text-xs opacity-70 hover:opacity-100')}>
            <SelectValue placeholder="Deck" />
          </SelectTrigger>
          <SelectContent>
            {decks.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" className={cn(presentationPlaybackControlBtnClass, 'gap-1 px-2')} onClick={onPrevious} disabled={totalSlides === 0}>
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <Button size="sm" variant="secondary" className={cn(presentationPlaybackControlBtnClass, 'gap-1 px-2')} onClick={onNext} disabled={totalSlides === 0}>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className={cn(presentationPlaybackControlBtnClass, 'gap-1 px-2')} onClick={onFullscreen} disabled={totalSlides === 0} title="Fullscreen presentation">
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fullscreen</span>
        </Button>
        {onExit ? (
          <Button size="sm" variant="outline" className={cn(presentationPlaybackControlBtnClass, 'px-2')} onClick={onExit} title="Exit presentation view">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
