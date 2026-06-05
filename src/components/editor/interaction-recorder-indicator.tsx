"use client";

import React from "react";
import { Circle, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useInteractionRecorder } from "./interaction-recorder-provider";
import { RECORDER_START_KEY, RECORDER_STOP_KEY } from "@/lib/interaction-recording-types";

export function InteractionRecorderIndicator() {
  const {
    status,
    armed,
    playbackProgress,
    playbackPaused,
    pausePlayback,
    resumePlayback,
    stopPlayback,
  } = useInteractionRecorder();

  if (status === "idle") return null;

  if (status === "playing") {
    const progressLabel = playbackProgress
      ? `${playbackProgress.current}/${playbackProgress.total}`
      : "…";

    return (
      <div
        className={cn(
          "pointer-events-auto fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm",
          playbackPaused
            ? "border-amber-500/60 bg-amber-950/90 text-amber-50"
            : "border-sky-500/60 bg-sky-950/90 text-sky-50",
        )}
        aria-live="polite"
      >
        <div className="flex items-center gap-0.5">
          {playbackPaused ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-inherit hover:bg-white/10"
              onClick={resumePlayback}
              aria-label="Resume playback"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-inherit hover:bg-white/10"
              onClick={pausePlayback}
              aria-label="Pause playback"
            >
              <Pause className="h-3.5 w-3.5 fill-current" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-inherit hover:bg-white/10"
            onClick={stopPlayback}
            aria-label="Stop playback"
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        </div>
        <span>
          {playbackPaused ? "Paused" : "Playing"} · {progressLabel}
        </span>
      </div>
    );
  }

  const label = status === "recording" ? "Recording…" : "Recorder armed";

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm",
        status === "recording"
          ? "border-red-500/60 bg-red-950/90 text-red-50"
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
      {armed && (
        <span className="opacity-75">
          · {RECORDER_START_KEY} start · {RECORDER_STOP_KEY} stop
        </span>
      )}
    </div>
  );
}
