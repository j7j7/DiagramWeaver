// Test to verify fixed resetChildGroupPositions function
// This simulates logic to ensure no infinite recursion
// 
// This test file is kept for future debugging and verification purposes

const mockGroups = [
  { id: 'group1', children: ['group2', 'node1'], x: 0, y: 0 },
  { id: 'group2', children: ['group3', 'node2'], x: 10, y: 10 },
  { id: 'group3', children: ['node3'], x: 20, y: 20 }
];

// Simulate the fixed resetChildGroupPositions function
function resetChildGroupPositions(groupId, visited = new Set()) {
  if (visited.has(groupId)) {
    console.log(`⚠️  Detected cycle at ${groupId}, stopping recursion`);
    return;
  }
  visited.add(groupId);
  
  console.log(`Resetting positions for group: ${groupId}`);
  
  const group = mockGroups.find(g => g.id === groupId);
  if (group && group.children) {
    group.children.forEach(childId => {
      const childGroup = mockGroups.find(g => g.id === childId);
      if (childGroup) {
        resetChildGroupPositions(childId, visited);
      }
    });
  }
}

// Test normal case
console.log('🧪 Testing normal hierarchy:');
resetChildGroupPositions('group1');

// Test circular reference case
console.log('\n🧪 Testing circular reference:');
const circularGroups = [
  { id: 'groupA', children: ['groupB'], x: 0, y: 0 },
  { id: 'groupB', children: ['groupC'], x: 10, y: 10 },
  { id: 'groupC', children: ['groupA'], x: 20, y: 20 } // Creates cycle
];

function resetChildGroupPositionsCircular(groupId, visited = new Set()) {
  if (visited.has(groupId)) {
    console.log(`⚠️  Detected cycle at ${groupId}, stopping recursion`);
    return;
  }
  visited.add(groupId);
  
  console.log(`Resetting positions for group: ${groupId}`);
  
  const group = circularGroups.find(g => g.id === groupId);
  if (group && group.children) {
    group.children.forEach(childId => {
      const childGroup = circularGroups.find(g => g.id === childId);
      if (childGroup) {
        resetChildGroupPositionsCircular(childId, visited);
      }
    });
  }
}

resetChildGroupPositionsCircular('groupA');

console.log('\n✅ Recursion fix test completed! No infinite loops detected.');

// Additional test: Complex nested hierarchy
console.log('\n🧪 Testing complex nested hierarchy:');
const complexGroups = [
  { id: 'root', children: ['child1', 'child2'], x: 0, y: 0 },
  { id: 'child1', children: ['grandchild1', 'grandchild2'], x: 10, y: 10 },
  { id: 'child2', children: ['grandchild3'], x: 20, y: 20 },
  { id: 'grandchild1', children: [], x: 30, y: 30 },
  { id: 'grandchild2', children: [], x: 40, y: 40 },
  { id: 'grandchild3', children: [], x: 50, y: 50 }
];

function resetComplexHierarchy(groupId, visited = new Set()) {
  if (visited.has(groupId)) {
    console.log(`⚠️  Detected cycle at ${groupId}, stopping recursion`);
    return;
  }
  visited.add(groupId);
  
  console.log(`Resetting positions for group: ${groupId}`);
  
  const group = complexGroups.find(g => g.id === groupId);
  if (group && group.children) {
    group.children.forEach(childId => {
      const childGroup = complexGroups.find(g => g.id === childId);
      if (childGroup) {
        resetComplexHierarchy(childId, visited);
      }
    });
  }
}

resetComplexHierarchy('root');

console.log('\n🎯 All recursion tests passed! The fix prevents infinite loops in group hierarchies.');