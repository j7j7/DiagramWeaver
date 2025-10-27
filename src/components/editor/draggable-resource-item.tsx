"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { Card, CardContent } from '../ui/card';
import { DraggableItem, ItemTypes } from './draggable-item';

interface DraggableResourceItemProps {
  resource: {
    name: string;
    file: string;
    hasWhiteVariant?: boolean;
    format?: string;
  };
  provider: string;
  category: string;
  icon: React.ReactNode;
}

export function DraggableResourceItem({ resource, provider, category, icon }: DraggableResourceItemProps) {
  const [imageError, setImageError] = useState(false);

  // Icon path for display in sidebar - NEVER passed to node
  const iconPath = useMemo(() => {
    return `/resources/${provider}/${category}/${resource.file}`;
  }, [provider, category, resource.file]);
  
  const item = useMemo(() => {
    const derivedSlug = resource.name.replace(/\s+/g, '-').toLowerCase();

    // Pass file for initial rendering only (NOT stored in node)
    if (provider === 'generic' && category === 'grouping') {
      return {
        type: resource.name.toLowerCase(), // 'zone' or 'group'
        label: resource.name,
        provider,
        category,
        file: resource.file, // For ResourceIcon lookup during drag
      };
    }
    
    return {
      type: `${provider}.${category}.${derivedSlug}`,
      label: resource.name,
      provider,
      category,
      file: resource.file, // For ResourceIcon lookup during drag
    };
  }, [resource.name, provider, category, resource.file]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DIAGRAM_NODE,
    item: item,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [item]);

  // Handle image loading errors - show fallback icon
  const handleImageError = () => {
    setImageError(true);
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
            {!imageError ? (
              <img
                src={iconPath}
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