/** Client-side maintenance API URL (set in `.env.local` as NEXT_PUBLIC_MAINTENANCE_API_URL). */
export function getMaintenanceApiUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MAINTENANCE_API_URL?.trim();
  return raw || null;
}

export function isMaintenanceConfigured(): boolean {
  return Boolean(getMaintenanceApiUrl());
}

export const MAINTENANCE_TOKEN_KEY = 'dw:maintenance-token';
