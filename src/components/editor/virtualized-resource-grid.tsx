"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const OVERSCAN_ROWS = 2;

interface VirtualizedResourceGridProps {
  resources: unknown[];
  viewMode: "normal" | "compact";
  scrollRootRef: React.RefObject<HTMLElement | null>;
  /** Bump when accordion expand/collapse shifts grid position in the scroll area. */
  layoutEpoch?: number;
  className?: string;
  renderItem: (resource: unknown, index: number) => React.ReactNode;
}

function measureColumnCount(containerWidth: number, viewMode: "normal" | "compact"): number {
  const minCol = viewMode === "compact" ? 56 : 72;
  const gap = viewMode === "compact" ? 4 : 8;
  return Math.max(1, Math.floor((containerWidth + gap) / (minCol + gap)));
}

function rowMetrics(viewMode: "normal" | "compact") {
  return {
    rowHeight: viewMode === "compact" ? 64 : 88,
    gap: viewMode === "compact" ? 4 : 8,
    padding: viewMode === "compact" ? 4 : 8,
  };
}

/**
 * Windowed palette grid: only mounts visible rows (+ overscan) inside the sidebar scroll area.
 * Off-screen grids mount zero tiles so canvas drag stays light while the sidebar is open.
 */
export function VirtualizedResourceGrid({
  resources,
  viewMode,
  scrollRootRef,
  layoutEpoch = 0,
  className,
  renderItem,
}: VirtualizedResourceGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [cols, setCols] = useState(3);

  const { rowHeight, gap, padding } = rowMetrics(viewMode);
  const rowCount = Math.ceil(resources.length / Math.max(cols, 1));
  const totalHeight = rowCount * (rowHeight + gap) + padding * 2;

  const updateRange = useCallback(() => {
    const scrollRoot = scrollRootRef.current;
    const grid = gridRef.current;
    if (!scrollRoot || !grid || resources.length === 0) {
      setRange((prev) => (prev.start === 0 && prev.end === 0 ? prev : { start: 0, end: 0 }));
      return;
    }

    const columnCount = measureColumnCount(grid.clientWidth, viewMode);
    setCols(columnCount);
    const metrics = rowMetrics(viewMode);
    const rowStride = metrics.rowHeight + metrics.gap;
    const rows = Math.ceil(resources.length / columnCount);

    const scrollRect = scrollRoot.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();

    if (gridRect.bottom <= scrollRect.top || gridRect.top >= scrollRect.bottom) {
      setRange((prev) => (prev.start === 0 && prev.end === 0 ? prev : { start: 0, end: 0 }));
      return;
    }

    const visibleTopRel = Math.max(0, scrollRect.top - gridRect.top);
    const visibleBottomRel = Math.min(gridRect.height || totalHeight, scrollRect.bottom - gridRect.top);

    const startRow = Math.max(0, Math.floor(visibleTopRel / rowStride) - OVERSCAN_ROWS);
    const endRow = Math.min(rows, Math.ceil(visibleBottomRel / rowStride) + OVERSCAN_ROWS);
    const start = Math.min(resources.length, startRow * columnCount);
    const end = Math.min(resources.length, Math.max(start, endRow * columnCount));
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [resources.length, scrollRootRef, totalHeight, viewMode]);

  useLayoutEffect(() => {
    updateRange();
  }, [updateRange, resources.length, viewMode, layoutEpoch]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    const onScroll = () => updateRange();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateRange();
          })
        : null;
    ro?.observe(scrollRoot);
    if (gridRef.current) ro?.observe(gridRef.current);

    return () => {
      scrollRoot.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [scrollRootRef, updateRange, layoutEpoch]);

  const startRow = Math.floor(range.start / Math.max(cols, 1));
  const endRow = Math.ceil(range.end / Math.max(cols, 1));
  const paddingTop = startRow * (rowHeight + gap);
  const paddingBottom = Math.max(0, (rowCount - endRow) * (rowHeight + gap));

  return (
    <div ref={gridRef} style={{ minHeight: totalHeight }}>
      <div
        className={cn(
          "ml-4 grid touch-spacing",
          viewMode === "compact"
            ? "grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1 p-1"
            : "grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 p-2",
          className,
        )}
        style={{ paddingTop, paddingBottom }}
      >
        {resources.slice(range.start, range.end).map((resource, i) =>
          renderItem(resource, range.start + i),
        )}
      </div>
    </div>
  );
}
