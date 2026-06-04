"use client";

import React from "react";
import { Circle, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInteractionRecorder } from "./interaction-recorder-provider";
import { RECORDER_START_KEY, RECORDER_STOP_KEY } from "@/lib/interaction-recording-types";

export function InteractionRecorderIndicator() {
  const { status, armed, playbackProgress } = useInteractionRecorder();

  if (status === "idle") return null;

  const label =
    status === "recording"
      ? "Recording…"
      : status === "playing"
        ? playbackProgress
          ? `Playing ${playbackProgress.current}/${playbackProgress.total}`
          : "Playing…"
        : "Recorder armed";

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm",
        status === "recording"
          ? "border-red-500/60 bg-red-950/90 text-red-50"
          : status === "playing"
            ? "border-sky-500/60 bg-sky-950/90 text-sky-50"
            : "border-amber-500/60 bg-amber-950/90 text-amber-50",
      )}
      aria-live="polite"
    >
      {status === "recording" ? (
        <Circle className="h-3 w-3 fill-current animate-pulse" aria-hidden />
      ) : (
        <Square className="h-3 w-3 fill-current opacity-80" aria-hidden />
      )}
      <span>{label}</span>
      {armed && status !== "playing" && (
        <span className="opacity-75">
          · {RECORDER_START_KEY} start · {RECORDER_STOP_KEY} stop
        </span>
      )}
    </div>
  );
}
