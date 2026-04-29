import type { DiagramData, HierarchicalDiagramData } from './types';
import { DiagramDataSchema, HierarchicalDiagramDataSchema } from './schemas';
import { convertFromNestedHierarchy } from './nested-hierarchy';
import { flattenDiagramOnImport, type RawDiagramData } from './flatten-on-import';
import { ensureConnectionIds } from './connection-order-utils';
import { extractEmbeddedPresentations, type ExtractedEmbeddedPresentations } from './extract-embedded-presentations';
import { collapsePresentationDecksToOne } from './presentation-deck-merge';
import { migratePresentationDecks } from './presentation-primary-slide';
import { ensureDiagramLayersPersisted } from './layers-utils';

export const VIEWER_MAX_JSON_SIZE = 5 * 1024 * 1024; // 5MB limit

export type ParsedViewerParams =
  | { mode: 'inline'; json: string }
  | { mode: 'remote'; url: string }
  | { mode: 'localPick' };

function normalizeViewerPresentation(
  extracted: ExtractedEmbeddedPresentations
): ExtractedEmbeddedPresentations | undefined {
  if (extracted.decks.length === 0) return undefined;
  // Ensure unified `slides[0]` = main diagram (same as editor / storage), then single deck.
  const unified = migratePresentationDecks(extracted.decks);
  const { decks, activeDeckId } = collapsePresentationDecksToOne(unified, extracted.activeDeckId);
  return { decks, activeDeckId };
}

export interface ViewerData {
  diagramData: DiagramData;
  source: 'inline' | 'remote' | 'file';
  /** Hydrated from embedded `presentations` in JSON when present */
  presentation?: ExtractedEmbeddedPresentations;
}

/**
 * Resolves `file` query values: absolute http(s) URLs, or paths relative to `baseHref` (e.g. window.location.href).
 * Browsers cannot read raw `file://` paths from pages served over http(s).
 */
export function resolveViewerFileParam(ref: string, baseHref: string): string {
  const t = ref.trim();
  if (!t) {
    throw new Error('Empty file reference');
  }
  try {
    const u = new URL(t);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.href;
    }
    if (u.protocol === 'file:') {
      throw new Error(
        'file:// URLs cannot be loaded from the browser for security reasons. Open /viewer?file= (empty) to pick a JSON file from your computer, or host the file and pass an https URL.'
      );
    }
    throw new Error(`Unsupported URL protocol: ${u.protocol}`);
  } catch (e) {
    if (!(e instanceof TypeError)) {
      throw e;
    }
  }
  let resolved: URL;
  try {
    resolved = new URL(t, baseHref);
  } catch {
    throw new Error(`Invalid file reference: ${t}`);
  }
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error('Resolved file reference must be http or https');
  }
  return resolved.href;
}

/**
 * Detect `file` when URLSearchParams drops it (e.g. bare `?file`) or serialization differs.
 * Only matches a real `file` query key, not values like `other=file`.
 */
function fileQueryFromRawQuery(raw: string): { rawValue: string } | null {
  const q = raw.replace(/^\?/, '').trim();
  if (!q) return null;
  const m = /(?:^|[&])file(?:=([^&]*))?($|&)/.exec(q);
  if (!m) return null;
  return { rawValue: m[1] ?? '' };
}

/**
 * Parse and validate viewer URL parameters.
 * @param rawLocationSearch - Pass `window.location.search` on the client so bare `?file` is always recognized (some routers omit it from hook params).
 */
export function parseViewerParams(
  searchParams: URLSearchParams,
  baseHrefForFileParam?: string,
  rawLocationSearch?: string
): ParsedViewerParams {
  const json = searchParams.get('json');
  const url = searchParams.get('url');

  const hint = rawLocationSearch !== undefined ? fileQueryFromRawQuery(rawLocationSearch) : null;
  const fromHint = hint !== null;
  const fromParams = searchParams.has('file');
  const hasFile = fromParams || fromHint;
  const fileRaw = fromParams ? (searchParams.get('file') ?? '') : fromHint ? hint.rawValue : '';

  if (hasFile) {
    if (json || url) {
      throw new Error('Cannot combine "file" with "json" or "url"');
    }
    const trimmed = (fileRaw ?? '').trim();
    if (!trimmed) {
      return { mode: 'localPick' };
    }
    if (!baseHrefForFileParam) {
      throw new Error('Non-empty "file" requires a page URL context; open the viewer in the browser.');
    }
    const resolved = resolveViewerFileParam(trimmed, baseHrefForFileParam);
    return { mode: 'remote', url: resolved };
  }

  if (!json && !url) {
    throw new Error('Missing required parameter: provide "json", "url", or "file" (use /viewer?file= to open a file picker)');
  }

  if (json && url) {
    throw new Error('Cannot specify both "json" and "url" parameters');
  }

  if (json) {
    return { mode: 'inline', json };
  }
  return { mode: 'remote', url: url! };
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
    if (decoded.length > VIEWER_MAX_JSON_SIZE) {
      throw new Error(`JSON size exceeds maximum limit of ${VIEWER_MAX_JSON_SIZE / 1024 / 1024}MB`);
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
    if (text.length > VIEWER_MAX_JSON_SIZE) {
      throw new Error(`JSON size exceeds maximum limit of ${VIEWER_MAX_JSON_SIZE / 1024 / 1024}MB`);
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
    dataToValidate = convertFromNestedHierarchy(hierarchicalResult.data as HierarchicalDiagramData);
  } else if (typeof json === 'object' && json !== null && 'zones' in json && Array.isArray((json as any).zones) && (json as any).zones.length > 0) {
    // Flat format with zones - flatten to extract nodes (preserves subDiagrams)
    dataToValidate = flattenDiagramOnImport(json as unknown as RawDiagramData);
  }

  // Validate flat format
  const flatResult = DiagramDataSchema.safeParse(dataToValidate);
  if (!flatResult.success) {
    throw new Error(`Invalid diagram format: ${flatResult.error.message}`);
  }

  const data = flatResult.data as DiagramData;
  // Spread full parsed diagram so connection fields (e.g. edgeAttachmentConstraint), viewState, and layers round-trip like the editor
  return ensureDiagramLayersPersisted({
    ...data,
    connections: ensureConnectionIds(data.connections || []),
  });
}

/**
 * Build viewer payload from parsed JSON (e.g. FileReader result)
 */
export function viewerDataFromUnknownJson(json: unknown): ViewerData {
  const diagramData = validateAndConvertJson(json);
  const extracted = extractEmbeddedPresentations(json, diagramData);
  return {
    diagramData,
    source: 'file',
    presentation: normalizeViewerPresentation(extracted),
  };
}

/**
 * Load diagram data from viewer parameters (not for mode `localPick`)
 */
export async function loadViewerData(params: ParsedViewerParams): Promise<ViewerData> {
  if (params.mode === 'localPick') {
    throw new Error('loadViewerData does not handle localPick; use the file picker flow');
  }

  let json: unknown;

  if (params.mode === 'inline') {
    json = decodeJsonParam(params.json);
    const diagramData = validateAndConvertJson(json);
    const extracted = extractEmbeddedPresentations(json, diagramData);
    return {
      diagramData,
      source: 'inline',
      presentation: normalizeViewerPresentation(extracted),
    };
  }

  json = await fetchRemoteJson(params.url);
  const diagramData = validateAndConvertJson(json);
  const extracted = extractEmbeddedPresentations(json, diagramData);
  return {
    diagramData,
    source: 'remote',
    presentation: normalizeViewerPresentation(extracted),
  };
}
