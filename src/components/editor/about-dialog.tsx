"use client";
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import packageJson from '../../../package.json';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-lg border-2 border-amber-400 bg-amber-50 text-amber-950 shadow-xl',
          'dark:border-amber-500 dark:bg-amber-950/95 dark:text-amber-50',
          '[&>button]:text-amber-800 dark:[&>button]:text-amber-200 [&>button]:hover:text-amber-950 dark:[&>button]:hover:text-amber-50'
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-amber-950 dark:text-amber-50">About Diagram Weaver</DialogTitle>
          <DialogDescription className="text-amber-900/85 dark:text-amber-100/85">
            Diagram Weaver by Jason Severn
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-amber-950/95 dark:text-amber-50/95">
            An interactive diagram creation tool that allows you to create diagrams from JSON configurations.
          </p>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/90 dark:text-amber-200/90">
              Privacy & Security
            </h4>
            <div className="space-y-2 border-b border-amber-200/80 pb-3 text-sm text-amber-900/90 dark:border-amber-800/80 dark:text-amber-100/90">
              <p>
                • Diagram JSON files and diagram state are stored locally in your browser (localStorage) and when exported are saved directly to your device.
              </p>
              <p>
                • Diagram content is <strong className="font-semibold text-amber-950 dark:text-amber-50">not uploaded</strong> to cloud services by Diagram Weaver.
              </p>
            </div>
          </div>

          <div className="text-xs text-amber-800/90 dark:text-amber-200/85">
            <p>Version: {packageJson.version}</p>
            {isDev && <p>Build: dev</p>}
          </div>
        </div>

        <DialogFooter className="border-t border-amber-200/90 pt-2 dark:border-amber-800/90">
          <Button
            type="button"
            variant="outline"
            className="border-amber-400 bg-amber-100/80 text-amber-950 hover:bg-amber-200/90 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-50 dark:hover:bg-amber-800/80"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
