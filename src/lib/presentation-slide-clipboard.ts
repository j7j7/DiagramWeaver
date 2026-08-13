import type {
  DiagramData,
  DiagramDelta,
  PresentationDeck,
  Slide,
  SlideAnimationState,
} from '@/lib/types';
import { parseDiagramJsonSync } from '@/lib/diagram-json-import';
import { applyDiagramDelta, computeDiagramDelta } from '@/lib/presentation-delta';
import {
  getPresentationDeltaMode,
  rechainSlideDeltasFromAbsoluteDiagrams,
  resolvePresentationSlideDiagrams,
} from '@/lib/presentation-slide-chain';
import { safeClone } from '@/lib/diagram-editor/editor-support';

export const SLIDE_CLIPBOARD_KIND = 'diagramweaver/slide';
export const SLIDE_CLIPBOARD_VERSION = 1;
export const SLIDE_CLIPBOARD_STORAGE_KEY = 'dw:clipboard:slide';
export const SLIDE_CLIPBOARD_CHANGED_EVENT = 'dw:slide-clipboard-changed';

export interface PresentationSlideClipboardMeta {
  title?: string;
  description?: string;
  animationState?: SlideAnimationState;
  autoZoomLevel?: number;
  viewPanX?: number;
  viewPanY?: number;
  visibleLayerIds?: string[];
  snapshotImage?: string;
}

export interface PresentationSlideClipboardPayload {
  kind: typeof SLIDE_CLIPBOARD_KIND;
  version: typeof SLIDE_CLIPBOARD_VERSION;
  copiedAt: number;
  diagram: DiagramData;
  slide: PresentationSlideClipboardMeta;
}

let memoryPayload: PresentationSlideClipboardPayload | null = null;

function notifySlideClipboardChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SLIDE_CLIPBOARD_CHANGED_EVENT));
}

function parseSlideMeta(raw: unknown): PresentationSlideClipboardMeta {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const meta: PresentationSlideClipboardMeta = {};
  if (typeof o.title === 'string') meta.title = o.title;
  if (typeof o.description === 'string') meta.description = o.description;
  if (typeof o.autoZoomLevel === 'number' && Number.isFinite(o.autoZoomLevel) && o.autoZoomLevel > 0) {
    meta.autoZoomLevel = o.autoZoomLevel;
  }
  if (typeof o.viewPanX === 'number' && Number.isFinite(o.viewPanX)) meta.viewPanX = o.viewPanX;
  if (typeof o.viewPanY === 'number' && Number.isFinite(o.viewPanY)) meta.viewPanY = o.viewPanY;
  if (Array.isArray(o.visibleLayerIds) && o.visibleLayerIds.every((id) => typeof id === 'string')) {
    meta.visibleLayerIds = o.visibleLayerIds as string[];
  }
  if (typeof o.snapshotImage === 'string' && o.snapshotImage.length > 0) {
    meta.snapshotImage = o.snapshotImage;
  }
  if (o.animationState && typeof o.animationState === 'object') {
    const anim = o.animationState as Record<string, unknown>;
    const animationState: SlideAnimationState = {
      enabled: anim.enabled === true,
    };
    if (Array.isArray(anim.filterSourceIds) && anim.filterSourceIds.every((id) => typeof id === 'string')) {
      animationState.filterSourceIds = anim.filterSourceIds as string[];
    }
    if (Array.isArray(anim.disabledSourceIds) && anim.disabledSourceIds.every((id) => typeof id === 'string')) {
      animationState.disabledSourceIds = anim.disabledSourceIds as string[];
    }
    meta.animationState = animationState;
  }
  return meta;
}

export function parsePresentationSlideClipboardPayload(
  raw: unknown,
): PresentationSlideClipboardPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== SLIDE_CLIPBOARD_KIND) return null;
  if (o.version !== SLIDE_CLIPBOARD_VERSION) return null;
  if (!o.diagram || typeof o.diagram !== 'object') return null;
  let diagram: DiagramData;
  try {
    diagram = parseDiagramJsonSync(o.diagram);
  } catch {
    return null;
  }
  const copiedAt = typeof o.copiedAt === 'number' && Number.isFinite(o.copiedAt) ? o.copiedAt : Date.now();
  return {
    kind: SLIDE_CLIPBOARD_KIND,
    version: SLIDE_CLIPBOARD_VERSION,
    copiedAt,
    diagram,
    slide: parseSlideMeta(o.slide),
  };
}

function readFromLocalStorage(): PresentationSlideClipboardPayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SLIDE_CLIPBOARD_STORAGE_KEY);
    if (!raw) return null;
    return parsePresentationSlideClipboardPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeToLocalStorage(payload: PresentationSlideClipboardPayload): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SLIDE_CLIPBOARD_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    try {
      const slim: PresentationSlideClipboardPayload = {
        ...payload,
        slide: { ...payload.slide, snapshotImage: undefined },
      };
      localStorage.setItem(SLIDE_CLIPBOARD_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      /* quota / private mode */
    }
  }
}

export function createPresentationSlideClipboardPayload(args: {
  diagram: DiagramData;
  slide: PresentationSlideClipboardMeta;
}): PresentationSlideClipboardPayload {
  return {
    kind: SLIDE_CLIPBOARD_KIND,
    version: SLIDE_CLIPBOARD_VERSION,
    copiedAt: Date.now(),
    diagram: safeClone(args.diagram),
    slide: { ...args.slide },
  };
}

export async function writePresentationSlideClipboard(
  payload: PresentationSlideClipboardPayload,
): Promise<void> {
  memoryPayload = payload;
  writeToLocalStorage(payload);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(JSON.stringify(payload));
    }
  } catch {
    /* localStorage / memory still hold the slide */
  }
  notifySlideClipboardChanged();
}

export function peekPresentationSlideClipboard(): PresentationSlideClipboardPayload | null {
  if (memoryPayload) return memoryPayload;
  return readFromLocalStorage();
}

export async function readPresentationSlideClipboard(): Promise<PresentationSlideClipboardPayload | null> {
  if (memoryPayload) return memoryPayload;
  const fromLs = readFromLocalStorage();
  if (fromLs) {
    memoryPayload = fromLs;
    return fromLs;
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      const parsed = parsePresentationSlideClipboardPayload(JSON.parse(text));
      if (parsed) {
        memoryPayload = parsed;
        return parsed;
      }
    }
  } catch {
    /* permission denied or not JSON */
  }
  return null;
}

function newSlideId(now: number): string {
  return `slide-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

function deltaFromAbsolute(master: DiagramData, absolute: DiagramData): DiagramDelta {
  try {
    const diagramDelta = computeDiagramDelta(master, absolute);
    applyDiagramDelta(master, diagramDelta);
    return diagramDelta;
  } catch {
    return {
      version: '1.0',
      compressed: true,
      operations: [{ op: 'replace', path: '', value: safeClone(absolute) }],
    };
  }
}

/**
 * Insert a copied slide (absolute diagram) after `afterSlideId`.
 * Never replaces the primary (slide 1). Master-mode later slides keep their deltas;
 * chain-mode decks are rechained so later slides keep their previous absolutes.
 */
export function insertAbsoluteSlideIntoDeck(args: {
  deck: PresentationDeck;
  master: DiagramData;
  absoluteDiagram: DiagramData;
  meta: PresentationSlideClipboardMeta;
  afterSlideId: string | null;
  now?: number;
}): { deck: PresentationDeck; newSlideId: string; insertedIndex: number } {
  const now = args.now ?? Date.now();
  const slideId = newSlideId(now);
  const currentIdx = args.afterSlideId
    ? args.deck.slides.findIndex((s) => s.id === args.afterSlideId)
    : -1;
  const insertAt = currentIdx >= 0 ? currentIdx + 1 : args.deck.slides.length;
  const title = args.meta.title?.trim() || `Slide ${args.deck.slides.length + 1}`;

  const newSlide: Slide = {
    id: slideId,
    diagramDelta: { version: '1.0', operations: [], compressed: true },
    title,
    description: args.meta.description,
    animationState: args.meta.animationState,
    autoZoomLevel: args.meta.autoZoomLevel,
    viewPanX: args.meta.viewPanX,
    viewPanY: args.meta.viewPanY,
    visibleLayerIds: args.meta.visibleLayerIds,
    snapshotImage: args.meta.snapshotImage,
    createdAt: now,
  };

  const nextSlideObjs = [
    ...args.deck.slides.slice(0, insertAt),
    newSlide,
    ...args.deck.slides.slice(insertAt),
  ];

  const mode = getPresentationDeltaMode(args.deck);
  let slides: Slide[];
  if (mode === 'chain') {
    const resolved = resolvePresentationSlideDiagrams(args.master, args.deck.slides, 'chain');
    const nextAbs = [
      ...resolved.slice(0, insertAt),
      args.absoluteDiagram,
      ...resolved.slice(insertAt),
    ];
    slides = rechainSlideDeltasFromAbsoluteDiagrams(args.master, nextSlideObjs, nextAbs);
  } else {
    const diagramDelta = deltaFromAbsolute(args.master, args.absoluteDiagram);
    slides = nextSlideObjs.map((slide, i) => (i === insertAt ? { ...slide, diagramDelta } : slide));
  }

  return {
    deck: {
      ...args.deck,
      slides,
      presentationDeltaMode: args.deck.presentationDeltaMode ?? 'master',
      updatedAt: now,
    },
    newSlideId: slideId,
    insertedIndex: insertAt,
  };
}

/** Absolute diagram for the active slide (live draft if that slide is being edited). */
export function resolveActiveSlideAbsoluteDiagram(args: {
  deck: PresentationDeck;
  master: DiagramData;
  tabDiagramData: DiagramData;
  activeSlideId: string | null;
  draftDiagram: DiagramData | null;
}): DiagramData {
  const slides = args.deck.slides;
  if (slides.length === 0) return args.tabDiagramData;
  const idx = args.activeSlideId ? slides.findIndex((s) => s.id === args.activeSlideId) : 0;
  const slide = slides[idx] ?? slides[0];
  if (args.draftDiagram && slide.id === args.activeSlideId) {
    return args.draftDiagram;
  }
  if (idx <= 0) return args.tabDiagramData;
  const resolved = resolvePresentationSlideDiagrams(
    args.master,
    slides,
    getPresentationDeltaMode(args.deck),
  );
  return resolved[idx] ?? args.tabDiagramData;
}
