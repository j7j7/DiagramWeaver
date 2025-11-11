"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Palette, Check } from 'lucide-react';
import { DiagramTheme } from '@/lib/theme-types';
import { themeManager } from '@/lib/theme-manager';

interface ThemeSelectorProps {
  onThemeApply: (theme: DiagramTheme) => void;
  disabled?: boolean;
  selectedCount?: number;
}

export function ThemeSelector({ onThemeApply, disabled = false, selectedCount = 0 }: ThemeSelectorProps) {
  const [themes, setThemes] = useState<DiagramTheme[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setThemes(themeManager.getThemes());
    
    const unsubscribe = themeManager.subscribe((updatedThemes) => {
      setThemes(updatedThemes);
    });
    
    return unsubscribe;
  }, []);

  const handleThemeSelect = (theme: DiagramTheme) => {
    onThemeApply(theme);
    setIsOpen(false);
  };

  const renderThemePreview = (theme: DiagramTheme, size: 'small' | 'medium' = 'small') => {
    const { properties } = theme;
    const sizeClass = size === 'small' ? 'w-8 h-8' : 'w-12 h-12';
    
    return (
      <div 
        className={`${sizeClass} rounded border-2 relative overflow-hidden flex-shrink-0`}
        style={{
          borderColor: properties.borderColor || '#ccc',
          borderWidth: `${Math.max(1, (properties.borderWidth || 2) / 2)}px`,
          borderStyle: properties.borderStyle === 'none' ? 'solid' : properties.borderStyle,
          backgroundColor: properties.backgroundColor || '#f9fafb',
          boxShadow: properties.shadow ? `0 1px ${Math.max(1, (properties.shadowBlur || 4) / 2)}px rgba(0,0,0,${properties.shadowOpacity || 0.2})` : 'none'
        }}
      >
        {properties.backgroundStyle === 'gradient' && (
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(${properties.gradientAngle || 135}deg, ${properties.backgroundColors?.[0] || '#ccc'}, ${properties.backgroundColors?.[1] || '#999'})`
            }}
          />
        )}
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2"
          disabled={disabled}
          title={`Apply Theme${selectedCount > 1 ? ` to ${selectedCount} items` : ''}`}
        >
          <Palette className="h-4 w-4" />
          {selectedCount > 1 && (
            <span className="ml-1 text-xs">({selectedCount})</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Apply Theme{selectedCount > 1 ? ` to ${selectedCount} items` : ''}</div>
          
          <div className="grid grid-cols-2 gap-2">
            {themes.map((theme) => (
              <Button
                key={theme.id}
                variant="outline"
                className="h-auto p-2 justify-start"
                onClick={() => handleThemeSelect(theme)}
              >
                <div className="flex items-center gap-2 w-full">
                  {renderThemePreview(theme, 'small')}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{theme.name}</div>
                    {theme.isDefault && (
                      <div className="text-xs text-muted-foreground">Default</div>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
          
          {themes.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-4">
              No themes available. Create your first theme in the Themes menu.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}