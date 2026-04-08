import { EditorSelection, type Text } from '@codemirror/state';
import { SearchCursor } from '@codemirror/search';
import { EditorView } from '@codemirror/view';

/** Collect non-overlapping plain-text matches in document order. */
export function collectJsonSearchMatches(
  doc: Text,
  query: string,
  caseSensitive: boolean
): { from: number; to: number }[] {
  if (!query) return [];
  const normalize = caseSensitive ? undefined : (s: string) => s.toLowerCase();
  const cursor = new SearchCursor(doc, query, 0, doc.length, normalize);
  const out: { from: number; to: number }[] = [];
  cursor.next();
  while (!cursor.done) {
    out.push({ from: cursor.value.from, to: cursor.value.to });
    cursor.next();
  }
  return out;
}

export function applyJsonSearchMatch(
  view: EditorView,
  match: { from: number; to: number },
  options: { scrollY: 'start' | 'nearest'; focus?: boolean }
): void {
  const { scrollY, focus = true } = options;
  const effect =
    scrollY === 'start'
      ? EditorView.scrollIntoView(match.from, { y: 'start', yMargin: 4 })
      : EditorView.scrollIntoView(match.from, { y: 'nearest', yMargin: 4 });
  view.dispatch({
    selection: EditorSelection.create([EditorSelection.range(match.from, match.to)]),
    effects: effect,
  });
  if (focus) view.focus();
}
