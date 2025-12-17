"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextStyling, COMMON_FONT_FAMILIES } from "@/lib/text-styling";
import { Type, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUp, Circle, ArrowDown, RotateCcw, Move3D, Box } from "lucide-react";

interface TextStylingPanelProps {
  styling: Partial<TextStyling>;
  onStylingChange: (styling: Partial<TextStyling>) => void;
  onReset?: () => void;
  selectedItem?: any; // To determine if it's a zone
  selectedItemIds?: Set<string>; // Multi-selected items
  textPosition?: string; // Current text position for zones
  onTextPositionChange?: (position: string) => void; // Handler for text position changes
}

export const TextStylingPanel = React.memo(function TextStylingPanel({ styling, onStylingChange, onReset, selectedItem, selectedItemIds, textPosition, onTextPositionChange }: TextStylingPanelProps) {
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
      return (styling.textVerticalPosition as 'top' | 'middle' | 'bottom') || 'middle';
    } catch (error) {
      return 'middle';
    }
  };

  const effectiveVerticalPosition = getEffectiveVerticalPosition();

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
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Type className="w-4 h-4" />
            Text Styling
          </CardTitle>
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Font Family */}
        <div className="space-y-2">
          <Label htmlFor="font-family" className="text-xs font-medium">Font Family</Label>
          <Select
            value={styling.fontFamily || ''}
            onValueChange={(value) => handlePropertyChange('fontFamily', value)}
          >
            <SelectTrigger id="font-family" className="h-8 text-xs">
              <SelectValue placeholder="Select font family" />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              {COMMON_FONT_FAMILIES.map((font) => (
                <SelectItem key={font} value={font} className="text-xs">
                  <span style={{ fontFamily: font }}>{font.split(',')[0]}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <Label htmlFor="font-size" className="text-xs font-medium">
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

        {/* Text Justification */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Text Justification</Label>
          <div className="flex gap-1">
            <Button
              variant={styling.textJustify === 'left' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePropertyChange('textJustify', styling.textJustify === 'left' ? 'center' : 'left')}
              className="h-8 px-2"
              title="Align Left"
            >
              <AlignLeft className="w-3 h-3" />
            </Button>
            <Button
              variant={styling.textJustify === 'center' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePropertyChange('textJustify', 'center')}
              className="h-8 px-2"
              title="Align Center"
            >
              <AlignCenter className="w-3 h-3" />
            </Button>
            <Button
              variant={styling.textJustify === 'right' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePropertyChange('textJustify', styling.textJustify === 'right' ? 'center' : 'right')}
              className="h-8 px-2"
              title="Align Right"
            >
              <AlignRight className="w-3 h-3" />
            </Button>
            <Button
              variant={styling.textJustify === 'full' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePropertyChange('textJustify', styling.textJustify === 'full' ? 'center' : 'full')}
              className="h-8 px-2"
              title="Justify"
            >
              <AlignJustify className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Text Vertical Position */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Vertical Position</Label>
          <div className="flex gap-1">
            <Button
              variant={effectiveVerticalPosition === 'top' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const newVerticalPos = effectiveVerticalPosition === 'top' ? 'middle' : 'top';
                handlePropertyChange('textVerticalPosition', newVerticalPos);
                // For zones with outside position, update text position based on vertical position
                if (selectedItem && selectedItem.itemType === 'zone') {
if (textPosition?.startsWith('outside-') || textPosition === 'outside') {
                    const newTextPos = 'outside-top';
                    onTextPositionChange && onTextPositionChange(newTextPos);
                  }
                }
              }}
              className="h-8 px-2"
              title="Align Top"
            >
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button
              variant={effectiveVerticalPosition === 'middle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                handlePropertyChange('textVerticalPosition', 'middle');
                // For zones with outside position, update text position based on vertical position
                if (selectedItem && selectedItem.itemType === 'zone') {
                  if (textPosition?.startsWith('outside-') || textPosition === 'outside') {
                    onTextPositionChange && onTextPositionChange('outside-top');
                  }
                }
              }}
              className="h-8 px-2"
              title="Align Middle"
            >
              <Circle className="w-3 h-3" />
            </Button>
            <Button
              variant={effectiveVerticalPosition === 'bottom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const newVerticalPos = effectiveVerticalPosition === 'bottom' ? 'middle' : 'bottom';
                handlePropertyChange('textVerticalPosition', newVerticalPos);
                // For zones with outside position, update text position based on vertical position
                if (selectedItem && selectedItem.itemType === 'zone') {
                  if (textPosition?.startsWith('outside-') || textPosition === 'outside') {
                    const newTextPos: string = newVerticalPos === 'bottom' ? 'outside-bottom' : 'outside-top';
                    onTextPositionChange && onTextPositionChange(newTextPos);
                  }
                }
              }}
              className="h-8 px-2"
              title="Align Bottom"
            >
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Text Position - Only for zones */}
        {selectedItem && selectedItem.itemType === 'zone' && (
          <>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Text Position</Label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant={textPosition === 'inside' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onTextPositionChange && onTextPositionChange('inside')}
                  className="h-8 px-2 text-xs"
                  title="Inside Zone"
                >
                  <Box className="w-3 h-3 mr-1" />
                  Inside
                </Button>
                <Button
                  variant={textPosition?.startsWith('outside-') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    // Use effective vertical position to determine outside-top or outside-bottom
                    const verticalPos = effectiveVerticalPosition || 'middle';
                    const newPosition = verticalPos === 'bottom' ? 'outside-bottom' : 'outside-top';
                    // Update textPosition - handleTextPositionChange will also update textVerticalPosition
                    if (onTextPositionChange) {
                      onTextPositionChange(newPosition);
                    }
                  }}
                  className="h-8 px-2 text-xs"
                  title="Outside Zone"
                  type="button"
                >
                  <Move3D className="w-3 h-3 mr-1" />
                  Outside
                </Button>
              </div>
            </div>
            <Separator />
          </>
        )}

        <Separator />

        {/* Text Transform */}
        <div className="space-y-2">
          <Label htmlFor="text-transform" className="text-xs font-medium">Text Transform</Label>
          <Select
            value={styling.textTransform || 'none'}
            onValueChange={(value) => handlePropertyChange('textTransform', value as any)}
          >
            <SelectTrigger id="text-transform" className="h-8 text-xs">
              <SelectValue placeholder="Select text transform" />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              <SelectItem value="none" className="text-xs">None</SelectItem>
              <SelectItem value="uppercase" className="text-xs">UPPERCASE</SelectItem>
              <SelectItem value="lowercase" className="text-xs">lowercase</SelectItem>
              <SelectItem value="capitalize" className="text-xs">Capitalize</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Letter Spacing */}
        <div className="space-y-2">
          <Label htmlFor="letter-spacing" className="text-xs font-medium">
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

        {/* Line Height */}
        <div className="space-y-2">
          <Label htmlFor="line-height" className="text-xs font-medium">
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

        {/* Text Opacity */}
        <div className="space-y-2">
          <Label htmlFor="text-opacity" className="text-xs font-medium">
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

        {/* Text Color */}
        <div className="space-y-2">
          <Label htmlFor="text-color" className="text-xs font-medium">Text Color</Label>
          <div className="flex gap-2">
            <Input
              id="text-color"
              type="color"
              value={styling.textColor || '#000000'}
              onChange={(e) => handlePropertyChange('textColor', e.target.value)}
              className="h-8 w-16 p-1"
            />
            <Input
              type="text"
              value={styling.textColor || ''}
              onChange={(e) => handlePropertyChange('textColor', e.target.value)}
              placeholder="#000000"
              className="h-8 text-xs flex-1"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});