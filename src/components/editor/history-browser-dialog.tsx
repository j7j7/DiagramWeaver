"use client";

import React from "react";
import { History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { buildEditorHistoryBrowserEntries } from "@/lib/editor-history-snapshot";

export interface HistoryBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: string[];
  historyIndex: number;
  onJumpToIndex: (index: number) => void;
  isReadOnly?: boolean;
}

export function HistoryBrowserDialog({
  open,
  onOpenChange,
  history,
  historyIndex,
  onJumpToIndex,
  isReadOnly = false,
}: HistoryBrowserDialogProps) {
  const entries = React.useMemo(
    () => buildEditorHistoryBrowserEntries(history, historyIndex),
    [history, historyIndex],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        showOverlay={false}
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className={cn(
          "fixed bottom-4 left-4 top-auto right-auto z-50 flex h-[min(70vh,560px)] w-[min(100vw-2rem,22rem)] translate-x-0 translate-y-0 flex-col gap-3 p-4 shadow-xl",
          "data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2",
          "data-[state=closed]:slide-out-to-left-0 data-[state=open]:slide-in-from-left-0",
          "data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-top-0",
        )}
      >
        <DialogHeader className="space-y-1 pr-0 text-left">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 pr-3">
          <div className="flex flex-col gap-1 pb-1">
            {entries.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No history yet.
              </p>
            ) : (
              entries.map((entry) => {
                const disabled = isReadOnly || entry.isCurrent;
                return (
                  <button
                    key={entry.index}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onJumpToIndex(entry.index);
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      entry.isCurrent
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-transparent bg-muted/40 hover:bg-accent/60",
                      entry.isFuture && !entry.isCurrent && "opacity-70",
                      disabled && !entry.isCurrent && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="mt-0.5 w-8 shrink-0 font-mono text-[11px] text-muted-foreground">
                      #{entry.index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-snug">{entry.label}</span>
                      {entry.isCurrent ? (
                        <span className="mt-0.5 block text-[11px] text-primary">Current</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
