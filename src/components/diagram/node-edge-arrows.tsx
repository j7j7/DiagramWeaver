"use client";

import React from "react";
import type { DiagramNodeData, DiagramConnectionData } from "@/lib/types";

const NODE_WIDTH = 104;
const NODE_HEIGHT = 100;
const TEXT_NODE_HEIGHT = 40;
const EXTRA_LINE_HEIGHT = 20;
const GRID_SIZE = 20;

interface NodeEdgeArrowsProps {
  node: DiagramNodeData & { x: number; y: number };
  connections: DiagramConnectionData[];
  width: number;
  height: number;
}

function calculateNodeHeight(label: string = '', isTextNode: boolean) {
  if (isTextNode) {
    const maxCharsPerLine = 20;
    const lines = Math.ceil(label.length / maxCharsPerLine);
    return TEXT_NODE_HEIGHT + ((lines - 1) * EXTRA_LINE_HEIGHT);
  } else {
    const maxCharsPerLine = 12;
    const lines = Math.ceil(label.length / maxCharsPerLine);
    return NODE_WIDTH + ((lines - 1) * EXTRA_LINE_HEIGHT);
  }
}

export function NodeEdgeArrows({ node, connections, width, height }: NodeEdgeArrowsProps) {
  const isTextNode = node.type === 'generic.text.text';
  const nodeHeight = calculateNodeHeight(node.label || '', isTextNode);
  const nodeWidth = isTextNode ? 90 : NODE_WIDTH; // Approximate width for text nodes

  // Find connections that have this node as source or target with arrows enabled
  const sourceArrowConnections = connections.filter(conn => 
    conn.from === node.id && conn.fromArrow === true && conn.fromPreferredExit
  );
  
  const targetArrowConnections = connections.filter(conn => 
    conn.to === node.id && conn.toArrow === true && conn.toPreferredEntry
  );
  
  const allArrowConnections = [...sourceArrowConnections, ...targetArrowConnections];

  if (allArrowConnections.length === 0) {
    return null;
  }

  return (
    <g>
      {/* Source arrows (from this node) */}
      {sourceArrowConnections
        .filter(connection => {
          const direction = connection.fromPreferredExit;
          return direction === 'top' || direction === 'bottom' || direction === 'left' || direction === 'right';
        })
        .map((connection, index) => {
          const direction = connection.fromPreferredExit!;
          const isSource = true;
          
          // Calculate arrow position on node edge
          let arrowX, arrowY, rotation;
          
          switch (direction) {
            case 'top':
              arrowX = node.x + nodeWidth / 2;
              arrowY = node.y - GRID_SIZE;
              rotation = 0; // Pointing up
              break;
            case 'bottom':
              arrowX = node.x + nodeWidth / 2;
              arrowY = node.y + nodeHeight + GRID_SIZE;
              rotation = 180; // Pointing down
              break;
            case 'left':
              arrowX = node.x - GRID_SIZE;
              arrowY = node.y + nodeHeight / 2;
              rotation = 270; // Pointing left
              break;
            case 'right':
              arrowX = node.x + nodeWidth + GRID_SIZE;
              arrowY = node.y + nodeHeight / 2;
              rotation = 90; // Pointing right
              break;
            default:
              // This should never happen due to the filter above
              arrowX = node.x + nodeWidth / 2;
              arrowY = node.y - GRID_SIZE;
              rotation = 0;
              break;
          }

          return (
            <g key={`source-${connection.from}-${connection.to}-${index}`}>
              {/* Arrow body/line extending from node edge */}
              <line
                x1={
                  direction === 'left' ? node.x : 
                  direction === 'right' ? node.x + nodeWidth :
                  node.x + nodeWidth / 2
                }
                y1={
                  direction === 'top' ? node.y :
                  direction === 'bottom' ? node.y + nodeHeight :
                  node.y + nodeHeight / 2
                }
                x2={arrowX}
                y2={arrowY}
                stroke={connection.color || node.lineColor || '#6b7280'}
                strokeWidth="2.5"
                className="pointer-events-none"
              />
              
              {/* Arrowhead */}
              <g transform={`translate(${arrowX}, ${arrowY}) rotate(${rotation})`}>
                <polygon
                  points="0,-4 8,0 0,4 -2,0"
                  fill={connection.color || node.lineColor || '#6b7280'}
                  className="pointer-events-none"
                />
              </g>
            </g>
          );
        })}
        
      {/* Target arrows (to this node) */}
      {targetArrowConnections
        .filter(connection => {
          const direction = connection.toPreferredEntry;
          return direction === 'top' || direction === 'bottom' || direction === 'left' || direction === 'right';
        })
        .map((connection, index) => {
          const direction = connection.toPreferredEntry!;
          
          // Calculate arrow position on node edge
          let arrowX, arrowY, rotation;
          
          switch (direction) {
            case 'top':
              arrowX = node.x + nodeWidth / 2;
              arrowY = node.y - GRID_SIZE;
              rotation = 180; // Pointing into node (down)
              break;
            case 'bottom':
              arrowX = node.x + nodeWidth / 2;
              arrowY = node.y + nodeHeight + GRID_SIZE;
              rotation = 0; // Pointing into node (up)
              break;
            case 'left':
              arrowX = node.x - GRID_SIZE;
              arrowY = node.y + nodeHeight / 2;
              rotation = 90; // Pointing into node (right)
              break;
            case 'right':
              arrowX = node.x + nodeWidth + GRID_SIZE;
              arrowY = node.y + nodeHeight / 2;
              rotation = 270; // Pointing into node (left)
              break;
            default:
              arrowX = node.x + nodeWidth / 2;
              arrowY = node.y - GRID_SIZE;
              rotation = 180;
              break;
          }

          return (
            <g key={`target-${connection.from}-${connection.to}-${index}`}>
              {/* Arrow body/line extending from node edge */}
              <line
                x1={
                  direction === 'left' ? node.x : 
                  direction === 'right' ? node.x + nodeWidth :
                  node.x + nodeWidth / 2
                }
                y1={
                  direction === 'top' ? node.y :
                  direction === 'bottom' ? node.y + nodeHeight :
                  node.y + nodeHeight / 2
                }
                x2={arrowX}
                y2={arrowY}
                stroke={connection.color || node.lineColor || '#6b7280'}
                strokeWidth="2.5"
                className="pointer-events-none"
              />
              
              {/* Arrowhead pointing into the node */}
              <g transform={`translate(${arrowX}, ${arrowY}) rotate(${rotation})`}>
                <polygon
                  points="0,-4 8,0 0,4 -2,0"
                  fill={connection.color || node.lineColor || '#6b7280'}
                  className="pointer-events-none"
                />
              </g>
            </g>
          );
        })}
    </g>
  );
}