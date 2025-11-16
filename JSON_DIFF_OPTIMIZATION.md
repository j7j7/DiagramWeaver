# JSON Diff Optimization Implementation

## Summary

I've successfully implemented an optimization for the JSON panel that prevents full refreshes when values change on the canvas. Here's what was implemented:

## Key Changes

### 1. Created JSON Diff System (`src/lib/json-diff.ts`)
- **Hierarchical Diff Algorithm**: Computes differences between old and new hierarchical diagram data
- **Selective Updates**: Converts diffs to JSON Patch operations for minimal updates
- **Deep Equality Checking**: Efficient comparison of nested objects and arrays
- **Path Generation**: Converts diff changes to JSON Pointer paths for targeted updates

### 2. Enhanced JSON Editor Panel (`src/components/editor/json-editor-panel.tsx`)
- **Previous Data Tracking**: Stores references to previous data for comparison
- **Selective Update Logic**: Only applies targeted updates for small changes (< 10 diffs)
- **Fallback to Full Refresh**: Uses full refresh for major changes or when selective updates fail
- **Scroll Position Preservation**: Maintains editor scroll position during updates
- **Update Flag Management**: Prevents recursive updates during editor changes

## How It Works

1. **Canvas Change Detection**: When a value changes on the canvas, the diagram data updates
2. **Diff Computation**: Compare previous hierarchical data with new data
3. **Selective Update Decision**: If changes are minimal (< 10 diffs), use selective updates
4. **Targeted JSON Updates**: Apply JSON Patch operations to only changed sections
5. **Scroll Preservation**: Maintain user's scroll position in the JSON editor
6. **Fallback**: For major changes, fall back to full refresh

## Performance Benefits

- **Reduced Re-renders**: Only updates changed JSON sections instead of entire document
- **Scroll Preservation**: User doesn't lose their place in large JSON files
- **Faster Updates**: Minimal DOM manipulation for small changes
- **Memory Efficient**: Avoids recreating entire JSON string for minor changes

## Hierarchical Data Support

The system properly handles:
- **Nested Zones**: Zones containing other zones and nodes
- **Node Properties**: All node styling and positioning properties
- **Connection Changes**: Added, removed, or modified connections
- **Order Changes**: Detects when children are reordered within zones
- **Property Changes**: Identifies specific property modifications

## Thresholds and Fallbacks

- **Selective Update Threshold**: < 10 diffs triggers selective updates
- **Fallback Conditions**: 
  - Major changes (>= 10 diffs)
  - Selective update failures
  - Initial data load
  - Type conversion issues

## Implementation Details

### Diff Types Supported
- `zone`: Zone property changes
- `node`: Node property changes  
- `connection`: Connection changes
- `zone_structure`: Zone hierarchy changes
- `connection_structure`: Connection array changes

### JSON Patch Operations
- `replace`: Update existing values
- `add`: Insert new items
- `remove`: Delete existing items

### Path Resolution
- Converts hierarchical changes to JSON Pointer paths
- Handles nested zone structures
- Supports array index navigation

This implementation significantly improves the user experience when working with large diagrams by preventing jarring full refreshes of the JSON panel when making small changes on the canvas.