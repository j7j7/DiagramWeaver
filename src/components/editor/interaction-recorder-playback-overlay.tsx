"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DW_PLAYBACK_CURSOR,
  type DwPlaybackCursorDetail,
  type PlaybackCursorKind,
} from "@/lib/interaction-recording-bridge";

interface CursorMark {
  id: number;
  x: number;
  y: number;
  kind: PlaybackCursorKind;
}

const KIND_STYLE: Record<
  PlaybackCursorKind,
  { ring: string; fill: string; label: string; persistMs: number }
> = {
  "left-down": {
    ring: "border-emerald-400",
    fill: "bg-emerald-400/70",
    label: "Left click",
    persistMs: 420,
  },
  "left-up": {
    ring: "border-emerald-300/60",
    fill: "bg-emerald-300/20",
    label: "",
    persistMs: 180,
  },
  "right-down": {
    ring: "border-orange-400",
    fill: "bg-orange-400/70",
    label: "Right click",
    persistMs: 420,
  },
  "right-up": {
    ring: "border-orange-300/60",
    fill: "bg-orange-300/20",
    label: "",
    persistMs: 180,
  },
  "hold-start": {
    ring: "border-sky-400 border-dashed",
    fill: "bg-sky-400/15",
    label: "Click & hold",
    persistMs: 1200,
  },
  "hold-end": {
    ring: "border-sky-300/50",
    fill: "bg-transparent",
    label: "",
    persistMs: 160,
  },
};

let markSeq = 0;

export function InteractionRecorderPlaybackOverlay() {
  const [marks, setMarks] = useState<CursorMark[]>([]);
  const [activeHold, setActiveHold] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onCursor = (e: Event) => {
      const detail = (e as CustomEvent<DwPlaybackCursorDetail>).detail;
      if (!detail) return;

      if (detail.kind === "hold-start") {
        setActiveHold({ x: detail.x, y: detail.y });
      } else if (detail.kind === "hold-end") {
        setActiveHold(null);
      }

      const id = ++markSeq;
      setMarks((prev) => [...prev.slice(-12), { id, x: detail.x, y: detail.y, kind: detail.kind }]);
      window.setTimeout(() => {
        setMarks((prev) => prev.filter((m) => m.id !== id));
      }, KIND_STYLE[detail.kind].persistMs);
    };

    document.addEventListener(DW_PLAYBACK_CURSOR, onCursor as EventListener);
    return () => document.removeEventListener(DW_PLAYBACK_CURSOR, onCursor as EventListener);
  }, []);

  if (marks.length === 0 && !activeHold) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[500]" aria-hidden>
      {activeHold && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: activeHold.x, top: activeHold.y }}
        >
          <div className="h-12 w-12 animate-pulse rounded-full border-2 border-dashed border-sky-400/90 bg-sky-400/10 shadow-[0_0_18px_rgba(56,189,248,0.45)]" />
        </div>
      )}
      {marks.map((mark) => {
        const style = KIND_STYLE[mark.kind];
        const isDown = mark.kind.endsWith("-down") || mark.kind === "hold-start";
        return (
          <div
            key={mark.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: mark.x, top: mark.y }}
          >
            <div
              className={cn(
                "rounded-full border-2 shadow-lg",
                style.ring,
                style.fill,
                isDown ? "h-7 w-7" : "h-4 w-4 opacity-80",
              )}
            />
            {style.label ? (
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {style.label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
