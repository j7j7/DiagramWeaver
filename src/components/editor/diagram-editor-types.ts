import type { DiagramConnectionData, DiagramNodeData } from "@/lib/types";

/**
 * Canvas selection union used by the editor shell, toolbar, and JSON panel focus.
 * Kept in a dedicated module so consumers avoid importing the full diagram editor bundle.
 */
export type SelectedItem = (
  | (DiagramNodeData & {
      itemType: "node";
      id: string;
      borderColor?: string;
      textColor?: string;
      backgroundColor?: string;
      borderStyle?: "solid" | "dotted" | "gradient" | "none";
      borderColors?: string[];
      backgroundStyle?: "solid" | "gradient" | "frosted" | "none" | "mesh_gradient";
      backgroundColors?: string[];
      frostedDiffusion?: number;
      frostedTransparency?: number;
      frostedPerlinNoise?: number;
      gradientAngle?: number;
      shadow?: boolean;
      rotation?: number;
      textPosition?: "above" | "center" | "under";
      textJustify?: "left" | "center" | "right" | "full";
      textVerticalPosition?: "top" | "middle" | "bottom";
      fontFamily?: string;
      fontSize?: number;
      fontWeight?:
        | "normal"
        | "bold"
        | "100"
        | "200"
        | "300"
        | "400"
        | "500"
        | "600"
        | "700"
        | "800"
        | "900";
      fontStyle?: "normal" | "italic" | "oblique";
      textDecoration?: "none" | "underline" | "overline" | "line-through";
      textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
      letterSpacing?: number;
      lineHeight?: number;
      textOpacity?: number;
      borderWidth?: number;
      objectStyle?: string;
      width?: number;
      height?: number;
      sizeMode?: "auto" | "custom";
      minWidth?: number;
      minHeight?: number;
      orientation?: "horizontal" | "vertical" | "square";
      maxItemsPerRow?: number;
      lineColor?: string;
      parentId?: string;
      tag?: string;
      tagPosition?:
        | "top-left"
        | "top-center"
        | "top-right"
        | "bottom-left"
        | "bottom-center"
        | "bottom-right";
    })
  | (DiagramConnectionData & {
      itemType: "edge";
      id: string;
      freeflow?: boolean;
      edgePosition?: number;
    })
);

export interface PaletteResource {
  name: string;
  file?: string;
  type?: string;
  hasWhiteVariant?: boolean;
  format?: string;
  iconType?: string;
  iconName?: string;
  emoji?: string;
}

export interface PaletteSelection {
  resource: PaletteResource;
  provider: string;
  category: string;
}
