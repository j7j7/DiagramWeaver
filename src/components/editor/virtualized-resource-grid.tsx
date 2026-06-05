"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const OVERSCAN_ROWS = 2;
/** Below this count, mount every tile (DnD registration is cheap enough). */
export const RESOURCE_GRID_VIRTUALIZE_MIN = 40;

interface VirtualizedResourceGridProps {
  resources: unknown[];
  viewMode: "normal" | "compact";
  scrollRootRef: React.RefObject<HTMLElement | null>;
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
 * Reduces react-dnd drag sources and DOM size when a category has many resources.
 */
export function VirtualizedResourceGrid({
  resources,
  viewMode,
  scrollRootRef,
  className,
  renderItem,
}: VirtualizedResourceGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const offsetTopRef = useRef(0);
  const [range, setRange] = useState({ start: 0, end: resources.length });
  const [cols, setCols] = useState(3);

  const { rowHeight, gap, padding } = rowMetrics(viewMode);
  const rowCount = Math.ceil(resources.length / Math.max(cols, 1));
  const totalHeight = rowCount * (rowHeight + gap) + padding * 2;

  const measureOffsetTop = useCallback(() => {
    const scrollRoot = scrollRootRef.current;
    const grid = gridRef.current;
    if (!scrollRoot || !grid) return;
    let top = 0;
    let el: HTMLElement | null = grid;
    while (el && el !== scrollRoot) {
      top += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    offsetTopRef.current = top;
    setCols(measureColumnCount(grid.clientWidth, viewMode));
  }, [scrollRootRef, viewMode]);

  const updateRange = useCallback(() => {
    const scrollRoot = scrollRootRef.current;
    const grid = gridRef.current;
    if (!scrollRoot || !grid || resources.length === 0) {
      setRange({ start: 0, end: resources.length });
      return;
    }

    const columnCount = measureColumnCount(grid.clientWidth, viewMode);
    setCols(columnCount);
    const rows = Math.ceil(resources.length / columnCount);
    const metrics = rowMetrics(viewMode);
    const scrollTop = scrollRoot.scrollTop;
    const viewportBottom = scrollTop + scrollRoot.clientHeight;
    const gridTop = offsetTopRef.current;

    const startRow = Math.max(
      0,
      Math.floor((scrollTop - gridTop) / (metrics.rowHeight + metrics.gap)) - OVERSCAN_ROWS,
    );
    const endRow = Math.min(
      rows,
      Math.ceil((viewportBottom - gridTop) / (metrics.rowHeight + metrics.gap)) + OVERSCAN_ROWS,
    );
    const start = startRow * columnCount;
    const end = Math.min(resources.length, endRow * columnCount);
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [resources.length, scrollRootRef, viewMode]);

  useEffect(() => {
    measureOffsetTop();
    updateRange();
  }, [measureOffsetTop, updateRange, resources.length, viewMode]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;
    const onScroll = () => updateRange();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            measureOffsetTop();
            updateRange();
          })
        : null;
    if (gridRef.current && ro) ro.observe(gridRef.current);
    return () => {
      scrollRoot.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [scrollRootRef, updateRange, measureOffsetTop]);

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
