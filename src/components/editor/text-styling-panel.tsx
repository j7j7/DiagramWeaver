"use client";

import React, { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/ui/color-picker";
import { TextStyling, COMMON_FONT_FAMILIES, DEFAULT_TEXT_STYLING } from "@/lib/text-styling";
import { Type, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUp, Circle, ArrowDown, RotateCcw, Move3D, Box, X } from "lucide-react";
import Draggable from 'react-draggable';

interface TextStylingPanelProps {
  styling: Partial<TextStyling>;
  onStylingChange: (styling: Partial<TextStyling>) => void;
  onReset?: () => void;
  onClose?: () => void;
  selectedItem?: any; // To determine if it's a zone
  selectedItemIds?: Set<string>; // Multi-selected items
  textPosition?: string; // Current text position for zones
  onTextPositionChange?: (position: string) => void; // Handler for text position changes
}

export const TextStylingPanel = React.memo(function TextStylingPanel({ styling, onStylingChange, onReset, onClose, selectedItem, selectedItemIds, textPosition, onTextPositionChange }: TextStylingPanelProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isMounted, setIsMounted] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    
    // Load position from localStorage
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('dw:text-styling:position');
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          setPosition(parsed);
        } catch (e) {
          console.error('Failed to load text styling panel position', e);
        }
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem('dw:text-styling:position', JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save text styling panel position', e);
      }
    }
  }, [position, isMounted]);

  // For zones with outside/inline positions, derive vertical position from textPosition
  const getEffectiveVerticalPosition = (): 'top' | 'middle' | 'bottom' => {
    try {
      if (selectedItem && selectedItem.itemType === 'zone' && textPosition) {
        if (textPosition === 'outside-bottom' || textPosition === 'inline-bottom') {
          return 'bottom';
        } else if (textPosition === 'outside-top' || textPosition === 'inline-top') {
          return 'top';
        }
      }
      // If textVerticalPosition is explicitly set, use it
      if (styling.textVerticalPosition) {
        return styling.textVerticalPosition as 'top' | 'middle' | 'bottom';
      }
      // Default based on item type:
      // - Regular nodes (icon nodes): default to 'bottom' for backward compatibility
      // - Textboxes and zones: default to 'middle'
      if (selectedItem && selectedItem.itemType === 'node') {
        const nodeType = selectedItem.type;
        // Textboxes should default to 'middle', regular nodes to 'bottom'
        if (nodeType === 'generic.text.textbox' || nodeType === 'generic.text.text') {
          return 'middle';
        }
        // Regular icon nodes default to 'bottom'
        return 'bottom';
      }
      // Default to 'middle' for zones and other types
      return 'middle';
    } catch (error) {
      return 'middle';
    }
  };

  const effectiveVerticalPosition = getEffectiveVerticalPosition();

  const effectiveTextJustify =
    styling.textJustify ?? DEFAULT_TEXT_STYLING.textJustify ?? "center";

  const isTextBoxHeading =
    selectedItem?.type === "generic.object.text-box-heading" ||
    (typeof selectedItem?.type === "string" && selectedItem.type.endsWith(".text-box-heading"));

  const handlePropertyChange = (property: keyof TextStyling, value: any) => {
    // Only update the specific property that changed
    const updatedStyling = { [property]: value };
    
    // If multiple items are selected, apply change immediately to avoid debouncing conflicts
    const isMultiSelect = selectedItemIds && selectedItemIds.size > 1;
    if (isMultiSelect) {
      onStylingChange(updatedStyling);
    } else {
      onStylingChange(updatedStyling);
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      onStop={(e, data) => {
        setPosition({ x: data.x, y: data.y });
      }}
    >
      <div ref={nodeRef} className="fixed top-20 left-20 z-50 bg-popover border border-border rounded-lg shadow-lg w-[640px] max-w-[calc(100vw-2rem)] cursor-move">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            <h3 className="text-base font-semibold">Text Styling</h3>
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
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 p-5">
          {/* Column 1: font, size, alignment, position */}
          <div className="space-y-4 min-w-0">
            <div className="space-y-2">
              <Label htmlFor="font-family" className="text-sm font-medium">Font Family</Label>
              <Select
                value={styling.fontFamily || ''}
                onValueChange={(value) => handlePropertyChange('fontFamily', value)}
              >
                <SelectTrigger id="font-family" className="h-9 text-sm">
                  <SelectValue placeholder="Select font family" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {COMMON_FONT_FAMILIES.map((font) => (
                    <SelectItem key={font} value={font} className="text-sm">
                      <span style={{ fontFamily: font }}>{font.split(',')[0]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="font-size" className="text-sm font-medium">
                Font Size: {styling.fontSize || 14}px
              </Label>
              <Slider
                id="font-size"
                min={8}
                max={72}
                step={1}
                value={[styling.fontSize || 14]}
                onValueChange={([value]) => handlePropertyChange('fontSize', value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Text Justification</Label>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={effectiveTextJustify === 'left' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePropertyChange('textJustify', effectiveTextJustify === 'left' ? 'center' : 'left')}
                  className="h-9 px-2"
                  title="Align Left"
                >
                  <AlignLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant={effectiveTextJustify === 'center' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePropertyChange('textJustify', 'center')}
                  className="h-9 px-2"
                  title="Align Center"
                >
                  <AlignCenter className="w-4 h-4" />
                </Button>
                <Button
                  variant={effectiveTextJustify === 'right' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePropertyChange('textJustify', effectiveTextJustify === 'right' ? 'center' : 'right')}
                  className="h-9 px-2"
                  title="Align Right"
                >
                  <AlignRight className="w-4 h-4" />
                </Button>
                <Button
                  variant={effectiveTextJustify === 'full' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePropertyChange('textJustify', effectiveTextJustify === 'full' ? 'center' : 'full')}
                  className="h-9 px-2"
                  title="Justify"
                >
                  <AlignJustify className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Vertical Position</Label>
              <div className="flex gap-1">
                <Button
                  variant={effectiveVerticalPosition === 'top' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const newVerticalPos = effectiveVerticalPosition === 'top' ? 'middle' : 'top';
                    handlePropertyChange('textVerticalPosition', newVerticalPos);
                    if (selectedItem && selectedItem.itemType === 'zone') {
                      if (textPosition?.startsWith('outside-') || textPosition === 'outside') {
                        const newTextPos = 'outside-top';
                        onTextPositionChange && onTextPositionChange(newTextPos);
                      }
                    }
                  }}
                  className="h-9 px-2"
                  title="Align Top"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant={effectiveVerticalPosition === 'middle' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    handlePropertyChange('textVerticalPosition', 'middle');
                    if (selectedItem && selectedItem.itemType === 'zone') {
                      if (textPosition?.startsWith('outside-') || textPosition === 'outside') {
                        onTextPositionChange && onTextPositionChange('outside-top');
                      }
                    }
                  }}
                  className="h-9 px-2"
                  title="Align Middle"
                >
                  <Circle className="w-4 h-4" />
                </Button>
                <Button
                  variant={effectiveVerticalPosition === 'bottom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const newVerticalPos = effectiveVerticalPosition === 'bottom' ? 'middle' : 'bottom';
                    handlePropertyChange('textVerticalPosition', newVerticalPos);
                    if (selectedItem && selectedItem.itemType === 'zone') {
                      if (textPosition?.startsWith('outside-') || textPosition === 'outside') {
                        const newTextPos: string = newVerticalPos === 'bottom' ? 'outside-bottom' : 'outside-top';
                        onTextPositionChange && onTextPositionChange(newTextPos);
                      }
                    }
                  }}
                  className="h-9 px-2"
                  title="Align Bottom"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {selectedItem && selectedItem.itemType === 'zone' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Text Position</Label>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    variant={textPosition === 'inside' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onTextPositionChange && onTextPositionChange('inside')}
                    className="h-9 px-2 text-sm"
                    title="Inside Zone"
                  >
                    <Box className="w-4 h-4 mr-1" />
                    Inside
                  </Button>
                  <Button
                    variant={textPosition?.startsWith('outside-') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const verticalPos = effectiveVerticalPosition || 'middle';
                      const newPosition = verticalPos === 'bottom' ? 'outside-bottom' : 'outside-top';
                      if (onTextPositionChange) {
                        onTextPositionChange(newPosition);
                      }
                    }}
                    className="h-9 px-2 text-sm"
                    title="Outside Zone"
                    type="button"
                  >
                    <Move3D className="w-4 h-4 mr-1" />
                    Outside
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Column 2: transform, spacing, opacity, colors */}
          <div className="space-y-4 min-w-0 border-l border-border pl-8">
            <div className="space-y-2">
              <Label htmlFor="text-transform" className="text-sm font-medium">Text Transform</Label>
              <Select
                value={styling.textTransform || 'none'}
                onValueChange={(value) => handlePropertyChange('textTransform', value as any)}
              >
                <SelectTrigger id="text-transform" className="h-9 text-sm">
                  <SelectValue placeholder="Select text transform" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="none" className="text-sm">None</SelectItem>
                  <SelectItem value="uppercase" className="text-sm">UPPERCASE</SelectItem>
                  <SelectItem value="lowercase" className="text-sm">lowercase</SelectItem>
                  <SelectItem value="capitalize" className="text-sm">Capitalize</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="letter-spacing" className="text-sm font-medium">
                Letter Spacing: {styling.letterSpacing || 0}px
              </Label>
              <Slider
                id="letter-spacing"
                min={-2}
                max={10}
                step={0.5}
                value={[styling.letterSpacing || 0]}
                onValueChange={([value]) => handlePropertyChange('letterSpacing', value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="line-height" className="text-sm font-medium">
                Line Height: {styling.lineHeight || 1.4}
              </Label>
              <Slider
                id="line-height"
                min={0.8}
                max={3}
                step={0.1}
                value={[styling.lineHeight || 1.4]}
                onValueChange={([value]) => handlePropertyChange('lineHeight', value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-opacity" className="text-sm font-medium">
                Text Opacity: {Math.round((styling.textOpacity || 1) * 100)}%
              </Label>
              <Slider
                id="text-opacity"
                min={0}
                max={1}
                step={0.05}
                value={[styling.textOpacity || 1]}
                onValueChange={([value]) => handlePropertyChange('textOpacity', value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-color" className="text-sm font-medium">
                {isTextBoxHeading ? "Body text color" : "Text Color"}
              </Label>
              <ColorPicker
                value={styling.textColor || '#000000'}
                onChange={(value) => handlePropertyChange('textColor', value)}
                placeholder="#000000"
                showAlpha={true}
                allowTransparent={true}
              />
            </div>

            {isTextBoxHeading && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Heading text color</Label>
                <ColorPicker
                  value={styling.headingTextColor ?? "#ffffff"}
                  onChange={(value) => handlePropertyChange("headingTextColor", value)}
                  placeholder="#ffffff"
                  showAlpha={true}
                  allowTransparent={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Draggable>
  );
});