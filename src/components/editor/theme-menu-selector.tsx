"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Palette, 
  Star,
  ChevronDown
} from 'lucide-react';
import { DiagramTheme } from '@/lib/theme-types';
import { themeManager } from '@/lib/theme-manager';
import { getVisualStylingCSS, themePropertiesToVisualStyling } from '@/lib/visual-styling';

interface ThemeMenuSelectorProps {
  onThemeSelect?: (theme: DiagramTheme) => void;
  onOpenEditor?: () => void;
  isReadOnly?: boolean;
}

export function ThemeMenuSelector({ onThemeSelect, onOpenEditor, isReadOnly = false }: ThemeMenuSelectorProps) {
  const [themes, setThemes] = useState<DiagramTheme[]>([]);

  useEffect(() => {
    setThemes(themeManager.getThemesSorted());
    
    const unsubscribe = themeManager.subscribe(() => {
      setThemes(themeManager.getThemesSorted());
    });
    
    return unsubscribe;
  }, []);

  const handleThemeSelect = (theme: DiagramTheme, e?: React.MouseEvent) => {
    if (isReadOnly) return;
    e?.stopPropagation();
    if (onThemeSelect) {
      onThemeSelect(theme);
    }
  };

  const handleToggleFavorite = (themeId: string, e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.stopPropagation();
    themeManager.toggleFavorite(themeId);
  };

  const renderThemePreview = (theme: DiagramTheme) => {
    const swatchStyle = getVisualStylingCSS(themePropertiesToVisualStyling(theme.properties));
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded flex-shrink-0"
          style={swatchStyle}
        />
        <span className="text-sm truncate flex-1">{theme.name}</span>
      </div>
    );
  };

  const favoriteThemes = themes.filter(t => t.isFavorite);
  const otherThemes = themes.filter(t => !t.isFavorite);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Palette className="mr-2 h-4 w-4" />
          Themes
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 max-h-96 overflow-y-auto"
        align="start"
        sideOffset={8}
      >
        {favoriteThemes.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              Favorites
            </div>
              {favoriteThemes.map((theme) => (
              <DropdownMenuItem
                key={theme.id}
                onClick={(e) => handleThemeSelect(theme, e)}
                disabled={isReadOnly}
                className="p-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={(e) => handleToggleFavorite(theme.id, e)}
                  >
                    <Star 
                      className="h-3 w-3 fill-yellow-400 text-yellow-400" 
                    />
                  </Button>
                  {renderThemePreview(theme)}
                  <div className="flex gap-1 flex-shrink-0">
                    {theme.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        
        {otherThemes.length > 0 && (
          <>
            {favoriteThemes.length > 0 && (
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                All Themes
              </div>
            )}
            {otherThemes.map((theme) => (
              <DropdownMenuItem
                key={theme.id}
                onClick={(e) => handleThemeSelect(theme, e)}
                disabled={isReadOnly}
                className="p-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={(e) => handleToggleFavorite(theme.id, e)}
                  >
                    <Star 
                      className="h-3 w-3 text-muted-foreground hover:text-primary" 
                    />
                  </Button>
                  {renderThemePreview(theme)}
                  <div className="flex gap-1 flex-shrink-0">
                    {theme.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={(e) => { e?.stopPropagation(); onOpenEditor?.(); }} className="p-2 cursor-pointer">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span>Theme Editor</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}