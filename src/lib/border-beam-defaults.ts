/** Defaults for animated border beam (Visual Styling → Border beam). */

export const BORDER_BEAM_DEFAULT_COLORS = ["#fffbeb", "#fbbf24", "#ea580c"] as const;

export const BORDER_BEAM_DEFAULT_DURATION_SEC = 4;

/** Portion of the outline occupied by the bright segment (0–1). */
export const BORDER_BEAM_DEFAULT_LENGTH = 0.18;

/** Extra blur radius in px (filter stdDeviation). */
export const BORDER_BEAM_DEFAULT_GLOW = 6;

/** Stroke width of the beam line in px. */
export const BORDER_BEAM_DEFAULT_WIDTH = 3;

/** Relative variation of segment length for undulation (0–0.25). */
export const BORDER_BEAM_DEFAULT_WOBBLE = 0.08;

/** Node types that render the SVG border beam (outline path matches the visible shape). */
export function nodeTypeSupportsSvgBorderBeam(nodeType: string): boolean {
  return (
    nodeType === "generic.object.rectangle" ||
    nodeType?.endsWith(".rectangle") === true ||
    nodeType === "generic.object.square" ||
    nodeType?.endsWith(".square") === true ||
    nodeType === "generic.object.circle" ||
    nodeType?.endsWith(".circle") === true ||
    nodeType === "generic.object.rounded-rectangle" ||
    nodeType?.endsWith(".rounded-rectangle") === true
  );
}
