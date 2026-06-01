/** Slide border / base frame templates (`generic.border.*`). */
export const BORDER_NODE_TYPE_PREFIX = "generic.border.";

export type BorderColorMode = "light" | "dark";

export type BorderPaintStyle = "solid" | "gradient";

/** Solid or linear-gradient fill for a border template color role. */
export interface BorderRolePaint {
  style?: BorderPaintStyle;
  color?: string;
  colors?: [string, string];
  angle?: number;
}

export interface BorderTemplate {
  id: string;
  name: string;
  defaultWidth: number;
  defaultHeight: number;
}

export interface BorderRoleDefinition {
  id: string;
  label: string;
  defaultLight: BorderRolePaint;
  defaultDark: BorderRolePaint;
}

/** Border instance stored on `DiagramNodeData.border`. */
export interface NodeBorderSpec {
  templateId: string;
  /** Decorative palette — light (default) or dark slide base. */
  colorMode?: BorderColorMode;
  /** Per-role paint overrides (solid or gradient). */
  rolePaints?: Record<string, BorderRolePaint>;
}
