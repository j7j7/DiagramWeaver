"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startInteractionRecordingCapture } from "@/lib/interaction-recording-capture";
import {
  prepareRecordingForPlayback,
  playInteractionRecording,
  recordingDurationMs,
  formatRecordingDuration,
  downloadInteractionRecording,
} from "@/lib/interaction-recording-playback";
import {
  deleteInteractionRecordingFromLibrary,
  getInteractionRecordingFromLibrary,
  listInteractionRecordings,
  saveInteractionRecordingToLibrary,
} from "@/lib/interaction-recording-storage";
import type {
  InteractionRecording,
  InteractionRecordingLibraryEntry,
  InteractionRecordingStatus,
} from "@/lib/interaction-recording-types";
import { RECORDER_START_KEY, RECORDER_STOP_KEY } from "@/lib/interaction-recording-types";
import { isEventFromEditableElement } from "@/lib/keyboard-utils";
import {
  InteractionRecorderContext,
  type InteractionRecorderContextValue,
} from "./interaction-recorder-context";
import { InteractionRecorderDialog } from "./interaction-recorder-dialog";
import { InteractionRecorderIndicator } from "./interaction-recorder-indicator";
import { InteractionRecorderPlaybackOverlay } from "./interaction-recorder-playback-overlay";

export { useInteractionRecorder } from "./interaction-recorder-context";

export function InteractionRecorderProvider({ children }: { children: React.ReactNode }) {
  const [armed, setArmedState] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [library, setLibrary] = useState<InteractionRecordingLibraryEntry[]>([]);
  const [pendingRecording, setPendingRecording] = useState<InteractionRecording | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<{ current: number; total: number } | null>(null);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const captureRef = useRef<ReturnType<typeof startInteractionRecordingCapture> | null>(null);
  const playbackRef = useRef<ReturnType<typeof playInteractionRecording> | null>(null);

  const status: InteractionRecordingStatus = playbackProgress
    ? "playing"
    : isRecording
      ? "recording"
      : armed
        ? "armed"
        : "idle";

  const refreshLibrary = useCallback(() => {
    setLibrary(listInteractionRecordings());
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const setArmed = useCallback((next: boolean) => {
    setArmedState(next);
    if (!next && captureRef.current) {
      captureRef.current.stop();
      captureRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (captureRef.current || playbackRef.current) return;
    captureRef.current = startInteractionRecordingCapture();
    setIsRecording(true);
    setPendingRecording(null);
  }, []);

  const stopRecording = useCallback(() => {
    if (!captureRef.current) return;
    const recording = captureRef.current.stop();
    captureRef.current = null;
    setIsRecording(false);
    setPendingRecording(recording);
    setDialogOpen(true);
  }, []);

  const dismissPendingSave = useCallback(() => {
    setPendingRecording(null);
  }, []);

  const savePendingRecording = useCallback(
    (title: string, description: string, saveToLibrary: boolean) => {
      if (!pendingRecording) return;
      const finalRecording: InteractionRecording = {
        ...pendingRecording,
        title: title.trim() || "Untitled recording",
        description: description.trim() || undefined,
      };
      downloadInteractionRecording(finalRecording);
      if (saveToLibrary) {
        saveInteractionRecordingToLibrary(finalRecording);
        refreshLibrary();
      }
      setPendingRecording(null);
    },
    [pendingRecording, refreshLibrary],
  );

  const loadFromFile = useCallback(async (file: File) => {
    const { parseInteractionRecordingFile } = await import("@/lib/interaction-recording-playback");
    const recording = await parseInteractionRecordingFile(file);
    saveInteractionRecordingToLibrary(recording);
    refreshLibrary();
  }, [refreshLibrary]);

  const stopPlayback = useCallback(() => {
    playbackRef.current?.abort();
    playbackRef.current = null;
    setPlaybackProgress(null);
    setPlaybackPaused(false);
  }, []);

  const pausePlayback = useCallback(() => {
    playbackRef.current?.pause();
    setPlaybackPaused(true);
  }, []);

  const resumePlayback = useCallback(() => {
    playbackRef.current?.resume();
    setPlaybackPaused(false);
  }, []);

  const playRecording = useCallback(
    (recording: InteractionRecording, speed = 1) => {
      stopPlayback();
      setDialogOpen(false);
      setPlaybackPaused(false);
      const optimized = prepareRecordingForPlayback(recording);
      const handle = playInteractionRecording(optimized, {
        speed,
        sourceRecording: recording,
        onEvent: (current, total) => setPlaybackProgress({ current, total }),
      });
      playbackRef.current = handle;
      handle.promise
        .catch(() => {})
        .finally(() => {
          playbackRef.current = null;
          setPlaybackProgress(null);
          setPlaybackPaused(false);
        });
    },
    [stopPlayback],
  );

  const removeFromLibrary = useCallback(
    (id: string) => {
      deleteInteractionRecordingFromLibrary(id);
      refreshLibrary();
    },
    [refreshLibrary],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.body.dataset.dwPlayback === "active") return;
      if (!armed && !isRecording) return;
      if (isEventFromEditableElement(e)) return;

      if (e.key === RECORDER_START_KEY && !isRecording) {
        e.preventDefault();
        startRecording();
        return;
      }
      if (e.key === RECORDER_STOP_KEY && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [armed, isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      captureRef.current?.stop();
      playbackRef.current?.abort();
    };
  }, []);

  const value = useMemo<InteractionRecorderContextValue>(
    () => ({
      status,
      armed,
      setArmed,
      dialogOpen,
      setDialogOpen,
      library,
      pendingRecording,
      playbackProgress,
      playbackPaused,
      startRecording,
      stopRecording,
      dismissPendingSave,
      savePendingRecording,
      loadFromFile,
      playRecording,
      pausePlayback,
      resumePlayback,
      stopPlayback,
      removeFromLibrary,
      refreshLibrary,
    }),
    [
      status,
      armed,
      dialogOpen,
      library,
      pendingRecording,
      playbackProgress,
      playbackPaused,
      startRecording,
      stopRecording,
      dismissPendingSave,
      savePendingRecording,
      loadFromFile,
      playRecording,
      pausePlayback,
      resumePlayback,
      stopPlayback,
      removeFromLibrary,
      refreshLibrary,
    ],
  );

  return (
    <InteractionRecorderContext.Provider value={value}>
      {children}
      <InteractionRecorderIndicator />
      <InteractionRecorderPlaybackOverlay />
      <InteractionRecorderDialog />
    </InteractionRecorderContext.Provider>
  );
}

export { formatRecordingDuration, recordingDurationMs, getInteractionRecordingFromLibrary };
