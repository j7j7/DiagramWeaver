import { HierarchicalDiagramDataSchema } from './src/lib/schemas';
import type { HierarchicalDiagramData } from './src/lib/types';
import { convertFromNestedHierarchy, convertToNestedHierarchy } from './src/lib/nested-hierarchy';
import * as fs from 'fs';

const originalJson = JSON.parse(fs.readFileSync('/Users/j7/Downloads/diagram-11.json', 'utf8'));

console.log('=== ROUND-TRIP TEST ===\n');

console.log('Step 1: Parse original JSON (nested format)');
const hierarchicalResult = HierarchicalDiagramDataSchema.safeParse(originalJson);
if (!hierarchicalResult.success) {
  console.log('✗ Failed to parse original JSON');
  console.log('Error:', hierarchicalResult.error.message);
  process.exit(1);
}
console.log('✓ Original JSON is valid nested format\n');

console.log('Step 2: Convert to flat format (simulating load)');
const flatData = convertFromNestedHierarchy(hierarchicalResult.data as HierarchicalDiagramData);
console.log('✓ Converted to flat format');
console.log('- Nodes:', flatData.nodes.length);
console.log('- Zones:', (flatData.zones ?? []).length);
console.log('- Connections:', flatData.connections.length);
console.log('\n');

console.log('Step 3: Convert back to nested format (simulating save)');
const nestedAgain = convertToNestedHierarchy(flatData);
console.log('✓ Converted back to nested format');
console.log('- Zones:', nestedAgain.zones.length);
console.log('- Connections:', nestedAgain.connections.length);
console.log('\n');

console.log('Step 4: Compare original vs round-tripped JSON');
const originalStr = JSON.stringify(originalJson, null, 2);
const roundTrippedStr = JSON.stringify(nestedAgain, null, 2);

if (originalStr === roundTrippedStr) {
  console.log('✓ Perfect match! Round-trip is lossless.\n');
} else {
  console.log('✗ Mismatch detected!\n');
  console.log('Writing files for comparison...');
  fs.writeFileSync('/tmp/original.json', originalStr);
  fs.writeFileSync('/tmp/roundtripped.json', roundTrippedStr);
  console.log('- Original: /tmp/original.json');
  console.log('- Round-tripped: /tmp/roundtripped.json');
  console.log('\nYou can compare them with: diff /tmp/original.json /tmp/roundtripped.json');
}
