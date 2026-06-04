"use client";

import type { ViewportCullDebugStats } from "@/lib/viewport-culling";
import { cn } from "@/lib/utils";

interface ViewportCullDebugBadgeProps {
  stats: ViewportCullDebugStats | null | undefined;
  className?: string;
}

export function ViewportCullDebugBadge({ stats, className }: ViewportCullDebugBadgeProps) {
  if (!stats) return null;

  const itemsSaving =
    stats.cullingActive && stats.renderedItems < stats.totalItems;
  const connsSaving =
    stats.cullingActive && stats.renderedConnections < stats.totalConnections;

  const title = stats.cullingActive
    ? "Viewport culling active — rendered counts are what is mounted on the canvas (includes selected/dragged off-screen items)."
    : "Viewport culling off (fewer than 4 items, export, or host not measured) — all items and connections render.";

  return (
    <div
      className={cn(
        "shrink-0 rounded border border-border/80 bg-muted/40 px-2 py-0.5 font-mono text-[10px] leading-tight tabular-nums text-muted-foreground",
        (itemsSaving || connsSaving) && "border-emerald-500/40 text-foreground",
        className,
      )}
      title={title}
      data-viewport-cull-debug
      aria-live="polite"
    >
      <span className="whitespace-nowrap">
        items{" "}
        <span className={cn(itemsSaving && "font-semibold text-emerald-600 dark:text-emerald-400")}>
          {stats.renderedItems}/{stats.totalItems}
        </span>
        {" · "}
        conn{" "}
        <span className={cn(connsSaving && "font-semibold text-emerald-600 dark:text-emerald-400")}>
          {stats.renderedConnections}/{stats.totalConnections}
        </span>
        {!stats.cullingActive ? (
          <span className="text-muted-foreground"> · cull off</span>
        ) : null}
      </span>
    </div>
  );
}
