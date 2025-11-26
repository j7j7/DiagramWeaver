# Layers System Implementation Plan

## Overview
This document outlines the comprehensive implementation of a user-defined layers system for the DiagramWeaver editor. The layers system will allow users to organize diagram items into logical layers, with a floating layers panel for management.

## Requirements Summary
- User-defined layers with default 'background' layer
- Floating layers menu that can be toggled on/off
- Add/remove layers functionality
- Assign items to layers (single and multiple selection)
- Show current layer of selected items
- Layer information stored in JSON format
- Backward compatibility with existing diagrams
- Layer deletion moves items to 'background' layer

## Architecture Analysis

### Current Data Structure
The system uses two main data formats:
1. **Flat Format** (`DiagramData`): nodes, connections, zones arrays
2. **Hierarchical Format** (`HierarchicalDiagramData`): nested zones with children

### Key Components to Modify
- **Types**: Add layer property to item interfaces
- **Schemas**: Update validation schemas
- **State Management**: Add layers state to diagram editor
- **UI Components**: Create layers panel and integrate with existing components
- **Hooks**: Add layer management hooks
- **Data Conversion**: Update hierarchy conversion functions

## Implementation Steps

### Phase 1: Core Data Structure Updates

#### 1.1 Type Definitions (`src/lib/types.ts`)
**Changes Required:**
- Add `layer?: string` property to `DiagramNodeData` interface
- Add `layer?: string` property to `DiagramZoneData` interface  
- Add `layer?: string` property to `DiagramNodeItem` interface
- Add `layer?: string` property to `DiagramZoneItem` interface
- Add new interfaces for layer management:
  ```typescript
  export interface LayerInfo {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    color?: string; // Optional layer color for visualization
  }
  
  export interface LayersConfig {
    layers: LayerInfo[];
    activeLayerId: string;
    defaultLayerId: string; // Always 'background'
  }
  ```

#### 1.2 Schema Updates (`src/lib/schemas.ts`)
**Changes Required:**
- Add `layer: z.string().optional()` to `DiagramNodeDataSchema`
- Add `layer: z.string().optional()` to `DiagramGroupDataSchema`
- Add `layer: z.string().optional()` to `DiagramNodeItemSchema`
- Add `layer: z.string().optional()` to `DiagramGroupItemSchema`
- Create schemas for `LayerInfo` and `LayersConfig`

#### 1.3 Diagram Data Structure Updates
**Changes Required:**
- Add `layers?: LayersConfig` to `DiagramData` interface
- Add `layers?: LayersConfig` to `HierarchicalDiagramData` interface
- Update default layer assignment logic

### Phase 2: Layer Management Logic

#### 2.1 Layer Utilities (`src/lib/layers-utils.ts`)
**New File - Functions to Implement:**
```typescript
// Get default layer configuration
export function getDefaultLayersConfig(): LayersConfig

// Ensure layer exists in config
export function ensureLayerExists(config: LayersConfig, layerName: string): LayersConfig

// Get layer for an item (fallback to 'background')
export function getItemLayer(item: any): string

// Set layer for an item
export function setItemLayer(item: any, layerId: string): any

// Move items to different layer
export function moveItemsToLayer(items: any[], layerId: string): any[]

// Remove layer and move items to background
export function removeLayer(config: LayersConfig, layerId: string): LayersConfig

// Get all items in a specific layer
export function getItemsInLayer(diagramData: DiagramData, layerId: string): any[]

// Validate layer configuration
export function validateLayersConfig(config: LayersConfig): boolean
```

#### 2.2 Data Conversion Updates (`src/lib/nested-hierarchy.ts`)
**Changes Required:**
- Update `convertToNestedHierarchy()` to preserve layer information
- Update `convertFromNestedHierarchy()` to preserve layer information
- Add layer migration logic for legacy diagrams (no layer property = background)

### Phase 3: State Management Integration

#### 3.1 Layers State Hook (`src/hooks/use-layers.ts`)
**New File - Hook to Implement:**
```typescript
export function useLayers(diagramData: DiagramData, setDiagramData: Function) {
  // State for layers configuration
  const [layersConfig, setLayersConfig] = useState<LayersConfig>(getDefaultLayersConfig())
  
  // State for layers panel visibility
  const [layersPanelOpen, setLayersPanelOpen] = useState(false)
  
  // Functions:
  // - addLayer(name: string)
  // - removeLayer(layerId: string)
  // - renameLayer(layerId: string, newName: string)
  // - toggleLayerVisibility(layerId: string)
  // - toggleLayerLock(layerId: string)
  // - setActiveLayer(layerId: string)
  // - assignItemsToLayer(itemIds: string[], layerId: string)
  // - getItemsLayer(itemId: string)
  // - migrateLegacyItems()
  
  return {
    layersConfig,
    layersPanelOpen,
    setLayersPanelOpen,
    // ... all functions
  }
}
```

#### 3.2 Diagram Editor Integration (`src/components/diagram-editor.tsx`)
**Changes Required:**
- Import and initialize `useLayers` hook
- Add layers state to component
- Pass layers props to `EditorCanvas`
- Add layers panel toggle to top menu bar
- Integrate layers with selection system

### Phase 4: UI Components

#### 4.1 Layers Panel (`src/components/editor/layers-panel.tsx`)
**New File - Component Features:**
- Floating panel with drag capability
- Layer list with visibility/lock toggles
- Add new layer button
- Delete layer button (with confirmation)
- Layer rename functionality
- Active layer indicator
- Selected items layer display
- Drag-and-drop layer reordering
- Layer color picker (optional)

#### 4.2 Layer Item Badge (`src/components/editor/layer-item-badge.tsx`)
**New File - Component Features:**
- Small badge showing item's layer
- Color-coded by layer
- Click to change layer
- Shows in context toolbar and selection info

#### 4.3 Editor Canvas Updates (`src/components/editor/editor-canvas.tsx`)
**Changes Required:**
- Add layers filtering to rendering logic
- Respect layer visibility/lock states
- Pass layer information to child components
- Handle layer-based selection restrictions

#### 4.4 Context Menu Updates (`src/components/editor/context-toolbar.tsx`)
**Changes Required:**
- Add "Assign to Layer" submenu
- Show current layer of selected items
- Quick layer assignment options

### Phase 5: Integration with Existing Systems

#### 5.1 Selection System Updates (`src/hooks/use-canvas-selection.ts`)
**Changes Required:**
- Filter selection by visible layers
- Prevent selection of locked layers
- Update selection highlighting to respect layer visibility

#### 5.2 Drag & Drop Updates (`src/hooks/use-canvas-drag-drop.ts`)
**Changes Required:**
- Prevent dragging items in locked layers
- Maintain layer information during drag operations
- Update drop zones to respect layer filtering

#### 5.3 Clipboard Updates (`src/hooks/use-canvas-clipboard.ts`)
**Changes Required:**
- Preserve layer information in copied items
- Handle paste operations with layer validation
- Prevent pasting into locked layers

#### 5.4 Export Updates (`src/hooks/use-canvas-export.ts`)
**Changes Required:**
- Include layer configuration in exported data
- Filter export by visible layers (optionally)
- Maintain backward compatibility

### Phase 6: Visual Enhancements

#### 6.1 Layer Visualization
**Features to Implement:**
- Optional layer color overlay
- Layer-based z-index control
- Visual indication of locked layers
- Layer opacity controls

#### 6.2 Canvas Rendering Updates
**Changes Required:**
- Render items in layer order
- Apply layer visibility filters
- Handle layer-based styling
- Optimize rendering for large layer counts

### Phase 7: Testing & Validation

#### 7.1 Unit Tests
**Test Coverage Required:**
- Layer utility functions
- Layer state management
- Data conversion with layers
- Layer assignment operations

#### 7.2 Integration Tests
**Test Scenarios Required:**
- Create new diagram with layers
- Load legacy diagram (migration)
- Add/remove layers operations
- Multi-selection layer assignment
- Layer deletion with item migration
- Save/load with layers

#### 7.3 User Experience Testing
**Validation Points:**
- Intuitive layer panel interaction
- Performance with many layers
- Clear visual feedback
- Backward compatibility verification

## Implementation Order & Dependencies

### Critical Path
1. **Phase 1** (Data Structures) - Foundation for everything
2. **Phase 2** (Layer Utilities) - Core logic
3. **Phase 3** (State Management) - Integration layer
4. **Phase 4** (UI Components) - User interface
5. **Phase 5** (System Integration) - Full functionality
6. **Phase 6** (Visual Enhancements) - Polish
7. **Phase 7** (Testing) - Quality assurance

### Parallel Development Opportunities
- **Phase 4.1** (Layers Panel) can be developed alongside Phase 3
- **Phase 5** integrations can happen in parallel once Phase 4 is complete
- **Phase 6** visual enhancements can be iterative

## Risk Mitigation

### Backward Compatibility
- All existing diagrams will default to 'background' layer
- Layer property is optional in all interfaces
- Migration functions handle legacy data gracefully
- Export/import maintains compatibility

### Performance Considerations
- Layer filtering implemented at render level
- Efficient layer lookup using Maps
- Minimal re-renders through proper state management
- Lazy loading for large layer counts

### User Experience
- Default layer panel position and size
- Keyboard shortcuts for common layer operations
- Clear visual hierarchy in layer panel
- Intuitive drag-and-drop interactions

## File Structure Changes

### New Files
```
src/
├── lib/
│   └── layers-utils.ts
├── hooks/
│   └── use-layers.ts
└── components/editor/
    ├── layers-panel.tsx
    └── layer-item-badge.tsx
```

### Modified Files
```
src/
├── lib/
│   ├── types.ts
│   ├── schemas.ts
│   └── nested-hierarchy.ts
├── hooks/
│   ├── use-canvas-selection.ts
│   ├── use-canvas-drag-drop.ts
│   ├── use-canvas-clipboard.ts
│   └── use-canvas-export.ts
├── components/
│   ├── diagram-editor.tsx
│   └── editor/
│       ├── editor-canvas.tsx
│       ├── context-toolbar.tsx
│       └── top-menu-bar.tsx
```

## Success Criteria

### Functional Requirements
✅ Users can create custom layers
✅ Items can be assigned to layers (single/multiple)
✅ Layer panel shows/hides correctly
✅ Selected items display their layer
✅ Layer deletion moves items to background
✅ Legacy diagrams load without layers
✅ Save/load preserves layer information

### Non-Functional Requirements
✅ No performance degradation
✅ Intuitive user interface
✅ Backward compatibility maintained
✅ Clean, maintainable code
✅ Comprehensive test coverage

## Timeline Estimate

### Development Phases
- **Phase 1-2**: 2-3 days (Data structures & utilities)
- **Phase 3-4**: 3-4 days (State management & UI)
- **Phase 5**: 2-3 days (System integration)
- **Phase 6**: 1-2 days (Visual enhancements)
- **Phase 7**: 2-3 days (Testing & validation)

**Total Estimated Time: 10-15 days**

## Next Steps

1. **Immediate**: Begin Phase 1 with type definitions and schema updates
2. **Priority**: Complete Phase 2 utilities before moving to UI
3. **Validation**: Test each phase independently before integration
4. **Documentation**: Update README and user guides once complete

---

*This plan will be updated as implementation progresses and new requirements or challenges are identified.*