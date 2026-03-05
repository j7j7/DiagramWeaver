"use client";

import React, { useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SelectedItem } from "../diagram-editor";
import type { DiagramData } from "@/lib/types";

interface PropertiesPanelProps {
  selectedItem: SelectedItem | null;
  diagramData?: DiagramData;
  onItemUpdate: (updatedItem: SelectedItem) => void;
  onConnectionUpdate?: (
    from: string,
    to: string,
    updates: { metaData?: Record<string, string> },
    connectionId?: string
  ) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isReadOnly?: boolean;
}

/** Collect all metadata keys used across the diagram for consistent suggestions */
function getUsedMetadataKeys(data: DiagramData | undefined): string[] {
  if (!data) return [];
  const keys = new Set<string>();
  (data.nodes || []).forEach((n) => {
    if (n.metaData) Object.keys(n.metaData).forEach((k) => keys.add(k));
  });
  (data.connections || []).forEach((c) => {
    if (c.metaData) Object.keys(c.metaData).forEach((k) => keys.add(k));
  });
  (data.zones || []).forEach((z) => {
    if (z.metaData) Object.keys(z.metaData).forEach((k) => keys.add(k));
  });
  (data.groupings || []).forEach((g) => {
    if (g.metaData) Object.keys(g.metaData).forEach((k) => keys.add(k));
  });
  return Array.from(keys).sort();
}

export function PropertiesPanel({
  selectedItem,
  diagramData,
  onItemUpdate,
  onConnectionUpdate,
  collapsed = false,
  onToggleCollapse,
  isReadOnly = false,
}: PropertiesPanelProps) {
  const usedMetadataKeys = useMemo(
    () => getUsedMetadataKeys(diagramData),
    [diagramData]
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ key: string; value: string } | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<{ key: string; value: string }>(
    { key: "", value: "" }
  );

  const metaData =
    selectedItem && "metaData" in selectedItem
      ? (selectedItem.metaData ?? {})
      : undefined;

  const displayName =
    selectedItem?.itemType === "node"
      ? (selectedItem.label || selectedItem.id || "Unnamed")
      : selectedItem?.itemType === "edge"
        ? `Connection ${(selectedItem as { from?: string }).from} → ${(selectedItem as { to?: string }).to}`
        : "";

  const displayType =
    selectedItem?.itemType === "node"
      ? (selectedItem.type || "node")
      : selectedItem?.itemType === "edge"
        ? "Connection"
        : "";

  const handleMetaDataChange = useCallback(
    (newMetaData: Record<string, string>) => {
      if (!selectedItem || isReadOnly) return;

      if (selectedItem.itemType === "node") {
        onItemUpdate({ ...selectedItem, metaData: newMetaData });
      } else if (selectedItem.itemType === "edge" && onConnectionUpdate) {
        const edge = selectedItem as { from: string; to: string; id?: string };
        onConnectionUpdate(edge.from, edge.to, { metaData: newMetaData }, edge.id);
      }
    },
    [selectedItem, onItemUpdate, onConnectionUpdate, isReadOnly]
  );

  const handleAddMetaData = useCallback(() => {
    const key = newKeyValue.key.trim();
    const value = newKeyValue.value.trim();
    if (!key || !selectedItem) return;

    const current = metaData ?? {};
    if (current[key] !== undefined) return;

    const next = { ...current, [key]: value };
    handleMetaDataChange(next);
    setNewKeyValue({ key: "", value: "" });
    setEditingKey(null);
  }, [newKeyValue, selectedItem, metaData, handleMetaDataChange]);

  const handleUpdateMetaData = useCallback(
    (oldKey: string, newKey: string, newValue: string) => {
      if (!selectedItem || isReadOnly) return;

      const current = metaData ?? {};
      const next = { ...current };
      delete next[oldKey];
      if (newKey.trim()) {
        next[newKey.trim()] = newValue.trim();
      }
      handleMetaDataChange(next);
      setEditingKey(null);
      setEditingDraft(null);
    },
    [selectedItem, metaData, handleMetaDataChange, isReadOnly]
  );

  const handleStartEdit = useCallback((key: string) => {
    setEditingKey(key);
    setEditingDraft({ key, value: metaData?.[key] ?? "" });
  }, [metaData]);

  const handleRemoveMetaData = useCallback(
    (key: string) => {
      if (!selectedItem || isReadOnly) return;

      const current = metaData ?? {};
      const next = { ...current };
      delete next[key];
      handleMetaDataChange(next);
      setEditingKey(null);
      setEditingDraft(null);
    },
    [selectedItem, metaData, handleMetaDataChange, isReadOnly]
  );

  React.useEffect(() => {
    setEditingKey(null);
    setEditingDraft(null);
    setNewKeyValue({ key: "", value: "" });
  }, [selectedItem?.id]);

  if (collapsed) {
    return (
      <aside
        className={cn(
          "flex flex-col bg-card border-l flex-shrink-0",
          "w-12"
        )}
      >
        <div className="flex flex-col items-center p-2 gap-2 flex-1">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-md hover:bg-muted touch-target"
            aria-label="Expand properties panel"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180 py-2 text-muted-foreground whitespace-nowrap">
            Properties
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-card border-l flex flex-col h-full flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h2 className="font-semibold text-base">Properties</h2>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-md hover:bg-muted -mr-2 touch-target"
            aria-label="Collapse properties panel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {!selectedItem ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Select an item to view and edit its properties.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <div className="text-sm font-medium truncate" title={displayName}>
                  {displayName || "—"}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <div className="text-sm text-muted-foreground truncate">
                  {displayType || "—"}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Metadata
                  </Label>
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setEditingKey("__new__")}
                      aria-label="Add metadata"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <datalist id="metadata-key-suggestions">
                    {usedMetadataKeys.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                  {editingKey === "__new__" && (
                    <div className="flex gap-2 items-end p-2 rounded-md bg-muted/50">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Key (e.g. IP Address)"
                          value={newKeyValue.key}
                          onChange={(e) =>
                            setNewKeyValue((p) => ({ ...p, key: e.target.value }))
                          }
                          className="h-8 text-sm"
                          list="metadata-key-suggestions"
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleAddMetaData();
                            if (e.key === "Escape")
                              setEditingKey(null);
                          }}
                        />
                        <Input
                          placeholder="Value (e.g. 192.168.1.1)"
                          value={newKeyValue.value}
                          onChange={(e) =>
                            setNewKeyValue((p) => ({ ...p, value: e.target.value }))
                          }
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleAddMetaData();
                            if (e.key === "Escape")
                              setEditingKey(null);
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditingKey(null)}
                        aria-label="Cancel add"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={handleAddMetaData}
                        disabled={!newKeyValue.key.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  )}

                  {metaData &&
                    Object.entries(metaData).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex gap-2 items-start p-2 rounded-md border bg-background"
                      >
                        {editingKey === key && editingDraft ? (
                          <div className="flex flex-col gap-3 w-full min-w-0 flex-1 p-3 rounded-md bg-muted/50 border-2 border-border">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-medium text-foreground">Key</Label>
                              <Textarea
                                value={editingDraft.key}
                                onChange={(e) =>
                                  setEditingDraft((p) =>
                                    p ? { ...p, key: e.target.value } : null
                                  )}
                                className="min-h-[2.5rem] py-1.5 text-sm w-full min-w-0 border-border bg-background resize-y"
                                placeholder="Key"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleUpdateMetaData(key, editingDraft.key, editingDraft.value);
                                  }
                                  if (e.key === "Escape") {
                                    setEditingKey(null);
                                    setEditingDraft(null);
                                  }
                                }}
                                autoFocus
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-medium text-foreground">Value</Label>
                              <Textarea
                                value={editingDraft.value}
                                onChange={(e) =>
                                  setEditingDraft((p) =>
                                    p ? { ...p, value: e.target.value } : null
                                  )}
                                className="min-h-[2.5rem] py-1.5 text-sm w-full min-w-0 border-border bg-background resize-y"
                                placeholder="Value"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleUpdateMetaData(key, editingDraft.key, editingDraft.value);
                                  }
                                  if (e.key === "Escape") {
                                    setEditingKey(null);
                                    setEditingDraft(null);
                                  }
                                }}
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8"
                                onClick={() =>
                                  handleUpdateMetaData(key, editingDraft.key, editingDraft.value)
                                }
                              >
                                Done
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-muted-foreground truncate" title={key}>
                                {key}
                              </div>
                              <div className="text-sm break-words" title={value}>
                                {value}
                              </div>
                            </div>
                            {!isReadOnly && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => handleStartEdit(key)}
                                  aria-label="Edit metadata"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                  onClick={() => handleRemoveMetaData(key)}
                                  aria-label="Remove metadata"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}

                  {(!metaData || Object.keys(metaData).length === 0) &&
                    editingKey !== "__new__" && (
                      <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                        No metadata. Click + to add.
                      </div>
                    )}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
