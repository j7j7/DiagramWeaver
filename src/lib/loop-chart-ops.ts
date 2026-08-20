import type { LoopChartItem, NodeChartSpecLoop, RichTextRun } from "@/lib/types";
import { newChartSliceId } from "@/lib/grid-chart-layout";
import {
  LOOP_MAX_ITEMS,
  LOOP_MIN_ITEMS,
  clampLoopItemCount,
  normalizeLoopItems,
} from "@/lib/loop-chart-layout";

export function moveLoopItem(
  chart: NodeChartSpecLoop,
  fromIndex: number,
  toIndex: number
): NodeChartSpecLoop {
  const items = normalizeLoopItems(chart.items);
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
  return { ...chart, kind: "loop", items: next };
}

export function insertLoopItemAt(
  chart: NodeChartSpecLoop,
  atIndex: number
): NodeChartSpecLoop {
  const items = normalizeLoopItems(chart.items);
  if (items.length >= LOOP_MAX_ITEMS) return chart;
  const idx = Math.max(0, Math.min(items.length, Math.round(atIndex)));
  const n = items.length + 1;
  const nextItem: LoopChartItem = {
    id: newChartSliceId(),
    title: `Step ${n}`,
    subtitle: "",
  };
  const next = [...items];
  next.splice(idx, 0, nextItem);
  return { ...chart, kind: "loop", items: next };
}

export function deleteLoopItemAt(
  chart: NodeChartSpecLoop,
  index: number
): NodeChartSpecLoop {
  const items = normalizeLoopItems(chart.items);
  if (items.length <= LOOP_MIN_ITEMS || index < 0 || index >= items.length) return chart;
  return { ...chart, kind: "loop", items: items.filter((_, i) => i !== index) };
}

export function patchLoopItem(
  chart: NodeChartSpecLoop,
  itemId: string,
  patch: Partial<Omit<LoopChartItem, "id">>
): NodeChartSpecLoop {
  const items = normalizeLoopItems(chart.items).map((item) =>
    item.id === itemId ? { ...item, ...patch } : item
  );
  return { ...chart, kind: "loop", items };
}

export function patchLoopHub(
  chart: NodeChartSpecLoop,
  patch: {
    title?: string;
    subtitle?: string;
    richTitle?: RichTextRun[];
    richSubtitle?: RichTextRun[];
  }
): NodeChartSpecLoop {
  return { ...chart, kind: "loop", ...patch };
}

export function resizeLoopItemCount(
  chart: NodeChartSpecLoop,
  count: number
): NodeChartSpecLoop {
  const items = normalizeLoopItems(chart.items);
  const n = clampLoopItemCount(count);
  if (n === items.length) return { ...chart, kind: "loop", items };
  if (n < items.length) {
    return { ...chart, kind: "loop", items: items.slice(0, n) };
  }
  let next = chart;
  while (normalizeLoopItems(next.items).length < n) {
    next = insertLoopItemAt(next, normalizeLoopItems(next.items).length);
  }
  return next;
}
