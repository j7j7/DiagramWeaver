"use client";
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFormat?: 'png' | 'gif';
  onExport: (options: {
    format: 'png' | 'gif';
    backgroundColor: 'transparent' | 'white' | 'dark';
    quality: 'low' | 'medium' | 'high';
    fps?: number;
    durationSeconds?: number;
  }) => Promise<void>;
}

const DEFAULT_GIF_DURATION_SECONDS = 3;
const DEFAULT_GIF_FPS = 15;
const MIN_GIF_DURATION_SECONDS = 1;
const MAX_GIF_DURATION_SECONDS = 30;
const MIN_GIF_FPS = 1;
const MAX_GIF_FPS = 30;
const MAX_GIF_FRAMES = 300;

export function ExportDialog({ open, onOpenChange, initialFormat = 'png', onExport }: ExportDialogProps) {
  const [format, setFormat] = useState<'png' | 'gif'>(initialFormat);
  const [backgroundColor, setBackgroundColor] = useState<'transparent' | 'white' | 'dark'>('white');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [gifDurationSeconds, setGifDurationSeconds] = useState<number>(DEFAULT_GIF_DURATION_SECONDS);
  const [gifFps, setGifFps] = useState<number>(DEFAULT_GIF_FPS);
  const [isExporting, setIsExporting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setFormat(initialFormat);
      const dark = document.documentElement.classList.contains('dark');
      setBackgroundColor(initialFormat === 'gif' && dark ? 'dark' : 'white');
    }
  }, [open, initialFormat]);

  const gifFrameCount = Math.round(gifDurationSeconds * gifFps);
  const gifExceedsFrameLimit = gifFrameCount > MAX_GIF_FRAMES;
  const maxDurationAtCurrentFps = Math.max(MIN_GIF_DURATION_SECONDS, Math.floor(MAX_GIF_FRAMES / Math.max(MIN_GIF_FPS, gifFps)));
  const maxFpsAtCurrentDuration = Math.max(MIN_GIF_FPS, Math.floor(MAX_GIF_FRAMES / Math.max(MIN_GIF_DURATION_SECONDS, gifDurationSeconds)));

  const handleExport = async () => {
    if (format === 'gif' && gifExceedsFrameLimit) {
      return;
    }

    setIsExporting(true);
    try {
      await onExport({
        format,
        backgroundColor,
        quality,
        fps: format === 'gif' ? gifFps : undefined,
        durationSeconds: format === 'gif' ? gifDurationSeconds : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export {format.toUpperCase()}</DialogTitle>
          <DialogDescription>
            Export the current viewport as a {format.toUpperCase()} image
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Format</Label>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as 'png' | 'gif')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="png" id="fmt-png" />
                <Label htmlFor="fmt-png" className="font-normal cursor-pointer">PNG (static)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="gif" id="fmt-gif" />
                <Label htmlFor="fmt-gif" className="font-normal cursor-pointer">GIF (animated)</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-3">
            <Label>Background</Label>
            <RadioGroup value={backgroundColor} onValueChange={(value) => setBackgroundColor(value as 'transparent' | 'white' | 'dark')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="white" id="white" />
                <Label htmlFor="white" className="font-normal cursor-pointer">White</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="font-normal cursor-pointer">Dark</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="transparent" id="transparent" />
                <Label htmlFor="transparent" className="font-normal cursor-pointer">Transparent</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-3">
            <Label>Quality</Label>
            <RadioGroup value={quality} onValueChange={(value) => setQuality(value as 'low' | 'medium' | 'high')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low" className="font-normal cursor-pointer">Low (1x) - Smaller file size</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="font-normal cursor-pointer">Medium (2x) - Balanced</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="font-normal cursor-pointer">High (4x) - Best quality</Label>
              </div>
            </RadioGroup>
          </div>
          {format === 'gif' && (
            <div className="space-y-4 border rounded-md p-3">
              <div className="space-y-2">
                <Label htmlFor="gif-duration-seconds">Duration (seconds)</Label>
                <Input
                  id="gif-duration-seconds"
                  type="number"
                  min={MIN_GIF_DURATION_SECONDS}
                  max={MAX_GIF_DURATION_SECONDS}
                  step={1}
                  value={gifDurationSeconds}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isNaN(value)) return;
                    setGifDurationSeconds(Math.max(MIN_GIF_DURATION_SECONDS, Math.min(MAX_GIF_DURATION_SECONDS, Math.round(value))));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gif-fps">Frame rate (frames/second)</Label>
                <Input
                  id="gif-fps"
                  type="number"
                  min={MIN_GIF_FPS}
                  max={MAX_GIF_FPS}
                  step={1}
                  value={gifFps}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isNaN(value)) return;
                    setGifFps(Math.max(MIN_GIF_FPS, Math.min(MAX_GIF_FPS, Math.round(value))));
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Total frames: {gifFrameCount} / {MAX_GIF_FRAMES}
              </p>
              {gifExceedsFrameLimit && (
                <p className="text-sm text-destructive">
                  Values are too large for GIF export. Reduce to at most {maxDurationAtCurrentFps}s at {gifFps} fps, or at most {maxFpsAtCurrentDuration} fps at {gifDurationSeconds}s.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || (format === 'gif' && gifExceedsFrameLimit)}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

