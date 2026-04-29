import React, { useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { Text } from '@codemirror/state';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { stableStringify } from '@/lib/json-utils';
import { flattenDiagramOnImport, type RawDiagramData } from '@/lib/flatten-on-import';
import { ensureDiagramLayersPersisted } from '@/lib/layers-utils';
import { DiagramDataSchema } from '@/lib/schemas';
import { ensureConnectionIds } from '@/lib/connection-order-utils';
import { findJsonRangeForDiagramSelection, type JsonFocusTarget } from '@/lib/json-editor-focus';
import { applyJsonSearchMatch, collectJsonSearchMatches } from '@/lib/json-text-search';
import type { DiagramData } from '@/lib/types';

type Props = {
  value: DiagramData;
  onValidJsonChange: (data: DiagramData) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  widthPx: number;
  onWidthChange?: (width: number) => void;
  isReadOnly?: boolean;
  /** When set (e.g. canvas selection), selects and scrolls to the matching node or connection object in the JSON. */
  focusTarget?: JsonFocusTarget | null;
};

const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.5;

export function JsonEditorPanel({
  value,
  onValidJsonChange,
  isOpen,
  onToggleOpen,
  widthPx,
  onWidthChange,
  isReadOnly = false,
  focusTarget = null,
}: Props) {
  const [text, setText] = React.useState(() => {
    const d: DiagramData = { nodes: value.nodes || [], connections: value.connections || [], groupings: value.groupings, layers: value.layers };
    return stableStringify(d);
  });
  const [error, setError] = React.useState<string | null>(null);
  const editorRef = React.useRef<any>(null);
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = React.useState<number>(0);
  const [panelWidth, setPanelWidth] = React.useState<number>(widthPx);
  const isResizingRef = React.useRef(false);
  const scrollPositionRef = React.useRef<{ scrollLeft: number; scrollTop: number }>({ scrollLeft: 0, scrollTop: 0 });
  const lockedScrollPosition = React.useRef<{ scrollLeft: number; scrollTop: number; isLocked: boolean }>({ scrollLeft: 0, scrollTop: 0, isLocked: false });
   
  // Performance optimization: track previous data for diffing
  const previousValueRef = React.useRef<DiagramData | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const isApplyingExternalUpdate = React.useRef(false);
  const jsonFocusKeyRef = React.useRef('');
  const jsonPanelWasOpenRef = React.useRef(false);
  const focusTargetRef = React.useRef(focusTarget);
  focusTargetRef.current = focusTarget;

  const jsonFocusKeyStr = focusTarget
    ? focusTarget.itemType === 'node'
      ? `node:${focusTarget.id}`
      : `edge:${focusTarget.id}:${focusTarget.from}:${focusTarget.to}`
    : '';

  const [jsonFindQuery, setJsonFindQuery] = React.useState('');
  const [jsonFindCaseSensitive, setJsonFindCaseSensitive] = React.useState(false);
  /** -1 = no match navigated yet (Next/Prev will pick first/last). */
  const [jsonFindMatchIndex, setJsonFindMatchIndex] = React.useState(-1);

  const jsonFindMatches = React.useMemo(() => {
    if (!jsonFindQuery) return [];
    const doc = Text.of(text.split('\n'));
    return collectJsonSearchMatches(doc, jsonFindQuery, jsonFindCaseSensitive);
  }, [text, jsonFindQuery, jsonFindCaseSensitive]);

  React.useEffect(() => {
    setJsonFindMatchIndex(-1);
  }, [jsonFindQuery, jsonFindCaseSensitive]);

  React.useEffect(() => {
    if (jsonFindMatches.length === 0) {
      setJsonFindMatchIndex(-1);
      return;
    }
    setJsonFindMatchIndex((i) => {
      if (i < 0) return -1;
      return Math.min(i, jsonFindMatches.length - 1);
    });
  }, [jsonFindMatches]);

  const handleJsonFindNext = React.useCallback(() => {
    const view = editorRef.current;
    if (!view || jsonFindMatches.length === 0) return;
    const next =
      jsonFindMatchIndex < 0 ? 0 : (jsonFindMatchIndex + 1) % jsonFindMatches.length;
    setJsonFindMatchIndex(next);
    applyJsonSearchMatch(view, jsonFindMatches[next], { scrollY: 'nearest' });
  }, [jsonFindMatches, jsonFindMatchIndex]);

  const handleJsonFindPrev = React.useCallback(() => {
    const view = editorRef.current;
    if (!view || jsonFindMatches.length === 0) return;
    const prev =
      jsonFindMatchIndex < 0
        ? jsonFindMatches.length - 1
        : (jsonFindMatchIndex - 1 + jsonFindMatches.length) % jsonFindMatches.length;
    setJsonFindMatchIndex(prev);
    applyJsonSearchMatch(view, jsonFindMatches[prev], { scrollY: 'nearest' });
  }, [jsonFindMatches, jsonFindMatchIndex]);

  // Responsive panel width based on viewport (skip during user resize)
  React.useEffect(() => {
    if (isResizingRef.current) return;
    const updateWidth = () => {
      if (typeof window === 'undefined') return;
      const maxWidth = Math.max(300, window.innerWidth * MAX_WIDTH_RATIO);
      const clamped = Math.min(Math.max(MIN_WIDTH, widthPx), maxWidth);
      setPanelWidth(clamped);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [widthPx]);

  const resizeStartRef = React.useRef<{ startX: number; startWidth: number } | null>(null);
  const latestWidthRef = React.useRef<number>(panelWidth);
  latestWidthRef.current = panelWidth;

  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingRef.current = true;
      resizeStartRef.current = { startX: e.clientX, startWidth: panelWidth };
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      const handleMove = (moveEvent: MouseEvent) => {
        const start = resizeStartRef.current;
        if (!start) return;
        const deltaX = moveEvent.clientX - start.startX;
        const rawWidth = start.startWidth - deltaX;
        const maxWidth = typeof window !== 'undefined' ? Math.max(300, window.innerWidth * MAX_WIDTH_RATIO) : 800;
        const clamped = Math.min(Math.max(MIN_WIDTH, rawWidth), maxWidth);
        latestWidthRef.current = clamped;
        setPanelWidth(clamped);
      };
      const handleUp = () => {
        onWidthChange?.(latestWidthRef.current);
        resizeStartRef.current = null;
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [panelWidth, onWidthChange]
  );

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

  // Debounced update to prevent flickering during rapid changes (like dragging)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    
    updateTimeoutRef.current = setTimeout(() => {
      const scrollPos = captureScrollPosition();
      // Display flat format - nodes, connections, groupings only (no zones)
      const displayData: DiagramData = {
        nodes: value.nodes || [],
        connections: value.connections || [],
        groupings: value.groupings,
        layers: value.layers,
      };
      setText(stableStringify(displayData));
      setTimeout(() => restoreScrollPosition(scrollPos), 0);
      previousValueRef.current = value;
    }, 16);
    
    // Cleanup timeout on unmount
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [value, isUpdating]);

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

  // When the JSON panel is open and the user selects a node or connection on the canvas, jump to that object in the editor.
  React.useEffect(() => {
    if (!isOpen) {
      jsonPanelWasOpenRef.current = false;
      jsonFocusKeyRef.current = '';
      return;
    }
    const openedNow = !jsonPanelWasOpenRef.current;
    jsonPanelWasOpenRef.current = true;
    const target = focusTargetRef.current;
    if (!target) return;
    if (!openedNow && jsonFocusKeyRef.current === jsonFocusKeyStr) return;
    jsonFocusKeyRef.current = jsonFocusKeyStr;

    let cancelled = false;
    let attempts = 10;

    const tryScroll = () => {
      if (cancelled) return;
      const view = editorRef.current;
      if (!view) {
        if (attempts-- > 0) requestAnimationFrame(tryScroll);
        return;
      }
      const doc = view.state.doc.toString();
      const range = findJsonRangeForDiagramSelection(doc, target);
      if (!range) {
        if (attempts-- > 0) requestAnimationFrame(tryScroll);
        return;
      }
      const len = view.state.doc.length;
      const from = Math.min(range.from, len);
      const to = Math.min(range.to, len);
      if (from >= to) return;
      view.dispatch({
        selection: { anchor: from, head: to },
        effects: EditorView.scrollIntoView(from, { y: 'start', yMargin: 4 }),
      });
      setTimeout(() => {
        lockScrollPosition();
      }, 0);
    };

    requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
    };
  }, [isOpen, jsonFocusKeyStr, lockScrollPosition]);

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

  const handleChange = React.useCallback((newText: string) => {
    // Skip handling if read-only mode is enabled
    if (isReadOnly) return;
    // Skip handling if we're applying an external update
    if (isApplyingExternalUpdate.current) return;

    // Only update the text state, don't push to canvas yet
    setText(newText);

    try {
      const parsed = JSON.parse(newText);
      const hasValidStructure = parsed && typeof parsed === 'object' && (parsed.nodes || parsed.zones || parsed.connections);
      setError(hasValidStructure ? null : 'Invalid diagram data structure');
    } catch (e: any) {
      setError(e?.message || 'Invalid JSON');
    }
  }, [isReadOnly, setText, setError]);

  const handleSubmit = React.useCallback(() => {
    setIsUpdating(true);
    try {
      const parsed = JSON.parse(text);

      let finalData: DiagramData | null = null;
      let validationError: any = null;

      // Flatten + schema parse (same as File → Open) so connection fields round-trip (e.g. edgeAttachmentConstraint)
      if (parsed && typeof parsed === 'object' && (parsed.nodes || parsed.zones || parsed.connections)) {
        try {
          const flattened = flattenDiagramOnImport(parsed as RawDiagramData);
          const schemaResult = DiagramDataSchema.safeParse(flattened);
          if (!schemaResult.success) {
            validationError = schemaResult.error;
          } else {
            finalData = ensureDiagramLayersPersisted({
              ...schemaResult.data,
              connections: ensureConnectionIds(schemaResult.data.connections || []),
            } as DiagramData);
          }
        } catch (e) {
          validationError = e;
        }
      } else {
        validationError = { message: 'Invalid diagram data structure' };
      }

      if (!validationError && finalData) {
        setError(null);
        onValidJsonChange(finalData);

        const displayText = stableStringify(finalData);
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
  }, [text, setIsUpdating, setError, onValidJsonChange, captureScrollPosition, restoreScrollPosition, setText]);

  return (
    <div
      className="flex h-full max-h-full bg-background"
      style={{ width: `${panelWidth}px` }}
    >
      {onWidthChange && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={panelWidth}
          onMouseDown={handleResizeStart}
          className="flex-shrink-0 w-1.5 cursor-ew-resize hover:bg-primary/20 active:bg-primary/30 flex items-center justify-center group border-l transition-colors"
        >
          <div className="w-0.5 h-full min-h-[2rem] bg-border group-hover:bg-primary/50 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto border-l">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/50 flex-shrink-0 flex-wrap">
        <div className="text-sm font-medium shrink-0">JSON</div>
        <div className="flex items-center gap-2 flex-wrap justify-end min-w-0 flex-1">
          <div className="flex items-center gap-1 min-w-0 max-w-full">
            <input
              type="search"
              value={jsonFindQuery}
              onChange={(e) => setJsonFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) handleJsonFindPrev();
                  else handleJsonFindNext();
                }
              }}
              placeholder="Find in JSON…"
              className="h-8 w-[min(90px,14vw)] min-w-[50px] rounded border border-input bg-background px-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Find in JSON"
            />
            <button
              type="button"
              onClick={() => setJsonFindCaseSensitive((v) => !v)}
              className={`h-8 w-8 shrink-0 rounded border text-xs font-semibold transition-colors ${
                jsonFindCaseSensitive
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-transparent bg-muted/80 text-muted-foreground hover:bg-muted'
              }`}
              title={jsonFindCaseSensitive ? 'Case sensitive (on)' : 'Case insensitive — click for case sensitive'}
              aria-pressed={jsonFindCaseSensitive}
            >
              Aa
            </button>
            <button
              type="button"
              onClick={handleJsonFindPrev}
              disabled={jsonFindMatches.length === 0}
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded border border-input bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
              title="Previous match (Shift+Enter)"
              aria-label="Previous match"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleJsonFindNext}
              disabled={jsonFindMatches.length === 0}
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded border border-input bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
              title="Next match (Enter)"
              aria-label="Next match"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span
              className="text-xs text-muted-foreground tabular-nums shrink-0 min-w-[2.75rem] text-right"
              aria-live="polite"
            >
              {jsonFindMatches.length === 0
                ? jsonFindQuery
                  ? '0/0'
                  : '—'
                : jsonFindMatchIndex < 0
                  ? `0/${jsonFindMatches.length}`
                  : `${jsonFindMatchIndex + 1}/${jsonFindMatches.length}`}
            </span>
          </div>
          {!isReadOnly && (
            <button
              onClick={handleSubmit}
              disabled={!!error}
              className="px-3 py-1 text-sm font-medium text-white bg-primary rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Apply JSON changes to canvas"
            >
              Submit
            </button>
          )}
          <button
            onClick={onToggleOpen}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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
                searchKeymap: false,
              }}
              editable={!isReadOnly}
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
    </div>
  );
}
