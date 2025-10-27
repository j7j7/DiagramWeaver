"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Server, User } from "lucide-react";

interface ResourceIconProps extends React.SVGProps<SVGSVGElement> {
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  imagePath?: string; // If provided, use this exact icon path (legacy support)
}

export function ResourceIcon({ type, imagePath, ...props }: ResourceIconProps) {
  const [resourceFile, setResourceFile] = useState<string | null>(null);

  // Look up file from resource catalog based on type
  useEffect(() => {
    const parts = type.split('.');
    if (parts.length >= 3) {
      const provider = parts[0];
      const category = parts[1];
      const resourceName = parts.slice(2).join('-').toLowerCase();
      
      // Reset resource file when type changes
      setResourceFile(null);
      
      // Fetch the resource catalog to get the correct filename
      fetch(`/resources/resource-${provider}.json`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          const categoryData = data.categories?.[category];
          if (categoryData?.resources) {
            // Find the resource that matches the resourceName (derived from type)
            // Look for resources where name.toLowerCase().replace(/\s+/g, '-') matches resourceName
            const resource = categoryData.resources.find((r: {name: string, file: string}) => 
              r.name.replace(/\s+/g, '-').toLowerCase() === resourceName
            );
            if (resource?.file) {
              setResourceFile(resource.file);
            } else {
              console.warn(`Resource not found: ${resourceName} in ${provider}.${category}`, {
                availableResources: categoryData.resources.map((r: any) => ({
                  name: r.name,
                  normalized: r.name.replace(/\s+/g, '-').toLowerCase()
                }))
              });
            }
          } else {
            console.warn(`Category not found: ${category} in ${provider}`, {
              availableCategories: Object.keys(data.categories || {})
            });
          }
        })
        .catch((err) => {
          console.warn(`Failed to load resource catalog for ${provider}:`, err.message);
        });
    }
  }, [type, imagePath]);

  const iconPath = useMemo(() => {
    const parts = type.split('.');
    
    // If imagePath is explicitly provided, use only that
    if (imagePath) {
      return imagePath;
    }
    
    // Only use resource catalog lookup - no fallbacks
    if (resourceFile && parts.length >= 3) {
      const provider = parts[0];
      const category = parts[1];
      return `/resources/${provider}/${category}/${resourceFile}`;
    }
    
    return null;
  }, [type, resourceFile, imagePath]);

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
