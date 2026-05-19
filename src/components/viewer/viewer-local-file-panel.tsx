"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { parseImportJsonText } from "@/lib/import-json-limits";
import { viewerDataFromUnknownJson, type ViewerData } from "@/lib/viewer-utils";

export interface ViewerLocalFilePanelProps {
  onLoaded: (data: ViewerData) => void;
  onError: (message: string) => void;
  errorMessage?: string | null;
  className?: string;
}

export function ViewerLocalFilePanel({ onLoaded, onError, errorMessage, className }: ViewerLocalFilePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result;
          if (typeof text !== "string") {
            onError("Could not read file contents.");
            return;
          }
          onLoaded(viewerDataFromUnknownJson(parseImportJsonText(text)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Invalid JSON or diagram format.";
          onError(msg);
        }
      };
      reader.onerror = () => onError("Failed to read file.");
      reader.readAsText(file);
    },
    [onLoaded, onError]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className={cn("flex min-h-screen w-full items-center justify-center bg-background p-6", className)}>
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <Upload className="h-5 w-5" />
            Open diagram JSON
          </CardTitle>
          <CardDescription>
            Browsers cannot read paths from your disk via the address bar. Choose a <span className="font-medium">.json</span>{" "}
            export from DiagramWeaver, or drop it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleInputChange}
          />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
            }}
            onDrop={onDrop}
            className={cn(
              "flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onClick={() => inputRef.current?.click()}
          >
            <p className="text-sm text-muted-foreground">Drag & drop a JSON file</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
          </div>
          <Button type="button" className="w-full" onClick={() => inputRef.current?.click()}>
            Choose file…
          </Button>
          {errorMessage ? (
            <p className="text-center text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
