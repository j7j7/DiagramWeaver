import type { ArrowChartItem, NodeChartSpecArrow } from "@/lib/types";
import { newChartSliceId } from "@/lib/grid-chart-layout";
import {
  ARROW_MAX_ITEMS,
  ARROW_MIN_ITEMS,
  clampArrowItemCount,
  normalizeArrowItems,
} from "@/lib/arrow-chart-layout";

export function moveArrowItem(
  chart: NodeChartSpecArrow,
  fromIndex: number,
  toIndex: number
): NodeChartSpecArrow {
  const items = normalizeArrowItems(chart.items);
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length
  ) {
    return chart;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return chart;
  next.splice(toIndex, 0, moved);
  return { ...chart, kind: "arrow", items: next };
}

export function insertArrowItemAt(
  chart: NodeChartSpecArrow,
  atIndex: number
): NodeChartSpecArrow {
  const items = normalizeArrowItems(chart.items);
  if (items.length >= ARROW_MAX_ITEMS) return chart;
  const idx = Math.max(0, Math.min(items.length, Math.round(atIndex)));
  const nextItem: ArrowChartItem = {
    id: newChartSliceId(),
    title: `Step ${items.length + 1}`,
  };
  const next = [...items];
  next.splice(idx, 0, nextItem);
  return { ...chart, kind: "arrow", items: next };
}

export function deleteArrowItemAt(
  chart: NodeChartSpecArrow,
  index: number
): NodeChartSpecArrow {
  const items = normalizeArrowItems(chart.items);
  if (items.length <= ARROW_MIN_ITEMS || index < 0 || index >= items.length) return chart;
  return { ...chart, kind: "arrow", items: items.filter((_, i) => i !== index) };
}

export function patchArrowItem(
  chart: NodeChartSpecArrow,
  itemId: string,
  patch: Partial<Omit<ArrowChartItem, "id">>
): NodeChartSpecArrow {
  const items = normalizeArrowItems(chart.items).map((item) =>
    item.id === itemId ? { ...item, ...patch } : item
  );
  return { ...chart, kind: "arrow", items };
}

export function resizeArrowItemCount(
  chart: NodeChartSpecArrow,
  count: number
): NodeChartSpecArrow {
  const items = normalizeArrowItems(chart.items);
  const n = clampArrowItemCount(count);
  if (n === items.length) return { ...chart, kind: "arrow", items };
  if (n < items.length) {
    return { ...chart, kind: "arrow", items: items.slice(0, n) };
  }
  let next = chart;
  while (normalizeArrowItems(next.items).length < n) {
    next = insertArrowItemAt(next, normalizeArrowItems(next.items).length);
  }
  return next;
}
