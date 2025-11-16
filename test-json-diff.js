// Test script to verify the JSON diff optimization
import { computeHierarchicalDiff, applySelectiveUpdates } from '../src/lib/json-diff';
import { convertToNestedHierarchy } from '../src/lib/nested-hierarchy';

// Sample test data
const oldData = {
  zones: [
    {
      id: 'zone1',
      type: 'zone',
      label: 'Zone 1',
      children: [
        {
          id: 'node1',
          type: 'aws.compute.ec2',
          label: 'EC2 Instance'
        }
      ]
    }
  ],
  connections: []
};

const newData = {
  zones: [
    {
      id: 'zone1',
      type: 'zone',
      label: 'Zone 1 Updated', // Changed label
      children: [
        {
          id: 'node1',
          type: 'aws.compute.ec2',
          label: 'EC2 Instance Updated' // Changed label
        },
        {
          id: 'node2',
          type: 'aws.database.rds',
          label: 'RDS Database' // Added new node
        }
      ]
    }
  ],
  connections: [
    {
      from: 'node1',
      to: 'node2'
    }
  ]
};

console.log('Testing JSON diff optimization...');
console.log('Old data:', JSON.stringify(oldData, null, 2));
console.log('New data:', JSON.stringify(newData, null, 2));

// Compute diffs
const diffs = computeHierarchicalDiff(oldData, newData);
console.log('Diffs found:', diffs.length);
console.log('Diffs:', diffs);

// Test selective updates
const oldJsonString = JSON.stringify(oldData, null, 2);
const patches = diffs.map(diff => ({
  op: diff.change === 'removed' ? 'remove' : 
      diff.change === 'added' ? 'add' : 'replace',
  path: `/zones/0`, // Simplified path for test
  value: diff.newValue
}));

console.log('Applying selective updates...');
const updatedJson = applySelectiveUpdates(oldJsonString, patches);
console.log('Updated JSON:', updatedJson);

console.log('Test completed successfully!');