"use client";

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Activity, DollarSign, Gauge } from 'lucide-react';

export type SimulationFeature = 'availability' | 'cost' | 'throughput';

interface SimulationPopupMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onSelect: (feature: SimulationFeature) => void;
}

export function SimulationPopupMenu({ x, y, visible, onClose, onSelect }: SimulationPopupMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const items: { feature: SimulationFeature; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { feature: 'availability', label: 'Availability', Icon: Activity },
    { feature: 'cost', label: 'Cost', Icon: DollarSign },
    { feature: 'throughput', label: 'Throughput', Icon: Gauge },
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        'context-menu fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[150px]',
        'animate-in fade-in-0 zoom-in-95',
      )}
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide select-none">
        Simulation
      </div>
      <div className="h-px bg-border mx-1 mb-1" />
      {items.map(({ feature, label, Icon }) => (
        <button
          key={feature}
          className="w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground flex items-center gap-2 [&_svg]:text-primary [&_svg]:shrink-0"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(feature);
            onClose();
          }}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
