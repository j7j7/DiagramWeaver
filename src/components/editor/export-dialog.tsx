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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: { backgroundColor: 'transparent' | 'white'; useSelection: boolean }) => Promise<void>;
  selectionCoordinates?: { start: { x: number; y: number } | null; end: { x: number; y: number } | null };
}

export function ExportDialog({ open, onOpenChange, onExport, selectionCoordinates }: ExportDialogProps) {
  const [backgroundColor, setBackgroundColor] = useState<'transparent' | 'white'>('white');
  const [useSelection, setUseSelection] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport({ backgroundColor, useSelection });
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
          <DialogTitle>Export Diagram</DialogTitle>
          <DialogDescription>
            Choose export options for your diagram
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Background</Label>
            <RadioGroup value={backgroundColor} onValueChange={(value) => setBackgroundColor(value as 'transparent' | 'white')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="white" id="white" />
                <Label htmlFor="white" className="font-normal cursor-pointer">White Background</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="transparent" id="transparent" />
                <Label htmlFor="transparent" className="font-normal cursor-pointer">Transparent Background</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-3">
            <Label>Export Area</Label>
            <RadioGroup value={useSelection ? 'selection' : 'full'} onValueChange={(value) => setUseSelection(value === 'selection')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="font-normal cursor-pointer">Full Diagram</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="selection" id="selection" />
                <Label htmlFor="selection" className="font-normal cursor-pointer">Selected Region (drag to select area)</Label>
              </div>
            </RadioGroup>
            {useSelection && (
              <div className="ml-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  After clicking Export, drag on the canvas to select the area you want to export.
                </p>
                {selectionCoordinates?.start && selectionCoordinates?.end && (
                  <div className="text-sm font-mono bg-muted/50 p-2 rounded border">
                    <div className="font-semibold mb-1">Selection Coordinates:</div>
                    <div>Start: ({Math.round(selectionCoordinates.start.x)}, {Math.round(selectionCoordinates.start.y)})</div>
                    <div>End: ({Math.round(selectionCoordinates.end.x)}, {Math.round(selectionCoordinates.end.y)})</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Width: {Math.round(Math.abs(selectionCoordinates.end.x - selectionCoordinates.start.x))}px, 
                      Height: {Math.round(Math.abs(selectionCoordinates.end.y - selectionCoordinates.start.y))}px
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

