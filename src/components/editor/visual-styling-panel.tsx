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
  HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC,
} from "@/lib/highlight-anim";
import { Palette, RotateCcw, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { GradientAnglePicker } from "./gradient-angle-picker";
import Draggable from 'react-draggable';

function HighlightAnimEffectControls({
  styling,
  handlePropertyChange,
  onStylingChange,
}: {
  styling: Partial<VisualStyling>;
  handlePropertyChange: (property: keyof VisualStyling, value: unknown, immediate?: boolean) => void;
  onStylingChange: (styling: Partial<VisualStyling>) => void;
}) {
  const enabled = Boolean(styling.highlightAnim);
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
      <div className="flex items-center gap-2">
        <Checkbox
          id="dw-highlight-anim"
          checked={enabled}
          onCheckedChange={(checked) => {
            const on = checked === true;
            if (on) {
              onStylingChange({
                highlightAnim: true,
                highlightAnimDurationSec: styling.highlightAnimDurationSec ?? HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC,
                highlightAnimIntervalSec: styling.highlightAnimIntervalSec ?? HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC,
                highlightAnimGlowColor: styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR,
              });
            } else {
              handlePropertyChange("highlightAnim", false, true);
            }
          }}
        />
        <Label htmlFor="dw-highlight-anim" className="text-sm text-muted-foreground font-normal cursor-pointer">
          Highlight animation
        </Label>
      </div>
      {enabled && (
        <div className="grid grid-cols-2 gap-2 pl-6">
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
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">Glow color</Label>
            <ColorPicker
              value={styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR}
              onChange={(value) => handlePropertyChange("highlightAnimGlowColor", value)}
              placeholder={HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR}
              showAlpha={true}
              allowTransparent={true}
            />
          </div>
        </div>
      )}
    </div>
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
  /** When true, shows corner radius control (rounded-rectangle only) */
  isRoundedRectangle?: boolean;
  /** When true, shows heading strip color (text-box-heading only) */
  isTextBoxHeading?: boolean;
}

export const VisualStylingPanel = React.memo(function VisualStylingPanel({ styling, onStylingChange, onReset, onClose, selectedItemIds, tag, tagPosition, onTagChange, onTagPositionChange, isLucideIcon = false, showRemoveBackground = false, noIconBackground = false, showFullStyling = true, isShape = false, isRoundedRectangle = false, isTextBoxHeading = false }: VisualStylingPanelProps) {
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

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  // Find the closest predefined style for the current styling
  const currentPredefinedStyle = findClosestPredefinedStyle(styling as VisualStyling);

  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      onStop={(e, data) => {
        setPosition({ x: data.x, y: data.y });
      }}
    >
      <div ref={nodeRef} className={`fixed top-20 left-20 z-50 bg-popover border border-border rounded-lg shadow-lg cursor-move ${showFullStyling ? 'w-[640px]' : 'w-[512px]'} max-w-[calc(100vw-2rem)]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-semibold text-foreground">{isLucideIcon ? 'Icon Styling' : 'Visual Styling'}</h3>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 w-9 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="p-5 space-y-4">
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
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4 min-w-0">
              <div className="bg-muted/50 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                  <Label className="text-sm font-semibold text-foreground">Preset</Label>
                </div>
                <Select
                  value={currentPredefinedStyle || 'custom'}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      return;
                    }
                    handlePredefinedStyleChange(value as keyof typeof VISUAL_STYLES);
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
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
              </div>

              <div className="bg-amber-50/50 rounded-md p-3 border border-amber-200/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />
                  <Label className="text-sm font-semibold text-foreground">Border</Label>
                </div>
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
              </div>

              <div className="bg-emerald-50/50 rounded-md p-3 border border-emerald-200/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                  <Label className="text-sm font-semibold text-foreground">Background</Label>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Style</Label>
                    <Select
                      value={styling.backgroundStyle || 'solid'}
                      onValueChange={(value) => handlePropertyChange('backgroundStyle', value as any)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="none" className="text-sm">None</SelectItem>
                        <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                        <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
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
                      <ColorPicker
                        value={styling.backgroundColor || '#f3f4f6'}
                        onChange={(value) => handlePropertyChange('backgroundColor', value)}
                        placeholder="#f3f4f6"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 min-w-0 border-l border-border pl-8">
              <div className="bg-purple-50/50 rounded-md p-3 border border-purple-200/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0" />
                  <Label className="text-sm font-semibold text-foreground">Effects</Label>
                </div>
                <div className="space-y-3">
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
                  {isRoundedRectangle && (
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
                </div>
              </div>

              <div className="bg-indigo-50/50 rounded-md p-3 border border-indigo-200/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0" />
                  <Label className="text-sm font-semibold text-foreground">Tags</Label>
                </div>
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
              </div>
            </div>
          </div>
          )}
        </div>
       </div>
     </Draggable>
   );
});