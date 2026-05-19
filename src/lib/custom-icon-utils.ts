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

// Image cache to prevent redundant network requests for the same URL
const imageCache = new Map<string, {
  dataUrl: string;
  timestamp: number;
}>();

// Cache duration: 1 hour in milliseconds
const IMAGE_CACHE_DURATION = 60 * 60 * 1000;

// Maximum cache size to prevent memory issues (100 images)
const MAX_IMAGE_CACHE_SIZE = 100;

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

  const result = await validateRemoteHttpImageUrl(normalized, CUSTOM_ICON_MAX_SIZE_BYTES);
  validationCache.set(normalized, result);
  return result;
}

function getRemoteImageUrlValidationError(url: URL): string | null {
  const hostname = url.hostname;
  if (!hostname) return "Missing hostname.";
  if (isForbiddenImageHostname(hostname)) {
    return "Local or internal hostnames are not allowed.";
  }
  if (url.username || url.password) {
    return "URL credentials are not allowed.";
  }

  const ipVersion = detectIpVersion(hostname);
  if (ipVersion !== 0 && isForbiddenIpAddress(hostname, ipVersion)) {
    return "Private or reserved IP addresses are not allowed.";
  }

  return null;
}

function isForbiddenImageHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0" ||
    host === "[::1]"
  );
}

function detectIpVersion(value: string): 0 | 4 | 6 {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return 4;
  if (value.includes(":")) return 6;
  return 0;
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return -1;
  return parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3];
}

function isIPv4InCidr(ip: string, base: string, prefix: number): boolean {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt < 0 || baseInt < 0) return false;
  if (prefix <= 0) return true;
  if (prefix >= 32) return ipInt === baseInt;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const blockedCidrs: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return blockedCidrs.some(([base, prefix]) => isIPv4InCidr(ip, base, prefix));
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8")
  );
}

function isForbiddenIpAddress(ip: string, version: 4 | 6): boolean {
  if (version === 4) return isPrivateOrReservedIPv4(ip);
  return isPrivateOrReservedIPv6(ip);
}

async function validateRemoteHttpImageUrl(
  url: string,
  maxBytes: number
): Promise<CustomImageValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "URL must be a valid http/https image URL." };
  }

  const hostError = getRemoteImageUrlValidationError(parsed);
  if (hostError) {
    return { ok: false, error: hostError };
  }

  const fetchResult = await probeRemoteImageWithFetch(url, maxBytes);
  if (fetchResult) return fetchResult;

  return probeRemoteImageWithImageElement(url);
}

async function probeRemoteImageWithFetch(
  url: string,
  maxBytes: number
): Promise<CustomImageValidationResult | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      redirect: "follow",
      headers: {
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/png,image/jpeg,image/gif,image/bmp,image/x-icon,image/*;q=0.8,*/*;q=0.5",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Image request failed with status ${response.status}.`,
      };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase();
    if (!isAllowedImageMimeType(contentType)) {
      return {
        ok: false,
        error: "Unsupported image format. Use PNG, JPG, SVG, WebP, GIF, AVIF, BMP, APNG, or ICO.",
      };
    }

    const headerLength = parseContentLength(response.headers.get("content-length"));
    if (headerLength !== undefined && headerLength > maxBytes) {
      return {
        ok: false,
        error: `Image too large. Maximum allowed size is ${Math.floor(maxBytes / 1024)} KB.`,
        contentType: contentType?.split(";")[0].trim(),
        contentLength: headerLength,
      };
    }

    const blob = await response.blob();
    if (blob.size > maxBytes) {
      return {
        ok: false,
        error: `Image too large. Maximum allowed size is ${Math.floor(maxBytes / 1024)} KB.`,
        contentType: blob.type || contentType?.split(";")[0].trim(),
        contentLength: blob.size,
      };
    }

    return {
      ok: true,
      normalizedUrl: response.url || url,
      contentType: blob.type || contentType?.split(";")[0].trim(),
      contentLength: blob.size,
    };
  } catch {
    return null;
  }
}

function probeRemoteImageWithImageElement(url: string): Promise<CustomImageValidationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeoutId = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve({
        ok: false,
        error: "Timed out while loading image. Check the URL or try a data:image/... URL.",
      });
    }, 15000);

    img.onload = () => {
      window.clearTimeout(timeoutId);
      resolve({ ok: true, normalizedUrl: url });
    };
    img.onerror = () => {
      window.clearTimeout(timeoutId);
      resolve({
        ok: false,
        error: "Unable to load image. The URL may be invalid, blocked, or not an image.",
      });
    };
    img.src = url;
  });
}

function parseContentLength(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const parsed = Number(headerValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
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

/**
 * Get a cached image data URL if available and not expired
 */
export function getCachedImage(url: string): string | null {
  const cached = imageCache.get(url);
  if (!cached) return null;

  // Check if cache entry is expired
  const now = Date.now();
  if (now - cached.timestamp > IMAGE_CACHE_DURATION) {
    imageCache.delete(url);
    return null;
  }

  return cached.dataUrl;
}

/**
 * Cache an image data URL
 */
export function cacheImage(url: string, dataUrl: string): void {
  // Remove oldest entries if cache is too large
  if (imageCache.size >= MAX_IMAGE_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) {
      imageCache.delete(firstKey);
    }
  }

  imageCache.set(url, {
    dataUrl,
    timestamp: Date.now(),
  });
}

/**
 * Clear expired cache entries (optional - can be called periodically)
 */
export function clearExpiredImageCache(): void {
  const now = Date.now();
  for (const [url, cached] of imageCache.entries()) {
    if (now - cached.timestamp > IMAGE_CACHE_DURATION) {
      imageCache.delete(url);
    }
  }
}

/**
 * Clear all cached images (useful for memory management)
 */
export function clearImageCache(): void {
  imageCache.clear();
}

