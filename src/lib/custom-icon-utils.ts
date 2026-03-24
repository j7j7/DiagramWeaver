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

const ALLOWED_IMAGE_MIME_PREFIXES = ["image/png", "image/jpeg", "image/svg+xml", "image/jpg"];

const validationCache = new Map<string, CustomImageValidationResult>();

export function normalizeHttpImageUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isAllowedImageMimeType(contentType?: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase().split(";")[0].trim();
  return ALLOWED_IMAGE_MIME_PREFIXES.includes(lower);
}

export function normalizeCustomImageOptions(options: Partial<CustomImageOptions> | undefined | null): CustomImageOptions {
  const base = DEFAULT_CUSTOM_IMAGE_OPTIONS;
  const width = clampNumber(options?.width, 16, 512, base.width);
  const height = clampNumber(options?.height, 16, 512, base.height);
  const scale = clampNumber(options?.scale, 10, 300, base.scale);

  const crop: CustomImageOptions["crop"] = {
    x: clampNumber(options?.crop?.x, 0, 100, base.crop.x),
    y: clampNumber(options?.crop?.y, 0, 100, base.crop.y),
    width: clampNumber(options?.crop?.width, 1, 100, base.crop.width),
    height: clampNumber(options?.crop?.height, 1, 100, base.crop.height),
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
  const translateX = -crop.x;
  const translateY = -crop.y;

  const transforms = [
    `translate(${translateX}%, ${translateY}%)`,
    `scale(${scale})`,
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
    width: `${100 / (crop.width / 100)}%`,
    height: `${100 / (crop.height / 100)}%`,
    objectFit: "cover",
    transformOrigin: "top left",
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
    return { ok: false, error: "Please enter a valid http/https URL." };
  }

  if (!options?.force) {
    const cached = validationCache.get(normalized);
    if (cached) return cached;
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
