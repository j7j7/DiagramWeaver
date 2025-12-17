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
  }, [type, provider, category, file]);

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


  // Handle shape types
  if (type.startsWith('generic.object.') || type?.endsWith('.square') || type?.endsWith('.circle') || 
      type?.endsWith('.point') || type?.endsWith('.rectangle') || type?.endsWith('.triangle') ||
      type?.endsWith('.star') || type?.endsWith('.cloud') || type?.endsWith('.parallelogram') ||
      type?.endsWith('.trapezoid') || type?.endsWith('.kite') || type?.endsWith('.hexagon') ||
      type?.endsWith('.pentagon') || type?.endsWith('.octagon') || type?.endsWith('.jigsaw') ||
      type?.endsWith('.arrowhead') || type?.endsWith('.chevron')) {
    
    // Render different shapes based on type
    const shapeType = type.split('.').pop() || 'square';
    
    switch (shapeType) {
      case 'circle':
      case 'point':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      case 'triangle':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <polygon points="12,2 22,20 2,20" />
          </svg>
        );
      case 'star':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
          </svg>
        );
      case 'cloud':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
          </svg>
        );
      case 'rectangle':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <rect x="4" y="6" width="16" height="12" />
          </svg>
        );
      default: // square, parallelogram, trapezoid, kite, hexagon, pentagon, octagon, jigsaw, arrowhead, chevron
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <rect x="4" y="4" width="16" height="16" />
          </svg>
        );
    }
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
