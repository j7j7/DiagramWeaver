"use client";
import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Slider } from './slider';
import { Button } from './button';

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  placeholder?: string;
  showAlpha?: boolean;
  allowTransparent?: boolean;
}

export function ColorPicker({ 
  value, 
  onChange, 
  placeholder = '#000000', 
  showAlpha = true,
  allowTransparent = true 
}: ColorPickerProps) {
  const [color, setColor] = useState('#000000');
  const [alpha, setAlpha] = useState(1);
  const [isTransparent, setIsTransparent] = useState(false);

  useEffect(() => {
    if (value === 'transparent') {
      setIsTransparent(true);
      return;
    }
    
    setIsTransparent(false);
    
    if (value?.startsWith('#')) {
      setColor(value);
      setAlpha(1);
    } else if (value?.startsWith('rgba')) {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const a = match[4] ? parseFloat(match[4]) : 1;
        
        const hex = '#' + [r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('');
        
        setColor(hex);
        setAlpha(a);
      }
    }
  }, [value]);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (!isTransparent) {
      updateColor(newColor, alpha);
    }
  };

  const handleAlphaChange = (newAlpha: number[]) => {
    const newAlphaValue = newAlpha[0];
    setAlpha(newAlphaValue);
    if (!isTransparent) {
      updateColor(color, newAlphaValue);
    }
  };

  const handleTransparentToggle = () => {
    if (isTransparent) {
      setIsTransparent(false);
      updateColor(color, alpha);
    } else {
      setIsTransparent(true);
      onChange('transparent');
    }
  };

  const updateColor = (hexColor: string, alphaValue: number) => {
    if (alphaValue === 1) {
      onChange(hexColor);
    } else {
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      onChange(`rgba(${r}, ${g}, ${b}, ${alphaValue})`);
    }
  };

  const getDisplayColor = () => {
    if (isTransparent) {
      return 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)';
    }
    
    if (alpha === 1) {
      return color;
    }
    
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div 
          className="w-10 h-10 rounded border-2 border-border cursor-pointer"
          style={{ 
            background: getDisplayColor(),
            backgroundImage: isTransparent ? getDisplayColor() : 'none'
          }}
          onClick={() => document.getElementById(`color-input-${Math.random()}`)?.click()}
        />
        <Input
          id={`color-input-${Math.random()}`}
          type="color"
          value={color}
          onChange={(e) => handleColorChange(e.target.value)}
          className="h-10 flex-1"
          disabled={isTransparent}
        />
        {allowTransparent && (
          <Button
            variant={isTransparent ? 'default' : 'outline'}
            size="sm"
            onClick={handleTransparentToggle}
            className="px-3"
          >
            None
          </Button>
        )}
      </div>
      
      {showAlpha && !isTransparent && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Opacity</label>
            <span className="text-sm text-muted-foreground">{Math.round(alpha * 100)}%</span>
          </div>
          <Slider
            value={[alpha]}
            onValueChange={handleAlphaChange}
            min={0}
            max={1}
            step={0.01}
            className="w-full"
          />
        </div>
      )}
      
      <Input
        type="text"
        value={isTransparent ? 'transparent' : (alpha === 1 ? color : `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${alpha})`)}
        onChange={(e) => {
          const newValue = e.target.value;
          if (newValue === 'transparent') {
            handleTransparentToggle();
          } else if (newValue.startsWith('#') || newValue.startsWith('rgb')) {
            onChange(newValue);
          }
        }}
        className="h-8 text-xs font-mono"
        placeholder={placeholder}
      />
    </div>
  );
}