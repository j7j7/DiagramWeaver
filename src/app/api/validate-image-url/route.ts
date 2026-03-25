import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { CUSTOM_ICON_MAX_SIZE_BYTES, isAllowedImageMimeType } from "@/lib/custom-icon-utils";

type ValidatePayload = {
  url?: string;
  maxBytes?: number;
};

const MAX_REDIRECTS = 5;

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function isForbiddenHostname(hostname: string): boolean {
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

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return -1;
  return (
    parts[0] * 16777216 +
    parts[1] * 65536 +
    parts[2] * 256 +
    parts[3]
  );
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

function normalizeIPv6(ip: string): string {
  return ip.toLowerCase();
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = normalizeIPv6(ip);
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

function isForbiddenIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIPv4(ip);
  if (version === 6) return isPrivateOrReservedIPv6(ip);
  return true;
}

async function resolveAndValidateHost(url: URL): Promise<{ ok: true } | { ok: false; error: string }> {
  const hostname = url.hostname;
  if (!hostname) return { ok: false, error: "Missing hostname." };
  if (isForbiddenHostname(hostname)) {
    return { ok: false, error: "Local or internal hostnames are not allowed." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "URL credentials are not allowed." };
  }

  const ipVersion = isIP(hostname);
  if (ipVersion !== 0) {
    if (isForbiddenIp(hostname)) {
      return { ok: false, error: "Private or reserved IP addresses are not allowed." };
    }
    return { ok: true };
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length) {
      return { ok: false, error: "Unable to resolve hostname." };
    }
    for (const record of records) {
      if (isForbiddenIp(record.address)) {
        return { ok: false, error: "Hostname resolves to a private or reserved network address." };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to resolve hostname." };
  }
}

function getRedirectLocation(response: Response, currentUrl: URL): URL | null {
  const location = response.headers.get("location");
  if (!location) return null;
  try {
    return new URL(location, currentUrl);
  } catch {
    return null;
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchWithValidatedRedirects(inputUrl: URL): Promise<{ response?: Response; error?: string }> {
  let currentUrl = inputUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const hostValidation = await resolveAndValidateHost(currentUrl);
    if (!hostValidation.ok) {
      return { error: hostValidation.error };
    }

    const response = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "DiagramWeaver/1.0 (+custom-icon-validation)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/png,image/jpeg,image/gif,image/bmp,image/x-icon,image/*;q=0.8,*/*;q=0.5",
      },
      cache: "no-store",
    });

    if (!isRedirectStatus(response.status)) {
      return { response };
    }

    const nextUrl = getRedirectLocation(response, currentUrl);
    if (!nextUrl) {
      return { error: "Invalid redirect target." };
    }
    if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
      return { error: "Redirected to unsupported protocol." };
    }

    currentUrl = nextUrl;
  }

  return { error: "Too many redirects." };
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

    const parsedInputUrl = parseHttpUrl(inputUrl);
    if (!parsedInputUrl) {
      return NextResponse.json({ ok: false, error: "URL must be a valid http/https image URL." }, { status: 400 });
    }

    const fetchResult = await fetchWithValidatedRedirects(parsedInputUrl);
    if (fetchResult.error) {
      return NextResponse.json({ ok: false, error: fetchResult.error }, { status: 400 });
    }
    const response = fetchResult.response;
    if (!response) {
      return NextResponse.json({ ok: false, error: "Unable to fetch image." }, { status: 400 });
    }

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
