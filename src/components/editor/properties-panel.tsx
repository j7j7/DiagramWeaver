"use client";

import React, { useState, useCallback, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { normalizeExternalUrl, openExternalUrlInNewTab } from "@/lib/url-utils";
import { BUILTIN_GLOBAL_VARIABLE_NAMES } from "@/lib/builtin-global-variables";
import { GRID_CELL_FILL_GLOBAL_PROPERTY } from "@/lib/global-properties";
import { normalizeGlobalPropertyKey, collectUsedGlobalVariableNames } from "@/lib/global-properties";
import { CustomIconPreviewEditor } from "@/components/editor/custom-icon-preview-editor";
import { DEFAULT_CUSTOM_IMAGE_OPTIONS, normalizeCustomImageOptions, normalizeHttpImageUrl, validateCustomImageUrl } from "@/lib/custom-icon-utils";
import type { SelectedItem } from "../diagram-editor";
import type { CustomImageOptions, DiagramData } from "@/lib/types";

const BUILTIN_GLOBAL_VARIABLE_REFERENCES: ReadonlyArray<{ name: string; description: string }> = [
  { name: "day", description: "Weekday name (e.g. Monday)" },
  { name: "shortday", description: "Short weekday (e.g. mon)" },
  { name: "dd", description: "Day of month, padded (e.g. 04)" },
  { name: "mm", description: "Month number 1–12, padded (e.g. 06)" },
  { name: "month", description: "Month name (e.g. June)" },
  { name: "yy", description: "Two-digit year (e.g. 06)" },
  { name: "yyyy", description: "Four-digit year (e.g. 2026)" },
  { name: "slide", description: "Current slide number (1-based)" },
  { name: "slides", description: "Total slides in deck" },
];

const BUILTIN_EXPRESSION_HINTS: ReadonlyArray<string> = [
  "Math needs parentheses: (%dd% - 1), (%slide% + 1), (%dd%/2) — / divides only inside (...).",
  "Date-style join uses slashes between variables: %dd%/%mm%/%yyyy% → 04/06/2026 (not division).",
  "Without parentheses, operators stay literal after substitution: %dd% - 1 → 04 - 1.",
];

const DIAGRAM_GLOBAL_PROPERTY_HINTS: ReadonlyArray<{ name: string; description: string }> = [
  {
    name: GRID_CELL_FILL_GLOBAL_PROPERTY,
    description:
      "Grid chart filled-cell background (CSS color, e.g. #22c55e). Not a %variable%; used when Paint on canvas is Default.",
  },
];

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
  /** Narrower collapsed strip (e.g. viewer overlay rail); icon-only, no side label. */
  narrowCollapsed?: boolean;
  onGlobalPropertiesChange?: (globalProperties: Record<string, string>) => void;
}

const HIDDEN_METADATA_PREFIXES = ["simulation:"];

function isVisibleMetadataKey(key: string): boolean {
  return !HIDDEN_METADATA_PREFIXES.some((prefix) => key.startsWith(prefix));
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
  return Array.from(keys).filter(isVisibleMetadataKey).sort();
}

export function PropertiesPanel({
  selectedItem,
  diagramData,
  onItemUpdate,
  onConnectionUpdate,
  collapsed = false,
  onToggleCollapse,
  isReadOnly = false,
  narrowCollapsed = false,
  onGlobalPropertiesChange,
}: PropertiesPanelProps) {
  const { toast } = useToast();
  const usedMetadataKeys = useMemo(
    () => getUsedMetadataKeys(diagramData),
    [diagramData]
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ key: string; value: string } | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<{ key: string; value: string }>(
    { key: "", value: "" }
  );
  const [customIconUrlDraft, setCustomIconUrlDraft] = useState("");
  const [customIconError, setCustomIconError] = useState<string | null>(null);
  const [customIconLoading, setCustomIconLoading] = useState(false);
  const [editingGlobalKey, setEditingGlobalKey] = useState<string | null>(null);
  const [editingGlobalDraft, setEditingGlobalDraft] = useState<{ key: string; value: string } | null>(null);
  const [newGlobalKeyValue, setNewGlobalKeyValue] = useState<{ key: string; value: string }>({
    key: "",
    value: "",
  });

  const globalProperties = diagramData?.globalProperties ?? {};
  const usedGlobalVariableNames = useMemo(
    () => collectUsedGlobalVariableNames(diagramData),
    [diagramData],
  );

  const metaData =
    selectedItem && "metaData" in selectedItem
      ? (selectedItem.metaData ?? {})
      : undefined;
  const visibleMetaData = useMemo(() => {
    if (!metaData) return undefined;
    return Object.fromEntries(
      Object.entries(metaData).filter(([key]) => isVisibleMetadataKey(key))
    );
  }, [metaData]);

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

  const isNode = selectedItem?.itemType === "node";
  const isCustomIconNode = isNode && (selectedItem as (SelectedItem & { type?: string }) | null)?.type === "generic.icon.custom";
  const linkUrl = isNode ? ((selectedItem as SelectedItem & { linkUrl?: string }).linkUrl ?? "") : "";
  const normalizedLinkUrl = useMemo(() => normalizeExternalUrl(linkUrl), [linkUrl]);
  const customIconImageUrl = isCustomIconNode ? ((selectedItem as SelectedItem & { imageUrl?: string }).imageUrl ?? "") : "";
  const customIconOptions = useMemo(
    () => normalizeCustomImageOptions(isCustomIconNode ? ((selectedItem as SelectedItem & { imageOptions?: Partial<CustomImageOptions> }).imageOptions ?? DEFAULT_CUSTOM_IMAGE_OPTIONS) : DEFAULT_CUSTOM_IMAGE_OPTIONS),
    [isCustomIconNode, selectedItem]
  );

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

  const handleGlobalPropertiesChange = useCallback(
    (next: Record<string, string>) => {
      if (isReadOnly || !onGlobalPropertiesChange) return;
      onGlobalPropertiesChange(next);
    },
    [isReadOnly, onGlobalPropertiesChange],
  );

  const handleAddGlobalProperty = useCallback(() => {
    const normalizedKey = normalizeGlobalPropertyKey(newGlobalKeyValue.key);
    if (!normalizedKey) {
      toast({
        title: "Invalid variable name",
        description: "Use letters, numbers, and underscores only (e.g. name, company_name).",
        variant: "destructive",
      });
      return;
    }
    if (globalProperties[normalizedKey] !== undefined) {
      toast({
        title: "Variable already exists",
        description: `%${normalizedKey}% is already defined.`,
        variant: "destructive",
      });
      return;
    }
    handleGlobalPropertiesChange({
      ...globalProperties,
      [normalizedKey]: newGlobalKeyValue.value,
    });
    setNewGlobalKeyValue({ key: "", value: "" });
    setEditingGlobalKey(null);
  }, [newGlobalKeyValue, globalProperties, handleGlobalPropertiesChange, toast]);

  const handleUpdateGlobalProperty = useCallback(
    (oldKey: string, newKey: string, newValue: string) => {
      const normalizedKey = normalizeGlobalPropertyKey(newKey);
      if (!normalizedKey) {
        toast({
          title: "Invalid variable name",
          description: "Use letters, numbers, and underscores only.",
          variant: "destructive",
        });
        return;
      }
      const next = { ...globalProperties };
      delete next[oldKey];
      if (normalizedKey !== oldKey && next[normalizedKey] !== undefined) {
        toast({
          title: "Variable already exists",
          description: `%${normalizedKey}% is already defined.`,
          variant: "destructive",
        });
        return;
      }
      next[normalizedKey] = newValue;
      handleGlobalPropertiesChange(next);
      setEditingGlobalKey(null);
      setEditingGlobalDraft(null);
    },
    [globalProperties, handleGlobalPropertiesChange, toast],
  );

  const handleStartGlobalEdit = useCallback(
    (key: string) => {
      setEditingGlobalKey(key);
      setEditingGlobalDraft({ key, value: globalProperties[key] ?? "" });
    },
    [globalProperties],
  );

  const handleRemoveGlobalProperty = useCallback(
    (key: string) => {
      const next = { ...globalProperties };
      delete next[key];
      handleGlobalPropertiesChange(next);
      setEditingGlobalKey(null);
      setEditingGlobalDraft(null);
    },
    [globalProperties, handleGlobalPropertiesChange],
  );

  const handleLinkChange = useCallback(
    (nextLinkUrl: string) => {
      if (!selectedItem || selectedItem.itemType !== "node" || isReadOnly) return;
      onItemUpdate({ ...selectedItem, linkUrl: nextLinkUrl });
    },
    [selectedItem, onItemUpdate, isReadOnly]
  );

  const handleOpenLink = useCallback(() => {
    if (!normalizedLinkUrl) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: "Enter a valid http(s) URL.",
      });
      return;
    }

    openExternalUrlInNewTab(normalizedLinkUrl);
  }, [normalizedLinkUrl, toast]);

  const updateCustomIconNode = useCallback(
    (patch: Partial<{ imageUrl: string; imageOptions: CustomImageOptions }>) => {
      if (!selectedItem || selectedItem.itemType !== "node" || isReadOnly) return;
      onItemUpdate({
        ...selectedItem,
        type: "generic.icon.custom",
        imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : ((selectedItem as SelectedItem & { imageUrl?: string }).imageUrl || ""),
        imageOptions: patch.imageOptions !== undefined ? patch.imageOptions : customIconOptions,
      });
    },
    [selectedItem, onItemUpdate, isReadOnly, customIconOptions]
  );

  const loadCustomIconUrl = useCallback(async () => {
    if (isReadOnly) return;
    setCustomIconLoading(true);
    setCustomIconError(null);

    const normalized = normalizeHttpImageUrl(customIconUrlDraft);
    if (!normalized) {
      setCustomIconError("Enter a valid image URL (http/https or data:image/...).");
      updateCustomIconNode({ imageUrl: "" });
      setCustomIconLoading(false);
      return;
    }

    const result = await validateCustomImageUrl(normalized, { force: true });
    if (!result.ok) {
      setCustomIconError(result.error || "Unable to load image preview.");
      updateCustomIconNode({ imageUrl: "" });
      setCustomIconLoading(false);
      return;
    }

    updateCustomIconNode({
      imageUrl: result.normalizedUrl || normalized,
      imageOptions: normalizeCustomImageOptions(DEFAULT_CUSTOM_IMAGE_OPTIONS),
    });
    setCustomIconLoading(false);
  }, [customIconUrlDraft, isReadOnly, updateCustomIconNode]);

  React.useEffect(() => {
    setEditingKey(null);
    setEditingDraft(null);
    setNewKeyValue({ key: "", value: "" });
    setCustomIconError(null);
  }, [selectedItem?.id]);

  React.useEffect(() => {
    if (selectedItem) {
      setEditingGlobalKey(null);
      setEditingGlobalDraft(null);
      setNewGlobalKeyValue({ key: "", value: "" });
    }
  }, [selectedItem?.id]);

  React.useEffect(() => {
    if (!isCustomIconNode) {
      setCustomIconUrlDraft("");
      return;
    }
    setCustomIconUrlDraft(customIconImageUrl);
  }, [isCustomIconNode, customIconImageUrl]);

  if (collapsed) {
    if (narrowCollapsed) {
      return (
        <aside
          className={cn(
            "flex flex-col flex-shrink-0 border-l bg-card",
            "w-7"
          )}
        >
          <div className="flex flex-1 flex-col items-center gap-1 p-1">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-md p-1 hover:bg-muted touch-target"
              aria-label="Expand properties panel"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </aside>
      );
    }
    return (
      <aside
        className={cn(
          "flex flex-col bg-card border-l flex-shrink-0",
          "w-12"
        )}
      >
        <div className="flex flex-col items-center p-2 gap-2 flex-1">
          <button
            type="button"
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
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Define diagram variables and use them in any text as{" "}
                  <span className="font-mono text-foreground">%name%</span>. Use{" "}
                  <span className="font-mono text-foreground">(%dd% - 1)</span> for math,{" "}
                  <span className="font-mono text-foreground">%dd%/%mm%/%yyyy%</span> for
                  dates — see built-in list below.
                </p>
              </div>

              <Collapsible className="group rounded-md border bg-muted/30">
                <CollapsibleTrigger
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90"
                    aria-hidden
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    Built-in variables
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {BUILTIN_GLOBAL_VARIABLE_NAMES.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden border-t border-border/70">
                  <div className="space-y-1 border-b border-border/70 px-2 py-2 text-[10px] text-muted-foreground">
                    {BUILTIN_EXPRESSION_HINTS.map((hint) => (
                      <p key={hint}>{hint}</p>
                    ))}
                  </div>
                  <ul className="max-h-48 space-y-0 overflow-y-auto p-1">
                    {BUILTIN_GLOBAL_VARIABLE_REFERENCES.map(({ name, description }) => (
                      <li
                        key={name}
                        className="rounded-sm px-2 py-1.5 text-[11px] hover:bg-muted/60"
                      >
                        <div className="font-mono text-xs text-foreground">%{name}%</div>
                        <div className="text-muted-foreground">{description}</div>
                      </li>
                    ))}
                  </ul>
                  {DIAGRAM_GLOBAL_PROPERTY_HINTS.length > 0 ? (
                    <div className="border-t border-border/70 px-2 py-2">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                        Grid chart properties
                      </p>
                      <ul className="space-y-0">
                        {DIAGRAM_GLOBAL_PROPERTY_HINTS.map(({ name, description }) => (
                          <li
                            key={name}
                            className="rounded-sm px-2 py-1.5 text-[11px] hover:bg-muted/60"
                          >
                            <div className="font-mono text-xs text-foreground">{name}</div>
                            <div className="text-muted-foreground">{description}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Global variables</Label>
                  {!isReadOnly && onGlobalPropertiesChange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setEditingGlobalKey("__new__")}
                      aria-label="Add global variable"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <datalist id="global-variable-name-suggestions">
                    {usedGlobalVariableNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>

                  {editingGlobalKey === "__new__" && !isReadOnly && onGlobalPropertiesChange && (
                    <div className="flex gap-2 items-end p-2 rounded-md bg-muted/50">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="name"
                          value={newGlobalKeyValue.key}
                          onChange={(e) =>
                            setNewGlobalKeyValue((p) => ({ ...p, key: e.target.value }))
                          }
                          className="h-8 text-sm font-mono"
                          list="global-variable-name-suggestions"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddGlobalProperty();
                            if (e.key === "Escape") setEditingGlobalKey(null);
                          }}
                        />
                        <Input
                          placeholder="Joe Bloggs"
                          value={newGlobalKeyValue.value}
                          onChange={(e) =>
                            setNewGlobalKeyValue((p) => ({ ...p, value: e.target.value }))
                          }
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddGlobalProperty();
                            if (e.key === "Escape") setEditingGlobalKey(null);
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditingGlobalKey(null)}
                        aria-label="Cancel add"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={handleAddGlobalProperty}
                        disabled={!newGlobalKeyValue.key.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  )}

                  {Object.entries(globalProperties).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex gap-2 items-start p-2 rounded-md border bg-background"
                    >
                      {editingGlobalKey === key && editingGlobalDraft ? (
                        <div className="flex flex-col gap-3 w-full min-w-0 flex-1 p-3 rounded-md bg-muted/50 border-2 border-border">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-medium text-foreground">Name</Label>
                            <Input
                              value={editingGlobalDraft.key}
                              onChange={(e) =>
                                setEditingGlobalDraft((p) =>
                                  p ? { ...p, key: e.target.value } : null,
                                )
                              }
                              className="h-8 text-sm font-mono"
                              placeholder="Variable name"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleUpdateGlobalProperty(key, editingGlobalDraft.key, editingGlobalDraft.value);
                                }
                                if (e.key === "Escape") {
                                  setEditingGlobalKey(null);
                                  setEditingGlobalDraft(null);
                                }
                              }}
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-medium text-foreground">Value</Label>
                            <Textarea
                              value={editingGlobalDraft.value}
                              onChange={(e) =>
                                setEditingGlobalDraft((p) =>
                                  p ? { ...p, value: e.target.value } : null,
                                )
                              }
                              className="min-h-[2.5rem] py-1.5 text-sm w-full min-w-0 border-border bg-background resize-y"
                              placeholder="Value"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleUpdateGlobalProperty(key, editingGlobalDraft.key, editingGlobalDraft.value);
                                }
                                if (e.key === "Escape") {
                                  setEditingGlobalKey(null);
                                  setEditingGlobalDraft(null);
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
                                handleUpdateGlobalProperty(key, editingGlobalDraft.key, editingGlobalDraft.value)
                              }
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-xs font-medium font-mono text-muted-foreground truncate"
                              title={key}
                            >
                              %{key}%
                            </div>
                            <div className="text-sm break-words" title={value}>
                              {value || "—"}
                            </div>
                          </div>
                          {!isReadOnly && onGlobalPropertiesChange && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => handleStartGlobalEdit(key)}
                                aria-label="Edit global variable"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveGlobalProperty(key)}
                                aria-label="Remove global variable"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {Object.keys(globalProperties).length === 0 &&
                    editingGlobalKey !== "__new__" && (
                      <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                        {isReadOnly || !onGlobalPropertiesChange
                          ? "No global variables defined."
                          : "No variables yet. Click + to add one."}
                      </div>
                    )}
                </div>
              </div>
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

              {isNode && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">URL</Label>
                  {!isReadOnly ? (
                    <Input
                      value={linkUrl}
                      onChange={(e) => handleLinkChange(e.target.value)}
                      placeholder="https://example.com"
                      className="h-8 text-sm"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground truncate" title={linkUrl || ""}>
                      {linkUrl || "—"}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {normalizedLinkUrl ? (
                      <Button size="sm" variant="outline" className="h-8" asChild>
                        <a href={normalizedLinkUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open URL
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={handleOpenLink}
                        disabled
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open URL
                      </Button>
                    )}
                    {!isReadOnly && linkUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => handleLinkChange("")}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {isCustomIconNode && (
                <div className="space-y-2 border rounded-md p-3">
                  <Label className="text-xs text-muted-foreground">Custom Icon</Label>
                  {!isReadOnly && (
                    <div className="flex gap-2">
                      <Input
                        value={customIconUrlDraft}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setCustomIconUrlDraft(nextValue);
                          setCustomIconError(null);
                          if (!nextValue.trim()) {
                            updateCustomIconNode({ imageUrl: "" });
                          }
                        }}
                        placeholder="https://example.com/icon"
                        className="h-8 text-sm"
                      />
                      <Button variant="default" size="sm" className="h-8" onClick={loadCustomIconUrl} disabled={customIconLoading}>
                        {customIconLoading ? "Loading..." : "Load"}
                      </Button>
                    </div>
                  )}

                  {!isReadOnly && (
                    <div className="text-xs text-muted-foreground">
                      Direct image links, wrapped links (for example, Google image-result URLs), and data:image/... URLs are supported.
                    </div>
                  )}

                  <CustomIconPreviewEditor
                    imageUrl={customIconImageUrl || undefined}
                    imageOptions={customIconOptions}
                    onOptionsChange={
                      isReadOnly
                        ? undefined
                        : (nextOptions) => updateCustomIconNode({ imageOptions: nextOptions })
                    }
                    size={144}
                    readOnly={isReadOnly}
                  />

                  {customIconError ? (
                    <div className="text-xs text-destructive">{customIconError}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Click Load, then drag to center and use the mouse wheel to zoom. Supports PNG, JPG, SVG, WebP, GIF, AVIF, BMP, APNG, ICO, including data:image/... URLs. Max 500 KB.</div>
                  )}
                </div>
              )}

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
                        variant="default"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={handleAddMetaData}
                        disabled={!newKeyValue.key.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  )}

                  {visibleMetaData &&
                    Object.entries(visibleMetaData).map(([key, value]) => (
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

                  {(!visibleMetaData || Object.keys(visibleMetaData).length === 0) &&
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
