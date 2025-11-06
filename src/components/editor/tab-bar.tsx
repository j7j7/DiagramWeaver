"use client";
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TabData {
  id: string;
  name: string;
  isModified: boolean;
}

interface TabBarProps {
  tabs: TabData[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose }: TabBarProps) {
  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };

  return (
    <div className="flex items-center gap-1 border-b bg-card px-2 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer transition-colors relative group",
            "border border-b-0 border-t-0 border-l-0 border-r",
            activeTabId === tab.id
              ? "bg-background text-foreground border-border"
              : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
          )}
        >
          <span className={cn("text-sm whitespace-nowrap", tab.isModified && "font-semibold")}>
            {tab.name}
            {tab.isModified && <span className="ml-1 text-xs">●</span>}
          </span>
          <button
            onClick={(e) => handleClose(e, tab.id)}
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted",
              "flex items-center justify-center"
            )}
            aria-label={`Close ${tab.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

