import { convertToNestedHierarchy } from './nested-hierarchy';
import type { DiagramData } from './types';

// Test data with orphaned node (not in any group)
const testData: DiagramData = {
  nodes: [
    {
      id: "aws-compute-ec2-1",
      type: "aws.compute.ec2",
      label: "EC2",
      info: "EC2 from aws",
      x: 220,
      y: 320
    },
    {
      id: "aws-compute-ec2-2", 
      type: "aws.compute.ec2",
      label: "EC2",
      info: "EC2 from aws",
      x: 140,
      y: 120
    }
  ],
  connections: [],
  groups: [
    {
      id: "zone-1",
      label: "Zone",
      children: ["aws-compute-ec2-2"],
      type: "group",
      subType: "zone",
      info: "A new Zone",
      x: 100,
      y: 80
    }
  ]
};

// Test conversion to nested format
const nestedData = convertToNestedHierarchy(testData);
console.log("=== Nested Format Output ===");
console.log(JSON.stringify(nestedData, null, 2));

// Expected output should have nested structure
console.log("\n=== Analysis ===");
console.log("Number of groups:", nestedData.groups.length);
console.log("First group children:", nestedData.groups[0]?.children);
console.log("Has nested nodes:", nestedData.groups[0]?.children?.some(child => 
  typeof child === 'object' && child.type !== 'group'
));

export { testData, nestedData };