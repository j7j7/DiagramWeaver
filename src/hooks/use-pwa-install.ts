'use client';

import { useCallback, useEffect, useState } from 'react';
import { isPwaSecureContext, isPwaStandalone, shouldShowPwaInstallMenu } from '@/lib/pwa';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export function usePwaInstall() {
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setInstalled(isPwaStandalone());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    const standaloneMq = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => setInstalled(isPwaStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    standaloneMq.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      standaloneMq.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setInstalled(true);
    }
    return outcome;
  }, [deferredPrompt]);

  return {
    installed,
    canNativeInstall: deferredPrompt != null,
    isSecureContext: isPwaSecureContext(),
    showInstallMenuItem: !installed && shouldShowPwaInstallMenu(),
    promptInstall,
  };
}
