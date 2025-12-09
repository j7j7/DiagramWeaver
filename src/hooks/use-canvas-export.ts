import { useState, useCallback } from "react";
import type { Transform } from "./use-canvas-transform";

interface UseCanvasExportOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  transform: Transform;
  width: number;
  height: number;
  toast: (options: { variant?: 'destructive' | 'default'; title: string; description: string }) => void;
}

export function useCanvasExport({
  canvasRef,
  transform,
  width,
  height,
  toast,
}: UseCanvasExportOptions) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [pendingExportOptions, setPendingExportOptions] = useState<{ backgroundColor?: 'transparent' | 'white'; useSelection: boolean } | null>(null);

  const exportPng = useCallback(async (options?: { backgroundColor?: 'transparent' | 'white'; selectionArea?: { x: number; y: number; width: number; height: number } }) => {
    if (!canvasRef.current) return;
    
    try {
      const { toPng } = await import('html-to-image');
      
      // Find the actual content div (the one with dot-grid class)
      const contentDiv = canvasRef.current.querySelector('.dot-grid') as HTMLElement;
      if (!contentDiv) {
        toast({ variant: 'destructive', title: 'Export failed', description: 'Could not find diagram content.' });
        return;
      }

      // Store current transform from state (not DOM) to ensure we restore correctly
      const currentTransform = transform;
      const transformString = `translate(${currentTransform.x}px, ${currentTransform.y}px) scale(${currentTransform.k})`;

      // Temporarily hide grid by removing the class
      const hadGridClass = contentDiv.classList.contains('dot-grid');
      if (hadGridClass) {
        contentDiv.classList.remove('dot-grid');
      }

      // Store original inline styles (might be empty if React is controlling it)
      const originalTransform = contentDiv.style.transform;
      const originalTransformOrigin = contentDiv.style.transformOrigin;
      
      // Remove transform temporarily for accurate coordinate mapping
      contentDiv.style.transform = 'none';
      contentDiv.style.transformOrigin = '0 0';
      
      // Wait for browser to re-render with new transform
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      // For full export, we can work with the element as-is
      // For selection export, we need to adjust coordinates
      let exportElement = contentDiv;

      try {
        const backgroundColor = options?.backgroundColor === 'transparent' ? 'transparent' : 
                               options?.backgroundColor === 'white' ? '#ffffff' :
                               getComputedStyle(document.documentElement).getPropertyValue('--background') || '#ffffff';

        let exportOptions: any = {
          pixelRatio: Math.min(3, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1) * 2,
          cacheBust: true,
          backgroundColor: backgroundColor === 'transparent' ? undefined : backgroundColor,
          skipFonts: true,
        };

        // If selection area is provided, crop to that area
        if (options?.selectionArea) {
          const { x, y, width: selectionWidth, height: selectionHeight } = options.selectionArea;
          
          // Debug: log before export
          console.log('Export with selection:', { 
            x, y, selectionWidth, selectionHeight,
            contentDivSize: { width, height },
            transform: currentTransform
          });
          
          // Coordinates are in diagram space (relative to contentDiv without transform)
          // html-to-image expects coordinates relative to the element's coordinate system
          exportOptions = {
            ...exportOptions,
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: Math.max(1, Math.min(selectionWidth, width - x)), // Don't exceed content bounds
            height: Math.max(1, Math.min(selectionHeight, height - y)), // Don't exceed content bounds
          };
          
          console.log('Final export options:', exportOptions);
        }

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
        // Restore original state - use the transform string from state, not from DOM
        if (hadGridClass) {
          contentDiv.classList.add('dot-grid');
        }
        // Restore transform - use the state value, not the original DOM value
        contentDiv.style.transform = transformString;
        contentDiv.style.transformOrigin = originalTransformOrigin || '0 0';
        
        // Force a re-render to ensure React syncs with the DOM
        // Use requestAnimationFrame to ensure DOM update happens before React re-renders
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        
        // Ensure transform state is still correct (in case React tried to override)
        // This is a safety check - the transform should already be correct from state
        if (contentDiv.style.transform !== transformString) {
          contentDiv.style.transform = transformString;
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast({ variant: 'destructive', title: 'Export failed', description: 'Export encountered an issue.' });
    }
  }, [toast, transform, width, height, canvasRef]);

  const startSelectionMode = useCallback((options: { backgroundColor: 'transparent' | 'white'; useSelection: boolean }) => {
    if (options.useSelection) {
      setIsSelectionMode(true);
      setPendingExportOptions(options);
      toast({ title: 'Selection Mode', description: 'Drag to select the area to export.' });
    } else {
      exportPng({ backgroundColor: options.backgroundColor });
    }
  }, [exportPng, toast]);

  return {
    isSelectionMode,
    pendingExportOptions,
    exportPng,
    startSelectionMode,
    setIsSelectionMode,
    setPendingExportOptions,
  };
}

