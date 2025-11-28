// Test removeFromGroup function behavior
const { removeFromGroup } = require('./src/lib/grouping-utils.ts');

// Test diagram with 3 items in a group
const testDiagram = {
  nodes: [
    { id: "node1", x: 100, y: 100, width: 80, height: 40, text: "Node 1", groupId: "group1" },
    { id: "node2", x: 200, y: 100, width: 80, height: 40, text: "Node 2", groupId: "group1" },
    { id: "node3", x: 300, y: 100, width: 80, height: 40, text: "Node 3", groupId: "group1" },
    { id: "node4", x: 400, y: 100, width: 80, height: 40, text: "Node 4" }
  ],
  zones: [],
  connections: [],
  layers: { layers: [] },
  groupings: [
    { id: "group1", type: "grouping", memberIds: ["node1", "node2", "node3"], label: "Test Group" }
  ],
  rootZoneId: null
};

console.log('Original group members:', testDiagram.groupings[0].memberIds);
console.log('Original node groupIds:', testDiagram.nodes.map(n => ({ id: n.id, groupId: n.groupId })));

// Test removing one item from group
try {
  const result = removeFromGroup(["node2"], testDiagram);
  
  console.log('\nAfter removing node2:');
  console.log('Groupings:', result.groupings);
  console.log('Node groupIds:', result.nodes.map(n => ({ id: n.id, groupId: n.groupId })));
  
  if (result.groupings.length === 1) {
    console.log('✅ Group preserved with remaining members:', result.groupings[0].memberIds);
  } else {
    console.log('❌ Group was removed entirely');
  }
} catch (error) {
  console.error('Error:', error.message);
}