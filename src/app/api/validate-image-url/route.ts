import { NextRequest, NextResponse } from "next/server";
import { CUSTOM_ICON_MAX_SIZE_BYTES, isAllowedImageMimeType } from "@/lib/custom-icon-utils";

type ValidatePayload = {
  url?: string;
  maxBytes?: number;
};

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getContentLength(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const parsed = Number(headerValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

async function readStreamSize(response: Response, maxBytes: number): Promise<number> {
  if (!response.body) return 0;
  const reader = response.body.getReader();
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel("Max image size exceeded").catch(() => undefined);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return total;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidatePayload;
    const inputUrl = typeof body?.url === "string" ? body.url.trim() : "";
    const maxBytes = Number.isFinite(body?.maxBytes)
      ? Math.min(Number(body?.maxBytes), CUSTOM_ICON_MAX_SIZE_BYTES)
      : CUSTOM_ICON_MAX_SIZE_BYTES;

    if (!inputUrl || !isHttpUrl(inputUrl)) {
      return NextResponse.json({ ok: false, error: "URL must be a valid http/https image URL." }, { status: 400 });
    }

    const response = await fetch(inputUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "DiagramWeaver/1.0 (+custom-icon-validation)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/png,image/jpeg,image/gif,image/bmp,image/x-icon,image/*;q=0.8,*/*;q=0.5",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Image request failed with status ${response.status}.` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? undefined;
    if (!isAllowedImageMimeType(contentType)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported image format. Use PNG, JPG, SVG, WebP, GIF, AVIF, BMP, APNG, or ICO." },
        { status: 400 }
      );
    }

    const contentLength = getContentLength(response.headers.get("content-length"));
    if (contentLength !== undefined && contentLength > maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: `Image too large. Maximum allowed size is ${Math.floor(maxBytes / 1024)} KB.`,
          contentType,
          contentLength,
        },
        { status: 400 }
      );
    }

    const streamedSize = await readStreamSize(response, maxBytes);
    if (streamedSize > maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          error: `Image too large. Maximum allowed size is ${Math.floor(maxBytes / 1024)} KB.`,
          contentType,
          contentLength: streamedSize,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      normalizedUrl: response.url,
      contentType,
      contentLength: contentLength ?? streamedSize,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Image validation failed.",
      },
      { status: 500 }
    );
  }
}
