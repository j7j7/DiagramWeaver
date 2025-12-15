"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Server, User } from "lucide-react";

interface ResourceIconProps extends React.SVGProps<SVGSVGElement> {
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  imagePath?: string; // If provided, use this exact icon path (legacy support)
  provider?: string; // Direct provider info for icon lookup
  category?: string; // Direct category info for icon lookup  
  file?: string; // Direct file info for icon lookup
}

export function ResourceIcon({ type, imagePath, provider, category, file, ...props }: ResourceIconProps) {
  const [resourceFile, setResourceFile] = useState<string | null>(null);

  // Look up file from resource catalog based on type or direct provider info
  useEffect(() => {
    // If direct provider info is provided, use it immediately
    if (provider && category && file) {
      setResourceFile(file);
      return;
    }

    const parts = type.split('.');
    if (parts.length >= 3) {
      const typeProvider = parts[0];
      const typeCategory = parts[1];
      const resourceName = parts.slice(2).join('-').toLowerCase();
      
      // Reset resource file when type changes
      setResourceFile(null);
      
      // Fetch resource catalog to get correct filename
      fetch(`/resources/resource-${typeProvider}.json`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          const categoryData = data.categories?.[typeCategory];
          if (categoryData?.resources) {
            // Find resource that matches resourceName (derived from type)
            // Look for resources where name.toLowerCase().replace(/\s+/g, '-') matches resourceName
            const resource = categoryData.resources.find((r: {name: string, file: string}) => 
              r.name.replace(/\s+/g, '-').toLowerCase() === resourceName
            );
            if (resource?.file) {
              setResourceFile(resource.file);
            } else {
              console.warn(`Resource not found: ${resourceName} in ${typeProvider}.${typeCategory}`, {
                availableResources: categoryData.resources.map((r: any) => ({
                  name: r.name,
                  normalized: r.name.replace(/\s+/g, '-').toLowerCase()
                }))
              });
            }
          } else {
            console.warn(`Category not found: ${typeCategory} in ${typeProvider}`, {
              availableCategories: Object.keys(data.categories || {})
            });
          }
        })
        .catch((err) => {
          console.warn(`Failed to load resource catalog for ${typeProvider}:`, err.message);
        });
    }
  }, [type, imagePath, provider, category, file]);

  const iconPath = useMemo(() => {
    const parts = type.split('.');
    
    // If imagePath is explicitly provided, use only that
    if (imagePath) {
      return imagePath;
    }
    
    // If direct provider info is provided, use it
    if (provider && category && resourceFile) {
      return `/resources/${provider}/${category}/${resourceFile}`;
    }
    
    // Only use resource catalog lookup - no fallbacks
    if (resourceFile && parts.length >= 3) {
      const typeProvider = parts[0];
      const typeCategory = parts[1];
      return `/resources/${typeProvider}/${typeCategory}/${resourceFile}`;
    }
    
    return null;
  }, [type, resourceFile, imagePath, provider, category]);

  if (iconPath) {
    return (
      <img
        src={iconPath}
        alt={type}
        onError={() => {
          console.warn(`Icon failed to load for type: ${type}, path: ${iconPath}`);
        }}
        width={props.width || '40'}
        height={props.height || '40'}
        style={{ width: props.width || '40px', height: props.height || '40px', objectFit: 'contain' }}
      />
    );
  }


  switch (type) {
    case "user":
      return <User {...props} />;
    case "generic.server":
      return <Server {...props} />;
    default:
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        </svg>
      );
  }
}
