"use client";

import React, { useState, useEffect } from 'react';
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
import { Copy, Check, ExternalLink } from 'lucide-react';
import type { DiagramData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ViewerUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramData: DiagramData;
}

export function ViewerUrlDialog({ open, onOpenChange, diagramData }: ViewerUrlDialogProps) {
  const [viewerUrl, setViewerUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && diagramData) {
      // Use flat format to preserve subDiagrams, subDiagramId, and all nested diagram data
      const jsonString = JSON.stringify(diagramData);
      
      // Encode to base64
      const base64Json = btoa(jsonString);
      
      // Get current origin
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      
      // Create viewer URL
      const url = `${origin}/viewer/?json=${encodeURIComponent(base64Json)}`;
      setViewerUrl(url);
    }
  }, [open, diagramData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(viewerUrl);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Viewer URL copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Failed to copy URL to clipboard',
      });
    }
  };

  const handleOpenViewer = () => {
    window.open(viewerUrl, '_blank');
  };

  const jsonSize = diagramData ? JSON.stringify(diagramData).length : 0;
  const base64Size = viewerUrl.length;
  const isLarge = base64Size > 2000; // Warn if URL is getting long
  
  // Truncate URL for display (show first 100 characters + ...)
  const MAX_DISPLAY_LENGTH = 100;
  const displayUrl = viewerUrl.length > MAX_DISPLAY_LENGTH 
    ? `${viewerUrl.substring(0, MAX_DISPLAY_LENGTH)}...` 
    : viewerUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Copy Viewer URL</DialogTitle>
          <DialogDescription>
            Share this URL to embed your diagram in an iframe or open it in the viewer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="viewer-url">Viewer URL</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="viewer-url"
                  value={displayUrl}
                  readOnly
                  className="font-mono text-sm pr-10"
                  title={viewerUrl.length > MAX_DISPLAY_LENGTH ? `Full URL (${base64Size.toLocaleString()} chars): ${viewerUrl}` : viewerUrl}
                />
                {viewerUrl.length > MAX_DISPLAY_LENGTH && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {base64Size.toLocaleString()} chars
                  </div>
                )}
              </div>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="icon"
                title="Copy full URL to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={handleOpenViewer}
                variant="outline"
                size="icon"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            {viewerUrl.length > MAX_DISPLAY_LENGTH && (
              <p className="text-xs text-muted-foreground">
                URL truncated for display. Click copy to get the full URL ({base64Size.toLocaleString()} characters).
              </p>
            )}
          </div>

          {isLarge && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> This URL is quite long ({base64Size.toLocaleString()} characters). 
                Some browsers may have issues with URLs this long. Consider using the remote URL option instead.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Usage Example</Label>
            <div className="bg-muted rounded-md p-3 font-mono text-xs overflow-x-auto">
              <div className="text-muted-foreground mb-2">HTML iframe:</div>
              <div className="whitespace-pre-wrap">
{`<iframe 
  src="${viewerUrl.length > MAX_DISPLAY_LENGTH ? displayUrl + '...' : viewerUrl}"
  width="100%" 
  height="600"
  frameborder="0"
></iframe>`}
              </div>
              {viewerUrl.length > MAX_DISPLAY_LENGTH && (
                <div className="text-muted-foreground mt-2 text-xs">
                  Note: Copy the full URL above (not the truncated version shown here)
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>• JSON size: {jsonSize.toLocaleString()} bytes</p>
            <p>• Base64 URL size: {base64Size.toLocaleString()} characters</p>
            <p>• For larger diagrams, consider hosting the JSON file and using the <code>?url=</code> parameter</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
