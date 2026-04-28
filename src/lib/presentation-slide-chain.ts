import type { DiagramData, PresentationDeck, Slide } from '@/lib/types';
import { applyDiagramDelta, computeDiagramDelta, projectVisibleDiagram } from '@/lib/presentation-delta';

export type PresentationDeltaMode = 'master' | 'chain';

export function getPresentationDeltaMode(deck: PresentationDeck): PresentationDeltaMode {
  return deck.presentationDeltaMode ?? 'master';
}

/** Resolve one diagram per slide (same order as `slides`). */
export function resolvePresentationSlideDiagrams(
  masterBase: DiagramData,
  slides: Slide[],
  mode: PresentationDeltaMode,
): DiagramData[] {
  if (slides.length === 0) return [];
  if (mode === 'master') {
    return slides.map((s) => applyDiagramDelta(masterBase, s.diagramDelta));
  }
  const out: DiagramData[] = [];
  let cur = masterBase;
  for (let i = 0; i < slides.length; i += 1) {
    cur = applyDiagramDelta(cur, slides[i].diagramDelta);
    out.push(cur);
  }
  return out;
}

/**
 * After slide reorder/delete, recomputes each slide's delta from sequential base so `absoluteDiagrams[i]`
 * is preserved (visible projection used for `computeDiagramDelta` like the rest of the app).
 */
export function rechainSlideDeltasFromAbsoluteDiagrams(
  masterBase: DiagramData,
  slides: Slide[],
  absoluteDiagrams: DiagramData[],
): Slide[] {
  if (slides.length !== absoluteDiagrams.length) {
    throw new Error('rechainSlideDeltasFromAbsoluteDiagrams: slides and absolutes length mismatch');
  }
  let cur = masterBase;
  return slides.map((slide, i) => {
    const visTarget = projectVisibleDiagram(absoluteDiagrams[i]);
    const d = computeDiagramDelta(projectVisibleDiagram(cur), visTarget);
    cur = applyDiagramDelta(cur, d);
    return { ...slide, diagramDelta: d };
  });
}

/**
 * Diagram after applying slides[0..throughInclusive], using optional draft override when the slide at `throughInclusive`
 * matches `activeSlideId` (handles live editing on that slide index).
 */
export function cumulativeDiagramThroughSlideIndex(
  masterBase: DiagramData,
  slides: Slide[],
  throughInclusive: number,
  opts?: { activeSlideId?: string | null; draftDiagram?: DiagramData | null },
): DiagramData {
  if (slides.length === 0) return masterBase;
  const cap = Math.max(0, Math.min(throughInclusive, slides.length - 1));

  let cur = applyDiagramDelta(masterBase, slides[0].diagramDelta);
  if (opts?.activeSlideId && slides[0]?.id === opts.activeSlideId && opts.draftDiagram) {
    cur = opts.draftDiagram;
  }
  if (cap === 0) return cur;

  for (let i = 1; i <= cap; i += 1) {
    if (opts?.activeSlideId && slides[i]?.id === opts.activeSlideId && opts.draftDiagram) {
      cur = opts.draftDiagram;
    } else {
      cur = applyDiagramDelta(cur, slides[i].diagramDelta);
    }
  }
  return cur;
}

/** When the tab master changes on the primary slide: rebase all non-primary slides to preserve absolutes. */
export function rebasePresentationSlidesOnMasterEdit(
  oldMasterVisible: DiagramData,
  newMasterVisible: DiagramData,
  slides: Slide[],
  mode: PresentationDeltaMode,
): Slide[] {
  if (slides.length === 0) return slides;
  if (mode === 'master') {
    return slides.map((slide, si) => {
      if (si === 0) return slide;
      const full = applyDiagramDelta(oldMasterVisible, slide.diagramDelta);
      const nextDelta = computeDiagramDelta(newMasterVisible, projectVisibleDiagram(full));
      return { ...slide, diagramDelta: nextDelta };
    });
  }

  let curOld = oldMasterVisible;
  const absolutes: DiagramData[] = [];
  for (const slide of slides) {
    curOld = applyDiagramDelta(curOld, slide.diagramDelta);
    absolutes.push(curOld);
  }

  const newSlides: Slide[] = [];
  let curNew = applyDiagramDelta(newMasterVisible, slides[0].diagramDelta);
  newSlides.push(slides[0]);

  for (let i = 1; i < slides.length; i += 1) {
    const d = computeDiagramDelta(projectVisibleDiagram(curNew), projectVisibleDiagram(absolutes[i]));
    curNew = applyDiagramDelta(curNew, d);
    newSlides.push({ ...slides[i], diagramDelta: d });
  }
  return newSlides;
}

/** Convert legacy master-relative slides to chained deltas; no-op if already `chain`. */
export function migratePresentationDeckToChain(deck: PresentationDeck, masterBase: DiagramData): PresentationDeck {
  if (deck.presentationDeltaMode === 'chain') return deck;
  if (deck.slides.length === 0) {
    return { ...deck, presentationDeltaMode: 'chain', updatedAt: Date.now() };
  }

  const absolutes = resolvePresentationSlideDiagrams(masterBase, deck.slides, 'master');
  const newSlides = rechainSlideDeltasFromAbsoluteDiagrams(masterBase, deck.slides, absolutes);

  return {
    ...deck,
    slides: newSlides,
    presentationDeltaMode: 'chain',
    updatedAt: Date.now(),
  };
}
