import type { LayersConfig, LayerInfo, DiagramData, DiagramNodeData, DiagramZoneData, DiagramNodeItem, DiagramZoneItem } from './types';

export const DEFAULT_LAYER_ID = 'background';
export const DEFAULT_LAYER_NAME = 'Background';

/**
 * Get default layer configuration
 */
export function getDefaultLayersConfig(): LayersConfig {
  return {
    layers: [
      {
        id: DEFAULT_LAYER_ID,
        name: DEFAULT_LAYER_NAME,
        visible: true,
        locked: false,
        color: '#f3f4f6'
      }
    ],
    activeLayerId: DEFAULT_LAYER_ID,
    defaultLayerId: DEFAULT_LAYER_ID
  };
}

/**
 * Ensure layer exists in config, add if it doesn't
 */
export function ensureLayerExists(config: LayersConfig, layerName: string): LayersConfig {
  const existingLayer = config.layers.find(layer => layer.name === layerName);
  
  if (existingLayer) {
    return config;
  }

  const newLayer: LayerInfo = {
    id: layerName.toLowerCase().replace(/\s+/g, '-'),
    name: layerName,
    visible: true,
    locked: false,
    color: generateLayerColor(config.layers)
  };

  return {
    ...config,
    layers: [...config.layers, newLayer]
  };
}

/**
 * Get layer for an item (fallback to 'background')
 */
export function getItemLayer(item: DiagramNodeData | DiagramZoneData | DiagramNodeItem | DiagramZoneItem): string {
  return item.layer || DEFAULT_LAYER_ID;
}

/**
 * Set layer for an item
 */
export function setItemLayer(
  item: DiagramNodeData | DiagramZoneData | DiagramNodeItem | DiagramZoneItem,
  layerId: string
): DiagramNodeData | DiagramZoneData | DiagramNodeItem | DiagramZoneItem {
  return {
    ...item,
    layer: layerId
  };
}

/**
 * Move items to different layer
 */
export function moveItemsToLayer(
  items: (DiagramNodeData | DiagramZoneData | DiagramNodeItem | DiagramZoneItem)[],
  layerId: string
): (DiagramNodeData | DiagramZoneData | DiagramNodeItem | DiagramZoneItem)[] {
  return items.map(item => setItemLayer(item, layerId));
}

/**
 * Remove layer and move items to background
 */
export function removeLayer(config: LayersConfig, layerId: string): LayersConfig {
  if (layerId === config.defaultLayerId) {
    throw new Error('Cannot remove the default background layer');
  }

  // Set active layer to default if removing active layer
  const newActiveLayerId = config.activeLayerId === layerId ? config.defaultLayerId : config.activeLayerId;

  return {
    ...config,
    layers: config.layers.filter(layer => layer.id !== layerId),
    activeLayerId: newActiveLayerId
  };
}

/**
 * Get all items in a specific layer
 */
export function getItemsInLayer(diagramData: DiagramData, layerId: string): {
  nodes: DiagramNodeData[];
  zones: DiagramZoneData[];
} {
  const nodes = diagramData.nodes.filter(node => getItemLayer(node) === layerId);
  const zones = diagramData.zones.filter(zone => getItemLayer(zone) === layerId);

  return { nodes, zones };
}

/**
 * Validate layer configuration
 */
export function validateLayersConfig(config: LayersConfig): boolean {
  // Check required properties
  if (!config.layers || !Array.isArray(config.layers)) {
    return false;
  }

  if (!config.activeLayerId || !config.defaultLayerId) {
    return false;
  }

  // Check that default layer exists
  const defaultLayerExists = config.layers.some(layer => layer.id === config.defaultLayerId);
  if (!defaultLayerExists) {
    return false;
  }

  // Check that active layer exists
  const activeLayerExists = config.layers.some(layer => layer.id === config.activeLayerId);
  if (!activeLayerExists) {
    return false;
  }

  // Validate each layer
  for (const layer of config.layers) {
    if (!layer.id || !layer.name || typeof layer.visible !== 'boolean' || typeof layer.locked !== 'boolean') {
      return false;
    }
  }

  // Check for duplicate layer IDs
  const layerIds = config.layers.map(layer => layer.id);
  const uniqueIds = new Set(layerIds);
  if (layerIds.length !== uniqueIds.size) {
    return false;
  }

  // Check for duplicate layer names
  const layerNames = config.layers.map(layer => layer.name);
  const uniqueNames = new Set(layerNames);
  if (layerNames.length !== uniqueNames.size) {
    return false;
  }

  return true;
}

/**
 * Generate a color for a new layer based on index
 */
function generateLayerColor(existingLayers: LayerInfo[]): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f43f5e', // rose
    '#84cc16', // lime
  ];

  // Get colors already used by existing layers
  const usedColors = existingLayers.map(layer => layer.color);
  
  // Find first unused color
  for (const color of colors) {
    if (!usedColors.includes(color)) {
      return color;
    }
  }
  
  // If all colors are used, generate a random one
  const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  return randomColor;
}

/**
 * Get layer by ID
 */
export function getLayerById(config: LayersConfig, layerId: string): LayerInfo | undefined {
  return config.layers.find(layer => layer.id === layerId);
}

/**
 * Get layer by name
 */
export function getLayerByName(config: LayersConfig, layerName: string): LayerInfo | undefined {
  return config.layers.find(layer => layer.name === layerName);
}

/**
 * Add a new layer to the configuration
 */
export function addLayer(config: LayersConfig, layerName: string): LayersConfig {
  // Check if layer name already exists
  if (getLayerByName(config, layerName)) {
    throw new Error(`Layer with name "${layerName}" already exists`);
  }

  const newLayer: LayerInfo = {
    id: layerName.toLowerCase().replace(/\s+/g, '-'),
    name: layerName,
    visible: true,
    locked: false,
    color: generateLayerColor(config.layers)
  };

  return {
    ...config,
    layers: [...config.layers, newLayer],
    activeLayerId: newLayer.id
  };
}

/**
 * Rename a layer
 */
export function renameLayer(config: LayersConfig, layerId: string, newName: string): LayersConfig {
  if (layerId === config.defaultLayerId) {
    throw new Error('Cannot rename the default background layer');
  }

  // Check if new name already exists
  if (getLayerByName(config, newName)) {
    throw new Error(`Layer with name "${newName}" already exists`);
  }

  return {
    ...config,
    layers: config.layers.map(layer => 
      layer.id === layerId ? { ...layer, name: newName } : layer
    )
  };
}

/**
 * Toggle layer visibility
 */
export function toggleLayerVisibility(config: LayersConfig, layerId: string): LayersConfig {
  if (layerId === config.defaultLayerId) {
    throw new Error('Cannot hide the default background layer');
  }

  return {
    ...config,
    layers: config.layers.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    )
  };
}

/**
 * Toggle layer lock state
 */
export function toggleLayerLock(config: LayersConfig, layerId: string): LayersConfig {
  if (layerId === config.defaultLayerId) {
    throw new Error('Cannot lock the default background layer');
  }

  return {
    ...config,
    layers: config.layers.map(layer => 
      layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
    )
  };
}

/**
 * Set active layer
 */
export function setActiveLayer(config: LayersConfig, layerId: string): LayersConfig {
  const layer = getLayerById(config, layerId);
  if (!layer) {
    throw new Error(`Layer with ID "${layerId}" not found`);
  }

  return {
    ...config,
    activeLayerId: layerId
  };
}

/**
 * Check if a layer is visible
 */
export function isLayerVisible(config: LayersConfig, layerId: string): boolean {
  const layer = getLayerById(config, layerId);
  return layer ? layer.visible : true; // Default to visible if layer not found
}

/**
 * Check if a layer is locked
 */
export function isLayerLocked(config: LayersConfig, layerId: string): boolean {
  const layer = getLayerById(config, layerId);
  return layer ? layer.locked : false; // Default to unlocked if layer not found
}

/**
 * Migrate legacy items (without layer property) to background layer
 */
export function migrateLegacyItems(diagramData: DiagramData): DiagramData {
  const hasLayers = diagramData.layers && diagramData.layers.layers.length > 0;
  
  if (!hasLayers) {
    // Add default layers configuration
    return {
      ...diagramData,
      layers: getDefaultLayersConfig()
    };
  }

  // Items without layer property are already considered to be in background layer
  // No migration needed for individual items
  return diagramData;
}

/**
 * Filter diagram data by visible layers
 */
export function filterByVisibleLayers(diagramData: DiagramData): DiagramData {
  if (!diagramData.layers) {
    return diagramData;
  }

  const visibleLayerIds = diagramData.layers.layers
    .filter(layer => layer.visible)
    .map(layer => layer.id);

  return {
    ...diagramData,
    nodes: diagramData.nodes.filter(node => 
      visibleLayerIds.includes(getItemLayer(node))
    ),
    zones: diagramData.zones.filter(zone => 
      visibleLayerIds.includes(getItemLayer(zone))
    )
  };
}