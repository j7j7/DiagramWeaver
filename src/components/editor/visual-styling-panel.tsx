"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import { VisualStyling, VISUAL_STYLES, getPredefinedVisualStyle, findClosestPredefinedStyle } from "@/lib/visual-styling";
import {
  HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC,
  HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR,
  HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY,
  HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC,
  highlightGlowApproxHaloPx,
} from "@/lib/highlight-anim";
import { ChevronDown, Palette, RotateCcw, X } from "lucide-react";
import { GradientAnglePicker } from "./gradient-angle-picker";
import { Slider } from "@/components/ui/slider";
import Draggable from "react-draggable";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** Spatial halo radius (blur size), distinct from RGBA opacity on the glow colour picker. */
function HighlightGlowStrengthSlider({
  intensity,
  onChange,
  className,
}: {
  intensity: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY));
  const approxPx = highlightGlowApproxHaloPx(v);
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">Glow spread (~size)</Label>
      <div className="flex items-center gap-3 pr-1">
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[v]}
          onValueChange={([nv]) => onChange(nv)}
          className="flex-1"
        />
        <span className="w-14 tabular-nums text-xs text-muted-foreground text-right">~{approxPx}px</span>
      </div>
    </div>
  );
}

function HighlightAnimEffectControls({
  styling,
  handlePropertyChange,
  onStylingChange,
}: {
  styling: Partial<VisualStyling>;
  handlePropertyChange: (property: keyof VisualStyling, value: unknown, immediate?: boolean) => void;
  onStylingChange: (styling: Partial<VisualStyling>) => void;
}) {
  const triSelect: "off" | "constant" | "pulse" = !styling.highlightAnim
    ? "off"
    : styling.highlightAnimMode === "constant"
      ? "constant"
      : "pulse"; /* legacy omit / undefined / 'pulse' */
  const committedDurStr = String(styling.highlightAnimDurationSec ?? HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC);
  const committedIntStr = String(styling.highlightAnimIntervalSec ?? HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC);
  const [durFocused, setDurFocused] = useState(false);
  const [intFocused, setIntFocused] = useState(false);
  const [durDraft, setDurDraft] = useState(committedDurStr);
  const [intDraft, setIntDraft] = useState(committedIntStr);

  const durDisplay = durFocused ? durDraft : committedDurStr;
  const intDisplay = intFocused ? intDraft : committedIntStr;

  const commitDuration = useCallback(() => {
    const n = parseFloat(durDraft);
    let v: number;
    if (!Number.isFinite(n) || durDraft.trim() === "") {
      v = HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC;
    } else {
      v = Math.min(120, Math.max(0.05, n));
    }
    setDurDraft(String(v));
    handlePropertyChange("highlightAnimDurationSec", v, true);
  }, [durDraft, handlePropertyChange]);

  const commitInterval = useCallback(() => {
    const n = parseFloat(intDraft);
    let v: number;
    if (!Number.isFinite(n) || intDraft.trim() === "") {
      v = HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC;
    } else {
      v = Math.min(600, Math.max(0, n));
    }
    setIntDraft(String(v));
    handlePropertyChange("highlightAnimIntervalSec", v, true);
  }, [intDraft, handlePropertyChange]);

  return (
    <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Glow</Label>
          <Select
            value={triSelect}
            onValueChange={(v) => {
              if (v === "off") {
                onStylingChange({ highlightAnim: false, highlightAnimMode: undefined });
              } else if (v === "constant") {
                onStylingChange({
                  highlightAnim: true,
                  highlightAnimMode: "constant",
                  highlightAnimGlowColor:
                    styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR,
                  highlightAnimGlowIntensity:
                    styling.highlightAnimGlowIntensity ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY,
                });
              } else {
                /* Explicit `'pulse'` so merges overwrite persisted `'constant'` (undefined strips in some spreads). */
                onStylingChange({
                  highlightAnim: true,
                  highlightAnimMode: "pulse",
                  highlightAnimDurationSec:
                    styling.highlightAnimDurationSec ?? HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC,
                  highlightAnimIntervalSec:
                    styling.highlightAnimIntervalSec ?? HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC,
                  highlightAnimGlowColor:
                    styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR,
                  highlightAnimGlowIntensity:
                    styling.highlightAnimGlowIntensity ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY,
                });
              }
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Glow" />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              <SelectItem value="off" className="text-sm">
                Off
              </SelectItem>
              <SelectItem value="constant" className="text-sm">
                Constant glow
              </SelectItem>
              <SelectItem value="pulse" className="text-sm">
                Pulse (animate)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(triSelect === "constant" || triSelect === "pulse") && (
          <div className={cn(triSelect === "pulse" && "grid grid-cols-2 gap-2")}>
            {triSelect === "pulse" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Duration (s)</Label>
                  <Input
                    type="number"
                    min={0.05}
                    max={120}
                    step={0.1}
                    value={durDisplay}
                    onChange={(e) => setDurDraft(e.target.value)}
                    onFocus={() => {
                      setDurFocused(true);
                      setDurDraft(committedDurStr);
                    }}
                    onBlur={() => {
                      commitDuration();
                      setDurFocused(false);
                    }}
                    className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Interval (s)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    step={0.1}
                    value={intDisplay}
                    onChange={(e) => setIntDraft(e.target.value)}
                    onFocus={() => {
                      setIntFocused(true);
                      setIntDraft(committedIntStr);
                    }}
                    onBlur={() => {
                      commitInterval();
                      setIntFocused(false);
                    }}
                    className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </>
            )}
            <div className={cn("space-y-3", triSelect === "pulse" && "col-span-2")}>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Glow color</Label>
                <ColorPicker
                  value={styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR}
                  onChange={(value) => handlePropertyChange("highlightAnimGlowColor", value)}
                  placeholder={HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR}
                  showAlpha={true}
                  allowTransparent={true}
                />
              </div>
              <HighlightGlowStrengthSlider
                intensity={styling.highlightAnimGlowIntensity ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY}
                onChange={(nv) => handlePropertyChange("highlightAnimGlowIntensity", nv, true)}
              />
            </div>
          </div>
        )}
      </div>
  );
}

function StylingAccordionSection(props: {
  title: string;
  dotClassName: string;
  outerClassName: string;
  defaultOpen?: boolean;
  triggerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { title, dotClassName, outerClassName, defaultOpen = true, triggerExtra, children } = props;
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("group min-w-0 rounded-md border", outerClassName)}>
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90"
          aria-hidden
        />
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotClassName)} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {triggerExtra}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 overflow-hidden border-t border-border/70 px-3 pb-3 pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface VisualStylingPanelProps {
  styling: Partial<VisualStyling>;
  onStylingChange: (styling: Partial<VisualStyling>) => void;
  onReset?: () => void;
  onClose?: () => void;
  selectedItemIds?: Set<string>; // Multi-selected items
  tag?: string;
  tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  onTagChange?: (tag: string) => void;
  onTagPositionChange?: (position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => void;
  /** When true, shows Icon Color control (Lucide icons only) */
  isLucideIcon?: boolean;
  /** When true, shows Remove background toggle (resource items and Lucide icons) */
  showRemoveBackground?: boolean;
  noIconBackground?: boolean;
  /** When true, shows full styling (Preset, Border, Background, Effects, Tags) - shapes and text nodes */
  showFullStyling?: boolean;
  /** When true, hides Size control - shapes */
  isShape?: boolean;
  /** When true, shows corner radius control (rounded-rectangle & progress-bar) */
  isRoundedRectangle?: boolean;
  /** When true, shows progress fill/track controls */
  isProgressBar?: boolean;
  /** When true, shows heading strip color (text-box-heading only) */
  isTextBoxHeading?: boolean;
}

export const VisualStylingPanel = React.memo(function VisualStylingPanel({ styling, onStylingChange, onReset, onClose, selectedItemIds, tag, tagPosition, onTagChange, onTagPositionChange, isLucideIcon = false, showRemoveBackground = false, noIconBackground = false, showFullStyling = true, isShape = false, isRoundedRectangle = false, isProgressBar = false, isTextBoxHeading = false }: VisualStylingPanelProps) {
  const [position, setPosition] = useState({ x: 200, y: 100 });
  const [isMounted, setIsMounted] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    
    // Load position from localStorage
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('dw:visual-styling:position');
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          setPosition(parsed);
        } catch (e) {
          console.error('Failed to load visual styling panel position', e);
        }
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem('dw:visual-styling:position', JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save visual styling panel position', e);
      }
    }
  }, [position, isMounted]);

  // Debounced property change to prevent excessive updates during color dragging
  const propertyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handlePropertyChange = useCallback((property: keyof VisualStyling, value: any, immediate = false) => {
    // Clear existing timeout
    if (propertyTimeoutRef.current) {
      clearTimeout(propertyTimeoutRef.current);
    }
    
    // Only update the specific property that changed
    const updatedStyling = { [property]: value };
    
    // If multiple items are selected, always use immediate updates to avoid debouncing conflicts
    const isMultiSelect = selectedItemIds && selectedItemIds.size > 1;
    
    if (immediate || isMultiSelect) {
      // Immediate update for final values or multi-select
      onStylingChange(updatedStyling);
    } else {
      // Debounced update during dragging for single select
      propertyTimeoutRef.current = setTimeout(() => {
        onStylingChange(updatedStyling);
      }, 150);
    }
  }, [onStylingChange, selectedItemIds]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (propertyTimeoutRef.current) {
        clearTimeout(propertyTimeoutRef.current);
      }
    };
  }, []);

  const handlePredefinedStyleChange = (styleKey: keyof typeof VISUAL_STYLES) => {
    const predefinedStyle = getPredefinedVisualStyle(styleKey);
    onStylingChange(predefinedStyle);
  };

  const handleBackgroundStyleSelect = (value: string) => {
    if (value === "frosted") {
      onStylingChange({
        backgroundStyle: "frosted" as const,
        frostedDiffusion: styling.frostedDiffusion ?? 0.45,
        frostedTransparency: styling.frostedTransparency ?? 0.55,
        frostedPerlinNoise: styling.frostedPerlinNoise ?? 0,
        backgroundColor: (styling.backgroundColor as string | undefined) || "#f3f4f6",
      });
    } else {
      handlePropertyChange("backgroundStyle", value as "solid" | "gradient" | "none", true);
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  // Find the closest predefined style for the current styling
  const currentPredefinedStyle = findClosestPredefinedStyle(styling as VisualStyling);

  /** Progress bar: start with every section folded so the tall panel fits; remount grid when selection or PB-ness changes so defaults apply. */
  const accordionDefaultOpen = !isProgressBar;
  const accordionRemountKey = `${[...(selectedItemIds ?? new Set<string>())].sort().join("|")}-${isProgressBar ? "pb" : "std"}`;

  return (
    <Draggable
      handle=".dw-visual-styling-drag-handle"
      nodeRef={nodeRef}
      position={position}
      onStop={(e, data) => {
        setPosition({ x: data.x, y: data.y });
      }}
    >
      <div
        ref={nodeRef}
        className={cn(
          "fixed top-20 left-20 z-50 flex max-h-[min(75vh,calc(100vh-4rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg",
          showFullStyling ? "w-[640px]" : "w-[512px]",
          "max-w-[calc(100vw-2rem)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div className="dw-visual-styling-drag-handle flex min-w-0 flex-1 cursor-move items-center gap-2 select-none">
            <Palette className="h-5 w-5 shrink-0 text-blue-600" />
            <h3 className="truncate text-base font-semibold text-foreground">
              {isLucideIcon ? "Icon Styling" : "Visual Styling"}
            </h3>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 shrink-0 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5">
          <div className="space-y-4">
          {(isLucideIcon || showRemoveBackground) && (
            <div className={`grid gap-4 ${isLucideIcon && showRemoveBackground ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isLucideIcon && (
                <div className="bg-muted/50 rounded-md p-3 border border-border min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                    <Label className="text-sm font-semibold text-foreground">Icon Color</Label>
                  </div>
                  <ColorPicker
                    value={styling.iconColor || '#374151'}
                    onChange={(value) => handlePropertyChange('iconColor', value)}
                    placeholder="#374151"
                    showAlpha={false}
                    allowTransparent={false}
                  />
                </div>
              )}
              {showRemoveBackground && (
                <div className="bg-muted/50 rounded-md p-3 border border-border min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold text-foreground">Remove background</Label>
                    <Switch
                      checked={noIconBackground}
                      onCheckedChange={(checked) => onStylingChange({ noIconBackground: checked })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {!showFullStyling && (
            <div className="bg-purple-50/50 rounded-md p-3 border border-purple-200/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0" />
                <Label className="text-sm font-semibold text-foreground">Effects</Label>
              </div>
              <HighlightAnimEffectControls
                styling={styling}
                handlePropertyChange={handlePropertyChange}
                onStylingChange={onStylingChange}
              />
            </div>
          )}

          {!isShape && (
            <div className="bg-muted/50 rounded-md p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-muted-foreground rounded-full shrink-0" />
                <Label className="text-sm font-semibold text-foreground">Size</Label>
              </div>
              <Select
                value={styling.nodeSize || 'normal'}
                onValueChange={(value) => onStylingChange({ nodeSize: value as 'normal' | 'half' | 'quarter' })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Normal" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="normal" className="text-sm">Normal</SelectItem>
                  <SelectItem value="half" className="text-sm">Half</SelectItem>
                  <SelectItem value="quarter" className="text-sm">Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showFullStyling && (
          <div key={accordionRemountKey} className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4 min-w-0">
              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Preset" dotClassName="bg-primary" outerClassName="bg-muted/50 border-border">
                <Select
                  value={currentPredefinedStyle || 'custom'}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      return;
                    }
                    handlePredefinedStyleChange(value as keyof typeof VISUAL_STYLES);
                  }}
                >
                  <SelectTrigger className="h-auto min-h-9 items-start gap-2 py-2 text-sm [&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:flex-1">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    {Object.entries(VISUAL_STYLES).map(([key, style]) => (
                      <SelectItem key={key} value={key} className="text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{style.name}</span>
                          <span className="text-muted-foreground text-xs">{style.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-sm">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </StylingAccordionSection>

              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Border" dotClassName="bg-amber-500" outerClassName="border-amber-200/50 bg-amber-50/50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Style</Label>
                    <Select
                      value={styling.borderStyle || 'solid'}
                      onValueChange={(value) => handlePropertyChange('borderStyle', value as any)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="none" className="text-sm">None</SelectItem>
                        <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                        <SelectItem value="dotted" className="text-sm">Dotted</SelectItem>
                        <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {styling.borderStyle && styling.borderStyle !== 'none' && (
                    <div className="space-y-1 flex flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-sm text-muted-foreground shrink-0">Width</Label>
                        <Input
                          type="number"
                          min={0}
                          max={20}
                          value={styling.borderWidth ?? 2}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (!isNaN(n)) handlePropertyChange('borderWidth', Math.min(20, Math.max(0, n)));
                          }}
                          className="h-9 w-14 text-sm"
                        />
                        {styling.borderStyle === 'gradient' && (
                          <GradientAnglePicker
                            value={styling.borderGradientAngle ?? styling.gradientAngle ?? 135}
                            onChange={(angle) => handlePropertyChange('borderGradientAngle', angle)}
                            label="Dir"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {styling.borderStyle && styling.borderStyle !== 'none' && (
                  <div className="space-y-2">
                    {styling.borderStyle === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">Start</Label>
                          <ColorPicker
                            value={styling.borderColors?.[0] || '#6b7280'}
                            onChange={(value) => {
                              const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                              handlePropertyChange('borderColors', [value, currentColors[1]]);
                            }}
                            placeholder="#6b7280"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">End</Label>
                          <ColorPicker
                            value={styling.borderColors?.[1] || '#3b82f6'}
                            onChange={(value) => {
                              const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                              handlePropertyChange('borderColors', [currentColors[0], value]);
                            }}
                            placeholder="#3b82f6"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <ColorPicker
                        value={styling.borderColor || '#d1d5db'}
                        onChange={(value) => handlePropertyChange('borderColor', value)}
                        placeholder="#d1d5db"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    )}
                  </div>
                )}
              </StylingAccordionSection>

              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Background" dotClassName="bg-emerald-500" outerClassName="border-emerald-200/50 bg-emerald-50/50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Style</Label>
                    <Select
                      value={styling.backgroundStyle || 'solid'}
                      onValueChange={handleBackgroundStyleSelect}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="none" className="text-sm">None</SelectItem>
                        <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                        <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
                        <SelectItem value="frosted" className="text-sm">Frosted glass</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {styling.backgroundStyle === 'gradient' && (
                    <GradientAnglePicker
                      value={styling.gradientAngle ?? 135}
                      onChange={(angle) => handlePropertyChange('gradientAngle', angle)}
                      label="Direction"
                    />
                  )}
                </div>
                {styling.backgroundStyle === 'frosted' && (
                  <div className="space-y-3 mb-2">
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Diffusion (blur strength)</Label>
                      <div className="flex items-center gap-3 pr-1">
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[Math.min(1, Math.max(0, Number(styling.frostedDiffusion ?? 0.45)))]}
                          onValueChange={([v]) => handlePropertyChange("frostedDiffusion", v, true)}
                          className="flex-1"
                        />
                        <span className="w-8 tabular-nums text-xs text-muted-foreground">
                          {((styling.frostedDiffusion ?? 0.45) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Transparency (see-through)</Label>
                      <div className="flex items-center gap-3 pr-1">
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[Math.min(1, Math.max(0, Number(styling.frostedTransparency ?? 0.55)))]}
                          onValueChange={([v]) => handlePropertyChange("frostedTransparency", v, true)}
                          className="flex-1"
                        />
                        <span className="w-8 tabular-nums text-xs text-muted-foreground">
                          {((styling.frostedTransparency ?? 0.55) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Perlin noise (texture)</Label>
                      <div className="flex items-center gap-3 pr-1">
                        <Slider
                          min={0}
                          max={10}
                          step={1}
                          value={[Math.min(10, Math.max(0, Math.round(Number(styling.frostedPerlinNoise ?? 0))))]}
                          onValueChange={([v]) => handlePropertyChange("frostedPerlinNoise", v, true)}
                          className="flex-1"
                        />
                        <span className="w-6 tabular-nums text-xs text-muted-foreground text-right">
                          {Math.min(10, Math.max(0, Math.round(Number(styling.frostedPerlinNoise ?? 0))))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {styling.backgroundStyle && styling.backgroundStyle !== 'none' && (
                  <div className="space-y-2">
                    {styling.backgroundStyle === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">Start</Label>
                          <ColorPicker
                            value={styling.backgroundColors?.[0] || '#f3f4f6'}
                            onChange={(value) => {
                              const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                              handlePropertyChange('backgroundColors', [value, currentColors[1]]);
                            }}
                            placeholder="#f3f4f6"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">End</Label>
                          <ColorPicker
                            value={styling.backgroundColors?.[1] || '#e5e7eb'}
                            onChange={(value) => {
                              const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                              handlePropertyChange('backgroundColors', [currentColors[0], value]);
                            }}
                            placeholder="#e5e7eb"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {styling.backgroundStyle === "frosted" ? (
                          <p className="text-xs text-muted-foreground">Tint color (applies a light wash on top of the blurred backdrop)</p>
                        ) : null}
                        <ColorPicker
                          value={styling.backgroundColor || '#f3f4f6'}
                          onChange={(value) => handlePropertyChange('backgroundColor', value)}
                          placeholder="#f3f4f6"
                          showAlpha={true}
                          allowTransparent={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </StylingAccordionSection>

              {isProgressBar ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Progress bar"
                  dotClassName="bg-sky-500"
                  outerClassName="border-sky-200/50 bg-sky-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Corner radius</Label>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={styling.cornerRadius ?? 0.35}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!isNaN(n)) handlePropertyChange('cornerRadius', Math.min(1, Math.max(0, n)));
                      }}
                      className="h-9 w-16 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Fill amount</Label>
                      <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                        {Math.round(styling.progressPercent ?? 62)}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[Math.round(styling.progressPercent ?? 62)]}
                      onValueChange={([v]) => handlePropertyChange('progressPercent', v, true)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Show percent label</Label>
                    <Switch
                      checked={styling.progressShowPercent !== false}
                      onCheckedChange={(checked) => handlePropertyChange('progressShowPercent', checked, true)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Fill (complete)</Label>
                    <Select
                      value={styling.progressFillStyle === 'solid' ? 'solid' : 'gradient'}
                      onValueChange={(v) =>
                        handlePropertyChange('progressFillStyle', v === 'solid' ? 'solid' : 'gradient', true)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                        <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                    {styling.progressFillStyle === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <ColorPicker
                            value={styling.progressFillColors?.[0] || '#22c55e'}
                            onChange={(value) => {
                              const c = styling.progressFillColors || ['#22c55e', '#15803d'];
                              handlePropertyChange('progressFillColors', [value, c[1]], true);
                            }}
                            placeholder="#22c55e"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <ColorPicker
                            value={styling.progressFillColors?.[1] || '#15803d'}
                            onChange={(value) => {
                              const c = styling.progressFillColors || ['#22c55e', '#15803d'];
                              handlePropertyChange('progressFillColors', [c[0], value], true);
                            }}
                            placeholder="#15803d"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1">
                        <ColorPicker
                          value={styling.progressFillColors?.[0] || '#22c55e'}
                          onChange={(value) => handlePropertyChange('progressFillColors', [value], true)}
                          placeholder="#22c55e"
                          showAlpha={true}
                          allowTransparent={true}
                        />
                      </div>
                    )}
                    {styling.progressFillStyle === 'gradient' ? (
                      <div className="pt-1">
                        <Label className="text-xs text-muted-foreground">Fill gradient angle</Label>
                        <GradientAnglePicker
                          label=""
                          value={styling.progressFillGradientAngle ?? 90}
                          onChange={(a) => handlePropertyChange('progressFillGradientAngle', a, true)}
                        />
                      </div>
                    ) : null}
                  </div>
                </StylingAccordionSection>
              ) : null}
            </div>

            <div className="space-y-4 min-w-0 border-l border-border pl-8">
              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Effects" dotClassName="bg-purple-500" outerClassName="border-purple-200/50 bg-purple-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Shadow</Label>
                    <Switch
                      checked={styling.shadow || false}
                      onCheckedChange={(checked) => handlePropertyChange('shadow', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Rounded Edges</Label>
                    <Switch
                      checked={styling.roundedEdges || false}
                      onCheckedChange={(checked) => handlePropertyChange('roundedEdges', checked)}
                    />
                  </div>
                  <HighlightAnimEffectControls
                    styling={styling}
                    handlePropertyChange={handlePropertyChange}
                    onStylingChange={onStylingChange}
                  />
                  {isRoundedRectangle && !isProgressBar && (
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Corner radius</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={styling.cornerRadius ?? 0.2}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          if (!isNaN(n)) handlePropertyChange('cornerRadius', Math.min(1, Math.max(0, n)));
                        }}
                        className="h-9 w-16 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  )}
                  {isTextBoxHeading && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Heading background</Label>
                      <Select
                        value={styling.headingBackgroundStyle === "solid" ? "solid" : "gradient"}
                        onValueChange={(v) =>
                          handlePropertyChange(
                            "headingBackgroundStyle",
                            v === "solid" ? "solid" : "gradient"
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[70]">
                          <SelectItem value="gradient" className="text-sm">
                            Gradient (fade to transparent)
                          </SelectItem>
                          <SelectItem value="solid" className="text-sm">
                            Solid
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Label className="text-sm text-muted-foreground">Heading color</Label>
                      <ColorPicker
                        value={
                          styling.headingBackgroundColor?.startsWith("#")
                            ? styling.headingBackgroundColor
                            : "#1f2937"
                        }
                        onChange={(value) =>
                          handlePropertyChange("headingBackgroundColor", value)
                        }
                        placeholder="#1f2937"
                        showAlpha={false}
                        allowTransparent={false}
                      />
                    </div>
                  )}
              </StylingAccordionSection>

              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Connectors" dotClassName="bg-teal-500" outerClassName="border-teal-200/50 bg-teal-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <Label className="text-sm text-muted-foreground font-normal">Let lines pass through</Label>
                    <p className="text-xs text-muted-foreground">
                      Orthogonal connector paths ignore this shape as an obstacle (they may cross the outline).
                    </p>
                  </div>
                  <Switch
                    className="shrink-0 mt-0.5"
                    checked={styling.ignoreConnectionAvoidance === true}
                    onCheckedChange={(checked) => handlePropertyChange('ignoreConnectionAvoidance', checked, true)}
                  />
                </div>
              </StylingAccordionSection>

              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Tags" dotClassName="bg-indigo-500" outerClassName="border-indigo-200/50 bg-indigo-50/50">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Text</Label>
                    <Input
                      value={tag || ''}
                      onChange={(e) => onTagChange?.(e.target.value)}
                      placeholder="Tag text"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Position</Label>
                    <Select
                      value={tagPosition || 'top-center'}
                      onValueChange={(value) => onTagPositionChange?.(value as any)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="top-left" className="text-sm">Top L</SelectItem>
                        <SelectItem value="top-center" className="text-sm">Top C</SelectItem>
                        <SelectItem value="top-right" className="text-sm">Top R</SelectItem>
                        <SelectItem value="bottom-left" className="text-sm">Bot L</SelectItem>
                        <SelectItem value="bottom-center" className="text-sm">Bot C</SelectItem>
                        <SelectItem value="bottom-right" className="text-sm">Bot R</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </StylingAccordionSection>
            </div>
          </div>
          )}
        </div>
        </div>
      </div>
    </Draggable>
  );
});