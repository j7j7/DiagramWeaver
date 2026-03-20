'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DiagramData, Slide } from '@/lib/types';
import { useSlideTransition } from '@/hooks/use-slide-transition';

function pruneConnectionsToVisibleNodes(diagram: DiagramData): DiagramData {
  const visibleNodeIds = new Set((diagram.nodes ?? []).map((node) => node.id));
  return {
    ...diagram,
    connections: (diagram.connections ?? []).filter(
      (conn) => visibleNodeIds.has(conn.from) && visibleNodeIds.has(conn.to)
    ),
  };
}

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

  useEffect(() => {
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
