import type { BorderTemplate } from "@/lib/border-types";
import type { DiagramNodeData } from "@/lib/types";

/** Built-in slide border templates (palette + drop defaults). */
export const BORDER_TEMPLATES: Record<string, BorderTemplate> = {
  "corner-diagonal-accent": {
    id: "corner-diagonal-accent",
    name: "Corner Diagonal Accent",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "corner-blue-layers": {
    id: "corner-blue-layers",
    name: "Corner Blue Layers",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "bar-chamfer-accent": {
    id: "bar-chamfer-accent",
    name: "Bar Chamfer Accent",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "wave-teal": {
    id: "wave-teal",
    name: "Wave Teal",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "circle-warm": {
    id: "circle-warm",
    name: "Circle Warm",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "frame-triangle": {
    id: "frame-triangle",
    name: "Frame Triangle",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "curve-gold-frame": {
    id: "curve-gold-frame",
    name: "Curve Gold Frame",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "crystal-poly": {
    id: "crystal-poly",
    name: "Crystal Poly",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "rounded-arrow-stack": {
    id: "rounded-arrow-stack",
    name: "Rounded Arrow Stack",
    defaultWidth: 960,
    defaultHeight: 540,
  },
  "swoop-blue-layers": {
    id: "swoop-blue-layers",
    name: "Swoop Blue Layers",
    defaultWidth: 960,
    defaultHeight: 540,
  },
};

export const BORDER_TEMPLATE_LIST = Object.values(BORDER_TEMPLATES);

export function getBorderTemplate(templateId: string): BorderTemplate | undefined {
  return BORDER_TEMPLATES[templateId];
}

/** Node-level defaults when dropping a border from the palette. */
export function defaultBorderPaletteNodeProps(_templateId: string): Partial<DiagramNodeData> {
  return {
    sizeMode: "custom",
    borderStyle: "none",
    backgroundStyle: "none",
    shadow: false,
    label: "",
  };
}
