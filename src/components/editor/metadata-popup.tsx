"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

const GAP = 8;
const POPUP_WIDTH = 220;
const COLLAPSED_MAX_HEIGHT = 88;
const EXPANDED_MAX_HEIGHT = 280;

interface MetadataPopupProps {
  /** Screen rect of the anchored element (from getBoundingClientRect) */
  anchorRect: { top: number; left: number; right: number; width: number; height: number; bottom: number };
  metaData: Record<string, string>;
  className?: string;
}

/**
 * Compact popup showing metadata key/value pairs, positioned to the right of the selected item.
 * Location is anchored to the object (not the window). Viewport constraints only clip overflow.
 * Size reactive: shows partial info by default, expands on hover to reveal more.
 */
export function MetadataPopup({
  anchorRect,
  metaData,
  className,
}: MetadataPopupProps) {
  const [isHovered, setIsHovered] = useState(false);
  const entries = Object.entries(metaData);
  if (entries.length === 0) return null;

  const pad = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;

  // Anchor to object: position to the right of it
  let left = anchorRect.right + GAP;
  let top = anchorRect.top;

  // Constrain horizontal: if no room on right, show to left of object
  if (left + POPUP_WIDTH > vw - pad) {
    left = anchorRect.left - POPUP_WIDTH - GAP;
  }
  if (left < pad) left = pad;

  // Constrain vertical: keep keyed to object - align popup bottom with object bottom when near viewport bottom
  if (top + EXPANDED_MAX_HEIGHT > vh - pad) {
    top = Math.max(pad, anchorRect.bottom - EXPANDED_MAX_HEIGHT);
  }
  if (top < pad) top = pad;

  const hasMore = entries.length > 2;

  return (
    <div
      className={cn(
        "fixed z-[9999] rounded-lg border border-zinc-600/80 bg-zinc-800 px-2.5 py-2.5",
        "shadow-xl shadow-black/30 ring-1 ring-zinc-500/20",
        "text-xs overflow-hidden transition-[max-height] duration-200 ease-out",
        "text-zinc-100",
        className
      )}
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${POPUP_WIDTH}px`,
        maxHeight: isHovered ? `${EXPANDED_MAX_HEIGHT}px` : `${COLLAPSED_MAX_HEIGHT}px`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "space-y-1.5 pr-0.5",
          isHovered ? "overflow-y-auto" : "overflow-hidden"
        )}
      >
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex flex-col gap-0.5 break-words"
          >
            <span className="font-medium text-zinc-400 truncate" title={key}>
              {key}
            </span>
            <span className={cn("text-zinc-200", !isHovered && "truncate")} title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>
      {hasMore && !isHovered && (
        <span className="absolute bottom-1 right-2 text-[10px] text-zinc-500">⋯</span>
      )}
    </div>
  );
}
