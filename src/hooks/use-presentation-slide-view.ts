'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { DiagramData, Slide } from '@/lib/types';
import { useSlideTransition } from '@/hooks/use-slide-transition';
import { pruneConnectionsToVisibleNodes } from '@/lib/presentation-viewport-fit';

export function usePresentationSlideView(options: {
  enabled: boolean;
  slides: Slide[];
  slideDiagrams: DiagramData[] | undefined;
  slideIndex: number;
}) {
  const { enabled, slides, slideDiagrams, slideIndex } = options;
  const totalSlides = slides.length;
  const safeIndex = Math.min(Math.max(slideIndex, 0), Math.max(totalSlides - 1, 0));
  const currentSlide = slides[safeIndex] ?? null;
  const currentSlideDiagram = slideDiagrams?.[safeIndex] ?? null;

  const renderedDiagram = useMemo(() => {
    if (!currentSlideDiagram) return null;
    return pruneConnectionsToVisibleNodes(currentSlideDiagram);
  }, [currentSlideDiagram]);

  const [previousSlideIndex, setPreviousSlideIndex] = useState(safeIndex);
  const [previousDiagram, setPreviousDiagram] = useState<DiagramData | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPreviousDiagram(null);
      setPreviousSlideIndex(slideIndex);
    }
  }, [enabled, slideIndex]);

  const slideTransition = useSlideTransition({
    enabled: enabled && safeIndex !== previousSlideIndex,
    currentDiagram: renderedDiagram,
    previousDiagram: previousDiagram,
  });

  // Layout effect: apply slide transition styles (incl. connection endpoint offsets) before paint
  // so connections never flash one frame at the target geometry.
  useLayoutEffect(() => {
    if (!enabled || !renderedDiagram) return;
    if (previousSlideIndex !== safeIndex && previousDiagram !== null) {
      slideTransition.startTransition();
    }
  }, [enabled, safeIndex, previousSlideIndex, previousDiagram, renderedDiagram, slideTransition]);

  useEffect(() => {
    if (!enabled || !renderedDiagram) return;
    setPreviousDiagram(renderedDiagram);
    setPreviousSlideIndex(safeIndex);
  }, [safeIndex, renderedDiagram, enabled]);

  return {
    safeIndex,
    currentSlide,
    renderedDiagram,
    diagramDataForCanvas: slideTransition.animatingDiagramData || renderedDiagram,
    nodeTransitionStyles: slideTransition.nodeTransitionStyles,
    connectionTransitionStyles: slideTransition.connectionTransitionStyles,
    totalSlides,
  };
}
