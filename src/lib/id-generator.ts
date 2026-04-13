import type { DiagramData } from '@/lib/types';

/** All id strings that must not be reused (nodes, zones, groupings, connection ids). */
export function collectOccupiedDiagramIds(data: DiagramData): Set<string> {
  const occupied = new Set<string>();
  for (const n of data.nodes) occupied.add(n.id);
  for (const z of data.zones || []) occupied.add(z.id);
  for (const g of data.groupings || []) occupied.add(g.id);
  for (const c of data.connections || []) {
    if (c.id) occupied.add(c.id);
  }
  return occupied;
}

/**
 * Generates the next sequential ID for a given base type
 * @param baseId - The base ID (e.g., "generic.device.tablet")
 * @param existingData - Current diagram data to check for existing IDs
 * @param extraOccupiedIds - Additional ids that are already taken (e.g. other items created in the same paste batch)
 * @returns Sequential ID (e.g., "generic.device.tablet-1", "generic.device.tablet-2", etc.)
 */
export function generateSequentialId(
  baseId: string,
  existingData: DiagramData,
  extraOccupiedIds?: Iterable<string>
): string {
  // Normalize the base ID to be URL-safe
  const normalizedBase = baseId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

  const occupied = collectOccupiedDiagramIds(existingData);
  if (extraOccupiedIds) {
    for (const id of extraOccupiedIds) occupied.add(id);
  }

  // Find the highest sequential number for this base type
  // Ignore timestamp-based IDs (numbers > 999) and only look for sequential numbers (1-999)
  let maxNumber = 0;
  const pattern = new RegExp(`^${normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);

  for (const id of occupied) {
    const match = id.match(pattern);
    if (match) {
      const number = parseInt(match[1], 10);
      // Only consider sequential numbers (1-999), ignore timestamp-based IDs
      if (number <= 999 && number > maxNumber) {
        maxNumber = number;
      }
    }
  }

  let candidate = `${normalizedBase}-${maxNumber + 1}`;
  let safety = 0;
  // Any exact id collision (e.g. non-sequential custom ids) still gets a free slot
  while (occupied.has(candidate) && safety < 10_000) {
    maxNumber += 1;
    candidate = `${normalizedBase}-${maxNumber + 1}`;
    safety += 1;
  }
  return candidate;
}

/**
 * Generates sequential ID for groups
 * @param subType - 'group' or 'zone'
 * @param existingData - Current diagram data to check for existing IDs
 * @param extraOccupiedIds - Additional ids already reserved in this operation
 * @returns Sequential group ID (e.g., "group-1", "zone-1", etc.)
 */
export function generateGroupId(
  subType: 'group' | 'zone' = 'group',
  existingData: DiagramData,
  extraOccupiedIds?: Iterable<string>
): string {
  return generateSequentialId(subType, existingData, extraOccupiedIds);
}