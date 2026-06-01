import type { BorderColorMode } from "@/lib/border-types";

export const BORDER_COLOR_MODES: BorderColorMode[] = ["light", "dark"];

export function resolveBorderColorMode(mode: BorderColorMode | undefined): BorderColorMode {
  return mode === "dark" ? "dark" : "light";
}

export interface CornerDiagonalAccentColors {
  canvas: string;
  navy: string;
  gold: string;
}

export interface CornerBlueLayersColors {
  canvas: string;
  navy: string;
  mid: string;
  cyan: string;
  pale: string;
}

export interface BarChamferAccentColors {
  canvas: string;
  navy: string;
  gold: string;
}

export interface WaveTealColors {
  canvas: string;
  darkTeal: string;
  lightTeal: string;
}

export interface CircleWarmColors {
  canvas: string;
  terracotta: string;
  terracottaDark: string;
  ghost: string;
  ghostMid: string;
  accent: string;
  radialInner: string;
  radialOuter: string;
}

export interface FrameTriangleColors {
  canvas: string;
  stroke: string;
  bright: string;
  dark: string;
}

const CORNER_DIAGONAL: Record<BorderColorMode, CornerDiagonalAccentColors> = {
  light: { canvas: "#FFFFFF", navy: "#002060", gold: "#FFC000" },
  dark: { canvas: "#0B1020", navy: "#2563EB", gold: "#FFC000" },
};

const CORNER_BLUE: Record<BorderColorMode, CornerBlueLayersColors> = {
  light: {
    canvas: "#FFFFFF",
    navy: "#002060",
    mid: "#0070C0",
    cyan: "#00B0F0",
    pale: "#E0F2F7",
  },
  dark: {
    canvas: "#0F172A",
    navy: "#1E3A8A",
    mid: "#2563EB",
    cyan: "#38BDF8",
    pale: "#334155",
  },
};

const BAR_CHAMFER: Record<BorderColorMode, BarChamferAccentColors> = {
  light: { canvas: "#FFFFFF", navy: "#002060", gold: "#FFC000" },
  dark: { canvas: "#0B1020", navy: "#1E40AF", gold: "#FFC000" },
};

const WAVE_TEAL: Record<BorderColorMode, WaveTealColors> = {
  light: { canvas: "#FFFFFF", darkTeal: "#1A9C9B", lightTeal: "#BDE4E2" },
  dark: { canvas: "#0F1F1F", darkTeal: "#0D9488", lightTeal: "#134E4A" },
};

const CIRCLE_WARM: Record<BorderColorMode, CircleWarmColors> = {
  light: {
    canvas: "#FDF5F2",
    terracotta: "#B04A33",
    terracottaDark: "#5D2E24",
    ghost: "#F5D5C8",
    ghostMid: "#E8C4B5",
    accent: "#8B3A28",
    radialInner: "#5D2E24",
    radialOuter: "#3D1E18",
  },
  dark: {
    canvas: "#1A1210",
    terracotta: "#C46B54",
    terracottaDark: "#8B3A28",
    ghost: "#3D2926",
    ghostMid: "#2A1C18",
    accent: "#B04A33",
    radialInner: "#5D2E24",
    radialOuter: "#2A1008",
  },
};

const FRAME_TRIANGLE: Record<BorderColorMode, FrameTriangleColors> = {
  light: { canvas: "#FFFFFF", stroke: "#0097A7", bright: "#26A69A", dark: "#004D40" },
  dark: { canvas: "#0F172A", stroke: "#2DD4BF", bright: "#14B8A6", dark: "#0F766E" },
};

export function getCornerDiagonalAccentColors(mode: BorderColorMode | undefined): CornerDiagonalAccentColors {
  return CORNER_DIAGONAL[resolveBorderColorMode(mode)];
}

export function getCornerBlueLayersColors(mode: BorderColorMode | undefined): CornerBlueLayersColors {
  return CORNER_BLUE[resolveBorderColorMode(mode)];
}

export function getBarChamferAccentColors(mode: BorderColorMode | undefined): BarChamferAccentColors {
  return BAR_CHAMFER[resolveBorderColorMode(mode)];
}

export function getWaveTealColors(mode: BorderColorMode | undefined): WaveTealColors {
  return WAVE_TEAL[resolveBorderColorMode(mode)];
}

export function getCircleWarmColors(mode: BorderColorMode | undefined): CircleWarmColors {
  return CIRCLE_WARM[resolveBorderColorMode(mode)];
}

export function getFrameTriangleColors(mode: BorderColorMode | undefined): FrameTriangleColors {
  return FRAME_TRIANGLE[resolveBorderColorMode(mode)];
}
