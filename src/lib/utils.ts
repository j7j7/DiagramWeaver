import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isChartNodeType } from "@/lib/chart-node"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** SVG stroke dash for diagram connections — matches `diagram/shapes/line.tsx` behavior. */
export function connectionStrokeDashFromLineType(
  lineWidth: number,
  lineType?: 'solid' | 'dashed' | 'dotted'
): { strokeDasharray?: string; strokeLinecap?: 'round' } {
  const w = lineWidth > 0 ? lineWidth : 2.5;
  const t = lineType ?? 'solid';
  if (t === 'dashed') {
    return { strokeDasharray: `${w * 4} ${w * 2}` };
  }
  if (t === 'dotted') {
    return { strokeDasharray: `0 ${w * 2}`, strokeLinecap: 'round' };
  }
  return {};
}

/** Icon/emoji types (generic.icon.*, generic.emoji.*) are never object shapes - they render as Lucide/emoji. */
export function isIconOrEmojiType(type: string | undefined): boolean {
  return !!(type?.startsWith('generic.icon.') || type?.startsWith('generic.emoji.'))
}

/** Diagram object + chart nodes: use shape bounding / connection geometry, not icon-in-box layout. */
export function isGenericObjectOrChartShapeType(type: string | undefined): boolean {
  return !!(type?.startsWith('generic.object.') || type?.startsWith('generic.chart.'))
}

/**
 * Polyline / connector line (`generic.object.line`, `*.object.line`, or legacy `*.line`), **not**
 * `generic.chart.line` (line chart) — that type also ends with `.line` and must be excluded.
 */
export function isConnectorLineNodeType(type: string | undefined): boolean {
  if (!type) return false
  if (type.endsWith('chart.line')) return false
  return type === 'generic.object.line' || type.endsWith('.line')
}

/**
 * Highlight pulse uses animated `filter: drop-shadow` on the shape subtree so the glow follows
 * painted geometry (SVG alpha). `false` for rectangular box-like objects and connector lines.
 */
export function isHighlightPulseShapeSilhouetteType(type: string | undefined): boolean {
  if (!type || !type.startsWith('generic.object.')) return false
  if (isConnectorLineNodeType(type)) return false
  if (type === 'generic.object.square' || type.endsWith('.square')) return false
  if (type === 'generic.object.rounded-rectangle' || type.endsWith('.rounded-rectangle')) return false
  if (type === 'generic.object.text-box-heading' || type.endsWith('.text-box-heading')) return false
  if (type === 'generic.object.uml-class' || type.endsWith('.uml-class')) return false
  if (type === 'generic.object.rectangle' || type.endsWith('.rectangle')) return false
  return true
}

export function isShapeNodeType(nodeType: string): boolean {
  if (isIconOrEmojiType(nodeType)) return false
  if (isChartNodeType(nodeType)) return true
  return nodeType === 'generic.object.square' ||
         nodeType === 'generic.object.circle' ||
         nodeType === 'generic.object.point' ||
         nodeType === 'generic.object.rectangle' ||
         nodeType === 'generic.object.uml-class' ||
         nodeType?.endsWith('.uml-class') ||
         nodeType === 'generic.object.rounded-rectangle' ||
         nodeType === 'generic.object.progress-bar' ||
         nodeType === 'generic.object.text-box-heading' ||
         nodeType === 'generic.object.triangle' ||
         nodeType === 'generic.object.star' ||
         nodeType === 'generic.object.cloud' ||
         nodeType === 'generic.object.parallelogram' ||
         nodeType === 'generic.object.trapezoid' ||
         nodeType === 'generic.object.kite' ||
         nodeType === 'generic.object.hexagon' ||
         nodeType === 'generic.object.pentagon' ||
         nodeType === 'generic.object.octagon' ||
         nodeType === 'generic.object.jigsaw' ||
         nodeType === 'generic.object.arrowhead' ||
         nodeType === 'generic.object.chevron' ||
         nodeType?.endsWith('.square') ||
         nodeType?.endsWith('.circle') ||
         nodeType?.endsWith('.point') ||
         nodeType?.endsWith('.rectangle') ||
         nodeType?.endsWith('.rounded-rectangle') ||
         nodeType?.endsWith('.progress-bar') ||
         nodeType?.endsWith('.text-box-heading') ||
         nodeType?.endsWith('.triangle') ||
         nodeType?.endsWith('.star') ||
         nodeType?.endsWith('.cloud') ||
         nodeType?.endsWith('.parallelogram') ||
         nodeType?.endsWith('.trapezoid') ||
         nodeType?.endsWith('.kite') ||
         nodeType?.endsWith('.hexagon') ||
         nodeType?.endsWith('.pentagon') ||
         nodeType?.endsWith('.octagon') ||
         nodeType?.endsWith('.jigsaw') ||
         nodeType?.endsWith('.arrowhead') ||
         nodeType?.endsWith('.chevron');
}
