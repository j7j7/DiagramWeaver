import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { HierarchicalDiagramDataSchema } from '@/lib/schemas';
import { stableStringify } from '@/lib/json-utils';
import { convertToNestedHierarchy, convertFromNestedHierarchy } from '@/lib/nested-hierarchy';
import type { DiagramData } from '@/lib/types';

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

  // Sync text display when value prop changes from outside
  React.useEffect(() => {
    const displayText = stableStringify(
      isNestedFormat(value) ? value : convertToNestedHierarchy(value)
    );
    setText(displayText);
  }, [value, isNestedFormat]);

  const handleChange = async (newText: string) => {
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
          setText(displayText);
        }
      } else {
        const errorMessage = validationError.issues
          ? validationError.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
          : validationError.message || 'Unknown validation error';
        setError(`Schema validation failed: ${errorMessage}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Invalid JSON');
    }
  };

  return (
    <div className="flex flex-col bg-background border-l" style={{ width: `${widthPx}px`, height: '100vh' }}>
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
      <div className="flex-1 overflow-hidden">
        {isOpen && (
          <CodeMirror
            value={text}
            height="100%"
            maxHeight="100%"
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
