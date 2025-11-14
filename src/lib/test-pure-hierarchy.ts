import type { DiagramData } from './types';
import { createPureHierarchy } from './pure-hierarchy';

/**
 * Test the pure hierarchical model
 */
export function testPureHierarchy() {
  // Test case 1: Single node (should create invisible root group)
  const singleNodeData: DiagramData = {
    nodes: [{ id: "node1", type: "aws.compute.ec2", x: 100, y: 100 }],
    connections: [],
    zones: []
  };

  const result1 = createPureHierarchy(singleNodeData);
  console.log('Single node result:', result1);
  
  // Test case 2: Existing hierarchy
  const hierarchyData: DiagramData = {
    nodes: [
      { id: "node1", type: "aws.compute.ec2", x: 100, y: 100 },
      { id: "node2", type: "aws.compute.ec2-instance", x: 200, y: 200 },
      { id: "node3", type: "aws.database.rds", x: 300, y: 300 }
    ],
    connections: [],
    zones: [
      {
        id: "group1",
        type: "zone",
        label: "Main Group",
        children: ["node1", "group2"],
        subType: "group",
        x: 50,
        y: 50
      },
      {
        id: "group2", 
        type: "zone",
        label: "Sub Group",
        children: ["node2", "node3"],
        subType: "zone",
        x: 150,
        y: 150
      }
    ]
  };

  const result2 = createPureHierarchy(hierarchyData);
  console.log('Hierarchy result:', result2);

  return { result1, result2 };
}