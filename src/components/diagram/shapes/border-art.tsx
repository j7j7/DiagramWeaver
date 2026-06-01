"use client";

import React, { useId } from "react";
import type { BorderColorMode, BorderRolePaint } from "@/lib/border-types";
import { resolveBorderColorMode } from "@/lib/border-theme";
import { resolveBorderRoleMap } from "@/lib/border-roles";
import { borderRadialGradientDef, borderRoleFillRef, borderRoleGradientDefs } from "@/lib/border-paint";
import { concentricArcBandPath, roundedPolygonPath, roundedTrianglePath } from "@/lib/border-rounded-path";

export interface BorderArtContentProps {
  templateId: string;
  colorMode?: BorderColorMode;
  rolePaints?: Record<string, BorderRolePaint>;
}

function f(uid: string, role: string, paints: Record<string, BorderRolePaint>): string {
  return borderRoleFillRef(uid, role, paints[role] ?? { style: "solid", color: "#888" });
}

/** Decorative SVG art for a border template (viewBox 0 0 24 24). */
export function BorderArtContent({ templateId, colorMode, rolePaints }: BorderArtContentProps) {
  const uid = useId().replace(/:/g, "");
  const mode = resolveBorderColorMode(colorMode);
  const paints = resolveBorderRoleMap(templateId, mode, rolePaints);
  const defs = borderRoleGradientDefs(uid, paints);

  if (templateId === "corner-diagonal-accent") {
    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <polygon points="0,24 0,8 16,24" fill={f(uid, "navy", paints)} />
        <polygon points="0,21 0,13 10,23" fill={f(uid, "gold", paints)} />
        <polygon points="24,0 8,0 24,16" fill={f(uid, "gold", paints)} />
        <polygon points="24,3 14,0 24,11" fill={f(uid, "navy", paints)} />
      </>
    );
  }

  if (templateId === "corner-blue-layers") {
    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <g transform="rotate(-35 4 4)">
          <rect x="-1" y="-1" width="9" height="5" fill={f(uid, "navy", paints)} opacity="0.95" />
          <rect x="1" y="2" width="8" height="4.5" fill={f(uid, "mid", paints)} opacity="0.85" />
          <rect x="3" y="4" width="10" height="4" fill={f(uid, "cyan", paints)} opacity="0.7" />
          <rect x="5" y="6" width="11" height="3.5" fill={f(uid, "pale", paints)} opacity="0.55" />
        </g>
        <g transform="rotate(-35 20 20)">
          <rect x="14" y="15" width="9" height="5" fill={f(uid, "navy", paints)} opacity="0.95" />
          <rect x="15" y="17" width="8" height="4.5" fill={f(uid, "mid", paints)} opacity="0.85" />
          <rect x="13" y="18" width="10" height="4" fill={f(uid, "cyan", paints)} opacity="0.7" />
          <rect x="11" y="19" width="11" height="3.5" fill={f(uid, "pale", paints)} opacity="0.55" />
        </g>
      </>
    );
  }

  if (templateId === "bar-chamfer-accent") {
    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <rect x="0" y="0" width="24" height="2.2" fill={f(uid, "navy", paints)} />
        <polygon points="0,0 6.5,0 4.5,2.2 0,2.2" fill={f(uid, "gold", paints)} />
        <rect x="0" y="21.8" width="24" height="2.2" fill={f(uid, "navy", paints)} />
        <polygon points="24,24 17.5,24 19.5,21.8 24,21.8" fill={f(uid, "gold", paints)} />
      </>
    );
  }

  if (templateId === "wave-teal") {
    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <path
          d="M0 4.5 C3 2.5 6 5.5 9 3.5 C12 1.5 15 4.5 18 2.5 C21 0.5 24 2 24 2 L24 0 L0 0 Z"
          fill={f(uid, "lightTeal", paints)}
        />
        <path
          d="M0 3.2 C3.5 1.2 6.5 4 9.5 2.2 C12.5 0.4 15.5 3.2 18.5 1.4 C21.5 -0.4 24 1.2 24 1.2 L24 0 L0 0 Z"
          fill={f(uid, "darkTeal", paints)}
        />
        <path
          d="M0 19.5 C3 21.5 6 18.5 9 20.5 C12 22.5 15 19.5 18 21.5 C21 23.5 24 22 24 22 L24 24 L0 24 Z"
          fill={f(uid, "lightTeal", paints)}
        />
        <path
          d="M0 20.8 C3.5 22.8 6.5 20 9.5 21.8 C12.5 23.6 15.5 20.8 18.5 22.6 C21.5 24.4 24 22.8 24 22.8 L24 24 L0 24 Z"
          fill={f(uid, "darkTeal", paints)}
        />
      </>
    );
  }

  if (templateId === "circle-warm") {
    const radial = borderRadialGradientDef(
      uid,
      "terracotta",
      paints.terracotta?.color ?? paints.terracotta?.colors?.[0] ?? "#5D2E24",
      paints.accent?.color ?? paints.accent?.colors?.[0] ?? "#3D1E18",
    );
    return (
      <>
        {defs}
        {radial.defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <circle cx="2" cy="3" r="7" fill={f(uid, "ghost", paints)} opacity="0.35" />
        <circle cx="-1" cy="1" r="6" fill={f(uid, "terracotta", paints)} />
        <circle cx="4" cy="6" r="1.8" fill={f(uid, "accent", paints)} />
        <circle cx="22" cy="22" r="8" fill={f(uid, "ghost", paints)} opacity="0.3" />
        <circle cx="19" cy="20" r="6.5" fill={f(uid, "ghost", paints)} opacity="0.45" />
        <circle cx="26" cy="26" r="9" fill={radial.fill} />
        <circle cx="17" cy="18" r="2.5" fill={f(uid, "terracotta", paints)} />
      </>
    );
  }

  if (templateId === "frame-triangle") {
    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <rect
          x="2.5"
          y="2.5"
          width="19"
          height="19"
          fill="none"
          stroke={f(uid, "stroke", paints)}
          strokeWidth="0.8"
        />
        <polygon points="2.5,21.5 2.5,15 8.5,21.5" fill={f(uid, "bright", paints)} />
        <polygon points="2.5,21.5 5.5,21.5 2.5,18.5" fill={f(uid, "dark", paints)} />
        <polygon points="21.5,2.5 15,2.5 21.5,8.5" fill={f(uid, "bright", paints)} />
        <polygon points="21.5,2.5 21.5,5.5 18.5,2.5" fill={f(uid, "dark", paints)} />
      </>
    );
  }

  if (templateId === "curve-gold-frame") {
    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <rect x="0" y="0" width="24" height="2.8" fill={f(uid, "primary", paints)} />
        <rect x="0" y="21.2" width="24" height="2.8" fill={f(uid, "primary", paints)} />
        <path
          d="M24,0 L24,10 C17.5,10 15,6.5 15,2.8 L24,2.8 Z"
          fill={f(uid, "primary", paints)}
        />
        <path
          d="M0,24 L0,14 C6.5,14 9,17.5 9,21.2 L0,21.2 Z"
          fill={f(uid, "primary", paints)}
        />
        <rect
          x="1.1"
          y="2.8"
          width="21.8"
          height="18.4"
          fill="none"
          stroke={f(uid, "accent", paints)}
          strokeWidth="0.45"
        />
        <rect x="1.6" y="3.3" width="20.8" height="17.4" fill={f(uid, "canvas", paints)} />
      </>
    );
  }

  if (templateId === "crystal-poly") {
    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "frame", paints)} />
        <rect x="2" y="2" width="20" height="20" fill={f(uid, "canvas", paints)} />
        <g>
          <polygon points="0,24 0,17 7,24" fill={f(uid, "crystalDark", paints)} />
          <polygon points="0,17 5,15 7,24" fill={f(uid, "crystalMid", paints)} />
          <polygon points="5,15 9,19 7,24" fill={f(uid, "crystalLight", paints)} />
          <polygon points="0,13 5,15 0,17" fill={f(uid, "crystalMid", paints)} />
          <polygon points="9,19 13,22 7,24" fill={f(uid, "crystalDark", paints)} />
          <polygon points="5,15 11,13 9,19" fill={f(uid, "crystalLight", paints)} />
          <polygon points="11,13 15,17 9,19" fill={f(uid, "crystalMid", paints)} />
          <polygon points="0,9 5,15 0,13" fill={f(uid, "crystalLight", paints)} />
          <polygon points="11,13 8,8 5,15" fill={f(uid, "crystalDark", paints)} />
        </g>
        <g>
          <polygon points="24,0 17,0 24,6" fill={f(uid, "crystalDark", paints)} />
          <polygon points="17,0 19,4 24,6" fill={f(uid, "crystalMid", paints)} />
          <polygon points="19,4 15,5 24,9" fill={f(uid, "crystalLight", paints)} />
          <polygon points="15,5 13,2 17,0" fill={f(uid, "crystalLight", paints)} />
          <polygon points="13,2 10,5 15,5" fill={f(uid, "crystalMid", paints)} />
        </g>
      </>
    );
  }

  if (templateId === "rounded-arrow-stack") {
    const r = 0.72;
    const g = 0.28;
    const softWash = roundedPolygonPath(
      [
        [0, 0],
        [14.75, 0],
        [19.15, 8.15],
        [0, 11.45],
      ],
      0.85,
    );
    const topTri = roundedTrianglePath([g, g], [3.88, g], [g, 7.52], r);
    const midTri = roundedTrianglePath([g, 7.8], [3.88, 7.8], [g, 15.04], r);
    const botTri = roundedTrianglePath([g, 15.32], [3.88, 15.32], [g, 23.72], r);
    const pointTri = roundedTrianglePath([4.16, 5.05], [4.16, 17.15], [12.85, 11.1], r);

    return (
      <>
        {defs}
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <path d={softWash} fill={f(uid, "softWash", paints)} />
        <path d={topTri} fill={f(uid, "arrowTop", paints)} />
        <path d={midTri} fill={f(uid, "arrowMid", paints)} />
        <path d={botTri} fill={f(uid, "arrowBottom", paints)} />
        <path d={pointTri} fill={f(uid, "arrowPoint", paints)} />
      </>
    );
  }

  if (templateId === "swoop-blue-layers") {
    const layerShadowId = `${uid}-swoop-layer-shadow`;
    const paleShadowId = `${uid}-swoop-pale-shadow`;
    // Shared circle center left of frame — arcs bulge at mid-height (y=12), pin to corners at top/bottom.
    const cx = -8;
    const cy = 12;
    const swoopDeep = concentricArcBandPath(cx, cy, 12, 14, true);
    const swoopMid = concentricArcBandPath(cx, cy, 14, 15.5);
    const swoopLight = concentricArcBandPath(cx, cy, 15.5, 17.5);
    const swoopPale = concentricArcBandPath(cx, cy, 17.5, 20);

    return (
      <>
        {defs}
        <defs>
          <filter id={layerShadowId} x="-15%" y="-10%" width="130%" height="120%">
            <feDropShadow dx="0.2" dy="0.12" stdDeviation="0.22" floodColor="#475569" floodOpacity="0.22" />
          </filter>
          <filter id={paleShadowId} x="-25%" y="-15%" width="150%" height="130%">
            <feDropShadow dx="0.45" dy="0.2" stdDeviation="0.55" floodColor="#64748b" floodOpacity="0.4" />
          </filter>
        </defs>
        <rect width="24" height="24" fill={f(uid, "canvas", paints)} />
        <rect
          x="0"
          y="10.4"
          width="24"
          height="3.6"
          fill={f(uid, "midBand", paints)}
          opacity="0.16"
        />
        <path d={swoopDeep} fill={f(uid, "swoopDeep", paints)} />
        <path d={swoopMid} fill={f(uid, "swoopMid", paints)} filter={`url(#${layerShadowId})`} />
        <path d={swoopLight} fill={f(uid, "swoopLight", paints)} filter={`url(#${layerShadowId})`} />
        <path d={swoopPale} fill={f(uid, "swoopPale", paints)} filter={`url(#${paleShadowId})`} />
      </>
    );
  }

  return <rect width="24" height="24" fill={f(uid, "canvas", paints)} />;
}

export function BorderPaletteGlyph({
  type,
  colorMode,
  rolePaints,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  type: string;
  colorMode?: BorderColorMode;
  rolePaints?: Record<string, BorderRolePaint>;
}) {
  const templateId = type.replace(/^generic\.border\./, "");
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <BorderArtContent templateId={templateId} colorMode={colorMode} rolePaints={rolePaints} />
    </svg>
  );
}
