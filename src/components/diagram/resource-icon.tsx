"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Server, User } from "lucide-react";
import { buildResourceIconPath } from "@/lib/resource-mapping";
import { getLucideIcon, getLucideIconFromTypeSlug } from "@/lib/icon-resources";
import { CustomIconImage } from "@/components/diagram/custom-icon-image";
import type { CustomImageOptions } from "@/lib/types";

/** Palette JSON lists Text Box Heading under `generic.text` but runtime type is `generic.object.text-box-heading`. */
function isTextBoxHeadingRuntimeType(type: string | undefined): boolean {
  if (!type || typeof type !== "string") return false;
  const t = type.trim().toLowerCase().replace(/\u2011/g, "-");
  return t === "generic.object.text-box-heading" || t.endsWith(".text-box-heading");
}

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
  imageUrl?: string; // External URL for generic.icon.custom
  imageOptions?: Partial<CustomImageOptions>;
}

export function ResourceIcon({ type, imagePath, provider, category, file, iconType, iconName, emoji, iconColor, imageUrl, imageOptions, ...props }: ResourceIconProps) {
  const [resourceFile, setResourceFile] = useState<string | null>(null);

  // Catalog lookup must run on every render path — hooks stay before any conditional return.
  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    if (type === "generic.icon.custom") {
      return () => ac.abort();
    }
    if (iconType === "emoji" && emoji) {
      return () => ac.abort();
    }
    if (iconType === "lucide") {
      const nameToUse = iconName || type.split(".").pop()?.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("") || "";
      if (getLucideIcon(nameToUse)) {
        return () => ac.abort();
      }
    }
    if (type.startsWith("generic.emoji.")) {
      return () => ac.abort();
    }
    if (type.startsWith("generic.icon.")) {
      const iconPart = type.replace("generic.icon.", "");
      const LucideIcon = getLucideIconFromTypeSlug(iconPart) ?? getLucideIcon(iconPart.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(""));
      if (LucideIcon) {
        return () => ac.abort();
      }
    }

    // Lucide icons and emojis don't use the resource catalog - skip lookup
    if (type.startsWith("generic.icon.") || type.startsWith("generic.emoji.")) {
      return () => ac.abort();
    }

    // Vector-only in UI; catalog entry lives under generic.text, not generic.object
    if (isTextBoxHeadingRuntimeType(type)) {
      setResourceFile(null);
      return () => ac.abort();
    }

    // If direct provider info is provided, use it immediately
    if (provider && category && file) {
      setResourceFile(file);
      return () => ac.abort();
    }

    const parts = type.split(".");
    if (parts.length >= 3) {
      const typeProvider = parts[0];
      const typeCategory = parts[1];
      const resourceName = parts.slice(2).join("-").toLowerCase();

      setResourceFile(null);

      fetch(`/resources/resource-${typeProvider}.json`, { signal })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (signal.aborted) return;

          const findInResources = (resources: { name: string; file: string }[] | undefined) =>
            resources?.find((r) => r.name.replace(/\s+/g, "-").toLowerCase() === resourceName);

          let categoryData = data.categories?.[typeCategory];
          let resource = findInResources(categoryData?.resources);

          // text-box-heading is under generic.text in JSON but type string uses generic.object
          if (!resource?.file && typeProvider === "generic" && typeCategory === "object" && resourceName === "text-box-heading") {
            categoryData = data.categories?.text;
            resource = findInResources(categoryData?.resources);
          }

          if (categoryData?.resources) {
            if (resource?.file) {
              // Always use vector preview for this shape; PNG lives under generic/text, not generic/object
              if (resourceName === "text-box-heading") {
                setResourceFile(null);
              } else {
                setResourceFile(resource.file);
              }
            } else {
              console.warn(`Resource not found: ${resourceName} in ${typeProvider}.${typeCategory}`, {
                availableResources: categoryData.resources.map((r: { name: string }) => ({
                  name: r.name,
                  normalized: r.name.replace(/\s+/g, "-").toLowerCase(),
                })),
              });
            }
          } else {
            console.warn(`Category not found: ${typeCategory} in ${typeProvider}`, {
              availableCategories: Object.keys(data.categories || {}),
            });
          }
        })
        .catch((err: Error) => {
          if (signal.aborted || (err as Error).name === "AbortError") return;
          console.warn(`Failed to load resource catalog for ${typeProvider}:`, err.message);
        });
    }

    return () => ac.abort();
  }, [type, provider, category, file, iconType, iconName, emoji]);

  const iconPath = useMemo(() => {
    if (isTextBoxHeadingRuntimeType(type)) {
      return null;
    }

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

  if (type === "generic.icon.custom") {
    return (
      <CustomIconImage
        imageUrl={imageUrl}
        imageOptions={imageOptions}
        width={props.width}
        height={props.height}
        alt={type}
      />
    );
  }

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
    const LucideIcon = getLucideIconFromTypeSlug(iconPart) ?? getLucideIcon(iconPart.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(""));
    if (LucideIcon) {
      return <LucideIcon {...props} color={iconColor || undefined} />;
    }
  }

  // Vector preview only: matches the on-canvas shape (rounded body + dark heading strip), not the flat PNG.
  const isTextBoxHeadingType = isTextBoxHeadingRuntimeType(type);

  if (iconPath && !isTextBoxHeadingType) {
    return (
      <img
        src={iconPath}
        alt={type}
        loading="lazy"
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
      type?.endsWith('.point') || type?.endsWith('.rectangle') || type?.endsWith('.rounded-rectangle') || type?.endsWith('.text-box-heading') || type?.endsWith('.triangle') ||
      type?.endsWith('.star') || type?.endsWith('.cloud') || type?.endsWith('.parallelogram') ||
      type?.endsWith('.trapezoid') || type?.endsWith('.kite') || type?.endsWith('.hexagon') ||
      type?.endsWith('.pentagon') || type?.endsWith('.octagon') || type?.endsWith('.jigsaw') ||
      type?.endsWith('.arrowhead') || type?.endsWith('.chevron') || type?.endsWith('.uml-class') || type?.endsWith('.line'))) {
    
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
      case 'text-box-heading':
        return (
          <svg
            {...props}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            {/* Inset 3 — fills more of the 24×24 icon frame than the previous 4/5 inset */}
            <rect x="3" y="4" width="18" height="14" rx="2" ry="2" fill="currentColor" opacity={0.09} />
            <path
              d="M 3 6 A 2 2 0 0 1 5 4 L 19 4 A 2 2 0 0 1 21 6 L 21 9.25 L 3 9.25 Z"
              fill="#1f2937"
            />
            <rect
              x="3"
              y="4"
              width="18"
              height="14"
              rx="2"
              ry="2"
              stroke="currentColor"
              strokeWidth={props.strokeWidth ?? 1}
              opacity={0.4}
            />
          </svg>
        );
      case 'uml-class':
        return (
          <svg {...props} viewBox="0 0 24 24" fill={props.fill || "currentColor"} stroke={props.stroke || "currentColor"} strokeWidth={props.strokeWidth ?? 1}>
            <rect x="4" y="4" width="16" height="16" />
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="14" x2="20" y2="14" />
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
