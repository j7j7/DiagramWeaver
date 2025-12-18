"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { VisualStyling, VISUAL_STYLES, getPredefinedVisualStyle, findClosestPredefinedStyle } from "@/lib/visual-styling";
import { Palette, RotateCcw, X } from "lucide-react";
import Draggable from 'react-draggable';

interface VisualStylingPanelProps {
  styling: Partial<VisualStyling>;
  onStylingChange: (styling: Partial<VisualStyling>) => void;
  onReset?: () => void;
  onClose?: () => void;
  selectedItemIds?: Set<string>; // Multi-selected items
}

export const VisualStylingPanel = React.memo(function VisualStylingPanel({ styling, onStylingChange, onReset, onClose, selectedItemIds }: VisualStylingPanelProps) {
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
      handle=".visual-styling-handle" 
      nodeRef={nodeRef}
      defaultPosition={position}
      onStop={(e, data) => {
        setPosition({ x: data.x, y: data.y });
      }}
    >
      <div ref={nodeRef} className="fixed top-20 left-20 z-50 bg-white border rounded-lg shadow-lg w-80">
        <div className="visual-styling-handle flex items-center justify-between p-4 border-b cursor-move">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <h3 className="font-semibold">Visual Styling</h3>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="space-y-4 p-4">
          {/* Predefined Styles */}
          <div className="space-y-2">
            <Label htmlFor="predefined-style" className="text-xs font-medium">Style Preset</Label>
            <Select
              value={currentPredefinedStyle || 'custom'}
              onValueChange={(value) => {
                if (value === 'custom') {
                  // Keep current custom styling
                  return;
                }
                handlePredefinedStyleChange(value as keyof typeof VISUAL_STYLES);
              }}
            >
              <SelectTrigger id="predefined-style" className="h-8 text-xs">
                <SelectValue placeholder="Select style preset" />
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
                <SelectItem value="custom" className="text-xs">
                  <div className="flex flex-col">
                    <span className="font-medium">Custom</span>
                    <span className="text-muted-foreground text-xs">Custom styling</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Border Style */}
          <div className="space-y-2">
            <Label htmlFor="border-style" className="text-xs font-medium">Border Style</Label>
            <Select
              value={styling.borderStyle || 'solid'}
              onValueChange={(value) => handlePropertyChange('borderStyle', value as any)}
            >
              <SelectTrigger id="border-style" className="h-8 text-xs">
                <SelectValue placeholder="Select border style" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                <SelectItem value="none" className="text-xs">None</SelectItem>
                <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                <SelectItem value="dotted" className="text-xs">Dotted</SelectItem>
                <SelectItem value="gradient" className="text-xs">Gradient</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Border Color */}
          {styling.borderStyle && styling.borderStyle !== 'none' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {styling.borderStyle === 'gradient' ? 'Border Colors' : 'Border Color'}
              </Label>
              {styling.borderStyle === 'gradient' ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(styling.borderColors?.[0] || '#6b7280')}
                      onChange={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [(e.target as HTMLInputElement).value, currentColors[1]]);
                      }}
                      onMouseUp={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [(e.target as HTMLInputElement).value, currentColors[1]], true);
                      }}
                      onBlur={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [(e.target as HTMLInputElement).value, currentColors[1]], true);
                      }}
                      className="h-8 w-16 p-1"
                    />
                    <Input
                      type="text"
                      value={styling.borderColors?.[0] || ''}
                      onChange={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [(e.target as HTMLInputElement).value, currentColors[1]]);
                      }}
                      placeholder="#6b7280"
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(styling.borderColors?.[1] || '#3b82f6')}
                      onChange={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [currentColors[0], (e.target as HTMLInputElement).value]);
                      }}
                      onMouseUp={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [currentColors[0], (e.target as HTMLInputElement).value], true);
                      }}
                      onBlur={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [currentColors[0], (e.target as HTMLInputElement).value], true);
                      }}
                      className="h-8 w-16 p-1"
                    />
                    <Input
                      type="text"
                      value={styling.borderColors?.[1] || ''}
                      onChange={(e) => {
                        const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                        handlePropertyChange('borderColors', [currentColors[0], (e.target as HTMLInputElement).value]);
                      }}
                      placeholder="#3b82f6"
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={styling.borderColor || '#d1d5db'}
                    onChange={(e) => handlePropertyChange('borderColor', (e.target as HTMLInputElement).value)}
                    onMouseUp={(e) => handlePropertyChange('borderColor', (e.target as HTMLInputElement).value, true)}
                    onBlur={(e) => handlePropertyChange('borderColor', (e.target as HTMLInputElement).value, true)}
                    className="h-8 w-16 p-1"
                  />
                  <Input
                    type="text"
                    value={styling.borderColor || ''}
                    onChange={(e) => handlePropertyChange('borderColor', e.target.value)}
                    placeholder="#d1d5db"
                    className="h-8 text-xs flex-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* Border Width */}
          {styling.borderStyle && styling.borderStyle !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="border-width" className="text-xs font-medium">
                Border Width: {styling.borderWidth || 2}px
              </Label>
              <Slider
                id="border-width"
                min={0}
                max={20}
                step={1}
                value={[styling.borderWidth || 2]}
                onValueChange={([value]) => handlePropertyChange('borderWidth', value)}
                className="w-full"
              />
            </div>
          )}

          <Separator />

          {/* Background Style */}
          <div className="space-y-2">
            <Label htmlFor="background-style" className="text-xs font-medium">Background Style</Label>
            <Select
              value={styling.backgroundStyle || 'solid'}
              onValueChange={(value) => handlePropertyChange('backgroundStyle', value as any)}
            >
              <SelectTrigger id="background-style" className="h-8 text-xs">
                <SelectValue placeholder="Select background style" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                <SelectItem value="none" className="text-xs">None</SelectItem>
                <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                <SelectItem value="gradient" className="text-xs">Gradient</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Background Color */}
          {styling.backgroundStyle && styling.backgroundStyle !== 'none' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {styling.backgroundStyle === 'gradient' ? 'Background Colors' : 'Background Color'}
              </Label>
              {styling.backgroundStyle === 'gradient' ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(styling.backgroundColors?.[0] || '#f3f4f6')}
                      onChange={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [(e.target as HTMLInputElement).value, currentColors[1]]);
                      }}
                      onMouseUp={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [(e.target as HTMLInputElement).value, currentColors[1]], true);
                      }}
                      onBlur={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [(e.target as HTMLInputElement).value, currentColors[1]], true);
                      }}
                      className="h-8 w-16 p-1"
                    />
                    <Input
                      type="text"
                      value={styling.backgroundColors?.[0] || ''}
                      onChange={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [(e.target as HTMLInputElement).value, currentColors[1]]);
                      }}
                      placeholder="#f3f4f6"
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={(styling.backgroundColors?.[1] || '#e5e7eb')}
                      onChange={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [currentColors[0], (e.target as HTMLInputElement).value]);
                      }}
                      onMouseUp={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [currentColors[0], (e.target as HTMLInputElement).value], true);
                      }}
                      onBlur={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [currentColors[0], (e.target as HTMLInputElement).value], true);
                      }}
                      className="h-8 w-16 p-1"
                    />
                    <Input
                      type="text"
                      value={styling.backgroundColors?.[1] || ''}
                      onChange={(e) => {
                        const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                        handlePropertyChange('backgroundColors', [currentColors[0], (e.target as HTMLInputElement).value]);
                      }}
                      placeholder="#e5e7eb"
                      className="h-8 text-xs flex-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={styling.backgroundColor || '#f3f4f6'}
                    onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                    onMouseUp={(e) => handlePropertyChange('backgroundColor', (e.target as HTMLInputElement).value, true)}
                    onBlur={(e) => handlePropertyChange('backgroundColor', (e.target as HTMLInputElement).value, true)}
                    className="h-8 w-16 p-1"
                  />
                  <Input
                    type="text"
                    value={styling.backgroundColor || ''}
                    onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                    placeholder="#f3f4f6"
                    className="h-8 text-xs flex-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* Gradient Angle */}
          {(styling.borderStyle === 'gradient' || styling.backgroundStyle === 'gradient') && (
            <div className="space-y-2">
              <Label htmlFor="gradient-angle" className="text-xs font-medium">Gradient Angle</Label>
              <Select
                value={String(styling.gradientAngle || 135)}
                onValueChange={(value) => handlePropertyChange('gradientAngle', parseInt(value))}
              >
                <SelectTrigger id="gradient-angle" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="-45" className="text-xs">Alt Diagonal ↗</SelectItem>
                  <SelectItem value="0" className="text-xs">Right →</SelectItem>
                  <SelectItem value="45" className="text-xs">Diagonal ↘</SelectItem>
                  <SelectItem value="90" className="text-xs">Down ↓</SelectItem>
                  <SelectItem value="135" className="text-xs">Diagonal ↘</SelectItem>
                  <SelectItem value="180" className="text-xs">Left ←</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Shadow Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="shadow" className="text-xs font-medium">Shadow</Label>
            <Switch
              id="shadow"
              checked={styling.shadow || false}
              onCheckedChange={(checked) => handlePropertyChange('shadow', checked)}
            />
          </div>
        </div>
      </div>
    </Draggable>
  );
});