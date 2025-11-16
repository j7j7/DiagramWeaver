import React, { useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { HierarchicalDiagramDataSchema } from '@/lib/schemas';
import { stableStringify } from '@/lib/json-utils';
import { convertToNestedHierarchy, convertFromNestedHierarchy } from '@/lib/nested-hierarchy';
import { computeHierarchicalDiff, applySelectiveUpdates, type JsonDiff } from '@/lib/json-diff';
import type { DiagramData, HierarchicalDiagramData } from '@/lib/types';

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
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = React.useState<number>(0);
  const [panelWidth, setPanelWidth] = React.useState<number>(widthPx);
  const scrollPositionRef = React.useRef<{ scrollLeft: number; scrollTop: number }>({ scrollLeft: 0, scrollTop: 0 });
  
  // Performance optimization: track previous data for diffing
  const previousValueRef = React.useRef<DiagramData>(value);
  const previousNestedDataRef = React.useRef<HierarchicalDiagramData | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Responsive panel width based on viewport
  React.useEffect(() => {
    const updateWidth = () => {
      if (typeof window === 'undefined') return;
      const maxWidth = Math.max(300, window.innerWidth * 0.35);
      const clamped = Math.min(Math.max(280, widthPx), maxWidth);
      setPanelWidth(clamped);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [widthPx]);

  // Track editor container height for CodeMirror scrolling
  React.useEffect(() => {
    if (!isOpen) return;
    const element = editorContainerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateHeight = () => {
      const rect = element.getBoundingClientRect();
      setEditorHeight(rect.height);
    };
    updateHeight();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setEditorHeight(entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isOpen]);

  // Check if data is in nested format (has zones with nested children objects)
  const isNestedFormat = React.useCallback((data: any): boolean => {
    console.log('Checking nested format for data:', data);
    
    // Nested format has zones array but NO nodes array at root level
    // Instead, nodes are nested inside zones as children objects
    const hasNodesArray = Array.isArray(data.nodes) && data.nodes.length > 0;
    const hasZonesArray = Array.isArray(data.zones) && data.zones.length > 0;
    
    console.log('Has nodes array:', hasNodesArray, 'Has zones array:', hasZonesArray);
    
    if (!hasZonesArray) {
      console.log('No zones array - not nested format');
      return false;
    }
    
    // If we have both nodes and zones at root, it's flat format
    if (hasNodesArray) {
      console.log('Has both nodes and zones at root - flat format');
      return false;
    }
    
    // Check if any zone has children that are objects (not just IDs)
    const hasNestedChildren = data.zones.some((zone: any) => {
      if (!zone.children || !Array.isArray(zone.children)) return false;
      // In nested format, children are objects with type, id, etc.
      // In flat format, children are just string IDs
      return zone.children.length > 0 && typeof zone.children[0] === 'object';
    });
    
    console.log('Has nested children objects:', hasNestedChildren);
    return hasNestedChildren;
  }, []);

  // Debounced update to prevent flickering during rapid changes (like dragging)
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Sync text display when value prop changes from outside - optimized with selective updates
  React.useEffect(() => {
    // Skip update if we're already processing a change from the editor
    if (isUpdating) return;
    
    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Debounce the update to reduce flickering during rapid changes
    updateTimeoutRef.current = setTimeout(() => {
      const currentNestedData: HierarchicalDiagramData = isNestedFormat(value) ? value as unknown as HierarchicalDiagramData : convertToNestedHierarchy(value);
      const previousNestedData = previousNestedDataRef.current;
      
      // If we have previous data, compute diff and apply selective updates
      if (previousNestedData) {
        const diffs = computeHierarchicalDiff(previousNestedData, currentNestedData);
        
        // Only apply selective updates if there are changes and they're minimal
        // Increased threshold to be more permissive for selective updates
        if (diffs.length > 0 && diffs.length < 20) {
          try {
            const currentText = text;
            const updatedText = applySelectiveUpdates(currentText, diffs.map(diff => ({
              op: diff.change === 'removed' ? 'remove' : 
                  diff.change === 'added' ? 'add' : 'replace',
              path: getJsonPathFromDiff(diff, currentNestedData),
              value: diff.newValue
            })));
            
            if (updatedText !== currentText) {
              // Save current scroll position before updating text
              if (editorRef.current) {
                const view = editorRef.current;
                scrollPositionRef.current = {
                  scrollLeft: view.scrollDOM.scrollLeft,
                  scrollTop: view.scrollDOM.scrollTop
                };
              }
              
              setText(updatedText);
              
              // Restore scroll position after text update
              setTimeout(() => {
                if (editorRef.current) {
                  const view = editorRef.current;
                  view.scrollDOM.scrollLeft = scrollPositionRef.current.scrollLeft;
                  view.scrollDOM.scrollTop = scrollPositionRef.current.scrollTop;
                }
              }, 0);
              
              previousNestedDataRef.current = currentNestedData;
              previousValueRef.current = value;
              return; // Skip full refresh
            }
          } catch (error) {
            console.warn('Selective update failed, falling back to full refresh:', error);
          }
        }
      }
      
      // Fallback to full refresh for major changes or when selective updates fail
      // Save current scroll position before updating text
      if (editorRef.current) {
        const view = editorRef.current;
        scrollPositionRef.current = {
          scrollLeft: view.scrollDOM.scrollLeft,
          scrollTop: view.scrollDOM.scrollTop
        };
      }

      const displayText = stableStringify(currentNestedData);
      setText(displayText);

      // Restore scroll position after text update
      setTimeout(() => {
        if (editorRef.current) {
          const view = editorRef.current;
          view.scrollDOM.scrollLeft = scrollPositionRef.current.scrollLeft;
          view.scrollDOM.scrollTop = scrollPositionRef.current.scrollTop;
        }
      }, 0);
      
      previousNestedDataRef.current = currentNestedData;
      previousValueRef.current = value;
    }, 150); // 150ms debounce delay
    
    // Cleanup timeout on unmount
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [value, isNestedFormat, isUpdating, text]);

  // Helper function to convert diff to JSON path
  const getJsonPathFromDiff = (diff: JsonDiff, data: HierarchicalDiagramData): string => {
    if (diff.type === 'connection') {
      const id = diff.id || '';
      const [from, to] = id.split('-');
      const index = data.connections.findIndex(c => c.from === from && c.to === to);
      return `/connections/${index}`;
    }
    
    if (diff.type === 'zone' || diff.type === 'node') {
      if (diff.path && diff.path.length > 0) {
        // Nested item - find zone and child indices
        const zoneId = diff.path[0];
        const zoneIndex = data.zones.findIndex(z => z.id === zoneId);
        if (zoneIndex === -1) return '';
        
        const zone = data.zones[zoneIndex];
        const childIndex = zone.children?.findIndex(c => c.id === diff.id) ?? -1;
        return `/zones/${zoneIndex}/children/${childIndex}`;
      } else {
        // Root zone
        const index = data.zones.findIndex(z => z.id === diff.id);
        return `/zones/${index}`;
      }
    }
    
    return '';
  };

  const handleChange = async (newText: string) => {
    setIsUpdating(true);
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      
      console.log('JSON Editor parsed data:', {
        isNested: isNestedFormat(parsed),
        nodesCount: parsed.nodes?.length || 0,
        zonesCount: parsed.zones?.length || 0,
        connectionsCount: parsed.connections?.length || 0,
        sampleNode: parsed.nodes?.[0],
        sampleZone: parsed.zones?.[0],
        allNodeIds: parsed.nodes?.map((n: any) => n.id)
      });
      
      let finalData: DiagramData | null = null;
      let validationError: any = null;

      // Check if data is in nested format
      if (isNestedFormat(parsed)) {
        // Validate as nested format
        const validationResult = HierarchicalDiagramDataSchema.safeParse(parsed);
        
        if (validationResult.success) {
          // Convert nested to flat for application
          finalData = convertFromNestedHierarchy(parsed);
        } else {
          validationError = validationResult.error;
        }
      } else {
        // Data is already in flat format, just validate basic structure
        if (parsed && typeof parsed === 'object' && (parsed.nodes || parsed.zones || parsed.connections)) {
          finalData = {
            nodes: parsed.nodes || [],
            zones: parsed.zones || [],
            connections: parsed.connections || []
          };
        } else {
          validationError = { message: 'Invalid diagram data structure' };
        }
      }
      
      if (!validationError && finalData) {
        console.log('JSON Editor emitting valid data:', {
          nodesCount: finalData.nodes?.length || 0,
          zonesCount: finalData.zones?.length || 0,
          connectionsCount: finalData.connections?.length || 0,
          sampleNode: finalData.nodes?.[0],
          sampleZone: finalData.zones?.[0],
          allNodeIds: finalData.nodes?.map((n: any) => n.id),
          allZoneIds: finalData.zones?.map((z: any) => z.id),
          hasDuplicateNodeIds: !!finalData.nodes?.some((node: any, index: number) => 
            finalData.nodes.findIndex((n: any) => n.id === node.id) !== index
          )
        });
        
        setError(null);
        onValidJsonChange(finalData);
        
        // Update display text to match the validated data format
        const displayText = stableStringify(
          isNestedFormat(parsed) ? parsed : convertToNestedHierarchy(finalData)
        );
        if (displayText !== text) {
          // Save current scroll position before updating text
          if (editorRef.current) {
            const view = editorRef.current;
            scrollPositionRef.current = {
              scrollLeft: view.scrollDOM.scrollLeft,
              scrollTop: view.scrollDOM.scrollTop
            };
          }
          
          setText(displayText);
          
          // Restore scroll position after text update
          setTimeout(() => {
            if (editorRef.current) {
              const view = editorRef.current;
              view.scrollDOM.scrollLeft = scrollPositionRef.current.scrollLeft;
              view.scrollDOM.scrollTop = scrollPositionRef.current.scrollTop;
            }
          }, 0);
        }
      } else {
        const errorMessage = validationError.issues
          ? validationError.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
          : validationError.message || 'Unknown validation error';
        setError(`Schema validation failed: ${errorMessage}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Invalid JSON');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-full bg-background border-l" style={{ width: `${panelWidth}px` }}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50 flex-shrink-0">
        <div className="text-sm font-medium">JSON Editor</div>
        <button
          onClick={onToggleOpen}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Editor */}
      <div ref={editorContainerRef} className="flex-1 min-h-0 overflow-hidden">
        {isOpen && (
          <CodeMirror
            value={text}
            height={editorHeight ? `${Math.max(editorHeight, 200)}px` : '100%'}
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
