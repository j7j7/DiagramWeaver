"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

// Cookie helper functions
const RESOURCE_BROWSER_COOKIE = 'resource-browser-state';

interface ResourceBrowserState {
  expandedProviders: string[];
  expandedCategories: string[];
  viewMode?: 'normal' | 'compact';
}

const getBrowserState = (): ResourceBrowserState => {
  if (typeof window === 'undefined') return { expandedProviders: [], expandedCategories: [], viewMode: 'normal' };
  
  try {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(RESOURCE_BROWSER_COOKIE));
    
    if (cookie) {
      const decoded = decodeURIComponent(cookie.split('=')[1]);
      const parsed = JSON.parse(decoded);
      // Ensure viewMode defaults to 'normal' if not present
      return { ...parsed, viewMode: parsed.viewMode || 'normal' };
    }
  } catch (error) {
    console.warn('Failed to parse resource browser state from cookie:', error);
  }
  
  return { expandedProviders: [], expandedCategories: [], viewMode: 'normal' };
};

const setBrowserState = (state: ResourceBrowserState) => {
  if (typeof window === 'undefined') return;
  
  try {
    const encoded = encodeURIComponent(JSON.stringify(state));
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
    
    document.cookie = `${RESOURCE_BROWSER_COOKIE}=${encoded}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  } catch (error) {
    console.warn('Failed to save resource browser state to cookie:', error);
  }
};
import { ChevronDown, ChevronRight, Search, Package, Server, Database, Globe, Cloud, Cpu, Shield, BarChart3, Layers, Box, Network, Maximize2, Minimize2, Type, LayoutGrid, List } from 'lucide-react';
import { ResourceIcon } from '@/components/diagram/resource-icon';
import { CustomIconPreviewEditor } from '@/components/editor/custom-icon-preview-editor';
import { DraggableIconItem } from './draggable-icon-item';
import { SYMBOL_ICON_SECTIONS, EMOJI_ICONS } from '@/lib/icon-resources';
import { DEFAULT_CUSTOM_IMAGE_OPTIONS, normalizeCustomImageOptions, normalizeHttpImageUrl, validateCustomImageUrl } from '@/lib/custom-icon-utils';
import type { CustomImageOptions } from '@/lib/types';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { DraggableResourceItem } from './draggable-resource-item';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { VirtualizedResourceGrid } from './virtualized-resource-grid';
import type { IconResourceItem } from '@/lib/icon-resources';
import type { UserDefinedObject } from '@/lib/types';
import { DraggableUserDefinedItem } from './draggable-user-defined-item';
import { listUserDefinedObjectsForPalette } from '@/lib/user-defined-objects';

// Resource index is fetched at runtime from public/resources
// This avoids duplicate JSON sources and keeps a single source of truth.

// ResourceItem interface kept for backward compatibility and internal use
interface ResourceItem {
  name: string;
  file?: string; // Optional for icon resources
  type?: string;
  hasWhiteVariant?: boolean;
  format?: string;
  iconType?: string;
  iconName?: string;
  emoji?: string;
  imageUrl?: string;
  imageOptions?: CustomImageOptions;
}

interface ResourceCategory {
  name: string;
  path: string;
  resources: ResourceItem[];
  _isIconCategory?: boolean;
  _isUserDefinedCategory?: boolean;
}

/** Sort generic sidebar categories; user-defined sits above object. */
const GENERIC_CATEGORY_ORDER: Record<string, number> = {
  text: 0,
  'user-defined': 10,
  object: 20,
  cards: 30,
  borders: 40,
  grouping: 50,
  icons: 90,
};

function sortGenericCategoryEntries(
  entries: [string, ResourceCategory][],
): [string, ResourceCategory][] {
  return [...entries].sort(([keyA], [keyB]) => {
    const a = GENERIC_CATEGORY_ORDER[keyA] ?? 60;
    const b = GENERIC_CATEGORY_ORDER[keyB] ?? 60;
    if (a !== b) return a - b;
    return keyA.localeCompare(keyB);
  });
}

interface ResourceProvider {
  name: string;
  icon: string;
  totalResources: number;
  categories: Record<string, ResourceCategory>;
}

interface ResourceIndex {
  version: string;
  description: string;
  totalResources: number;
  lastUpdated: string;
  providers: Record<string, {
    name: string;
    icon: string;
    totalResources: number;
    file: string;
    enabled: boolean;
  }>;
  metadata: any;
}

interface ResourceBrowserProps {
  onResourceSelect: (resource: ResourceItem, provider: string, category: string) => void;
  onResourceActivate?: (resource: ResourceItem, provider: string, category: string, fullItem?: object) => void;
  userDefinedObjectsLibrary?: Record<string, UserDefinedObject>;
  diagramData?: import('@/lib/types').DiagramData | null;
  onUserDefinedObjectActivate?: (object: UserDefinedObject) => void;
}

// Icon mapping for different resource types
const typeIcons: Record<string, React.ReactNode> = {
  service: <Cloud className="w-4 h-4" />,
  resource: <Box className="w-4 h-4" />,
  software: <Package className="w-4 h-4" />,
  hardware: <Server className="w-4 h-4" />,
  framework: <Layers className="w-4 h-4" />,
  language: <Cpu className="w-4 h-4" />,
  database: <Database className="w-4 h-4" />,
  network: <Network className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  analytics: <BarChart3 className="w-4 h-4" />,
  storage: <Database className="w-4 h-4" />,
  compute: <Server className="w-4 h-4" />,
  group: <Box className="w-4 h-4" />,
  text: <Type className="w-4 h-4" />,
};

// Helper functions for subtle tint colors
function getProviderTintClasses(providerKey: string): string {
  const tints: Record<string, string> = {
    generic: 'bg-slate-500/5 border-slate-500/15',
    aws: 'bg-orange-500/5 border-orange-500/15',
    azure: 'bg-blue-500/5 border-blue-500/15',
    gcp: 'bg-green-500/5 border-green-500/15',
    oci: 'bg-red-500/5 border-red-500/15',
    k8s: 'bg-blue-600/5 border-blue-600/15',
    onprem: 'bg-gray-600/5 border-gray-600/15',
    saas: 'bg-purple-500/5 border-purple-500/15',
    elastic: 'bg-yellow-500/5 border-yellow-500/15',
    firebase: 'bg-yellow-600/5 border-yellow-600/15',
    digitalocean: 'bg-blue-400/5 border-blue-400/15',
    ibm: 'bg-blue-700/5 border-blue-700/15',
    openstack: 'bg-red-600/5 border-red-600/15',
    outscale: 'bg-cyan-500/5 border-cyan-500/15',
    gis: 'bg-green-600/5 border-green-600/15',
    programming: 'bg-purple-600/5 border-purple-600/15',
    alibabacloud: 'bg-orange-600/5 border-orange-600/15',
  };
  return tints[providerKey] || 'bg-muted/5 border-muted/15';
}

function getCategoryTintClasses(categoryKey: string): string {
  const tints: Record<string, string> = {
    grouping: 'bg-indigo-500/5 border-indigo-500/10',
    text: 'bg-gray-500/5 border-gray-500/10',
    compute: 'bg-blue-500/5 border-blue-500/10',
    database: 'bg-emerald-500/5 border-emerald-500/10',
    network: 'bg-cyan-500/5 border-cyan-500/10',
    storage: 'bg-amber-500/5 border-amber-500/10',
    security: 'bg-red-500/5 border-red-500/10',
    analytics: 'bg-purple-500/5 border-purple-500/10',
    management: 'bg-teal-500/5 border-teal-500/10',
    integration: 'bg-pink-500/5 border-pink-500/10',
    mobile: 'bg-violet-500/5 border-violet-500/10',
    iot: 'bg-lime-500/5 border-lime-500/10',
    object: 'bg-slate-500/5 border-slate-500/10',
    'user-defined': 'bg-violet-500/5 border-violet-500/15',
    cards: 'bg-sky-500/5 border-sky-500/10',
    borders: 'bg-teal-500/5 border-teal-500/10',
  };
  return tints[categoryKey] || 'bg-muted/5 border-muted/10';
}

// Provider icon component that tries to load actual provider icons
function ProviderIcon({ provider }: { provider: string }) {
  const [imageError, setImageError] = React.useState(false);
  
  const iconPath = `/resources/${provider}/${provider}.png`;
  
  if (imageError) {
    // Fallback to colored icons
    const fallbackIcons: Record<string, React.ReactNode> = {
      aws: <Cloud className="w-4 h-4 text-orange-500" />,
      azure: <Cloud className="w-4 h-4 text-blue-500" />,
      gcp: <Cloud className="w-4 h-4 text-green-500" />,
      oci: <Cloud className="w-4 h-4 text-red-500" />,
      k8s: <Globe className="w-4 h-4 text-blue-600" />,
      generic: <Box className="w-4 h-4 text-muted-foreground" />,
      onprem: <Server className="w-4 h-4 text-muted-foreground" />,
      saas: <Cloud className="w-4 h-4 text-purple-500" />,
      elastic: <Package className="w-4 h-4 text-yellow-500" />,
      firebase: <Cloud className="w-4 h-4 text-yellow-600" />,
      digitalocean: <Cloud className="w-4 h-4 text-blue-400" />,
      ibm: <Cloud className="w-4 h-4 text-blue-700" />,
      openstack: <Server className="w-4 h-4 text-red-600" />,
      outscale: <Cloud className="w-4 h-4 text-cyan-500" />,
      gis: <Globe className="w-4 h-4 text-green-600" />,
      programming: <Cpu className="w-4 h-4 text-purple-600" />,
      alibabacloud: <Cloud className="w-4 h-4 text-orange-600" />,
    };
    
    return fallbackIcons[provider] || <Cloud className="w-4 h-4" />;
  }
  
  return (
    <img
      src={iconPath}
      alt={provider}
      className="w-4 h-4 object-contain"
      onError={() => setImageError(true)}
    />
  );
}

function ResourceBrowserInner({
  onResourceSelect,
  onResourceActivate,
  userDefinedObjectsLibrary = {},
  diagramData = null,
  onUserDefinedObjectActivate,
}: ResourceBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fullProviders, setFullProviders] = useState<Record<string, ResourceProvider>>({});
  const [loadingProviderKeys, setLoadingProviderKeys] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [resourceIndex, setResourceIndex] = useState<ResourceIndex | null>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [scrollLayoutEpoch, setScrollLayoutEpoch] = useState(0);
  const bumpScrollLayout = useCallback(() => {
    setScrollLayoutEpoch((n) => n + 1);
  }, []);
  const loadingProvidersRef = useRef<Set<string>>(new Set());
  const fullProvidersRef = useRef(fullProviders);
  fullProvidersRef.current = fullProviders;
  
  // Use fixed defaults for initial render to avoid hydration mismatch (cookies only exist on client)
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedIconCategories, setExpandedIconCategories] = useState<Set<string>>(() => new Set());
  const [viewMode, setViewMode] = useState<'normal' | 'compact'>('normal');
  const [customIconUrl, setCustomIconUrl] = useState('');
  const [customIconError, setCustomIconError] = useState<string | null>(null);
  const [customIconLoading, setCustomIconLoading] = useState(false);
  const [customIconLoadedUrl, setCustomIconLoadedUrl] = useState<string | null>(null);
  const [customIconOptions, setCustomIconOptions] = useState<CustomImageOptions>(DEFAULT_CUSTOM_IMAGE_OPTIONS);

  /** Avoid writing expansion cookies before initial index load finishes (pure state updaters only). */
  const expansionCookieSyncRef = useRef(false);

  const loadProvider = React.useCallback(async (providerKey: string) => {
    if (fullProvidersRef.current[providerKey] || loadingProvidersRef.current.has(providerKey)) {
      return;
    }
    const meta = resourceIndex?.providers[providerKey];
    if (!meta?.enabled) return;

    loadingProvidersRef.current.add(providerKey);
    setLoadingProviderKeys((prev) => new Set(prev).add(providerKey));
    try {
      const res = await fetch(`/resources/${meta.file}`, { cache: 'no-cache' });
      const data = (await res.json()) as ResourceProvider;
      setFullProviders((prev) => ({ ...prev, [providerKey]: data }));
    } catch (err) {
      console.error(`Failed to load provider ${providerKey}:`, err);
    } finally {
      loadingProvidersRef.current.delete(providerKey);
      setLoadingProviderKeys((prev) => {
        const next = new Set(prev);
        next.delete(providerKey);
        return next;
      });
    }
  }, [resourceIndex]);

  useEffect(() => {
    const loadIndex = async () => {
      setIsLoading(true);
      try {
        const indexRes = await fetch('/resources/resource-components.json', { cache: 'no-cache' });
        const indexJson: ResourceIndex = await indexRes.json();
        setResourceIndex(indexJson);

        const savedState = getBrowserState();
        setViewMode(savedState.viewMode || 'normal');

        const enabledKeys = Object.entries(indexJson.providers)
          .filter(([, p]) => p.enabled)
          .map(([key]) => key);
        if (enabledKeys.length === 0) return;

        let defaultProvider = enabledKeys.includes('generic') ? 'generic' : enabledKeys[0];
        let newExpandedProviders = new Set<string>(
          savedState.expandedProviders.filter((k) => enabledKeys.includes(k)),
        );
        let newExpandedCategories = new Set<string>(savedState.expandedCategories);

        if (newExpandedProviders.size === 0) {
          newExpandedProviders = new Set([defaultProvider]);
        }

        if (newExpandedCategories.size === 0) {
          const categoriesToExpand = ['grouping', 'text', 'object'];
          categoriesToExpand.forEach((categoryKey) => {
            newExpandedCategories.add(`${defaultProvider}-${categoryKey}`);
          });
        }

        setExpandedProviders(newExpandedProviders);
        setExpandedCategories(newExpandedCategories);
      } catch (e) {
        console.error('Failed to load resource index:', e);
      } finally {
        expansionCookieSyncRef.current = true;
        setIsLoading(false);
      }
    };
    loadIndex();
  }, []);

  useEffect(() => {
    bumpScrollLayout();
  }, [searchTerm, isLoading, bumpScrollLayout]);

  useEffect(() => {
    if (!resourceIndex) return;
    expandedProviders.forEach((key) => {
      void loadProvider(key);
    });
  }, [expandedProviders, resourceIndex, loadProvider]);

  useEffect(() => {
    if (!resourceIndex || !searchTerm.trim()) return;
    Object.entries(resourceIndex.providers).forEach(([key, meta]) => {
      if (meta.enabled) void loadProvider(key);
    });
  }, [searchTerm, resourceIndex, loadProvider]);

  useEffect(() => {
    if (!expansionCookieSyncRef.current) return;
    const currentState = getBrowserState();
    setBrowserState({
      ...currentState,
      expandedProviders: Array.from(expandedProviders),
      expandedCategories: Array.from(expandedCategories),
    });
  }, [expandedProviders, expandedCategories]);

  const onProviderOpenChange = (provider: string, open: boolean) => {
    if (open) void loadProvider(provider);
    setExpandedProviders((prev) => {
      const has = prev.has(provider);
      if (has === open) return prev;
      const next = new Set(prev);
      if (open) next.add(provider);
      else next.delete(provider);
      bumpScrollLayout();
      return next;
    });
  };

  const onCategoryOpenChange = (categoryFullKey: string, open: boolean) => {
    setExpandedCategories((prev) => {
      const has = prev.has(categoryFullKey);
      if (has === open) return prev;
      const next = new Set(prev);
      if (open) next.add(categoryFullKey);
      else next.delete(categoryFullKey);
      bumpScrollLayout();
      return next;
    });
  };

  const expandAll = () => {
    if (!resourceIndex) return;
    const enabledKeys = Object.entries(resourceIndex.providers)
      .filter(([, p]) => p.enabled)
      .map(([key]) => key);
    enabledKeys.forEach((key) => void loadProvider(key));

    const allProviders = new Set(enabledKeys);
    const allCategories = new Set<string>();

    Object.entries(fullProviders).forEach(([providerKey, provider]) => {
      Object.keys(provider.categories).forEach((categoryKey) => {
        allCategories.add(`${providerKey}-${categoryKey}`);
      });
    });
    if (enabledKeys.includes('generic')) {
      allCategories.add('generic-icons');
    }

    setExpandedProviders(allProviders);
    setExpandedCategories(allCategories);
    bumpScrollLayout();
  };

  const collapseAll = () => {
    setExpandedProviders(new Set());
    setExpandedCategories(new Set());
    bumpScrollLayout();
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'normal' ? 'compact' : 'normal';
    setViewMode(newMode);
    bumpScrollLayout();
    
    // Save to cookie
    const currentState = getBrowserState();
    setBrowserState({
      ...currentState,
      viewMode: newMode
    });
  };

  const userDefinedPaletteObjects = useMemo(
    () => listUserDefinedObjectsForPalette(userDefinedObjectsLibrary, searchTerm),
    [userDefinedObjectsLibrary, searchTerm],
  );

  const filteredIconItems = useMemo(() => {
    const term = searchTerm?.toLowerCase() || '';
    const filteredSections: Record<string, typeof SYMBOL_ICON_SECTIONS[string]> = {};
    Object.entries(SYMBOL_ICON_SECTIONS).forEach(([sectionName, icons]) => {
      const filtered = term ? icons.filter((i) => i.name.toLowerCase().includes(term)) : icons;
      if (filtered.length > 0) filteredSections[sectionName] = filtered;
    });
    const filteredEmoji = term ? EMOJI_ICONS.filter((i) => i.name.toLowerCase().includes(term)) : EMOJI_ICONS;
    return { symbolSections: filteredSections, emoji: filteredEmoji };
  }, [searchTerm]);

  const priorityProviderOrder = useMemo(
    () =>
      [
        'generic',
        'k8s',
        'aws',
        'azure',
        'gcp',
        'oci',
        'onprem',
        'saas',
        'elastic',
        'firebase',
        'digitalocean',
        'ibm',
        'openstack',
        'outscale',
        'gis',
        'programming',
        'alibabacloud',
      ] as const,
    [],
  );

  const orderProviders = useCallback(
    (providers: Record<string, ResourceProvider>) => {
      const orderedProviders: Record<string, ResourceProvider> = {};
      priorityProviderOrder.forEach((key) => {
        if (providers[key]) orderedProviders[key] = providers[key];
      });
      Object.entries(providers).forEach(([key, provider]) => {
        if (!orderedProviders[key]) orderedProviders[key] = provider;
      });
      return orderedProviders;
    },
    [priorityProviderOrder],
  );

  const filteredProviders = useMemo(() => {
    if (isLoading || !resourceIndex) return {};

    const enabledIndexEntries = Object.entries(resourceIndex.providers).filter(([, p]) => p.enabled);

    if (!searchTerm) {
      const merged: Record<string, ResourceProvider> = {};
      enabledIndexEntries.forEach(([key, meta]) => {
        merged[key] =
          fullProviders[key] ??
          ({
            name: meta.name,
            icon: meta.icon,
            totalResources: meta.totalResources,
            categories: {},
          } as ResourceProvider);
      });
      return orderProviders(merged);
    }

    const filtered: Record<string, ResourceProvider> = {};
    Object.entries(fullProviders).forEach(([providerKey, provider]) => {
      const matchingCategories: Record<string, ResourceCategory> = {};

      Object.entries(provider.categories).forEach(([categoryKey, category]) => {
        const matchingResources = category.resources.filter(
          (resource) =>
            resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            provider.name.toLowerCase().includes(searchTerm.toLowerCase()),
        );

        if (matchingResources.length > 0) {
          matchingCategories[categoryKey] = {
            ...category,
            resources: matchingResources,
          };
        }
      });

      if (providerKey === 'generic' && userDefinedPaletteObjects.length > 0) {
        const term = searchTerm.toLowerCase();
        const matchesUserDefined =
          'user-defined'.includes(term) ||
          userDefinedPaletteObjects.some(
            (obj) =>
              obj.name.toLowerCase().includes(term) ||
              obj.id.toLowerCase().includes(term),
          );
        if (matchesUserDefined) {
          matchingCategories['user-defined'] = {
            name: 'User-Defined',
            path: 'generic/user-defined',
            resources: [],
            _isUserDefinedCategory: true,
          };
        }
      }

      if (Object.keys(matchingCategories).length > 0) {
        filtered[providerKey] = {
          ...provider,
          categories: matchingCategories,
        };
      }
    });

    return orderProviders(filtered);
  }, [searchTerm, fullProviders, isLoading, resourceIndex, orderProviders, userDefinedPaletteObjects]);

  const getProviderCategoryEntries = useCallback(
    (providerKey: string, categories: Record<string, ResourceCategory>): [string, ResourceCategory][] => {
      const entries: [string, ResourceCategory][] = Object.entries(categories);

      if (providerKey !== 'generic') {
        return entries;
      }

      if (userDefinedPaletteObjects.length > 0) {
        entries.push([
          'user-defined',
          {
            name: 'User-Defined',
            path: 'generic/user-defined',
            resources: [],
            _isUserDefinedCategory: true,
          },
        ]);
      }

      if (
        Object.keys(filteredIconItems.symbolSections).length > 0 ||
        filteredIconItems.emoji.length > 0
      ) {
        entries.push([
          'icons',
          {
            name: 'Icons',
            path: '',
            resources: [],
            _isIconCategory: true,
          },
        ]);
      }

      return sortGenericCategoryEntries(entries);
    },
    [userDefinedPaletteObjects.length, filteredIconItems],
  );

  const getResourceIcon = (resource: ResourceItem, provider: string, category: string) => {
    // For generic object shapes, use ResourceIcon with theme-aware grey (works in light and dark mode)
    if (provider === 'generic' && category === 'object' && resource.name) {
      const slug = resource.name.replace(/\s+/g, '-').toLowerCase();
      const chartType =
        slug === 'pie-chart'
          ? 'generic.chart.pie'
          : slug === 'bar-chart'
            ? 'generic.chart.bar'
            : slug === 'line-chart'
              ? 'generic.chart.line'
              : slug === 'ring-chart'
                ? 'generic.chart.ring'
                : slug === 'grid-chart'
                  ? 'generic.chart.grid'
                  : slug === 'gantt-chart'
                    ? 'generic.chart.gantt'
                    : slug === 'loop-chart'
                      ? 'generic.chart.loop'
                    : null;
      const type = chartType ?? `generic.object.${slug}`;
      return (
        <span className="text-muted-foreground inline-flex items-center justify-center">
          <ResourceIcon type={type} className="w-6 h-6" stroke="currentColor" fill="currentColor" />
        </span>
      );
    }
    if (provider === 'generic' && category === 'cards' && resource.name) {
      const slug = resource.name.replace(/\s+/g, '-').toLowerCase();
      return (
        <span className="inline-flex items-center justify-center">
          <ResourceIcon type={`generic.card.${slug}`} className="w-6 h-6" />
        </span>
      );
    }
    if (provider === 'generic' && category === 'borders' && resource.name) {
      const slug = resource.name.replace(/\s+/g, '-').toLowerCase();
      return (
        <span className="inline-flex items-center justify-center">
          <ResourceIcon type={`generic.border.${slug}`} className="w-6 h-6" />
        </span>
      );
    }
    // Text Box Heading is listed under Text but uses generic.object.* type and object/ asset path
    if (provider === 'generic' && category === 'text' && resource.name?.replace(/\s+/g, '-').toLowerCase() === 'text-box-heading') {
      return (
        <span className="text-muted-foreground inline-flex items-center justify-center">
          <ResourceIcon type="generic.object.text-box-heading" className="w-6 h-6" stroke="currentColor" fill="currentColor" />
        </span>
      );
    }
    return <Box className="w-6 h-6" />;
  };

  const handleResourceClick = (resource: ResourceItem, provider: string, category: string) => {
    onResourceSelect(resource, provider, category);
  };

  const handleResourceActivate = (resource: ResourceItem, provider: string, category: string) => {
    onResourceActivate?.(resource, provider, category);
  };

  const handleIconSelect = (dragItem: { type: string; label: string; provider: string; category: string; iconType?: string; iconName?: string; emoji?: string }) => {
    onResourceSelect?.(
      { name: dragItem.label, type: 'icon', iconType: dragItem.iconType, iconName: dragItem.iconName, emoji: dragItem.emoji } satisfies ResourceItem,
      'generic',
      dragItem.category
    );
  };

  const handleIconActivate = (dragItem: { type: string; label: string; provider: string; category: string; iconType?: string; iconName?: string; emoji?: string }) => {
    onResourceActivate?.(
      { name: dragItem.label, type: 'icon', iconType: dragItem.iconType, iconName: dragItem.iconName, emoji: dragItem.emoji } satisfies ResourceItem,
      'generic',
      dragItem.category,
      dragItem
    );
  };

  const loadCustomIconPreview = async () => {
    setCustomIconLoading(true);
    setCustomIconError(null);

    const normalized = normalizeHttpImageUrl(customIconUrl);
    if (!normalized) {
      setCustomIconLoadedUrl(null);
      setCustomIconError('Enter a valid image URL (http/https or data:image/...).');
      setCustomIconLoading(false);
      return;
    }

    const result = await validateCustomImageUrl(normalized, { force: true });
    if (!result.ok) {
      setCustomIconLoadedUrl(null);
      setCustomIconError(result.error || 'Unable to load image preview.');
      setCustomIconLoading(false);
      return;
    }

    setCustomIconLoadedUrl(result.normalizedUrl || normalized);
    setCustomIconOptions(normalizeCustomImageOptions(DEFAULT_CUSTOM_IMAGE_OPTIONS));
    setCustomIconLoading(false);
  };

  const activateCustomIcon = () => {
    const imageUrl = customIconLoadedUrl || normalizeHttpImageUrl(customIconUrl);
    if (!imageUrl) {
      setCustomIconError('Load a valid image before adding a custom icon node.');
      return;
    }

    const fullItem = {
      type: 'generic.icon.custom',
      label: 'Custom Icon',
      provider: 'generic',
      category: 'icon',
      imageUrl,
      imageOptions: customIconOptions,
    };
    onResourceActivate?.(
      {
        name: 'Custom Icon',
        type: 'custom-icon',
        imageUrl,
        imageOptions: customIconOptions,
      },
      'generic',
      'icon',
      fullItem
    );
  };

  const onIconSectionOpenChange = (key: string, open: boolean) => {
    setExpandedIconCategories((prev) => {
      const has = prev.has(key);
      if (has === open) return prev;
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      bumpScrollLayout();
      return next;
    });
  };

  const renderCategoryResourceGrid = useCallback(
    (resources: ResourceItem[], providerKey: string, categoryKey: string) => {
      const renderTile = (resource: unknown, index: number) => {
        const r = resource as ResourceItem;
        return (
          <DraggableResourceItem
            key={`${providerKey}-${categoryKey}-${index}-${r.name}`}
            resource={r}
            provider={providerKey}
            category={categoryKey}
            icon={getResourceIcon(r, providerKey, categoryKey)}
            invertInDarkMode={
              providerKey === 'generic' &&
              (categoryKey === 'object' ||
                (categoryKey === 'text' &&
                  r.name.replace(/\s+/g, '-').toLowerCase() === 'text-box-heading'))
            }
            onClick={() => handleResourceClick(r, providerKey, categoryKey)}
            onDoubleClick={() => handleResourceActivate(r, providerKey, categoryKey)}
            viewMode={viewMode}
          />
        );
      };

      return (
        <VirtualizedResourceGrid
          resources={resources}
          viewMode={viewMode}
          scrollRootRef={scrollRootRef}
          layoutEpoch={scrollLayoutEpoch}
          renderItem={renderTile}
        />
      );
    },
    [viewMode, getResourceIcon, handleResourceClick, handleResourceActivate, scrollLayoutEpoch],
  );

  const renderUserDefinedResourceGrid = useCallback(() => {
    const renderTile = (object: UserDefinedObject, index: number) => (
      <DraggableUserDefinedItem
        key={`user-defined-${object.id}-${index}`}
        object={object}
        viewMode={viewMode}
        onDoubleClick={() => onUserDefinedObjectActivate?.(object)}
      />
    );

    return (
      <VirtualizedResourceGrid
        resources={userDefinedPaletteObjects}
        viewMode={viewMode}
        scrollRootRef={scrollRootRef}
        layoutEpoch={scrollLayoutEpoch}
        renderItem={(item, index) => renderTile(item as UserDefinedObject, index)}
      />
    );
  }, [
    userDefinedPaletteObjects,
    viewMode,
    scrollLayoutEpoch,
    onUserDefinedObjectActivate,
  ]);

  const renderIconResourceGrid = useCallback(
    (icons: IconResourceItem[], keyPrefix: string) => {
      const renderTile = (iconItem: unknown, index: number) => {
        const item = iconItem as IconResourceItem;
        return (
          <DraggableIconItem
            key={`${keyPrefix}-${index}-${item.name}`}
            iconItem={item}
            onClick={(dragItem) => handleIconSelect(dragItem)}
            onDoubleClick={(dragItem) => handleIconActivate(dragItem)}
            viewMode={viewMode}
          />
        );
      };

      return (
        <VirtualizedResourceGrid
          resources={icons}
          viewMode={viewMode}
          scrollRootRef={scrollRootRef}
          layoutEpoch={scrollLayoutEpoch}
          renderItem={renderTile}
        />
      );
    },
    [viewMode, handleIconSelect, handleIconActivate, scrollLayoutEpoch],
  );

  const indexTotalResources = resourceIndex
    ? Object.values(resourceIndex.providers).reduce((acc, p) => acc + (p.enabled ? p.totalResources : 0), 0)
    : 0;

return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            data-testid="resource-search-input"
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              'Loading resources...'
            ) : searchTerm ? (
              `Found ${Object.values(filteredProviders).reduce((acc, provider) =>
                acc + Object.values(provider.categories).reduce((catAcc, cat) => catAcc + cat.resources.length, 0), 0
              )} resources`
            ) : (
              `${indexTotalResources || Object.values(fullProviders).reduce(
                (acc, provider) => acc + provider.totalResources,
                0,
              )} resources available`
            )}
          </div>
          <div className="ml-auto flex gap-1">
            <Button
              variant={viewMode === 'normal' ? 'default' : 'ghost'}
              size="sm"
              onClick={toggleViewMode}
              className="h-6 px-2"
              title={viewMode === 'normal' ? 'Switch to compact view' : 'Switch to normal view'}
            >
              {viewMode === 'normal' ? (
                <LayoutGrid className="w-3 h-3" />
              ) : (
                <List className="w-3 h-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAll}
              className="h-6 px-2"
              title="Expand all"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              className="h-6 px-2"
              title="Collapse all"
            >
              <Minimize2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Resource Tree - Vertical Scroll (native overflow avoids Radix ScrollArea measure/sync edge cases) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRootRef}
          className="h-full min-h-0 overflow-y-auto overflow-x-hidden dw-resource-browser-scroll"
        >
          <TooltipProvider>
          <div className="p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-muted-foreground">Loading resources...</div>
              </div>
            ) : Object.keys(fullProviders).length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-muted-foreground text-center">
                  <div>No resource providers are enabled.</div>
                  <div className="text-xs mt-1">Check your resource configuration.</div>
                </div>
              </div>
            ) : Object.keys(filteredProviders).length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-muted-foreground">
                  {searchTerm ? 'No resources found matching your search.' : 'No resources available.'}
                </div>
              </div>
            ) : (
                <>
                {Object.entries(filteredProviders).map(([providerKey, provider]) => (
                  <div
                    key={providerKey}
                    className={`dw-resource-tree-section mb-2 rounded-md border ${getProviderTintClasses(providerKey)}`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-between p-3 h-auto hover:bg-accent/50 hover:text-accent-foreground touch-target"
                      onClick={() => onProviderOpenChange(providerKey, !expandedProviders.has(providerKey))}
                    >
                      <div className="flex items-center gap-2">
                        {expandedProviders.has(providerKey) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <ProviderIcon provider={providerKey} />
                        <span className="font-medium">{provider.name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {provider.totalResources}
                        </Badge>
                      </div>
                    </Button>

                    {expandedProviders.has(providerKey) ? (
                      <div className="ml-4 pl-2 border-l-2 border-muted">
                          {loadingProviderKeys.has(providerKey) && !fullProviders[providerKey] ? (
                            <div className="py-3 px-2 text-xs text-muted-foreground">Loading resources…</div>
                          ) : null}
                          {getProviderCategoryEntries(providerKey, provider.categories).map(([categoryKey, category]) => {
                            const categoryFullKey = `${providerKey}-${categoryKey}`;
                            const isExpanded = expandedCategories.has(categoryFullKey);
                            const isIconCategory = category._isIconCategory;
                            const isUserDefinedCategory = category._isUserDefinedCategory;

                            return (
                              <div
                                key={categoryKey}
                                className={`dw-resource-tree-section mb-1 rounded-md border ${getCategoryTintClasses(categoryKey)}`}
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="w-full justify-between p-2 h-auto hover:bg-accent/40 hover:text-accent-foreground touch-target"
                                  onClick={() => onCategoryOpenChange(categoryFullKey, !isExpanded)}
                                >
                                  <div className="flex items-center gap-1">
                                    {isExpanded ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                    <span className="text-sm">{category.name}</span>
                                    <Badge variant="outline" className="ml-auto text-xs">
                                      {isUserDefinedCategory
                                        ? userDefinedPaletteObjects.length
                                        : isIconCategory
                                          ? Object.values(filteredIconItems.symbolSections).flat().length + filteredIconItems.emoji.length
                                          : category.resources.length}
                                    </Badge>
                                  </div>
                                </Button>

                                {isExpanded ? (
                                    isUserDefinedCategory ? (
                                      <div className="ml-4 pl-2 border-l-2 border-muted">
                                        {renderUserDefinedResourceGrid()}
                                      </div>
                                    ) : isIconCategory ? (
                                      <div className="ml-4 pl-2 border-l-2 border-muted space-y-1">
                                        <div className="rounded-md border bg-muted/5 border-border/50">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            className="w-full justify-between p-2 h-auto hover:bg-accent/40 hover:text-accent-foreground touch-target"
                                            onClick={() =>
                                              onIconSectionOpenChange('Custom Icon', !expandedIconCategories.has('Custom Icon'))
                                            }
                                          >
                                            <div className="flex items-center gap-1">
                                              {expandedIconCategories.has('Custom Icon') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                              <span className="text-sm">Custom Icon</span>
                                            </div>
                                          </Button>
                                          {expandedIconCategories.has('Custom Icon') ? (
                                            <div className="p-2 space-y-2">
                                                <div className="flex gap-2">
                                                  <Input
                                                    value={customIconUrl}
                                                    onChange={(e) => {
                                                      setCustomIconUrl(e.target.value);
                                                      setCustomIconError(null);
                                                    }}
                                                      placeholder="https://example.com/icon"
                                                    className="h-8 text-xs"
                                                  />
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    className="h-8 px-3"
                                                    onClick={loadCustomIconPreview}
                                                    disabled={customIconLoading}
                                                  >
                                                    {customIconLoading ? 'Loading...' : 'Load'}
                                                  </Button>
                                                </div>
                                                <CustomIconPreviewEditor
                                                  imageUrl={customIconLoadedUrl || undefined}
                                                  imageOptions={customIconOptions}
                                                  onOptionsChange={setCustomIconOptions}
                                                  size={132}
                                                />
                                                {customIconError ? (
                                                  <div className="text-[11px] text-destructive">{customIconError}</div>
                                                ) : (
                                                  <div className="text-[11px] text-muted-foreground">
                                                    Click Load, then drag to center and use the mouse wheel to zoom inside the icon frame.
                                                  </div>
                                                )}
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  className="w-full h-8"
                                                  onClick={activateCustomIcon}
                                                >
                                                  Add Custom Icon
                                                </Button>
                                              </div>
                                          ) : null}
                                        </div>

                                        {Object.entries(filteredIconItems.symbolSections).map(([sectionName, icons]) => (
                                          <div key={sectionName} className="rounded-md border bg-muted/5 border-border/50">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              className="w-full justify-between p-2 h-auto hover:bg-accent/40 hover:text-accent-foreground touch-target"
                                              onClick={() =>
                                                onIconSectionOpenChange(sectionName, !expandedIconCategories.has(sectionName))
                                              }
                                            >
                                              <div className="flex items-center gap-1">
                                                {expandedIconCategories.has(sectionName) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm">{sectionName}</span>
                                                <Badge variant="outline" className="ml-auto text-xs">{icons.length}</Badge>
                                              </div>
                                            </Button>
                                            {expandedIconCategories.has(sectionName)
                                              ? renderIconResourceGrid(icons, sectionName)
                                              : null}
                                          </div>
                                        ))}
                                        {filteredIconItems.emoji.length > 0 && (
                                          <div className="rounded-md border bg-muted/5 border-border/50">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              className="w-full justify-between p-2 h-auto hover:bg-accent/40 hover:text-accent-foreground touch-target"
                                              onClick={() =>
                                                onIconSectionOpenChange('Emojis', !expandedIconCategories.has('Emojis'))
                                              }
                                            >
                                              <div className="flex items-center gap-1">
                                                {expandedIconCategories.has('Emojis') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                <span className="text-sm">Emojis</span>
                                                <Badge variant="outline" className="ml-auto text-xs">{filteredIconItems.emoji.length}</Badge>
                                              </div>
                                            </Button>
                                            {expandedIconCategories.has('Emojis')
                                              ? renderIconResourceGrid(filteredIconItems.emoji, 'emoji')
                                              : null}
                                          </div>
                                        )}
                                      </div>
                                    ) : category.resources.length > 0 ? (
                                      <div className="ml-4 pl-2 border-l-2 border-muted">
                                        {renderCategoryResourceGrid(category.resources, providerKey, categoryKey)}
                                      </div>
                                    ) : null
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                    ) : null}
                  </div>
                ))}
                </>
            )}
          </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

export const ResourceBrowser = React.memo(ResourceBrowserInner);