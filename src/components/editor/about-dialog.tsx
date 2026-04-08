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
import { APP_BUILD, APP_SEMVER } from '@/lib/app-version';

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
          <DialogTitle className="text-amber-950 dark:text-amber-50">About DiagramWeaver</DialogTitle>
          <DialogDescription className="text-amber-900/85 dark:text-amber-100/85">
            DiagramWeaver by Jason Severn
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-amber-950/95 dark:text-amber-50/95">
            DiagramWeaver is a simple, interactive diagram creation tool. Use it to present or convey information
            cleanly and tell a story.
          </p>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900/90 dark:text-amber-200/90">
              Privacy
            </h4>
            <div className="space-y-2 border-b border-amber-200/80 pb-3 text-sm text-amber-900/90 dark:border-amber-800/80 dark:text-amber-100/90">
              <p>
                • Your diagrams stay on your device: the app keeps working state in the browser (localStorage) and
                saves exports only where you choose on your computer.
              </p>
              <p>
                • DiagramWeaver does <strong className="font-semibold text-amber-950 dark:text-amber-50">not</strong>{' '}
                upload your diagram content to its own servers or other cloud services.
              </p>
            </div>
          </div>

          <div className="text-xs text-amber-800/90 dark:text-amber-200/85">
            <p>
              Version {APP_SEMVER}
              <span className="text-amber-800/75 dark:text-amber-200/70"> · build {APP_BUILD}</span>
            </p>
            {isDev && <p className="text-amber-800/75 dark:text-amber-200/70">Development session</p>}
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
