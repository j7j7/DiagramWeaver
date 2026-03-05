"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Slider } from './slider';
import { useRecentColors } from '@/hooks/use-recent-colors';
import { X } from 'lucide-react';

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
  const [inputId] = useState(() => `color-picker-input-${Math.random().toString(36).slice(2)}`);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const alphaRef = useRef(alpha);
  alphaRef.current = alpha;
  const { recentColors, setColorAt, removeColor } = useRecentColors();

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

  useEffect(() => {
    const el = colorInputRef.current;
    if (!el || isTransparent) return;
    const handleChange = () => {
      const hex = el.value;
      setColor(hex);
      const a = alphaRef.current;
      if (a === 1) {
        onChange(hex);
      } else {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        onChange(`rgba(${r}, ${g}, ${b}, ${a})`);
      }
    };
    el.addEventListener('change', handleChange);
    return () => el.removeEventListener('change', handleChange);
  }, [isTransparent, onChange]);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
  };

  const handleColorCommit = (newColor: string) => {
    setColor(newColor);
    if (!isTransparent) {
      updateColor(newColor, alpha);
    }
  };

  const handleAlphaChange = (newAlpha: number[]) => {
    setAlpha(newAlpha[0]);
  };

  const handleAlphaCommit = (newAlpha: number[]) => {
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
      const rgbaValue = `rgba(${r}, ${g}, ${b}, ${alphaValue})`;
      onChange(rgbaValue);
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

  const handleRecentColorClick = (recentColor: string) => {
    if (recentColor === 'transparent') {
      handleTransparentToggle();
    } else if (recentColor.startsWith('#')) {
      setColor(recentColor);
      setAlpha(1);
      setIsTransparent(false);
      onChange(recentColor);
    } else if (recentColor.startsWith('rgba')) {
      const match = recentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
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
        setIsTransparent(false);
        onChange(recentColor);
      }
    }
  };

  const handleEmptySlotClick = (index: number) => {
    if (!isTransparent) {
      const colorToAdd = alpha === 1 ? color : `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${alpha})`;
      setColorAt(index, colorToAdd);
    }
  };

  const handleRemoveRecentColor = (e: React.MouseEvent, colorToRemove: string) => {
    e.stopPropagation();
    removeColor(colorToRemove);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          className="w-10 h-10 rounded border-2 border-border cursor-pointer"
          style={{
            ...(isTransparent ? { backgroundImage: getDisplayColor() } : { background: color })
          }}
          onClick={() => {
            colorInputRef.current?.click();
          }}
          title={`Current color: ${color}`}
        >
          <input
            ref={colorInputRef}
            id={inputId}
            type="color"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            onMouseUp={(e) => handleColorCommit((e.target as HTMLInputElement).value)}
            onBlur={(e) => handleColorCommit((e.target as HTMLInputElement).value)}
            className="opacity-0 absolute inset-0 cursor-pointer"
            disabled={isTransparent}
          />
        </button>
        {showAlpha && !isTransparent && (
          <div className="flex items-center gap-2 flex-1">
            <Slider
              value={[alpha]}
              onValueChange={handleAlphaChange}
              onValueCommit={handleAlphaCommit}
              min={0}
              max={1}
              step={0.01}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12 text-right">{Math.round(alpha * 100)}%</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Recent Colors</label>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 8 }).map((_, index) => {
            const recentColor = recentColors[index];
            return (
              <div key={index} className="relative group">
                {recentColor ? (
                  <>
                    <button
                      className="w-6 h-6 rounded border border-border cursor-pointer hover:scale-110 transition-transform"
                      style={{ 
                        background: recentColor === 'transparent' 
                          ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                          : recentColor 
                      }}
                      onClick={() => handleRecentColorClick(recentColor)}
                      title={recentColor}
                    />
                    <button
                      onClick={(e) => handleRemoveRecentColor(e, recentColor)}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] hover:scale-110"
                      title="Remove color"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </>
                ) : (
                  <button
                    className="w-6 h-6 rounded border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-muted-foreground/60 transition-colors"
                    onClick={() => handleEmptySlotClick(index)}
                    title={`Add ${color} to this slot`}
                  >
                    <span className="text-xs text-muted-foreground/30">+</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
