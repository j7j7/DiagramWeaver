"use client";

import React, { useRef } from "react";
import { getTagPositionClasses } from "./shape-utils";

interface ShapeTagProps {
  tag: string;
  tagPosition?: string;
  isEditingTag: boolean;
  editTagText: string;
  onTagTextChange: (text: string) => void;
  onTagSubmit: () => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
}

export function ShapeTag({
  tag,
  tagPosition,
  isEditingTag,
  editTagText,
  onTagTextChange,
  onTagSubmit,
  onTagKeyDown,
  onTagDoubleClick,
}: ShapeTagProps) {
  const tagInputRef = useRef<HTMLInputElement>(null);

  if (!tag || !tag.trim()) {
    return null;
  }

  return (
    <div
      className={`absolute px-2 py-1 rounded-full text-xs font-medium border bg-slate-100 border-slate-300 z-10 ${getTagPositionClasses(tagPosition)}`}
      style={{
        color: '#374151',
        whiteSpace: 'nowrap',
        minWidth: 'fit-content',
        boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)'
      }}
    >
      {isEditingTag ? (
        <input
          ref={tagInputRef}
          type="text"
          value={editTagText}
          onChange={(e) => onTagTextChange(e.target.value)}
          onBlur={onTagSubmit}
          onKeyDown={onTagKeyDown}
          className="text-xs font-medium bg-transparent border border-primary rounded px-1 py-0.5 w-full outline-none"
          onClick={(e) => e.stopPropagation()}
          style={{ minWidth: '60px' }}
        />
      ) : (
        <span
          onDoubleClick={onTagDoubleClick}
          className="cursor-text"
        >
          {tag}
        </span>
      )}
    </div>
  );
}
