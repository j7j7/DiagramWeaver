"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Server, User } from "lucide-react";
import { buildResourceIconPath } from "@/lib/resource-mapping";
import { getLucideIcon } from "@/lib/icon-resources";

interface ResourceIconProps extends React.SVGProps<SVGSVGElement> {
  type: string; // Format: provider.category.resourcename (e.g., aws.compute.ec2)
  imagePath?: string; // If provided, use this exact icon path (legacy support)
  provider?: string; // Direct provider info for icon lookup
  category?: string; // Direct category info for icon lookup  
  file?: string; // Direct file info for icon lookup
  iconType?: "lucide" | "emoji"; // For standard icons from Icons section
  iconName?: string; // Lucide icon name (e.g. "Home", "Shield")
  emoji?: string; // Emoji character for emoji icons
  iconColor?: string; // Color for Lucide icons
}

export function ResourceIcon({ type, imagePath, provider, category, file, iconType, iconName, emoji, iconColor, ...props }: ResourceIconProps) {
  const [resourceFile, setResourceFile] = useState<string | null>(null);

  // Render standard icons (Lucide symbols or emojis) - same square size as other items (70x70)
  if (iconType === "emoji" && emoji) {
    const size = typeof props.width === "number" ? props.width : parseInt(String(props.width || 70), 10) || 70;
    return (
      <span
        role="img"
        aria-label={type}
        style={{
          fontSize: `${size}px`,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        {emoji}
      </span>
    );
  }
  if (iconType === "lucide") {
    const nameToUse = iconName || type.split(".").pop()?.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") || "";
    const LucideIcon = getLucideIcon(nameToUse);
    if (LucideIcon) {
      return <LucideIcon {...props} color={iconColor || undefined} />;
    }
  }
  if (type.startsWith("generic.icon.") || type.startsWith("generic.emoji.")) {
    // Fallback when node has type but no iconType/iconName/emoji passed (e.g. from JSON)
    if (type.startsWith("generic.emoji.")) {
      const slug = type.replace("generic.emoji.", "");
      const emojiMap: Record<string, string> = {
        house: "🏠", shield: "🛡️", person: "👤", office: "🏢", heart: "❤️", star: "⭐",
        lock: "🔒", key: "🔑", email: "📧", phone: "📱", globe: "🌐", gear: "⚙️",
        people: "👥", warning: "⚠️", check: "✅", info: "ℹ️", x: "❌", lightning: "⚡",
        cloud: "☁️", database: "🗄️", computer: "💻", rocket: "🚀", bell: "🔔",
        bookmark: "🔖", camera: "📷", document: "📄", folder: "📁", gift: "🎁", location: "📍",
      };
      const emojiChar = emojiMap[slug] || "📌";
      const size = typeof props.width === "number" ? props.width : parseInt(String(props.width || 70), 10) || 70;
      return (
        <span role="img" aria-label={type} style={{ fontSize: `${size}px`, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", width: `${size}px`, height: `${size}px` }}>
          {emojiChar}
        </span>
      );
    }
    const iconPart = type.replace("generic.icon.", "");
    const pascalName = iconPart.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
    const LucideIcon = getLucideIcon(pascalName);
    if (LucideIcon) {
      return <LucideIcon {...props} color={iconColor || undefined} />;
    }
  }

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
      return buildResourceIconPath(provider, category, resourceFile);
    }
    
    // Only use resource catalog lookup - no fallbacks
    if (resourceFile && parts.length >= 3) {
      const typeProvider = parts[0];
      const typeCategory = parts[1];
      return buildResourceIconPath(typeProvider, typeCategory, resourceFile);
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


  // Handle shape types (exclude icon/emoji - those use Lucide/emoji above)
  if (!type.startsWith('generic.icon.') && !type.startsWith('generic.emoji.') &&
      (type.startsWith('generic.object.') || type?.endsWith('.square') || type?.endsWith('.circle') ||
      type?.endsWith('.point') || type?.endsWith('.rectangle') || type?.endsWith('.rounded-rectangle') || type?.endsWith('.triangle') ||
      type?.endsWith('.star') || type?.endsWith('.cloud') || type?.endsWith('.parallelogram') ||
      type?.endsWith('.trapezoid') || type?.endsWith('.kite') || type?.endsWith('.hexagon') ||
      type?.endsWith('.pentagon') || type?.endsWith('.octagon') || type?.endsWith('.jigsaw') ||
      type?.endsWith('.arrowhead') || type?.endsWith('.chevron') || type?.endsWith('.line'))) {
    
    // Render different shapes based on type
    const shapeType = type.split('.').pop() || 'square';
    
    switch (shapeType) {
      case 'line':
        return (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke={props.stroke || "currentColor"} strokeWidth={props.strokeWidth || 2} strokeLinecap="round">
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        );
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
      case 'rounded-rectangle':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "none"} strokeWidth={props.strokeWidth || 2}>
            <rect x="4" y="6" width="16" height="12" rx="2" ry="2" />
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
