import type { DiagramData } from '@/lib/types';

/**
 * Generates the next sequential ID for a given base type
 * @param baseId - The base ID (e.g., "generic.device.tablet")
 * @param existingData - Current diagram data to check for existing IDs
 * @returns Sequential ID (e.g., "generic.device.tablet-1", "generic.device.tablet-2", etc.)
 */
export function generateSequentialId(baseId: string, existingData: DiagramData): string {
  // Normalize the base ID to be URL-safe
  const normalizedBase = baseId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  
  // Get all existing IDs (nodes, zones, and groupings)
  const allIds = [
    ...existingData.nodes.map(n => n.id),
    ...(existingData.zones || []).map(z => z.id),
    ...(existingData.groupings || []).map(g => g.id)
  ];
  
  // Find the highest sequential number for this base type
  // Ignore timestamp-based IDs (numbers > 999) and only look for sequential numbers (1-999)
  let maxNumber = 0;
  const pattern = new RegExp(`^${normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
  
  for (const id of allIds) {
    const match = id.match(pattern);
    if (match) {
      const number = parseInt(match[1], 10);
      // Only consider sequential numbers (1-999), ignore timestamp-based IDs
      if (number <= 999 && number > maxNumber) {
        maxNumber = number;
      }
    }
  }
  
  // Return the next sequential number
  return `${normalizedBase}-${maxNumber + 1}`;
}

/**
 * Generates sequential ID for groups
 * @param subType - 'group' or 'zone'
 * @param existingData - Current diagram data to check for existing IDs
 * @returns Sequential group ID (e.g., "group-1", "zone-1", etc.)
 */
export function generateGroupId(subType: 'group' | 'zone' = 'group', existingData: DiagramData): string {
  return generateSequentialId(subType, existingData);
}