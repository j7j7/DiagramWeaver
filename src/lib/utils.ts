import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isShapeNodeType(nodeType: string): boolean {
  return nodeType === 'generic.object.square' ||
         nodeType === 'generic.object.circle' ||
         nodeType === 'generic.object.point' ||
         nodeType === 'generic.object.rectangle' ||
         nodeType === 'generic.object.rounded-rectangle' ||
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
