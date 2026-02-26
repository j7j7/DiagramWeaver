import { useState, useCallback } from "react";
import type { Transform } from "./use-canvas-transform";
import type { DiagramData } from "@/lib/types";
import { measureNodeDims, type PositionedNode, type PositionedGroup } from "@/components/editor/canvas-constants";

interface UseCanvasExportOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  transform: Transform;
  width: number;
  height: number;
  toast: (options: { variant?: 'destructive' | 'default'; title: string; description: string }) => void;
  diagramData: DiagramData;
  processedNodes: PositionedNode[];
  processedZones: PositionedGroup[];
  selectedItemIds?: Set<string>;
  onGifAnimationTimeUpdate?: (timeSeconds: number | null) => void;
}

const DEFAULT_GIF_DURATION_SECONDS = 3;
const DEFAULT_GIF_FPS = 15;
const MIN_GIF_DURATION_SECONDS = 1;
const MAX_GIF_DURATION_SECONDS = 30;
const MIN_GIF_FPS = 1;
const MAX_GIF_FPS = 30;
const MAX_GIF_FRAMES = 300;

export function useCanvasExport({
  canvasRef,
  transform,
  width,
  height,
  toast,
  diagramData,
  processedNodes,
  processedZones,
  selectedItemIds = new Set(),
  onGifAnimationTimeUpdate,
}: UseCanvasExportOptions) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [pendingExportOptions, setPendingExportOptions] = useState<{ backgroundColor?: 'transparent' | 'white'; useSelection: boolean } | null>(null);

  // Calculate bounds of items (all items or selected items only)
  const calculateItemBounds = useCallback((itemIds?: Set<string>) => {
    // Filter items based on selection if provided
    const validNodes = processedNodes.filter(n => {
      const isValid = typeof n.x === 'number' && 
        typeof n.y === 'number' && 
        !isNaN(n.x) && 
        !isNaN(n.y) &&
        isFinite(n.x) &&
        isFinite(n.y);
      
      // If itemIds provided, only include selected items
      if (itemIds && itemIds.size > 0) {
        return isValid && itemIds.has(n.id);
      }
      return isValid;
    });

    const validZones = processedZones.filter(z => {
      const isValid = typeof z.x === 'number' && 
        typeof z.y === 'number' && 
        typeof z.width === 'number' &&
        typeof z.height === 'number' &&
        !isNaN(z.x) && 
        !isNaN(z.y) &&
        !isNaN(z.width) &&
        !isNaN(z.height) &&
        isFinite(z.x) &&
        isFinite(z.y) &&
        isFinite(z.width) &&
        isFinite(z.height) &&
        z.width > 0 &&
        z.height > 0;
      
      // If itemIds provided, only include selected items
      if (itemIds && itemIds.size > 0) {
        return isValid && itemIds.has(z.id);
      }
      return isValid;
    });

    // If no valid items, return null
    if (validNodes.length === 0 && validZones.length === 0) {
      return null;
    }

    // Calculate bounds for nodes
    let nodeMinX = Infinity;
    let nodeMinY = Infinity;
    let nodeMaxX = -Infinity;
    let nodeMaxY = -Infinity;

    validNodes.forEach(n => {
      const dims = measureNodeDims(n);
      const x = n.x!;
      const y = n.y!;
      const width = dims.width;
      const height = dims.height;

      // Use custom dimensions if available (for custom sizeMode nodes)
      const nodeWidth = (n.sizeMode === 'custom' && n.width) ? n.width : width;
      const nodeHeight = (n.sizeMode === 'custom' && n.height) ? n.height : height;

      nodeMinX = Math.min(nodeMinX, x);
      nodeMinY = Math.min(nodeMinY, y);
      nodeMaxX = Math.max(nodeMaxX, x + nodeWidth);
      nodeMaxY = Math.max(nodeMaxY, y + nodeHeight);
    });

    // Calculate bounds for zones
    let zoneMinX = Infinity;
    let zoneMinY = Infinity;
    let zoneMaxX = -Infinity;
    let zoneMaxY = -Infinity;

    validZones.forEach(z => {
      const x = z.x!;
      const y = z.y!;
      const width = z.width!;
      const height = z.height!;

      zoneMinX = Math.min(zoneMinX, x);
      zoneMinY = Math.min(zoneMinY, y);
      zoneMaxX = Math.max(zoneMaxX, x + width);
      zoneMaxY = Math.max(zoneMaxY, y + height);
    });

    // Combine bounds from nodes and zones
    const minX = Math.min(
      validNodes.length > 0 ? nodeMinX : Infinity,
      validZones.length > 0 ? zoneMinX : Infinity
    );
    const minY = Math.min(
      validNodes.length > 0 ? nodeMinY : Infinity,
      validZones.length > 0 ? zoneMinY : Infinity
    );
    const maxX = Math.max(
      validNodes.length > 0 ? nodeMaxX : -Infinity,
      validZones.length > 0 ? zoneMaxX : -Infinity
    );
    const maxY = Math.max(
      validNodes.length > 0 ? nodeMaxY : -Infinity,
      validZones.length > 0 ? zoneMaxY : -Infinity
    );

    // Calculate content dimensions
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    if (contentWidth <= 0 || contentHeight <= 0) {
      return null;
    }

    // Add padding around content
    const padding = 40;

    return {
      x: minX - padding,
      y: minY - padding,
      width: contentWidth + (2 * padding),
      height: contentHeight + (2 * padding),
    };
  }, [processedNodes, processedZones]);

  const exportPng = useCallback(async (options?: { backgroundColor?: 'transparent' | 'white'; quality?: 'low' | 'medium' | 'high' }) => {
    if (!canvasRef.current) return;
    
    try {
      const { toPng } = await import('html-to-image');
      
      // Find the actual content div (the one with dot-grid class)
      const contentDiv = canvasRef.current.querySelector('.dot-grid') as HTMLElement;
      if (!contentDiv) {
        toast({ variant: 'destructive', title: 'Export failed', description: 'Could not find diagram content.' });
        return;
      }

      // Temporarily hide grid
      const hadGridClass = contentDiv.classList.contains('dot-grid');
      if (hadGridClass) {
        contentDiv.classList.remove('dot-grid');
      }
      
      // Wait for browser to apply changes
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      // Export the canvas container as-is (current viewport)
      let exportElement = canvasRef.current;

      try {
        const backgroundColor = options?.backgroundColor === 'transparent' ? 'transparent' : 
                               options?.backgroundColor === 'white' ? '#ffffff' :
                               getComputedStyle(document.documentElement).getPropertyValue('--background') || '#ffffff';

        // Set pixel ratio based on quality setting
        const quality = options?.quality || 'medium';
        let pixelRatio: number;
        
        switch (quality) {
          case 'low':
            pixelRatio = 1;
            break;
          case 'medium':
            pixelRatio = 2;
            break;
          case 'high':
            pixelRatio = 4;
            break;
          default:
            pixelRatio = 2;
        }

        console.log('Exporting current viewport with quality:', quality, 'pixelRatio:', pixelRatio);

        let exportOptions: any = {
          pixelRatio: pixelRatio,
          cacheBust: true,
          backgroundColor: backgroundColor === 'transparent' ? undefined : backgroundColor,
          skipFonts: true,
        };

        const dataUrl = await toPng(exportElement, exportOptions);

        // Use File System Access API if available
        if ('showSaveFilePicker' in window) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: 'diagram.png',
              types: [{
                description: 'PNG Images',
                accept: { 'image/png': ['.png'] }
              }]
            });
            const blob = await (await fetch(dataUrl)).blob();
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            toast({ title: 'Exported', description: 'PNG exported successfully.' });
            return;
          } catch (error: any) {
            // User cancelled or API failed, fall back to download
            if (error.name !== 'AbortError') {
              console.log('File System Access API failed, falling back to download:', error);
            }
          }
        }

        // Fallback: automatic download
        const link = document.createElement('a');
        link.download = 'diagram.png';
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'Exported', description: 'PNG exported successfully.' });
      } finally {
        // Restore grid class
        if (hadGridClass) {
          contentDiv.classList.add('dot-grid');
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast({ variant: 'destructive', title: 'Export failed', description: 'Export encountered an issue.' });
    }
  }, [toast, transform, width, height, canvasRef, calculateItemBounds, selectedItemIds, processedNodes, processedZones]);

  const exportGif = useCallback(async (options?: { backgroundColor?: 'transparent' | 'white'; quality?: 'low' | 'medium' | 'high'; fps?: number; durationSeconds?: number }) => {
    if (!canvasRef.current) return;

    let gridElement: HTMLElement | null = null;
    let hadGridClass = false;
    try {
      const { toPng } = await import('html-to-image');
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

      gridElement = canvasRef.current.querySelector('.dot-grid') as HTMLElement;
      if (!gridElement) {
        toast({ variant: 'destructive', title: 'Export failed', description: 'Could not find diagram content.' });
        return;
      }

      hadGridClass = gridElement.classList.contains('dot-grid');
      if (hadGridClass) {
        gridElement.classList.remove('dot-grid');
      }

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const backgroundColor = options?.backgroundColor === 'transparent' ? 'transparent' :
        options?.backgroundColor === 'white' ? '#ffffff' :
          getComputedStyle(document.documentElement).getPropertyValue('--background') || '#ffffff';

      const quality = options?.quality || 'medium';
      let pixelRatio: number;
      switch (quality) {
        case 'low':
          pixelRatio = 1;
          break;
        case 'high':
          pixelRatio = 4;
          break;
        default:
          pixelRatio = 2;
      }

      const fps = Math.round(Math.max(MIN_GIF_FPS, Math.min(MAX_GIF_FPS, options?.fps ?? DEFAULT_GIF_FPS)));
      const durationSeconds = Math.round(Math.max(MIN_GIF_DURATION_SECONDS, Math.min(MAX_GIF_DURATION_SECONDS, options?.durationSeconds ?? DEFAULT_GIF_DURATION_SECONDS)));
      const frameCount = Math.max(2, Math.round(fps * durationSeconds));

      if (frameCount > MAX_GIF_FRAMES) {
        const maxDurationAtCurrentFps = Math.max(MIN_GIF_DURATION_SECONDS, Math.floor(MAX_GIF_FRAMES / fps));
        const maxFpsAtCurrentDuration = Math.max(MIN_GIF_FPS, Math.floor(MAX_GIF_FRAMES / durationSeconds));
        toast({
          variant: 'destructive',
          title: 'GIF values too large',
          description: `Reduce to at most ${maxDurationAtCurrentFps}s at ${fps} fps, or at most ${maxFpsAtCurrentDuration} fps at ${durationSeconds}s.`,
        });
        return;
      }

      const frameDelayMs = Math.round(1000 / fps);
      const frameDelayCs = Math.max(1, Math.round(frameDelayMs / 10));

      const exportElement = canvasRef.current;
      toast({
        title: 'Recording GIF',
        description: `Capturing ${frameCount} frames at ${fps} fps...`,
      });

      const bounds = exportElement.getBoundingClientRect();
      const gifWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
      const gifHeight = Math.max(1, Math.round(bounds.height * pixelRatio));

      const encoder = GIFEncoder();
      const decodeCanvas = document.createElement('canvas');
      decodeCanvas.width = gifWidth;
      decodeCanvas.height = gifHeight;
      const decodeCtx = decodeCanvas.getContext('2d', { willReadFrequently: true });
      if (!decodeCtx) {
        toast({ variant: 'destructive', title: 'Export failed', description: 'Unable to create rendering context.' });
        return;
      }

      const exportOptions = {
        pixelRatio,
        cacheBust: true,
        backgroundColor: backgroundColor === 'transparent' ? undefined : backgroundColor,
        skipFonts: true,
      };

      onGifAnimationTimeUpdate?.(0);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
        const currentTime = frameIndex / fps;
        onGifAnimationTimeUpdate?.(currentTime);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const dataUrl = await toPng(exportElement, exportOptions as any);

        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        decodeCtx.clearRect(0, 0, gifWidth, gifHeight);
        decodeCtx.drawImage(img, 0, 0, gifWidth, gifHeight);
        const rgbaFrame = decodeCtx.getImageData(0, 0, gifWidth, gifHeight).data;

        const palette = quantize(rgbaFrame, 256);
        const indexedFrame = applyPalette(rgbaFrame, palette);

        encoder.writeFrame(indexedFrame, gifWidth, gifHeight, {
          palette,
          delay: frameDelayCs,
        });

      }

      onGifAnimationTimeUpdate?.(null);
      toast({
        title: 'Saving GIF',
        description: 'Encoding and writing GIF file...',
      });

      encoder.finish();
      const bytes = typeof (encoder as any).bytesView === 'function'
        ? (encoder as any).bytesView()
        : (encoder as any).bytes();
      const blob = new Blob([bytes], { type: 'image/gif' });

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: 'diagram.gif',
            types: [{
              description: 'GIF Images',
              accept: { 'image/gif': ['.gif'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast({ title: 'Exported', description: 'GIF exported successfully.' });
          return;
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.log('File System Access API failed, falling back to download:', error);
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = 'diagram.gif';
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'GIF exported successfully.' });
    } catch (err) {
      console.error('GIF export failed:', err);
      toast({ variant: 'destructive', title: 'Export failed', description: 'GIF export encountered an issue.' });
    } finally {
      onGifAnimationTimeUpdate?.(null);

      if (hadGridClass && gridElement && !gridElement.classList.contains('dot-grid')) {
        gridElement.classList.add('dot-grid');
      }
    }
  }, [toast, canvasRef, onGifAnimationTimeUpdate]);

  const startExport = useCallback((options: { format?: 'png' | 'gif'; backgroundColor: 'transparent' | 'white'; quality?: 'low' | 'medium' | 'high'; fps?: number; durationSeconds?: number }) => {
    if (options.format === 'gif') {
      exportGif({
        backgroundColor: options.backgroundColor,
        quality: options.quality,
        fps: options.fps,
        durationSeconds: options.durationSeconds,
      });
      return;
    }
    exportPng({ backgroundColor: options.backgroundColor, quality: options.quality });
  }, [exportGif, exportPng]);

  return {
    exportPng,
    exportGif,
    startExport,
  };
}

