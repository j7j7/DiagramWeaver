"use client";

import React from "react";
import { useDrag } from "react-dnd";
import { Card, CardContent } from "../ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { ItemTypes } from "./draggable-item";
import type { IconResourceItem } from "@/lib/icon-resources";

export interface IconDragItem {
  type: string;
  label: string;
  provider: string;
  category: string;
  iconType?: "lucide" | "emoji";
  iconName?: string;
  emoji?: string;
}

interface DraggableIconItemProps {
  iconItem: IconResourceItem;
  onClick?: (dragItem: IconDragItem) => void;
  onDoubleClick?: (dragItem: IconDragItem) => void;
  viewMode?: "normal" | "compact";
}

function slugify(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

export function DraggableIconItem({
  iconItem,
  onClick,
  onDoubleClick,
  viewMode = "normal",
}: DraggableIconItemProps) {
  const dragItem = React.useMemo(() => {
    if (iconItem.iconType === "lucide") {
      const slug = slugify(iconItem.iconName);
      return {
        type: `generic.icon.${slug}`,
        label: iconItem.name,
        provider: "generic",
        category: "icon",
        iconType: "lucide" as const,
        iconName: iconItem.iconName,
      };
    }
    const slug = slugify(iconItem.name);
    return {
      type: `generic.emoji.${slug}`,
      label: iconItem.name,
      provider: "generic",
      category: "emoji",
      iconType: "emoji" as const,
      emoji: iconItem.emoji,
    };
  }, [iconItem]);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: ItemTypes.DIAGRAM_NODE,
      item: dragItem,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }),
    [dragItem]
  );

  const content =
    iconItem.iconType === "lucide" ? (
      <iconItem.IconComponent className="w-6 h-6" />
    ) : (
      <span className="text-2xl leading-none">{iconItem.emoji}</span>
    );

  const isCompact = viewMode === "compact";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={(node) => { if (node) drag(node); }}
          style={{ opacity: isDragging ? 0.5 : 1 }}
          className="cursor-move"
          onClick={() => onClick?.(dragItem)}
          onDoubleClick={() => onDoubleClick?.(dragItem)}
        >
          {isCompact ? (
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors w-full">
              <CardContent className="p-1.5 flex flex-col items-center justify-center gap-0.5 text-center h-12">
                <div className="w-5 h-5 flex items-center justify-center">
                  {iconItem.iconType === "lucide" ? (
                    <iconItem.IconComponent className="w-5 h-5" />
                  ) : (
                    <span className="text-xl leading-none">{iconItem.emoji}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
              <CardContent className="p-2 flex flex-col items-center justify-center gap-1 text-center h-16">
                <div className="w-6 h-6 flex items-center justify-center">
                  {content}
                </div>
                <span className="font-medium text-xs leading-tight">
                  {iconItem.name}
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{iconItem.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}
