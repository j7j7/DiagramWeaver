import type { DiagramData, PresentationDeck, Slide } from '@/lib/types';
import {
  migratePresentationDeckToChain,
  migratePresentationDeckToMaster,
  resolvePresentationSlideDiagrams,
} from '@/lib/presentation-slide-chain';
import { projectVisibleDiagram } from '@/lib/presentation-delta';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function runPresentationChainUtilityTests(): void {
  const master: DiagramData = {
    nodes: [{ id: 'a', type: 'generic.object.rectangle', label: 'A', x: 0, y: 0 }],
    connections: [],
    groupings: [],
  };
  const masterVisible = projectVisibleDiagram(master);

  const primary: Slide = {
    id: 'p1',
    diagramDelta: { version: '1.0', operations: [], compressed: true },
    createdAt: 1,
  };

  const slideB: Slide = {
    id: 's2',
    diagramDelta: {
      version: '1.0',
      compressed: true,
      operations: [
        {
          op: 'replace',
          path: '/nodes',
          value: [
            { id: 'a', type: 'generic.object.rectangle', label: 'B', x: 0, y: 0 },
            { id: 'b', type: 'generic.object.rectangle', label: 'X', x: 10, y: 10 },
          ],
        },
      ],
    },
    createdAt: 2,
  };

  const masterModeDeck: PresentationDeck = {
    id: 'd1',
    name: 't',
    slides: [primary, slideB],
    createdAt: 1,
    updatedAt: 1,
  };

  const absMaster = resolvePresentationSlideDiagrams(masterVisible, masterModeDeck.slides, 'master');
  const migrated = migratePresentationDeckToChain(masterModeDeck, masterVisible);
  assert(migrated.presentationDeltaMode === 'chain', 'migration sets chain mode');
  const absChain = resolvePresentationSlideDiagrams(masterVisible, migrated.slides, 'chain');
  assert(deepEqual(absMaster[0], absChain[0]), 'primary slide absolute should match after migrate');
  assert(deepEqual(absMaster[1], absChain[1]), 'second slide absolute should match after migrate');

  const backToMaster = migratePresentationDeckToMaster(migrated, masterVisible);
  assert(backToMaster.presentationDeltaMode === 'master', 'chain → master restores master mode flag');
  const absRestoredMaster = resolvePresentationSlideDiagrams(masterVisible, backToMaster.slides, 'master');
  assert(deepEqual(absChain[0], absRestoredMaster[0]), 'round-trip preserves slide 0 absolute');
  assert(deepEqual(absChain[1], absRestoredMaster[1]), 'round-trip preserves slide 1 absolute');
}
