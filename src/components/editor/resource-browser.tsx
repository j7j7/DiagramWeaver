"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, Package, Server, Database, Globe, Cloud, Cpu, Shield, BarChart3, Layers, Box, Network, Maximize2, Minimize2, Type } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Badge } from '../ui/badge';
import { DraggableResourceItem } from './draggable-resource-item';

// Resource index is fetched at runtime from public/resources
// This avoids duplicate JSON sources and keeps a single source of truth.

// ResourceItem interface kept for backward compatibility and internal use
interface ResourceItem {
  name: string;
  file: string;
  hasWhiteVariant?: boolean;
  format?: string;
}

interface ResourceCategory {
  name: string;
  path: string;
  resources: ResourceItem[];
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
  onResourceSelect: (resource: { name: string; file: string; }, provider: string, category: string) => void;
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
      generic: <Box className="w-4 h-4 text-gray-500" />,
      onprem: <Server className="w-4 h-4 text-gray-600" />,
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

export function ResourceBrowser({ onResourceSelect }: ResourceBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [fullProviders, setFullProviders] = useState<Record<string, ResourceProvider>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [resourceIndex, setResourceIndex] = useState<ResourceIndex | null>(null);

  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      try {
        // Fetch the index from the canonical public location
        const indexRes = await fetch('/resources/resource-components.json', { cache: 'no-cache' });
        const indexJson: ResourceIndex = await indexRes.json();
        setResourceIndex(indexJson);

        // Fetch enabled providers in parallel for responsiveness
        const entries = Object.entries(indexJson.providers).filter(([, p]) => p.enabled);
        const providerPairs = await Promise.all(entries.map(async ([key, provider]) => {
          try {
            const res = await fetch(`/resources/${provider.file}`, { cache: 'no-cache' });
            const data = await res.json();
            return [key, data as ResourceProvider] as const;
          } catch (err) {
            console.error(`Failed to load provider ${key}:`, err);
            return null;
          }
        }));

        const providers: Record<string, ResourceProvider> = {};
        for (const pair of providerPairs) {
          if (pair) providers[pair[0]] = pair[1];
        }
        setFullProviders(providers);

        // Auto-expand first provider and some categories
        if (Object.keys(providers).length > 0) {
          const firstProvider = Object.keys(providers)[0];
          const newExpandedProviders = new Set([firstProvider]);
          const newExpandedCategories = new Set<string>();

          const providerData = providers[firstProvider];
          if (providerData?.categories) {
            const categoriesToExpand = ['grouping', 'compute', 'database', 'network'];
            Object.keys(providerData.categories).forEach(categoryKey => {
              if (categoriesToExpand.includes(categoryKey)) {
                newExpandedCategories.add(`${firstProvider}-${categoryKey}`);
              }
            });
          }

          setExpandedProviders(newExpandedProviders);
          setExpandedCategories(newExpandedCategories);
        }
      } catch (e) {
        console.error('Failed to load resource index:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadAll();
  }, []);

  const toggleProvider = (provider: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  const toggleCategory = (categoryKey: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
  };

  const expandAll = () => {
    const allProviders = new Set(Object.keys(filteredProviders));
    const allCategories = new Set<string>();
    
    Object.entries(filteredProviders).forEach(([providerKey, provider]) => {
      Object.keys(provider.categories).forEach(categoryKey => {
        allCategories.add(`${providerKey}-${categoryKey}`);
      });
    });
    
    setExpandedProviders(allProviders);
    setExpandedCategories(allCategories);
  };

  const collapseAll = () => {
    setExpandedProviders(new Set());
    setExpandedCategories(new Set());
  };

  const filteredProviders = useMemo(() => {
    if (isLoading || Object.keys(fullProviders).length === 0) return {};
    const providers = fullProviders;
    
    if (!searchTerm) {
      // Reorder providers to put generic first (contains zones/groups)
      const orderedProviders: Record<string, ResourceProvider> = {};
      const priorityOrder = ['generic', 'k8s', 'aws', 'azure', 'gcp', 'oci', 'onprem', 'saas', 'elastic', 'firebase', 'digitalocean', 'ibm', 'openstack', 'outscale', 'gis', 'programming', 'alibabacloud'];
      
      // Add providers in priority order
      priorityOrder.forEach(key => {
        if (providers[key]) {
          orderedProviders[key] = providers[key];
        }
      });
      
      // Add any remaining providers
      Object.entries(providers).forEach(([key, provider]) => {
        if (!orderedProviders[key]) {
          orderedProviders[key] = provider;
        }
      });
      
      return orderedProviders;
    }

    const filtered: Record<string, ResourceProvider> = {};
    
    Object.entries(providers).forEach(([providerKey, provider]) => {
      const matchingCategories: Record<string, ResourceCategory> = {};
      
      Object.entries(provider.categories).forEach(([categoryKey, category]) => {
        const matchingResources = category.resources.filter(resource =>
          resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          provider.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (matchingResources.length > 0) {
          matchingCategories[categoryKey] = {
            ...category,
            resources: matchingResources
          };
        }
      });
      
      if (Object.keys(matchingCategories).length > 0) {
        filtered[providerKey] = {
          ...provider,
          categories: matchingCategories
        };
      }
    });
    
    return filtered;
  }, [searchTerm, fullProviders, isLoading]);

  const getResourceIcon = (resource: ResourceItem) => {
    // Return generic box icon (icon will be loaded from file)
    return <Box className="w-6 h-6" />;
  };

  const handleResourceClick = (resource: ResourceItem, provider: string, category: string) => {
    onResourceSelect(resource, provider, category);
  };

return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Bar */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
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
              `${Object.values(fullProviders).reduce((acc, provider) =>
                acc + provider.totalResources, 0
              )} resources loaded`
            )}
          </div>
          <div className="ml-auto flex gap-1">
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

      {/* Resource Tree - Vertical Scroll */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
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
              Object.entries(filteredProviders).map(([providerKey, provider]) => (
                <div key={providerKey} className="mb-2">
                  <Collapsible open={expandedProviders.has(providerKey)} onOpenChange={() => toggleProvider(providerKey)}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-2 h-auto hover:bg-accent/50 hover:text-accent-foreground"
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
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="ml-4 pl-2 border-l-2 border-muted">
                        {Object.entries(provider.categories).map(([categoryKey, category]) => {
                          const categoryFullKey = `${providerKey}-${categoryKey}`;
                          const isExpanded = expandedCategories.has(categoryFullKey);

                          return (
                            <div key={categoryKey} className="mb-1">
                              <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(categoryFullKey)}>
                                <CollapsibleTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-between p-1 h-auto hover:bg-accent/40 hover:text-accent-foreground"
                                  >
                                    <div className="flex items-center gap-1">
                                      {isExpanded ? (
                                        <ChevronDown className="w-3 h-3" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3" />
                                      )}
                                      <span className="text-sm">{category.name}</span>
                                      <Badge variant="outline" className="ml-auto text-xs">
                                        {category.resources.length}
                                      </Badge>
                                    </div>
                                  </Button>
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                  <div className="ml-4 grid grid-cols-2 gap-1 p-1">
                                    {category.resources.map((resource, index) => (
                                      <DraggableResourceItem
                                        key={index}
                                        resource={resource}
                                        provider={providerKey}
                                        category={categoryKey}
                                        icon={getResourceIcon(resource)}
                                      />
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}