"use client";
import React, { useState, useMemo, useEffect } from 'react';

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
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Card, CardContent } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Badge } from '../ui/badge';
import { DraggableResourceItem } from './draggable-resource-item';
import { generateDiagram } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { ollamaConfig } from '@/lib/ollama-config';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

// Resource index is fetched at runtime from public/resources
// This avoids duplicate JSON sources and keeps a single source of truth.

// ResourceItem interface kept for backward compatibility and internal use
interface ResourceItem {
  name: string;
  file: string;
  type?: string;
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
  onResourceSelect: (resource: { name: string; file: string; type?: string; hasWhiteVariant?: boolean; format?: string }, provider: string, category: string) => void;
  onDiagramGenerated?: (data: any) => void;
  onResourceActivate?: (resource: { name: string; file: string; type?: string; hasWhiteVariant?: boolean; format?: string }, provider: string, category: string) => void;
  currentDiagram?: any;
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

export function ResourceBrowser({ onResourceSelect, onDiagramGenerated, onResourceActivate, currentDiagram }: ResourceBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fullProviders, setFullProviders] = useState<Record<string, ResourceProvider>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [resourceIndex, setResourceIndex] = useState<ResourceIndex | null>(null);
  
  // AI Generation state
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();
  
  // Config state
  const [config, setConfig] = useState(ollamaConfig.get());
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  
  // Initialize state from cookies or defaults
  const savedState = getBrowserState();
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(savedState.expandedProviders)
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(savedState.expandedCategories)
  );
  const [viewMode, setViewMode] = useState<'normal' | 'compact'>(savedState.viewMode || 'normal');

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

        // Use saved state or default to Generic provider
        if (Object.keys(providers).length > 0) {
          let defaultProvider = 'generic'; // Default to Generic
          let newExpandedProviders = new Set<string>(savedState.expandedProviders);
          let newExpandedCategories = new Set<string>(savedState.expandedCategories);
          
          // If no saved state or Generic not available, use first available provider
          if (newExpandedProviders.size === 0 || !providers[defaultProvider]) {
            if (providers[defaultProvider]) {
              newExpandedProviders = new Set([defaultProvider]);
            } else {
              defaultProvider = Object.keys(providers)[0];
              newExpandedProviders = new Set([defaultProvider]);
            }
          }
          
          // Auto-expand some categories for the default/first provider
          const providerData = providers[Array.from(newExpandedProviders)[0]];
          if (providerData?.categories && newExpandedCategories.size === 0) {
            const categoriesToExpand = ['grouping', 'text', 'compute', 'database', 'network'];
            Object.keys(providerData.categories).forEach(categoryKey => {
              if (categoriesToExpand.includes(categoryKey)) {
                newExpandedCategories.add(`${Array.from(newExpandedProviders)[0]}-${categoryKey}`);
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
    
    // Save to cookie
    const currentState = getBrowserState();
    setBrowserState({
      ...currentState,
      expandedProviders: Array.from(newExpanded)
    });
  };

  const toggleCategory = (categoryKey: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
    
    // Save to cookie
    const currentState = getBrowserState();
    setBrowserState({
      ...currentState,
      expandedCategories: Array.from(newExpanded)
    });
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
    
    // Save to cookie
    const currentState = getBrowserState();
    setBrowserState({
      ...currentState,
      expandedProviders: Array.from(allProviders),
      expandedCategories: Array.from(allCategories)
    });
  };

  const collapseAll = () => {
    setExpandedProviders(new Set());
    setExpandedCategories(new Set());
    
    // Save to cookie
    const currentState = getBrowserState();
    setBrowserState({
      ...currentState,
      expandedProviders: [],
      expandedCategories: []
    });
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'normal' ? 'compact' : 'normal';
    setViewMode(newMode);
    
    // Save to cookie
    const currentState = getBrowserState();
    setBrowserState({
      ...currentState,
      viewMode: newMode
    });
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

  // AI Generation handler
  const handleGenerateClick = async () => {
    setIsGenerating(true);
    const { data, error } = await generateDiagram(description, currentDiagram);
    setIsGenerating(false);
    if (error || !data) {
      toast({
        variant: "destructive",
        title: "Error Generating Diagram",
        description: error || "An unknown error occurred.",
      });
    } else {
      onDiagramGenerated?.(data);
      setDescription('');
      toast({
        title: "Diagram Generated",
        description: "The diagram has been successfully generated from your description.",
      });
    }
  };

  // Connection test handler
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      const response = await fetch('/api/test-ollama-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setConnectionStatus({
          success: true,
          message: 'Connection successful'
        });
        toast({
          title: "Connection Test",
          description: "Successfully connected to Ollama server",
        });
      } else {
        setConnectionStatus({
          success: false,
          message: result.error || 'Connection failed'
        });
        toast({
          variant: "destructive",
          title: "Connection Test Failed",
          description: result.error || "Failed to connect to Ollama server",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionStatus({
        success: false,
        message: errorMessage
      });
      toast({
        variant: "destructive",
        title: "Connection Test Failed",
        description: errorMessage,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getResourceIcon = (resource: ResourceItem) => {
    // Return generic box icon (icon will be loaded from file)
    return <Box className="w-6 h-6" />;
  };

  const handleResourceClick = (resource: ResourceItem, provider: string, category: string) => {
    onResourceSelect(resource, provider, category);
  };

  const handleResourceActivate = (resource: ResourceItem, provider: string, category: string) => {
    onResourceActivate?.(resource, provider, category);
  };

return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* AI Generation */}
      <div className="p-4 border-b flex-shrink-0 bg-muted/30">
        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">AI Diagram Generation</div>
          <div className="flex gap-2">
            <textarea
              placeholder="Describe your diagram... e.g., 'A web server behind a load balancer with a database'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 min-h-[60px] px-3 py-2 text-sm border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
              rows={2}
            />
            <Button 
              onClick={handleGenerateClick} 
              disabled={isGenerating || !description.trim()}
              size="sm"
              className="px-3 py-2 h-auto whitespace-nowrap"
            >
              {isGenerating ? <Loader className="w-4 h-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button 
              onClick={handleTestConnection} 
              disabled={isTestingConnection}
              size="sm"
              variant="outline"
              className="px-3 py-2 h-auto whitespace-nowrap"
            >
              {isTestingConnection ? <Loader className="w-4 h-4 animate-spin" /> : "Test Connection"}
            </Button>
            {connectionStatus && (
              <div className={`text-xs px-2 py-1 rounded ${
                connectionStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {connectionStatus.message}
              </div>
            )}
          </div>
          
          {/* Config Editor */}
          <div className="mt-3">
            <Button 
              onClick={() => setIsEditingConfig(!isEditingConfig)}
              size="sm"
              variant="ghost"
              className="px-2 py-1 h-auto text-xs text-muted-foreground"
            >
              {isEditingConfig ? 'Hide Config' : 'Show Config'}
            </Button>
            {isEditingConfig && (
              <div className="mt-2 p-3 border rounded-md bg-muted/30 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">Base URL</label>
                    <Input
                      value={config.baseUrl}
                      onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                      className="h-8 text-xs"
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Model</label>
                    <Input
                      value={config.model}
                      onChange={(e) => setConfig({...config, model: e.target.value})}
                      className="h-8 text-xs"
                      placeholder="llama3.2"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      ollamaConfig.update(config);
                      toast({
                        title: "Config Updated",
                        description: "Ollama configuration has been updated",
                      });
                    }}
                    size="sm"
                    className="px-2 py-1 h-auto text-xs"
                  >
                    Save
                  </Button>
                  <Button 
                    onClick={() => {
                      setConfig(ollamaConfig.get());
                      setIsEditingConfig(false);
                    }}
                    size="sm"
                    variant="outline"
                    className="px-2 py-1 h-auto text-xs"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      ollamaConfig.reset();
                      setConfig(ollamaConfig.get());
                      toast({
                        title: "Config Reset",
                        description: "Configuration reset to defaults",
                      });
                    }}
                    size="sm"
                    variant="outline"
                    className="px-2 py-1 h-auto text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
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
              <TooltipProvider>
                {Object.entries(filteredProviders).map(([providerKey, provider]) => (
                  <div key={providerKey} className={`mb-2 rounded-md border ${getProviderTintClasses(providerKey)}`}>
                    <Collapsible open={expandedProviders.has(providerKey)} onOpenChange={() => toggleProvider(providerKey)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-3 h-auto hover:bg-accent/50 hover:text-accent-foreground touch-target"
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
                              <div key={categoryKey} className={`mb-1 rounded-md border ${getCategoryTintClasses(categoryKey)}`}>
                                <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(categoryFullKey)}>
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-between p-2 h-auto hover:bg-accent/40 hover:text-accent-foreground touch-target"
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
                                    <div className={`ml-4 grid touch-spacing ${
                                      viewMode === 'compact' 
                                        ? 'grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1 p-1' 
                                        : 'grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 p-2'
                                    }`}>
                                      {category.resources.map((resource, index) => (
                                        <DraggableResourceItem
                                          key={index}
                                          resource={resource}
                                          provider={providerKey}
                                          category={categoryKey}
                                          icon={getResourceIcon(resource)}
                                          onClick={() => handleResourceClick(resource, providerKey, categoryKey)}
                                          onDoubleClick={() => handleResourceActivate(resource, providerKey, categoryKey)}
                                          viewMode={viewMode}
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
                ))}
              </TooltipProvider>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}