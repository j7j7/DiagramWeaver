/**
 * Whether Visual styling may offer **mesh gradient** for this diagram object type.
 * Excludes charts, pyramid, timeline widgets, segmented bars, progress bar, UML class, etc.
 */
export function supportsDiagramMeshGradient(nodeType: string | undefined): boolean {
  if (!nodeType) return false;
  if (nodeType.startsWith("generic.chart.")) return false;

  const parts = nodeType.split(".");
  const suf = parts.length ? parts[parts.length - 1] : "";
  if (!suf) return false;

  const excluded = new Set([
    "pyramid",
    "timeline-bar",
    "segmented-rectangle",
    "progress-bar",
    "timeline",
    "uml-class",
    "point",
    "line",
    "jigsaw",
    "arrowhead",
    "chevron",
    "loop",
    "text-box-heading",
  ]);
  if (excluded.has(suf)) return false;

  const allowed = new Set([
    "square",
    "rectangle",
    "rounded-rectangle",
    "circle",
    "triangle",
    "star",
    "hexagon",
    "pentagon",
    "octagon",
    "cloud",
    "parallelogram",
    "trapezoid",
    "kite",
    "mind-map-node",
  ]);
  return allowed.has(suf);
}
