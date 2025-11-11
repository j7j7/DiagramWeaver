"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextStyling, COMMON_FONT_FAMILIES, FONT_WEIGHT_OPTIONS } from "@/lib/text-styling";
import { Type, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, RotateCcw } from "lucide-react";

interface TextStylingPanelProps {
  styling: Partial<TextStyling>;
  onStylingChange: (styling: Partial<TextStyling>) => void;
  onReset?: () => void;
}

export const TextStylingPanel = React.memo(function TextStylingPanel({ styling, onStylingChange, onReset }: TextStylingPanelProps) {
  const handlePropertyChange = (property: keyof TextStyling, value: any) => {
    onStylingChange({
      ...styling,
      [property]: value
    });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  return (
    <Card className="w-80">
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
            <SelectContent>
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

        <Separator />

        {/* Font Style */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Font Style</Label>
          <div className="flex gap-2">
            <Button
              variant={styling.fontWeight === 'bold' || styling.fontWeight === '700' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePropertyChange('fontWeight', (styling.fontWeight === 'bold' || styling.fontWeight === '700') ? 'normal' : 'bold')}
              className="h-8 px-2"
            >
              <Bold className="w-3 h-3" />
            </Button>
            <Button
              variant={styling.fontStyle === 'italic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePropertyChange('fontStyle', styling.fontStyle === 'italic' ? 'normal' : 'italic')}
              className="h-8 px-2"
            >
              <Italic className="w-3 h-3" />
            </Button>
            <Button
              variant={styling.textDecoration === 'underline' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePropertyChange('textDecoration', styling.textDecoration === 'underline' ? 'none' : 'underline')}
              className="h-8 px-2"
            >
              <Underline className="w-3 h-3" />
            </Button>
          </div>
        </div>

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
            <SelectContent>
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