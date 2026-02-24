/**
 * UML Class text styling - per-compartment (name, attributes, methods) styling.
 */

import type { DiagramNodeData } from './types';

export interface UmlClassCompartmentStyle {
  fontFamily?: string;
  fontSize?: number;
  textJustify?: 'left' | 'center' | 'right' | 'full';
  textColor?: string;
}

export interface UmlClassTextStyling {
  name?: UmlClassCompartmentStyle;
  attributes?: UmlClassCompartmentStyle;
  methods?: UmlClassCompartmentStyle;
  dividerLineWidth?: number;
}

const DEFAULT_COMPARTMENT: UmlClassCompartmentStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  textJustify: 'center',
  textColor: '#1e293b',
};

export function extractUmlClassTextStylingFromNode(node: DiagramNodeData): UmlClassTextStyling {
  const u = (node as any).umlClassStyle;
  if (!u || typeof u !== 'object') return {};
  return {
    name: u.name,
    attributes: u.attributes,
    methods: u.methods,
    dividerLineWidth: typeof u.dividerLineWidth === 'number' ? u.dividerLineWidth : undefined,
  };
}

function mergeCompartment(
  existing: UmlClassCompartmentStyle | undefined,
  update: Partial<UmlClassCompartmentStyle>
): UmlClassCompartmentStyle {
  return { ...DEFAULT_COMPARTMENT, ...existing, ...update };
}

export function applyUmlClassTextStylingToNode(
  node: DiagramNodeData,
  styling: Partial<UmlClassTextStyling>
): DiagramNodeData {
  const existing = (node as any).umlClassStyle || {};
  const updated: any = { ...existing };
  if (styling.name !== undefined) {
    updated.name = mergeCompartment(existing.name, styling.name);
  }
  if (styling.attributes !== undefined) {
    updated.attributes = mergeCompartment(existing.attributes, styling.attributes);
  }
  if (styling.methods !== undefined) {
    updated.methods = mergeCompartment(existing.methods, styling.methods);
  }
  if (styling.dividerLineWidth !== undefined) {
    updated.dividerLineWidth = styling.dividerLineWidth;
  }
  return { ...node, umlClassStyle: updated };
}

export const DEFAULT_UML_CLASS_TEXT_STYLING: UmlClassTextStyling = {
  name: { ...DEFAULT_COMPARTMENT, fontSize: 14, textJustify: 'center' },
  attributes: { ...DEFAULT_COMPARTMENT },
  methods: { ...DEFAULT_COMPARTMENT },
  dividerLineWidth: 1,
};
