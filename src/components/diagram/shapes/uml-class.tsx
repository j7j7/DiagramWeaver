"use client";

import React, { Fragment, useState, useRef, useEffect } from "react";
import type { DiagramNodeData } from "@/lib/types";
import { useSlideShapeShadowTransitionMode } from "@/components/diagram/slide-shape-shadow-transition-context";
import {
  getFrostedGlassDropShadowLayerStyle,
  getFrostedGlassTintLayerStyle,
  getFrostedGlassInlineBackdropPrimaryStyle,
  getFrostedGlassInlineBackdropSecondPassStyle,
  getFrostedInlineBackdropReactKey,
  getFrostedGrainOverlayStyle,
  getFrostedFineGrainOverlayStyle,
  getFrostedPerlinNoiseOverlayStyle,
  getFrostedGlassTopEdgeHighlightStyle,
  getFrostedGlassLeftEdgeHighlightStyle,
  getFrostedGlassExportBackdropPrimaryFallbackColor,
  getFrostedGlassExportBackdropSecondFallbackColor,
  getFrostedGlassExportRasterStackBlurPx,
  getFrostedGlassExportRasterBackdropSaturate,
  getShapeStyles,
  getTextColorForBackground,
} from "./shape-utils";
import { ShapeTag } from "./shape-tag";
import { resolveGlobalVariables } from "@/lib/global-properties";
import { useGlobalProperties, useGlobalVariableContext } from "../global-properties-context";
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

function shouldUseGradientBorderLayer(
  borderImage: string | undefined,
  borderColors: string[] | undefined
): boolean {
  return !!(borderImage && borderColors);
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
  const slideShapeShadowMode = useSlideShapeShadowTransitionMode();
  const globalProperties = useGlobalProperties();
  const variableContext = useGlobalVariableContext();

  const rawName = uml?.name ?? label.split("\n")[0] ?? "";
  const rawAttributes = uml?.attributes ?? [];
  const rawMethods = uml?.methods ?? [];

  const name = resolveGlobalVariables(rawName, globalProperties, variableContext);
  const attributes = rawAttributes.map((line: string) =>
    resolveGlobalVariables(line, globalProperties, variableContext),
  );
  const methods = rawMethods.map((line: string) =>
    resolveGlobalVariables(line, globalProperties, variableContext),
  );

  const [editingCompartment, setEditingCompartment] = useState<CompartmentKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const bgColor = typeof nodeAny.backgroundColor === "string" ? nodeAny.backgroundColor : "#eff6ff";
  const fallbackColor = getTextColorForBackground(bgColor, nodeAny.textColor);
  const dividerColor = nodeAny.borderColor || styles.borderColors?.[0] || "#000000";
  const dividerWidth = umlStyle?.dividerLineWidth ?? 1;
  const roundedEdges = nodeAny.roundedEdges || false;
  const borderRadius = roundedEdges
    ? `${Math.min(width, height) * 0.06}px`
    : "6px";
  const borderImage = styles.borderImage;
  const borderColors = styles.borderColors;
  const borderGradientBackground = borderImage ? String(borderImage).replace(/\s+1$/, "") : undefined;
  const needsGradientBorderLayer = shouldUseGradientBorderLayer(borderImage, borderColors);
  const isFrostedBg = nodeAny.backgroundStyle === "frosted";

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
  const frostedInlineSecondPassStyle =
    isFrostedBg && styles.frostedGlass
      ? getFrostedGlassInlineBackdropSecondPassStyle(styles.frostedGlass)
      : undefined;

  const Divider = () => (
    <div
      className="relative z-[1] shrink-0"
      style={{ height: Math.max(0.5, dividerWidth), background: dividerColor, width: "100%" }}
    />
  );

  return (
    <div className="relative" style={{ width, height }}>
      {needsGradientBorderLayer ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: borderGradientBackground,
            backgroundColor: borderColors?.[0],
            borderRadius,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div
        className="relative flex flex-col w-full h-full"
        style={{
          boxSizing: "border-box",
          /* Inline frosted: visible overflow helps Chromium sample content behind `backdrop-filter`. */
          overflow: isFrostedBg ? "visible" : "hidden",
          borderWidth: !needsGradientBorderLayer ? styles.borderWidth : undefined,
          borderStyle: !needsGradientBorderLayer ? styles.borderStyle ?? "solid" : undefined,
          borderColor: !needsGradientBorderLayer ? (borderImage ? "transparent" : dividerColor) : undefined,
          borderImage: !needsGradientBorderLayer ? borderImage : undefined,
          background: isFrostedBg ? "transparent" : styles.background ?? nodeAny.backgroundColor ?? "#ffffff",
          backgroundColor: isFrostedBg ? "transparent" : styles.backgroundColor,
          borderRadius: !needsGradientBorderLayer ? borderRadius : undefined,
          width: needsGradientBorderLayer ? `calc(100% - ${styles.borderWidth})` : "100%",
          height: needsGradientBorderLayer ? `calc(100% - ${styles.borderWidth})` : "100%",
          margin: needsGradientBorderLayer ? `calc(${styles.borderWidth} / 2)` : 0,
          ...(styles.shadow && slideShapeShadowMode !== "crossfade" ? { boxShadow: "var(--shape-shadow-sm)" } : {}),
          ...(slideColorTransition !== undefined ? { transition: slideColorTransition } : {}),
        }}
      >
        {isFrostedBg && styles.frostedGlass ? (
          <div
            data-frosted-glass-stack=""
            data-frosted-export-blur={String(getFrostedGlassExportRasterStackBlurPx(styles.frostedGlass))}
            data-frosted-export-saturate={String(
              getFrostedGlassExportRasterBackdropSaturate(styles.frostedGlass)
            )}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <div style={getFrostedGlassDropShadowLayerStyle(styles.frostedGlass)} aria-hidden />
            <Fragment key={getFrostedInlineBackdropReactKey(styles.frostedGlass)}>
              <div
                data-frosted-backdrop=""
                data-frosted-export-fallback-bg={getFrostedGlassExportBackdropPrimaryFallbackColor(
                  styles.frostedGlass
                )}
                style={getFrostedGlassInlineBackdropPrimaryStyle(styles.frostedGlass)}
                aria-hidden
              />
              {frostedInlineSecondPassStyle ? (
                <div
                  data-frosted-backdrop="second"
                  data-frosted-export-fallback-bg={getFrostedGlassExportBackdropSecondFallbackColor(
                    styles.frostedGlass
                  )}
                  style={frostedInlineSecondPassStyle}
                  aria-hidden
                />
              ) : null}
            </Fragment>
            <div style={getFrostedGlassTintLayerStyle(styles.frostedGlass)} aria-hidden />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 2,
              }}
              aria-hidden
            >
              <div style={getFrostedPerlinNoiseOverlayStyle(styles.frostedGlass.frostedPerlinNoise)} aria-hidden />
              <div style={getFrostedGrainOverlayStyle(styles.frostedGlass.grainOpacity)} aria-hidden />
              <div style={getFrostedFineGrainOverlayStyle(styles.frostedGlass.grainOpacity)} aria-hidden />
            </div>
            <div style={getFrostedGlassTopEdgeHighlightStyle()} aria-hidden />
            <div style={getFrostedGlassLeftEdgeHighlightStyle()} aria-hidden />
          </div>
        ) : null}
        {/* Name section - fixed single-line height */}
        <div
          className={`relative z-[1] flex items-center justify-center px-2 shrink-0 ${canEdit ? "cursor-text" : ""}`}
          style={{ height: UML_NAME_HEIGHT, minHeight: UML_NAME_HEIGHT }}
          onDoubleClick={handleDoubleClick("name", rawName || "name")}
        >
          {editingCompartment === "name" ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              spellCheck
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
          className={`relative z-[1] flex flex-col justify-start px-2 py-0.5 overflow-hidden shrink-0 ${canEdit ? "cursor-text" : ""}`}
          style={{ height: displayAttributes.length * UML_LINE_HEIGHT, minHeight: displayAttributes.length * UML_LINE_HEIGHT }}
          onDoubleClick={handleDoubleClick("attributes", (rawAttributes.length > 0 ? rawAttributes : ["attributes"]).join("\n"))}
        >
          {editingCompartment === "attributes" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              spellCheck
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
          className={`relative z-[1] flex flex-col justify-start px-2 py-0.5 overflow-hidden shrink-0 ${canEdit ? "cursor-text" : ""}`}
          style={{ height: displayMethods.length * UML_LINE_HEIGHT, minHeight: displayMethods.length * UML_LINE_HEIGHT }}
          onDoubleClick={handleDoubleClick("methods", (rawMethods.length > 0 ? rawMethods : ["methods"]).join("\n"))}
        >
          {editingCompartment === "methods" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              spellCheck
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
