import type { DiagramData, HierarchicalDiagramData } from './types';
import { DiagramDataSchema, HierarchicalDiagramDataSchema } from './schemas';
import { convertFromNestedHierarchy } from './nested-hierarchy';

const MAX_JSON_SIZE = 5 * 1024 * 1024; // 5MB limit

export interface ViewerParams {
  json?: string; // Base64-encoded JSON
  url?: string; // URL to fetch JSON from
}

export interface ViewerData {
  diagramData: DiagramData;
  source: 'inline' | 'remote';
}

/**
 * Parse and validate viewer URL parameters
 */
export function parseViewerParams(searchParams: URLSearchParams): ViewerParams {
  const json = searchParams.get('json');
  const url = searchParams.get('url');

  if (!json && !url) {
    throw new Error('Missing required parameter: either "json" or "url" must be provided');
  }

  if (json && url) {
    throw new Error('Cannot specify both "json" and "url" parameters');
  }

  return { json: json || undefined, url: url || undefined };
}

/**
 * Decode base64-encoded JSON parameter
 */
export function decodeJsonParam(encoded: string): unknown {
  try {
    // Handle URL-safe base64 encoding
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    
    // Check size limit
    if (decoded.length > MAX_JSON_SIZE) {
      throw new Error(`JSON size exceeds maximum limit of ${MAX_JSON_SIZE / 1024 / 1024}MB`);
    }

    return JSON.parse(decoded);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to decode JSON parameter: ${error.message}`);
    }
    throw new Error('Failed to decode JSON parameter: Invalid base64 encoding');
  }
}

/**
 * Fetch JSON from remote URL with CORS handling
 */
export async function fetchRemoteJson(url: string): Promise<unknown> {
  try {
    // Validate URL format
    const urlObj = new URL(url);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid URL protocol. Only http and https are allowed');
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      console.warn(`Unexpected content-type: ${contentType}. Expected application/json`);
    }

    const text = await response.text();
    
    // Check size limit
    if (text.length > MAX_JSON_SIZE) {
      throw new Error(`JSON size exceeds maximum limit of ${MAX_JSON_SIZE / 1024 / 1024}MB`);
    }

    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Failed to fetch JSON within 10 seconds');
      }
      throw new Error(`Failed to fetch JSON: ${error.message}`);
    }
    throw new Error('Failed to fetch JSON: Unknown error');
  }
}

/**
 * Validate and convert JSON to DiagramData format
 * Handles both flat and hierarchical formats
 */
export function validateAndConvertJson(json: unknown): DiagramData {
  // Check if this is hierarchical format (has zones with nested children)
  const isHierarchical = typeof json === 'object' && json !== null &&
    'zones' in json && Array.isArray((json as any).zones) &&
    (json as any).zones.some((zone: any) => 
      zone.children && Array.isArray(zone.children) &&
      zone.children.some((child: any) => child && typeof child === 'object')
    );

  let dataToValidate: unknown = json;

  if (isHierarchical) {
    // Validate hierarchical format first
    const hierarchicalResult = HierarchicalDiagramDataSchema.safeParse(json);
    if (!hierarchicalResult.success) {
      throw new Error(`Invalid hierarchical diagram format: ${hierarchicalResult.error.message}`);
    }
    // Convert hierarchical to flat format
    dataToValidate = convertFromNestedHierarchy(hierarchicalResult.data);
  }

  // Validate flat format
  const flatResult = DiagramDataSchema.safeParse(dataToValidate);
  if (!flatResult.success) {
    throw new Error(`Invalid diagram format: ${flatResult.error.message}`);
  }

  // Ensure all required arrays are present
  return {
    nodes: flatResult.data.nodes || [],
    connections: flatResult.data.connections || [],
    zones: flatResult.data.zones || [],
    groupings: flatResult.data.groupings || [],
    rootZoneId: (dataToValidate as any).rootZoneId,
    layers: flatResult.data.layers,
  };
}

/**
 * Load diagram data from viewer parameters
 */
export async function loadViewerData(params: ViewerParams): Promise<ViewerData> {
  let json: unknown;

  if (params.json) {
    json = decodeJsonParam(params.json);
    return {
      diagramData: validateAndConvertJson(json),
      source: 'inline',
    };
  } else if (params.url) {
    json = await fetchRemoteJson(params.url);
    return {
      diagramData: validateAndConvertJson(json),
      source: 'remote',
    };
  } else {
    throw new Error('No valid data source provided');
  }
}
