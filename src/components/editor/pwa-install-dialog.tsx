'use client';

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
import {
  isIosSafariInstallHint,
  isMacSafariInstallHint,
  isPwaSecureContext,
} from '@/lib/pwa';

interface PwaInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canNativeInstall: boolean;
}

export function PwaInstallDialog({
  open,
  onOpenChange,
  canNativeInstall,
}: PwaInstallDialogProps) {
  const secure = isPwaSecureContext();
  const ios = isIosSafariInstallHint();
  const macSafari = isMacSafariInstallHint();

  let body: React.ReactNode;

  if (!secure) {
    body = (
      <p className="text-sm text-muted-foreground">
        Install requires a secure connection (HTTPS). Open Diagram Weaver over HTTPS, or use{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost</code> while developing.
      </p>
    );
  } else if (ios) {
    body = (
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Tap the Share button in Safari.</li>
        <li>Choose <strong className="text-foreground">Add to Home Screen</strong>.</li>
        <li>Confirm the name and tap Add.</li>
      </ol>
    );
  } else if (macSafari) {
    body = (
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>In Safari, open the <strong className="text-foreground">File</strong> menu.</li>
        <li>Choose <strong className="text-foreground">Add to Dock…</strong> (or Share → Add to Dock).</li>
      </ol>
    );
  } else if (canNativeInstall) {
    body = (
      <p className="text-sm text-muted-foreground">
        Your browser is ready to install. Close this dialog and choose <strong className="text-foreground">Install app…</strong> again to confirm.
      </p>
    );
  } else {
    body = (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Use <strong className="text-foreground">Install app…</strong> again when your browser shows an install prompt
          (Chrome, Edge, and most Chromium browsers after the page loads).
        </p>
        <p>
          You can also use the browser menu: <strong className="text-foreground">Install Diagram Weaver</strong> or{' '}
          <strong className="text-foreground">Install app</strong>.
        </p>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install Diagram Weaver</DialogTitle>
          <DialogDescription>
            Add Diagram Weaver to your device for a standalone app window.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">{body}</div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
