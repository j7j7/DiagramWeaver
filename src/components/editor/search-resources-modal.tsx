"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Box, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "../ui/input";
import { TooltipProvider } from "../ui/tooltip";
import { Button } from "../ui/button";
import { DraggableResourceItem } from "./draggable-resource-item";
import { DraggableIconItem } from "./draggable-icon-item";
import { SYMBOL_ICON_SECTIONS, EMOJI_ICONS } from "@/lib/icon-resources";

interface ResourceItem {
  name: string;
  file?: string;
  type?: string;
  hasWhiteVariant?: boolean;
  format?: string;
  iconType?: string;
  iconName?: string;
  emoji?: string;
}

interface FlatResource {
  resource: ResourceItem;
  provider: string;
  category: string;
  providerName: string;
}

import type { IconResourceItem } from "@/lib/icon-resources";

interface ResourceIndex {
  providers: Record<string, { name: string; file: string; enabled: boolean }>;
}

interface SearchResourcesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: { x: number; y: number };
  onResourceActivate: (
    resource: ResourceItem | IconResourceItem,
    provider: string,
    category: string,
    fullItem?: object
  ) => void;
}

export function SearchResourcesModal({
  open,
  onOpenChange,
  position,
  onResourceActivate,
}: SearchResourcesModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [fullProviders, setFullProviders] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const loadAll = async () => {
      setIsLoading(true);
      try {
        const indexRes = await fetch("/resources/resource-components.json", { cache: "no-cache" });
        const indexJson: ResourceIndex = await indexRes.json();
        const entries = Object.entries(indexJson.providers).filter(([, p]) => p.enabled);
        const providerPairs = await Promise.all(
          entries.map(async ([key, provider]) => {
            try {
              const res = await fetch(`/resources/${provider.file}`, { cache: "no-cache" });
              const data = await res.json();
              return [key, data] as const;
            } catch {
              return null;
            }
          })
        );
        const providers: Record<string, any> = {};
        for (const pair of providerPairs) {
          if (pair) providers[pair[0]] = pair[1];
        }
        setFullProviders(providers);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setSearchTerm("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const flatResources = useMemo((): FlatResource[] => {
    const out: FlatResource[] = [];
    Object.entries(fullProviders).forEach(([providerKey, provider]) => {
      if (!provider?.categories) return;
      const providerName = provider.name || providerKey;
      Object.entries(provider.categories).forEach(([categoryKey, category]: [string, any]) => {
        const resources = category?.resources ?? [];
        resources.forEach((r: ResourceItem) => {
          out.push({ resource: r, provider: providerKey, category: categoryKey, providerName });
        });
      });
    });
    return out;
  }, [fullProviders]);

  const flatIcons = useMemo((): IconResourceItem[] => {
    const out: IconResourceItem[] = [];
    Object.values(SYMBOL_ICON_SECTIONS).forEach((icons) => icons.forEach((i) => out.push(i)));
    EMOJI_ICONS.forEach((i) => out.push(i));
    return out;
  }, []);

  const term = (searchTerm ?? "").trim().toLowerCase();
  const tokens = useMemo(() => term.split(/\s+/).filter(Boolean), [term]);

  /** Each search token must match at least one of: provider (key or name), category, or resource name.
   *  E.g. "aws storage" → matches AWS provider + storage category; "azure database" → Azure DB resources */
  const matchesTokens = useCallback(
    (providerKey: string, providerName: string, category: string, resourceName: string) => {
      if (tokens.length === 0) return false;
      const pk = providerKey.toLowerCase();
      const pn = providerName.toLowerCase();
      const c = category.toLowerCase();
      const r = resourceName.toLowerCase();
      return tokens.every((t) => pk.includes(t) || pn.includes(t) || c.includes(t) || r.includes(t));
    },
    [tokens]
  );

  const filteredResources = useMemo(() => {
    if (!term) return [];
    return flatResources.filter((f) =>
      matchesTokens(f.provider, f.providerName, f.category, f.resource.name)
    );
  }, [flatResources, term, matchesTokens]);

  const filteredIcons = useMemo(() => {
    if (!term) return [];
    return flatIcons.filter((i) =>
      matchesTokens("generic", "generic", "icon", i.name)
    );
  }, [flatIcons, term, matchesTokens]);

  const ITEMS_PER_PAGE = 40;
  const [page, setPage] = useState(0);
  const totalItems = filteredResources.length + filteredIcons.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

  useEffect(() => {
    setPage(0);
  }, [term]);

  /** Order: shapes first (generic.object), then icons, then rest */
  const paginatedResources = useMemo(() => {
    const shapes = filteredResources.filter((f) => f.provider === "generic" && f.category === "object");
    const rest = filteredResources.filter((f) => !(f.provider === "generic" && f.category === "object"));
    const icons = filteredIcons.map((i) => ({ _icon: i }));
    const all = [...shapes, ...icons, ...rest];
    const start = page * ITEMS_PER_PAGE;
    return all.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredResources, filteredIcons, page]);

  const handleResourceClick = useCallback(
    (resource: ResourceItem, provider: string, category: string) => {
      onResourceActivate(resource, provider, category);
      onOpenChange(false);
    },
    [onResourceActivate, onOpenChange]
  );

  const handleIconClick = useCallback(
    (dragItem: { type: string; label: string; provider: string; category: string; iconType?: string; iconName?: string; emoji?: string }) => {
      onResourceActivate(
        { name: dragItem.label, iconType: dragItem.iconType, iconName: dragItem.iconName, emoji: dragItem.emoji } as ResourceItem,
        "generic",
        dragItem.category,
        dragItem
      );
      onOpenChange(false);
    },
    [onResourceActivate, onOpenChange]
  );

  if (!open) return null;

  const menuWidth = 340;
  const menuHeight = 420;
  const padding = 12;
  let left = position.x + 8;
  let top = position.y + 8;
  if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding;
  if (left < padding) left = padding;
  if (top + menuHeight > window.innerHeight - padding) top = window.innerHeight - menuHeight - padding;
  if (top < padding) top = padding;

  return (
    <>
      <div
        className="fixed inset-0 z-[100]"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="fixed z-[101] flex flex-col rounded-xl border bg-card shadow-2xl backdrop-blur-sm"
        style={{
          left,
          top,
          width: menuWidth,
          maxHeight: menuHeight,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <TooltipProvider>
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 border-0 bg-muted/50 focus-visible:ring-1"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden p-2 overscroll-contain"
          style={{ height: 320, minHeight: 320 }}
        >
          {isLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : totalItems === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              {term ? "No resources found." : "Type to search."}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-1.5 p-1">
              {paginatedResources.map((item, idx) =>
                "_icon" in item ? (
                  <DraggableIconItem
                    key={`icon-${item._icon.name}-${idx}`}
                    iconItem={item._icon}
                    onClick={(dragItem) => handleIconClick(dragItem)}
                    onDoubleClick={(dragItem) => handleIconClick(dragItem)}
                    viewMode="compact"
                  />
                ) : (
                  <DraggableResourceItem
                    key={`${item.provider}-${item.category}-${item.resource.name}-${idx}`}
                    resource={item.resource}
                    provider={item.provider}
                    category={item.category}
                    icon={<Box className="h-10 w-10" />}
                    onClick={() => handleResourceClick(item.resource, item.provider, item.category)}
                    onDoubleClick={() => handleResourceClick(item.resource, item.provider, item.category)}
                    viewMode="compact"
                  />
                )
              )}
            </div>
          )}
        </div>
        {!isLoading && totalItems > 0 && (
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {totalItems} item(s)
            </span>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[3ch] text-center text-xs text-muted-foreground">
                  {page + 1}/{totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        )}
        </TooltipProvider>
      </div>
    </>
  );
}
