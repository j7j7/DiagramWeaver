import { useState, useCallback, useEffect } from 'react';
import type { DiagramData, LayersConfig, LayerInfo } from '@/lib/types';
import { 
  getDefaultLayersConfig, 
  ensureLayerExists, 
  getItemLayer, 
  setItemLayer, 
  moveItemsToLayer, 
  removeLayer, 
  getItemsInLayer, 
  validateLayersConfig,
  getLayerById,
  getLayerByName,
  addLayer,
  renameLayer,
  toggleLayerVisibility,
  toggleLayerLock,
  setActiveLayer,
  isLayerVisible,
  isLayerLocked,
  migrateLegacyItems,
  filterByVisibleLayers,
  DEFAULT_LAYER_ID
} from '@/lib/layers-utils';

interface UseLayersOptions {
  diagramData: DiagramData;
  setDiagramData: React.Dispatch<React.SetStateAction<DiagramData>>;
  toast?: (options: { variant?: 'destructive' | 'default'; title: string; description: string }) => void;
}

export function useLayers({ diagramData, setDiagramData, toast }: UseLayersOptions) {
  // Initialize layers config from diagram data or default
  const [layersConfig, setLayersConfig] = useState<LayersConfig>(() => {
    if (diagramData.layers && validateLayersConfig(diagramData.layers)) {
      return diagramData.layers;
    }
    return getDefaultLayersConfig();
  });

  // State for layers panel visibility
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);

  // Sync layers config with diagram data
  useEffect(() => {
    if (diagramData.layers && validateLayersConfig(diagramData.layers)) {
      setLayersConfig(diagramData.layers);
    }
  }, [diagramData.layers]);

  // Update diagram data when layers config changes
  const updateDiagramDataWithLayers = useCallback((newLayersConfig: LayersConfig) => {
    setDiagramData(prevData => ({
      ...prevData,
      layers: newLayersConfig
    }));
  }, [setDiagramData]);

  // Add a new layer
  const addNewLayer = useCallback((layerName: string) => {
    try {
      const newConfig = addLayer(layersConfig, layerName);
      setLayersConfig(newConfig);
      updateDiagramDataWithLayers(newConfig);
      
      toast?.({
        variant: 'default',
        title: 'Layer Added',
        description: `Layer "${layerName}" has been created.`
      });
    } catch (error) {
      toast?.({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add layer'
      });
    }
  }, [layersConfig, updateDiagramDataWithLayers, toast]);

  // Remove a layer
  const removeLayerById = useCallback((layerId: string) => {
    try {
      if (layerId === DEFAULT_LAYER_ID) {
        throw new Error('Cannot remove the default background layer');
      }

      const newConfig = removeLayer(layersConfig, layerId);
      setLayersConfig(newConfig);
      
      // Move all items from the removed layer to background
      setDiagramData(prevData => {
        const { nodes, zones } = getItemsInLayer(prevData, layerId);
        const updatedNodes = prevData.nodes.map(node => 
          nodes.find(n => n.id === node.id) ? setItemLayer(node, DEFAULT_LAYER_ID) : node
        );
        const updatedZones = prevData.zones.map(zone => 
          zones.find(z => z.id === zone.id) ? setItemLayer(zone, DEFAULT_LAYER_ID) : zone
        );

        return {
          ...prevData,
          nodes: updatedNodes,
          zones: updatedZones,
          layers: newConfig
        };
      });

      toast?.({
        variant: 'default',
        title: 'Layer Removed',
        description: 'Layer has been removed and items moved to background.'
      });
    } catch (error) {
      toast?.({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove layer'
      });
    }
  }, [layersConfig, setDiagramData, toast]);

  // Rename a layer
  const renameLayerById = useCallback((layerId: string, newName: string) => {
    try {
      const newConfig = renameLayer(layersConfig, layerId, newName);
      setLayersConfig(newConfig);
      updateDiagramDataWithLayers(newConfig);
      
      toast?.({
        variant: 'default',
        title: 'Layer Renamed',
        description: `Layer has been renamed to "${newName}".`
      });
    } catch (error) {
      toast?.({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to rename layer'
      });
    }
  }, [layersConfig, updateDiagramDataWithLayers, toast]);

  // Toggle layer visibility
  const toggleLayerVisibilityById = useCallback((layerId: string) => {
    try {
      const newConfig = toggleLayerVisibility(layersConfig, layerId);
      setLayersConfig(newConfig);
      updateDiagramDataWithLayers(newConfig);
    } catch (error) {
      toast?.({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle layer visibility'
      });
    }
  }, [layersConfig, updateDiagramDataWithLayers, toast]);

  // Toggle layer lock state
  const toggleLayerLockById = useCallback((layerId: string) => {
    try {
      const newConfig = toggleLayerLock(layersConfig, layerId);
      setLayersConfig(newConfig);
      updateDiagramDataWithLayers(newConfig);
    } catch (error) {
      toast?.({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle layer lock'
      });
    }
  }, [layersConfig, updateDiagramDataWithLayers, toast]);

  // Set active layer
  const setActiveLayerById = useCallback((layerId: string) => {
    try {
      const newConfig = setActiveLayer(layersConfig, layerId);
      setLayersConfig(newConfig);
      updateDiagramDataWithLayers(newConfig);
    } catch (error) {
      toast?.({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to set active layer'
      });
    }
  }, [layersConfig, updateDiagramDataWithLayers, toast]);

  // Assign items to a layer
  const assignItemsToLayer = useCallback((itemIds: string[], layerId: string) => {
    setDiagramData(prevData => {
      const updatedNodes = prevData.nodes.map(node => 
        itemIds.includes(node.id) ? setItemLayer(node, layerId) : node
      );
      const updatedZones = prevData.zones.map(zone => 
        itemIds.includes(zone.id) ? setItemLayer(zone, layerId) : zone
      );

      return {
        ...prevData,
        nodes: updatedNodes,
        zones: updatedZones
      };
    });

    toast?.({
      variant: 'default',
      title: 'Items Assigned',
      description: `${itemIds.length} item(s) assigned to layer.`
    });
  }, [setDiagramData, toast]);

  // Get layer for a specific item
  const getItemLayerById = useCallback((itemId: string): string => {
    const node = diagramData.nodes.find(n => n.id === itemId);
    if (node) {
      return getItemLayer(node);
    }

    const zone = diagramData.zones.find(z => z.id === itemId);
    if (zone) {
      return getItemLayer(zone);
    }

    return DEFAULT_LAYER_ID;
  }, [diagramData]);

  // Get items in a specific layer
  const getLayerItems = useCallback((layerId: string) => {
    return getItemsInLayer(diagramData, layerId);
  }, [diagramData]);

  // Check if layer is visible
  const isLayerVisibleById = useCallback((layerId: string) => {
    return isLayerVisible(layersConfig, layerId);
  }, [layersConfig]);

  // Check if layer is locked
  const isLayerLockedById = useCallback((layerId: string) => {
    return isLayerLocked(layersConfig, layerId);
  }, [layersConfig]);

  // Get layer by ID
  const getLayer = useCallback((layerId: string) => {
    return getLayerById(layersConfig, layerId);
  }, [layersConfig]);

  // Get layer by name
  const getLayerByNameFunc = useCallback((layerName: string) => {
    return getLayerByName(layersConfig, layerName);
  }, [layersConfig]);

  // Migrate legacy items to background layer
  const migrateLegacy = useCallback(() => {
    const migratedData = migrateLegacyItems(diagramData);
    if (migratedData !== diagramData) {
      setDiagramData(migratedData);
      toast?.({
        variant: 'default',
        title: 'Migration Complete',
        description: 'Legacy items have been migrated to background layer.'
      });
    }
  }, [diagramData, setDiagramData, toast]);

  // Filter diagram data by visible layers
  const getFilteredDiagramData = useCallback(() => {
    return filterByVisibleLayers(diagramData);
  }, [diagramData]);

  // Update active layer based on selected items
  const updateActiveLayerFromSelection = useCallback((itemIds: Set<string>) => {
    if (itemIds.size === 0) return;
    
    // Get the layer of the first selected item
    const firstItemId = Array.from(itemIds)[0];
    const itemLayer = getItemLayerById(firstItemId);
    
    // Set the active layer to the layer of the selected item
    if (itemLayer !== layersConfig.activeLayerId) {
      const newConfig = setActiveLayer(layersConfig, itemLayer);
      setLayersConfig(newConfig);
      updateDiagramDataWithLayers(newConfig);
    }
  }, [getItemLayerById, layersConfig, updateDiagramDataWithLayers]);

  // Toggle layers panel
  const toggleLayersPanel = useCallback(() => {
    setLayersPanelOpen(prev => !prev);
  }, []);

  // Get all layers sorted by order (background first, then by creation)
  const getAllLayers = useCallback((): LayerInfo[] => {
    const backgroundLayer = layersConfig.layers.find(l => l.id === DEFAULT_LAYER_ID);
    const otherLayers = layersConfig.layers
      .filter(l => l.id !== DEFAULT_LAYER_ID)
      .sort((a, b) => a.id.localeCompare(b.id));

    return backgroundLayer ? [backgroundLayer, ...otherLayers] : otherLayers;
  }, [layersConfig]);

  // Get active layer info
  const getActiveLayer = useCallback((): LayerInfo | undefined => {
    return getLayerById(layersConfig, layersConfig.activeLayerId);
  }, [layersConfig]);

  // Reorder layers
  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    const newLayers = [...layersConfig.layers];
    const [movedLayer] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, movedLayer);

    const newConfig = {
      ...layersConfig,
      layers: newLayers
    };

    setLayersConfig(newConfig);
    updateDiagramDataWithLayers(newConfig);
  }, [layersConfig, updateDiagramDataWithLayers]);

  return {
    // State
    layersConfig,
    layersPanelOpen,
    setLayersPanelOpen,
    
    // Layer management
    addNewLayer,
    removeLayerById,
    renameLayerById,
    toggleLayerVisibilityById,
    toggleLayerLockById,
    setActiveLayerById,
    reorderLayers,
    
    // Item operations
    assignItemsToLayer,
    getItemLayerById,
    getLayerItems,
    
    // Queries
    getAllLayers,
    getActiveLayer,
    getLayer,
    getLayerByName: getLayerByNameFunc,
    isLayerVisibleById,
    isLayerLockedById,
    
    // Data operations
    getFilteredDiagramData,
    migrateLegacy,
    
    // UI
    toggleLayersPanel,
    updateActiveLayerFromSelection
  };
}