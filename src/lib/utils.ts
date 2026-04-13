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
