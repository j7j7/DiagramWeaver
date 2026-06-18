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

export function sanitizeExportBasename(raw: string): string {
  const s = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return s || 'diagram';
}

export interface PresentationSlidesExportInfo {
  /** Deck slide count; slide 1 is the main diagram, then further slides in order. */
  totalSlides: number;
  tabName: string;
  /** 1-based index of the slide currently open in the editor (same numbering as `-1.png`, `-2.png`, …). */
  activeSlideNumber: number;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFormat?: 'png' | 'gif';
  /** When set and totalSlides ≥ 2, PNG export can target multiple numbered files (`{basename}-{n}.png`). */
  presentationSlides?: PresentationSlidesExportInfo | null;
  /** When true, items are selected on the canvas; show a "selection only" option. */
  hasSelection?: boolean;
  onExport: (options: {
    format: 'png' | 'gif';
    backgroundColor: 'transparent' | 'white' | 'dark';
    quality: 'low' | 'medium' | 'high';
    fps?: number;
    durationSeconds?: number;
    pngSlideNumbers?: number[];
    exportBasename?: string;
    selectionOnly?: boolean;
  }) => Promise<void>;
}

const DEFAULT_GIF_DURATION_SECONDS = 3;
const DEFAULT_GIF_FPS = 15;
const MIN_GIF_DURATION_SECONDS = 1;
const MAX_GIF_DURATION_SECONDS = 30;
const MIN_GIF_FPS = 1;
const MAX_GIF_FPS = 30;
const MAX_GIF_FRAMES = 300;

type PngSlideScope = 'all' | 'range' | 'single' | 'current';

export function ExportDialog({
  open,
  onOpenChange,
  initialFormat = 'png',
  presentationSlides = null,
  hasSelection = false,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState<'png' | 'gif'>(initialFormat);
  const [backgroundColor, setBackgroundColor] = useState<'transparent' | 'white' | 'dark'>('white');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [gifDurationSeconds, setGifDurationSeconds] = useState<number>(DEFAULT_GIF_DURATION_SECONDS);
  const [gifFps, setGifFps] = useState<number>(DEFAULT_GIF_FPS);
  const [isExporting, setIsExporting] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [pngSlideScope, setPngSlideScope] = useState<PngSlideScope>('all');
  const [pngRangeFrom, setPngRangeFrom] = useState(1);
  const [pngRangeTo, setPngRangeTo] = useState(1);
  const [pngSingleSlide, setPngSingleSlide] = useState(1);

  const multiPng =
    format === 'png' &&
    presentationSlides !== null &&
    presentationSlides.totalSlides >= 2 &&
    !selectionOnly;

  React.useEffect(() => {
    if (open) {
      setFormat(initialFormat);
      const dark = document.documentElement.classList.contains('dark');
      setBackgroundColor(initialFormat === 'gif' && dark ? 'dark' : 'white');
      setSelectionOnly(hasSelection);
    }
  }, [open, initialFormat, hasSelection]);

  React.useEffect(() => {
    if (!open || !presentationSlides) return;
    const n = presentationSlides.totalSlides;
    setPngRangeFrom(1);
    setPngRangeTo(n);
    setPngSingleSlide(1);
    setPngSlideScope('all');
  }, [open, presentationSlides?.totalSlides, presentationSlides?.tabName]);

  const gifFrameCount = Math.round(gifDurationSeconds * gifFps);
  const gifExceedsFrameLimit = gifFrameCount > MAX_GIF_FRAMES;
  const maxDurationAtCurrentFps = Math.max(MIN_GIF_DURATION_SECONDS, Math.floor(MAX_GIF_FRAMES / Math.max(MIN_GIF_FPS, gifFps)));
  const maxFpsAtCurrentDuration = Math.max(MIN_GIF_FPS, Math.floor(MAX_GIF_FRAMES / Math.max(MIN_GIF_DURATION_SECONDS, gifDurationSeconds)));

  const pngSlideError = (() => {
    if (!multiPng || !presentationSlides) return null;
    const max = presentationSlides.totalSlides;
    if (pngSlideScope === 'single') {
      if (!Number.isFinite(pngSingleSlide) || pngSingleSlide < 1 || pngSingleSlide > max) {
        return `Slide must be between 1 and ${max}.`;
      }
    }
    if (pngSlideScope === 'current') {
      const cur = presentationSlides.activeSlideNumber;
      if (!Number.isFinite(cur) || cur < 1 || cur > max) {
        return `Current slide must be between 1 and ${max}.`;
      }
    }
    if (pngSlideScope === 'range') {
      const a = Math.round(pngRangeFrom);
      const b = Math.round(pngRangeTo);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Enter valid slide numbers.';
      if (a < 1 || b < 1 || a > max || b > max) return `Slides must be between 1 and ${max}.`;
      if (a > b) return 'The first slide must be less than or equal to the last.';
    }
    return null;
  })();

  const handleExport = async () => {
    if (format === 'gif' && gifExceedsFrameLimit) {
      return;
    }
    if (multiPng && pngSlideError) {
      return;
    }

    setIsExporting(true);
    try {
      const basename = sanitizeExportBasename(presentationSlides?.tabName ?? 'diagram');

      let pngSlideNumbers: number[] | undefined;
      if (multiPng && presentationSlides) {
        const max = presentationSlides.totalSlides;
        if (pngSlideScope === 'all') {
          pngSlideNumbers = Array.from({ length: max }, (_, i) => i + 1);
        } else if (pngSlideScope === 'range') {
          const a = Math.round(pngRangeFrom);
          const b = Math.round(pngRangeTo);
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          pngSlideNumbers = [];
          for (let i = lo; i <= hi; i++) {
            pngSlideNumbers.push(i);
          }
        } else if (pngSlideScope === 'current') {
          pngSlideNumbers = [Math.round(presentationSlides.activeSlideNumber)];
        } else {
          pngSlideNumbers = [Math.round(pngSingleSlide)];
        }
      }

      await onExport({
        format,
        backgroundColor,
        quality,
        fps: format === 'gif' ? gifFps : undefined,
        durationSeconds: format === 'gif' ? gifDurationSeconds : undefined,
        pngSlideNumbers,
        exportBasename: basename,
        selectionOnly: hasSelection && selectionOnly ? true : undefined,
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
            {multiPng
              ? `Export slide(s) as PNG. Files are named ${sanitizeExportBasename(presentationSlides?.tabName ?? 'diagram')}-1.png, …`
              : `Export the current viewport as a ${format.toUpperCase()} image`}
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
          {multiPng && presentationSlides && (
            <div className="space-y-3 rounded-md border p-3">
              <Label>Slides (PNG)</Label>
              <p className="text-xs text-muted-foreground">
                Slides are numbered 1–{presentationSlides.totalSlides} in deck order (slide 1 is the main diagram).
              </p>
              <RadioGroup value={pngSlideScope} onValueChange={(v) => setPngSlideScope(v as PngSlideScope)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="png-all" />
                  <Label htmlFor="png-all" className="font-normal cursor-pointer">All slides</Label>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <RadioGroupItem value="range" id="png-range" />
                  <Label htmlFor="png-range" className="font-normal cursor-pointer shrink-0">Range</Label>
                  {pngSlideScope === 'range' && (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <Label htmlFor="png-from" className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                        <Input
                          id="png-from"
                          className="h-8 w-[4.25rem]"
                          type="number"
                          min={1}
                          max={presentationSlides.totalSlides}
                          value={pngRangeFrom}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isNaN(v)) return;
                            setPngRangeFrom(v);
                          }}
                        />
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Label htmlFor="png-to" className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                        <Input
                          id="png-to"
                          className="h-8 w-[4.25rem]"
                          type="number"
                          min={1}
                          max={presentationSlides.totalSlides}
                          value={pngRangeTo}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isNaN(v)) return;
                            setPngRangeTo(v);
                          }}
                        />
                      </span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <RadioGroupItem value="single" id="png-single" />
                    <Label htmlFor="png-single" className="font-normal cursor-pointer shrink-0">Single slide</Label>
                    {pngSlideScope === 'single' && (
                      <span className="inline-flex items-center gap-1.5">
                        <Label htmlFor="png-one" className="text-xs text-muted-foreground whitespace-nowrap">#</Label>
                        <Input
                          id="png-one"
                          className="h-8 w-[4.25rem]"
                          type="number"
                          min={1}
                          max={presentationSlides.totalSlides}
                          value={pngSingleSlide}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isNaN(v)) return;
                            setPngSingleSlide(v);
                          }}
                        />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-x-2">
                    <RadioGroupItem value="current" id="png-current" />
                    <Label htmlFor="png-current" className="font-normal cursor-pointer">
                      Current slide
                      <span className="text-muted-foreground font-normal">
                        {' '}(#{presentationSlides.activeSlideNumber})
                      </span>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
              {pngSlideError && (
                <p className="text-sm text-destructive">{pngSlideError}</p>
              )}
            </div>
          )}
          {hasSelection && format === 'png' && !multiPng && (
            <div className="flex items-center space-x-2 rounded-md border p-3">
              <input
                type="checkbox"
                id="selection-only"
                checked={selectionOnly}
                onChange={(e) => setSelectionOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="selection-only" className="font-normal cursor-pointer">
                Selected items only
              </Label>
            </div>
          )}
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
          <Button
            onClick={handleExport}
            disabled={isExporting || (format === 'gif' && gifExceedsFrameLimit) || Boolean(multiPng && pngSlideError)}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
