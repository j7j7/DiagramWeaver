/**
 * Type matcher utility for expanding abbreviated resource types
 * Supports fuzzy matching like "aws.c.ec2" -> "aws.compute.ec2-instance"
 * or "a.c.e" -> "aws.compute.ec2-instance"
 */

interface ResourceType {
  fullType: string;
  provider: string;
  category: string;
  resource: string;
}

/**
 * Load all available resource types from the resource files
 */
export async function loadAllResourceTypes(): Promise<ResourceType[]> {
  const resourceTypes: ResourceType[] = [];
  
  try {
    // Load the main resource index
    const indexResponse = await fetch('/resources/resource-components.json');
    const index = await indexResponse.json();
    
    // Load each enabled provider's resources
    const providerPromises = Object.entries(index.providers)
      .filter(([, provider]: [string, any]) => provider.enabled)
      .map(async ([providerKey, provider]: [string, any]) => {
        try {
          const response = await fetch(`/resources/${provider.file}`);
          const data = await response.json();
          
          // Extract all resource types from this provider
          Object.entries(data.categories || {}).forEach(([categoryKey, category]: [string, any]) => {
            if (category.resources) {
              category.resources.forEach((resource: any) => {
                const resourceSlug = resource.name.replace(/\s+/g, '-').toLowerCase();
                let fullType = `${providerKey}.${categoryKey}.${resourceSlug}`;
                if (providerKey === 'generic' && categoryKey === 'text' && resourceSlug === 'text-box-heading') {
                  fullType = 'generic.object.text-box-heading';
                }
                resourceTypes.push({
                  fullType,
                  provider: providerKey,
                  category: categoryKey,
                  resource: resourceSlug
                });
              });
            }
          });
        } catch (err) {
          console.warn(`Failed to load provider ${providerKey}:`, err);
        }
      });
    
    await Promise.all(providerPromises);
  } catch (err) {
    console.error('Failed to load resource types:', err);
  }
  
  return resourceTypes;
}

/**
 * Matches an abbreviated pattern against available resource types
 * @param pattern - Abbreviated pattern like "aws.c.ec2" or "a.c.e"
 * @param availableTypes - List of all available resource types
 * @returns Best matching full type or null if no match
 */
export function matchResourceType(pattern: string, availableTypes: ResourceType[]): string | null {
  if (!pattern || !availableTypes.length) return null;
  
  const normalizedPattern = pattern.toLowerCase().trim();
  
  // If it's already a full type, return it if valid
  const exactMatch = availableTypes.find(type => type.fullType === normalizedPattern);
  if (exactMatch) return exactMatch.fullType;
  
  const parts = normalizedPattern.split('.');
  if (parts.length !== 3) return null; // Must have provider.category.resource format
  
  const [providerPattern, categoryPattern, resourcePattern] = parts;
  
  // Score each type based on how well it matches
  const scored = availableTypes.map(type => {
    const score = calculateMatchScore(
      { provider: providerPattern, category: categoryPattern, resource: resourcePattern },
      type
    );
    return { type, score };
  });
  
  // Sort by score (higher is better) and return the best match
  scored.sort((a, b) => b.score - a.score);
  const bestMatch = scored[0];
  
  // Only return if we have a decent match (score > 0)
  return bestMatch && bestMatch.score > 0 ? bestMatch.type.fullType : null;
}

/**
 * Calculate match score between pattern and resource type
 */
function calculateMatchScore(
  pattern: { provider: string; category: string; resource: string },
  type: ResourceType
): number {
  let score = 0;
  
  // Provider matching (most important)
  const providerScore = getStringMatchScore(pattern.provider, type.provider);
  if (providerScore === 0) return 0; // Must match provider
  score += providerScore * 100;
  
  // Category matching (second most important)  
  const categoryScore = getStringMatchScore(pattern.category, type.category);
  if (categoryScore === 0) return 0; // Must match category
  score += categoryScore * 50;
  
  // Resource matching (least important but still required)
  const resourceScore = getStringMatchScore(pattern.resource, type.resource);
  if (resourceScore === 0) return 0; // Must match resource
  score += resourceScore * 10;
  
  return score;
}

/**
 * Get string match score using various matching strategies
 */
function getStringMatchScore(pattern: string, target: string): number {
  if (!pattern || !target) return 0;
  
  const normalizedPattern = pattern.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  
  // Exact match (highest score)
  if (normalizedPattern === normalizedTarget) return 100;
  
  // Prefix match (high score)
  if (normalizedTarget.startsWith(normalizedPattern)) return 80;
  
  // Contains match (medium score)
  if (normalizedTarget.includes(normalizedPattern)) return 60;
  
  // Abbreviation match (pattern is initials of target)
  if (isAbbreviationMatch(normalizedPattern, normalizedTarget)) return 40;
  
  // Fuzzy match based on character overlap
  const fuzzyScore = getFuzzyMatchScore(normalizedPattern, normalizedTarget);
  if (fuzzyScore > 0.5) return Math.floor(fuzzyScore * 30); // Max 30 for fuzzy
  
  return 0;
}

/**
 * Check if pattern is an abbreviation of target (e.g., "c" matches "compute")
 */
function isAbbreviationMatch(pattern: string, target: string): boolean {
  if (pattern.length > target.length) return false;
  
  // Simple abbreviation: first N characters
  if (target.startsWith(pattern)) return true;
  
  // Word initials abbreviation (e.g., "ec" for "ec2-instance")
  const words = target.split(/[-_]/);
  if (words.length > 1) {
    const initials = words.map(word => word[0] || '').join('');
    if (initials.startsWith(pattern)) return true;
  }
  
  return false;
}

/**
 * Calculate fuzzy match score based on character overlap
 */
function getFuzzyMatchScore(pattern: string, target: string): number {
  if (!pattern || !target) return 0;
  
  const patternChars = pattern.split('');
  const targetChars = target.split('');
  
  let matches = 0;
  let patternIndex = 0;
  
  for (const char of targetChars) {
    if (patternIndex < patternChars.length && char === patternChars[patternIndex]) {
      matches++;
      patternIndex++;
    }
  }
  
  return matches / pattern.length;
}

/**
 * Cached resource types to avoid repeated API calls
 */
let cachedResourceTypes: ResourceType[] | null = null;

/**
 * Get or load resource types with caching
 */
export async function getResourceTypes(): Promise<ResourceType[]> {
  if (!cachedResourceTypes) {
    cachedResourceTypes = await loadAllResourceTypes();
  }
  return cachedResourceTypes;
}

/**
 * Main function to expand abbreviated type to full type
 * @param abbreviatedType - Pattern like "aws.c.ec2" or "a.c.e"
 * @returns Promise resolving to full type or null
 */
export async function expandResourceType(abbreviatedType: string): Promise<string | null> {
  try {
    // Check for known removed/deprecated types
    if (isRemovedType(abbreviatedType)) {
      console.warn(`Type '${abbreviatedType}' has been removed and will be ignored`);
      return null;
    }
    
    const resourceTypes = await getResourceTypes();
    const match = matchResourceType(abbreviatedType, resourceTypes);
    
    // If no match found, it might be an invalid/removed type
    if (!match) {
      console.warn(`No matching resource type found for: ${abbreviatedType}`);
    }
    
    return match;
  } catch (error) {
    console.error(`Error expanding resource type '${abbreviatedType}':`, error);
    return null;
  }
}

/**
 * Check if a type has been removed/deprecated
 */
function isRemovedType(type: string): boolean {
  const removedTypes = [
    'generic.grouping.group',
    // Add other removed types here as needed
  ];
  
  const normalizedType = type.toLowerCase().trim();
  
  // Check explicit removed types
  if (removedTypes.includes(normalizedType)) {
    return true;
  }
  
  // Check for patterns that are clearly invalid
  // For example, if it references a category that doesn't exist
  const parts = normalizedType.split('.');
  if (parts.length >= 3) {
    const [provider, category] = parts;
    
    // Known providers and their valid categories
    const validCategories: Record<string, string[]> = {
      'generic': ['grouping', 'text', 'object', 'user', 'device', 'os'],
      // Add other providers as needed
    };
    
    if (validCategories[provider] && !validCategories[provider].includes(category)) {
      console.warn(`Invalid category '${category}' for provider '${provider}' in type: ${type}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Batch expand multiple abbreviated types
 */
export async function expandResourceTypes(abbreviatedTypes: string[]): Promise<(string | null)[]> {
  const resourceTypes = await getResourceTypes();
  return abbreviatedTypes.map(pattern => matchResourceType(pattern, resourceTypes));
}