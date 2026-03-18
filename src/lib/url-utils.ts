export function normalizeExternalUrl(value: string | undefined | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function openExternalUrlInNewTab(value: string | undefined | null): boolean {
  const normalized = normalizeExternalUrl(value);
  if (!normalized || typeof window === "undefined" || typeof document === "undefined") return false;

  // Use a single anchor-click navigation path to avoid browser-specific double-open behavior.
  const anchor = document.createElement("a");
  anchor.href = normalized;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
}