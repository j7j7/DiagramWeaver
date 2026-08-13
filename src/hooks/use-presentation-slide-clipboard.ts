'use client';

import { useEffect, useState } from 'react';
import {
  peekPresentationSlideClipboard,
  SLIDE_CLIPBOARD_CHANGED_EVENT,
  SLIDE_CLIPBOARD_STORAGE_KEY,
} from '@/lib/presentation-slide-clipboard';

/** True when a copied slide is available (same window, localStorage, or last write). */
export function usePresentationSlideClipboardAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = peekPresentationSlideClipboard() != null;
      setAvailable((prev) => (prev === next ? prev : next));
    };
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === SLIDE_CLIPBOARD_STORAGE_KEY || event.key === null) sync();
    };
    window.addEventListener(SLIDE_CLIPBOARD_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(SLIDE_CLIPBOARD_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return available;
}
