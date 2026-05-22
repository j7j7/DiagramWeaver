import type { CSSProperties } from "react";
import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import { findCardElement, updateCardElementTree } from "@/lib/card-utils";
import {
  PROFILE_BODY_ID,
  PROFILE_HERO_ID,
  PROFILE_SUBTITLE_ID,
  PROFILE_TITLE_ID,
} from "@/lib/card-profile";

export const PROFILE_DIAGONAL_SPLIT_TEMPLATE_ID = "profile-diagonal-split";
export const PROFILE_DIAGONAL_CONTENT_ID = "content";
export const PROFILE_DIAGONAL_AVATAR_ID = "avatar";
export const PROFILE_DIAGONAL_SPLIT_LINE_ID = "split-line";

const DEFAULT_SPLIT_START_PCT = 52;
const MIN_SPLIT_START_PCT = 5;
const MAX_SPLIT_START_PCT = 92;
const DEFAULT_SPLIT_END_PCT = 100;
const MIN_SPLIT_END_PCT = 50;
const MAX_SPLIT_END_PCT = 100;
const DEFAULT_SPLIT_CURVE_PCT = 18;
const MIN_SPLIT_CURVE_PCT = 6;
const MAX_SPLIT_CURVE_PCT = 36;

const DEFAULT_AVATAR_SIZE = 48;
const MIN_AVATAR_SIZE = 32;
const MAX_AVATAR_SIZE = 72;

export interface DiagonalSplitGeometry {
  startLeftPct: number;
  endBottomPct: number;
  curvePct: number;
}

export function isProfileDiagonalSplitCard(templateId: string | undefined): boolean {
  return templateId === PROFILE_DIAGONAL_SPLIT_TEMPLATE_ID;
}

export function getProfileDiagonalSplitRegions(root: CardElementData | undefined): {
  hero: CardElementData | null;
  body: CardElementData | null;
  avatar: CardElementData | null;
  title: CardElementData | null;
  subtitle: CardElementData | null;
  splitLine: CardElementData | null;
} {
  if (!root?.children?.length) {
    return { hero: null, body: null, avatar: null, title: null, subtitle: null, splitLine: null };
  }
  const hero = root.children.find((c) => c.id === PROFILE_HERO_ID) ?? null;
  const body = root.children.find((c) => c.id === PROFILE_BODY_ID) ?? null;
  const splitLine = root.children.find((c) => c.id === PROFILE_DIAGONAL_SPLIT_LINE_ID) ?? null;
  const content = root.children.find((c) => c.id === PROFILE_DIAGONAL_CONTENT_ID) ?? null;
  const avatar =
    root.children.find((c) => c.id === PROFILE_DIAGONAL_AVATAR_ID) ??
    content?.children?.find((c) => c.id === PROFILE_DIAGONAL_AVATAR_ID) ??
    null;
  const textStack = content?.children?.find((c) => c.id === "text-stack") ?? null;
  const title = textStack?.children?.find((c) => c.id === PROFILE_TITLE_ID) ?? null;
  const subtitle = textStack?.children?.find((c) => c.id === PROFILE_SUBTITLE_ID) ?? null;
  return { hero, body, avatar, title, subtitle, splitLine };
}

function clampSplitStartPct(n: number): number {
  return Math.min(MAX_SPLIT_START_PCT, Math.max(MIN_SPLIT_START_PCT, Math.round(n)));
}

function clampSplitEndPct(n: number): number {
  return Math.min(MAX_SPLIT_END_PCT, Math.max(MIN_SPLIT_END_PCT, Math.round(n)));
}

function clampSplitCurvePct(n: number): number {
  return Math.min(MAX_SPLIT_CURVE_PCT, Math.max(MIN_SPLIT_CURVE_PCT, Math.round(n)));
}

function clampAvatarSize(n: number): number {
  return Math.min(MAX_AVATAR_SIZE, Math.max(MIN_AVATAR_SIZE, Math.round(n)));
}

function parsePercentLayoutDim(v: number | string | undefined, fallback: number): number {
  if (typeof v === "string" && v.endsWith("%")) {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

/** Split curve start on the left edge (% from top). Stored on hero.layout.flex. */
export function parseDiagonalSplitStartPct(hero: CardElementData | null | undefined): number {
  if (typeof hero?.layout?.flex === "number" && Number.isFinite(hero.layout.flex) && hero.layout.flex > 0) {
    return clampSplitStartPct(hero.layout.flex);
  }
  return DEFAULT_SPLIT_START_PCT;
}

/** @deprecated use parseDiagonalSplitStartPct */
export function parseDiagonalSplitLeftPct(hero: CardElementData | null | undefined): number {
  return parseDiagonalSplitStartPct(hero);
}

/** Split curve end on the bottom edge (% from left). Stored on hero.layout.height. */
export function parseDiagonalSplitEndPct(hero: CardElementData | null | undefined): number {
  const raw = parsePercentLayoutDim(hero?.layout?.height, DEFAULT_SPLIT_END_PCT);
  return clampSplitEndPct(raw);
}

/** Bulge of the curved split boundary. Stored on hero.layout.gap. */
export function parseDiagonalSplitCurvePct(hero: CardElementData | null | undefined): number {
  if (typeof hero?.layout?.gap === "number" && Number.isFinite(hero.layout.gap) && hero.layout.gap > 0) {
    return clampSplitCurvePct(hero.layout.gap);
  }
  return DEFAULT_SPLIT_CURVE_PCT;
}

export function diagonalSplitGeometryFromHero(
  hero: CardElementData | null | undefined,
): DiagonalSplitGeometry {
  return {
    startLeftPct: parseDiagonalSplitStartPct(hero),
    endBottomPct: parseDiagonalSplitEndPct(hero),
    curvePct: parseDiagonalSplitCurvePct(hero),
  };
}

export function parseProfileDiagonalAvatarSize(avatar: CardElementData | null | undefined): number {
  const w = avatar?.layout?.width;
  if (typeof w === "number" && Number.isFinite(w) && w > 0) {
    return clampAvatarSize(w);
  }
  return DEFAULT_AVATAR_SIZE;
}

export function applyDiagonalSplitStartPct(elements: CardElementData, pct: number): CardElementData {
  const hero = findCardElement(elements, PROFILE_HERO_ID);
  if (!hero) return elements;
  return updateCardElementTree(elements, PROFILE_HERO_ID, {
    layout: { ...hero.layout, flex: clampSplitStartPct(pct) },
  });
}

/** @deprecated use applyDiagonalSplitStartPct */
export function applyDiagonalSplitLeftPct(elements: CardElementData, pct: number): CardElementData {
  return applyDiagonalSplitStartPct(elements, pct);
}

export function applyDiagonalSplitEndPct(elements: CardElementData, pct: number): CardElementData {
  const hero = findCardElement(elements, PROFILE_HERO_ID);
  if (!hero) return elements;
  const end = clampSplitEndPct(pct);
  return updateCardElementTree(elements, PROFILE_HERO_ID, {
    layout: { ...hero.layout, height: `${end}%` },
  });
}

export function applyDiagonalSplitCurvePct(elements: CardElementData, pct: number): CardElementData {
  const hero = findCardElement(elements, PROFILE_HERO_ID);
  if (!hero) return elements;
  return updateCardElementTree(elements, PROFILE_HERO_ID, {
    layout: { ...hero.layout, gap: clampSplitCurvePct(pct) },
  });
}

export function applyProfileDiagonalAvatarSize(elements: CardElementData, sizePx: number): CardElementData {
  const size = clampAvatarSize(sizePx);
  const avatar = findCardElement(elements, PROFILE_DIAGONAL_AVATAR_ID);
  if (!avatar) return elements;
  return updateCardElementTree(elements, PROFILE_DIAGONAL_AVATAR_ID, {
    layout: { ...avatar.layout, width: size, height: size, flex: 0 },
  });
}

export function updateProfileDiagonalElementStyle(
  elements: CardElementData,
  elementId: string,
  stylePatch: Partial<CardElementStyle>,
): CardElementData {
  const el = findCardElement(elements, elementId);
  if (!el) return elements;
  return updateCardElementTree(elements, elementId, {
    style: { ...el.style, ...stylePatch },
  });
}

function splitCurveControlPoints(geo: DiagonalSplitGeometry): {
  s: number;
  e: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
} {
  const s = clampSplitStartPct(geo.startLeftPct) / 100;
  const e = clampSplitEndPct(geo.endBottomPct) / 100;
  const bulge = clampSplitCurvePct(geo.curvePct) / 100;
  const c1x = Math.max(e - bulge * 0.2, s + 0.08);
  const c1y = 1;
  const c2x = bulge * 0.55;
  const c2y = s + (1 - s) * 0.65;
  return { s, e, c1x, c1y, c2x, c2y };
}

/** Accent region in 0–1 objectBoundingBox space (top-right panel with curved hypotenuse). */
export function diagonalSplitAccentPathD(geo: DiagonalSplitGeometry): string {
  const { s, e, c1x, c1y, c2x, c2y } = splitCurveControlPoints(geo);
  return `M 0 0 L 1 0 L 1 1 L ${e} 1 C ${c1x} ${c1y} ${c2x} ${c2y} 0 ${s} Z`;
}

/** Body region — shares the same cubic edge as the accent (no gap at the curve). */
export function diagonalSplitBodyPathD(geo: DiagonalSplitGeometry): string {
  const { s, e, c1x, c1y, c2x, c2y } = splitCurveControlPoints(geo);
  return `M 0 ${s} C ${c2x} ${c2y} ${c1x} ${c1y} ${e} 1 L 0 1 Z`;
}

export function diagonalSplitAccentClipStyle(clipUrl: string): CSSProperties {
  return {
    clipPath: clipUrl,
    WebkitClipPath: clipUrl,
  };
}

function diagonalShellInsetBox(
  shellInsetPx: number,
  innerRadius?: string,
): Pick<CSSProperties, "top" | "right" | "bottom" | "left" | "borderRadius"> {
  if (shellInsetPx <= 0) return {};
  return {
    top: shellInsetPx,
    right: shellInsetPx,
    bottom: shellInsetPx,
    left: shellInsetPx,
    borderRadius: innerRadius,
  };
}

export function profileDiagonalBodyLayerStyle(
  elementId: string,
  templateId: string | undefined,
  bodyClipUrl: string,
  shellInsetPx = 0,
  innerRadius?: string,
): CSSProperties | undefined {
  if (!isProfileDiagonalSplitCard(templateId) || elementId !== PROFILE_BODY_ID) return undefined;
  return {
    position: "absolute",
    ...diagonalShellInsetBox(shellInsetPx, innerRadius),
    zIndex: 0,
    overflow: "hidden",
    ...diagonalSplitAccentClipStyle(bodyClipUrl),
  };
}

export function profileDiagonalHeroLayerStyle(
  elementId: string,
  templateId: string | undefined,
  accentClipUrl: string,
  shellInsetPx = 0,
  innerRadius?: string,
): CSSProperties | undefined {
  if (!isProfileDiagonalSplitCard(templateId) || elementId !== PROFILE_HERO_ID) return undefined;
  return {
    position: "absolute",
    ...diagonalShellInsetBox(shellInsetPx, innerRadius),
    zIndex: 1,
    pointerEvents: "none",
    overflow: "hidden",
    ...diagonalSplitAccentClipStyle(accentClipUrl),
  };
}

export function profileDiagonalContentLayerStyle(
  elementId: string,
  templateId: string | undefined,
  shellInsetPx = 0,
  innerRadius?: string,
): CSSProperties | undefined {
  if (!isProfileDiagonalSplitCard(templateId) || elementId !== PROFILE_DIAGONAL_CONTENT_ID) return undefined;
  return {
    position: "absolute",
    ...diagonalShellInsetBox(shellInsetPx, innerRadius),
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  };
}

export function resolveProfileDiagonalTextStackLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardElementData["layout"],
): CardElementData["layout"] | undefined {
  if (!isProfileDiagonalSplitCard(templateId) || elementId !== "text-stack") return layout;
  return { ...layout, flex: 1, minHeight: 0, width: "100%" };
}

export function resolveProfileDiagonalAvatarLayout(
  elementId: string,
  templateId: string | undefined,
  layout: CardElementData["layout"],
): CardElementData["layout"] | undefined {
  if (!isProfileDiagonalSplitCard(templateId) || elementId !== PROFILE_DIAGONAL_AVATAR_ID) return layout;
  const size = parseProfileDiagonalAvatarSize({ id: elementId, kind: "icon-slot", layout });
  return { ...layout, width: size, height: size, flex: 0 };
}

export function profileDiagonalAvatarSlotStyle(
  elementId: string,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isProfileDiagonalSplitCard(templateId) || elementId !== PROFILE_DIAGONAL_AVATAR_ID) return undefined;
  return {
    position: "absolute",
    top: "8%",
    right: "8%",
    zIndex: 4,
    pointerEvents: "auto",
  };
}

export function profileDiagonalRootLayerStyle(
  isRoot: boolean,
  templateId: string | undefined,
): CSSProperties | undefined {
  if (!isRoot || !isProfileDiagonalSplitCard(templateId)) return undefined;
  return { position: "relative", width: "100%", height: "100%", minHeight: 0, minWidth: 0 };
}

/** Preserve absolute layer positioning — do not override with `relative` for mesh/handles. */
export function profileDiagonalSectionPosition(
  elementId: string,
  templateId: string | undefined,
  fallback?: CSSProperties["position"],
): CSSProperties["position"] | undefined {
  if (!isProfileDiagonalSplitCard(templateId)) return fallback;
  if (elementId === PROFILE_BODY_ID || elementId === PROFILE_HERO_ID || elementId === PROFILE_DIAGONAL_CONTENT_ID) {
    return "absolute";
  }
  if (elementId === "root") return "relative";
  return fallback;
}

export const DIAGONAL_SPLIT_START_MIN = MIN_SPLIT_START_PCT;
export const DIAGONAL_SPLIT_START_MAX = MAX_SPLIT_START_PCT;
export const DIAGONAL_SPLIT_END_MIN = MIN_SPLIT_END_PCT;
export const DIAGONAL_SPLIT_END_MAX = MAX_SPLIT_END_PCT;
export const DIAGONAL_SPLIT_CURVE_MIN = MIN_SPLIT_CURVE_PCT;
export const DIAGONAL_SPLIT_CURVE_MAX = MAX_SPLIT_CURVE_PCT;
