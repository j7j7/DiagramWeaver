"use client";
import React, { useMemo, useState } from 'react';
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
  
  const item = useMemo(() => {
    // Special handling for zone and group items
    if (provider === 'generic' && category === 'grouping') {
      return {
        type: resource.name.toLowerCase(), // 'zone' or 'group'
        label: resource.name,
        provider,
        category,
        resource
      };
    }
    
    return {
      type: `${provider}.${category}.${resource.name.replace(/\s+/g, '-').toLowerCase()}`,
      label: resource.name,
      provider,
      category,
      resource
    };
  }, [resource.name, resource.file, provider, category]);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.DIAGRAM_NODE,
    item: item,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [item]);

  // Handle image loading errors
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
            {resource.format === 'svg' ? (
              // Handle SVG files
              <img
                src={`/resources/${provider}/${category}/${resource.file}`}
                alt={resource.name}
                className="w-6 h-6 object-contain"
                onError={handleImageError}
              />
            ) : !imageError ? (
              // Try to load the actual PNG file
              <img
                src={`/resources/${provider}/${category}/${resource.file}`}
                alt={resource.name}
                className="w-6 h-6 object-contain"
                onError={handleImageError}
              />
            ) : (
              // Fallback to icon if image fails to load
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