"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from '../ui/card';
import { DraggableItem, ItemTypes } from './draggable-item';

interface DraggableResourceItemProps {
  resource: {
    name: string;
    file: string;
    type: string;
    hasWhiteVariant?: boolean;
    format?: string;
  };
  provider: string;
  category: string;
  icon: React.ReactNode;
}

export function DraggableResourceItem({ resource, provider, category, icon }: DraggableResourceItemProps) {
  const [imageError, setImageError] = useState(false);
  const [srcPath, setSrcPath] = useState<string | null>(null);

  // Prefer derived path based on naming convention; fall back to provided file if needed
  useEffect(() => {
    const derivedSlug = resource.name.replace(/\s+/g, '-').toLowerCase();
    const ext = resource.format === 'svg' ? 'svg' : 'png';
    const derived = `/resources/${provider}/${category}/${derivedSlug}.${ext}`;
    const provided = `/resources/${provider}/${category}/${resource.file}`;
    // Try derived first; we'll switch to provided on error
    setImageError(false);
    setSrcPath(derived);
    // Preload to detect if derived exists quickly; if it 404s, swap to provided
    const img = new Image();
    img.onload = () => setSrcPath(derived);
    img.onerror = () => setSrcPath(provided);
    img.src = derived;
  }, [resource.name, resource.file, resource.format, provider, category]);
  
  const item = useMemo(() => {
    const derivedSlug = resource.name.replace(/\s+/g, '-').toLowerCase();
    const ext = resource.format === 'svg' ? 'svg' : 'png';
    const derivedPath = `/resources/${provider}/${category}/${derivedSlug}.${ext}`;
    const providedPath = `/resources/${provider}/${category}/${resource.file}`;
    const imagePath = srcPath || derivedPath; // best guess at time of memo

    // Special handling for zone and group items
    if (provider === 'generic' && category === 'grouping') {
      return {
        type: resource.name.toLowerCase(), // 'zone' or 'group'
        label: resource.name,
        provider,
        category,
        resource,
        imagePath
      };
    }
    
    return {
      type: `${provider}.${category}.${derivedSlug}`,
      label: resource.name,
      provider,
      category,
      resource,
      imagePath
    };
  }, [resource.name, resource.file, resource.format, provider, category, srcPath]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DIAGRAM_NODE,
    item: item,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [item]);

  // Handle image loading errors
  const handleImageError = () => {
    if (!srcPath) { setImageError(true); return; }
    // If we were using derived path, try explicit file path; else give up to icon
    const provided = `/resources/${provider}/${category}/${resource.file}`;
    if (srcPath !== provided) {
      setSrcPath(provided);
      setImageError(false);
    } else {
      setImageError(true);
    }
  };

  return (
    <div
      ref={drag as any}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="cursor-move"
    >
      <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
        <CardContent className="p-2 flex flex-col items-center justify-center gap-1 text-center h-16">
          <div className="w-6 h-6 flex items-center justify-center">
            {!imageError && srcPath ? (
              <img
                src={srcPath}
                alt={resource.name}
                className="w-6 h-6 object-contain"
                onError={handleImageError}
              />
            ) : (
              icon
            )}
          </div>
          <span className="font-medium text-xs leading-tight">
            {resource.name}
          </span>
          {resource.hasWhiteVariant && (
            <div className="text-xs text-muted-foreground">White</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}