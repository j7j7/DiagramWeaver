"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Slider } from "@/components/ui/slider";
import { Shuffle } from "lucide-react";
import type { CardElementStyle } from "@/lib/card-types";
import { GradientAnglePicker } from "./gradient-angle-picker";
import {
  createRandomMeshGradientPoints,
  MESH_GRADIENT_INITIAL_BASE_COLOR,
  normalizeMeshGradientPoints,
} from "@/lib/mesh-gradient";
import { deriveBackgroundGradientColors } from "@/lib/visual-styling";
import { cn } from "@/lib/utils";

export interface CardFillStyleControlsProps {
  label: string;
  style: CardElementStyle | undefined;
  onChange: (style: CardElementStyle) => void;
  /** When false, mesh gradient option is hidden (small text chips). Default true. */
  supportsMesh?: boolean;
  className?: string;
}

function resolvedStyle(style: CardElementStyle | undefined): CardElementStyle {
  return {
    backgroundStyle: style?.backgroundStyle ?? (style?.backgroundColor ? "solid" : "solid"),
    backgroundColor: style?.backgroundColor ?? "#3b82f6",
    backgroundColors: style?.backgroundColors ?? ["#3b82f6", "#1d4ed8"],
    gradientAngle: style?.gradientAngle ?? 135,
    meshGradientPoints: style?.meshGradientPoints,
    borderRadius: style?.borderRadius,
    borderColor: style?.borderColor,
    borderWidth: style?.borderWidth,
    borderStyle: style?.borderStyle,
    opacity: style?.opacity,
  };
}

export function CardFillStyleControls({
  label,
  style,
  onChange,
  supportsMesh = true,
  className,
}: CardFillStyleControlsProps) {
  const s = resolvedStyle(style);
  const bgStyle = s.backgroundStyle ?? "solid";

  const patch = (partial: Partial<CardElementStyle>) => onChange({ ...s, ...partial });

  const handleStyleSelect = (value: string) => {
    if (value === "none") {
      patch({ backgroundStyle: "none" });
      return;
    }
    if (value === "solid") {
      patch({
        backgroundStyle: "solid",
        backgroundColor: s.backgroundColor ?? "#3b82f6",
      });
      return;
    }
    if (value === "gradient") {
      const prevStyle = s.backgroundStyle ?? "solid";
      const needsGradientRecalc = prevStyle === "solid" || prevStyle === "mesh_gradient";
      patch({
        backgroundStyle: "gradient",
        backgroundColors: needsGradientRecalc
          ? deriveBackgroundGradientColors(s)
          : (s.backgroundColors ?? ["#3b82f6", "#1d4ed8"]),
        gradientAngle: s.gradientAngle ?? 135,
      });
      return;
    }
    if (value === "mesh_gradient") {
      patch({
        backgroundStyle: "mesh_gradient",
        backgroundColor: s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR,
        meshGradientPoints:
          s.meshGradientPoints ??
          createRandomMeshGradientPoints(s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR),
      });
    }
  };

  const handleRandomizeMesh = () => {
    const base = s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR;
    patch({
      backgroundStyle: "mesh_gradient",
      backgroundColor: base,
      meshGradientPoints: createRandomMeshGradientPoints(base),
    });
  };

  return (
    <div className={cn("space-y-2 rounded-md border border-border/70 bg-muted/20 p-3", className)}>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div
        className={cn(
          "grid gap-2",
          bgStyle === "gradient" ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">Fill style</Label>
          <div
            className={cn(
              "items-center gap-2",
              bgStyle === "mesh_gradient" && supportsMesh
                ? "grid grid-cols-[minmax(0,1fr)_auto]"
                : "grid grid-cols-1",
            )}
          >
            <Select value={bgStyle} onValueChange={handleStyleSelect}>
              <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                <SelectItem value="none" className="text-sm">None</SelectItem>
                <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
                {supportsMesh ? (
                  <SelectItem value="mesh_gradient" className="text-sm">Mesh gradient</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
            {bgStyle === "mesh_gradient" && supportsMesh ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1 px-2.5"
                onClick={handleRandomizeMesh}
                title="Randomize hub positions and colours"
              >
                <Shuffle className="h-3.5 w-3.5 shrink-0" />
                Random
              </Button>
            ) : null}
          </div>
        </div>
        {bgStyle === "gradient" ? (
          <GradientAnglePicker
            value={s.gradientAngle ?? 135}
            onChange={(angle) => patch({ gradientAngle: angle })}
            label="Direction"
          />
        ) : null}
      </div>

      {bgStyle === "solid" ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Colour</Label>
          <ColorPicker
            value={s.backgroundColor ?? "#3b82f6"}
            onChange={(value) => patch({ backgroundColor: value, backgroundStyle: "solid" })}
            showAlpha
            allowTransparent
          />
        </div>
      ) : null}

      {bgStyle === "gradient" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Start</Label>
            <ColorPicker
              value={s.backgroundColors?.[0] ?? "#3b82f6"}
              onChange={(value) =>
                patch({
                  backgroundColors: [value, s.backgroundColors?.[1] ?? "#1d4ed8"],
                  backgroundStyle: "gradient",
                })
              }
              showAlpha
              allowTransparent
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">End</Label>
            <ColorPicker
              value={s.backgroundColors?.[1] ?? "#1d4ed8"}
              onChange={(value) =>
                patch({
                  backgroundColors: [s.backgroundColors?.[0] ?? "#3b82f6", value],
                  backgroundStyle: "gradient",
                })
              }
              showAlpha
              allowTransparent
            />
          </div>
        </div>
      ) : null}

      {bgStyle === "mesh_gradient" && supportsMesh ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Base fill</Label>
            <ColorPicker
              value={s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR}
              onChange={(value) => patch({ backgroundColor: value })}
              showAlpha
              allowTransparent
            />
          </div>
          {normalizeMeshGradientPoints(
            s.meshGradientPoints,
            s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR,
          ).map((pt, idx) => (
            <div key={idx} className="space-y-2 rounded-md border border-border bg-background/80 p-2.5">
              <Label className="text-xs font-medium text-foreground">Hub {idx + 1}</Label>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Horizontal (X %)</Label>
                  <span className="w-9 tabular-nums text-right text-xs text-muted-foreground">
                    {Math.round(pt.xPct)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(pt.xPct)]}
                  onValueChange={([v]) => {
                    const pts = normalizeMeshGradientPoints(
                      s.meshGradientPoints,
                      s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR,
                    );
                    patch({
                      meshGradientPoints: pts.map((p, i) => (i === idx ? { ...p, xPct: v } : p)),
                    });
                  }}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">Vertical (Y %)</Label>
                  <span className="w-9 tabular-nums text-right text-xs text-muted-foreground">
                    {Math.round(pt.yPct)}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(pt.yPct)]}
                  onValueChange={([v]) => {
                    const pts = normalizeMeshGradientPoints(
                      s.meshGradientPoints,
                      s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR,
                    );
                    patch({
                      meshGradientPoints: pts.map((p, i) => (i === idx ? { ...p, yPct: v } : p)),
                    });
                  }}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hub colour</Label>
                <ColorPicker
                  value={pt.color}
                  onChange={(value) => {
                    const pts = normalizeMeshGradientPoints(
                      s.meshGradientPoints,
                      s.backgroundColor ?? MESH_GRADIENT_INITIAL_BASE_COLOR,
                    );
                    patch({
                      meshGradientPoints: pts.map((p, i) => (i === idx ? { ...p, color: value } : p)),
                    });
                  }}
                  showAlpha={false}
                  allowTransparent={false}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
