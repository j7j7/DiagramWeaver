"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import type { CardElementStyle } from "@/lib/card-types";
import { cn } from "@/lib/utils";

const NUMBER_INPUT_NO_SPINNER =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export interface CardBorderStyleControlsProps {
  label: string;
  style: CardElementStyle | undefined;
  onChange: (style: CardElementStyle) => void;
  className?: string;
}

function resolvedBorder(style: CardElementStyle | undefined) {
  const width = style?.borderWidth ?? 0;
  const hasBorder = width > 0 && style?.borderStyle !== "none";
  return {
    borderStyle: hasBorder ? (style?.borderStyle ?? "solid") : "none",
    borderWidth: hasBorder ? width : 0,
    borderColor: style?.borderColor ?? "#1e3a5f",
    backgroundStyle: style?.backgroundStyle,
    backgroundColor: style?.backgroundColor,
    backgroundColors: style?.backgroundColors,
    gradientAngle: style?.gradientAngle,
    meshGradientPoints: style?.meshGradientPoints,
    borderRadius: style?.borderRadius,
    opacity: style?.opacity,
  };
}

/** Border controls for card element regions (solid / dotted; no gradient border on DOM sections). */
export function CardBorderStyleControls({
  label,
  style,
  onChange,
  className,
}: CardBorderStyleControlsProps) {
  const s = resolvedBorder(style);
  const [widthFocused, setWidthFocused] = useState(false);
  const [widthDraft, setWidthDraft] = useState(String(s.borderWidth || 1));

  const patch = (partial: Partial<CardElementStyle>) => {
    const base = style ?? {};
    onChange({ ...base, ...partial });
  };

  const handleBorderStyle = (value: string) => {
    if (value === "none") {
      patch({ borderStyle: "none", borderWidth: 0 });
      return;
    }
    patch({
      borderStyle: value as "solid" | "dotted",
      borderWidth: s.borderWidth > 0 ? s.borderWidth : 1,
      borderColor: s.borderColor,
    });
  };

  return (
    <div className={cn("space-y-2 rounded-md border border-border/70 bg-muted/20 p-3", className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Style</Label>
          <Select value={s.borderStyle} onValueChange={handleBorderStyle}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              <SelectItem value="none" className="text-sm">
                None
              </SelectItem>
              <SelectItem value="solid" className="text-sm">
                Solid
              </SelectItem>
              <SelectItem value="dotted" className="text-sm">
                Dotted
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {s.borderStyle !== "none" ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Width</Label>
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={widthFocused ? widthDraft : String(s.borderWidth)}
              onFocus={() => {
                setWidthFocused(true);
                setWidthDraft(String(s.borderWidth));
              }}
              onChange={(e) => setWidthDraft(e.target.value)}
              onBlur={() => {
                setWidthFocused(false);
                const t = widthDraft.trim();
                const revert = s.borderWidth > 0 ? s.borderWidth : 1;
                if (t === "") {
                  setWidthDraft(String(revert));
                  return;
                }
                const n = parseFloat(t.replace(",", "."));
                if (!Number.isFinite(n)) {
                  setWidthDraft(String(revert));
                  return;
                }
                const clamped = Math.min(20, Math.max(0, n));
                patch({
                  borderWidth: clamped,
                  borderStyle: s.borderStyle,
                  borderColor: s.borderColor,
                });
                setWidthDraft(String(clamped));
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
              }}
              className={cn(NUMBER_INPUT_NO_SPINNER, "h-9 tabular-nums text-sm")}
            />
          </div>
        ) : null}
      </div>
      {s.borderStyle !== "none" ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Colour</Label>
          <ColorPicker
            value={s.borderColor}
            onChange={(value) =>
              patch({
                borderColor: value,
                borderStyle: s.borderStyle,
                borderWidth: s.borderWidth > 0 ? s.borderWidth : 1,
              })
            }
            showAlpha
            allowTransparent
          />
        </div>
      ) : null}
    </div>
  );
}
