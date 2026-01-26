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
import packageJson from '../../../package.json';

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>About Diagram Weaver</DialogTitle>
          <DialogDescription>
            Diagram Weaver by Jason Severn
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm">
            An interactive diagram creation tool that allows you to create diagrams from JSON configurations or natural language descriptions.
          </p>
          
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Privacy & Security</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                • Diagram JSON files and diagram state are stored locally in your browser (localStorage) and when exported are saved directly to your device.
              </p>
              <p>
                • Diagram content is <strong>not uploaded</strong> to cloud services by Diagram Weaver.
              </p>
              <p>
                • Optional AI features may connect to a locally-running Ollama endpoint (default: http://localhost:11434).
              </p>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Version: {packageJson.version}</p>
              {isDev && <p>Build: dev</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
