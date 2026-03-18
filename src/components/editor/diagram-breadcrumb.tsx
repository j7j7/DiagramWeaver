"use client";

import React, { useState, useRef, useCallback } from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbSegment {
  diagramId: string | null;
  fromNodeId?: string;
  fromNodeLabel?: string;
}

interface DiagramBreadcrumbProps {
  segments: BreadcrumbSegment[];
  rootLabel?: string;
  onNavigate: (index: number) => void;
  onSegmentRename?: (segmentIndex: number, newLabel: string) => void;
  isReadOnly?: boolean;
  className?: string;
}

export function DiagramBreadcrumb({
  segments,
  rootLabel = "Main Diagram",
  onNavigate,
  onSegmentRename,
  isReadOnly = false,
  className,
}: DiagramBreadcrumbProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingNavigateRef = useRef<{ index: number; timer: ReturnType<typeof setTimeout> } | null>(null);

  const canRename = Boolean(onSegmentRename) && !isReadOnly;

  const handleSegmentClick = useCallback(
    (i: number, isClickable: boolean) => {
      const seg = segments[i];
      const canEditThis = canRename && seg?.diagramId !== null;

      if (pendingNavigateRef.current) {
        clearTimeout(pendingNavigateRef.current.timer);
        pendingNavigateRef.current = null;
        if (canEditThis) {
          setEditingIndex(i);
          setEditValue(seg?.fromNodeLabel || "Sub-diagram");
          setTimeout(() => inputRef.current?.select(), 0);
        }
        return;
      }
      if (canEditThis) {
        pendingNavigateRef.current = {
          index: i,
          timer: setTimeout(() => {
            if (isClickable) onNavigate(i);
            pendingNavigateRef.current = null;
          }, 250),
        };
      } else if (isClickable) {
        onNavigate(i);
      }
    },
    [onNavigate, canRename, segments]
  );

  const commitRename = useCallback(() => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (trimmed && onSegmentRename) {
      onSegmentRename(editingIndex, trimmed);
    }
    setEditingIndex(null);
  }, [editingIndex, editValue, onSegmentRename]);

  if (!segments.length) return null;

  return (
    <nav
      className={cn(
        "flex items-center gap-1 px-3 py-1.5 text-sm bg-muted/50 border-b border-border",
        className
      )}
      aria-label="Diagram navigation"
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const label = seg.diagramId === null ? rootLabel : (seg.fromNodeLabel || "Sub-diagram");
        const isClickable = !isLast;
        const isEditing = editingIndex === i;

        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setEditingIndex(null);
                    setEditValue(label);
                  }
                }}
                className="min-w-[80px] max-w-[180px] rounded border border-input bg-background px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => handleSegmentClick(i, isClickable)}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
                  isClickable
                    ? "text-foreground hover:bg-muted hover:text-foreground"
                    : "text-muted-foreground cursor-default",
                  i === 0 && "font-medium",
                  canRename && seg.diagramId !== null && "cursor-pointer"
                )}
                title={
                  canRename && seg.diagramId !== null
                    ? "Double-click to rename"
                    : isClickable
                      ? `Go to ${label}`
                      : undefined
                }
              >
                {i === 0 ? (
                  <Home className="h-4 w-4 shrink-0" />
                ) : null}
                <span className="truncate max-w-[180px]">{label}</span>
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
