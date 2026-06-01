/** Closed ring of points in local node coordinates (0…width, 0…height). */
export interface VectorPathRing {
  points: Array<{ x: number; y: number; id?: string }>;
}

/** Custom vector shape geometry stored on `DiagramNodeData.vectorPath`. */
export interface VectorPathSpec {
  /** Each ring is closed. With `fill-rule="evenodd"`, rings after the first cut holes. */
  rings: VectorPathRing[];
}

export const VECTOR_PATH_NODE_TYPE = "generic.object.vector-path";

export type ShapeBooleanOperation = "union" | "subtract" | "intersect" | "exclude";

export const SHAPE_BOOLEAN_OPERATION_LABELS: Record<ShapeBooleanOperation, string> = {
  union: "Union (combine)",
  subtract: "Subtract (cut)",
  intersect: "Intersect",
  exclude: "Exclude (XOR)",
};
