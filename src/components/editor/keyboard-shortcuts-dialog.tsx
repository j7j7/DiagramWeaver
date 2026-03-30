"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded border border-amber-300 bg-amber-100/90 px-1.5 py-0.5 font-mono text-[11px] font-medium text-amber-950 tabular-nums dark:border-amber-600 dark:bg-amber-900/60 dark:text-amber-100",
        className
      )}
    >
      {children}
    </kbd>
  );
}

function useIsMac() {
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        (navigator.platform.toUpperCase().includes("MAC") || /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent))
    );
  }, []);
  return isMac;
}

type Row = { action: string; keys: React.ReactNode };

function ShortcutTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/90 dark:text-amber-200/90">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {rows.map((row, i) => (
          <li
            key={i}
            className="flex flex-col gap-0.5 border-b border-amber-200/80 pb-1.5 text-sm last:border-0 dark:border-amber-800/80 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <span className="text-amber-950/95 dark:text-amber-50/95">{row.action}</span>
            <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">{row.keys}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const isMac = useIsMac();
  const mod = isMac ? "⌘" : "Ctrl";
  const shiftLabel = isMac ? "⇧" : "Shift";
  const alt = isMac ? "⌥" : "Alt";
  /** Axis lock during canvas drag — uses the Control key (⌃), not Command (see use-canvas-drag-drop). */
  const controlLabel = isMac ? "⌃" : "Ctrl";

  const modPlus = (key: string) => (
    <>
      <Kbd>{mod}</Kbd>
      <span className="text-amber-700 dark:text-amber-300">+</span>
      <Kbd>{key}</Kbd>
    </>
  );

  const modShiftPlus = (key: string) => (
    <>
      <Kbd>{mod}</Kbd>
      <span className="text-amber-700 dark:text-amber-300">+</span>
      <Kbd>{shiftLabel}</Kbd>
      <span className="text-amber-700 dark:text-amber-300">+</span>
      <Kbd>{key}</Kbd>
    </>
  );

  const modAltPlus = (key: string) => (
    <>
      <Kbd>{mod}</Kbd>
      <span className="text-amber-700 dark:text-amber-300">+</span>
      <Kbd>{alt}</Kbd>
      <span className="text-amber-700 dark:text-amber-300">+</span>
      <Kbd>{key}</Kbd>
    </>
  );

  const altPlus = (key: string) => (
    <>
      <Kbd>{alt}</Kbd>
      <span className="text-amber-700 dark:text-amber-300">+</span>
      <Kbd>{key}</Kbd>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(85vh,720px)] max-w-2xl overflow-y-auto border-2 border-amber-400 bg-amber-50 text-amber-950 shadow-xl",
          "dark:border-amber-500 dark:bg-amber-950/95 dark:text-amber-50",
          "[&>button]:text-amber-800 dark:[&>button]:text-amber-200 [&>button]:hover:text-amber-950 dark:[&>button]:hover:text-amber-50"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-amber-950 dark:text-amber-50">Keyboard shortcuts & canvas input</DialogTitle>
          <DialogDescription className="text-amber-900/85 dark:text-amber-100/85">
            Editor shortcuts and mouse/modifier behavior on the canvas.
            {isMac ? " Keys use Mac symbols (⌘ ⌥ ⇧); ⌃ is Control." : " Ctrl is the Control key."}{" "}
            Keyboard shortcuts are ignored while focus is in a text field, label, or the JSON editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          <ShortcutTable
            title="Duplicate on canvas"
            rows={[
              {
                action: "Duplicate with clipboard (place with paste)",
                keys: (
                  <span className="flex flex-wrap items-center gap-1">
                    {modPlus("C")}
                    <span className="text-amber-700 dark:text-amber-300">then</span>
                    {modPlus("V")}
                  </span>
                ),
              },
              {
                action:
                  "Duplicate by dragging: hold Alt (Option on Mac) while dragging, then release — drops copies at the new position (nodes only; not zones)",
                keys: (
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>{alt}</Kbd>
                    <span className="text-amber-700 dark:text-amber-300">+ drag</span>
                  </span>
                ),
              },
            ]}
          />
          <ShortcutTable
            title="File & diagram"
            rows={[
              { action: "New diagram", keys: modPlus("N") },
              { action: "Open / Load diagram", keys: modPlus("O") },
              { action: "Save diagram", keys: modPlus("S") },
              { action: "Toggle JSON panel", keys: modShiftPlus("J") },
            ]}
          />
          <ShortcutTable
            title="Edit & clipboard"
            rows={[
              { action: "Undo", keys: modPlus("Z") },
              { action: "Redo", keys: modShiftPlus("Z") },
              { action: "Redo (alternate)", keys: modPlus("Y") },
              { action: "Copy selection", keys: modPlus("C") },
              { action: "Paste", keys: modPlus("V") },
              { action: "Select all", keys: modPlus("A") },
            ]}
          />
          <ShortcutTable
            title="Selection, layout & canvas"
            rows={[
              {
                action: "Multi-select: add or remove an item when clicking it",
                keys: (
                  <span className="max-w-[220px] text-right text-[11px] leading-snug text-amber-900 dark:text-amber-100">
                    <Kbd>{shiftLabel}</Kbd>
                    <span className="text-amber-700 dark:text-amber-300"> / </span>
                    <Kbd>Ctrl</Kbd>
                    <span className="text-amber-700 dark:text-amber-300"> / </span>
                    <Kbd>{mod}</Kbd>
                    <span className="text-amber-700 dark:text-amber-300"> + click</span>
                  </span>
                ),
              },
              {
                action: "Clear multi-selection (when two or more items are selected)",
                keys: (
                  <>
                    <Kbd>Esc</Kbd>
                  </>
                ),
              },
              {
                action: "Move selection (10px, grid-aligned)",
                keys: (
                  <span className="flex flex-wrap gap-1">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                    <Kbd>←</Kbd>
                    <Kbd>→</Kbd>
                  </span>
                ),
              },
              { action: "Group selected items", keys: modPlus("G") },
              { action: "Ungroup selected items", keys: modShiftPlus("G") },
              { action: "Auto layout", keys: modShiftPlus("L") },
            ]}
          />
          <ShortcutTable
            title="Canvas: drag & modifiers"
            rows={[
              {
                action:
                  "Move selection on grid — drag items; grouped items move together; multi-selection moves as a set",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Drag</span>,
              },
              {
                action:
                  "Lock movement to horizontal or vertical — hold Control while dragging (after a short move, axis locks; Mac: use ⌃, not ⌘)",
                keys: (
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>{controlLabel}</Kbd>
                    <span className="text-amber-700 dark:text-amber-300">+ drag</span>
                  </span>
                ),
              },
              {
                action: "Marquee select — drag on empty canvas with the left button",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Left drag</span>,
              },
            ]}
          />
          <ShortcutTable
            title="Canvas: mouse (no modifier keys)"
            rows={[
              {
                action: "Zoom in or out",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Wheel on canvas</span>,
              },
              {
                action: "Pan the viewport — right-click and drag on empty canvas (not on a shape)",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Right drag</span>,
              },
              {
                action:
                  "Quick place from resources — right-click empty canvas without dragging to open search; pick an item to add at that diagram position",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Right-click</span>,
              },
              {
                action:
                  "Item menu — right-click a node, zone, or connection for copy, delete, styling, connect, grouping, layer, sub-diagram, order, lock, …",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Right-click</span>,
              },
            ]}
          />
          <ShortcutTable
            title="Resize handles"
            rows={[
              {
                action: "Resize along one edge — drag a side handle",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Drag handle</span>,
              },
              {
                action: "Resize width and height independently — drag the bottom-right corner handle",
                keys: <span className="text-xs text-amber-800 dark:text-amber-200">Corner drag</span>,
              },
              {
                action: "Resize proportionally (keep aspect ratio) — hold Shift while dragging the bottom-right corner handle",
                keys: (
                  <span className="flex flex-wrap items-center gap-1">
                    <Kbd>{shiftLabel}</Kbd>
                    <span className="text-amber-700 dark:text-amber-300">+</span>
                    <span className="text-xs text-amber-800 dark:text-amber-200">corner drag</span>
                  </span>
                ),
              },
            ]}
          />
          <ShortcutTable
            title="Delete"
            rows={[
              {
                action: "Delete selected item(s) or connection",
                keys: (
                  <span className="flex flex-wrap gap-1">
                    <Kbd>Delete</Kbd>
                    <span className="text-amber-700 dark:text-amber-300">/</span>
                    <Kbd>Backspace</Kbd>
                  </span>
                ),
              },
            ]}
          />
          <ShortcutTable
            title="Connections & animation"
            rows={[
              { action: "Toggle connection path animations", keys: modAltPlus("A") },
              {
                action: "Toggle “click to show animations” (when path animations are on)",
                keys: modAltPlus("C"),
              },
            ]}
          />
          <ShortcutTable
            title="Presentation mode"
            rows={[
              {
                action: "Enter presentation mode, or start playback if already in presentation mode",
                keys: modAltPlus("P"),
              },
              {
                action: "Exit presentation mode",
                keys: altPlus("P"),
              },
            ]}
          />
        </div>

        <DialogFooter className="border-t border-amber-200/90 pt-2 dark:border-amber-800/90">
          <Button
            type="button"
            variant="outline"
            className="border-amber-400 bg-amber-100/80 text-amber-950 hover:bg-amber-200/90 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-50 dark:hover:bg-amber-800/80"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
