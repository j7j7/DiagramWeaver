/**
 * IndexedDB-backed storage for diagram tabs.
 * Replaces localStorage for tab persistence to avoid quota limits (~5–10MB).
 * IndexedDB typically has a much larger quota (hundreds of MB).
 */

const DB_NAME = 'DiagramWeaver';
const DB_VERSION = 1;
const STORE_NAME = 'tabs';
const TABS_KEY = 'tabs';
const ACTIVE_TAB_KEY = 'activeTabId';

const LS_TABS_KEY = 'dw:tabs';
const LS_ACTIVE_KEY = 'dw:activeTabId';

export interface StoredTabPayload {
  tabs: unknown[];
  activeTabId: string | null;
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

export async function loadTabsFromIndexedDB(): Promise<StoredTabPayload | null> {
  const db = await openDb();
  try {
    const [tabs, activeTabId] = await new Promise<
      [unknown[] | undefined, string | null | undefined]
    >((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const reqTabs = store.get(TABS_KEY);
      const reqActive = store.get(ACTIVE_TAB_KEY);
      let count = 0;
      const check = () => {
        if (++count === 2) resolve([reqTabs.result, reqActive.result ?? null]);
      };
      reqTabs.onsuccess = reqActive.onsuccess = check;
      tx.onerror = () => reject(tx.error);
    });
    if (tabs && Array.isArray(tabs) && tabs.length > 0) {
      return { tabs, activeTabId: activeTabId ?? null };
    }
    return null;
  } finally {
    db.close();
  }
}

export async function saveTabsToIndexedDB(
  payload: StoredTabPayload
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload.tabs, TABS_KEY);
      store.put(payload.activeTabId, ACTIVE_TAB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Load from legacy localStorage and clear it after successful migration. */
export function loadTabsFromLocalStorage(): StoredTabPayload | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const savedTabs = localStorage.getItem(LS_TABS_KEY);
    const savedActiveTabId = localStorage.getItem(LS_ACTIVE_KEY);
    if (!savedTabs) return null;
    const tabs = JSON.parse(savedTabs);
    if (!Array.isArray(tabs) || tabs.length === 0) return null;
    return {
      tabs,
      activeTabId: savedActiveTabId || null,
    };
  } catch {
    return null;
  }
}

/** Remove tab data from localStorage after migration to IndexedDB. */
export function clearTabsFromLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LS_TABS_KEY);
    localStorage.removeItem(LS_ACTIVE_KEY);
  } catch {
    // Ignore
  }
}

/** Save to localStorage (fallback when IndexedDB unavailable). */
export function saveTabsToLocalStorage(payload: StoredTabPayload): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_TABS_KEY, JSON.stringify(payload.tabs));
    localStorage.setItem(LS_ACTIVE_KEY, payload.activeTabId ?? '');
  } catch {
    // Ignore
  }
}
