import type { DiagramData } from './types';
import { createPureHierarchy, flattenPureHierarchy } from './pure-hierarchy';

/**
 * Test the exact example provided by user
 */
export function testUserExample() {
  const userData: DiagramData = {
    "nodes": [
      {
        "id": "node-1",
        "type": "aws.compute.ec2",
        "label": "EC2",
        "info": "EC2 from aws"
      },
      {
        "id": "node-2",
        "type": "aws.compute.ec2",
        "label": "EC2",
        "info": "EC2 from aws"
      },
      {
        "id": "node-3",
        "type": "aws.compute.ec2",
        "label": "EC2",
        "info": "EC2 from aws"
      },
      {
        "id": "node-4",
        "type": "aws.compute.ec2",
        "label": "EC2",
        "info": "EC2 from aws"
      }
    ],
    "connections": [],
    "zones": [
      {
        "id": "group-1",
        "label": "",
        "type": "zone",
        "children": [
          "node-1"
        ]
      },
      {
        "id": "group-2",
        "label": "Group",
        "type": "zone",
        "info": "A new Group",
        "children": [
          "node-2",
          "group-3"
        ]
      },
      {
        "id": "group-3",
        "label": "Group",
        "type": "zone",
        "info": "A new Group",
        "children": [
          "node-3",
          "node-4"
        ]
      }
    ]
  };

  console.log('=== USER EXAMPLE TEST ===');
  console.log('Input data:', userData);
  
  // Test pure hierarchy conversion
  const pureData = createPureHierarchy(userData);
  console.log('Pure hierarchy result:', pureData);
  
  // Test flattening for rendering
  const { positionedGroups, positionedNodes } = flattenPureHierarchy(pureData.zones ?? [], pureData.nodes);
  console.log('Positioned zones:', positionedGroups);
  console.log('Positioned nodes:', positionedNodes);
  
  // Verify expectations
  const group1 = positionedGroups.find(g => g.id === 'group-1');
  const group2 = positionedGroups.find(g => g.id === 'group-2');
  const group3 = positionedGroups.find(g => g.id === 'group-3');
  
  console.log('=== VERIFICATION ===');
  console.log('Group 1 (should be invisible):', {
    hasLabel: !!group1?.label,
    isVisible: !!group1?.label
  });
  
  console.log('Group 2 (should be visible):', {
    hasLabel: !!group2?.label,
    isVisible: !!group2?.label,
    children: group2?.children
  });
  
  console.log('Group 3 (should be visible, nested):', {
    hasLabel: !!group3?.label,
    isVisible: !!group3?.label,
    children: group3?.children
  });
  
  return {
    pureData,
    positionedGroups,
    positionedNodes,
    verification: {
      group1Invisible: !group1?.label,
      group2Visible: !!group2?.label,
      group3Visible: !!group3?.label,
      group3Nested: group2?.children?.includes('group-3')
    }
  };
}