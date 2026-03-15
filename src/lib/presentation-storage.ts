import type { DiagramData, PresentationDeck } from '@/lib/types';
import { parseDiagramJson, PresentationDeckListSchema } from '@/lib/schemas';

const DB_NAME = 'DiagramWeaverPresentations';
const DB_VERSION = 1;
const STORE_NAME = 'presentation-decks';
const DECKS_KEY = 'decks';
const ACTIVE_DECK_KEY = 'activeDeckId';

const LS_DECKS_KEY = 'dw:presentation:decks';
const LS_ACTIVE_KEY = 'dw:presentation:activeDeckId';

export interface StoredPresentationPayload {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  baseDiagram?: DiagramData;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function normalizeDecks(raw: unknown): PresentationDeck[] {
  const parsed = PresentationDeckListSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data;
}

function stripSnapshotImages(decks: PresentationDeck[]): PresentationDeck[] {
  return decks.map((deck) => ({
    ...deck,
    slides: deck.slides.map((slide) => {
      const { snapshotImage: _snapshotImage, ...rest } = slide;
      return rest;
    }),
  }));
}

export async function loadPresentationsFromIndexedDB(): Promise<StoredPresentationPayload | null> {
  const db = await openDb();
  try {
    const [decksRaw, activeDeckId] = await new Promise<[unknown, string | null | undefined]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const reqDecks = store.get(DECKS_KEY);
      const reqActive = store.get(ACTIVE_DECK_KEY);
      let count = 0;
      const check = () => {
        if (++count === 2) resolve([reqDecks.result, reqActive.result ?? null]);
      };
      reqDecks.onsuccess = reqActive.onsuccess = check;
      tx.onerror = () => reject(tx.error);
    });

    const decks = normalizeDecks(decksRaw);
    if (decks.length === 0) return null;
    return { decks, activeDeckId: activeDeckId ?? null };
  } finally {
    db.close();
  }
}

export async function savePresentationsToIndexedDB(payload: StoredPresentationPayload): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload.decks, DECKS_KEY);
      store.put(payload.activeDeckId, ACTIVE_DECK_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function loadPresentationsFromLocalStorage(): StoredPresentationPayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const decksRaw = localStorage.getItem(LS_DECKS_KEY);
    const activeDeckId = localStorage.getItem(LS_ACTIVE_KEY);
    if (!decksRaw) return null;
    const decks = normalizeDecks(JSON.parse(decksRaw));
    if (decks.length === 0) return null;
    return { decks, activeDeckId: activeDeckId ?? null };
  } catch {
    return null;
  }
}

export function savePresentationsToLocalStorage(payload: StoredPresentationPayload): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_DECKS_KEY, JSON.stringify(payload.decks));
    localStorage.setItem(LS_ACTIVE_KEY, payload.activeDeckId ?? '');
  } catch {
    // Ignore storage failures.
  }
}

export function clearPresentationsFromLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LS_DECKS_KEY);
    localStorage.removeItem(LS_ACTIVE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function exportPresentationsToJson(payload: StoredPresentationPayload): string {
  const exportDecks = stripSnapshotImages(payload.decks);
  return JSON.stringify({
    version: '1.0',
    exportedAt: Date.now(),
    ...payload,
    decks: exportDecks,
  });
}

export function importPresentationsFromJson(jsonText: string): StoredPresentationPayload {
  const parsed = JSON.parse(jsonText) as {
    decks?: unknown;
    activeDeckId?: string | null;
    baseDiagram?: unknown;
  };
  const decks = normalizeDecks(parsed.decks ?? []);
  const baseDiagram = parsed.baseDiagram ? parseDiagramJson(parsed.baseDiagram) : undefined;
  return {
    decks,
    activeDeckId: parsed.activeDeckId ?? (decks[0]?.id ?? null),
    baseDiagram,
  };
}
