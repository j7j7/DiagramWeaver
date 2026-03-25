import type { CSSProperties } from "react";
import type { CustomImageOptions, DiagramData, DiagramNodeData } from "@/lib/types";

export const CUSTOM_ICON_MAX_SIZE_BYTES = 500 * 1024;

export type CustomImageRotation = 0 | 90 | 180 | 270;

export interface CustomImageValidationResult {
  ok: boolean;
  normalizedUrl?: string;
  contentType?: string;
  contentLength?: number;
  error?: string;
}

interface ParsedDataImageUrl {
  normalizedUrl: string;
  mimeType: string;
  isBase64: boolean;
  payload: string;
}

export const DEFAULT_CUSTOM_IMAGE_OPTIONS: CustomImageOptions = {
  width: 70,
  height: 70,
  scale: 100,
  crop: {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  },
  orientation: {
    rotate: 0,
    flipHorizontal: false,
    flipVertical: false,
  },
};

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/svg+xml",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/apng",
  "image/bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const EMBEDDED_IMAGE_QUERY_KEYS = ["imgurl", "mediaurl", "image_url", "image", "url", "u", "src"];

const validationCache = new Map<string, CustomImageValidationResult>();

export function normalizeHttpImageUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dataImage = parseDataImageUrl(trimmed);
  if (dataImage) {
    return dataImage.normalizedUrl;
  }

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return null;

    const embeddedImageUrl = extractEmbeddedImageUrl(parsed);
    if (embeddedImageUrl) return embeddedImageUrl;

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isAllowedImageMimeType(contentType?: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase().split(";")[0].trim();
  return ALLOWED_IMAGE_MIME_TYPES.has(lower);
}

function extractEmbeddedImageUrl(parsed: URL): string | null {
  for (const key of EMBEDDED_IMAGE_QUERY_KEYS) {
    const rawValue = parsed.searchParams.get(key);
    if (!rawValue) continue;

    const candidate = decodeNestedUrl(rawValue);
    try {
      const nested = new URL(candidate);
      const protocol = nested.protocol.toLowerCase();
      if (protocol === "http:" || protocol === "https:") {
        return nested.toString();
      }
    } catch {
      continue;
    }
  }

  return null;
}

function decodeNestedUrl(value: string): string {
  let current = value.trim();
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

export function normalizeCustomImageOptions(options: Partial<CustomImageOptions> | undefined | null): CustomImageOptions {
  const base = DEFAULT_CUSTOM_IMAGE_OPTIONS;
  const width = clampNumber(options?.width, 16, 512, base.width);
  const height = clampNumber(options?.height, 16, 512, base.height);
  const scale = clampNumber(options?.scale, 10, 300, base.scale);
  const cropWidth = clampNumber(options?.crop?.width, 1, 300, base.crop.width);
  const cropHeight = clampNumber(options?.crop?.height, 1, 300, base.crop.height);

  const crop: CustomImageOptions["crop"] = {
    x: clampNumber(options?.crop?.x, -300, 300, base.crop.x),
    y: clampNumber(options?.crop?.y, -300, 300, base.crop.y),
    width: cropWidth,
    height: cropHeight,
  };

  const rotateRaw = Number(options?.orientation?.rotate);
  const rotate: CustomImageRotation = rotateRaw === 90 || rotateRaw === 180 || rotateRaw === 270 ? rotateRaw : 0;

  return {
    width,
    height,
    scale,
    crop,
    orientation: {
      rotate,
      flipHorizontal: Boolean(options?.orientation?.flipHorizontal),
      flipVertical: Boolean(options?.orientation?.flipVertical),
    },
  };
}

export function buildCustomImageStyles(optionsInput?: Partial<CustomImageOptions> | null): {
  wrapperStyle: CSSProperties;
  imageStyle: CSSProperties;
} {
  const options = normalizeCustomImageOptions(optionsInput);
  const scale = options.scale / 100;
  const crop = options.crop;
  const orientation = options.orientation;
  const zoomX = (100 / crop.width) * scale;
  const zoomY = (100 / crop.height) * scale;
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  const translateX = (50 - centerX) * zoomX;
  const translateY = (50 - centerY) * zoomY;

  const transforms = [
    `translate(${translateX}%, ${translateY}%)`,
    `scale(${zoomX}, ${zoomY})`,
    `rotate(${orientation.rotate}deg)`,
    `scale(${orientation.flipHorizontal ? -1 : 1}, ${orientation.flipVertical ? -1 : 1})`,
  ];

  const wrapperStyle: CSSProperties = {
    width: `${options.width}px`,
    height: `${options.height}px`,
    overflow: "hidden",
    position: "relative",
  };

  const imageStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center center",
    transformOrigin: "center center",
    transform: transforms.join(" "),
  };

  return { wrapperStyle, imageStyle };
}

export async function validateCustomImageUrl(
  url: string,
  options?: { force?: boolean }
): Promise<CustomImageValidationResult> {
  const normalized = normalizeHttpImageUrl(url);
  if (!normalized) {
    return { ok: false, error: "Please enter a valid image URL (http/https or data:image/...)." };
  }

  if (!options?.force) {
    const cached = validationCache.get(normalized);
    if (cached) return cached;
  }

  const dataImage = parseDataImageUrl(normalized);
  if (dataImage) {
    const contentLength = estimateDataImageSizeBytes(dataImage);
    if (contentLength > CUSTOM_ICON_MAX_SIZE_BYTES) {
      const tooLargeResult: CustomImageValidationResult = {
        ok: false,
        normalizedUrl: normalized,
        contentType: dataImage.mimeType,
        contentLength,
        error: `Image too large. Maximum allowed size is ${Math.floor(CUSTOM_ICON_MAX_SIZE_BYTES / 1024)} KB.`,
      };
      validationCache.set(normalized, tooLargeResult);
      return tooLargeResult;
    }

    const okResult: CustomImageValidationResult = {
      ok: true,
      normalizedUrl: normalized,
      contentType: dataImage.mimeType,
      contentLength,
    };
    validationCache.set(normalized, okResult);
    return okResult;
  }

  try {
    const response = await fetch("/api/validate-image-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalized, maxBytes: CUSTOM_ICON_MAX_SIZE_BYTES }),
    });
    const payload = (await response.json()) as CustomImageValidationResult;
    const result: CustomImageValidationResult = {
      ok: Boolean(payload?.ok),
      normalizedUrl: payload?.normalizedUrl ?? normalized,
      contentType: payload?.contentType,
      contentLength: payload?.contentLength,
      error: payload?.error,
    };
    validationCache.set(normalized, result);
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to validate image URL.",
    };
  }
}

export function sanitizeCustomIconNode(node: DiagramNodeData): DiagramNodeData {
  if (node.type !== "generic.icon.custom") return node;

  const normalizedUrl = normalizeHttpImageUrl(node.imageUrl);
  if (!normalizedUrl) {
    return {
      ...node,
      imageUrl: undefined,
      imageOptions: normalizeCustomImageOptions(node.imageOptions),
    };
  }

  return {
    ...node,
    imageUrl: normalizedUrl,
    imageOptions: normalizeCustomImageOptions(node.imageOptions),
  };
}

export function sanitizeCustomIconsInDiagram(data: DiagramData): DiagramData {
  const sanitizeRecursive = (diagram: DiagramData): DiagramData => {
    const nextSubDiagrams: Record<string, DiagramData> | undefined = diagram.subDiagrams
      ? Object.fromEntries(
          Object.entries(diagram.subDiagrams).map(([key, value]) => [key, sanitizeRecursive(value)])
        )
      : undefined;

    return {
      ...diagram,
      nodes: (diagram.nodes || []).map((node) => sanitizeCustomIconNode(node)),
      subDiagrams: nextSubDiagrams,
    };
  };

  return sanitizeRecursive(data);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function parseDataImageUrl(value: string): ParsedDataImageUrl | null {
  if (!value.toLowerCase().startsWith("data:")) return null;

  const commaIndex = value.indexOf(",");
  if (commaIndex <= 5) return null;

  const metadata = value.slice(5, commaIndex);
  const payload = value.slice(commaIndex + 1);
  if (!payload) return null;

  const metadataParts = metadata
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!metadataParts.length) return null;

  const mimeType = metadataParts[0].toLowerCase();
  if (!isAllowedImageMimeType(mimeType)) return null;

  const isBase64 = metadataParts.slice(1).some((part) => part.toLowerCase() === "base64");
  return {
    normalizedUrl: value,
    mimeType,
    isBase64,
    payload,
  };
}

function estimateDataImageSizeBytes(dataImage: ParsedDataImageUrl): number {
  if (dataImage.isBase64) {
    const payload = dataImage.payload.replace(/\s+/g, "");
    if (!payload) return 0;

    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    const decodedBytes = Math.floor((payload.length * 3) / 4) - padding;
    return Math.max(0, decodedBytes);
  }

  try {
    const decoded = decodeURIComponent(dataImage.payload);
    return new TextEncoder().encode(decoded).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
