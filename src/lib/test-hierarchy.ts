import type { DiagramData } from './types';
import { migrateToHierarchical, flattenHierarchy } from './group-hierarchy';

/**
 * Test function to verify hierarchical group model
 */
export function testHierarchicalModel() {
  // Sample data representing the user's scenario
  const testData: DiagramData = {
    nodes: [
      { id: "1", type: "aws.compute.ec2", x: 320, y: 80 },
      { id: "2", type: "aws.compute.ec2-instance", x: 100, y: 280 }
    ],
    connections: [],
    zones: [
      {
        id: "zone-1",
        type: "zone",
        label: "Zone",
        children: ["2"],
        subType: "zone",
        x: -20,
        y: -220
      },
      {
        id: "zone-2", 
        type: "zone",
        label: "Zone",
        children: ["1"],
        subType: "zone",
        x: 280,
        y: 40
      },
      {
        id: "group-1",
        type: "zone", 
        label: "Group",
        children: ["zone-1"], // zone-1 is nested inside group-1
        info: "A new Group",
        x: -60,
        y: -260,
        subType: "group",
        color: "#e0e0e0"
      }
    ]
  };

  // Migrate to hierarchical model
  const hierarchicalGroups = migrateToHierarchical(testData.zones || []);
  
  console.log('Original zones:', testData.zones);
  console.log('Hierarchical zones:', hierarchicalGroups);
  
  // Test flattening
  const { positionedGroups, positionedNodes } = flattenHierarchy(
    hierarchicalGroups, 
    testData.nodes
  );
  
  console.log('Positioned zones:', positionedGroups);
  console.log('Positioned nodes:', positionedNodes);
  
  return {
    hierarchicalGroups,
    positionedGroups,
    positionedNodes
  };
}