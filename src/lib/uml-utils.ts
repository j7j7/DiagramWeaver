/** Shared constants and helpers for UML class shape */

export const UML_MIN_WIDTH = 120;
export const UML_LINE_HEIGHT = 18;
export const UML_NAME_HEIGHT = 24;
export const UML_DIVIDER_HEIGHT = 2;
export const UML_PADDING = 16;

/** Compute UML class shape dimensions from content */
export function computeUmlClassDimensions(
  name: string,
  attributes: string[],
  methods: string[]
): { width: number; height: number } {
  const attrCount = Math.max(1, attributes.length);
  const methodCount = Math.max(1, methods.length);
  const height =
    UML_NAME_HEIGHT +
    UML_DIVIDER_HEIGHT +
    attrCount * UML_LINE_HEIGHT +
    UML_DIVIDER_HEIGHT +
    methodCount * UML_LINE_HEIGHT +
    UML_PADDING;
  return { width: UML_MIN_WIDTH, height };
}
