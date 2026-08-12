import type { DiagramData, PresentationDeck } from '@/lib/types';
import { safeClone } from '@/lib/diagram-editor/editor-support';

/** Full presentation + primary diagram restore point for structural slide ops (delete/add/reorder). */
export interface PresentationRestorePoint {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId: string | null;
  selectedSlideIds: string[];
  draftDiagram: DiagramData | null;
  masterDiagram: DiagramData | null;
  /** Always the tab/primary diagram — never a non-primary slide draft. */
  tabDiagramData: DiagramData;
}

export function capturePresentationRestorePoint(args: {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId: string | null;
  selectedSlideIds: Iterable<string>;
  draftDiagram: DiagramData | null;
  masterDiagram: DiagramData | null;
  tabDiagramData: DiagramData;
}): PresentationRestorePoint {
  return {
    decks: safeClone(args.decks),
    activeDeckId: args.activeDeckId,
    activeSlideId: args.activeSlideId,
    selectedSlideIds: Array.from(args.selectedSlideIds),
    draftDiagram: args.draftDiagram ? safeClone(args.draftDiagram) : null,
    masterDiagram: args.masterDiagram ? safeClone(args.masterDiagram) : null,
    tabDiagramData: safeClone(args.tabDiagramData),
  };
}
