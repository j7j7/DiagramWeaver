/**
 * Help → Icon maintenance (beta). Off by default for static production builds.
 * Enable in local dev only: `NEXT_PUBLIC_MAINTENANCE_MENU_ENABLED=true` in `.env.local`.
 * The maintenance API (`npm run maintenance:server`) is separate from `next build` / `out/`.
 */
export const ICON_MAINTENANCE_MENU_ENABLED =
  process.env.NEXT_PUBLIC_MAINTENANCE_MENU_ENABLED === 'true';

/** Client-side maintenance API URL (dev only — set in `.env.local`). */
export function getMaintenanceApiUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MAINTENANCE_API_URL?.trim();
  return raw || null;
}

export function isMaintenanceConfigured(): boolean {
  return Boolean(getMaintenanceApiUrl());
}

export const MAINTENANCE_TOKEN_KEY = 'dw:maintenance-token';
