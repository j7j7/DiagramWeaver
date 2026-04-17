"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Palette,
  Star,
  ChevronDown
} from 'lucide-react';
import { DiagramTheme, ThemeMenuApplyOptions } from '@/lib/theme-types';
import { themeManager, DIAGRAM_THEME_HUE_STEP_DEG } from '@/lib/theme-manager';
import { Input } from '@/components/ui/input';
import { getVisualStylingCSS, themePropertiesToVisualStyling } from '@/lib/visual-styling';

/** Hover delay before theme description tooltip opens (ms). */
const THEME_DESCRIPTION_TOOLTIP_DELAY_MS = 1500;

const MULTI_HUE_LAYOUT_STORAGE_KEY = 'diagram-weaver-theme-multi-hue-layout';
const MULTI_HUE_STEP_STORAGE_KEY = 'diagram-weaver-theme-multi-hue-step-deg';

function clampMultiHueStepDeg(value: number): number {
  if (!Number.isFinite(value)) return DIAGRAM_THEME_HUE_STEP_DEG;
  return Math.min(360, Math.max(1, Math.round(value)));
}

interface ThemeMenuSelectorProps {
  onThemeSelect?: (theme: DiagramTheme, options?: ThemeMenuApplyOptions) => void;
  onOpenEditor?: () => void;
  isReadOnly?: boolean;
}

function ThemeDropdownMenuRow({
  theme,
  isReadOnly,
  onThemeSelect,
  onToggleFavorite,
  renderThemePreview,
}: {
  theme: DiagramTheme;
  isReadOnly: boolean;
  onThemeSelect: (theme: DiagramTheme, e?: React.MouseEvent) => void;
  onToggleFavorite: (themeId: string, e: React.MouseEvent) => void;
  renderThemePreview: (theme: DiagramTheme) => React.ReactNode;
}) {
  const description = theme.description?.trim();

  const menuItem = (
    <DropdownMenuItem
      onClick={(e) => onThemeSelect(theme, e)}
      disabled={isReadOnly}
      className="p-2 cursor-pointer"
    >
      <div className="flex items-center gap-2 w-full">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={(e) => onToggleFavorite(theme.id, e)}
        >
          <Star
            className={
              theme.isFavorite
                ? 'h-3 w-3 fill-yellow-400 text-yellow-400'
                : 'h-3 w-3 text-muted-foreground hover:text-primary'
            }
          />
        </Button>
        {renderThemePreview(theme)}
        <div className="flex gap-1 flex-shrink-0">
          {theme.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
        </div>
      </div>
    </DropdownMenuItem>
  );

  if (!description) {
    return menuItem;
  }

  return (
    <Tooltip delayDuration={THEME_DESCRIPTION_TOOLTIP_DELAY_MS}>
      <TooltipTrigger asChild>{menuItem}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={10}
        className="z-[200] max-w-xs text-left text-popover-foreground"
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

export function ThemeMenuSelector({ onThemeSelect, onOpenEditor, isReadOnly = false }: ThemeMenuSelectorProps) {
  const [themes, setThemes] = useState<DiagramTheme[]>([]);
  const [multiHueByLayout, setMultiHueByLayout] = useState(false);
  const [multiHueStepDeg, setMultiHueStepDeg] = useState(DIAGRAM_THEME_HUE_STEP_DEG);
  const [hueStepInput, setHueStepInput] = useState(String(DIAGRAM_THEME_HUE_STEP_DEG));

  useEffect(() => {
    setThemes(themeManager.getThemesSorted());

    const unsubscribe = themeManager.subscribe(() => {
      setThemes(themeManager.getThemesSorted());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      setMultiHueByLayout(localStorage.getItem(MULTI_HUE_LAYOUT_STORAGE_KEY) === '1');
      const rawStep = localStorage.getItem(MULTI_HUE_STEP_STORAGE_KEY);
      if (rawStep != null) {
        const parsed = Number(rawStep);
        const n = clampMultiHueStepDeg(parsed);
        setMultiHueStepDeg(n);
        setHueStepInput(String(n));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const commitHueStepInput = (): number => {
    const raw = hueStepInput.trim();
    const n =
      raw === '' ? multiHueStepDeg : clampMultiHueStepDeg(Number(raw));
    setMultiHueStepDeg(n);
    setHueStepInput(String(n));
    try {
      localStorage.setItem(MULTI_HUE_STEP_STORAGE_KEY, String(n));
    } catch {
      /* ignore */
    }
    return n;
  };

  const handleThemeSelect = (theme: DiagramTheme, e?: React.MouseEvent) => {
    if (isReadOnly) return;
    e?.stopPropagation();
    if (onThemeSelect) {
      const stepDeg = commitHueStepInput();
      onThemeSelect(theme, {
        multiSelectHueByLayout: multiHueByLayout,
        multiSelectHueStepDegrees: stepDeg,
      });
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
        <DropdownMenuCheckboxItem
          checked={multiHueByLayout}
          disabled={isReadOnly}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={(checked) => {
            const on = checked === true;
            setMultiHueByLayout(on);
            try {
              localStorage.setItem(MULTI_HUE_LAYOUT_STORAGE_KEY, on ? '1' : '0');
            } catch {
              /* ignore */
            }
          }}
        >
          Step hue for multi-selection (by layout)
        </DropdownMenuCheckboxItem>
        <div
          className="px-2 py-2 flex items-center gap-2"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <label htmlFor="theme-multi-hue-step" className="text-xs text-muted-foreground shrink-0">
            Hue step (°)
          </label>
          <Input
            id="theme-multi-hue-step"
            type="number"
            min={1}
            max={360}
            step={1}
            className="h-8 w-[4.5rem] px-2"
            disabled={isReadOnly}
            value={hueStepInput}
            onChange={(e) => setHueStepInput(e.target.value)}
            onBlur={commitHueStepInput}
          />
        </div>
        <DropdownMenuSeparator />
        {favoriteThemes.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              Favorites
            </div>
            {favoriteThemes.map((theme) => (
              <ThemeDropdownMenuRow
                key={theme.id}
                theme={theme}
                isReadOnly={isReadOnly}
                onThemeSelect={handleThemeSelect}
                onToggleFavorite={handleToggleFavorite}
                renderThemePreview={renderThemePreview}
              />
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
              <ThemeDropdownMenuRow
                key={theme.id}
                theme={theme}
                isReadOnly={isReadOnly}
                onThemeSelect={handleThemeSelect}
                onToggleFavorite={handleToggleFavorite}
                renderThemePreview={renderThemePreview}
              />
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
