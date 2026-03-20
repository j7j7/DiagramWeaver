"use client";

import React, { useState, useRef, useEffect } from "react";
import type { DiagramNodeData } from "@/lib/types";
import { getShapeStyles } from "./shape-utils";
import { getTextColorForBackground } from "./shape-utils";
import { ShapeTag } from "./shape-tag";
import { UML_NAME_HEIGHT, UML_LINE_HEIGHT } from "@/lib/uml-utils";

type CompartmentKey = "name" | "attributes" | "methods";

interface UmlClassShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  overrideWidth?: number;
  overrideHeight?: number;
  label: string;
  tag?: string;
  tagPosition?: string;
  isEditingTag?: boolean;
  editTagText?: string;
  onTagTextChange?: (text: string) => void;
  onTagSubmit?: () => void;
  onTagKeyDown?: (e: React.KeyboardEvent) => void;
  onTagDoubleClick?: (e: React.MouseEvent) => void;
  onUmlClassUpdate?: (umlClass: { name?: string; attributes?: string[]; methods?: string[] }) => void;
  isReadOnly?: boolean;
  slideColorTransition?: string;
}

function getCompartmentStyle(
  compartment: { fontFamily?: string; fontSize?: number; textJustify?: string; textColor?: string } | undefined,
  fallbackColor: string
): React.CSSProperties {
  const color = compartment?.textColor ?? fallbackColor;
  const justify = compartment?.textJustify ?? "center";
  return {
    fontFamily: compartment?.fontFamily || "Inter, system-ui, sans-serif",
    fontSize: compartment?.fontSize ?? 12,
    color,
    textAlign: (justify === "full" ? "justify" : justify) as React.CSSProperties["textAlign"],
  };
}

export function UmlClassShape({
  node,
  overrideWidth,
  overrideHeight,
  label,
  tag,
  tagPosition,
  isEditingTag = false,
  editTagText = "",
  onTagTextChange = () => {},
  onTagSubmit = () => {},
  onTagKeyDown = () => {},
  onTagDoubleClick = () => {},
  onUmlClassUpdate,
  isReadOnly = false,
  slideColorTransition,
}: UmlClassShapeProps) {
  const nodeAny = node as any;
  const uml = nodeAny.umlClass;
  const umlStyle = nodeAny.umlClassStyle;
  const width = overrideWidth ?? node.width ?? 140;
  const height = overrideHeight ?? node.height ?? 120;
  const styles = getShapeStyles(node);

  const name = uml?.name ?? label.split("\n")[0] ?? "";
  const attributes = uml?.attributes ?? [];
  const methods = uml?.methods ?? [];

  const [editingCompartment, setEditingCompartment] = useState<CompartmentKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const bgColor = typeof nodeAny.backgroundColor === "string" ? nodeAny.backgroundColor : "#eff6ff";
  const fallbackColor = getTextColorForBackground(bgColor, nodeAny.textColor);
  const dividerColor = styles.borderColor ?? "#000000";
  const dividerWidth = umlStyle?.dividerLineWidth ?? 1;
  const roundedEdges = nodeAny.roundedEdges || false;
  const borderRadius = roundedEdges
    ? `${Math.min(width, height) * 0.06}px`
    : "6px";

  const nameStyle = getCompartmentStyle(umlStyle?.name, fallbackColor);
  const attrStyle = getCompartmentStyle(umlStyle?.attributes, fallbackColor);
  const methodStyle = getCompartmentStyle(umlStyle?.methods, fallbackColor);

  const canEdit = !isReadOnly && !!onUmlClassUpdate;

  useEffect(() => {
    if (editingCompartment && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCompartment]);

  const handleDoubleClick = (comp: CompartmentKey, initialValue: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setEditingCompartment(comp);
    setEditValue(initialValue);
  };

  const handleCompartmentSubmit = () => {
    if (!onUmlClassUpdate || !editingCompartment) return;
    const trimmed = editValue.trim();
    if (editingCompartment === "name") {
      onUmlClassUpdate({ name: trimmed || "name" });
    } else if (editingCompartment === "attributes") {
      const lines = trimmed ? trimmed.split("\n").map((s) => s.trim()).filter(Boolean) : ["attributes"];
      onUmlClassUpdate({ attributes: lines });
    } else if (editingCompartment === "methods") {
      const lines = trimmed ? trimmed.split("\n").map((s) => s.trim()).filter(Boolean) : ["methods"];
      onUmlClassUpdate({ methods: lines });
    }
    setEditingCompartment(null);
  };

  const handleCompartmentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (editingCompartment === "name") {
        e.preventDefault();
        handleCompartmentSubmit();
      } else if (editingCompartment === "attributes" || editingCompartment === "methods") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleCompartmentSubmit();
        }
      }
    } else if (e.key === "Escape") {
      setEditingCompartment(null);
    }
  };

  const displayName = name || "name";
  const displayAttributes = attributes.length > 0 ? attributes : ["attributes"];
  const displayMethods = methods.length > 0 ? methods : ["methods"];
  const isPlaceholderName = !name;
  const isPlaceholderAttrs = attributes.length === 0;
  const isPlaceholderMethods = methods.length === 0;

  const Divider = () => (
    <div style={{ height: Math.max(0.5, dividerWidth), background: dividerColor, width: "100%" }} />
  );

  return (
    <div className="relative" style={{ width, height }}>
      <div
        className="relative overflow-hidden flex flex-col w-full h-full"
        style={{
          boxSizing: "border-box",
          borderWidth: styles.borderWidth,
          borderStyle: styles.borderStyle ?? "solid",
          borderColor: styles.borderImage ? "transparent" : dividerColor,
          borderImage: styles.borderImage,
          background: styles.background ?? nodeAny.backgroundColor ?? "#ffffff",
          borderRadius,
          ...(styles.shadow ? { boxShadow: "var(--shape-shadow-sm)" } : {}),
          ...(slideColorTransition !== undefined ? { transition: slideColorTransition } : {}),
        }}
      >
        {/* Name section - fixed single-line height */}
        <div
          className={`flex items-center justify-center px-2 shrink-0 ${canEdit ? "cursor-text" : ""}`}
          style={{ height: UML_NAME_HEIGHT, minHeight: UML_NAME_HEIGHT }}
          onDoubleClick={handleDoubleClick("name", displayName)}
        >
          {editingCompartment === "name" ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCompartmentSubmit}
              onKeyDown={handleCompartmentKeyDown}
              className="w-full text-xs font-semibold bg-transparent border border-primary/50 rounded px-1 py-0.5 outline-none"
              style={{ ...nameStyle, fontSize: nameStyle.fontSize ?? 14 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={`font-semibold truncate w-full whitespace-nowrap ${isPlaceholderName ? "text-muted-foreground" : ""}`}
              style={{ ...nameStyle, fontSize: nameStyle.fontSize ?? 14 }}
            >
              {displayName}
            </span>
          )}
        </div>

        <Divider />

        {/* Attributes section - height proportional to attribute count */}
        <div
          className={`flex flex-col justify-start px-2 py-0.5 overflow-hidden shrink-0 ${canEdit ? "cursor-text" : ""}`}
          style={{ height: displayAttributes.length * UML_LINE_HEIGHT, minHeight: displayAttributes.length * UML_LINE_HEIGHT }}
          onDoubleClick={handleDoubleClick("attributes", displayAttributes.join("\n"))}
        >
          {editingCompartment === "attributes" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCompartmentSubmit}
              onKeyDown={handleCompartmentKeyDown}
              rows={3}
              className="w-full text-xs bg-transparent border border-primary/50 rounded px-1 py-0.5 resize-none outline-none"
              style={attrStyle}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            displayAttributes.map((attr: string, i: number) => (
              <span
                key={i}
                className={`truncate ${isPlaceholderAttrs ? "text-muted-foreground" : ""}`}
                style={{ ...attrStyle, lineHeight: `${UML_LINE_HEIGHT}px`, height: UML_LINE_HEIGHT }}
              >
                {attr}
              </span>
            ))
          )}
        </div>

        <Divider />

        {/* Methods section - height proportional to method count */}
        <div
          className={`flex flex-col justify-start px-2 py-0.5 overflow-hidden shrink-0 ${canEdit ? "cursor-text" : ""}`}
          style={{ height: displayMethods.length * UML_LINE_HEIGHT, minHeight: displayMethods.length * UML_LINE_HEIGHT }}
          onDoubleClick={handleDoubleClick("methods", displayMethods.join("\n"))}
        >
          {editingCompartment === "methods" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCompartmentSubmit}
              onKeyDown={handleCompartmentKeyDown}
              rows={3}
              className="w-full text-xs bg-transparent border border-primary/50 rounded px-1 py-0.5 resize-none outline-none"
              style={methodStyle}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            displayMethods.map((method: string, i: number) => (
              <span
                key={i}
                className={`truncate ${isPlaceholderMethods ? "text-muted-foreground" : ""}`}
                style={{ ...methodStyle, lineHeight: `${UML_LINE_HEIGHT}px`, height: UML_LINE_HEIGHT }}
              >
                {method}
              </span>
            ))
          )}
        </div>
      </div>
      <ShapeTag
        tag={tag ?? ""}
        tagPosition={tagPosition ?? "top-left"}
        isEditingTag={isEditingTag}
        editTagText={editTagText}
        onTagTextChange={onTagTextChange}
        onTagSubmit={onTagSubmit}
        onTagKeyDown={onTagKeyDown}
        onTagDoubleClick={onTagDoubleClick}
      />
    </div>
  );
}
