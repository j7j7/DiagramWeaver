"use client";

import React, { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { LineStyling } from "@/lib/line-styling";
import { COMMON_FONT_FAMILIES } from "@/lib/text-styling";
import { Minus, ArrowRight, Circle, Square, RotateCcw, X, ArrowUp, ArrowDown } from "lucide-react";
import Draggable from 'react-draggable';

interface LineStylingPanelProps {
  styling: Partial<LineStyling>;
  onStylingChange: (styling: Partial<LineStyling>) => void;
  onReset?: () => void;
  onClose?: () => void;
  selectedItem?: any;
  selectedItemIds?: Set<string>;
}

export const LineStylingPanel = React.memo(function LineStylingPanel({ 
  styling, 
  onStylingChange, 
  onReset, 
  onClose, 
  selectedItem, 
  selectedItemIds 
}: LineStylingPanelProps) {
  const [position, setPosition] = useState({ x: 300, y: 100 });
  const [isMounted, setIsMounted] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    
    // Load position from localStorage
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('dw:line-styling:position');
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          setPosition(parsed);
        } catch (e) {
          console.error('Failed to load line styling panel position', e);
        }
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem('dw:line-styling:position', JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save line styling panel position', e);
      }
    }
  }, [position, isMounted]);

  const handlePropertyChange = (property: keyof LineStyling, value: any) => {
    const updatedStyling = { [property]: value };
    onStylingChange(updatedStyling);
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
      <div ref={nodeRef} className="fixed top-20 left-20 z-50 bg-white border rounded-lg shadow-lg w-[24rem] cursor-move">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Line Styling</h3>
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
        <div className="p-3 space-y-2 max-h-[80vh] overflow-y-auto">
          {/* Line Properties Section */}
          <div className="bg-blue-50/50 rounded-md p-2 border border-blue-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <Label className="text-xs font-semibold text-slate-700">Line</Label>
            </div>
            
            {/* Line Thickness */}
            <div className="space-y-1 mb-2">
              <Label htmlFor="line-thickness" className="text-xs text-slate-600">
                Thickness: {styling.lineThickness || 2.5}px
              </Label>
              <Slider
                id="line-thickness"
                min={0.5}
                max={10}
                step={0.5}
                value={[styling.lineThickness || 2.5]}
                onValueChange={([value]) => handlePropertyChange('lineThickness', value)}
                className="w-full"
              />
            </div>

            {/* Start Cap */}
            <div className="space-y-1 mb-2">
              <Label htmlFor="start-cap" className="text-xs text-slate-600">Start Cap</Label>
              <Select
                value={styling.startCap || 'none'}
                onValueChange={(value) => handlePropertyChange('startCap', value as any)}
              >
                <SelectTrigger id="start-cap" className="h-7 text-xs">
                  <SelectValue placeholder="Select start cap" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="none" className="text-xs flex items-center gap-2">
                    <Minus className="w-3 h-3" />
                    None
                  </SelectItem>
                  <SelectItem value="arrow" className="text-xs flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />
                    Arrow
                  </SelectItem>
                  <SelectItem value="dot" className="text-xs flex items-center gap-2">
                    <Circle className="w-3 h-3" />
                    Dot
                  </SelectItem>
                  <SelectItem value="square" className="text-xs flex items-center gap-2">
                    <Square className="w-3 h-3" />
                    Square
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* End Cap */}
            <div className="space-y-1 mb-2">
              <Label htmlFor="end-cap" className="text-xs text-slate-600">End Cap</Label>
              <Select
                value={styling.endCap || 'none'}
                onValueChange={(value) => handlePropertyChange('endCap', value as any)}
              >
                <SelectTrigger id="end-cap" className="h-7 text-xs">
                  <SelectValue placeholder="Select end cap" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="none" className="text-xs flex items-center gap-2">
                    <Minus className="w-3 h-3" />
                    None
                  </SelectItem>
                  <SelectItem value="arrow" className="text-xs flex items-center gap-2">
                    <ArrowRight className="w-3 h-3" />
                    Arrow
                  </SelectItem>
                  <SelectItem value="dot" className="text-xs flex items-center gap-2">
                    <Circle className="w-3 h-3" />
                    Dot
                  </SelectItem>
                  <SelectItem value="square" className="text-xs flex items-center gap-2">
                    <Square className="w-3 h-3" />
                    Square
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line Color */}
            <div className="space-y-1">
              <Label htmlFor="line-color" className="text-xs text-slate-600">Color</Label>
              <div className="flex gap-1">
                <Input
                  id="line-color"
                  type="color"
                  value={styling.lineColor || '#000000'}
                  onChange={(e) => handlePropertyChange('lineColor', e.target.value)}
                  className="h-6 w-8 p-0.5"
                />
                <Input
                  type="text"
                  value={styling.lineColor || ''}
                  onChange={(e) => handlePropertyChange('lineColor', e.target.value)}
                  placeholder="#000000"
                  className="h-6 text-xs flex-1"
                />
              </div>
            </div>
          </div>

          {/* Text Properties Section */}
          <div className="bg-emerald-50/50 rounded-md p-2 border border-emerald-200/50">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <Label className="text-xs font-semibold text-slate-700">Text</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-1">
                <Label htmlFor="font-family" className="text-xs text-slate-600">Family</Label>
                <Select
                  value={styling.fontFamily || ''}
                  onValueChange={(value) => handlePropertyChange('fontFamily', value)}
                >
                  <SelectTrigger id="font-family" className="h-7 text-xs">
                    <SelectValue placeholder="Font" />
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
              <div className="space-y-1">
                <Label htmlFor="font-size" className="text-xs text-slate-600">Size: {styling.fontSize || 12}px</Label>
                <Slider
                  id="font-size"
                  min={8}
                  max={72}
                  step={1}
                  value={[styling.fontSize || 12]}
                  onValueChange={([value]) => handlePropertyChange('fontSize', value)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-1">
                <Label htmlFor="font-weight" className="text-xs text-slate-600">Weight</Label>
                <Select
                  value={styling.fontWeight || 'normal'}
                  onValueChange={(value) => handlePropertyChange('fontWeight', value as any)}
                >
                  <SelectTrigger id="font-weight" className="h-7 text-xs">
                    <SelectValue placeholder="Weight" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                    <SelectItem value="bold" className="text-xs">Bold</SelectItem>
                    <SelectItem value="500" className="text-xs">Medium</SelectItem>
                    <SelectItem value="600" className="text-xs">Semi Bold</SelectItem>
                    <SelectItem value="700" className="text-xs">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="font-style" className="text-xs text-slate-600">Style</Label>
                <Select
                  value={styling.fontStyle || 'normal'}
                  onValueChange={(value) => handlePropertyChange('fontStyle', value as any)}
                >
                  <SelectTrigger id="font-style" className="h-7 text-xs">
                    <SelectValue placeholder="Style" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                    <SelectItem value="italic" className="text-xs">Italic</SelectItem>
                    <SelectItem value="oblique" className="text-xs">Oblique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 mb-2">
              <Label htmlFor="text-color" className="text-xs text-slate-600">Color</Label>
              <div className="flex gap-1">
                <Input
                  id="text-color"
                  type="color"
                  value={styling.textColor || '#000000'}
                  onChange={(e) => handlePropertyChange('textColor', e.target.value)}
                  className="h-6 w-8 p-0.5"
                />
                <Input
                  type="text"
                  value={styling.textColor || ''}
                  onChange={(e) => handlePropertyChange('textColor', e.target.value)}
                  placeholder="#000000"
                  className="h-6 text-xs flex-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-1">
                <Label htmlFor="letter-spacing" className="text-xs text-slate-600">Spacing: {styling.letterSpacing || 0}px</Label>
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
              <div className="space-y-1">
                <Label htmlFor="text-opacity" className="text-xs text-slate-600">Opacity: {Math.round((styling.textOpacity || 1) * 100)}%</Label>
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Position</Label>
              <div className="flex gap-1">
                <Button
                  variant={styling.lineTextVerticalPosition === 'above' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePropertyChange('lineTextVerticalPosition', 'above')}
                  className="h-7 px-2 flex-1"
                  title="Above Line"
                >
                  <ArrowUp className="w-3 h-3 mr-1" />
                  Above
                </Button>
                <Button
                  variant={styling.lineTextVerticalPosition === 'middle' || !styling.lineTextVerticalPosition ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePropertyChange('lineTextVerticalPosition', 'middle')}
                  className="h-7 px-2 flex-1"
                  title="On Line"
                >
                  <Circle className="w-3 h-3 mr-1" />
                  Middle
                </Button>
                <Button
                  variant={styling.lineTextVerticalPosition === 'below' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePropertyChange('lineTextVerticalPosition', 'below')}
                  className="h-7 px-2 flex-1"
                  title="Below Line"
                >
                  <ArrowDown className="w-3 h-3 mr-1" />
                  Below
                </Button>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          {onReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full mt-2"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          )}
        </div>
      </div>
    </Draggable>
  );
});
