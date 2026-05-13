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
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";

export interface CanvasBackgroundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saved color for the current diagram level; omit or empty = theme default */
  savedColor?: string;
  onSave: (color: string | undefined) => void;
  isReadOnly?: boolean;
}

const DEFAULT_PICKER_SEED = "#f4f4f5";

export function CanvasBackgroundDialog({
  open,
  onOpenChange,
  savedColor,
  onSave,
  isReadOnly = false,
}: CanvasBackgroundDialogProps) {
  const [draft, setDraft] = React.useState(DEFAULT_PICKER_SEED);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = savedColor?.trim();
    setDraft(trimmed && trimmed.length > 0 ? trimmed : DEFAULT_PICKER_SEED);
  }, [open, savedColor]);

  const handleUseThemeDefault = () => {
    if (isReadOnly) return;
    onSave(undefined);
    onOpenChange(false);
  };

  const handleApply = () => {
    if (isReadOnly) return;
    onSave(draft.trim() || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Canvas background</DialogTitle>
          <DialogDescription>
            Optional colour for this diagram (stored in JSON). When unset, the app theme background is used. Applies in
            the editor, viewer, and presentation play mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-muted-foreground">Colour</Label>
          <div className={isReadOnly ? "pointer-events-none opacity-60" : ""}>
            <ColorPicker
              value={draft}
              onChange={setDraft}
              placeholder={DEFAULT_PICKER_SEED}
              showAlpha={true}
              allowTransparent={true}
            />
          </div>
          {savedColor?.trim() ? (
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-mono tabular-nums">{savedColor.trim()}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Currently using theme default.</p>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={handleUseThemeDefault} disabled={isReadOnly}>
            Use theme default
          </Button>
          <Button type="button" onClick={handleApply} disabled={isReadOnly}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
