"use client";

import { useState, useEffect, useCallback } from 'react';
import { loadAllResourceTypes } from '@/lib/type-matcher';
import { SYMBOL_ICON_SECTIONS, EMOJI_ICONS } from '@/lib/icon-resources';

export interface ResourceTypeOption {
  fullType: string;
  label: string;
}

let cachedTypes: ResourceTypeOption[] | null = null;

function buildTypeOptions(): ResourceTypeOption[] {
  if (cachedTypes) return cachedTypes;
  const options: ResourceTypeOption[] = [];
  const seen = new Set<string>();

  const slugify = (s: string) => s.replace(/\s+/g, '-').toLowerCase();
  for (const icons of Object.values(SYMBOL_ICON_SECTIONS)) {
    for (const icon of icons) {
      const slug = icon.iconType === 'lucide' ? slugify(icon.iconName) : slugify(icon.name);
      const type = `generic.icon.${slug}`;
      if (!seen.has(type)) {
        seen.add(type);
        options.push({ fullType: type, label: `Icon: ${icon.name}` });
      }
    }
  }
  for (const emoji of EMOJI_ICONS) {
    const type = `generic.emoji.${slugify(emoji.name)}`;
    if (!seen.has(type)) {
      seen.add(type);
      options.push({ fullType: type, label: `Emoji: ${emoji.name}` });
    }
  }
  cachedTypes = options;
  return options;
}

export function useResourceTypes(): {
  types: ResourceTypeOption[];
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [types, setTypes] = useState<ResourceTypeOption[]>(() => buildTypeOptions());
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const fromMatcher = await loadAllResourceTypes();
      const existing = buildTypeOptions();
      const combined = [...existing];
      const existingSet = new Set(existing.map(t => t.fullType));
      for (const t of fromMatcher) {
        if (!existingSet.has(t.fullType)) {
          existingSet.add(t.fullType);
          const label = `${t.provider}.${t.category}.${t.resource}`;
          combined.push({ fullType: t.fullType, label });
        }
      }
      combined.sort((a, b) => a.fullType.localeCompare(b.fullType));
      cachedTypes = combined;
      setTypes(combined);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { types, isLoading, refresh };
}
