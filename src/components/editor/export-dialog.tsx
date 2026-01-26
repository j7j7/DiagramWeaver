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
  onExport: (options: { backgroundColor: 'transparent' | 'white'; quality: 'low' | 'medium' | 'high' }) => Promise<void>;
}

export function ExportDialog({ open, onOpenChange, onExport }: ExportDialogProps) {
  const [backgroundColor, setBackgroundColor] = useState<'transparent' | 'white'>('white');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport({ backgroundColor, quality });
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
          <DialogTitle>Export PNG</DialogTitle>
          <DialogDescription>
            Export the current viewport as a PNG image
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

