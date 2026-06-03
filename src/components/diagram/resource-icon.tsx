"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Server, User } from "lucide-react";
import { buildResourceIconPath } from "@/lib/resource-mapping";
import { loadProviderCatalog, lookupResourceInCatalog } from "@/lib/resource-catalog";
import { getLucideIcon, getLucideIconFromTypeSlug } from "@/lib/icon-resources";
import { CustomIconImage } from "@/components/diagram/custom-icon-image";
import type { CustomImageOptions } from "@/lib/types";
import { isConnectorLineNodeType } from "@/lib/utils";
import { isChartNodeType } from "@/lib/chart-node";
import { CLOUD_SHAPE_PATH_D, CLOUD_SHAPE_VIEW_BOX, isPaletteVectorCloudType } from "@/lib/cloud-shape";
import { BorderPaletteGlyph } from "@/components/diagram/shapes/border-art";

/** Palette JSON lists Text Box Heading under `generic.text` but runtime type is `generic.object.text-box-heading`. */
function isTextBoxHeadingRuntimeType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.text-box-heading" || t.endsWith(".text-box-heading");
}

/** Catalog `progress-bar.png` is a flat placeholder; palette uses `PaletteProgressBarGlyph` (filled + empty segments). */
function isProgressBarPaletteVectorType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.progress-bar" || t.endsWith(".progress-bar");
}

function isTimelineBarPaletteVectorType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.timeline-bar" || t.endsWith(".timeline-bar");
}

function isSegmentedRectanglePaletteVectorType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.segmented-rectangle" || t.endsWith(".segmented-rectangle");
}

function isPyramidPaletteVectorType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.pyramid" || t.endsWith(".pyramid");
}

/** Catalog raster was a plain line; UI uses spine + stems + alternating card rects. */
function isTimelinePaletteVectorType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.timeline" || t.endsWith(".timeline");
}

/** Raster catalog is incidental; centered topic + radial rounded cards matches on-canvas mind-map nodes. */
function isMindmapPaletteVectorType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.mind-map-node" || t.endsWith(".mind-map-node");
}

/** Vector thumbnails for chart nodes (palette, sidebar); wedges / bars read as charts at small sizes. */
function ChartPalettePieGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path d="M12 12L12 3A9 9 0 0117.79 18.89Z" fill="currentColor" opacity={1} />
      <path d="M12 12L17.79 18.89A9 9 0 013.14 13.56Z" fill="currentColor" opacity={0.58} />
      <path d="M12 12L3.14 13.56A9 9 0 0112 3Z" fill="currentColor" opacity={0.34} />
    </svg>
  );
}

function ChartPaletteBarGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M4 20.5V5.2M4 20.5H20.8"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="5.9" y="10.4" width="3.35" height="10.1" rx="0.55" fill="currentColor" opacity={0.92} />
      <rect x="10.8" y="7" width="3.35" height="13.5" rx="0.55" fill="currentColor" opacity={0.58} />
      <rect x="15.75" y="12.6" width="3.35" height="7.9" rx="0.55" fill="currentColor" opacity={0.36} />
    </svg>
  );
}

function ChartPaletteGridGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth={1.35} opacity={0.55} />
      <rect x="5.5" y="9" width="4" height="4" rx="0.6" fill="currentColor" opacity={0.95} />
      <rect x="10.5" y="9" width="4" height="4" rx="0.6" fill="currentColor" opacity={0.35} />
      <rect x="15.5" y="9" width="4" height="4" rx="0.6" fill="currentColor" opacity={0.7} />
      <rect x="5.5" y="14.5" width="4" height="4" rx="0.6" fill="currentColor" opacity={0.35} />
      <rect x="10.5" y="14.5" width="4" height="4" rx="0.6" fill="currentColor" opacity={0.95} />
      <rect x="15.5" y="14.5" width="4" height="4" rx="0.6" fill="currentColor" opacity={0.35} />
      <path
        d="M5.5 8.5h13M5.5 14h13M5.5 19.5h13M5.5 8.5v11M10.5 8.5v11M15.5 8.5v11"
        stroke="currentColor"
        strokeWidth={0.65}
        opacity={0.4}
      />
    </svg>
  );
}

function ChartPaletteLineGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M4 20.5V5.2M4 20.5H20.8"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
      <path
        d="M5.2 16.2 L8.4 9.8 L11.6 13.1 L14.8 6.4 L18 11.2 L20.8 7.6"
        stroke="currentColor"
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="5.2" cy="16.2" r="1.35" fill="currentColor" opacity={0.95} />
      <circle cx="8.4" cy="9.8" r="1.35" fill="currentColor" opacity={0.85} />
      <circle cx="11.6" cy="13.1" r="1.35" fill="currentColor" opacity={0.75} />
      <circle cx="14.8" cy="6.4" r="1.35" fill="currentColor" opacity={0.65} />
      <circle cx="18" cy="11.2" r="1.35" fill="currentColor" opacity={0.55} />
      <circle cx="20.8" cy="7.6" r="1.35" fill="currentColor" opacity={0.45} />
    </svg>
  );
}

/** Segmented donut — reads at 24×24 next to pie / bar / line chart glyphs. */
function ChartPaletteRingGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        fill="currentColor"
        opacity={1}
        d="M 12.1615 4.1267 A 7.875 7.875 0 0 1 19.8733 11.8385 L 16.9677 11.8981 A 4.96875 4.96875 0 0 0 12.1019 7.0323 Z"
      />
      <path
        fill="currentColor"
        opacity={0.62}
        d="M 19.8733 12.1615 A 7.875 7.875 0 0 1 12.1615 19.8733 L 12.1019 16.9677 A 4.96875 4.96875 0 0 0 16.9677 12.1019 Z"
      />
      <path
        fill="currentColor"
        opacity={0.42}
        d="M 11.8385 19.8733 A 7.875 7.875 0 0 1 4.1267 12.1615 L 7.0323 12.1019 A 4.96875 4.96875 0 0 0 11.8981 16.9677 Z"
      />
      <path
        fill="currentColor"
        opacity={0.28}
        d="M 4.1267 11.8385 A 7.875 7.875 0 0 1 11.8385 4.1267 L 11.8981 7.0323 A 4.96875 4.96875 0 0 0 7.0323 11.8981 Z"
      />
    </svg>
  );
}

/** Horizontal progress bar: muted track + saturated fill segment (resources palette). */
function PaletteProgressBarGlyph(props: React.SVGProps<SVGSVGElement>) {
  const clipId = React.useId().replace(/:/g, "");
  const outlineW = (() => {
    const w = props.strokeWidth;
    if (w === undefined || w === null || w === "") return 1.2;
    const n = typeof w === "number" ? w : Number(w);
    return Number.isFinite(n) ? n : 1.2;
  })();
  const clipUrl = `url(#dw-pb-clip-${clipId})`;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <defs>
        <clipPath id={`dw-pb-clip-${clipId}`}>
          <rect x="2.5" y="8" width="19" height="8" rx="3" ry="3" />
        </clipPath>
      </defs>
      <g clipPath={clipUrl}>
        {/* Empty / track segment (full bar, light) */}
        <rect x="2.5" y="8" width="19" height="8" fill="currentColor" opacity={0.14} />
        {/* Filled segment (~52% — reads clearly at 24×24) */}
        <rect x="2.5" y="8" width="9.9" height="8" fill="currentColor" opacity={1} />
      </g>
      <rect
        x="2.5"
        y="8"
        width="19"
        height="8"
        rx="3"
        ry="3"
        fill="none"
        stroke="currentColor"
        strokeWidth={outlineW}
        opacity={0.85}
      />
    </svg>
  );
}

/** Segmented horizontal bar + optional tick captions — distinct from spine timeline & progress bar. */
function PaletteTimelineBarGlyph(props: React.SVGProps<SVGSVGElement>) {
  const clipId = React.useId().replace(/:/g, "");
  const clipUrl = `url(#dw-tb-clip-${clipId})`;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <defs>
        <clipPath id={`dw-tb-clip-${clipId}`}>
          <rect x="2" y="7" width="20" height="7" rx="2.5" ry="2.5" />
        </clipPath>
      </defs>
      <g clipPath={clipUrl}>
        <rect x="2" y="7" width="20" height="7" fill="currentColor" opacity={0.12} />
        <rect x="2" y="7" width="5" height="7" fill="currentColor" opacity={0.95} />
        <rect x="7" y="7" width="5.5" height="7" fill="currentColor" opacity={0.62} />
        <rect x="12.5" y="7" width="4.5" height="7" fill="currentColor" opacity={0.42} />
        <rect x="17" y="7" width="5" height="7" fill="currentColor" opacity={0.28} />
      </g>
      <rect x="2" y="7" width="20" height="7" rx="2.5" ry="2.5" fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.75} />
      <text x="4.5" y="18.2" fontSize="3.6" fill="currentColor" opacity={0.55}>
        J
      </text>
      <text x="9.2" y="18.2" fontSize="3.6" fill="currentColor" opacity={0.55}>
        F
      </text>
      <text x="13.6" y="18.2" fontSize="3.6" fill="currentColor" opacity={0.55}>
        M
      </text>
      <text x="18.2" y="18.2" fontSize="3.6" fill="currentColor" opacity={0.55}>
        A
      </text>
    </svg>
  );
}

/** Segmented horizontal rectangle — gaps + optional per-segment outline vs single hull. */
function PaletteSegmentedRectangleGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <rect
        x="2"
        y="6"
        width="20"
        height="10"
        rx="2"
        ry="2"
        fill="currentColor"
        fillOpacity={0.1}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      <rect x="3" y="7" width="3.2" height="8" rx="1" fill="currentColor" opacity={0.95} stroke="currentColor" strokeWidth={0.9} />
      <rect x="7" y="7" width="3.2" height="8" rx="1" fill="currentColor" opacity={0.75} stroke="currentColor" strokeWidth={0.9} />
      <rect x="11" y="7" width="3.2" height="8" rx="1" fill="currentColor" opacity={0.55} stroke="currentColor" strokeWidth={0.9} />
      <rect x="15" y="7" width="5" height="8" rx="1" fill="currentColor" opacity={0.38} stroke="currentColor" strokeWidth={0.9} />
    </svg>
  );
}

/** Stacked trapezoids (segmented pyramid) — distinct from horizontal timeline bar. */
function PalettePyramidGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M4.5 20.5 H19.5 L18.5 16.8 H5.5 Z"
        fill="currentColor"
        opacity={0.95}
        stroke="currentColor"
        strokeWidth={1.05}
        strokeOpacity={0.35}
        strokeLinejoin="round"
      />
      <path
        d="M5.5 16.65 H18.5 L17.5 13.2 H6.5 Z"
        fill="currentColor"
        opacity={0.68}
        stroke="currentColor"
        strokeWidth={1.05}
        strokeOpacity={0.35}
        strokeLinejoin="round"
      />
      <path
        d="M6.55 13.05 H17.45 L16.25 9.75 H7.75 Z"
        fill="currentColor"
        opacity={0.48}
        stroke="currentColor"
        strokeWidth={1.05}
        strokeOpacity={0.35}
        strokeLinejoin="round"
      />
      <path
        d="M7.85 9.6 H16.15 L14.6 5.85 H9.4 Z"
        fill="currentColor"
        opacity={0.34}
        stroke="currentColor"
        strokeWidth={1.05}
        strokeOpacity={0.35}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaletteTimelineGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M2.5 13.5h19"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <line x1="6" y1="13.5" x2="6" y2="11" stroke="currentColor" strokeWidth={1.05} opacity={0.5} strokeLinecap="round" />
      <rect x="4.1" y="5.85" width="3.85" height="5" rx={1} fill="currentColor" opacity={0.92} />
      <circle cx="6" cy="13.5" r={1.2} fill="currentColor" />
      <line x1="12" y1="13.5" x2="12" y2="16" stroke="currentColor" strokeWidth={1.05} opacity={0.5} strokeLinecap="round" />
      <rect x="10.075" y="17.15" width="3.85" height="5" rx={1} fill="currentColor" opacity={0.7} />
      <circle cx="12" cy="13.5" r={1.2} fill="currentColor" />
      <line x1="18" y1="13.5" x2="18" y2="11" stroke="currentColor" strokeWidth={1.05} opacity={0.5} strokeLinecap="round" />
      <rect x="16.1" y="5.85" width="3.85" height="5" rx={1} fill="currentColor" opacity={0.46} />
      <circle cx="18" cy="13.5" r={1.2} fill="currentColor" />
    </svg>
  );
}

/** Central rounded topic + connectors + satellite cards (rounded-rect parity with canvas mind-map nodes). */
function PaletteMindmapGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <g stroke="currentColor" strokeWidth={1.08} strokeLinecap="round" opacity={0.4}>
        <line x1="12" y1="12" x2="12" y2="4.35" />
        <line x1="12" y1="12" x2="17.45" y2="7.7" />
        <line x1="12" y1="12" x2="17.35" y2="16.15" />
        <line x1="12" y1="12" x2="6.65" y2="16.15" />
        <line x1="12" y1="12" x2="6.65" y2="7.7" />
      </g>
      <rect x="9.3" y="2.65" width="5.35" height="3.65" rx={1} fill="currentColor" opacity={0.52} />
      <rect x="15.08" y="5.92" width="4.74" height="3.52" rx={0.9} fill="currentColor" opacity={0.62} />
      <rect x="15.08" y="14.56" width="4.74" height="3.52" rx={0.9} fill="currentColor" opacity={0.44} />
      <rect x="4.12" y="14.56" width="4.74" height="3.52" rx={0.9} fill="currentColor" opacity={0.72} />
      <rect x="4.12" y="5.92" width="4.74" height="3.52" rx={0.9} fill="currentColor" opacity={0.56} />
      <rect x="8.35" y="8.92" width="7.35" height="6.28" rx={1.35} fill="currentColor" opacity={0.94} />
    </svg>
  );
}

const CARD_BLUE = "#3b82f6";
const CARD_BLUE_LIGHT = "#bfdbfe";
const CARD_BLUE_MUTED = "#93c5fd";

function CardPaletteGlyph({ type, ...props }: React.SVGProps<SVGSVGElement> & { type: string }) {
  const slug = type.replace(/^generic\.card\./, "");
  const frame = { stroke: "currentColor", strokeWidth: 1.2, fill: "#fff" as const };
  if (slug === "profile-feature") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2.5" {...frame} />
        <rect x="4.5" y="4.5" width="15" height="8.5" rx="1.5" fill={CARD_BLUE} />
        <rect x="4.5" y="13" width="15" height="7.5" rx="1" fill="#fffbeb" />
        <rect x="5" y="14.5" width="10" height="2" rx="0.8" fill={CARD_BLUE_MUTED} />
        <rect x="5" y="17.5" width="7" height="1.5" rx="0.6" fill={CARD_BLUE_LIGHT} />
      </svg>
    );
  }
  if (slug === "profile-diagonal-split") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2" {...frame} />
        <path d="M3 3 L21 3 L21 21 C 16 21 8 17 3 12 Z" fill="#fde8d0" />
        <path d="M3 12 C 8 17 16 21 21 21 L3 21 Z" fill="#faf8f5" />
        <path d="M3 12 C 8 17 16 21 21 21" fill="none" stroke="#475569" strokeWidth={1.2} />
        <circle cx="17" cy="7.5" r="3" fill="#a8d5a2" stroke="#475569" strokeWidth={0.9} />
        <rect x="7" y="11.5" width="10" height="2" rx="0.6" fill="#e5e7eb" />
        <rect x="8.5" y="14.5" width="7" height="1.5" rx="0.5" fill="#e5e7eb" />
      </svg>
    );
  }
  if (slug === "profile-social") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.8" {...frame} />
        <rect x="4.5" y="4.5" width="15" height="7.5" rx="1.2" fill="#2ab7bc" />
        <circle cx="12" cy="11.2" r="3.1" fill="#fff" stroke="#2ab7bc" strokeWidth={1.2} />
        <circle cx="12" cy="11.2" r="2.3" fill="#94dce0" />
        <rect x="7.5" y="14.8" width="9" height="1.4" rx="0.5" fill="#475569" opacity={0.85} />
        <rect x="9" y="16.8" width="6" height="1" rx="0.4" fill="#94a3b8" />
        <line x1="5.5" y1="18.8" x2="18.5" y2="18.8" stroke="#e2e8f0" strokeWidth={0.8} />
        <rect x="5.5" y="20" width="3.2" height="1.2" rx="0.4" fill="#334155" />
        <rect x="5.5" y="21.4" width="3.8" height="0.8" rx="0.3" fill="#94a3b8" />
        <rect x="10.4" y="20" width="3.2" height="1.2" rx="0.4" fill="#334155" />
        <rect x="10.4" y="21.4" width="2.8" height="0.8" rx="0.3" fill="#94a3b8" />
        <rect x="15.3" y="20" width="3.2" height="1.2" rx="0.4" fill="#334155" />
        <rect x="15.3" y="21.4" width="3.2" height="0.8" rx="0.3" fill="#94a3b8" />
      </svg>
    );
  }
  if (slug === "compact-horizontal") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="2.5" y="6" width="19" height="12" rx="3" {...frame} />
        <circle cx="7.5" cy="12" r="3.2" fill={CARD_BLUE} />
        <rect x="12" y="9.5" width="7.5" height="2" rx="0.8" fill={CARD_BLUE_MUTED} />
        <rect x="12" y="13" width="5.5" height="1.5" rx="0.6" fill={CARD_BLUE_LIGHT} />
      </svg>
    );
  }
  if (slug === "list-item-row") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="2.5" y="9" width="19" height="6" rx="2" fill="#f8fafc" stroke="currentColor" strokeWidth={1.2} />
        <circle cx="6" cy="12" r={1.4} fill={CARD_BLUE} />
        <rect x="9" y="11.2" width="8" height="1.6" rx="0.5" fill={CARD_BLUE_LIGHT} />
        <circle cx="19" cy="11.1" r={0.55} fill={CARD_BLUE_MUTED} />
        <circle cx="19" cy="12.5" r={0.55} fill={CARD_BLUE_MUTED} />
        <circle cx="19" cy="13.9" r={0.55} fill={CARD_BLUE_MUTED} />
      </svg>
    );
  }
  if (slug === "sidebar-accent") {
    const gradientId = "card-sidebar-accent-bg";
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#051923" />
            <stop offset="100%" stopColor="#004e64" />
          </linearGradient>
        </defs>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" fill={`url(#${gradientId})`} stroke="#2dd4bf" strokeWidth={1} />
        <rect x="4.5" y="7.5" width="1.6" height="9" rx="0.8" fill="#45d1af" />
        <rect x="7.5" y="8.2" width="11.5" height="2" rx="0.5" fill="#45d1af" />
        <rect x="7.5" y="11.2" width="9" height="1.4" rx="0.4" fill="#ffffff" opacity={0.95} />
      </svg>
    );
  }
  if (slug === "framed-heading") {
    const tabGradId = "card-framed-heading-tab";
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <defs>
          <linearGradient id={tabGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2b6ca1" />
            <stop offset="100%" stopColor="#193661" />
          </linearGradient>
        </defs>
        <rect x="3" y="5.5" width="18" height="14.5" rx="3" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <rect x="6" y="3.8" width="12" height="4.4" rx="1" fill={`url(#${tabGradId})`} />
        <rect x="8.5" y="5.1" width="6.8" height="1.5" rx="0.5" fill="#ced7e3" opacity={0.95} />
      </svg>
    );
  }
  if (slug === "element-feature") {
    const bgId = "card-element-feature-bg";
    const lineId = "card-element-feature-line";
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <defs>
          <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3508ba" />
            <stop offset="55%" stopColor="#320568" />
            <stop offset="100%" stopColor="#030207" />
          </linearGradient>
          <linearGradient id={lineId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" fill={`url(#${bgId})`} stroke="#6d28d9" strokeWidth={1} />
        <rect x="5" y="7.8" width="7.5" height="1.2" rx="0.4" fill="#a78bfa" opacity={0.95} />
        <rect x="5" y="10.2" width="5.5" height="2.4" rx="0.5" fill="#ffffff" />
        <rect x="5" y="13.2" width="8.5" height="0.55" rx="0.25" fill={`url(#${lineId})`} />
        <text
          x="19.2"
          y="16.8"
          fill="none"
          stroke="#a78bfa"
          strokeWidth={0.35}
          fontFamily="system-ui,sans-serif"
          fontSize={11}
          fontWeight={700}
          textAnchor="end"
          opacity={0.85}
        >
          03
        </text>
      </svg>
    );
  }
  if (slug === "detail-post") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#f8fafc" stroke="currentColor" strokeWidth={1.2} />
        <rect x="5" y="5.5" width="3" height="3" rx="0.8" fill={CARD_BLUE} />
        <rect x="15" y="6" width="4.5" height="1.8" rx="0.6" fill={CARD_BLUE_LIGHT} />
        <rect x="5" y="10.5" width="11" height="2.2" rx="0.8" fill={CARD_BLUE} />
        <rect x="5" y="14" width="13" height="1.5" rx="0.5" fill={CARD_BLUE_MUTED} />
        <rect x="5" y="16.5" width="9" height="1.5" rx="0.5" fill={CARD_BLUE_LIGHT} />
        <rect x="5" y="19" width="14" height="3" rx="1" fill={CARD_BLUE_LIGHT} />
        <rect x="7" y="20.2" width="10" height="0.9" rx="0.4" fill={CARD_BLUE} opacity={0.85} />
      </svg>
    );
  }
  if (slug === "agenda") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="#fff" stroke="currentColor" strokeWidth={1.2} />
        <rect x="6" y="5.5" width="12" height="1.6" rx="0.5" fill="#334155" opacity={0.85} />
        <line x1="5" y1="8.5" x2="19" y2="8.5" stroke="#e2e8f0" strokeWidth={0.8} />
        <rect x="6" y="9.8" width="4" height="1" rx="0.35" fill="#64748b" />
        <rect x="12" y="9.8" width="6" height="1" rx="0.35" fill="#64748b" />
        <line x1="11" y1="9.5" x2="11" y2="20.5" stroke="#e2e8f0" strokeWidth={0.7} />
        <line x1="5" y1="11.5" x2="19" y2="11.5" stroke="#e2e8f0" strokeWidth={0.7} />
        {[13.2, 15, 16.8, 18.6].map((y) => (
          <line key={y} x1="5" y1={y} x2="19" y2={y} stroke="#e2e8f0" strokeWidth={0.6} />
        ))}
        <rect x="6" y="12.2" width="3.5" height="0.9" rx="0.3" fill="#93c5fd" />
        <rect x="12" y="12.2" width="5.5" height="0.9" rx="0.3" fill="#bfdbfe" />
        <rect x="6" y="14" width="3.5" height="0.9" rx="0.3" fill="#93c5fd" />
        <rect x="12" y="14" width="4.5" height="0.9" rx="0.3" fill="#bfdbfe" />
        <rect x="5.5" y="16.5" width="13" height="2.2" rx="0.6" fill="none" stroke={CARD_BLUE} strokeWidth={0.9} />
        <rect x="6" y="17.2" width="3.5" height="0.9" rx="0.3" fill="#3b82f6" />
        <rect x="12" y="17.2" width="5" height="0.9" rx="0.3" fill="#93c5fd" />
      </svg>
    );
  }
  if (slug === "bullet-list") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#0f172a" stroke="#06b6d4" strokeWidth={1.2} />
        <rect x="7" y="6.5" width="10" height="1.6" rx="0.5" fill="#06b6d4" />
        <rect x="7" y="10.5" width="2" height="2" rx="0.4" fill="#06b6d4" />
        <rect x="10.5" y="11.1" width="7.5" height="1.2" rx="0.4" fill="#ecfeff" />
        <rect x="7" y="13.5" width="2" height="2" rx="0.4" fill="#066ad4" />
        <rect x="10.5" y="14.1" width="7" height="1.2" rx="0.4" fill="#ecfeff" />
        <rect x="7" y="16.5" width="2" height="2" rx="0.4" fill="#061fd4" />
        <rect x="10.5" y="17.1" width="6.5" height="1.2" rx="0.4" fill="#ecfeff" />
      </svg>
    );
  }
  if (slug.startsWith("dashboard-")) {
    const gradientId = `card-dash-${slug}`;
    const stops =
      slug === "dashboard-ranking"
        ? ["#bbf7d0", "#16a34a"]
        : slug === "dashboard-incentives"
          ? ["#bae6fd", "#0284c7"]
          : slug === "dashboard-defaults"
            ? ["#fecdd3", "#db2777"]
            : ["#ddd6fe", "#7c3aed"];
    const tall = slug === "dashboard-incentives";
    return (
      <svg viewBox="0 0 24 24" aria-hidden {...props}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="100%" stopColor={stops[1]} />
          </linearGradient>
        </defs>
        <rect
          x="3"
          y={tall ? 3 : 4}
          width="18"
          height={tall ? 18 : 16}
          rx="3.5"
          fill={`url(#${gradientId})`}
          stroke="currentColor"
          strokeWidth={1}
        />
        <rect x="5.5" y={tall ? 6 : 7} width="7" height={tall ? 1.2 : 1.4} rx="0.5" fill="#fff" opacity={0.9} />
        {tall ? <rect x="5.5" y="7.8" width="5" height="1" rx="0.4" fill="#fff" opacity={0.75} /> : null}
        <rect x="5.5" y={tall ? 15.5 : 16.5} width={tall ? 6.5 : 5} height={tall ? 3 : 2.2} rx="0.6" fill="#fff" opacity={0.95} />
        <circle cx="17.5" cy={tall ? 6.8 : 7.8} r="1.5" fill="#fff" opacity={0.35} />
        <path
          d={tall ? "M16.5 13.5c1.8-0.2 3.2 0.8 3.8 2.4 0.5 1.3 0.1 2.6-1 3.4" : "M16.5 14.5c1.8-0.2 3.2 0.8 3.8 2.4 0.5 1.3 0.1 2.6-1 3.4"}
          fill="none"
          stroke="#fff"
          strokeWidth={1.2}
          opacity={0.28}
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" {...frame} />
    </svg>
  );
}

interface ResourceIconProps extends React.SVGProps<SVGSVGElement> {
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  imagePath?: string; // If provided, use this exact icon path (legacy support)
  provider?: string; // Direct provider info for icon lookup
  category?: string; // Direct category info for icon lookup  
  file?: string; // Direct file info for icon lookup
  iconType?: "lucide" | "emoji"; // For standard icons from Icons section
  iconName?: string; // Lucide icon name (e.g. "Home", "Shield")
  emoji?: string; // Emoji character for emoji icons
  iconColor?: string; // Color for Lucide icons
  imageUrl?: string; // External URL for generic.icon.custom
  imageOptions?: Partial<CustomImageOptions>;
}

type EmojiSizeSpec = { mode: "px"; size: number } | { mode: "fill" };

/** Avoid parseInt("100%") === 100 — treat % widths as fill-the-glyph-box. */
function resolveEmojiDisplaySize(width: string | number | undefined): EmojiSizeSpec {
  if (typeof width === "number" && Number.isFinite(width) && width > 0) {
    return { mode: "px", size: width };
  }
  if (typeof width === "string") {
    const trimmed = width.trim();
    if (trimmed.endsWith("%")) return { mode: "fill" };
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) return { mode: "px", size: parsed };
  }
  return { mode: "px", size: 70 };
}

function emojiGlyphStyle(sizeSpec: EmojiSizeSpec, extra?: React.CSSProperties): React.CSSProperties {
  const base: React.CSSProperties = {
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...extra,
  };
  if (sizeSpec.mode === "fill") {
    return {
      ...base,
      width: "100%",
      height: "100%",
      fontSize: "min(100cqw, 100cqh)",
    };
  }
  return {
    ...base,
    width: sizeSpec.size,
    height: sizeSpec.size,
    fontSize: sizeSpec.size,
  };
}

export function ResourceIcon({ type, imagePath, provider, category, file, iconType, iconName, emoji, iconColor, imageUrl, imageOptions, ...props }: ResourceIconProps) {
  const [resourceFile, setResourceFile] = useState<string | null>(null);

  // Catalog lookup must run on every render path — hooks stay before any conditional return.
  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    if (type === "generic.icon.custom") {
      return () => ac.abort();
    }
    if (iconType === "emoji" && emoji) {
      return () => ac.abort();
    }
    if (iconType === "lucide") {
      const nameToUse = iconName || type.split(".").pop()?.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") || "";
      if (getLucideIcon(nameToUse)) {
        return () => ac.abort();
      }
    }
    if (type.startsWith("generic.emoji.")) {
      return () => ac.abort();
    }
    if (type.startsWith("generic.icon.")) {
      const iconPart = type.replace("generic.icon.", "");
      const LucideIcon = getLucideIconFromTypeSlug(iconPart) ?? getLucideIcon(iconPart.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(""));
      if (LucideIcon) {
        return () => ac.abort();
      }
    }

    // Lucide icons and emojis don't use the resource catalog - skip lookup
    if (type.startsWith("generic.icon.") || type.startsWith("generic.emoji.")) {
      return () => ac.abort();
    }

    // Vector-only in UI; catalog entry lives under generic.text, not generic.object
    if (isTextBoxHeadingRuntimeType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    // Vector glyph matches CloudShape; catalog PNG differs from canvas
    if (isPaletteVectorCloudType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    if (isTimelineBarPaletteVectorType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    if (isSegmentedRectanglePaletteVectorType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    if (isPyramidPaletteVectorType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    if (isTimelinePaletteVectorType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    if (isMindmapPaletteVectorType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    // Inline SVG glyphs below; generic resource JSON has no `chart` category
    if (isChartNodeType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    // If direct provider info is provided, use it immediately
    if (provider && category && file) {
      setResourceFile(file);
      return () => ac.abort();
    }

    const parts = type.split(".");
    if (parts.length >= 3) {
      const typeProvider = parts[0];
      const typeCategory = parts[1];
      const resourceName = parts.slice(2).join("-").toLowerCase();

      setResourceFile(null);

      loadProviderCatalog(typeProvider)
        .then((catalog) => {
          if (signal.aborted) return;
          const mapping = lookupResourceInCatalog(catalog, type);
          if (!mapping?.file) {
            console.warn(`Resource not found: ${resourceName} in ${typeProvider}.${typeCategory}`);
            return;
          }
          if (
            resourceName === "text-box-heading" ||
            resourceName === "progress-bar" ||
            resourceName === "timeline-bar" ||
            resourceName === "segmented-rectangle" ||
            resourceName === "pyramid" ||
            resourceName === "timeline" ||
            resourceName === "mind-map-node"
          ) {
            setResourceFile(null);
          } else {
            setResourceFile(mapping.file);
          }
        })
        .catch((err: Error) => {
          if (signal.aborted || (err as Error).name === "AbortError") return;
          console.warn(`Failed to load resource catalog for ${typeProvider}:`, err.message);
        });
    }

    return () => ac.abort();
  }, [type, provider, category, file, iconType, iconName, emoji]);

  const iconPath = useMemo(() => {
    if (isTextBoxHeadingRuntimeType(type)) {
      return null;
    }
    if (isProgressBarPaletteVectorType(type)) {
      return null;
    }
    if (isTimelineBarPaletteVectorType(type)) {
      return null;
    }
    if (isSegmentedRectanglePaletteVectorType(type)) {
      return null;
    }
    if (isPyramidPaletteVectorType(type)) {
      return null;
    }
    if (isTimelinePaletteVectorType(type)) {
      return null;
    }
    if (isMindmapPaletteVectorType(type)) {
      return null;
    }
    if (isPaletteVectorCloudType(type)) {
      return null;
    }

    const parts = type.split('.');
    
    // If imagePath is explicitly provided, use only that
    if (imagePath) {
      return imagePath;
    }
    
    // If direct provider info is provided, use it
    if (provider && category && resourceFile) {
      return buildResourceIconPath(provider, category, resourceFile);
    }
    
    // Only use resource catalog lookup - no fallbacks
    if (resourceFile && parts.length >= 3) {
      const typeProvider = parts[0];
      const typeCategory = parts[1];
      return buildResourceIconPath(typeProvider, typeCategory, resourceFile);
    }
    
    return null;
  }, [type, resourceFile, imagePath, provider, category]);

  if (type === "generic.icon.custom") {
    return (
      <CustomIconImage
        imageUrl={imageUrl}
        imageOptions={imageOptions}
        width={props.width}
        height={props.height}
        alt={type}
        style={props.style}
      />
    );
  }

  if (iconType === "emoji" && emoji) {
    const sizeSpec = resolveEmojiDisplaySize(props.width);
    return (
      <span
        role="img"
        aria-label={type}
        style={emojiGlyphStyle(
          sizeSpec,
          typeof props.style === "object" && props.style !== null ? props.style : undefined,
        )}
      >
        {emoji}
      </span>
    );
  }
  if (iconType === "lucide") {
    const nameToUse = iconName || type.split(".").pop()?.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") || "";
    const LucideIcon = getLucideIcon(nameToUse);
    if (LucideIcon) {
      return <LucideIcon {...props} color={iconColor || undefined} />;
    }
  }
  if (type.startsWith("generic.icon.") || type.startsWith("generic.emoji.")) {
    if (type.startsWith("generic.emoji.")) {
      const slug = type.replace("generic.emoji.", "");
      const emojiMap: Record<string, string> = {
        house: "🏠", shield: "🛡️", person: "👤", office: "🏢", heart: "❤️", star: "⭐",
        lock: "🔒", key: "🔑", email: "📧", phone: "📱", globe: "🌐", gear: "⚙️",
        people: "👥", warning: "⚠️", check: "✅", info: "ℹ️", x: "❌", lightning: "⚡",
        cloud: "☁️", database: "🗄️", computer: "💻", rocket: "🚀", bell: "🔔",
        bookmark: "🔖", camera: "📷", document: "📄", folder: "📁", gift: "🎁", location: "📍",
      };
      const emojiChar = emojiMap[slug] || "📌";
      const sizeSpec = resolveEmojiDisplaySize(props.width);
      return (
        <span
          role="img"
          aria-label={type}
          style={emojiGlyphStyle(
            sizeSpec,
            typeof props.style === "object" && props.style !== null ? props.style : undefined,
          )}
        >
          {emojiChar}
        </span>
      );
    }
    const iconPart = type.replace("generic.icon.", "");
    const LucideIcon = getLucideIconFromTypeSlug(iconPart) ?? getLucideIcon(iconPart.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(""));
    if (LucideIcon) {
      return <LucideIcon {...props} color={iconColor || undefined} />;
    }
  }

  if (type === "generic.chart.pie") {
    return <ChartPalettePieGlyph {...props} />;
  }
  if (type === "generic.chart.bar") {
    return <ChartPaletteBarGlyph {...props} />;
  }
  if (type === "generic.chart.line") {
    return <ChartPaletteLineGlyph {...props} />;
  }
  if (type === "generic.chart.ring") {
    return <ChartPaletteRingGlyph {...props} />;
  }
  if (type === "generic.chart.grid") {
    return <ChartPaletteGridGlyph {...props} />;
  }

  if (type?.startsWith("generic.border.")) {
    return <BorderPaletteGlyph type={type} {...props} />;
  }

  if (type?.startsWith("generic.card.")) {
    return <CardPaletteGlyph type={type} {...props} />;
  }

  // Vector preview only: matches the on-canvas shape (rounded body + dark heading strip), not the flat PNG.
  const isTextBoxHeadingType = isTextBoxHeadingRuntimeType(type);

  if (iconPath && !isTextBoxHeadingType) {
    return (
      <img
        src={iconPath}
        alt={type}
        loading="lazy"
        draggable={false}
        onDragStart={(e) => {
          e.preventDefault();
        }}
        onError={() => {
          console.warn(`Icon failed to load for type: ${type}, path: ${iconPath}`);
        }}
        width={props.width || "40"}
        height={props.height || "40"}
        style={{
          width: props.width || "40px",
          height: props.height || "40px",
          objectFit: "contain",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          touchAction: "none",
          ...(typeof props.style === "object" && props.style !== null ? props.style : {}),
        }}
      />
    );
  }


  // Handle shape types (exclude icon/emoji - those use Lucide/emoji above)
  if (!type.startsWith('generic.icon.') && !type.startsWith('generic.emoji.') &&
      (type.startsWith('generic.object.') || type?.endsWith('.square') || type?.endsWith('.circle') ||
      type?.endsWith('.point') || type?.endsWith('.rectangle') || type?.endsWith('.rounded-rectangle') || type?.endsWith('.mind-map-node') || type?.endsWith('.progress-bar') || type?.endsWith('.timeline-bar') || type?.endsWith('.segmented-rectangle') || type?.endsWith('.pyramid') || type?.endsWith('.text-box-heading') ||       type?.endsWith('.triangle') ||
      type?.endsWith('.star') || type?.endsWith('.cloud') || type?.endsWith('.timeline') || type?.endsWith('.parallelogram') ||
      type?.endsWith('.trapezoid') || type?.endsWith('.kite') || type?.endsWith('.hexagon') ||
      type?.endsWith('.pentagon') || type?.endsWith('.octagon') || type?.endsWith('.jigsaw') ||
      type?.endsWith('.arrowhead') || type?.endsWith('.chevron') || type?.endsWith('.uml-class') || isConnectorLineNodeType(type))) {
    
    // Render different shapes based on type
    const shapeType = type.split('.').pop() || 'square';
    
    switch (shapeType) {
      case 'line':
        return (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke={props.stroke || "currentColor"} strokeWidth={props.strokeWidth || 2} strokeLinecap="round">
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        );
      case 'timeline':
        return <PaletteTimelineGlyph {...props} />;
      case 'circle':
      case 'point':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      case 'triangle':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <polygon points="12,2 22,20 2,20" />
          </svg>
        );
      case 'star':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
          </svg>
        );
      case 'cloud':
        return (
          <svg {...props} viewBox={CLOUD_SHAPE_VIEW_BOX} fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth ?? 0}>
            <path d={CLOUD_SHAPE_PATH_D} />
          </svg>
        );
      case 'rectangle':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <rect x="4" y="6" width="16" height="12" />
          </svg>
        );
      case 'rounded-rectangle':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <rect x="4" y="6" width="16" height="12" rx="3" ry="3" />
          </svg>
        );
      case 'mind-map-node':
        return <PaletteMindmapGlyph {...props} />;
      case 'progress-bar':
        return <PaletteProgressBarGlyph {...props} />;
      case 'timeline-bar':
        return <PaletteTimelineBarGlyph {...props} />;
      case 'segmented-rectangle':
        return <PaletteSegmentedRectangleGlyph {...props} />;
      case 'pyramid':
        return <PalettePyramidGlyph {...props} />;
      case 'text-box-heading':
        return (
          <svg
            {...props}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            {/* Inset 3 — fills more of the 24×24 icon frame than the previous 4/5 inset */}
            <rect x="3" y="4" width="18" height="14" rx="2" ry="2" fill="currentColor" opacity={0.09} />
            <path
              d="M 3 6 A 2 2 0 0 1 5 4 L 19 4 A 2 2 0 0 1 21 6 L 21 9.25 L 3 9.25 Z"
              fill="#1f2937"
            />
            <rect
              x="3"
              y="4"
              width="18"
              height="14"
              rx="2"
              ry="2"
              stroke="currentColor"
              strokeWidth={props.strokeWidth ?? 1}
              opacity={0.4}
            />
          </svg>
        );
      case 'uml-class':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "currentColor"} strokeWidth={props.strokeWidth ?? 1}>
            <rect x="4" y="4" width="16" height="16" />
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="14" x2="20" y2="14" />
          </svg>
        );
      default: // square, parallelogram, trapezoid, kite, hexagon, pentagon, octagon, jigsaw, arrowhead, chevron
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <rect x="4" y="4" width="16" height="16" />
          </svg>
        );
    }
  }

  switch (type) {
    case "user":
      return <User {...props} />;
    case "generic.server":
      return <Server {...props} />;
    default:
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      );
  }
}
