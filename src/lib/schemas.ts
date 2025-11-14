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
  // Label-specific styling properties
  borderColor: z.string().optional(), // Border color for label nodes
  backgroundColor: z.string().optional(), // Background color for label nodes
  textColor: z.string().optional(), // Text color for label nodes
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(), // Border style for label/textbox/shape nodes
  borderColors: z.array(z.string()).optional(), // Border colors for gradient [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'none']).optional(), // Background style for label/textbox/shape nodes
  backgroundColors: z.array(z.string()).optional(), // Background colors for gradient [startColor, endColor]
  gradientAngle: z.number().optional(), // Gradient angle in degrees (0, 45, -45, 90, 180)
  shadow: z.boolean().optional(), // Whether to show shadow around label/textbox nodes
  rotation: z.number().optional(), // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition: z.enum(['above', 'center', 'under']).optional(), // Text position for shape nodes
  freeflow: z.boolean().optional(), // If true, node can be placed anywhere without joining groups/zones
  borderWidth: z.number().optional(), // Border thickness for shapes
  // Custom sizing properties for textbox nodes
  width: z.number().optional(), // Custom width - when set, overrides auto-calculated width
  height: z.number().optional(), // Custom height - when set, overrides auto-calculated height
  sizeMode: z.enum(['auto', 'custom']).optional(), // Whether to use auto-calculated or custom dimensions
  noIconBackground: z.boolean().optional(), // If true, removes the white background from icon nodes
  // Text justification for text resources
  textJustify: z.enum(['left', 'center', 'right', 'full']).optional(), // Text justification for text/textbox nodes
  
  // Text styling properties
  fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize: z.number().optional(), // Font size in pixels
  fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
  letterSpacing: z.number().optional(), // Letter spacing in pixels
  lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
  textOpacity: z.number().optional(), // Text opacity (0-1)
});

// Schema for DiagramConnectionData 
export const DiagramConnectionDataSchema = z.object({
  from: z.string(),
  to: z.string(),
  color: z.string().optional(), // Line color for this specific connection
  text: z.string().optional(), // Optional text to display on the connection
  textPosition: z.number().optional(), // Text position along the line (0-100%, default 50%)
  fromPreferredExit: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional(), // Preferred exit direction from source node
  fromArrow: z.boolean().optional(), // Enable arrow at source node edge
  toPreferredEntry: z.enum(['top', 'bottom', 'left', 'right', 'center']).optional(), // Preferred entry direction to target node
  toArrow: z.boolean().optional(), // Enable arrow at target node edge
  arrow: z.boolean().optional(), // Legacy arrow property - backward compatibility
  // Connection style options
  style: z.enum(['bezier']).optional(), // Connection rendering style
  curvature: z.number().optional(), // Bezier curve intensity (0.1 to 1.0)
  lineWidth: z.number().optional(), // Line thickness for the connection (default: 2.5)
  shadow: z.boolean().optional(), // Whether to show shadow around the connection line
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
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(),
  borderColors: z.array(z.string()).optional(), // [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'none']).optional(),
  backgroundColors: z.array(z.string()).optional(), // [startColor, endColor]
  gradientAngle: z.number().optional(), // Gradient angle in degrees (0, 45, -45, 90, 180)
  orientation: z.enum(['horizontal', 'vertical', 'square']).optional(),
  maxItemsPerRow: z.number().optional(),
  lineColor: z.string().optional(),
  shadow: z.boolean().optional(),
  parentId: z.string().optional(),
  
   // Text positioning properties
   textPosition: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right', 'inside', 'inline-top', 'inline-bottom', 'outside-top', 'outside-bottom', 'outside-left', 'outside-right']).optional(),
  
  // Text styling properties
  fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize: z.number().optional(), // Font size in pixels
  fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
  letterSpacing: z.number().optional(), // Letter spacing in pixels
  lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
  textOpacity: z.number().optional(), // Text opacity (0-1)
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
  lineColor: z.string().optional(), // Color for connections/borders
  edgePosition: z.enum(['top', 'bottom', 'left', 'right']).optional(), // Position node on edge of parent group
  // Label-specific styling properties
  borderColor: z.string().optional(), // Border color for label nodes
  backgroundColor: z.string().optional(), // Background color for label nodes
  textColor: z.string().optional(), // Text color for label nodes
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(), // Border style for label/textbox/shape nodes
  borderColors: z.array(z.string()).optional(), // Border colors for gradient [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'none']).optional(), // Background style for label/textbox/shape nodes
  backgroundColors: z.array(z.string()).optional(), // Background colors for gradient [startColor, endColor]
  gradientAngle: z.number().optional(), // Gradient angle in degrees (0, 45, -45, 90, 180)
  shadow: z.boolean().optional(), // Whether to show shadow around label/textbox nodes
  rotation: z.number().optional(), // Rotation angle in degrees (0, 45, -45, 90, -90)
  textPosition: z.enum(['above', 'center', 'under']).optional(), // Text position for shape nodes
  freeflow: z.boolean().optional(), // If true, node can be placed anywhere without joining groups/zones
  borderWidth: z.number().optional(), // Border thickness for shapes
  // Custom sizing properties for textbox nodes
  width: z.number().optional(), // Custom width - when set, overrides auto-calculated width
  height: z.number().optional(), // Custom height - when set, overrides auto-calculated height
  sizeMode: z.enum(['auto', 'custom']).optional(), // Whether to use auto-calculated or custom dimensions
  noIconBackground: z.boolean().optional(), // If true, removes the white background from icon nodes
  // Text justification for text resources
  textJustify: z.enum(['left', 'center', 'right', 'full']).optional(), // Text justification for text/textbox nodes
  
  // Text styling properties
  fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
  fontSize: z.number().optional(), // Font size in pixels
  fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
  letterSpacing: z.number().optional(), // Letter spacing in pixels
  lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
  textOpacity: z.number().optional(), // Text opacity (0-1)
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
  color: z.string().optional(), // For colored groups (legacy, kept for compatibility)
  borderColor: z.string().optional(), // Border color (legacy, kept for compatibility)
  textColor: z.string().optional(), // Text color
  backgroundColor: z.string().optional(), // Background color (legacy, kept for compatibility)
  borderStyle: z.enum(['solid', 'dotted', 'gradient', 'none']).optional(), // Border style
  borderColors: z.array(z.string()).optional(), // Border colors for gradient [startColor, endColor]
  backgroundStyle: z.enum(['solid', 'gradient', 'none']).optional(), // Background style
  backgroundColors: z.array(z.string()).optional(), // Background colors for gradient [startColor, endColor]
  gradientAngle: z.number().optional(), // Gradient angle in degrees (0, 45, -45, 90, 180)
  orientation: z.enum(['horizontal', 'vertical', 'square']).optional(), // Group shape orientation
  maxItemsPerRow: z.number().optional(), // Maximum items per row (for grid layouts)
  lineColor: z.string().optional(), // Color for connections from this group
  shadow: z.boolean().optional(), // Whether to show shadow around the group/zone
  
   // Text positioning properties
   textPosition: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right', 'inside', 'inline-top', 'inline-bottom', 'outside-top', 'outside-bottom', 'outside-left', 'outside-right']).optional(),
   
   // Text styling properties
   fontFamily: z.string().optional(), // Font family (e.g., 'Arial', 'Helvetica', 'Times New Roman')
   fontSize: z.number().optional(), // Font size in pixels
   fontWeight: z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(), // Font weight
   fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(), // Font style
   textDecoration: z.enum(['none', 'underline', 'overline', 'line-through']).optional(), // Text decoration
   textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(), // Text transformation
   letterSpacing: z.number().optional(), // Letter spacing in pixels
   lineHeight: z.number().optional(), // Line height as a multiplier (e.g., 1.2, 1.5)
   textOpacity: z.number().optional(), // Text opacity (0-1)
   
   // Custom sizing properties
   width: z.number().optional(), // Custom width - when set, overrides auto-calculated width
   height: z.number().optional(), // Custom height - when set, overrides auto-calculated height
   sizeMode: z.enum(['auto', 'custom']).optional(), // Whether to use auto-calculated or custom dimensions
   minWidth: z.number().optional(), // Minimum width constraint (based on content)
   minHeight: z.number().optional(), // Minimum height constraint (based on content)
   rotation: z.number().optional(), // Rotation angle in degrees (0, 45, -45, 90, -90)
   borderWidth: z.number().optional(), // Border thickness for groups/zones
 });

// Schema for nested hierarchical diagram data
export const HierarchicalDiagramDataSchema = z.object({
  groups: z.array(DiagramGroupItemSchema).default([]),
  connections: z.array(DiagramConnectionDataSchema).default([]),
});