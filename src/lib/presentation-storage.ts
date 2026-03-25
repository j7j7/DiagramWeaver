import type { DiagramData, PresentationDeck } from '@/lib/types';
import { PresentationDeckListSchema } from '@/lib/schemas';

const DB_NAME = 'DiagramWeaver';
const DB_VERSION = 1;
const STORE_NAME = 'tabs';

const LEGACY_DB_NAME = 'DiagramWeaverPresentations';
const LEGACY_STORE_NAME = 'presentation-decks';

const DECKS_KEY = 'presentation:decks';
const ACTIVE_DECK_KEY = 'presentation:activeDeckId';

const LS_DECKS_KEY = 'dw:presentation:decks';
const LS_ACTIVE_KEY = 'dw:presentation:activeDeckId';

const ALL_TABS_KEY = 'presentation:decks-by-tab';
const LS_DECKS_BY_TAB_KEY = 'dw:presentation:decks-by-tab';

const LEGACY_DECKS_KEY = 'decks';
const LEGACY_ACTIVE_DECK_KEY = 'activeDeckId';
const LEGACY_ALL_TABS_KEY = 'decks-by-tab';

export type PerTabPresentationData = Record<string, {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  activeSlideId?: string | null;
}>;

export interface StoredPresentationPayload {
  decks: PresentationDeck[];
  activeDeckId: string | null;
  baseDiagram?: DiagramData;
}

function openDb(dbName: string = DB_NAME, storeName: string = STORE_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
  });
}

async function readPresentationPayloadFromDb(
  dbName: string,
  storeName: string,
  decksKey: string,
  activeDeckKey: string,
): Promise<StoredPresentationPayload | null> {
  const db = await openDb(dbName, storeName);
  try {
    const [decksRaw, activeDeckId] = await new Promise<[unknown, string | null | undefined]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const reqDecks = store.get(decksKey);
      const reqActive = store.get(activeDeckKey);
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

async function readPresentationTabsFromDb(
  dbName: string,
  storeName: string,
  allTabsKey: string,
): Promise<PerTabPresentationData | null> {
  const db = await openDb(dbName, storeName);
  try {
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(allTabsKey);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!raw || typeof raw !== 'object') return null;

    const result: PerTabPresentationData = {};
    for (const [tabId, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const { decks, activeDeckId, activeSlideId } = entry as { decks?: unknown; activeDeckId?: unknown; activeSlideId?: unknown };
      const normalised = normalizeDecks(decks);
      if (normalised.length > 0) {
        result[tabId] = {
          decks: normalised,
          activeDeckId: typeof activeDeckId === 'string' ? activeDeckId : null,
          activeSlideId: typeof activeSlideId === 'string' ? activeSlideId : null,
        };
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } finally {
    db.close();
  }
}

function normalizeDecks(raw: unknown): PresentationDeck[] {
  const parsed = PresentationDeckListSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data;
}

export async function loadPresentationsFromIndexedDB(): Promise<StoredPresentationPayload | null> {
  try {
    const currentPayload = await readPresentationPayloadFromDb(DB_NAME, STORE_NAME, DECKS_KEY, ACTIVE_DECK_KEY);
    if (currentPayload) return currentPayload;
  } catch {
    // Fall through to legacy storage.
  }

  try {
    const legacyPayload = await readPresentationPayloadFromDb(
      LEGACY_DB_NAME,
      LEGACY_STORE_NAME,
      LEGACY_DECKS_KEY,
      LEGACY_ACTIVE_DECK_KEY,
    );
    if (legacyPayload) {
      await savePresentationsToIndexedDB(legacyPayload);
      return legacyPayload;
    }
  } catch {
    // Ignore legacy storage failures.
  }

  return null;
}

export async function savePresentationsToIndexedDB(payload: StoredPresentationPayload): Promise<void> {
  const db = await openDb(DB_NAME, STORE_NAME);
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

// ---- per-tab persistence ------------------------------------------------

export async function savePresentationsByTab(data: PerTabPresentationData): Promise<void> {
  try {
    const db = await openDb(DB_NAME, STORE_NAME);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(data, ALL_TABS_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // IndexedDB unavailable – fall back to localStorage
    try {
      localStorage.setItem(LS_DECKS_BY_TAB_KEY, JSON.stringify(data));
    } catch {
      // ignore storage failures
    }
  }
}

export async function loadPresentationsByTab(): Promise<PerTabPresentationData | null> {
  try {
    const current = await readPresentationTabsFromDb(DB_NAME, STORE_NAME, ALL_TABS_KEY);
    if (current) return current;
  } catch {
    // Fall through to legacy storage.
  }

  try {
    const legacy = await readPresentationTabsFromDb(LEGACY_DB_NAME, LEGACY_STORE_NAME, LEGACY_ALL_TABS_KEY);
    if (legacy) {
      await savePresentationsByTab(legacy);
      return legacy;
    }
  } catch {
    // Ignore legacy storage failures.
  }

  // IndexedDB unavailable – fall back to localStorage
  try {
    const raw = localStorage.getItem(LS_DECKS_BY_TAB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: PerTabPresentationData = {};
    for (const [tabId, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') continue;
      const { decks, activeDeckId, activeSlideId } = entry as { decks?: unknown; activeDeckId?: unknown; activeSlideId?: unknown };
      const normalised = normalizeDecks(decks);
      if (normalised.length > 0) {
        result[tabId] = {
          decks: normalised,
          activeDeckId: typeof activeDeckId === 'string' ? activeDeckId : null,
          activeSlideId: typeof activeSlideId === 'string' ? activeSlideId : null,
        };
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
