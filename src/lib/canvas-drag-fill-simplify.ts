import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import type {
  ChartBarSegmentItem,
  ChartGridCell,
  ChartRingSeriesItem,
  ChartSeriesItem,
  DiagramNodeData,
  NodeChartSpec,
} from "@/lib/types";

export const SIMPLIFY_FILLS_DURING_CANVAS_DRAG_STORAGE_KEY =
  "dw:simplifyFillsDuringCanvasDrag:enabled";

/** Options → suppress shadows on every canvas object while dragging (default on). */
export const SUPPRESS_SHADOWS_ON_ALL_OBJECTS_DURING_CANVAS_DRAG_STORAGE_KEY =
  "dw:suppressShadowsOnAllObjectsDuringCanvasDrag:enabled";

const SOLID_FALLBACK = "#6b7280";

/** Read persisted Options preference (default **on** when unset). */
export function readSimplifyFillsDuringCanvasDragFromStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(SIMPLIFY_FILLS_DURING_CANVAS_DRAG_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== "false";
  } catch {
    return true;
  }
}

function firstColor(
  colors: string[] | undefined,
  solid: string | undefined,
  fallback = SOLID_FALLBACK,
): string {
  const fromArray = colors?.[0]?.trim();
  if (fromArray) return fromArray;
  const fromSolid = solid?.trim();
  if (fromSolid) return fromSolid;
  return fallback;
}

function simplifyShellFillFields<
  T extends {
    backgroundStyle?: string;
    backgroundColor?: string;
    backgroundColors?: string[];
    borderStyle?: string;
    borderColor?: string;
    borderColors?: string[];
    meshGradientPoints?: unknown;
    headingBackgroundStyle?: string;
    progressTrackStyle?: string;
    progressFillStyle?: string;
  },
>(fields: T): T {
  let next = fields;
  const bgStyle = fields.backgroundStyle;
  if (bgStyle === "gradient" || bgStyle === "mesh_gradient" || bgStyle === "frosted") {
    const solid = firstColor(fields.backgroundColors, fields.backgroundColor);
    next = {
      ...next,
      backgroundStyle: "solid",
      backgroundColor: solid,
      backgroundColors: [solid, solid],
    };
  }
  if (fields.borderStyle === "gradient") {
    const solid = firstColor(fields.borderColors, fields.borderColor);
    next = {
      ...next,
      borderStyle: "solid",
      borderColor: solid,
      borderColors: [solid, solid],
    };
  }
  if (fields.headingBackgroundStyle === "gradient") {
    next = { ...next, headingBackgroundStyle: "solid" };
  }
  if (fields.progressTrackStyle === "gradient") {
    next = { ...next, progressTrackStyle: "solid" };
  }
  if (fields.progressFillStyle === "gradient") {
    next = { ...next, progressFillStyle: "solid" };
  }
  return next;
}

function simplifyCardElementStyle(style: CardElementStyle | undefined): CardElementStyle | undefined {
  if (!style) return style;
  const bg = style.backgroundStyle;
  if (bg !== "gradient" && bg !== "mesh_gradient") return style;
  const solid = firstColor(style.backgroundColors, style.backgroundColor);
  return {
    ...style,
    backgroundStyle: "solid",
    backgroundColor: solid,
    backgroundColors: [solid, solid] as [string, string],
  };
}

function simplifyCardElementTree(el: CardElementData): CardElementData {
  const style = simplifyCardElementStyle(el.style);
  const children = el.children?.map(simplifyCardElementTree);
  if (style === el.style && !children) return el;
  return {
    ...el,
    ...(style !== el.style ? { style } : {}),
    ...(children ? { children } : {}),
  };
}

function simplifyChartSlice<T extends ChartSeriesItem | ChartBarSegmentItem | ChartRingSeriesItem>(
  item: T,
): T {
  if (item.fillStyle !== "gradient") return item;
  const solid = firstColor(item.gradientColors, item.color);
  return {
    ...item,
    fillStyle: "solid",
    color: solid,
  };
}

function simplifyGridCell(cell: ChartGridCell): ChartGridCell {
  if (cell.fillStyle !== "gradient") return cell;
  const solid = firstColor(cell.gradientColors, cell.color);
  return {
    ...cell,
    fillStyle: "solid",
    color: solid,
  };
}

function simplifyChart(chart: NodeChartSpec): NodeChartSpec {
  switch (chart.kind) {
    case "grid": {
      const canvasPaintFill =
        chart.canvasPaintFill === "gradient" ? ("solid" as const) : chart.canvasPaintFill;
      return {
        ...chart,
        canvasPaintFill,
        cells: chart.cells.map(simplifyGridCell),
      };
    }
    case "gantt":
      return chart;
    case "loop":
      return chart;
    case "arrow":
      return chart;
    case "pie":
      return { ...chart, series: chart.series.map(simplifyChartSlice) };
    case "bar":
    case "line":
      return { ...chart, series: chart.series.map(simplifyChartSlice) };
    case "ring":
      return { ...chart, series: chart.series.map(simplifyChartSlice) };
    default:
      return chart;
  }
}

/**
 * Shallow clone for canvas paint only: gradients, mesh, and frosted glass become the first solid colour.
 * Does not mutate stored diagram data — use only while a node is moving on the canvas.
 */
export function simplifyVisualNodeForCanvasDrag(node: DiagramNodeData): DiagramNodeData {
  const raw = node as DiagramNodeData & Record<string, unknown>;
  let next = simplifyShellFillFields(raw) as DiagramNodeData & Record<string, unknown>;

  if (next.card?.elements) {
    next = {
      ...next,
      card: {
        ...next.card,
        elements: simplifyCardElementTree(next.card.elements),
      },
    };
  }

  if (next.chart) {
    next = {
      ...next,
      chart: simplifyChart(next.chart),
    };
  }

  return next as DiagramNodeData;
}
