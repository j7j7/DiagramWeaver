"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ColorPicker } from "@/components/ui/color-picker";
import { VisualStyling, VISUAL_STYLES, getPredefinedVisualStyle, findClosestPredefinedStyle } from "@/lib/visual-styling";
import { Palette, RotateCcw, X } from "lucide-react";
import { GradientAnglePicker } from "./gradient-angle-picker";
import Draggable from 'react-draggable';

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
}

export const VisualStylingPanel = React.memo(function VisualStylingPanel({ styling, onStylingChange, onReset, onClose, selectedItemIds, tag, tagPosition, onTagChange, onTagPositionChange, isLucideIcon = false, showRemoveBackground = false, noIconBackground = false, showFullStyling = true, isShape = false }: VisualStylingPanelProps) {
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
      <div ref={nodeRef} className={`fixed top-20 left-20 z-50 bg-white border rounded-lg shadow-lg cursor-move ${showFullStyling ? 'w-[24rem]' : 'w-[16rem]'}`}>
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">{isLucideIcon ? 'Icon Styling' : 'Visual Styling'}</h3>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <div className="p-3 space-y-2">
          {/* Icon Color - only for Lucide icons; when icon mode, hide other sections */}
          {isLucideIcon && (
            <div className="bg-blue-50/50 rounded-md p-2 border border-blue-200/50">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <Label className="text-xs font-semibold text-slate-700">Icon Color</Label>
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

          {/* Remove background - for resource items and Lucide icons */}
          {showRemoveBackground && (
            <div className="bg-slate-50 rounded-md p-2 border border-slate-200/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Remove background</Label>
                <Switch
                  checked={noIconBackground}
                  onCheckedChange={(checked) => onStylingChange({ noIconBackground: checked })}
                />
              </div>
            </div>
          )}

          {/* Size - for nodes and icons: normal, half, quarter */}
          {!isShape && (
          <div className="bg-slate-50 rounded-md p-2 border border-slate-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
              <Label className="text-xs font-semibold text-slate-700">Size</Label>
            </div>
            <Select
              value={styling.nodeSize || 'normal'}
              onValueChange={(value) => onStylingChange({ nodeSize: value as 'normal' | 'half' | 'quarter' })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Normal" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                <SelectItem value="half" className="text-xs">Half</SelectItem>
                <SelectItem value="quarter" className="text-xs">Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          )}

          {/* Preset, Border, Background, Effects, Tags - shapes and text nodes only */}
          {showFullStyling && (
          <>
          {/* Style Preset */}
          <div className="bg-slate-50 rounded-md p-2">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <Label className="text-xs font-semibold text-slate-700">Preset</Label>
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
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {Object.entries(VISUAL_STYLES).map(([key, style]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-medium">{style.name}</span>
                      <span className="text-muted-foreground text-xs">{style.description}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="text-xs">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Border Section */}
          <div className="bg-amber-50/50 rounded-md p-2 border border-amber-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
              <Label className="text-xs font-semibold text-slate-700">Border</Label>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Style</Label>
                <Select
                  value={styling.borderStyle || 'solid'}
                  onValueChange={(value) => handlePropertyChange('borderStyle', value as any)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="none" className="text-xs">None</SelectItem>
                    <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                    <SelectItem value="dotted" className="text-xs">Dotted</SelectItem>
                    <SelectItem value="gradient" className="text-xs">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {styling.borderStyle && styling.borderStyle !== 'none' && (
                <div className="space-y-1 flex flex-col">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-600 shrink-0">Width</Label>
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={styling.borderWidth ?? 2}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (!isNaN(n)) handlePropertyChange('borderWidth', Math.min(20, Math.max(0, n)));
                      }}
                      className="h-7 w-14 text-xs"
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
                      <Label className="text-xs text-slate-500">Start</Label>
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
                      <Label className="text-xs text-slate-500">End</Label>
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

          {/* Background Section */}
          <div className="bg-emerald-50/50 rounded-md p-2 border border-emerald-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <Label className="text-xs font-semibold text-slate-700">Background</Label>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Style</Label>
                <Select
                  value={styling.backgroundStyle || 'solid'}
                  onValueChange={(value) => handlePropertyChange('backgroundStyle', value as any)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="none" className="text-xs">None</SelectItem>
                    <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                    <SelectItem value="gradient" className="text-xs">Gradient</SelectItem>
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
                      <Label className="text-xs text-slate-500">Start</Label>
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
                      <Label className="text-xs text-slate-500">End</Label>
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

          {/* Effects & Tags Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Effects */}
            <div className="bg-purple-50/50 rounded-md p-2 border border-purple-200/50">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <Label className="text-xs font-semibold text-slate-700">Effects</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Shadow</Label>
                  <Switch
                    checked={styling.shadow || false}
                    onCheckedChange={(checked) => handlePropertyChange('shadow', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600">Rounded Edges</Label>
                  <Switch
                    checked={styling.roundedEdges || false}
                    onCheckedChange={(checked) => handlePropertyChange('roundedEdges', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-indigo-50/50 rounded-md p-2 border border-indigo-200/50">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                <Label className="text-xs font-semibold text-slate-700">Tags</Label>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-slate-600 mb-0.5 block">Text</Label>
                  <Input
                    value={tag || ''}
                    onChange={(e) => onTagChange?.(e.target.value)}
                    placeholder="Tag text"
                    className="h-6 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-0.5 block">Position</Label>
                  <Select
                    value={tagPosition || 'top-center'}
                    onValueChange={(value) => onTagPositionChange?.(value as any)}
                  >
                    <SelectTrigger className="h-6 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      <SelectItem value="top-left" className="text-xs">Top L</SelectItem>
                      <SelectItem value="top-center" className="text-xs">Top C</SelectItem>
                      <SelectItem value="top-right" className="text-xs">Top R</SelectItem>
                      <SelectItem value="bottom-left" className="text-xs">Bot L</SelectItem>
                      <SelectItem value="bottom-center" className="text-xs">Bot C</SelectItem>
                      <SelectItem value="bottom-right" className="text-xs">Bot R</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
       </div>
     </Draggable>
   );
});