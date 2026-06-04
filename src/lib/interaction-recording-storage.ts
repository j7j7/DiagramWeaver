import type {
  InteractionRecording,
  InteractionRecordingLibraryEntry,
} from "@/lib/interaction-recording-types";
import { recordingDurationMs } from "@/lib/interaction-recording-playback";

const LIBRARY_STORAGE_KEY = "dw:interaction-recordings:v1";
const MAX_LIBRARY_ENTRIES = 12;
const MAX_EVENTS_PER_ENTRY = 4000;

function readLibraryRaw(): InteractionRecordingLibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InteractionRecordingLibraryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLibraryRaw(entries: InteractionRecordingLibraryEntry[]): void {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(entries));
}

export function listInteractionRecordings(): InteractionRecordingLibraryEntry[] {
  return readLibraryRaw().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function saveInteractionRecordingToLibrary(recording: InteractionRecording): InteractionRecordingLibraryEntry {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const entry: InteractionRecordingLibraryEntry = {
    id,
    title: recording.title || "Untitled recording",
    description: recording.description,
    recordedAt: recording.recordedAt,
    eventCount: recording.events.length,
    durationMs: recordingDurationMs(recording),
    recording: {
      ...recording,
      events: recording.events.slice(0, MAX_EVENTS_PER_ENTRY),
    },
  };

  const next = [entry, ...readLibraryRaw()].slice(0, MAX_LIBRARY_ENTRIES);
  writeLibraryRaw(next);
  return entry;
}

export function deleteInteractionRecordingFromLibrary(id: string): void {
  writeLibraryRaw(readLibraryRaw().filter((e) => e.id !== id));
}

export function getInteractionRecordingFromLibrary(id: string): InteractionRecording | null {
  return readLibraryRaw().find((e) => e.id === id)?.recording ?? null;
}
