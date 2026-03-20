'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Maximize2, MonitorPlay, X } from 'lucide-react';
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

export interface ViewerPresentationBarProps {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  onDeckChange: (deckId: string) => void;
  slideIndex: number;
  slideTitle: string | undefined;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
  onFullscreen: () => void;
  className?: string;
}

export function ViewerPresentationBar({
  decks,
  activeDeckId,
  onDeckChange,
  slideIndex,
  slideTitle,
  totalSlides,
  onPrevious,
  onNext,
  onExit,
  onFullscreen,
  className,
}: ViewerPresentationBarProps) {
  const showDeckSelect = decks.length > 1;
  const label = slideTitle || (totalSlides > 0 ? `Slide ${slideIndex + 1}` : 'Presentation');

  return (
    <div
      className={cn(
        'pointer-events-auto fixed bottom-4 left-1/2 z-[60] flex max-w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-foreground shadow-lg backdrop-blur-sm',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MonitorPlay className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="shrink-0 rounded border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
          {totalSlides > 0 ? slideIndex + 1 : 0} / {totalSlides}
        </span>
      </div>

      {showDeckSelect && activeDeckId && (
        <Select value={activeDeckId} onValueChange={onDeckChange}>
          <SelectTrigger className="h-8 w-[min(200px,40vw)] text-xs">
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
        <Button size="sm" variant="secondary" className="h-8 gap-1 px-2" onClick={onPrevious} disabled={totalSlides === 0}>
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <Button size="sm" variant="secondary" className="h-8 gap-1 px-2" onClick={onNext} disabled={totalSlides === 0}>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-8 gap-1 px-2" onClick={onFullscreen} disabled={totalSlides === 0} title="Fullscreen presentation">
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Fullscreen</span>
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={onExit} title="Exit presentation view">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
