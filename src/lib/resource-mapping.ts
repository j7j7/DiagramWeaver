export interface ResourceMapping {
  provider: string;
  category: string;
  file: string;
}

export interface MappedImportItem {
  id: string;
  label: string;
  type: string;
  data: any;
  isFavorite: boolean;
  importId: string;
  resourceMapping?: ResourceMapping;
  objectType?: 'shape' | 'icon' | 'text';
}

/**
 * Fuzzy search for resource in provider catalog
 */
async function fuzzySearchResource(provider: string, searchType: string): Promise<ResourceMapping | null> {
  try {
    const response = await fetch(`/resources/resource-${provider}.json`);
    if (!response.ok) return null;
    
    const catalog = await response.json();
    const searchLower = searchType.toLowerCase();
    
    // Search through all categories
    for (const [categoryKey, categoryData] of Object.entries(catalog.categories || {})) {
      if (categoryData && typeof categoryData === 'object' && 'resources' in categoryData) {
        const resources = (categoryData as any).resources;
        if (Array.isArray(resources)) {
          for (const resource of resources) {
            const resourceName = resource.name.toLowerCase();
            
            // Exact match
            if (resourceName === searchLower) {
              return {
                provider: provider.toLowerCase(),
                category: categoryKey.toLowerCase(),
                file: resource.file
              };
            }
            
            // Fuzzy matching - check if search term is contained in resource name
            if (resourceName.includes(searchLower) || searchLower.includes(resourceName)) {
              return {
                provider: provider.toLowerCase(),
                category: categoryKey.toLowerCase(),
                file: resource.file
              };
            }
            
            // Check for partial matches (e.g., "ec2" matches "EC2 Instance")
            if (resourceName.includes('ec2') && searchLower.includes('ec2') ||
                resourceName.includes('ecs') && searchLower.includes('ecs') ||
                resourceName.includes('rds') && searchLower.includes('rds') ||
                resourceName.includes('s3') && searchLower.includes('s3') ||
                resourceName.includes('lambda') && searchLower.includes('lambda')) {
              return {
                provider: provider.toLowerCase(),
                category: categoryKey.toLowerCase(),
                file: resource.file
              };
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to search resources for ${provider}:`, error);
  }
  
  return null;
}

/**
 * Maps imported items to resource files based on simple format or legacy scratchpad format
 */
async function mapImportToResource(item: any): Promise<ResourceMapping | null> {
  // Handle legacy scratchpad format
  if (item.scratchpad) {
    const { provider, category, file } = item.scratchpad;
    if (provider && category && file) {
      return {
        provider: provider.toLowerCase(),
        category: category.toLowerCase(),
        file: file
      };
    }
  }

  // Handle simple format: name, type, description, provider
  if (!item.provider || !item.type) {
    return null;
  }

  const provider = item.provider.toLowerCase();
  const type = item.type.toLowerCase();

  // Try fuzzy search first
  const fuzzyResult = await fuzzySearchResource(provider, type);
  if (fuzzyResult) {
    return fuzzyResult;
  }

  // Fallback to generic mappings
  const genericMappings: Record<string, string> = {
    'server': 'compute/server.png',
    'database': 'database/database.png',
    'storage': 'storage/storage.png',
    'network': 'network/network.png',
    'firewall': 'security/firewall.png',
    'load balancer': 'network/load-balancer.png'
  };

  if (genericMappings[type]) {
    const [category, file] = genericMappings[type].split('/');
    return {
      provider: 'generic',
      category: category,
      file: file
    };
  }

  // Default fallback
  return {
    provider: 'generic',
    category: 'compute',
    file: 'server.png'
  };
}

/**
 * Determine object type based on item properties
 */
function determineObjectType(item: any, _resourceMapping: ResourceMapping | null): 'shape' | 'icon' | 'text' {
  // Check if it's a text resource
  if (item.type?.toLowerCase().includes('text') || 
      item.type?.toLowerCase().includes('textbox') ||
      item.type?.startsWith('generic.text')) {
    return 'text';
  }
  
  // Check if it's a shape resource
  if (item.type?.startsWith('generic.object') ||
      item.type?.includes('square') ||
      item.type?.includes('circle') ||
      item.type?.includes('triangle') ||
      item.type?.includes('rectangle') ||
      item.type?.includes('rounded-rectangle') ||
      item.type?.includes('star') ||
      item.type?.includes('cloud') ||
      item.type?.includes('parallelogram') ||
      item.type?.includes('trapezoid') ||
      item.type?.includes('kite') ||
      item.type?.includes('hexagon') ||
      item.type?.includes('pentagon') ||
      item.type?.includes('octagon') ||
      item.type?.includes('jigsaw') ||
      item.type?.includes('arrowhead') ||
      item.type?.includes('chevron')) {
    return 'shape';
  }
  
  // Default to icon for cloud resources and other types
  return 'icon';
}

/**
 * Processes imported JSON array and maps items to resources
 */
export async function processImportedItems(json: any[]): Promise<MappedImportItem[]> {
  const promises = json.map(async (item: any) => {
    const resourceMapping = await mapImportToResource(item);
    
    // Determine type based on resource mapping or fallback
    let type = 'generic.object.square'; // default type
    
    if (resourceMapping) {
      // Create type based on provider and category, using original type name
      // This ensures ResourceIcon can find correct resource in catalog
      type = `${resourceMapping.provider}.${resourceMapping.category}.${item.type.toLowerCase()}`;
    } else if (item.type) {
      type = item.type;
    }

    const objectType = determineObjectType(item, resourceMapping);

    return {
      id: crypto.randomUUID(),
      label: item.name || 'Imported Item',
      type,
      data: {
        ...item,
        // Add resource mapping to data for icon rendering
        ...(resourceMapping && { resourceMapping }),
        // Store provider, category, file for canvas rendering
        ...(resourceMapping && {
          provider: resourceMapping.provider,
          category: resourceMapping.category,
          file: resourceMapping.file
        }),
        // Store description if provided
        ...(item.description && { info: item.description })
      },
      isFavorite: false,
      importId: item.importId || item.name || crypto.randomUUID(), // Use name as importId for matching
      objectType,
      ...(resourceMapping && { resourceMapping })
    };
  });

  return Promise.all(promises);
}

/**
 * Gets the resource path for an item's icon
 */
export function getResourcePath(item: any): string | null {
  // Check if item has resourceMapping (for imports)
  if (item.resourceMapping) {
    const { provider, category, file } = item.resourceMapping;
    return `/resources/${provider}/${category}/${file}`;
  }
  
  // Check if data has resource mapping
  if (item.data?.resourceMapping) {
    const { provider, category, file } = item.data.resourceMapping;
    return `/resources/${provider}/${category}/${file}`;
  }
  
  // Check legacy scratchpad format
  if (item.data?.scratchpad) {
    const { provider, category, file } = item.data.scratchpad;
    if (provider && category && file) {
      return `/resources/${provider}/${category}/${file}`;
    }
  }
  
  // Check if the item itself has the resource info (for favorites from sidebar)
  if (item.data?.provider && item.data?.category && item.data?.file) {
    return `/resources/${item.data.provider}/${item.data.category}/${item.data.file}`;
  }
  
  // Check if the item itself has the resource info (for direct drag from sidebar and canvas nodes)
  if (item.provider && item.category && item.file) {
    return `/resources/${item.provider}/${item.category}/${item.file}`;
  }
  
  return null;
}