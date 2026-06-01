import type { BorderColorMode, BorderRoleDefinition, BorderRolePaint } from "@/lib/border-types";
import { resolveBorderColorMode } from "@/lib/border-theme-colors";

function solid(color: string): BorderRolePaint {
  return { style: "solid", color };
}

function gradient(colors: [string, string], angle = 135): BorderRolePaint {
  return { style: "gradient", colors, angle };
}

const BORDER_ROLE_DEFINITIONS: Record<string, BorderRoleDefinition[]> = {
  "corner-diagonal-accent": [
    { id: "canvas", label: "Canvas", defaultLight: solid("#FFFFFF"), defaultDark: solid("#0B1020") },
    { id: "navy", label: "Navy accent", defaultLight: solid("#002060"), defaultDark: solid("#2563EB") },
    { id: "gold", label: "Gold accent", defaultLight: solid("#FFC000"), defaultDark: solid("#FFC000") },
  ],
  "corner-blue-layers": [
    { id: "canvas", label: "Canvas", defaultLight: solid("#FFFFFF"), defaultDark: solid("#0F172A") },
    { id: "navy", label: "Deep blue", defaultLight: solid("#002060"), defaultDark: solid("#1E3A8A") },
    { id: "mid", label: "Mid blue", defaultLight: solid("#0070C0"), defaultDark: solid("#2563EB") },
    { id: "cyan", label: "Cyan", defaultLight: solid("#00B0F0"), defaultDark: solid("#38BDF8") },
    { id: "pale", label: "Pale blue", defaultLight: solid("#E0F2F7"), defaultDark: solid("#334155") },
  ],
  "bar-chamfer-accent": [
    { id: "canvas", label: "Canvas", defaultLight: solid("#FFFFFF"), defaultDark: solid("#0B1020") },
    { id: "navy", label: "Bar", defaultLight: solid("#002060"), defaultDark: solid("#1E40AF") },
    { id: "gold", label: "Chamfer", defaultLight: solid("#FFC000"), defaultDark: solid("#FFC000") },
  ],
  "wave-teal": [
    { id: "canvas", label: "Canvas", defaultLight: solid("#FFFFFF"), defaultDark: solid("#0F1F1F") },
    { id: "darkTeal", label: "Wave (dark)", defaultLight: solid("#1A9C9B"), defaultDark: solid("#0D9488") },
    { id: "lightTeal", label: "Wave (light)", defaultLight: solid("#BDE4E2"), defaultDark: solid("#134E4A") },
  ],
  "circle-warm": [
    { id: "canvas", label: "Canvas", defaultLight: solid("#FDF5F2"), defaultDark: solid("#1A1210") },
    { id: "terracotta", label: "Terracotta", defaultLight: solid("#B04A33"), defaultDark: solid("#C46B54") },
    { id: "accent", label: "Accent", defaultLight: solid("#8B3A28"), defaultDark: solid("#B04A33") },
    { id: "ghost", label: "Soft wash", defaultLight: solid("#F5D5C8"), defaultDark: solid("#3D2926") },
  ],
  "frame-triangle": [
    { id: "canvas", label: "Canvas", defaultLight: solid("#FFFFFF"), defaultDark: solid("#0F172A") },
    { id: "stroke", label: "Frame line", defaultLight: solid("#0097A7"), defaultDark: solid("#2DD4BF") },
    { id: "bright", label: "Corner (bright)", defaultLight: solid("#26A69A"), defaultDark: solid("#14B8A6") },
    { id: "dark", label: "Corner (dark)", defaultLight: solid("#004D40"), defaultDark: solid("#0F766E") },
  ],
  "curve-gold-frame": [
    { id: "canvas", label: "Content area", defaultLight: solid("#FFFFFF"), defaultDark: solid("#111827") },
    {
      id: "primary",
      label: "Navy bars & curves",
      defaultLight: gradient(["#000066", "#001a99"], 160),
      defaultDark: gradient(["#1e3a8a", "#0f172a"], 160),
    },
    {
      id: "accent",
      label: "Gold frame",
      defaultLight: gradient(["#FFB800", "#FFD54F"], 90),
      defaultDark: gradient(["#FFC000", "#FFA000"], 90),
    },
  ],
  "crystal-poly": [
    { id: "frame", label: "Outer frame", defaultLight: solid("#DDEBFA"), defaultDark: solid("#1e293b") },
    { id: "canvas", label: "Content area", defaultLight: solid("#FFFFFF"), defaultDark: solid("#0f172a") },
    {
      id: "crystalLight",
      label: "Crystal (light)",
      defaultLight: gradient(["#7dd3fc", "#38bdf8"], 135),
      defaultDark: gradient(["#67e8f9", "#22d3ee"], 135),
    },
    {
      id: "crystalMid",
      label: "Crystal (mid)",
      defaultLight: gradient(["#3b82f6", "#1d4ed8"], 120),
      defaultDark: gradient(["#2563eb", "#1e40af"], 120),
    },
    {
      id: "crystalDark",
      label: "Crystal (dark)",
      defaultLight: gradient(["#1e40af", "#0c2d6b"], 145),
      defaultDark: gradient(["#1e3a8a", "#0f172a"], 145),
    },
  ],
  "rounded-arrow-stack": [
    { id: "canvas", label: "Content area", defaultLight: solid("#FFFFFF"), defaultDark: solid("#111827") },
    { id: "softWash", label: "Soft wash", defaultLight: solid("#E8E8E8"), defaultDark: solid("#1f2937") },
    {
      id: "arrowTop",
      label: "Arrow (top)",
      defaultLight: gradient(["#F5C842", "#F0A830"], 135),
      defaultDark: gradient(["#FBBF24", "#D97706"], 135),
    },
    {
      id: "arrowMid",
      label: "Arrow (middle)",
      defaultLight: gradient(["#F08B72", "#E87055"], 120),
      defaultDark: gradient(["#FB7185", "#E11D48"], 120),
    },
    {
      id: "arrowBottom",
      label: "Arrow (bottom)",
      defaultLight: gradient(["#E0424B", "#C62828"], 145),
      defaultDark: gradient(["#F87171", "#B91C1C"], 145),
    },
    {
      id: "arrowPoint",
      label: "Arrow point",
      defaultLight: gradient(["#8E4585", "#5B2C6F"], 90),
      defaultDark: gradient(["#A855F7", "#6B21A8"], 90),
    },
  ],
  "swoop-blue-layers": [
    { id: "canvas", label: "Content area", defaultLight: solid("#FFFFFF"), defaultDark: solid("#0f172a") },
    {
      id: "midBand",
      label: "Center band",
      defaultLight: solid("#A9DDF3"),
      defaultDark: solid("#1e3a5f"),
    },
    {
      id: "swoopDeep",
      label: "Swoop (deep)",
      defaultLight: gradient(["#1A337E", "#0f2557"], 165),
      defaultDark: gradient(["#1e40af", "#0f172a"], 165),
    },
    {
      id: "swoopMid",
      label: "Swoop (mid)",
      defaultLight: gradient(["#5DA7E3", "#3d8fd4"], 155),
      defaultDark: gradient(["#3b82f6", "#1d4ed8"], 155),
    },
    {
      id: "swoopLight",
      label: "Swoop (light)",
      defaultLight: gradient(["#A9DDF3", "#7ec8eb"], 145),
      defaultDark: gradient(["#67e8f9", "#0891b2"], 145),
    },
    {
      id: "swoopPale",
      label: "Swoop (pale)",
      defaultLight: gradient(["#E1F1F8", "#c5e4f5"], 135),
      defaultDark: gradient(["#bae6fd", "#7dd3fc"], 135),
    },
  ],
};

export function getBorderRoleDefinitions(templateId: string): BorderRoleDefinition[] {
  return BORDER_ROLE_DEFINITIONS[templateId] ?? [];
}

export function resolveBorderRolePaint(
  templateId: string,
  roleId: string,
  colorMode: BorderColorMode | undefined,
  overrides?: Record<string, BorderRolePaint>,
): BorderRolePaint {
  const mode = resolveBorderColorMode(colorMode);
  const def = getBorderRoleDefinitions(templateId).find((r) => r.id === roleId);
  const base = def ? (mode === "dark" ? def.defaultDark : def.defaultLight) : solid("#888888");
  const override = overrides?.[roleId];
  if (!override) return { ...base };
  return {
    style: override.style ?? base.style,
    color: override.color ?? base.color,
    colors: override.colors ?? base.colors,
    angle: override.angle ?? base.angle,
  };
}

export function resolveBorderRoleMap(
  templateId: string,
  colorMode: BorderColorMode | undefined,
  overrides?: Record<string, BorderRolePaint>,
): Record<string, BorderRolePaint> {
  const defs = getBorderRoleDefinitions(templateId);
  const out: Record<string, BorderRolePaint> = {};
  for (const def of defs) {
    out[def.id] = resolveBorderRolePaint(templateId, def.id, colorMode, overrides);
  }
  return out;
}
