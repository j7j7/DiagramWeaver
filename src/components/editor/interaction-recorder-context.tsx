"use client";

import { createContext, useContext } from "react";
import type {
  InteractionRecording,
  InteractionRecordingLibraryEntry,
  InteractionRecordingStatus,
} from "@/lib/interaction-recording-types";

export interface InteractionRecorderContextValue {
  status: InteractionRecordingStatus;
  armed: boolean;
  setArmed: (armed: boolean) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  library: InteractionRecordingLibraryEntry[];
  pendingRecording: InteractionRecording | null;
  playbackProgress: { current: number; total: number } | null;
  playbackPaused: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  dismissPendingSave: () => void;
  savePendingRecording: (title: string, description: string, saveToLibrary: boolean) => void;
  loadFromFile: (file: File) => Promise<void>;
  playRecording: (recording: InteractionRecording, speed?: number) => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  stopPlayback: () => void;
  removeFromLibrary: (id: string) => void;
  refreshLibrary: () => void;
}

export const InteractionRecorderContext = createContext<InteractionRecorderContextValue | null>(null);

export function useInteractionRecorder(): InteractionRecorderContextValue {
  const ctx = useContext(InteractionRecorderContext);
  if (!ctx) {
    throw new Error("useInteractionRecorder must be used within InteractionRecorderProvider");
  }
  return ctx;
}
