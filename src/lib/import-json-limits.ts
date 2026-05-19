/**
 * Limits for untrusted diagram JSON (file import, JSON panel apply, viewer payloads).
 * Aligned with viewer remote/inline caps.
 */
export const IMPORT_MAX_JSON_BYTES = 5 * 1024 * 1024;

/** Nesting depth for `subDiagrams` trees (root = 0). */
export const IMPORT_MAX_SUB_DIAGRAM_DEPTH = 48;

export function formatImportMaxJsonSizeMb(): string {
  return `${IMPORT_MAX_JSON_BYTES / 1024 / 1024}MB`;
}

export function getUtf8ByteLength(text: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).length;
  }
  return text.length;
}

export function assertImportJsonTextWithinLimit(text: string): void {
  const bytes = getUtf8ByteLength(text);
  if (bytes > IMPORT_MAX_JSON_BYTES) {
    throw new Error(`JSON size exceeds maximum import limit of ${formatImportMaxJsonSizeMb()}`);
  }
}

/**
 * Walk a parsed JSON value and ensure `subDiagrams` nesting does not exceed {@link IMPORT_MAX_SUB_DIAGRAM_DEPTH}.
 */
export function assertSubDiagramDepthWithinLimit(
  value: unknown,
  depth = 0,
  path = "diagram"
): void {
  if (depth > IMPORT_MAX_SUB_DIAGRAM_DEPTH) {
    throw new Error(
      `Diagram nesting exceeds maximum depth of ${IMPORT_MAX_SUB_DIAGRAM_DEPTH} (at ${path})`
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  const subs = (value as Record<string, unknown>).subDiagrams;
  if (!subs || typeof subs !== "object" || Array.isArray(subs)) return;

  for (const [key, sub] of Object.entries(subs as Record<string, unknown>)) {
    assertSubDiagramDepthWithinLimit(sub, depth + 1, `${path}.subDiagrams.${key}`);
  }
}

/** Parse diagram JSON text with size and nesting guards (call before Zod / flatten). */
export function parseImportJsonText(text: string): unknown {
  assertImportJsonTextWithinLimit(text);
  const parsed: unknown = JSON.parse(text);
  assertSubDiagramDepthWithinLimit(parsed);
  return parsed;
}
