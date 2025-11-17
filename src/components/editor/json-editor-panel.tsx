import React, { useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';

import { HierarchicalDiagramDataSchema } from '@/lib/schemas';
import { stableStringify } from '@/lib/json-utils';
import { convertToNestedHierarchy, convertFromNestedHierarchy } from '@/lib/nested-hierarchy';
import { computeHierarchicalDiff, applySelectiveUpdates, type JsonDiff, type JsonPatch } from '@/lib/json-diff';
import type { DiagramData, HierarchicalDiagramData } from '@/lib/types';

// Feature flag: selective JSON text updates are currently disabled to guarantee
// correctness of the editor output when performing complex hierarchical moves.
// Once json-diff path resolution covers all add/remove/move cases safely,
// this can be flipped back on.
const ENABLE_SELECTIVE_JSON_UPDATES = false;

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
  const lockedScrollPosition = React.useRef<{ scrollLeft: number; scrollTop: number; isLocked: boolean }>({ scrollLeft: 0, scrollTop: 0, isLocked: false });
   
  // Performance optimization: track previous data for diffing
  // Track previous external value to detect real upstream changes
  const previousValueRef = React.useRef<DiagramData | null>(null);
  const previousNestedDataRef = React.useRef<HierarchicalDiagramData | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const isApplyingExternalUpdate = React.useRef(false);

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

    // Only react when the external value object actually changes.
    // This prevents in-progress JSON edits from being overwritten by
    // the last good value when the user still has invalid JSON.
    if (previousValueRef.current === value) {
      return;
    }
    
    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Reduced debounce delay for more responsive updates
    updateTimeoutRef.current = setTimeout(() => {
      const currentNestedData: HierarchicalDiagramData = isNestedFormat(value) ? value as unknown as HierarchicalDiagramData : convertToNestedHierarchy(value);
      const previousNestedData = previousNestedDataRef.current;
      
      // If we have previous data and selective updates are enabled, compute diff
      // and attempt minimal text patches. This is currently disabled by
      // ENABLE_SELECTIVE_JSON_UPDATES to guarantee correctness when moving
      // items between zones (where path resolution is not yet robust).
      if (ENABLE_SELECTIVE_JSON_UPDATES && previousNestedData) {
        const diffs = computeHierarchicalDiff(previousNestedData, currentNestedData);
        
        // Improved detection for when to use selective updates
        const shouldUseSelectiveUpdate = diffs.length > 0 && 
          diffs.length < 50 && // Not too many changes
          !diffs.some(diff => diff.change === 'moved') && // No structural moves
          !diffs.some(diff => diff.type === 'zone_structure'); // No zone structure changes
        
        if (shouldUseSelectiveUpdate) {
          try {
            const currentText = text;
            const patches: JsonPatch[] = [];
            for (const diff of diffs) {
              const path = getJsonPathFromDiff(diff, currentNestedData);
              if (!path) continue;
              
              let op: 'remove' | 'add' | 'replace';
              if (diff.change === 'removed') {
                op = 'remove';
              } else if (diff.change === 'added') {
                op = 'add';
              } else {
                op = 'replace';
              }
              
              const patch: JsonPatch = {
                op,
                path
              };
              
              if (op !== 'remove') {
                patch.value = diff.newValue;
              }
              
              patches.push(patch);
            }
            
            if (patches.length > 0) {
              const updatedText = applySelectiveUpdates(currentText, patches);
              
              if (updatedText !== currentText) {
                // Try to capture scroll position, but don't fail if we can't
                const scrollPos = captureScrollPosition();
                
                // Always restore using locked position logic
                setTimeout(() => {
                  restoreScrollPosition(scrollPos);
                }, 0);
                
                setText(updatedText);
                
                previousNestedDataRef.current = currentNestedData;
                previousValueRef.current = value;
                return; // Skip full refresh
              }
            }
          } catch (error) {
            console.warn('Selective update failed, falling back to full refresh:', error);
          }
        }
      }
      
      // Fallback to full refresh for all changes (current default) or when
      // selective updates are disabled/fail
      // Try to capture scroll position
      const scrollPos = captureScrollPosition();

      const displayText = stableStringify(currentNestedData);
      setText(displayText);

      // Restore scroll position after text update
      setTimeout(() => {
        restoreScrollPosition(scrollPos);
      }, 0);
      
      previousNestedDataRef.current = currentNestedData;
      previousValueRef.current = value;
    }, 16); // ~60fps for smoother updates
    
    // Cleanup timeout on unmount
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [value, isNestedFormat, isUpdating, text]);

  // Helper function to capture scroll position (doesn't update locked position)
  const captureScrollPosition = React.useCallback(() => {
    if (!editorRef.current) return null;
    
    const view = editorRef.current;
    const scrollTop = view.scrollDOM.scrollTop;
    const scrollLeft = view.scrollDOM.scrollLeft;
    
    return {
      scrollTop,
      scrollLeft
    };
  }, []);

  // Helper function to lock current scroll position (called on explicit user clicks)
  const lockScrollPosition = React.useCallback(() => {
    if (!editorRef.current) return;
    
    const view = editorRef.current;
    const scrollTop = view.scrollDOM.scrollTop;
    const scrollLeft = view.scrollDOM.scrollLeft;
    
    lockedScrollPosition.current = {
      scrollTop,
      scrollLeft,
      isLocked: true
    };
  }, []);

  // Helper function to restore scroll position
  const restoreScrollPosition = React.useCallback((scrollPos: ReturnType<typeof captureScrollPosition>) => {
    if (!editorRef.current) return;
    
    const view = editorRef.current;
    isApplyingExternalUpdate.current = true;
    
    // Use locked position if available, otherwise use current position
    let targetScrollTop, targetScrollLeft;
    
    if (lockedScrollPosition.current.isLocked) {
      targetScrollTop = lockedScrollPosition.current.scrollTop;
      targetScrollLeft = lockedScrollPosition.current.scrollLeft;
    } else if (scrollPos) {
      targetScrollTop = scrollPos.scrollTop;
      targetScrollLeft = scrollPos.scrollLeft;
    } else {
      // Fallback to current scroll position
      targetScrollTop = view.scrollDOM.scrollTop;
      targetScrollLeft = view.scrollDOM.scrollLeft;
    }
    
    // Restore scroll position immediately
    view.scrollDOM.scrollLeft = targetScrollLeft;
    view.scrollDOM.scrollTop = targetScrollTop;
    
    // Reset the flag after a short delay
    setTimeout(() => {
      isApplyingExternalUpdate.current = false;
    }, 50);
  }, []);

  // Helper function to convert diff to JSON path
  const getJsonPathFromDiff = (diff: JsonDiff, data: HierarchicalDiagramData): string => {
    if (diff.type === 'connection') {
      const id = diff.id || '';
      const [from, to] = id.split('-');
      const index = data.connections.findIndex(c => c.from === from && c.to === to);
      return index >= 0 ? `/connections/${index}` : '';
    }
    
    if (diff.type === 'zone' || diff.type === 'node') {
      if (diff.path && diff.path.length > 0) {
        // Nested item - find zone and child indices
        const zoneId = diff.path[0];
        const zoneIndex = data.zones.findIndex(z => z.id === zoneId);
        if (zoneIndex === -1) return '';
        
        const zone = data.zones[zoneIndex];
        if (!zone.children) return `/zones/${zoneIndex}`;
        
        const childIndex = zone.children.findIndex(c => c.id === diff.id);
        return childIndex >= 0 ? `/zones/${zoneIndex}/children/${childIndex}` : `/zones/${zoneIndex}`;
      } else {
        // Root zone
        const index = data.zones.findIndex(z => z.id === diff.id);
        return index >= 0 ? `/zones/${index}` : '';
      }
    }
    
    return '';
  };

  const handleChange = async (newText: string) => {
    // Skip handling if we're applying an external update
    if (isApplyingExternalUpdate.current) return;
    
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
          // Try to capture scroll position
          const scrollPos = captureScrollPosition();
          
          setText(displayText);
          
          // Restore scroll position after text update
          setTimeout(() => {
            restoreScrollPosition(scrollPos);
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
    <div
      className="flex flex-col h-full max-h-full bg-background border-l overflow-y-auto"
      style={{ width: `${panelWidth}px` }}
    >
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
      <div ref={editorContainerRef} className="flex-1 min-h-0">
        {isOpen ? (
          <div className="h-full max-h-[calc(100vh-80px)] overflow-y-scroll">
            <CodeMirror
              value={text}
              height="auto"
              theme={oneDark}
              onChange={handleChange}
              extensions={[
                json(), 
                lintGutter(),
                keymap.of([
                  {
                    key: 'Mod-c',
                    run: (view) => {
                      const selection = view.state.selection.main;
                      if (!selection.empty) {
                        const selectedText = view.state.doc.sliceString(selection.from, selection.to);
                        navigator.clipboard.writeText(selectedText).catch(err => {
                          console.warn('Failed to copy to clipboard:', err);
                        });
                        return true;
                      }
                      return false;
                    }
                  },
                  {
                    key: 'Mod-a',
                    run: (view) => {
                      view.dispatch({
                        selection: { anchor: 0, head: view.state.doc.length }
                      });
                      return true;
                    }
                  }
                ])
              ]}
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

                // Only lock position on explicit clicks
                const handleClick = (event: MouseEvent) => {
                  if (!view || isApplyingExternalUpdate.current) return;

                  // Only lock on left clicks within the editor content
                  if (event.button === 0 && event.target === view.contentDOM) {
                    setTimeout(() => {
                      lockScrollPosition();
                    }, 10); // Small delay to ensure scroll position is updated after click
                  }
                };

                // Track scroll but don't update locked position
                const handleScroll = () => {
                  // Don't update locked position on scroll - only on clicks
                };

                view.dom.addEventListener('click', handleClick);
                view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });

                // Initial lock to current position
                setTimeout(() => {
                  lockScrollPosition();
                }, 100);
              }}
            />
          </div>
        ) : null}
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
