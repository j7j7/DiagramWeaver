import type { DiagramNodeData } from '@/lib/types';
import { isTimelineBarNodeType, timelineBarMemoPayload } from '@/lib/timeline-bar';

const VISUAL_COLOR_KEYS = [
  'backgroundColor',
  'backgroundStyle',
  'backgroundColors',
  'frostedDiffusion',
  'frostedTransparency',
  'frostedPerlinNoise',
  'gradientAngle',
  'borderColor',
  'borderColors',
  'borderStyle',
  'borderGradientAngle',
  'textColor',
  'textOutlineColor',
  'textGlowColor',
  'textShadowColor',
  'iconColor',
  'lineColor',
  'highlightAnimGlowColor',
  'progressFillStyle',
  'progressFillColors',
] as const;

/** Fields that affect solid/gradient fills and strokes for slide thumbnail / transition. */
export function extractVisualColorFields(node: DiagramNodeData): Record<string, unknown> {
  const n = node as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of VISUAL_COLOR_KEYS) {
    const v = n[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

export function visualColorSignature(node: DiagramNodeData): string {
  const fields = extractVisualColorFields(node);
  const sortedKeys = Object.keys(fields).sort();
  const stable: Record<string, unknown> = {};
  for (const k of sortedKeys) stable[k] = fields[k];
  return JSON.stringify(stable);
}

/**
 * For `React.memo` on diagram nodes: color/frost fields plus a few non-color keys that change paint
 * but are not in {@link VISUAL_COLOR_KEYS} (e.g. border width, shadow).
 */
export function diagramNodeVisualStylingSignature(node: DiagramNodeData): string {
  const x = node as unknown as Record<string, unknown>;
  const progressSig =
    typeof node.type === 'string' && (node.type === 'generic.object.progress-bar' || node.type.endsWith('.progress-bar'))
      ? [
          x.progressPercent,
          x.progressShowPercent,
          x.progressFillStyle,
          x.progressFillColors,
          x.progressFillGradientAngle,
        ].join('|')
      : '';
  const tbSig =
    typeof node.type === 'string' && isTimelineBarNodeType(node.type) ? timelineBarMemoPayload(node) : '';
  const mindmapSig =
    typeof node.type === 'string' &&
    (node.type === 'generic.object.mind-map-node' || node.type.endsWith('.mind-map-node'))
      ? [x.mindmapFillMode, x.mindmapTreeDepth, x.mindmapSiblingHueIndex, x.mindmapHueAnchor, x.mindmapHueLocked, x.mindmapHueStepDeg].join('|')
      : '';
  return [
    visualColorSignature(node),
    x.borderWidth,
    x.shadow,
    x.roundedEdges,
    x.cornerRadius,
    x.nodeSize,
    x.noIconBackground,
    x.highlightAnimGlowIntensity,
    x.compositeBodyShape,
    progressSig,
    tbSig,
    mindmapSig,
  ].join('\0');
}

/** True when fill/border uses gradient paint — CSS cannot blend gradient strings; use opacity crossfade instead. */
function hasGradientPaint(f: Record<string, unknown>): boolean {
  return (
    f.backgroundStyle === 'gradient' ||
    f.borderStyle === 'gradient' ||
    f.backgroundStyle === 'frosted' ||
    f.progressFillStyle === 'gradient'
  );
}

/**
 * When either slide uses a gradient fill or border, blend slides by crossfading two full renders
 * (opacity on the "to" layer). Solid-only changes keep using per-property CSS transitions.
 */
export function visualColorNeedsCrossfade(
  prevFields: Record<string, unknown>,
  nextFields: Record<string, unknown>
): boolean {
  return hasGradientPaint(prevFields) || hasGradientPaint(nextFields);
}
