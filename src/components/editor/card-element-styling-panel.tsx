"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ChevronDown } from "lucide-react";
import type { CardElementData, CardIconSizeMode } from "@/lib/card-types";
import type { NodeSize } from "@/lib/types";
import { CARD_ICON_SIZE_MODES } from "@/lib/card-icon-layout";
import { CardFillStyleControls } from "./card-fill-style-controls";
import { cn } from "@/lib/utils";

export interface CardElementStylingPanelProps {
  element: CardElementData;
  onElementChange: (patch: Partial<CardElementData>) => void;
  onClearSelection?: () => void;
}

export function CardElementStylingPanel({
  element,
  onElementChange,
  onClearSelection,
}: CardElementStylingPanelProps) {
  const hasIcon = element.kind === "icon-slot" && !!element.iconRef;
  const iconRef = element.iconRef;

  const kindLabel = hasIcon
    ? "Icon"
    : element.kind === "icon-slot"
      ? "Icon region"
      : element.kind === "text"
        ? "Text block"
        : element.kind === "tag"
          ? "Tag"
          : element.kind === "section"
            ? "Section"
            : element.kind;

  const textColor = element.textColor ?? "#0f172a";
  const borderColor = element.style?.borderColor ?? "#0f172a";
  const isLucide =
    !!iconRef &&
    (iconRef.type.startsWith("generic.icon.") || iconRef.iconType === "lucide");
  const rawIconOpacity = iconRef?.iconOpacity;
  const iconOpacity =
    typeof rawIconOpacity === "number" && Number.isFinite(rawIconOpacity)
      ? Math.min(1, Math.max(0, rawIconOpacity))
      : 1;

  return (
    <Collapsible defaultOpen className="border-t pt-3 mt-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between py-1 text-sm font-medium">
        <span>Card element — {kindLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <p className="text-xs text-muted-foreground">
          {hasIcon
            ? "Right-click the icon for quick actions, or adjust properties here."
            : "Click regions inside the card to select them. Changes apply to this element only."}
        </p>

        {hasIcon && iconRef && (
          <>
            {isLucide && (
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Icon color</Label>
                <ColorPicker
                  value={iconRef.iconColor ?? "#374151"}
                  onChange={(value) =>
                    onElementChange({ iconRef: { ...iconRef, iconColor: value } })
                  }
                />
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm text-muted-foreground">Icon opacity</Label>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {Math.round(iconOpacity * 100)}%
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[iconOpacity]}
                onValueChange={([v]) =>
                  onElementChange({ iconRef: { ...iconRef, iconOpacity: v } })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Sizing</Label>
              <Select
                value={iconRef.iconSizeMode ?? "scaled"}
                onValueChange={(value) =>
                  onElementChange({
                    iconRef: { ...iconRef, iconSizeMode: value as CardIconSizeMode },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Scaled" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {CARD_ICON_SIZE_MODES.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="text-sm">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-muted-foreground">Icon size</Label>
              <Select
                value={iconRef.nodeSize ?? "normal"}
                onValueChange={(value) =>
                  onElementChange({
                    iconRef: { ...iconRef, nodeSize: value as NodeSize },
                  })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Normal" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="normal" className="text-sm">Normal</SelectItem>
                  <SelectItem value="half" className="text-sm">Half</SelectItem>
                  <SelectItem value="quarter" className="text-sm">Quarter</SelectItem>
                  <SelectItem value="double" className="text-sm">Double</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm text-muted-foreground">Remove background</Label>
              <Switch
                checked={!!iconRef.noIconBackground}
                onCheckedChange={(checked) =>
                  onElementChange({ iconRef: { ...iconRef, noIconBackground: checked } })
                }
              />
            </div>
            <button
              type="button"
              className="text-xs text-destructive underline hover:opacity-80"
              onClick={() => onElementChange({ iconRef: undefined })}
            >
              Remove icon
            </button>
          </>
        )}

        {(element.kind === "section" || element.kind === "text" || element.kind === "icon-slot" || element.kind === "tag") && (
          <CardFillStyleControls
            label="Background"
            style={element.style}
            onChange={(style) => onElementChange({ style })}
          />
        )}
        {(element.kind === "text" || element.kind === "tag") && (
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Text color</Label>
            <ColorPicker
              value={textColor}
              onChange={(value) => onElementChange({ textColor: value })}
            />
          </div>
        )}
        {(element.kind === "section" || element.kind === "text") && (
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Border color</Label>
            <ColorPicker
              value={borderColor}
              onChange={(value) =>
                onElementChange({
                  style: {
                    ...element.style,
                    borderColor: value,
                    borderWidth: element.style?.borderWidth ?? 1,
                    borderStyle: element.style?.borderStyle ?? "solid",
                  },
                })
              }
            />
          </div>
        )}
        {element.kind === "tag" && (
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Tag label</Label>
            <input
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm",
              )}
              value={element.tag ?? ""}
              onChange={(e) => onElementChange({ tag: e.target.value })}
            />
          </div>
        )}
        {onClearSelection && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline hover:text-foreground"
            onClick={onClearSelection}
          >
            Clear element selection
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
