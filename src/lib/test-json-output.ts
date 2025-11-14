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
  zones: [
    {
      id: "zone-1",
      label: "Zone",
      children: ["aws-compute-ec2-2"],
      type: "zone",
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
console.log("Number of zones:", nestedData.zones.length);
console.log("First zone children:", nestedData.zones[0]?.children);
console.log("Has nested nodes:", nestedData.zones[0]?.children?.some((child: any) => 
  typeof child === 'object' && child.type !== 'zone'
));

export { testData, nestedData };