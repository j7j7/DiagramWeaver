import { z } from 'zod';

// Schema for DiagramNodeData based on actual types
export const DiagramNodeDataSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  info: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  imagePath: z.string().optional(), // Override icon path
  lineColor: z.string().optional(), // Color for connections/borders
  edgePosition: z.enum(['top', 'bottom', 'left', 'right']).optional(), // Position node on edge of parent group
});

// Schema for DiagramConnectionData 
export const DiagramConnectionDataSchema = z.object({
  from: z.string(),
  to: z.string(),
  color: z.string().optional(), // Line color for this specific connection
  text: z.string().optional(), // Optional text to display on the connection
});

// Schema for DiagramGroupData
export const DiagramGroupDataSchema = z.object({
  id: z.string(),
  type: z.literal('group'),
  label: z.string().optional(),
  children: z.array(z.string()),
  info: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  subType: z.enum(['zone', 'group']).optional(),
  color: z.string().optional(), // Legacy compatibility
  borderColor: z.string().optional(),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  borderStyle: z.enum(['solid', 'gradient']).optional(),
  borderColors: z.array(z.string()).optional(), // [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient']).optional(),
  backgroundColors: z.array(z.string()).optional(), // [startColor, endColor]
  orientation: z.enum(['horizontal', 'vertical', 'square']).optional(),
  maxItemsPerRow: z.number().optional(),
  lineColor: z.string().optional(),
  shadow: z.boolean().optional(),
  parentId: z.string().optional(),
});

// Main DiagramData schema
export const DiagramDataSchema = z.object({
  nodes: z.array(DiagramNodeDataSchema).default([]),
  connections: z.array(DiagramConnectionDataSchema).default([]),
  groups: z.array(DiagramGroupDataSchema).default([]),
});

export type DiagramDataValidated = z.infer<typeof DiagramDataSchema>;

// Schema for nested node items
export const DiagramNodeItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  info: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  lineColor: z.string().optional(),
});

// Schema for nested group items (recursive)
export const DiagramGroupItemSchema: z.ZodType<any> = z.object({
  id: z.string(),
  type: z.literal('group'),
  label: z.string().optional(),
  info: z.string().optional(),
  children: z.array(z.any()).optional(), // Will be validated recursively
  x: z.number().optional(),
  y: z.number().optional(),
  subType: z.enum(['zone', 'group']).optional(),
  color: z.string().optional(),
  borderColor: z.string().optional(),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  borderStyle: z.enum(['solid', 'gradient']).optional(),
  borderColors: z.array(z.string()).optional(),
  backgroundStyle: z.enum(['solid', 'gradient']).optional(),
  backgroundColors: z.array(z.string()).optional(),
  orientation: z.enum(['horizontal', 'vertical', 'square']).optional(),
  maxItemsPerRow: z.number().optional(),
  lineColor: z.string().optional(),
  shadow: z.boolean().optional(),
});

// Schema for nested hierarchical diagram data
export const HierarchicalDiagramDataSchema = z.object({
  groups: z.array(DiagramGroupItemSchema).default([]),
  connections: z.array(DiagramConnectionDataSchema).default([]),
});