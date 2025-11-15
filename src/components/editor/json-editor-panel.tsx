'use client';

import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { HierarchicalDiagramDataSchema } from '@/lib/schemas';
import { debounce, stableStringify } from '@/lib/json-utils';
import { expandResourceType } from '@/lib/type-matcher';
import type { DiagramData, DiagramGroupData, HierarchicalDiagramData } from '@/lib/types';
import { convertToNestedHierarchy, convertFromNestedHierarchy } from '@/lib/nested-hierarchy';

type Props = {
  value: DiagramData;
  onValidJsonChange: (data: DiagramData) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  widthPx: number;
};

export function JsonEditorPanel({
  value,
  onValidJsonChange,
  isOpen,
  onToggleOpen,
  widthPx,
}: Props) {
  const [text, setText] = React.useState(() => stableStringify(value));
  const [error, setError] = React.useState<string | null>(null);
  const editorRef = React.useRef<any>(null);
  const lastExternalJsonRef = React.useRef<string>(stableStringify(value));
  const changeFromEditorRef = React.useRef(false);

  // Sync from external value changes (e.g., canvas updates) when not actively editing
  React.useEffect(() => {
    try {
      // Convert flat data to nested format for display in editor
      const nestedData = convertToNestedHierarchy(value);
      const next = stableStringify(nestedData);
      
      if (!changeFromEditorRef.current && next !== lastExternalJsonRef.current) {
        lastExternalJsonRef.current = next;
        setText(next);
      }
    } catch (error) {
      console.error('Error converting to nested hierarchy:', error);
      // If conversion fails, try to display as-is
      const fallback = stableStringify(value);
      if (!changeFromEditorRef.current && fallback !== lastExternalJsonRef.current) {
        lastExternalJsonRef.current = fallback;
        setText(fallback);
      }
    }
  }, [value]);

  const emitValid = React.useMemo(
    () => debounce((parsed: DiagramData) => onValidJsonChange(parsed), 300),
    [onValidJsonChange]
  );

const handleChange = async (newText: string) => {
    changeFromEditorRef.current = true;
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      
      // Expand abbreviated types in nodes before validation
      const expandedData = await expandAbbreviatedTypes(parsed);
      
      let finalData: DiagramData | null = null;
      let validationError: any = null;

      // Only validate as nested format
      const validationResult = HierarchicalDiagramDataSchema.safeParse(expandedData);
      
      if (validationResult.success) {
        // Convert nested to flat for application
        finalData = convertFromNestedHierarchy(expandedData);
      } else {
        validationError = validationResult.error;
      }
      
      if (!validationError && finalData) {
        setError(null);
        emitValid(finalData);
        
        // Keep the original nested format for display
        const displayText = stableStringify(expandedData);
        if (displayText !== newText) {
          setText(displayText);
        }
      } else {
        const errorMessage = validationError.issues
          .map((issue: any) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        setError(`Schema validation failed: ${errorMessage}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Invalid JSON');
    } finally {
      // Allow external syncs after this microtask
      queueMicrotask(() => { 
        changeFromEditorRef.current = false; 
      });
    }
  };

  // Check if data is in nested format (has groups with nested children)
  const isNestedFormat = (data: any): boolean => {
    console.log('Checking nested format for data:', data);
    
    // Check for nested format in zones
    const zones = data.zones;
    console.log('Zones found:', zones);
    
    if (!zones || !Array.isArray(zones)) {
      console.log('No zones array found');
      return false;
    }
    
    // Consider it nested if we have zones array OR if any zone has zone type
    const hasZonesArray = !!data.zones;
    const hasZoneTypeItems = zones.some((zone: any) => zone.type === 'zone');
    
    const isNested = hasZonesArray || hasZoneTypeItems;
    console.log('Has zones array:', hasZonesArray, 'Has zone type items:', hasZoneTypeItems, 'Is nested format:', isNested);
    return isNested;
  };

  // Convert nested format to flat format for validation
  const convertNestedToFlatForValidation = (data: any): any => {
    if (!isNestedFormat(data)) {
      console.log('Data is not nested format, returning as-is');
      return data;
    }
    
    try {
      console.log('Converting nested to flat format...');
      const nestedData = data as HierarchicalDiagramData;
      const flatData = convertFromNestedHierarchy(nestedData);
      console.log('Converted flat data:', flatData);
      return flatData;
    } catch (error) {
      console.error('Error converting nested to flat format:', error);
      return data;
    }
  };

  // Expand abbreviated types in diagram data
  const expandAbbreviatedTypes = async (data: any): Promise<any> => {
    if (!data || typeof data !== 'object') return data;
    
    // Convert nested to flat if needed for processing
    const flatData = convertNestedToFlatForValidation(data);
    const result = { ...flatData };
    
    // Handle zones array
    const zonesArray = result.zones;
    console.log('Zones array for conversion:', zonesArray);
    
    if (Array.isArray(zonesArray)) {
      const convertedArray = zonesArray.map((zone: any) => {
        console.log('Converting zone:', zone);
        if (zone.nodes && !zone.children) {
          console.log('Converting nodes to children');
          return { ...zone, children: zone.nodes, nodes: undefined };
        }
        return zone;
      });
      
      // Use zones array in result
      result.zones = convertedArray;
      console.log('Final result zones:', result.zones);
    }
    
    // Process nodes with error handling to skip invalid types
    if (Array.isArray(result.nodes)) {
      const validNodes = [];
      for (const node of result.nodes) {
        try {
          if (node.type && typeof node.type === 'string') {
            const expanded = await expandResourceType(node.type);
            if (expanded && expanded !== node.type) {
              validNodes.push({ ...node, type: expanded });
            } else if (expanded) {
              // Type is valid but no expansion needed
              validNodes.push(node);
            } else {
              // Type is invalid, skip this node
              console.warn(`Skipping node with invalid type: ${node.type}`, node);
            }
          } else {
            // No type or invalid type format, skip this node
            console.warn('Skipping node without valid type:', node);
          }
        } catch (error) {
          // Error processing this node, skip it
          console.warn(`Error processing node ${node.id || 'unknown'}:`, error);
        }
      }
      result.nodes = validNodes;
    }
    
    // Process zones - migrate from nodes to children with error handling
    if (Array.isArray(result.zones)) {
      const validZones = [];
      for (const zone of result.zones) {
        try {
          const migratedZone = { ...zone };
          // Migrate nodes to children if needed
          if (zone.nodes && !zone.children) {
            migratedZone.children = zone.nodes;
            delete migratedZone.nodes;
          }
          
          // Process children recursively if they exist
          if (migratedZone.children && Array.isArray(migratedZone.children)) {
            const validChildren = [];
            for (const child of migratedZone.children) {
              try {
                if (child.type && typeof child.type === 'string') {
                  const expanded = await expandResourceType(child.type);
                  if (expanded && expanded !== child.type) {
                    validChildren.push({ ...child, type: expanded });
                  } else if (expanded) {
                    validChildren.push(child);
                  } else {
                    console.warn(`Skipping child with invalid type: ${child.type}`, child);
                  }
                } else if (child.type === 'zone') {
                  // It's a nested zone, keep it
                  validChildren.push(child);
                } else {
                  console.warn('Skipping child without valid type:', child);
                }
              } catch (error) {
                console.warn(`Error processing child ${child.id || 'unknown'}:`, error);
              }
            }
            migratedZone.children = validChildren;
          }
          
          validZones.push(migratedZone);
        } catch (error) {
          console.warn(`Error processing zone ${zone.id || 'unknown'}:`, error);
        }
      }
      result.zones = validZones;
    }
    
    // Clean up connections that reference invalid nodes
    if (Array.isArray(result.connections)) {
      const validNodeIds = new Set();
      
      // Collect all valid node IDs from zones and nodes
      if (Array.isArray(result.nodes)) {
        result.nodes.forEach((node: any) => validNodeIds.add(node.id));
      }
      
      if (Array.isArray(result.zones)) {
        const collectNodeIdsFromZone = (zone: any) => {
          if (zone.children && Array.isArray(zone.children)) {
            zone.children.forEach((child: any) => {
              if (child.id && child.type !== 'zone') {
                validNodeIds.add(child.id);
              } else if (child.type === 'zone') {
                collectNodeIdsFromZone(child);
              }
            });
          }
        };
        
        result.zones.forEach(collectNodeIdsFromZone);
      }
      
      // Filter connections to only include those with valid source and target
      const validConnections = result.connections.filter((conn: any) => {
        const fromValid = validNodeIds.has(conn.from);
        const toValid = validNodeIds.has(conn.to);
        
        if (!fromValid || !toValid) {
          console.warn(`Skipping connection from '${conn.from}' to '${conn.to}': ${!fromValid ? 'source' : 'target'} node not found`);
          return false;
        }
        
        return true;
      });
      
      result.connections = validConnections;
    }
    
    return result;
  };

  return (
    <div 
      className="bg-card border-l border-border flex flex-col shadow-lg" 
      style={{ 
        width: isOpen ? '420px' : '0px',
        height: '100vh',
        minWidth: isOpen ? '420px' : '0px',
        position: isOpen ? 'fixed' : 'static',
        right: isOpen ? '0' : 'auto',
        top: isOpen ? '0' : 'auto',
        zIndex: isOpen ? '1000' : '0',
        overflow: isOpen ? 'visible' : 'hidden',
        transition: 'width 0.3s ease-in-out'
      }}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-foreground">JSON Editor</div>
          <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            error 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              error ? 'bg-destructive' : 'bg-emerald-500'
            }`} />
            {error ? 'Invalid' : 'Valid'}
          </div>
        </div>
        
        <button
          onClick={onToggleOpen}
          className="text-xs px-3 py-1.5 rounded border hover:bg-accent transition-colors"
          title="Close JSON Editor (Ctrl+Shift+J)"
        >
          Close
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isOpen && (
          <CodeMirror
            value={text}
            height="100%"
            theme={oneDark}
            onChange={handleChange}
            extensions={[json(), lintGutter()]}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLine: true,
              foldGutter: true,
              autocompletion: true,
              bracketMatching: true,
              searchKeymap: true,
            }}
            editable={true}
            onCreateEditor={(view) => { 
              editorRef.current = view; 
            }}
          />
        )}
      </div>

      {/* Error footer */}
      {error && (
        <div className="px-3 py-2 text-xs text-destructive bg-destructive/5 border-t max-h-20 overflow-y-auto">
          <div className="font-medium mb-1">Validation Error:</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      )}
    </div>
  );
}