import type { CustomImageOptions, MeshGradientPoint, NodeSize, RichTextRun } from "@/lib/types";

/** Element kinds inside a card layout tree. */
export type CardElementKind =
  | "section"
  | "text"
  | "icon-slot"
  | "tag"
  | "decor";

export type CardFlexAlign = "start" | "center" | "end" | "stretch" | "baseline";
export type CardFlexJustify = "start" | "center" | "end" | "space-between";

/** CSS-flex-like box model for card regions (percent strings scale with card resize). */
export interface CardLayoutBox {
  flex?: number;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  padding?: number | [number, number] | [number, number, number, number];
  gap?: number;
  flexDirection?: "row" | "column";
  alignItems?: CardFlexAlign;
  justifyContent?: CardFlexJustify;
  alignSelf?: CardFlexAlign;
  marginTop?: number;
  marginBottom?: number;
  zIndex?: number;
  borderRadius?: number;
  overflow?: "hidden" | "visible";
  /** When true, text region keeps its flex slot even with no visible content. */
  fillRemaining?: boolean;
}

export type CardBackgroundStyle = "solid" | "gradient" | "none" | "mesh_gradient";

export interface CardElementStyle {
  backgroundColor?: string;
  backgroundStyle?: CardBackgroundStyle;
  backgroundColors?: [string, string];
  gradientAngle?: number;
  meshGradientPoints?: MeshGradientPoint[];
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted";
  opacity?: number;
  borderRadius?: number;
}

/** Glyph alignment inside an icon-slot (slot box stays fixed; icon moves within it). */
export type CardIconPlacement =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** How card icon-slot glyph dimensions respond to slot resize. */
export type CardIconSizeMode = "fixed" | "scaled";

/** Icon/image dropped into an icon-slot region. */
export interface CardIconRef {
  type: string;
  provider?: string;
  category?: string;
  file?: string;
  iconType?: "lucide" | "emoji";
  iconName?: string;
  emoji?: string;
  iconColor?: string;
  iconOpacity?: number;
  nodeSize?: NodeSize;
  /** Scaled (default): size follows slot; fixed: constant px from nodeSize preset. */
  iconSizeMode?: CardIconSizeMode;
  /** When true, hide the icon tile background (card icon-slot glyph). */
  noIconBackground?: boolean;
  imageUrl?: string;
  imageOptions?: CustomImageOptions;
}

export interface CardElementData {
  id: string;
  kind: CardElementKind;
  layout?: CardLayoutBox;
  style?: CardElementStyle;
  text?: string;
  richText?: RichTextRun[];
  tag?: string;
  children?: CardElementData[];
  iconRef?: CardIconRef;
  /** Position of the icon glyph inside an icon-slot (default center). */
  iconPlacement?: CardIconPlacement;
  /** Visual hint when icon-slot is empty. */
  placeholder?: "circle" | "rect" | "dots";
  /** When true, dropped icon fills the slot (typical for circle avatars). */
  iconFillSlot?: boolean;
  /** When true, icon-slot outline uses the card shell border. */
  matchCardBorder?: boolean;
  /** When true, icon-slot uses the same drop shadow as the card shell. */
  iconSlotShadow?: boolean;
  /** Decorative watermark icon — large, bottom-right, soft gradient fade. */
  iconDecorGradient?: boolean;
  editable?: boolean;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  lineHeight?: number;
}

export interface CardTemplate {
  id: string;
  name: string;
  defaultWidth: number;
  defaultHeight: number;
  cornerRadius?: number;
  root: CardElementData;
}

/** Card instance stored on `DiagramNodeData.card`. */
export interface NodeCardSpec {
  templateId: string;
  elements: CardElementData;
}

export const CARD_NODE_TYPE_PREFIX = "generic.card.";
