import { convertToNestedHierarchy, convertFromNestedHierarchy, flattenNestedHierarchy } from './nested-hierarchy';
import type { HierarchicalDiagramData } from './types';

// Test data in the new nested format
const nestedTestData: HierarchicalDiagramData = {
  groups: [
    {
      id: "group-1",
      type: "group",
      label: "",
      children: [
        {
          id: "node-1",
          type: "aws.compute.ec2",
          label: "EC2",
          info: "EC2 from aws"
        }
      ]
    },
    {
      id: "group-2",
      type: "group",
      label: "Group",
      info: "A new Group",
      children: [
        {
          id: "node-2",
          type: "aws.compute.ec2",
          label: "EC2",
          info: "EC2 from aws"
        },
        {
          id: "group-3",
          type: "group",
          label: "Group",
          info: "A new Group",
          children: [
            {
              id: "node-3",
              type: "aws.compute.ec2",
              label: "EC2",
              info: "EC2 from aws"
            },
            {
              id: "node-4",
              type: "aws.compute.ec2",
              label: "EC2",
              info: "EC2 from aws"
            }
          ]
        }
      ]
    }
  ],
  connections: []
};

// Test conversion from nested to flat format
console.log("=== Converting Nested to Flat ===");
const flatData = convertFromNestedHierarchy(nestedTestData);
console.log("Flat format:", JSON.stringify(flatData, null, 2));

// Test conversion back to nested format
console.log("\n=== Converting Flat back to Nested ===");
const nestedAgain = convertToNestedHierarchy(flatData);
console.log("Nested format:", JSON.stringify(nestedAgain, null, 2));

// Test flattening for rendering
console.log("\n=== Flattening for Rendering ===");
const { positionedGroups, positionedNodes } = flattenNestedHierarchy(nestedTestData);
console.log("Positioned Groups:", positionedGroups.length);
console.log("Positioned Nodes:", positionedNodes.length);
console.log("Group positions:", positionedGroups.map(g => ({ id: g.id, x: g.x, y: g.y, width: (g as any).width, height: (g as any).height })));
console.log("Node positions:", positionedNodes.map(n => ({ id: n.id, x: n.x, y: n.y })));

export { nestedTestData, flatData, nestedAgain };