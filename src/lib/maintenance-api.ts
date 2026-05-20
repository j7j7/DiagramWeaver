import { getMaintenanceApiUrl } from '@/lib/maintenance-config';

export interface MaintenanceAuthResult {
  ok: boolean;
  token?: string;
  expiresIn?: number;
  error?: string;
}

export interface MaintenanceIconItem {
  name: string;
  fileName: string;
  resourceType: string;
  publicPath: string;
}

export interface GenerateIconResult {
  ok: boolean;
  name?: string;
  fileName?: string;
  resourceType?: string;
  publicPath?: string;
  svg?: string;
  attempt?: number;
  error?: string;
}

export interface MaintenanceHealthResult {
  ok: boolean;
  ollamaUrl?: string;
  model?: string;
  passwordConfigured?: boolean;
  error?: string;
}

export interface ListIconsResult {
  ok: boolean;
  icons?: MaintenanceIconItem[];
  error?: string;
}

async function maintenanceFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getMaintenanceApiUrl();
  if (!base) {
    throw new Error(
      'Maintenance API is not configured. Set NEXT_PUBLIC_MAINTENANCE_API_URL in .env.local and run npm run maintenance:server.',
    );
  }
  const url = `${base.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function checkMaintenanceHealth(): Promise<MaintenanceHealthResult> {
  return maintenanceFetch<MaintenanceHealthResult>('/api/maintenance/health');
}

export async function authenticateMaintenance(
  password: string,
): Promise<MaintenanceAuthResult> {
  return maintenanceFetch<MaintenanceAuthResult>('/api/maintenance/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export async function listMaintenanceIcons(token: string): Promise<ListIconsResult> {
  return maintenanceFetch<ListIconsResult>('/api/maintenance/icons', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteMaintenanceIcon(
  token: string,
  fileName: string,
): Promise<{ ok: boolean; fileName?: string; error?: string }> {
  return maintenanceFetch('/api/maintenance/icons', {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ fileName }),
  });
}

export async function generateMaintenanceIcon(
  token: string,
  payload: {
    name: string;
    description: string;
    attempt?: number;
    replace?: boolean;
    replaceFileName?: string;
  },
): Promise<GenerateIconResult> {
  return maintenanceFetch<GenerateIconResult>('/api/maintenance/generate-icon', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function confirmMaintenanceIcon(
  token: string,
  payload: {
    name: string;
    svg: string;
    replace?: boolean;
    replaceFileName?: string;
  },
): Promise<GenerateIconResult> {
  return maintenanceFetch<GenerateIconResult>('/api/maintenance/confirm-icon', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}
