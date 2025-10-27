'use client';

import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { DiagramDataSchema } from '@/lib/schemas';
import { debounce, stableStringify } from '@/lib/json-utils';
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
  const lastExternalJsonRef = React.useRef<string>(stableStringify(value));
  const changeFromEditorRef = React.useRef(false);

  // Sync from external value changes (e.g., canvas updates) when not actively editing
  React.useEffect(() => {
    const next = stableStringify(value);
    if (!changeFromEditorRef.current && next !== lastExternalJsonRef.current) {
      lastExternalJsonRef.current = next;
      setText(next);
    }
  }, [value]);

  const emitValid = React.useMemo(
    () => debounce((parsed: DiagramData) => onValidJsonChange(parsed), 300),
    [onValidJsonChange]
  );

  const handleChange = (newText: string) => {
    changeFromEditorRef.current = true;
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      const validationResult = DiagramDataSchema.safeParse(parsed);
      if (validationResult.success) {
        setError(null);
        emitValid(validationResult.data);
      } else {
        const errorMessage = validationResult.error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
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
      <div className="flex-1 min-h-0 overflow-hidden">
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