/** PWA install helpers (client-only). */

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  );
}

export function isPwaSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext;
}

/** iOS Safari / iPadOS (no `beforeinstallprompt`). */
export function isIosSafariInstallHint(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOsSafari =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return (isAppleMobile || isIpadOsSafari) && !isPwaStandalone();
}

/** macOS Safari (Add to Dock). */
export function isMacSafariInstallHint(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /Macintosh/.test(ua) &&
    /Safari/.test(ua) &&
    !/Chrome|Chromium|Edg|Firefox/.test(ua) &&
    !isPwaStandalone()
  );
}

export function shouldShowPwaInstallMenu(): boolean {
  if (typeof window === 'undefined') return false;
  if (isPwaStandalone()) return false;
  return isPwaSecureContext();
}
