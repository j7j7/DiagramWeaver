"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Move, RotateCcw, ZoomIn } from "lucide-react";
import { CustomIconImage } from "@/components/diagram/custom-icon-image";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_CUSTOM_IMAGE_OPTIONS, normalizeCustomImageOptions } from "@/lib/custom-icon-utils";
import { cn } from "@/lib/utils";
import type { CustomImageOptions } from "@/lib/types";

interface CustomIconPreviewEditorProps {
  imageUrl?: string;
  imageOptions?: Partial<CustomImageOptions>;
  onOptionsChange?: (options: CustomImageOptions) => void;
  size?: number;
  className?: string;
  readOnly?: boolean;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startCrop: CustomImageOptions["crop"];
}

const MIN_CROP_SIZE = 15;
const MAX_CROP_SIZE = 300;
const FIT_ZOOM_PERCENT = 100;
const MAX_ZOOM_PERCENT = 200;

export function CustomIconPreviewEditor({
  imageUrl,
  imageOptions,
  onOptionsChange,
  size = 144,
  className,
  readOnly = false,
}: CustomIconPreviewEditorProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const options = useMemo(
    () => normalizeCustomImageOptions(imageOptions ?? DEFAULT_CUSTOM_IMAGE_OPTIONS),
    [imageOptions]
  );

  const zoomPercent = useMemo(() => cropWidthToZoomPercent(options.crop.width), [options.crop.width]);

  const applyCrop = useCallback(
    (nextCrop: CustomImageOptions["crop"]) => {
      if (!onOptionsChange) return;
      onOptionsChange(
        normalizeCustomImageOptions({
          ...options,
          scale: 100,
          crop: nextCrop,
        })
      );
    },
    [onOptionsChange, options]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (readOnly || !imageUrl || !onOptionsChange) return;

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCrop: options.crop,
      };
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [imageUrl, onOptionsChange, options.crop, readOnly]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      const rect = frameRef.current?.getBoundingClientRect();
      if (!dragState || !rect) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const nextX = dragState.startCrop.x - (deltaX / rect.width) * dragState.startCrop.width;
      const nextY = dragState.startCrop.y - (deltaY / rect.height) * dragState.startCrop.height;

      applyCrop({
        ...dragState.startCrop,
        x: nextX,
        y: nextY,
      });
    },
    [applyCrop]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setIsDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleZoomChange = useCallback(
    (value: number[]) => {
      if (readOnly || !imageUrl || !onOptionsChange) return;

      const nextZoom = value[0] ?? 0;
      const nextWidth = zoomPercentToCropWidth(nextZoom);
      const scale = nextWidth / options.crop.width;
      const nextHeight = clamp(options.crop.height * scale, MIN_CROP_SIZE, MAX_CROP_SIZE);
      const centerX = options.crop.x + options.crop.width / 2;
      const centerY = options.crop.y + options.crop.height / 2;

      applyCrop({
        x: centerX - nextWidth / 2,
        y: centerY - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
      });
    },
    [applyCrop, imageUrl, onOptionsChange, options.crop, readOnly]
  );

  const handleFit = useCallback(() => {
    if (readOnly || !imageUrl || !onOptionsChange) return;
    onOptionsChange(
      normalizeCustomImageOptions({
        ...options,
        scale: 100,
        crop: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      })
    );
  }, [imageUrl, onOptionsChange, options, readOnly]);

  const handleReset = useCallback(() => {
    if (!onOptionsChange) return;
    onOptionsChange(normalizeCustomImageOptions(DEFAULT_CUSTOM_IMAGE_OPTIONS));
  }, [onOptionsChange]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3">
        <div
          ref={frameRef}
          className={cn(
            "relative mx-auto overflow-hidden rounded-[1.25rem] border border-foreground/15 bg-background shadow-sm",
            !readOnly && imageUrl ? "cursor-grab" : "cursor-default",
            isDragging ? "cursor-grabbing" : null
          )}
          style={{ width: `${size}px`, height: `${size}px`, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={() => {
            if (!readOnly && imageUrl && onOptionsChange) {
              handleFit();
            }
          }}
        >
          <CustomIconImage
            imageUrl={imageUrl}
            imageOptions={options}
            width={size}
            height={size}
            className="h-full w-full select-none pointer-events-none"
          />
          <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-1 ring-inset ring-foreground/20" />
          <div className="pointer-events-none absolute inset-[10%] rounded-[1rem] border border-white/70 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Move className="h-3.5 w-3.5" />
          <span>Drag freely (double-click to Fit)</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ZoomIn className="h-3.5 w-3.5" />
            <span>Zoom</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{getZoomLabel(zoomPercent)}</span>
            {!readOnly && imageUrl && onOptionsChange && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={handleFit}
              >
                Fit
              </Button>
            )}
          </div>
        </div>
        <Slider
          value={[zoomPercent]}
          onValueChange={handleZoomChange}
          min={0}
          max={MAX_ZOOM_PERCENT}
          step={1}
          disabled={readOnly || !imageUrl || !onOptionsChange}
          aria-label="Custom icon zoom"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Zoom Out</span>
          <span>Fit</span>
          <span>Zoom In</span>
        </div>
      </div>

      {!readOnly && onOptionsChange && (
        <Button type="button" variant="ghost" size="sm" className="h-8 w-full" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Reset Fit
        </Button>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cropWidthToZoomPercent(cropWidth: number): number {
  const clampedWidth = clamp(cropWidth, MIN_CROP_SIZE, MAX_CROP_SIZE);
  if (clampedWidth >= 100) {
    const normalized = (MAX_CROP_SIZE - clampedWidth) / (MAX_CROP_SIZE - 100);
    return Math.round(normalized * FIT_ZOOM_PERCENT);
  }

  const normalized = (100 - clampedWidth) / (100 - MIN_CROP_SIZE);
  return Math.round(FIT_ZOOM_PERCENT + normalized * (MAX_ZOOM_PERCENT - FIT_ZOOM_PERCENT));
}

function zoomPercentToCropWidth(zoomPercent: number): number {
  const normalizedZoom = clamp(zoomPercent, 0, MAX_ZOOM_PERCENT);
  if (normalizedZoom <= FIT_ZOOM_PERCENT) {
    const normalized = normalizedZoom / FIT_ZOOM_PERCENT;
    return MAX_CROP_SIZE - normalized * (MAX_CROP_SIZE - 100);
  }

  const normalized = (normalizedZoom - FIT_ZOOM_PERCENT) / (MAX_ZOOM_PERCENT - FIT_ZOOM_PERCENT);
  return 100 - normalized * (100 - MIN_CROP_SIZE);
}

function getZoomLabel(zoomPercent: number): string {
  if (zoomPercent === FIT_ZOOM_PERCENT) return "Fit (100%)";
  return `${zoomPercent}%`;
}