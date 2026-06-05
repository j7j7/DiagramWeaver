"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Download, FolderOpen, Play, Square, Trash2, Upload } from "lucide-react";
import {
  formatRecordingDuration,
  recordingDurationMs,
  useInteractionRecorder,
} from "./interaction-recorder-provider";
import { downloadInteractionRecording, summarizeRecordingEvents } from "@/lib/interaction-recording-playback";
import {
  countEventsMissingSemanticTarget,
  summarizeSemanticRecordingTimeline,
} from "@/lib/interaction-recording-overlay";
import { RECORDER_START_KEY, RECORDER_STOP_KEY } from "@/lib/interaction-recording-types";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{children}</kbd>
  );
}

export function InteractionRecorderDialog() {
  const {
    dialogOpen,
    setDialogOpen,
    armed,
    setArmed,
    status,
    library,
    pendingRecording,
    dismissPendingSave,
    savePendingRecording,
    loadFromFile,
    playRecording,
    stopPlayback,
    removeFromLibrary,
    startRecording,
    stopRecording,
  } = useInteractionRecorder();

  const [saveTitle, setSaveTitle] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState("1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveMode = pendingRecording != null;

  useEffect(() => {
    if (!saveMode) return;
    setSaveTitle("");
    setSaveDescription("");
    setSaveToLibrary(true);
  }, [saveMode, pendingRecording]);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open && saveMode) {
      dismissPendingSave();
    }
    setDialogOpen(open);
  };

  return (
    <>
      <Dialog open={dialogOpen && !saveMode} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Interaction recorder</DialogTitle>
            <DialogDescription>
              Capture pointer, keyboard, wheel, and context-menu actions as a compact JSON recording for how-to
              guides and training. Not video — optimized event replay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="recorder-armed">Recording mode</Label>
                <p className="text-xs text-muted-foreground">
                  When armed, press <Kbd>{RECORDER_START_KEY}</Kbd> to start and <Kbd>{RECORDER_STOP_KEY}</Kbd> to
                  stop.
                </p>
              </div>
              <Switch
                id="recorder-armed"
                checked={armed}
                onCheckedChange={setArmed}
                disabled={status === "recording" || status === "playing"}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!armed || status === "recording" || status === "playing"}
                onClick={startRecording}
              >
                Start now
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={status !== "recording"}
                onClick={stopRecording}
              >
                Stop now
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={status !== "playing"}
                onClick={stopPlayback}
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Stop playback
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Load file…
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="playback-speed" className="shrink-0">
                Playback speed
              </Label>
              <Input
                id="playback-speed"
                type="number"
                min={0.25}
                max={4}
                step={0.25}
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(e.target.value)}
                className="h-8 w-24"
              />
              <span className="text-xs text-muted-foreground">×</span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved recordings</h4>
              {library.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recordings in this browser yet.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                  {library.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{entry.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.eventCount} events · {formatRecordingDuration(entry.durationMs)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title="Play"
                        disabled={status === "recording" || status === "playing"}
                        onClick={() => playRecording(entry.recording, parseFloat(playbackSpeed) || 1)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        title="Download"
                        onClick={() => downloadInteractionRecording(entry.recording)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive"
                        title="Remove from library"
                        onClick={() => removeFromLibrary(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveMode} onOpenChange={(open) => !open && dismissPendingSave()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save recording</DialogTitle>
            <DialogDescription>
              {pendingRecording
                ? `${pendingRecording.events.length} events · ${formatRecordingDuration(recordingDurationMs(pendingRecording))}`
                : "Review and save your interaction recording."}
            </DialogDescription>
            {pendingRecording ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {Object.entries(summarizeRecordingEvents(pendingRecording))
                    .map(([k, n]) => `${n} ${k}`)
                    .join(" · ")}
                </p>
                {(() => {
                  const semantic = summarizeSemanticRecordingTimeline(pendingRecording, 12);
                  const missing = countEventsMissingSemanticTarget(pendingRecording);
                  if (semantic.length === 0 && missing === 0) return null;
                  return (
                    <div className="mt-2 rounded-md border border-border/80 bg-muted/40 p-2 text-left text-[11px] leading-relaxed text-muted-foreground">
                      {semantic.length > 0 && (
                        <>
                          <p className="font-medium text-foreground">Semantic actions</p>
                          <ul className="mt-1 list-inside list-disc">
                            {semantic.map((line) => (
                              <li key={line.eventIndex}>
                                {(line.t / 1000).toFixed(2)}s — {line.label}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {missing > 0 && (
                        <p className="mt-1 text-amber-700 dark:text-amber-400">
                          {missing} panel/menu click{missing === 1 ? "" : "s"} lack action ids — replay may miss.
                          Re-record after updating, or check JSON{" "}
                          <code className="rounded bg-background px-1">custom:dwOverlayAction</code>.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : null}
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-title">Title</Label>
              <Input
                id="rec-title"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="e.g. Drop and resize a rounded rectangle"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-desc">Description (optional)</Label>
              <Textarea
                id="rec-desc"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Notes for training or documentation"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <Label htmlFor="rec-library">Keep in browser library</Label>
                <p className="text-xs text-muted-foreground">Also saves a .dwrec.json file download.</p>
              </div>
              <Switch id="rec-library" checked={saveToLibrary} onCheckedChange={setSaveToLibrary} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={dismissPendingSave}>
              Discard
            </Button>
            <Button
              type="button"
              onClick={() => savePendingRecording(saveTitle, saveDescription, saveToLibrary)}
            >
              <FolderOpen className="mr-1.5 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.dwrec.json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            await loadFromFile(file);
          } catch {
            window.alert("Could not load recording file.");
          }
        }}
      />
    </>
  );
}
