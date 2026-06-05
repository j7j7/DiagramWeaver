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
  fromX?: number;
  fromY?: number;
  path?: Array<{ x: number; y: number }>;
  label?: string;
}

interface ActiveDrag {
  side: "left" | "right";
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  path: Array<{ x: number; y: number }>;
}

const KIND_STYLE: Record<
  Exclude<PlaybackCursorKind, "pointer">,
  { ring: string; fill: string; label: string; persistMs: number; trail?: string }
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
  "left-drag-start": {
    ring: "border-emerald-500",
    fill: "bg-emerald-500/80",
    label: "Left drag",
    persistMs: 900,
    trail: "stroke-emerald-400",
  },
  "left-drag-move": {
    ring: "border-emerald-400/80",
    fill: "bg-emerald-400/40",
    label: "",
    persistMs: 120,
    trail: "stroke-emerald-400",
  },
  "left-drag-end": {
    ring: "border-emerald-300",
    fill: "bg-emerald-300/30",
    label: "Left drag",
    persistMs: 900,
    trail: "stroke-emerald-400",
  },
  "right-drag-start": {
    ring: "border-orange-500",
    fill: "bg-orange-500/80",
    label: "Right drag",
    persistMs: 900,
    trail: "stroke-orange-400",
  },
  "right-drag-move": {
    ring: "border-orange-400/80",
    fill: "bg-orange-400/40",
    label: "",
    persistMs: 120,
    trail: "stroke-orange-400",
  },
  "right-drag-end": {
    ring: "border-orange-300",
    fill: "bg-orange-300/30",
    label: "Right drag",
    persistMs: 900,
    trail: "stroke-orange-400",
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
  copy: {
    ring: "border-violet-400",
    fill: "bg-violet-500/75",
    label: "Copy",
    persistMs: 900,
  },
  paste: {
    ring: "border-fuchsia-400",
    fill: "bg-fuchsia-500/75",
    label: "Paste",
    persistMs: 900,
  },
};

function dragSide(kind: PlaybackCursorKind): "left" | "right" | null {
  if (kind.startsWith("left-drag")) return "left";
  if (kind.startsWith("right-drag")) return "right";
  return null;
}

function pathToPolyline(path: Array<{ x: number; y: number }>): string {
  return path.map((p) => `${p.x},${p.y}`).join(" ");
}

let markSeq = 0;

function readPlaybackActive(): boolean {
  return typeof document !== "undefined" && document.body.dataset.dwPlayback === "active";
}

export function InteractionRecorderPlaybackOverlay() {
  const [marks, setMarks] = useState<CursorMark[]>([]);
  const [activeHold, setActiveHold] = useState<{ x: number; y: number } | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [completedTrails, setCompletedTrails] = useState<
    Array<{ id: number; side: "left" | "right"; path: Array<{ x: number; y: number }> }>
  >([]);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [livePointer, setLivePointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setPlaybackActive(readPlaybackActive());

    const onPlaybackAttr = () => {
      const active = readPlaybackActive();
      setPlaybackActive(active);
      if (!active) {
        setLivePointer(null);
        setActiveDrag(null);
        setActiveHold(null);
      }
    };

    const observer = new MutationObserver(onPlaybackAttr);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-dw-playback"] });

    const onCursor = (e: Event) => {
      const detail = (e as CustomEvent<DwPlaybackCursorDetail>).detail;
      if (!detail) return;

      setLivePointer({ x: detail.x, y: detail.y });

      if (detail.kind === "pointer") return;

      if (detail.kind === "hold-start") {
        setActiveHold({ x: detail.x, y: detail.y });
      } else if (detail.kind === "hold-end") {
        setActiveHold(null);
      }

      const side = dragSide(detail.kind);
      if (side) {
        if (detail.kind.endsWith("-start")) {
          const path = detail.path?.length ? detail.path : [{ x: detail.x, y: detail.y }];
          setActiveDrag({
            side,
            startX: path[0]!.x,
            startY: path[0]!.y,
            currentX: detail.x,
            currentY: detail.y,
            path,
          });
        } else if (detail.kind.endsWith("-move")) {
          setActiveDrag((prev) => {
            if (!prev || prev.side !== side) {
              const start = { x: detail.fromX ?? detail.x, y: detail.fromY ?? detail.y };
              return {
                side,
                startX: start.x,
                startY: start.y,
                currentX: detail.x,
                currentY: detail.y,
                path: detail.path ?? [start, { x: detail.x, y: detail.y }],
              };
            }
            return {
              ...prev,
              currentX: detail.x,
              currentY: detail.y,
              path: detail.path ?? [...prev.path, { x: detail.x, y: detail.y }],
            };
          });
        } else if (detail.kind.endsWith("-end")) {
          const path =
            detail.path && detail.path.length >= 2
              ? detail.path
              : [
                  { x: detail.fromX ?? detail.x, y: detail.fromY ?? detail.y },
                  { x: detail.x, y: detail.y },
                ];
          const trailId = ++markSeq;
          setCompletedTrails((prev) => [...prev.slice(-4), { id: trailId, side, path }]);
          window.setTimeout(() => {
            setCompletedTrails((prev) => prev.filter((t) => t.id !== trailId));
          }, KIND_STYLE[detail.kind].persistMs);
          setActiveDrag(null);
        }
      }

      const id = ++markSeq;
      setMarks((prev) => [
        ...prev.slice(-16),
        {
          id,
          x: detail.x,
          y: detail.y,
          kind: detail.kind,
          fromX: detail.fromX,
          fromY: detail.fromY,
          path: detail.path,
          label: detail.label,
        },
      ]);
      window.setTimeout(() => {
        setMarks((prev) => prev.filter((m) => m.id !== id));
      }, KIND_STYLE[detail.kind].persistMs);
    };

    document.addEventListener(DW_PLAYBACK_CURSOR, onCursor as EventListener);
    return () => {
      observer.disconnect();
      document.removeEventListener(DW_PLAYBACK_CURSOR, onCursor as EventListener);
    };
  }, []);

  const showOverlay =
    playbackActive ||
    marks.length > 0 ||
    activeHold != null ||
    activeDrag != null ||
    completedTrails.length > 0;

  if (!showOverlay) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[500]" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {completedTrails.map((trail) => (
          <polyline
            key={trail.id}
            points={pathToPolyline(trail.path)}
            fill="none"
            className={cn(
              "opacity-70",
              trail.side === "left" ? "stroke-emerald-400" : "stroke-orange-400",
            )}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 4"
          />
        ))}
        {activeDrag && activeDrag.path.length >= 2 && (
          <polyline
            points={pathToPolyline(activeDrag.path)}
            fill="none"
            className={cn(
              "opacity-90",
              activeDrag.side === "left" ? "stroke-emerald-400" : "stroke-orange-400",
            )}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {livePointer && playbackActive && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75 ease-linear"
          style={{ left: livePointer.x, top: livePointer.y }}
        >
          <div className="relative h-5 w-5">
            <div className="absolute inset-0 rounded-full border-2 border-white/95 bg-white/25 shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.25)]" />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
          </div>
        </div>
      )}

      {activeHold && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: activeHold.x, top: activeHold.y }}
        >
          <div className="h-12 w-12 animate-pulse rounded-full border-2 border-dashed border-sky-400/90 bg-sky-400/10 shadow-[0_0_18px_rgba(56,189,248,0.45)]" />
        </div>
      )}

      {marks.map((mark) => {
        const style = KIND_STYLE[mark.kind as Exclude<PlaybackCursorKind, "pointer">];
        const isDown =
          mark.kind.endsWith("-down") ||
          mark.kind.endsWith("-start") ||
          mark.kind === "hold-start" ||
          mark.kind === "copy" ||
          mark.kind === "paste";
        const isClipboard = mark.kind === "copy" || mark.kind === "paste";
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
                isDown ? (isClipboard ? "h-8 w-8" : "h-7 w-7") : "h-4 w-4 opacity-80",
              )}
            />
            {mark.label || style.label ? (
              <span
                className={cn(
                  "absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                  isClipboard ? "bg-violet-900/85" : "bg-black/75",
                )}
              >
                {mark.label || style.label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
