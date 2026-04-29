/** Canvas + sidebar palette silhouette for generic.object.cloud (`CloudShape`): viewBox 0 0 100 60. */
export const CLOUD_SHAPE_VIEW_BOX = "0 0 100 60" as const;

export const CLOUD_SHAPE_PATH_D =
  "M 18,50 L 82,50 C 92,50 96,42 92,34 C 98,28 92,16 80,18 C 78,8 64,6 56,14 C 50,4 36,4 30,16 C 18,10 6,22 12,34 C 4,38 8,50 18,50 Z";

/** Sidebar / ResourceIcon uses vector glyph instead of catalog PNG for parity with canvas. */
export function isPaletteVectorCloudType(type: string | undefined): boolean {
  if (!type) return false;
  return type === "generic.object.cloud" || (type.startsWith("generic.object.") && type.endsWith(".cloud"));
}
