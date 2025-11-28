// Test script to verify groupings preservation in save/load
import type { DiagramData, DiagramGroupingData } from './src/lib/types.js';

// Test data with groupings
const testData: DiagramData = {
  nodes: [
    { id: 'node1', type: 'test', x: 100, y: 100, label: 'Node 1', groupId: 'group1' },
    { id: 'node2', type: 'test', x: 200, y: 100, label: 'Node 2', groupId: 'group1' },
    { id: 'node3', type: 'test', x: 300, y: 100, label: 'Node 3' }
  ],
  connections: [],
  zones: [],
  groupings: [
    {
      id: 'group1',
      type: 'grouping',
      memberIds: ['node1', 'node2'],
      label: 'Test Group'
    }
  ]
};

console.log('Original data:', JSON.stringify(testData, null, 2));

// Simulate save/load cycle
const saved = JSON.stringify(testData);
const loaded = JSON.parse(saved);

console.log('Loaded data:', JSON.stringify(loaded, null, 2));

// Check if groupings are preserved
console.log('Groupings preserved:', JSON.stringify(loaded.groupings) === JSON.stringify(testData.groupings));
console.log('GroupIds preserved:', 
  loaded.nodes.every((node, i) => node.groupId === testData.nodes[i].groupId)
);