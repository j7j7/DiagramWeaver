"use client";

import React, { useCallback, useId, useMemo, useRef } from "react";
import { useDrop } from "react-dnd";
import type { DiagramNodeData, RichTextRun } from "@/lib/types";
import type { CardElementData, CardIconRef } from "@/lib/card-types";
import type { ChartSlideStagger } from "@/lib/chart-presentation-stagger";
import {
  chartSegmentPopAnimationStyle,
  chartSegmentPopKeyframesCss,
} from "@/lib/chart-presentation-stagger";
import { cardElementStyleToCss, cardLayoutToCss } from "@/lib/card-layout";
import {
  cardIconGlyphSizeStyle,
  cardIconPlacementToAbsoluteStyle,
  cardIconSlotContainerStyle,
} from "@/lib/card-icon-layout";
import { iconDragItemToCardIconRef, isIconPaletteDragItem } from "@/lib/card-utils";
import { flattenCardElements } from "@/lib/card-presentation";
import {
  applyProfileHeroHeightPct,
  isProfileHeroSplitCard,
  parseProfileHeroHeightPct,
  PROFILE_HERO_ID,
} from "@/lib/card-profile";
import {
  resolveProfileSocialAvatarLayout,
  resolveProfileSocialDescriptionLayout,
  resolveProfileSocialSectionLayout,
  resolveProfileSocialTextStyle,
} from "@/lib/card-profile-social";
import {
  PROFILE_DIAGONAL_SPLIT_LINE_ID,
  PROFILE_DIAGONAL_AVATAR_ID,
  diagonalSplitAccentPathD,
  diagonalSplitBodyPathD,
  diagonalSplitGeometryFromHero,
  getProfileDiagonalSplitRegions,
  isProfileDiagonalSplitCard,
  profileDiagonalAvatarSlotStyle,
  profileDiagonalBodyLayerStyle,
  profileDiagonalContentLayerStyle,
  profileDiagonalHeroLayerStyle,
  profileDiagonalRootLayerStyle,
  profileDiagonalSectionPosition,
  resolveProfileDiagonalAvatarLayout,
  resolveProfileDiagonalTextStackLayout,
} from "@/lib/card-profile-diagonal-split";
import {
  resolveDetailPostBodyLine2Layout,
  resolveDetailPostBodySectionLayout,
  resolveDetailPostCtaStyle,
  resolveDetailPostFooterStyle,
  detailPostFooterUsesShellBorder,
} from "@/lib/card-detail-post";
import {
  dashboardStatActionSlotStyle,
  dashboardStatDecorClipStyle,
  dashboardStatDecorIconImageStyle,
  dashboardStatDecorIconWrapStyle,
  dashboardStatDecorSlotStyle,
  dashboardStatDecorUsesWhiteFilter,
  dashboardStatSectionClassName,
  dashboardStatSectionStyle,
  isDashboardStatCard,
  parseDashboardDecorIconOpacity,
  resolveDashboardStatDecorLayout,
} from "@/lib/card-dashboard-stat";
import { getPlainTextFromRuns, labelToRuns } from "@/lib/rich-text";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import { ResourceIcon } from "../resource-icon";
import { CardElementMeshBackground } from "./card-element-background";
import { ShapeWrapper } from "./shape-wrapper";
import { getShapeStyles } from "./shape-utils";
import { ItemTypes } from "@/components/editor/draggable-item";
import { cn } from "@/lib/utils";
import {
  getHighlightAnimStyleForNode,
  mergeCardShellHighlightStyle,
} from "@/lib/highlight-anim";

interface CardShapeProps {
  node: DiagramNodeData & { width?: number; height?: number };
  tag?: string;
  tagPosition?: string;
  isEditingTag: boolean;
  editTagText: string;
  onTagTextChange: (text: string) => void;
  onTagSubmit: () => void;
  onTagKeyDown: (e: React.KeyboardEvent) => void;
  onTagDoubleClick: (e: React.MouseEvent) => void;
  label: string;
  isEditingLabel: boolean;
  editRuns: RichTextRun[];
  onRichLabelSubmit: (plainText: string, runs: RichTextRun[]) => void;
  onVerticalAlignChange?: (position: "top" | "middle" | "bottom") => void;
  onLabelKeyDown: (e: React.KeyboardEvent) => void;
  onLabelDoubleClick: (e: React.MouseEvent) => void;
  slideColorTransition?: string;
  isReadOnly?: boolean;
  cardEditElementId?: string | null;
  isEditingCardElement?: boolean;
  cardEditRuns?: RichTextRun[];
  cardSelectedElementId?: string | null;
  onCardElementSelect?: (elementId: string, e: React.MouseEvent) => void;
  onCardElementDoubleClick?: (elementId: string, e: React.MouseEvent) => void;
  onCardElementRichSubmit?: (elementId: string, plainText: string, runs: RichTextRun[]) => void;
  onCardElementKeyDown?: (e: React.KeyboardEvent) => void;
  onCardIconDrop?: (elementId: string, iconRef: CardIconRef) => void;
  onCardIconContextMenu?: (elementId: string, e: React.MouseEvent) => void;
  presentationCardSlideStagger?: ChartSlideStagger;
  /** When false, element clicks bubble so the card node can be selected (resize/connect handles). */
  cardNodeSelected?: boolean;
  cardTemplateId?: string;
  heroBoundaryInteractionEnabled?: boolean;
  onCardElementsPatch?: (elements: CardElementData) => void;
  onHeroBoundaryDragSessionChange?: (active: boolean) => void;
  highlightAnimStaggerIndex?: number;
  highlightAnimStaggerCount?: number;
}

function elementUsesMesh(style?: CardElementData["style"]): boolean {
  return style?.backgroundStyle === "mesh_gradient";
}

function ProfileDiagonalSplitClipDefs({
  accentClipId,
  bodyClipId,
  geometry,
}: {
  accentClipId: string;
  bodyClipId: string;
  geometry: ReturnType<typeof diagonalSplitGeometryFromHero>;
}) {
  return (
    <svg width="0" height="0" aria-hidden className="pointer-events-none absolute">
      <defs>
        <clipPath id={accentClipId} clipPathUnits="objectBoundingBox">
          <path d={diagonalSplitAccentPathD(geometry)} />
        </clipPath>
        <clipPath id={bodyClipId} clipPathUnits="objectBoundingBox">
          <path d={diagonalSplitBodyPathD(geometry)} />
        </clipPath>
      </defs>
    </svg>
  );
}

function cardElementBackgroundLayers(
  element: CardElementData,
  styleCss: React.CSSProperties,
): { styleCss: React.CSSProperties; meshLayer: React.ReactNode | null } {
  if (!elementUsesMesh(element.style)) {
    return { styleCss, meshLayer: null };
  }
  return {
    styleCss: { ...styleCss, background: undefined, backgroundColor: undefined },
    meshLayer: (
      <CardElementMeshBackground
        style={element.style!}
        borderRadius={styleCss.borderRadius ?? element.style?.borderRadius}
      />
    ),
  };
}

function ProfileHeroSplitHandle({
  enabled,
  rootRef,
  cardRoot,
  onPatch,
  onDragSessionChange,
}: {
  enabled: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  cardRoot: CardElementData;
  onPatch?: (elements: CardElementData) => void;
  onDragSessionChange?: (active: boolean) => void;
}) {
  const dragActiveRef = React.useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !onPatch || !rootRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      dragActiveRef.current = true;
      onDragSessionChange?.(true);
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [enabled, onPatch, onDragSessionChange, rootRef],
  );

  const applyClientY = useCallback(
    (clientY: number) => {
      const rootEl = rootRef.current;
      if (!rootEl || !onPatch) return;
      const rect = rootEl.getBoundingClientRect();
      if (rect.height <= 0) return;
      const y = clientY - rect.top;
      const pct = (y / rect.height) * 100;
      onPatch(applyProfileHeroHeightPct(cardRoot, pct));
    },
    [cardRoot, onPatch, rootRef],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActiveRef.current) return;
      applyClientY(e.clientY);
    },
    [applyClientY],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragActiveRef.current) return;
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragActiveRef.current = false;
      onDragSessionChange?.(false);
    },
    [onDragSessionChange],
  );

  if (!enabled) return null;

  const heroPct = parseProfileHeroHeightPct(
    cardRoot.children?.find((c) => c.id === PROFILE_HERO_ID),
  );

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow={Math.round(heroPct)}
      aria-valuemin={15}
      aria-valuemax={85}
      className="absolute left-0 right-0 z-[4] h-2 -translate-y-1/2 cursor-row-resize touch-none group/hero-split"
      style={{ top: `${heroPct}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="mx-auto h-[3px] w-10 rounded-full bg-primary/80 opacity-60 transition-opacity group-hover/hero-split:opacity-100" />
    </div>
  );
}

function trySelectCardElement(
  e: React.MouseEvent,
  elementId: string,
  isReadOnly: boolean | undefined,
  cardNodeSelected: boolean | undefined,
  onCardElementSelect?: (elementId: string, e: React.MouseEvent) => void,
) {
  if (isReadOnly || !onCardElementSelect) return;
  // First click selects the card node (event bubbles); sub-elements only when card is already selected.
  if (!cardNodeSelected) return;
  e.stopPropagation();
  onCardElementSelect(elementId, e);
}

function DragHandleDots() {
  const dots = Array.from({ length: 6 });
  return (
    <div className="grid grid-cols-2 gap-[3px] opacity-60" aria-hidden>
      {dots.map((_, i) => (
        <span key={i} className="block h-[3px] w-[3px] rounded-full bg-slate-400" />
      ))}
    </div>
  );
}

interface CardElementRendererProps {
  element: CardElementData;
  node: DiagramNodeData;
  nodeId: string;
  staggerMap: Map<string, number>;
  isRoot?: boolean;
  cardSlideStagger?: ChartSlideStagger;
  popAnimIn: string;
  popAnimOut: string;
  isReadOnly?: boolean;
  cardEditElementId?: string | null;
  isEditingCardElement?: boolean;
  cardEditRuns?: RichTextRun[];
  cardSelectedElementId?: string | null;
  onCardElementSelect?: (elementId: string, e: React.MouseEvent) => void;
  onCardElementDoubleClick?: (elementId: string, e: React.MouseEvent) => void;
  onCardElementRichSubmit?: (elementId: string, plainText: string, runs: RichTextRun[]) => void;
  onCardElementKeyDown?: (e: React.KeyboardEvent) => void;
  onCardIconDrop?: (elementId: string, iconRef: CardIconRef) => void;
  onCardIconContextMenu?: (elementId: string, e: React.MouseEvent) => void;
  cardNodeSelected?: boolean;
  cardTemplateId?: string;
  heroBoundaryInteractionEnabled?: boolean;
  onCardElementsPatch?: (elements: CardElementData) => void;
  onHeroBoundaryDragSessionChange?: (active: boolean) => void;
  cardRootRef?: React.RefObject<HTMLDivElement | null>;
  cardRootElements?: CardElementData;
  cardShellBorder?: CardShellBorder;
  cardShellInsetPx?: number;
  cardShellInnerRadius?: string;
}

function cardElementTextNode(base: DiagramNodeData, el: CardElementData): DiagramNodeData {
  return {
    ...base,
    fontSize: el.fontSize ?? 12,
    textColor: el.textColor,
    fontWeight: (el.fontWeight as DiagramNodeData["fontWeight"]) ?? "normal",
    textJustify: "left",
  };
}

function elementPopStyle(
  staggerIndex: number,
  popAnimIn: string,
  popAnimOut: string,
  cfg?: ChartSlideStagger,
): React.CSSProperties | undefined {
  return chartSegmentPopAnimationStyle(staggerIndex, popAnimIn, popAnimOut, 0, 0, cfg);
}

interface CardShellBorder {
  width: number;
  color: string;
  style: "solid" | "dotted" | "dashed";
}

function mergeCardShellBorderStyle(
  styleCss: React.CSSProperties,
  useShellBorder: boolean,
  cardShellBorder?: CardShellBorder,
): React.CSSProperties {
  if (!useShellBorder || !cardShellBorder || cardShellBorder.width <= 0) return styleCss;
  return {
    ...styleCss,
    borderWidth: undefined,
    borderStyle: undefined,
    borderColor: undefined,
    border: `${cardShellBorder.width}px ${cardShellBorder.style} ${cardShellBorder.color}`,
  };
}

function CardIconSlot({
  element,
  nodeId,
  isReadOnly,
  onCardIconDrop,
  onCardIconContextMenu,
  staggerIndex,
  cardSlideStagger,
  popAnimIn,
  popAnimOut,
  cardSelectedElementId,
  onCardElementSelect,
  cardNodeSelected,
  cardShellBorder,
  cardTemplateId,
}: {
  element: CardElementData;
  nodeId: string;
  isReadOnly?: boolean;
  onCardIconDrop?: (elementId: string, iconRef: CardIconRef) => void;
  onCardIconContextMenu?: (elementId: string, e: React.MouseEvent) => void;
  staggerIndex: number;
  cardSlideStagger?: ChartSlideStagger;
  popAnimIn: string;
  popAnimOut: string;
  cardSelectedElementId?: string | null;
  onCardElementSelect?: (elementId: string, e: React.MouseEvent) => void;
  cardNodeSelected?: boolean;
  cardShellBorder?: CardShellBorder;
  cardTemplateId?: string;
}) {
  const effectiveLayout =
    resolveDashboardStatDecorLayout(element.id, cardTemplateId, element.layout) ??
    resolveProfileDiagonalAvatarLayout(element.id, cardTemplateId, element.layout) ??
    resolveProfileSocialAvatarLayout(element.id, cardTemplateId, element.layout) ??
    element.layout;
  const layoutCss = cardLayoutToCss(effectiveLayout);
  const decorOverlayStyle = dashboardStatDecorSlotStyle(element.id, cardTemplateId, effectiveLayout);
  const actionOverlayStyle = dashboardStatActionSlotStyle(element.id, cardTemplateId);
  const diagonalAvatarStyle = profileDiagonalAvatarSlotStyle(element.id, cardTemplateId);
  const rawStyleCss = cardElementStyleToCss(element.style);
  const { styleCss, meshLayer } = cardElementBackgroundLayers(element, rawStyleCss);
  const isCircle = element.placeholder === "circle" || element.style?.borderRadius === 999;
  const isSelected = cardSelectedElementId === element.id;
  const fillSlot = element.iconFillSlot ?? element.placeholder === "circle";
  const useShellBorder =
    !!element.matchCardBorder && !!cardShellBorder && cardShellBorder.width > 0;
  const slotStyleCss = mergeCardShellBorderStyle(styleCss, useShellBorder, cardShellBorder);
  const slotShadowCss: React.CSSProperties =
    element.iconSlotShadow ? { filter: "var(--shape-shadow-drop)" } : {};

  type IconDropItem = {
    type?: string;
    provider?: string;
    category?: string;
    file?: string;
    iconType?: "lucide" | "emoji";
    iconName?: string;
    emoji?: string;
    iconColor?: string;
    imageUrl?: string;
  };

  const [{ isOver, canDrop }, dropRef] = useDrop<
    IconDropItem,
    void,
    { isOver: boolean; canDrop: boolean }
  >(
    () => ({
      accept: ItemTypes.DIAGRAM_NODE,
      canDrop: (item) => !isReadOnly && isIconPaletteDragItem(item),
      drop: (item) => {
        if (!item.type) return;
        let iconRef = iconDragItemToCardIconRef({ ...item, type: item.type });
        if ((element.iconFillSlot ?? element.placeholder === "circle") || element.iconDecorGradient) {
          iconRef = { ...iconRef, noIconBackground: true };
        }
        onCardIconDrop?.(element.id, iconRef);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [element.id, isReadOnly, onCardIconDrop],
  );

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      dropRef(el);
    },
    [dropRef],
  );

  const iconRef = element.iconRef;
  const popStyle = elementPopStyle(staggerIndex, popAnimIn, popAnimOut, cardSlideStagger);
  const placement = element.iconPlacement ?? "center";
  const { style: placementStyle } = cardIconPlacementToAbsoluteStyle(placement);
  const iconSizeMode = iconRef?.iconSizeMode;
  const noIconBackground = iconRef?.noIconBackground ?? false;
  const hideIconTile = noIconBackground || fillSlot;
  const rawIconOpacity = iconRef?.iconOpacity;
  const iconGlyphOpacity = element.iconDecorGradient
    ? parseDashboardDecorIconOpacity(element)
    : typeof rawIconOpacity === "number" && Number.isFinite(rawIconOpacity)
      ? Math.min(1, Math.max(0, rawIconOpacity))
      : 1;
  const isDecorWatermark = !!element.iconDecorGradient;
  const decorWhiteFilter = isDecorWatermark && dashboardStatDecorUsesWhiteFilter(iconRef);
  const isDiagonalAvatar =
    isProfileDiagonalSplitCard(cardTemplateId) && element.id === PROFILE_DIAGONAL_AVATAR_ID;

  return (
    <div
      ref={ref}
      data-dw-card-icon-slot
      data-dw-card-node-id={nodeId}
      data-dw-card-element-id={element.id}
      data-dw-card-element-kind="icon-slot"
      data-dw-card-has-icon={iconRef ? "true" : undefined}
      className={cn(
        "relative flex shrink-0",
        !isDecorWatermark && "overflow-hidden",
        (isDecorWatermark || isDiagonalAvatar) && "pointer-events-auto",
        isOver && canDrop && "ring-2 ring-blue-500 ring-inset",
        isSelected && !isReadOnly && "ring-2 ring-primary ring-inset",
      )}
      style={{
        ...layoutCss,
        ...slotStyleCss,
        ...slotShadowCss,
        ...popStyle,
        ...decorOverlayStyle,
        ...actionOverlayStyle,
        ...diagonalAvatarStyle,
        ...cardIconSlotContainerStyle(iconSizeMode),
        borderRadius: isCircle ? "50%" : slotStyleCss.borderRadius,
        boxSizing: "border-box",
      }}
      onClick={(e) =>
        trySelectCardElement(e, element.id, isReadOnly, cardNodeSelected, onCardElementSelect)
      }
    >
      {meshLayer}
      {iconRef ? (
        isDecorWatermark ? (
          <div data-dw-card-icon-glyph style={dashboardStatDecorClipStyle()}>
            <div style={dashboardStatDecorIconWrapStyle(iconGlyphOpacity)}>
              <ResourceIcon
                type={iconRef.type}
                provider={iconRef.provider}
                category={iconRef.category}
                file={iconRef.file}
                iconType={iconRef.iconType}
                iconName={iconRef.iconName}
                emoji={iconRef.emoji}
                iconColor={iconRef.iconColor ?? "#ffffff"}
                imageUrl={iconRef.imageUrl}
                imageOptions={iconRef.imageOptions}
                width="100%"
                height="100%"
                style={dashboardStatDecorIconImageStyle(decorWhiteFilter, iconGlyphOpacity)}
              />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              fillSlot ? "absolute inset-0" : "absolute shrink-0",
              "flex items-center justify-center overflow-hidden",
              fillSlot && isCircle && "rounded-full",
              !hideIconTile && "rounded-lg shadow-md bg-card dw-icon-container border",
              !hideIconTile && isSelected && !isReadOnly && "border-primary",
            )}
            data-dw-card-icon-glyph
            style={{
              ...(fillSlot ? {} : { ...placementStyle, ...cardIconGlyphSizeStyle(iconRef.nodeSize, iconSizeMode, fillSlot) }),
              containerType: "size",
            }}
          >
            <ResourceIcon
              type={iconRef.type}
              provider={iconRef.provider}
              category={iconRef.category}
              file={iconRef.file}
              iconType={iconRef.iconType}
              iconName={iconRef.iconName}
              emoji={iconRef.emoji}
              iconColor={iconRef.iconColor}
              imageUrl={iconRef.imageUrl}
              imageOptions={iconRef.imageOptions}
              width="100%"
              height="100%"
              className={cn("h-full w-full", fillSlot ? "object-cover" : "object-contain")}
            />
          </div>
        )
      ) : element.placeholder === "rect" || element.placeholder === "circle" || element.iconDecorGradient ? null : (
        <span className="flex h-full w-full items-center justify-center text-[10px] text-white/70">
          Drop icon
        </span>
      )}
    </div>
  );
}

function CardElementRenderer({
  element,
  node,
  nodeId,
  staggerMap,
  isRoot = false,
  cardSlideStagger,
  popAnimIn,
  popAnimOut,
  isReadOnly,
  cardEditElementId,
  isEditingCardElement,
  cardEditRuns,
  cardSelectedElementId,
  onCardElementSelect,
  onCardElementDoubleClick,
  onCardElementRichSubmit,
  onCardElementKeyDown,
  onCardIconDrop,
  onCardIconContextMenu,
  cardNodeSelected,
  cardTemplateId,
  heroBoundaryInteractionEnabled,
  onCardElementsPatch,
  onHeroBoundaryDragSessionChange,
  cardRootRef,
  cardRootElements,
  cardShellBorder,
  cardShellInsetPx = 0,
  cardShellInnerRadius,
}: CardElementRendererProps) {
  const diagonalAccentClipId = `dw-diag-a-${nodeId}`;
  const diagonalBodyClipId = `dw-diag-b-${nodeId}`;
  const effectiveLayout =
    element.kind === "text"
      ? resolveDetailPostBodyLine2Layout(element.id, cardTemplateId, element.layout) ??
        resolveProfileSocialDescriptionLayout(element.id, cardTemplateId, element.layout)
      : element.kind === "section"
        ? resolveProfileDiagonalTextStackLayout(element.id, cardTemplateId, element.layout) ??
          resolveDetailPostBodySectionLayout(element.id, cardTemplateId, element.layout) ??
          resolveProfileSocialSectionLayout(element.id, cardTemplateId, element.layout)
        : element.kind === "icon-slot"
          ? resolveProfileDiagonalAvatarLayout(element.id, cardTemplateId, element.layout) ??
            resolveProfileSocialAvatarLayout(element.id, cardTemplateId, element.layout) ??
            element.layout
          : element.layout;
  const effectiveStyle =
    element.kind === "text"
      ? resolveDetailPostCtaStyle(element.id, cardTemplateId, element.style)
      : element.kind === "section"
        ? resolveDetailPostFooterStyle(element.id, cardTemplateId, element.style)
        : element.style;
  const layoutCss = cardLayoutToCss(effectiveLayout, element.kind === "section");
  const rawStyleCss = cardElementStyleToCss(effectiveStyle);
  const { styleCss, meshLayer } = cardElementBackgroundLayers(element, rawStyleCss);
  const isSelected = cardSelectedElementId === element.id;
  const needsRelative = !!meshLayer;
  const sectionUsesShellBorder =
    element.kind === "section" &&
    detailPostFooterUsesShellBorder(element, cardTemplateId) &&
    !!cardShellBorder &&
    cardShellBorder.width > 0;
  const sectionStyleCss = mergeCardShellBorderStyle(styleCss, sectionUsesShellBorder, cardShellBorder);
  const dashboardSectionStyle = dashboardStatSectionStyle(element.id, cardTemplateId);
  const dashboardSectionClass = dashboardStatSectionClassName(element.id, cardTemplateId);
  const dashboardRootStyle =
    isRoot && isDashboardStatCard(cardTemplateId) ? { position: "relative" as const } : undefined;

  if (
    isProfileDiagonalSplitCard(cardTemplateId) &&
    element.id === PROFILE_DIAGONAL_SPLIT_LINE_ID
  ) {
    return null;
  }

  if (element.kind === "section") {
    const { hero: diagonalHero } = isProfileDiagonalSplitCard(cardTemplateId)
      ? getProfileDiagonalSplitRegions(cardRootElements ?? element)
      : { hero: null };
    const diagonalGeometry = diagonalSplitGeometryFromHero(diagonalHero);
    const diagonalBodyStyle = profileDiagonalBodyLayerStyle(
      element.id,
      cardTemplateId,
      `url(#${diagonalBodyClipId})`,
      cardShellInsetPx,
      cardShellInnerRadius,
    );
    const diagonalHeroStyle = profileDiagonalHeroLayerStyle(
      element.id,
      cardTemplateId,
      `url(#${diagonalAccentClipId})`,
      cardShellInsetPx,
      cardShellInnerRadius,
    );
    const diagonalContentStyle = profileDiagonalContentLayerStyle(
      element.id,
      cardTemplateId,
      cardShellInsetPx,
      cardShellInnerRadius,
    );
    const diagonalRootStyle = profileDiagonalRootLayerStyle(isRoot, cardTemplateId);
    const showHeroHandle =
      isRoot &&
      isProfileHeroSplitCard(cardTemplateId) &&
      heroBoundaryInteractionEnabled &&
      !!cardRootRef &&
      !!cardRootElements;
    const sectionPosition = profileDiagonalSectionPosition(
      element.id,
      cardTemplateId,
      needsRelative || showHeroHandle
        ? "relative"
        : dashboardSectionStyle?.position ?? dashboardRootStyle?.position,
    );
    const sectionStagger = staggerMap.get(element.id);
    const sectionPop =
      sectionStagger != null
        ? elementPopStyle(sectionStagger, popAnimIn, popAnimOut, cardSlideStagger)
        : undefined;
    return (
      <div
        ref={isRoot ? cardRootRef : undefined}
        style={{
          ...layoutCss,
          ...sectionStyleCss,
          ...dashboardSectionStyle,
          ...dashboardRootStyle,
          ...diagonalRootStyle,
          ...diagonalBodyStyle,
          ...diagonalHeroStyle,
          ...diagonalContentStyle,
          ...sectionPop,
          boxSizing: "border-box",
          ...(sectionPosition != null ? { position: sectionPosition } : {}),
          ...(isRoot
            ? { overflow: "hidden", height: "100%", width: "100%", minHeight: 0, minWidth: 0 }
            : {}),
        }}
        data-dw-card-section={element.id}
        data-dw-card-element-id={element.id}
        data-dw-card-element-kind="section"
        className={cn(
          dashboardSectionClass,
          isSelected && !isReadOnly && "ring-2 ring-primary ring-inset",
        )}
        onClick={(e) =>
          trySelectCardElement(e, element.id, isReadOnly, cardNodeSelected, onCardElementSelect)
        }
      >
        {meshLayer}
        {(element.children ?? []).map((child) => (
          <CardElementRenderer
            key={child.id}
            element={child}
            node={node}
            nodeId={nodeId}
            staggerMap={staggerMap}
            cardSlideStagger={cardSlideStagger}
            popAnimIn={popAnimIn}
            popAnimOut={popAnimOut}
            isReadOnly={isReadOnly}
            cardEditElementId={cardEditElementId}
            isEditingCardElement={isEditingCardElement}
            cardEditRuns={cardEditRuns}
            cardSelectedElementId={cardSelectedElementId}
            onCardElementSelect={onCardElementSelect}
            onCardElementDoubleClick={onCardElementDoubleClick}
            onCardElementRichSubmit={onCardElementRichSubmit}
            onCardElementKeyDown={onCardElementKeyDown}
            onCardIconDrop={onCardIconDrop}
            onCardIconContextMenu={onCardIconContextMenu}
            cardNodeSelected={cardNodeSelected}
            cardTemplateId={cardTemplateId}
            heroBoundaryInteractionEnabled={heroBoundaryInteractionEnabled}
            onCardElementsPatch={onCardElementsPatch}
            onHeroBoundaryDragSessionChange={onHeroBoundaryDragSessionChange}
            cardRootRef={cardRootRef}
            cardRootElements={cardRootElements}
            cardShellBorder={cardShellBorder}
            cardShellInsetPx={cardShellInsetPx}
            cardShellInnerRadius={cardShellInnerRadius}
          />
        ))}
        {showHeroHandle ? (
          <ProfileHeroSplitHandle
            enabled
            rootRef={cardRootRef!}
            cardRoot={cardRootElements!}
            onPatch={onCardElementsPatch}
            onDragSessionChange={onHeroBoundaryDragSessionChange}
          />
        ) : null}
        {isRoot && isProfileDiagonalSplitCard(cardTemplateId) && cardShellBorder ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 box-border"
            style={{
              zIndex: 5,
              borderRadius: cardShellInnerRadius ?? undefined,
              border: `${cardShellBorder.width}px ${cardShellBorder.style} ${cardShellBorder.color}`,
            }}
          />
        ) : null}
        {isRoot && isProfileDiagonalSplitCard(cardTemplateId) ? (
          <ProfileDiagonalSplitClipDefs
            accentClipId={diagonalAccentClipId}
            bodyClipId={diagonalBodyClipId}
            geometry={diagonalGeometry}
          />
        ) : null}
      </div>
    );
  }

  const staggerIndex = staggerMap.get(element.id) ?? 0;
  const popStyle = elementPopStyle(staggerIndex, popAnimIn, popAnimOut, cardSlideStagger);

  if (element.kind === "icon-slot") {
    return (
      <CardIconSlot
        element={element}
        nodeId={nodeId}
        isReadOnly={isReadOnly}
        onCardIconDrop={onCardIconDrop}
        onCardIconContextMenu={onCardIconContextMenu}
        staggerIndex={staggerIndex}
        cardSlideStagger={cardSlideStagger}
        popAnimIn={popAnimIn}
        popAnimOut={popAnimOut}
        cardSelectedElementId={cardSelectedElementId}
        onCardElementSelect={onCardElementSelect}
        cardNodeSelected={cardNodeSelected}
        cardShellBorder={cardShellBorder}
        cardTemplateId={cardTemplateId}
      />
    );
  }

  if (element.kind === "decor" && element.placeholder === "dots") {
    return (
      <div
        style={{ ...layoutCss, ...styleCss, ...popStyle, boxSizing: "border-box" }}
        className="flex items-center justify-center"
        data-dw-card-element-id={element.id}
      >
        <DragHandleDots />
      </div>
    );
  }

  if (element.kind === "tag") {
    const isEditing = isEditingCardElement && cardEditElementId === element.id;
    const runs = labelToRuns(element.tag ?? "");
    const hasText = getPlainTextFromRuns(runs).trim().length > 0;
    if (!hasText && !isEditing) {
      return null;
    }
    const tagNode = cardElementTextNode(node, element);

    return (
      <div
        data-dw-card-element-id={element.id}
        data-dw-card-element-kind="tag"
        style={{
          ...layoutCss,
          ...styleCss,
          ...popStyle,
          fontSize: element.fontSize ?? 10,
          color: element.textColor ?? "#1e40af",
          padding: layoutCss.padding ?? "4px 10px",
          boxSizing: "border-box",
          position: needsRelative ? "relative" : undefined,
        }}
        className={cn(
          "inline-flex min-w-0 items-center font-medium",
          isSelected && !isReadOnly && "ring-2 ring-primary ring-inset",
        )}
        onClick={(e) =>
          trySelectCardElement(e, element.id, isReadOnly, cardNodeSelected, onCardElementSelect)
        }
      >
        {meshLayer}
        <div className="relative z-[1] min-w-0">
          {isEditing ? (
            <TextboxRichEditor
              node={tagNode}
              runs={cardEditRuns ?? runs}
              onSubmit={(plain, nextRuns) => onCardElementRichSubmit?.(element.id, plain, nextRuns)}
              onKeyDown={onCardElementKeyDown ?? (() => {})}
            />
          ) : (
            <TextboxRichDisplay
              node={tagNode}
              runs={runs}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (element.editable !== false && !isReadOnly) {
                  onCardElementDoubleClick?.(element.id, e);
                }
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (element.kind === "text") {
    const isEditing = isEditingCardElement && cardEditElementId === element.id;
    const runs = element.richText ?? labelToRuns(element.text ?? "");
    const hasText = getPlainTextFromRuns(runs).trim().length > 0;
    const fillRemaining = effectiveLayout?.fillRemaining === true;
    if (!hasText && !isEditing && !fillRemaining) {
      return null;
    }
    const textNode = cardElementTextNode(node, element);
    const textPad = effectiveLayout?.padding ?? [8, 12];
    const socialTextStyle = resolveProfileSocialTextStyle(element.id, cardTemplateId);
    const textStyle: React.CSSProperties = {
      ...layoutCss,
      ...styleCss,
      ...popStyle,
      ...socialTextStyle,
      fontSize: element.fontSize ?? 12,
      fontWeight: element.fontWeight as React.CSSProperties["fontWeight"],
      color: element.textColor ?? "#0f172a",
      lineHeight: element.lineHeight ?? 1.35,
      wordBreak: "break-word",
      padding: cardLayoutToCss({ padding: textPad }).padding,
      boxSizing: "border-box",
      position: needsRelative ? "relative" : undefined,
      ...(fillRemaining
        ? { overflow: isEditing ? "auto" : (layoutCss.overflow ?? "hidden") }
        : {}),
    };

    return (
      <div
        style={textStyle}
        data-dw-card-element-id={element.id}
        data-dw-card-element-kind="text"
        className={cn(
          "min-w-0",
          fillRemaining && "min-h-0",
          isSelected && !isReadOnly && "ring-2 ring-primary ring-inset",
        )}
        onClick={(e) =>
          trySelectCardElement(e, element.id, isReadOnly, cardNodeSelected, onCardElementSelect)
        }
      >
        {meshLayer}
        <div
          className={cn(
            "relative z-[1] min-w-0",
            fillRemaining && "min-h-0 flex-1 overflow-hidden",
          )}
        >
        {isEditing ? (
          <TextboxRichEditor
            node={textNode}
            runs={cardEditRuns ?? runs}
            onSubmit={(plain, nextRuns) => onCardElementRichSubmit?.(element.id, plain, nextRuns)}
            onKeyDown={onCardElementKeyDown ?? (() => {})}
          />
        ) : (
          <TextboxRichDisplay
            node={textNode}
            runs={runs}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (element.editable !== false && !isReadOnly) {
                onCardElementDoubleClick?.(element.id, e);
              }
            }}
          />
        )}
        </div>
      </div>
    );
  }

  return null;
}

export function CardShape(props: CardShapeProps) {
  const {
    node,
    isReadOnly,
    cardEditElementId,
    isEditingCardElement,
    cardEditRuns,
    cardSelectedElementId,
    onCardElementSelect,
    onCardElementDoubleClick,
    onCardElementRichSubmit,
    onCardElementKeyDown,
    onCardIconDrop,
    onCardIconContextMenu,
    presentationCardSlideStagger,
    cardNodeSelected,
    cardTemplateId,
    heroBoundaryInteractionEnabled,
    onCardElementsPatch,
    onHeroBoundaryDragSessionChange,
    slideColorTransition,
    highlightAnimStaggerIndex,
    highlightAnimStaggerCount,
    ...wrapperRest
  } = props;

  const cardRootRef = useRef<HTMLDivElement | null>(null);

  const nodeAny = node as DiagramNodeData & { width?: number; height?: number };
  const resolvedTemplateId = cardTemplateId ?? nodeAny.card?.templateId;
  const styles = getShapeStyles(nodeAny);
  const nodeBorderStyle = (nodeAny.borderStyle as string | undefined) ?? "solid";
  const borderWidthNum =
    nodeBorderStyle === "none"
      ? 0
      : typeof nodeAny.borderWidth === "number" && Number.isFinite(nodeAny.borderWidth)
        ? Math.max(0, nodeAny.borderWidth)
        : parseInt(String(styles.borderWidth ?? "2"), 10) || 2;
  const cornerRadius = Math.max(0, Math.min(1, nodeAny.cornerRadius ?? 0.12));
  const w = nodeAny.width ?? 160;
  const h = nodeAny.height ?? 120;
  const minDim = Math.min(w, h);
  const radiusPx = cornerRadius * (minDim / 2);
  const borderRadiusStr = `${radiusPx}px`;
  const innerRadiusStr = `${Math.max(0, radiusPx - borderWidthNum)}px`;
  const needsGradientBorder =
    nodeBorderStyle === "gradient" && !!(styles.borderImage && styles.borderColors);
  const borderGradientBackground = needsGradientBorder
    ? String(styles.borderImage).replace(/\s+1$/, "")
    : undefined;
  const isDottedBorder = nodeBorderStyle === "dotted" && borderWidthNum > 0;
  const isSolidBorder = nodeBorderStyle === "solid" && borderWidthNum > 0;
  const borderColor = styles.borderColor ?? "#0f172a";
  const cardShellBorder = useMemo((): CardShellBorder | undefined => {
    if (nodeBorderStyle === "none" || borderWidthNum <= 0) return undefined;
    const color = needsGradientBorder
      ? (styles.borderColors?.[0] ?? borderColor)
      : borderColor;
    const shellStyle: CardShellBorder["style"] =
      nodeBorderStyle === "dotted"
        ? "dotted"
        : nodeBorderStyle === "dashed"
          ? "dashed"
          : "solid";
    return { width: borderWidthNum, color, style: shellStyle };
  }, [nodeBorderStyle, borderWidthNum, borderColor, needsGradientBorder, styles.borderColors]);

  const cardRoot = nodeAny.card?.elements;
  const staggerMap = useMemo(() => {
    const flat = flattenCardElements(cardRoot);
    const m = new Map<string, number>();
    flat.forEach((el, i) => m.set(el.id, i));
    return m;
  }, [cardRoot]);
  const shellHighlightStyle = useMemo(
    () =>
      getHighlightAnimStyleForNode(
        { ...nodeAny, x: nodeAny.x ?? 0, y: nodeAny.y ?? 0 },
        {
          isLineNode: false,
          isDuplicateDragPreview: false,
          positionX: nodeAny.x ?? 0,
          positionY: nodeAny.y ?? 0,
          highlightAnimStaggerIndex,
          highlightAnimStaggerCount,
          roundedShellGlow: true,
        },
      ),
    [
      nodeAny,
      highlightAnimStaggerIndex,
      highlightAnimStaggerCount,
      nodeAny.highlightAnim,
      nodeAny.highlightAnimMode,
      nodeAny.highlightAnimDurationSec,
      nodeAny.highlightAnimIntervalSec,
      nodeAny.highlightAnimGlowColor,
      nodeAny.highlightAnimGlowIntensity,
    ],
  );

  const uid = useId().replace(/:/g, "");
  const popAnimIn = `dw-card-in-${uid}`;
  const popAnimOut = `dw-card-out-${uid}`;
  const popKeyframes = presentationCardSlideStagger
    ? chartSegmentPopKeyframesCss(popAnimIn, popAnimOut)
    : null;

  const isDiagonalSplitCard = isProfileDiagonalSplitCard(resolvedTemplateId);
  const cardShellInsetPx = needsGradientBorder ? borderWidthNum : 0;

  const innerTree = useMemo(() => {
    if (!cardRoot) return null;
    return (
      <CardElementRenderer
        element={cardRoot}
        node={nodeAny}
        nodeId={nodeAny.id}
        staggerMap={staggerMap}
        isRoot
        cardSlideStagger={presentationCardSlideStagger}
        popAnimIn={popAnimIn}
        popAnimOut={popAnimOut}
        isReadOnly={isReadOnly}
        cardEditElementId={cardEditElementId}
        isEditingCardElement={isEditingCardElement}
        cardEditRuns={cardEditRuns}
        cardSelectedElementId={cardSelectedElementId}
        onCardElementSelect={onCardElementSelect}
        onCardElementDoubleClick={onCardElementDoubleClick}
        onCardElementRichSubmit={onCardElementRichSubmit}
        onCardElementKeyDown={onCardElementKeyDown}
        onCardIconDrop={onCardIconDrop}
        onCardIconContextMenu={onCardIconContextMenu}
        cardNodeSelected={cardNodeSelected}
        cardTemplateId={resolvedTemplateId}
        heroBoundaryInteractionEnabled={heroBoundaryInteractionEnabled}
        onCardElementsPatch={onCardElementsPatch}
        onHeroBoundaryDragSessionChange={onHeroBoundaryDragSessionChange}
        cardRootRef={cardRootRef}
        cardRootElements={cardRoot}
        cardShellBorder={cardShellBorder}
        cardShellInsetPx={cardShellInsetPx}
        cardShellInnerRadius={innerRadiusStr}
      />
    );
  }, [
    cardRoot,
    nodeAny,
    presentationCardSlideStagger,
    popAnimIn,
    popAnimOut,
    isReadOnly,
    cardEditElementId,
    isEditingCardElement,
    cardEditRuns,
    cardSelectedElementId,
    onCardElementSelect,
    onCardElementDoubleClick,
    onCardElementRichSubmit,
    onCardElementKeyDown,
    onCardIconDrop,
    onCardIconContextMenu,
    cardNodeSelected,
    resolvedTemplateId,
    heroBoundaryInteractionEnabled,
    onCardElementsPatch,
    onHeroBoundaryDragSessionChange,
    staggerMap,
    cardShellBorder,
    cardShellInsetPx,
    innerRadiusStr,
  ]);

  const shellBg =
    nodeAny.backgroundStyle === "none"
      ? "transparent"
      : styles.background ?? styles.backgroundColor ?? "#ffffff";

  const shellTransition = slideColorTransition ? { transition: slideColorTransition } : {};

  /** Drop-shadow on the rounded shell itself — a rectangular parent leaves gray wedges in the corners. */
  const outerDropShadowFilter = styles.shadow ? "var(--shape-shadow-drop)" : undefined;

  const nodeLevelBgLayer =
    shellBg !== "transparent" ? (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: shellBg, ...shellTransition }}
      />
    ) : null;

  const cardContentLayer = (
    <div className="relative z-[1] flex h-full min-h-0 w-full min-w-0 flex-col">
      {innerTree}
    </div>
  );

  /** One rounded mask; shadow + glow live here (ShapeWrapper uses overflow:hidden and would clip an outer halo). */
  const maskShellStyle: React.CSSProperties = {
    borderRadius: borderRadiusStr,
    overflow: "hidden",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    position: "relative",
    ...mergeCardShellHighlightStyle(shellHighlightStyle, outerDropShadowFilter),
    ...shellTransition,
  };
  const maskShellHighlightAnim = shellHighlightStyle ? ("true" as const) : undefined;

  let maskedCard: React.ReactNode;

  if (needsGradientBorder) {
    maskedCard = (
      <div
        className="relative box-border h-full w-full"
        data-dw-highlight-anim={maskShellHighlightAnim}
        style={maskShellStyle}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: borderGradientBackground,
            backgroundColor: styles.borderColors?.[0],
          }}
        />
        <div
          className="absolute z-[1] flex min-h-0 min-w-0 flex-col overflow-hidden"
          style={{
            inset: borderWidthNum,
            borderRadius: innerRadiusStr,
          }}
        >
          {nodeLevelBgLayer}
          {cardContentLayer}
        </div>
      </div>
    );
  } else if (isDottedBorder) {
    maskedCard = (
      <div
        className="box-border h-full w-full"
        data-dw-highlight-anim={maskShellHighlightAnim}
        style={{
          ...maskShellStyle,
          ...(isDiagonalSplitCard
            ? {}
            : { border: `${borderWidthNum}px dotted ${borderColor}` }),
        }}
      >
        {nodeLevelBgLayer}
        {cardContentLayer}
      </div>
    );
  } else if (isSolidBorder) {
    maskedCard = (
      <div
        className="box-border h-full w-full"
        data-dw-highlight-anim={maskShellHighlightAnim}
        style={{
          ...maskShellStyle,
          ...(isDiagonalSplitCard
            ? {}
            : { border: `${borderWidthNum}px solid ${borderColor}` }),
        }}
      >
        {nodeLevelBgLayer}
        {cardContentLayer}
      </div>
    );
  } else {
    maskedCard = (
      <div
        className="box-border h-full w-full"
        data-dw-highlight-anim={maskShellHighlightAnim}
        style={maskShellStyle}
      >
        {nodeLevelBgLayer}
        {cardContentLayer}
      </div>
    );
  }

  return (
    <ShapeWrapper
      {...wrapperRest}
      node={nodeAny}
      defaultWidth={160}
      defaultHeight={120}
      skipWrapperStyling
      preserveShellHalo={Boolean(shellHighlightStyle)}
      omitShapeText
      borderRadius={borderRadiusStr}
      slideColorTransition={slideColorTransition}
    >
      {popKeyframes ? <style>{popKeyframes}</style> : null}
      {maskedCard}
    </ShapeWrapper>
  );
}
