"use client";

import React from 'react';
import { Pen, Eraser, Trash2, Undo2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AnnotationToolConfig } from '@/lib/annotation-types';
import { cn } from '@/lib/utils';

export interface AnnotationToolbarProps {
  toolConfig: AnnotationToolConfig;
  onToolChange: (config: Partial<AnnotationToolConfig>) => void;
  onToggleTool: () => void;
  onClearAll: () => void;
  onUndo: () => void;
  hasStrokes: boolean;
  isDrawing?: boolean;
}

const STYLE_PRESETS: Record<'pen' | 'marker' | 'highlighter' | 'eraser', { width: number; opacity: number }> = {
  pen: { width: 2, opacity: 1 },
  marker: { width: 5, opacity: 0.8 },
  highlighter: { width: 8, opacity: 0.3 },
  eraser: { width: 18, opacity: 1 },
};

/**
 * Toolbar for controlling hand drawing annotations
 */
export function AnnotationToolbar({
  toolConfig,
  onToolChange,
  onToggleTool,
  onClearAll,
  onUndo,
  hasStrokes,
  isDrawing,
}: AnnotationToolbarProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-sm backdrop-blur-sm">
      {/* Toggle drawing mode */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={toolConfig.enabled ? 'default' : 'outline'}
            className="h-8 w-8 p-0"
            onClick={onToggleTool}
            title={toolConfig.enabled ? 'Disable drawing' : 'Enable drawing'}
          >
            <Pen className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {toolConfig.enabled ? 'Disable drawing' : 'Enable drawing'}
        </TooltipContent>
      </Tooltip>

      {toolConfig.enabled && (
        <>
          {/* Style selector */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 px-2 text-xs"
                    title="Drawing style"
                  >
                    <span className="capitalize text-xs">{toolConfig.style}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Drawing style</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              {(['pen', 'marker', 'highlighter', 'eraser'] as const).map((style) => (
                <DropdownMenuItem
                  key={style}
                  onClick={() => {
                    const preset = STYLE_PRESETS[style];
                    onToolChange({
                      style,
                      width: preset.width,
                      opacity: preset.opacity,
                    });
                  }}
                  className={cn(style === toolConfig.style && 'bg-accent')}
                >
                  <span className="mr-2 inline-flex items-center">
                    {style === 'eraser' ? <Eraser className="h-3.5 w-3.5" /> : <Pen className="h-3.5 w-3.5" />}
                  </span>
                  <span className="capitalize">{style}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Color picker */}
          {toolConfig.style !== 'eraser' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 rounded border border-border bg-muted p-1">
                  <input
                    type="color"
                    value={toolConfig.color}
                    onChange={(e) => onToolChange({ color: e.target.value })}
                    className="h-6 w-10 cursor-pointer rounded border-0 p-0"
                    title="Line color"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>Line color</TooltipContent>
            </Tooltip>
          )}

          {/* Width control */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-2">
                <label className="text-xs text-muted-foreground">Width:</label>
                <Slider
                  value={[toolConfig.width]}
                  onValueChange={(value) => onToolChange({ width: value[0] })}
                  min={1}
                  max={20}
                  step={1}
                  className="w-20"
                />
                <span className="w-6 text-right text-xs text-muted-foreground">
                  {toolConfig.width}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Line width</TooltipContent>
          </Tooltip>

          {/* Opacity control */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-2">
                <label className="text-xs text-muted-foreground">Opacity:</label>
                <Slider
                  value={[toolConfig.opacity]}
                  onValueChange={(value) => onToolChange({ opacity: value[0] })}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-20"
                />
                <span className="w-10 text-right text-xs text-muted-foreground">
                  {Math.round(toolConfig.opacity * 100)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>Line transparency</TooltipContent>
          </Tooltip>

          {/* Undo button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={onUndo}
                disabled={!hasStrokes}
                title="Undo last stroke"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo last stroke</TooltipContent>
          </Tooltip>

          {/* Clear all button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 w-8 p-0"
                onClick={onClearAll}
                disabled={!hasStrokes}
                title="Clear all annotations"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all annotations</TooltipContent>
          </Tooltip>

          {/* Drawing status indicator */}
          {isDrawing && (
            <span className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Drawing
            </span>
          )}
        </>
      )}
    </div>
  );
}
