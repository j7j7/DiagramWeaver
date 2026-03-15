import type { DiagramData } from '@/lib/types';
import { applyDiagramDelta, computeDiagramDelta } from '@/lib/presentation-delta';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function runPresentationDeltaUtilityTests(): void {
  const base: DiagramData = {
    nodes: [
      { id: 'n1', type: 'generic.object.rectangle', label: 'A', x: 10, y: 10 },
      { id: 'n2', type: 'generic.object.rectangle', label: 'B', x: 80, y: 10 },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', text: 'old' },
    ],
    groupings: [],
  };

  const current: DiagramData = {
    nodes: [
      { id: 'n1', type: 'generic.object.rectangle', label: 'A*', x: 10, y: 10 },
      { id: 'n2', type: 'generic.object.rectangle', label: 'B', x: 80, y: 10 },
      { id: 'n3', type: 'generic.object.circle', label: 'C', x: 160, y: 10 },
    ],
    connections: [
      { id: 'c1', from: 'n1', to: 'n2', text: 'updated' },
      { id: 'c2', from: 'n2', to: 'n3', text: 'new' },
    ],
    groupings: [],
  };

  const delta = computeDiagramDelta(base, current);
  assert(delta.compressed === true, 'Delta should be marked compressed');
  assert(delta.operations.length > 0, 'Delta should contain operations for changed diagram');

  const reconstructed = applyDiagramDelta(base, delta);
  assert(deepEqual(reconstructed, current), 'Applying delta should reconstruct current diagram');

  const noChangeDelta = computeDiagramDelta(base, base);
  assert(noChangeDelta.operations.length === 0, 'No-change diagrams should generate no operations');
}
