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
import {
  cardShellExitStaggerSegmentIndex,
  flattenCardElementsForSlideStaggerTiming,
  type CardSlideStaggerTimingOptions,
} from "@/lib/card-presentation";
import {
  applyProfileHeroHeightPct,
  isProfileHeroSplitCard,
  parseProfileHeroHeightPct,
  PROFILE_HERO_ID,
  resolveProfileFeatureBodyLayout,
  resolveProfileFeatureTextLayout,
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
  resolveDetailPostBodySectionLayout,
  resolveDetailPostCtaStyle,
  resolveDetailPostFooterSectionLayout,
  resolveDetailPostFooterStyle,
  resolveDetailPostTextLayout,
  detailPostFooterUsesShellBorder,
} from "@/lib/card-detail-post";
import {
  resolveCompactHorizontalTextColLayout,
  resolveCompactHorizontalTextLayout,
} from "@/lib/card-compact-horizontal";
import {
  getSidebarAccentRegions,
  isSidebarAccentBar,
  parseSidebarAccentBarWidth,
  resolveSidebarAccentBarLayout,
  resolveSidebarAccentContentColLayout,
  resolveSidebarAccentTextLayout,
  SIDEBAR_ACCENT_COLOR_DEFAULT,
} from "@/lib/card-sidebar-accent";
import {
  isListItemRowCard,
  LIST_ITEM_INDICATOR_ID,
  parseListItemIndicatorCircle,
  resolveListItemLabelLayout,
} from "@/lib/card-list-item";
import {
  dashboardStatActionGlyphStyle,
  dashboardStatActionSlotStyle,
  dashboardStatDecorClipStyle,
  dashboardStatDecorIconImageStyle,
  dashboardStatDecorIconWrapStyle,
  dashboardStatDecorSlotStyle,
  dashboardStatDecorUsesWhiteFilter,
  dashboardStatEditablePointerStyle,
  dashboardStatSectionStyle,
  isDashboardStatActionIcon,
  isDashboardStatCard,
  parseDashboardDecorIconOpacity,
  resolveDashboardStatActionLayout,
  resolveDashboardStatDecorLayout,
} from "@/lib/card-dashboard-stat";
import {
  elementFeatureContentSectionStyle,
  elementFeatureEditablePointerStyle,
  elementFeatureNumberSlotStyle,
  elementFeatureRootStyle,
  elementFeatureWatermarkPointerStyle,
  ELEMENT_FEATURE_ACCENT_DEFAULT,
  ELEMENT_FEATURE_LABEL_ID,
  ELEMENT_FEATURE_TITLE_ID,
  ELEMENT_FEATURE_NUMBER_ID,
  isElementFeatureAccentLine,
  isElementFeatureAlignableText,
  isElementFeatureCard,
  isElementFeatureWatermarkNumber,
  resolveElementFeatureAccentLineLayout,
  resolveElementFeatureAccentLineStyle,
  resolveElementFeatureAccentColor,
  resolveElementFeatureContentColLayout,
  resolveElementFeatureNumberLayout,
  resolveElementFeatureTextLayout,
} from "@/lib/card-element-feature";
import {
  addAgendaRow,
  agendaRowThemeHueEnabled,
  AGENDA_MIN_ROWS,
  AGENDA_ADD_ROW_LABEL_ID,
  AGENDA_HEADER_ENTRIES_DIVIDER_ID,
  AGENDA_TABLE_HEADER_ID,
  AGENDA_SESSION_HEADER_ID,
  AGENDA_TIME_HEADER_ID,
  applyAgendaResizeLayout,
  computeAgendaResizeMetrics,
  getAgendaDividerColor,
  getAgendaFirstRowFillColor,
  getAgendaRegions,
  getAgendaRows,
  isAgendaAddRowId,
  isAgendaCard,
  isAgendaDividerElement,
  isAgendaRowId,
  isAgendaTimeCellId,
  removeAgendaRow,
  resolveAgendaEntriesSectionLayout,
  resolveAgendaFullBleedSectionLayout,
  resolveAgendaHorizontalDividerLayout,
  resolveAgendaRowStyle,
  resolveAgendaSessionCellLayout,
  resolveAgendaTableHeaderSectionStyle,
  resolveAgendaTableHeaderTextColor,
  resolveAgendaTimeCellLayout,
  resolveAgendaTimeTextStyle,
  scaleAgendaFontSize,
  scaleAgendaPadding,
  scaleAgendaRichTextRuns,
  type AgendaResizeMetrics,
} from "@/lib/card-agenda";
import {
  addBulletListRow,
  applyBulletListResizeLayout,
  BULLET_LIST_ADD_ROW_LABEL_ID,
  BULLET_LIST_MIN_ROWS,
  BULLET_LIST_TEXT_SUFFIX,
  BULLET_LIST_TITLE_ID,
  bulletListItemThemeHueEnabled,
  computeBulletListResizeMetrics,
  getBulletListRows,
  isBulletListAddRowId,
  isBulletListCard,
  isBulletListCubeId,
  isBulletListRowId,
  parseBulletListBulletShape,
  parseBulletListBulletSize,
  removeBulletListRow,
  resolveBulletCubeColor,
  resolveBulletListBulletBorderRadius,
  normalizeBulletListItemDisplayRuns,
  resolveBulletListItemFontSizeForRender,
  resolveBulletListTitleTextLayout,
  scaleBulletListTitleFontSize,
  type BulletListResizeMetrics,
} from "@/lib/card-bullet-list";
import { getPlainTextFromRuns, labelToRuns } from "@/lib/rich-text";
import { resolveGlobalVariablesInRuns } from "@/lib/global-properties";
import { useGlobalProperties } from "../global-properties-context";
import { mergeCardElementTextStylingOntoNode } from "@/lib/text-styling";
import { useTheme } from "@/components/theme-provider";
import { useThemeMenuHueStepDeg } from "@/hooks/use-theme-menu-hue-step-deg";
import { useThemeMultiHueLayout } from "@/hooks/use-theme-multi-hue-layout";
import { TextboxRichEditor } from "../textbox-rich-editor";
import { TextboxRichDisplay } from "../textbox-rich-display";
import { ResourceIcon } from "../resource-icon";
import { CardElementMeshBackground } from "./card-element-background";
import { ShapeWrapper } from "./shape-wrapper";
import { getShapeStyles, getTextJustifyClass } from "./shape-utils";
import { ItemTypes } from "@/components/editor/draggable-item";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  AgendaRowDropIndicator,
  AgendaRowDropIndicatorBottom,
  AgendaRowReorderGrip,
  AgendaRowReorderProvider,
  agendaRowIndexFromElements,
  bulletListRowIndexFromElements,
  BulletListRowReorderProvider,
  useAgendaRowSectionReorder,
} from "./card-agenda-row-reorder";
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
  const { background: _background, ...restStyle } = styleCss;
  return {
    styleCss: {
      ...restStyle,
      backgroundImage: "none",
      backgroundColor: "transparent",
    },
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

function stopCardNodeDrag(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function tryAgendaAddRowClick(
  cardTemplateId: string | undefined,
  elementId: string,
  e: React.MouseEvent,
  cardRootElements: CardElementData | undefined,
  onCardElementsPatch?: (elements: CardElementData) => void,
  themeHue = false,
  hueStepDeg = 36,
): boolean {
  if (!isAgendaCard(cardTemplateId)) return false;
  if (!isAgendaAddRowId(elementId) && elementId !== AGENDA_ADD_ROW_LABEL_ID) return false;
  if (!cardRootElements || !onCardElementsPatch) return false;
  e.stopPropagation();
  onCardElementsPatch(addAgendaRow(cardRootElements, { themeHue, hueStepDeg }));
  return true;
}

function tryBulletListAddRowClick(
  cardTemplateId: string | undefined,
  elementId: string,
  e: React.MouseEvent,
  cardRootElements: CardElementData | undefined,
  onCardElementsPatch?: (elements: CardElementData) => void,
  themeHue = false,
  hueStepDeg = 36,
): boolean {
  if (!isBulletListCard(cardTemplateId)) return false;
  if (!isBulletListAddRowId(elementId) && elementId !== BULLET_LIST_ADD_ROW_LABEL_ID) return false;
  if (!cardRootElements || !onCardElementsPatch) return false;
  e.stopPropagation();
  onCardElementsPatch(addBulletListRow(cardRootElements, { themeHue, hueStepDeg }));
  return true;
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
  agendaThemeHue?: boolean;
  agendaHueStepDeg?: number;
  isDarkTheme?: boolean;
  agendaRowIndexMap?: Map<string, number>;
  agendaTableHeaderStyle?: CardElementData["style"];
  agendaDividersEnabled?: boolean;
  agendaResizeMetrics?: AgendaResizeMetrics | null;
  bulletListItemThemeHue?: boolean;
  bulletListRowIndexMap?: Map<string, number>;
  bulletListResizeMetrics?: BulletListResizeMetrics | null;
  bulletListUniformItemFontSize?: number;
}

function cardElementTextNode(base: DiagramNodeData, el: CardElementData): DiagramNodeData {
  return mergeCardElementTextStylingOntoNode(base, el);
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
    resolveDashboardStatActionLayout(element.id, cardTemplateId, element.layout) ??
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
  const listItemPlainIcon =
    isListItemRowCard(cardTemplateId) &&
    element.id === LIST_ITEM_INDICATOR_ID &&
    !parseListItemIndicatorCircle(element);
  const isSelected = cardSelectedElementId === element.id;
  const fillSlot = element.iconFillSlot ?? element.placeholder === "circle";
  const isDashboardActionIcon = isDashboardStatActionIcon(element.id, cardTemplateId);
  const useFillSlotGlyphLayout = fillSlot && !isDashboardActionIcon;
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
        const forceNoIconBackground =
          element.iconDecorGradient ||
          listItemPlainIcon ||
          ((element.iconFillSlot ?? element.placeholder === "circle") && !isDashboardActionIcon);
        if (forceNoIconBackground) {
          iconRef = { ...iconRef, noIconBackground: true };
        }
        onCardIconDrop?.(element.id, iconRef);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [element.id, element.iconDecorGradient, element.iconFillSlot, element.placeholder, cardTemplateId, isDashboardActionIcon, isReadOnly, listItemPlainIcon, onCardIconDrop],
  );

  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      dropRef(el);
    },
    [dropRef],
  );

  const iconRef = element.iconRef;
  const popStyle = elementPopStyle(staggerIndex, popAnimIn, popAnimOut, cardSlideStagger);
  const placement = element.iconPlacement ?? (isDashboardActionIcon ? "top-right" : "center");
  const { style: placementStyle } = cardIconPlacementToAbsoluteStyle(placement);
  const iconSizeMode = iconRef?.iconSizeMode;
  const noIconBackground = (iconRef?.noIconBackground ?? false) || listItemPlainIcon;
  const hideIconTile = isDashboardActionIcon || noIconBackground || (fillSlot && !isDashboardActionIcon);
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
        !isDecorWatermark && !isDashboardActionIcon && fillSlot && "overflow-hidden",
        (isDecorWatermark || isDiagonalAvatar) && "pointer-events-auto",
        isDashboardActionIcon && "pointer-events-none overflow-visible",
        isOver && canDrop && "ring-2 ring-blue-500 ring-inset",
        isSelected && !isReadOnly && "ring-2 ring-primary ring-inset",
      )}
      style={{
        ...layoutCss,
        ...(isDashboardActionIcon || listItemPlainIcon
          ? {
              backgroundImage: "none",
              backgroundColor: "transparent",
              border: "none",
              boxShadow: "none",
            }
          : slotStyleCss),
        ...slotShadowCss,
        ...popStyle,
        ...decorOverlayStyle,
        ...actionOverlayStyle,
        ...diagonalAvatarStyle,
        ...cardIconSlotContainerStyle(iconSizeMode),
        borderRadius: isDashboardActionIcon || listItemPlainIcon ? undefined : isCircle ? "50%" : slotStyleCss.borderRadius,
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
              useFillSlotGlyphLayout ? "absolute inset-0" : "absolute shrink-0",
              "flex items-center justify-center overflow-hidden",
              useFillSlotGlyphLayout && isCircle && "rounded-full",
              !hideIconTile && !listItemPlainIcon && "rounded-lg shadow-md bg-card dw-icon-container border",
              !hideIconTile && !listItemPlainIcon && isSelected && !isReadOnly && "border-primary",
              isDashboardActionIcon && "pointer-events-auto",
            )}
            data-dw-card-icon-glyph
            style={{
              ...(isDashboardActionIcon
                ? dashboardStatActionGlyphStyle(element, iconRef, placement)
                : useFillSlotGlyphLayout
                  ? {}
                  : { ...placementStyle, ...cardIconGlyphSizeStyle(iconRef.nodeSize, iconSizeMode, useFillSlotGlyphLayout) }),
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
              className={cn("h-full w-full", useFillSlotGlyphLayout ? "object-cover" : "object-contain")}
              style={
                typeof rawIconOpacity === "number" && Number.isFinite(rawIconOpacity)
                  ? { opacity: iconGlyphOpacity }
                  : undefined
              }
            />
          </div>
        )
      ) : isDashboardActionIcon ? (
        <div
          className="pointer-events-auto absolute shrink-0"
          aria-hidden
          style={dashboardStatActionGlyphStyle(element, undefined, placement)}
        />
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
  agendaThemeHue = false,
  agendaHueStepDeg: agendaHueStepDegProp = 36,
  isDarkTheme = false,
  agendaRowIndexMap,
  agendaTableHeaderStyle,
  agendaDividersEnabled = true,
  agendaResizeMetrics = null,
  bulletListItemThemeHue = false,
  bulletListRowIndexMap,
  bulletListResizeMetrics = null,
  bulletListUniformItemFontSize,
}: CardElementRendererProps) {
  const globalProperties = useGlobalProperties();
  const diagonalAccentClipId = `dw-diag-a-${nodeId}`;
  const diagonalBodyClipId = `dw-diag-b-${nodeId}`;
  const agendaRowIndex = agendaRowIndexMap?.get(element.id) ?? 0;
  const agendaFirstRowFill = cardRootElements
    ? getAgendaFirstRowFillColor(cardRootElements)
    : undefined;
  const agendaRowCount =
    isAgendaCard(cardTemplateId) && cardRootElements ? getAgendaRows(cardRootElements).length : 0;
  const bulletListRowCount =
    isBulletListCard(cardTemplateId) && cardRootElements
      ? getBulletListRows(cardRootElements).length
      : 0;
  const showAgendaRowDelete =
    isAgendaCard(cardTemplateId) &&
    isAgendaRowId(element.id) &&
    cardNodeSelected &&
    !isReadOnly &&
    !!cardRootElements &&
    !!onCardElementsPatch &&
    agendaRowCount > AGENDA_MIN_ROWS;
  const showBulletListRowDelete =
    isBulletListCard(cardTemplateId) &&
    isBulletListRowId(element.id) &&
    cardNodeSelected &&
    !isReadOnly &&
    !!cardRootElements &&
    !!onCardElementsPatch &&
    bulletListRowCount > BULLET_LIST_MIN_ROWS;
  const showAgendaRowReorder =
    isAgendaCard(cardTemplateId) &&
    isAgendaRowId(element.id) &&
    cardNodeSelected &&
    !isReadOnly &&
    agendaRowCount > 1;
  const showBulletListRowReorder =
    isBulletListCard(cardTemplateId) &&
    isBulletListRowId(element.id) &&
    cardNodeSelected &&
    !isReadOnly &&
    bulletListRowCount > 1;
  const showListRowDelete = showAgendaRowDelete || showBulletListRowDelete;
  const showListRowReorder = showAgendaRowReorder || showBulletListRowReorder;
  const listRowListIndex =
    showAgendaRowReorder && cardRootElements
      ? agendaRowIndexFromElements(cardRootElements, element.id)
      : showBulletListRowReorder && cardRootElements
        ? bulletListRowIndexFromElements(cardRootElements, element.id)
        : -1;
  const rowReorder = useAgendaRowSectionReorder(element.id, listRowListIndex);
  const isAgendaAddRowSection = isAgendaCard(cardTemplateId) && isAgendaAddRowId(element.id);
  const isBulletListAddRowSection =
    isBulletListCard(cardTemplateId) && isBulletListAddRowId(element.id);
  const isListAddRowSection = isAgendaAddRowSection || isBulletListAddRowSection;

  if (isAgendaCard(cardTemplateId) && isAgendaAddRowId(element.id)) {
    if (isReadOnly || !cardNodeSelected) return null;
  }

  if (isBulletListCard(cardTemplateId) && isBulletListAddRowId(element.id)) {
    if (isReadOnly || !cardNodeSelected) return null;
  }

  if (
    isAgendaCard(cardTemplateId) &&
    element.id === AGENDA_HEADER_ENTRIES_DIVIDER_ID &&
    agendaDividersEnabled
  ) {
    return null;
  }

  if (isAgendaCard(cardTemplateId) && isAgendaDividerElement(element.id) && !agendaDividersEnabled) {
    return null;
  }

  if (element.hidden) return null;

  const baseLayout =
    element.kind === "text"
      ? resolveAgendaSessionCellLayout(
          element.id,
          cardTemplateId,
          element.layout,
          agendaResizeMetrics,
        ) ??
        resolveAgendaTimeCellLayout(
          element.id,
          cardTemplateId,
          element.layout,
          agendaResizeMetrics,
        ) ??
        resolveDetailPostTextLayout(element.id, cardTemplateId, element.layout) ??
        resolveSidebarAccentTextLayout(element.id, cardTemplateId, element.layout) ??
        resolveElementFeatureTextLayout(element.id, cardTemplateId, element.layout) ??
        resolveProfileFeatureTextLayout(element.id, cardTemplateId, element.layout) ??
        resolveCompactHorizontalTextLayout(element.id, cardTemplateId, element.layout) ??
        resolveListItemLabelLayout(element.id, cardTemplateId, element.layout, cardRootElements) ??
        resolveProfileSocialDescriptionLayout(element.id, cardTemplateId, element.layout) ??
        resolveBulletListTitleTextLayout(element.id, cardTemplateId, element.layout) ??
        resolveElementFeatureNumberLayout(element.id, cardTemplateId, element.layout)
      : element.kind === "section"
        ? resolveProfileFeatureBodyLayout(element.id, cardTemplateId, element.layout) ??
          resolveProfileDiagonalTextStackLayout(element.id, cardTemplateId, element.layout) ??
          resolveCompactHorizontalTextColLayout(element.id, cardTemplateId, element.layout) ??
          resolveSidebarAccentContentColLayout(element.id, cardTemplateId, element.layout) ??
          resolveElementFeatureContentColLayout(element.id, cardTemplateId, element.layout) ??
          resolveDetailPostBodySectionLayout(element.id, cardTemplateId, element.layout) ??
          resolveDetailPostFooterSectionLayout(element.id, cardTemplateId, element.layout) ??
          resolveProfileSocialSectionLayout(element.id, cardTemplateId, element.layout)
        : element.kind === "icon-slot"
          ? resolveProfileDiagonalAvatarLayout(element.id, cardTemplateId, element.layout) ??
            resolveProfileSocialAvatarLayout(element.id, cardTemplateId, element.layout) ??
            element.layout
          : element.kind === "decor"
            ? resolveSidebarAccentBarLayout(element.id, cardTemplateId, element.layout) ??
              resolveElementFeatureAccentLineLayout(element.id, cardTemplateId, element.layout) ??
              element.layout
            : element.layout;
  const withAgendaLayout = (layout: CardElementData["layout"]) =>
    resolveAgendaEntriesSectionLayout(element.id, cardTemplateId, layout) ??
    resolveAgendaHorizontalDividerLayout(element.id, cardTemplateId, layout) ??
    layout;
  const resolvedLayout =
    resolveAgendaFullBleedSectionLayout(element.id, cardTemplateId, withAgendaLayout(baseLayout)) ??
    withAgendaLayout(baseLayout);
  const effectiveLayout =
    isAgendaCard(cardTemplateId) && agendaResizeMetrics && element.kind === "section"
      ? applyAgendaResizeLayout(element.id, resolvedLayout, agendaResizeMetrics)
      : isBulletListCard(cardTemplateId) &&
          bulletListResizeMetrics &&
          (element.kind === "section" || element.kind === "text")
        ? applyBulletListResizeLayout(element.id, resolvedLayout, bulletListResizeMetrics)
        : resolvedLayout;
  const effectiveStyle =
    isElementFeatureAccentLine(element.id, cardTemplateId)
      ? resolveElementFeatureAccentLineStyle(
          cardRootElements,
          node.lineColor,
          element.style,
          ELEMENT_FEATURE_ACCENT_DEFAULT,
        )
      : element.kind === "text"
      ? resolveDetailPostCtaStyle(element.id, cardTemplateId, element.style)
      : element.kind === "section"
        ? resolveAgendaTableHeaderSectionStyle(element.id, cardTemplateId, element.style, isDarkTheme) ??
          resolveAgendaRowStyle(
            element.id,
            cardTemplateId,
            element.style,
            agendaRowIndex,
            agendaThemeHue,
            agendaHueStepDegProp,
            agendaFirstRowFill,
          ) ??
          resolveDetailPostFooterStyle(element.id, cardTemplateId, element.style)
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
  const dashboardEditablePointerStyle = dashboardStatEditablePointerStyle(cardTemplateId, element);
  const dashboardRootStyle =
    isRoot && isDashboardStatCard(cardTemplateId) ? { position: "relative" as const } : undefined;
  const elementFeatureSectionStyle = elementFeatureContentSectionStyle(element.id, cardTemplateId);
  const elementFeaturePointerStyle = elementFeatureEditablePointerStyle(cardTemplateId, element);
  const elementFeatureRootLayerStyle = elementFeatureRootStyle(isRoot, cardTemplateId);

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
    const agendaTableHeaderBottomRule: React.CSSProperties =
      isAgendaCard(cardTemplateId) &&
      element.id === AGENDA_TABLE_HEADER_ID &&
      agendaDividersEnabled &&
      cardRootElements
        ? {
            borderBottomWidth: 1,
            borderBottomStyle: "solid",
            borderBottomColor: getAgendaDividerColor(cardRootElements),
          }
        : {};
    return (
      <div
        ref={(el) => {
          if (isRoot && cardRootRef) cardRootRef.current = el;
          if (showListRowReorder) rowReorder.setRowRef(el);
        }}
        style={{
          ...layoutCss,
          ...sectionStyleCss,
          ...agendaTableHeaderBottomRule,
          ...dashboardSectionStyle,
          ...dashboardEditablePointerStyle,
          ...dashboardRootStyle,
          ...elementFeatureSectionStyle,
          ...elementFeaturePointerStyle,
          ...elementFeatureRootLayerStyle,
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
        data-dw-card-action={isListAddRowSection ? "" : undefined}
        {...(showListRowReorder ? rowReorder.rowSectionProps : {})}
        className={cn(
          isSelected && !isReadOnly && "ring-2 ring-primary ring-inset",
          isListAddRowSection && "cursor-pointer hover:bg-primary/5",
          (isListAddRowSection || showListRowDelete || showListRowReorder) && "relative",
          showListRowDelete && "pr-6",
          showListRowReorder && "pl-5 touch-none",
          showListRowReorder && !rowReorder.isDragging && "cursor-grab",
          rowReorder.isDragging && "opacity-50",
        )}
        onPointerDown={(e) => {
          if (isListAddRowSection) stopCardNodeDrag(e);
          rowReorder.rowSectionProps.onPointerDown?.(e);
        }}
        onMouseDown={isListAddRowSection ? stopCardNodeDrag : undefined}
        onClick={(e) => {
          if (
            tryAgendaAddRowClick(
              cardTemplateId,
              element.id,
              e,
              cardRootElements,
              onCardElementsPatch,
              agendaThemeHue,
              agendaHueStepDegProp,
            )
          )
            return;
          if (
            tryBulletListAddRowClick(
              cardTemplateId,
              element.id,
              e,
              cardRootElements,
              onCardElementsPatch,
              bulletListItemThemeHue,
              agendaHueStepDegProp,
            )
          )
            return;
          trySelectCardElement(e, element.id, isReadOnly, cardNodeSelected, onCardElementSelect);
        }}
      >
        {meshLayer}
        {showListRowReorder && listRowListIndex >= 0 ? (
          <>
            <AgendaRowDropIndicator rowIndex={listRowListIndex} />
            <AgendaRowDropIndicatorBottom rowIndex={listRowListIndex} />
            <AgendaRowReorderGrip rowId={element.id} />
          </>
        ) : null}
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
            agendaThemeHue={agendaThemeHue}
            agendaHueStepDeg={agendaHueStepDegProp}
            isDarkTheme={isDarkTheme}
            agendaRowIndexMap={agendaRowIndexMap}
            agendaTableHeaderStyle={agendaTableHeaderStyle}
            agendaDividersEnabled={agendaDividersEnabled}
            agendaResizeMetrics={agendaResizeMetrics}
            bulletListItemThemeHue={bulletListItemThemeHue}
            bulletListRowIndexMap={bulletListRowIndexMap}
            bulletListResizeMetrics={bulletListResizeMetrics}
            bulletListUniformItemFontSize={bulletListUniformItemFontSize}
          />
        ))}
        {showListRowDelete ? (
          <button
            type="button"
            aria-label="Remove row"
            data-dw-card-action=""
            className="absolute right-1 top-1/2 z-[5] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onPointerDown={stopCardNodeDrag}
            onMouseDown={stopCardNodeDrag}
            onClick={(e) => {
              e.stopPropagation();
              if (showAgendaRowDelete) {
                onCardElementsPatch!(removeAgendaRow(cardRootElements!, element.id));
              } else if (showBulletListRowDelete) {
                onCardElementsPatch!(removeBulletListRow(cardRootElements!, element.id));
              }
            }}
          >
            <X className="h-3 w-3" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
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

  if (element.kind === "decor" && isBulletListCubeId(element.id) && cardRootElements) {
    const rowId = element.id.replace(/-cube$/, "");
    const cubeRowIndex = bulletListRowIndexMap?.get(rowId) ?? 0;
    const cubeColor = resolveBulletCubeColor(
      cardRootElements,
      cubeRowIndex,
      element.style?.backgroundColor,
      bulletListItemThemeHue,
      agendaHueStepDegProp,
    );
    const cubeSize = parseBulletListBulletSize(element);
    const bulletShape = parseBulletListBulletShape(element);
    const borderRadius = resolveBulletListBulletBorderRadius(cubeSize, bulletShape);
    return (
      <div
        aria-hidden
        data-dw-card-element-id={element.id}
        style={{
          ...layoutCss,
          width: cubeSize,
          height: cubeSize,
          minWidth: cubeSize,
          flex: 0,
          alignSelf: "center",
          borderRadius,
          backgroundColor: cubeColor,
          boxSizing: "border-box",
          ...popStyle,
        }}
      />
    );
  }

  if (element.kind === "decor" && isSidebarAccentBar(element.id, cardTemplateId)) {
    const { heading } = getSidebarAccentRegions(cardRootElements);
    const barWidth = parseSidebarAccentBarWidth(element);
    const accentColor = heading?.textColor ?? SIDEBAR_ACCENT_COLOR_DEFAULT;
    return (
      <div
        aria-hidden
        data-dw-card-element-id={element.id}
        style={{
          ...layoutCss,
          width: barWidth,
          minWidth: barWidth,
          flex: 0,
          alignSelf: "stretch",
          borderRadius: 9999,
          backgroundColor: accentColor,
          boxSizing: "border-box",
          ...popStyle,
        }}
      />
    );
  }

  if (element.kind === "decor" && isElementFeatureAccentLine(element.id, cardTemplateId)) {
    return (
      <div
        data-dw-card-element-id={element.id}
        data-dw-card-element-kind="decor"
        style={{
          ...layoutCss,
          ...styleCss,
          ...popStyle,
          boxSizing: "border-box",
          position: needsRelative ? "relative" : undefined,
        }}
        className={cn(isSelected && !isReadOnly && "ring-2 ring-primary ring-inset")}
        onClick={(e) =>
          trySelectCardElement(e, element.id, isReadOnly, cardNodeSelected, onCardElementSelect)
        }
      >
        {meshLayer}
      </div>
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
    const displayRuns = isEditing
      ? (cardEditRuns ?? runs)
      : resolveGlobalVariablesInRuns(runs, globalProperties);
    const hasText = getPlainTextFromRuns(isEditing ? runs : displayRuns).trim().length > 0;
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
          ...dashboardEditablePointerStyle,
          fontSize: element.fontSize ?? 10,
          fontFamily: element.fontFamily,
          color: element.textColor ?? "#1e40af",
          padding: layoutCss.padding ?? "4px 10px",
          boxSizing: "border-box",
          position: needsRelative ? "relative" : dashboardEditablePointerStyle?.position,
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
              runs={displayRuns}
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
    const isBulletListTitleText =
      isBulletListCard(cardTemplateId) && element.id === BULLET_LIST_TITLE_ID;
    const isBulletListItemText =
      isBulletListCard(cardTemplateId) && element.id.endsWith(BULLET_LIST_TEXT_SUFFIX);
    const runs = element.richText ?? labelToRuns(element.text ?? "");
    const scaledRuns =
      isAgendaCard(cardTemplateId) && agendaResizeMetrics
        ? scaleAgendaRichTextRuns(runs, agendaResizeMetrics.scale)
        : isBulletListItemText && bulletListUniformItemFontSize != null
          ? normalizeBulletListItemDisplayRuns(runs)
          : runs;
    const displayRuns = isEditing
      ? scaledRuns
      : resolveGlobalVariablesInRuns(scaledRuns, globalProperties);
    const hasText = getPlainTextFromRuns(isEditing ? runs : displayRuns).trim().length > 0;
    const fillRemaining = effectiveLayout?.fillRemaining === true;
    if (!hasText && !isEditing && !fillRemaining) {
      return null;
    }
    const textNode = cardElementTextNode(node, element);
    if (isElementFeatureCard(cardTemplateId)) {
      const accent = resolveElementFeatureAccentColor(
        cardRootElements,
        node.lineColor,
        ELEMENT_FEATURE_ACCENT_DEFAULT,
      );
      if (element.id === ELEMENT_FEATURE_LABEL_ID) {
        textNode.textColor = accent;
        textNode.textGlowColor = element.textGlowColor ?? accent;
      }
      if (element.id === ELEMENT_FEATURE_TITLE_ID) {
        if (element.textGlowColor != null) textNode.textGlowColor = element.textGlowColor;
        if (element.textGlowBlur != null) textNode.textGlowBlur = element.textGlowBlur;
      }
      if (element.id === ELEMENT_FEATURE_NUMBER_ID) {
        textNode.textOutlineColor = accent;
        textNode.textGlowColor = accent;
      }
    }
    if (isAgendaCard(cardTemplateId) && agendaResizeMetrics) {
      textNode.fontSize = scaleAgendaFontSize(element.fontSize, agendaResizeMetrics.scale);
    }
    if (isBulletListTitleText && bulletListResizeMetrics) {
      textNode.fontSize = scaleBulletListTitleFontSize(element.fontSize, bulletListResizeMetrics);
    } else if (isBulletListItemText && bulletListUniformItemFontSize != null) {
      textNode.fontSize = bulletListUniformItemFontSize;
    }
    const rawTextPad = effectiveLayout?.padding ?? [8, 12];
    const textPad =
      isAgendaCard(cardTemplateId) && agendaResizeMetrics
        ? scaleAgendaPadding(rawTextPad, agendaResizeMetrics.scale)
        : rawTextPad;
    const isAgendaTimeCell =
      isAgendaCard(cardTemplateId) && isAgendaTimeCellId(element.id);
    const isAgendaSessionCell =
      isAgendaCard(cardTemplateId) &&
      (/^row-\d+-session$/.test(element.id) || element.id === AGENDA_SESSION_HEADER_ID);
    const socialTextStyle = resolveProfileSocialTextStyle(element.id, cardTemplateId);
    const agendaTimeStyle = resolveAgendaTimeTextStyle(element.id, cardTemplateId);
    const resolvedTextColor =
      resolveAgendaTableHeaderTextColor(
        element.id,
        cardTemplateId,
        element.textColor,
        isDarkTheme,
        agendaTableHeaderStyle,
      ) ?? element.textColor ?? "#0f172a";
    const elementFeatureNumberOverlay = elementFeatureNumberSlotStyle(
      element.id,
      cardTemplateId,
      element.layout,
    );
    const isElementFeatureWatermark = isElementFeatureWatermarkNumber(element.id, cardTemplateId);
    const isElementFeatureAlignable = isElementFeatureAlignableText(element.id, cardTemplateId);
    const elementFeatureWatermarkPointer = elementFeatureWatermarkPointerStyle(
      element.id,
      cardTemplateId,
    );
    const textStyle: React.CSSProperties = {
      ...(isElementFeatureWatermark
        ? { width: "100%", minWidth: 0, height: layoutCss.height ?? "100%" }
        : layoutCss),
      ...styleCss,
      ...popStyle,
      ...dashboardEditablePointerStyle,
      ...elementFeaturePointerStyle,
      ...elementFeatureWatermarkPointer,
      ...elementFeatureNumberOverlay,
      ...socialTextStyle,
      ...agendaTimeStyle,
      fontSize:
        isAgendaCard(cardTemplateId) && agendaResizeMetrics
          ? scaleAgendaFontSize(element.fontSize, agendaResizeMetrics.scale)
          : isBulletListTitleText && bulletListResizeMetrics
            ? scaleBulletListTitleFontSize(element.fontSize, bulletListResizeMetrics)
            : isBulletListItemText && bulletListUniformItemFontSize != null
              ? bulletListUniformItemFontSize
              : (element.fontSize ?? 12),
      fontWeight: element.fontWeight as React.CSSProperties["fontWeight"],
      fontFamily: element.fontFamily,
      color: resolvedTextColor,
      lineHeight: isElementFeatureWatermark
        ? (element.lineHeight ?? 1)
        : (element.lineHeight ?? 1.35),
      wordBreak: isAgendaTimeCell ? "keep-all" : "break-word",
      padding:
        isElementFeatureAlignable
          ? 0
          : cardLayoutToCss({ padding: textPad }).padding,
      boxSizing: "border-box",
      position: isElementFeatureWatermark
        ? "absolute"
        : needsRelative
          ? "relative"
          : elementFeaturePointerStyle?.position ?? dashboardEditablePointerStyle?.position,
      ...(isAgendaTimeCell
        ? {
            flexShrink: 0,
            minWidth: agendaResizeMetrics?.timeColWidthPx ?? layoutCss.minWidth,
            whiteSpace: "nowrap",
          }
        : {}),
      ...(isAgendaSessionCell ? { overflow: "hidden", minHeight: 0 } : {}),
      ...(isBulletListItemText
        ? {
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "stretch",
            flexShrink: 1,
            minWidth: 0,
          }
        : {}),
      ...(isBulletListTitleText
        ? {
            width: "100%",
            alignSelf: "stretch",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
          }
        : {}),
      ...(fillRemaining
        ? { overflow: isEditing ? "auto" : (layoutCss.overflow ?? "hidden") }
        : {}),
      ...(isElementFeatureWatermark
        ? {
            overflow: isEditing ? "visible" : "hidden",
            zIndex: isEditing || isSelected ? 3 : 0,
          }
        : {}),
    };
    const elementFeatureTextJustify =
      element.textJustify ?? textNode.textJustify ?? "left";

    return (
      <div
        style={textStyle}
        data-dw-card-element-id={element.id}
        data-dw-card-element-kind="text"
        data-dw-card-action={
          element.id === AGENDA_ADD_ROW_LABEL_ID ||
          isAgendaAddRowId(element.id) ||
          element.id === BULLET_LIST_ADD_ROW_LABEL_ID ||
          isBulletListAddRowId(element.id)
            ? ""
            : undefined
        }
        className={cn(
          isAgendaTimeCell ? "shrink-0" : "min-w-0",
          fillRemaining && "min-h-0",
          isSelected && !isReadOnly && "ring-2 ring-primary ring-inset",
          (element.id === AGENDA_ADD_ROW_LABEL_ID ||
            isAgendaAddRowId(element.id) ||
            element.id === BULLET_LIST_ADD_ROW_LABEL_ID ||
            isBulletListAddRowId(element.id)) &&
            "cursor-pointer",
        )}
        onPointerDown={
          element.id === AGENDA_ADD_ROW_LABEL_ID ||
          isAgendaAddRowId(element.id) ||
          element.id === BULLET_LIST_ADD_ROW_LABEL_ID ||
          isBulletListAddRowId(element.id)
            ? stopCardNodeDrag
            : undefined
        }
        onMouseDown={
          element.id === AGENDA_ADD_ROW_LABEL_ID ||
          isAgendaAddRowId(element.id) ||
          element.id === BULLET_LIST_ADD_ROW_LABEL_ID ||
          isBulletListAddRowId(element.id)
            ? stopCardNodeDrag
            : undefined
        }
        onClick={(e) => {
          if (
            tryAgendaAddRowClick(
              cardTemplateId,
              element.id,
              e,
              cardRootElements,
              onCardElementsPatch,
              agendaThemeHue,
              agendaHueStepDegProp,
            )
          )
            return;
          if (
            tryBulletListAddRowClick(
              cardTemplateId,
              element.id,
              e,
              cardRootElements,
              onCardElementsPatch,
              bulletListItemThemeHue,
              agendaHueStepDegProp,
            )
          )
            return;
          trySelectCardElement(e, element.id, isReadOnly, cardNodeSelected, onCardElementSelect);
        }}
      >
        {meshLayer}
        <div
          className={cn(
            "relative z-[1]",
            isAgendaTimeCell ? "shrink-0 whitespace-nowrap" : "min-w-0",
            isElementFeatureAlignable &&
              cn(
                "w-full min-w-0",
                getTextJustifyClass(elementFeatureTextJustify),
                isElementFeatureWatermark && "break-words whitespace-pre-wrap",
              ),
            isBulletListItemText && "flex min-w-0 flex-1 flex-col justify-start",
            isBulletListTitleText && "w-full min-w-0 flex-1",
            fillRemaining && "min-h-0 flex-1 overflow-hidden",
          )}
        >
        {isEditing ? (
          <TextboxRichEditor
            node={textNode}
            runs={cardEditRuns ?? displayRuns}
            onSubmit={(plain, nextRuns) => onCardElementRichSubmit?.(element.id, plain, nextRuns)}
            onKeyDown={onCardElementKeyDown ?? (() => {})}
          />
        ) : (
          <TextboxRichDisplay
            node={textNode}
            runs={displayRuns}
            singleLine={isAgendaTimeCell}
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
  const staggerTimingOpts: CardSlideStaggerTimingOptions = useMemo(
    () => ({
      templateId: resolvedTemplateId,
      agendaDividersEnabled: nodeAny.agendaDividersEnabled !== false,
      isReadOnly: Boolean(isReadOnly),
      cardNodeSelected: Boolean(cardNodeSelected),
    }),
    [resolvedTemplateId, nodeAny.agendaDividersEnabled, isReadOnly, cardNodeSelected],
  );
  const staggerTimingParticipants = useMemo(
    () => flattenCardElementsForSlideStaggerTiming(cardRoot, staggerTimingOpts),
    [cardRoot, staggerTimingOpts],
  );
  const staggerMap = useMemo(() => {
    const m = new Map<string, number>();
    staggerTimingParticipants.forEach((el, i) => m.set(el.id, i));
    return m;
  }, [staggerTimingParticipants]);

  const shellExitStaggerSegIdx = useMemo(
    () => cardShellExitStaggerSegmentIndex(staggerTimingParticipants, resolvedTemplateId),
    [staggerTimingParticipants, resolvedTemplateId],
  );
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

  const slideShellCardPopStyle = useMemo(() => {
    if (!presentationCardSlideStagger) return undefined;
    const cfg = presentationCardSlideStagger;
    if (!cfg.exit && !cfg.shellEntrance) return undefined;
    if (cfg.exit) {
      return elementPopStyle(shellExitStaggerSegIdx, popAnimIn, popAnimOut, cfg);
    }
    return elementPopStyle(0, popAnimIn, popAnimOut, { ...cfg, exit: false });
  }, [
    presentationCardSlideStagger,
    shellExitStaggerSegIdx,
    popAnimIn,
    popAnimOut,
  ]);

  const isDiagonalSplitCard = isProfileDiagonalSplitCard(resolvedTemplateId);
  const cardShellInsetPx = needsGradientBorder ? borderWidthNum : 0;

  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";
  const themesMenuHueStepDeg = useThemeMenuHueStepDeg();
  const globalMultiHue = useThemeMultiHueLayout();
  const agendaThemeHue = agendaRowThemeHueEnabled(nodeAny.agendaRowThemeHue, globalMultiHue);
  const bulletListThemeHue = bulletListItemThemeHueEnabled(
    nodeAny.bulletListItemThemeHue,
    globalMultiHue,
  );
  const agendaHueStep = themesMenuHueStepDeg;
  const agendaDividersEnabled = nodeAny.agendaDividersEnabled !== false;
  const agendaTableHeaderStyle = useMemo(
    () => (cardRoot ? getAgendaRegions(cardRoot).tableHeader?.style : undefined),
    [cardRoot],
  );
  const agendaRowIndexMap = useMemo(() => {
    if (!isAgendaCard(resolvedTemplateId) || !cardRoot) return undefined;
    const m = new Map<string, number>();
    getAgendaRows(cardRoot).forEach((r, i) => m.set(r.id, i));
    return m;
  }, [cardRoot, resolvedTemplateId]);
  const bulletListRowIndexMap = useMemo(() => {
    if (!isBulletListCard(resolvedTemplateId) || !cardRoot) return undefined;
    const m = new Map<string, number>();
    getBulletListRows(cardRoot).forEach((r, i) => m.set(r.id, i));
    return m;
  }, [cardRoot, resolvedTemplateId]);
  const agendaResizeMetrics = useMemo(() => {
    if (!isAgendaCard(resolvedTemplateId)) return null;
    return computeAgendaResizeMetrics(w, h, cardShellInsetPx);
  }, [resolvedTemplateId, w, h, cardShellInsetPx]);
  const bulletListResizeMetrics = useMemo(() => {
    if (!isBulletListCard(resolvedTemplateId)) return null;
    return computeBulletListResizeMetrics(w, h, cardShellInsetPx);
  }, [resolvedTemplateId, w, h, cardShellInsetPx]);
  const bulletListUniformItemFontSize = useMemo(() => {
    if (!isBulletListCard(resolvedTemplateId) || !cardRoot) return undefined;
    return resolveBulletListItemFontSizeForRender(cardRoot, bulletListResizeMetrics);
  }, [cardRoot, resolvedTemplateId, bulletListResizeMetrics]);

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
        agendaThemeHue={agendaThemeHue}
        agendaHueStepDeg={agendaHueStep}
        isDarkTheme={isDarkTheme}
        agendaRowIndexMap={agendaRowIndexMap}
        agendaTableHeaderStyle={agendaTableHeaderStyle}
        agendaDividersEnabled={agendaDividersEnabled}
        agendaResizeMetrics={agendaResizeMetrics}
        bulletListItemThemeHue={bulletListThemeHue}
        bulletListRowIndexMap={bulletListRowIndexMap}
        bulletListResizeMetrics={bulletListResizeMetrics}
        bulletListUniformItemFontSize={bulletListUniformItemFontSize}
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
    cardShellBorder,
    cardShellInsetPx,
    innerRadiusStr,
    staggerMap,
    agendaThemeHue,
    bulletListThemeHue,
    agendaHueStep,
    isDarkTheme,
    agendaRowIndexMap,
    bulletListRowIndexMap,
    agendaTableHeaderStyle,
    agendaDividersEnabled,
    agendaResizeMetrics,
    bulletListResizeMetrics,
    bulletListUniformItemFontSize,
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
        style={{
          ...(shellBg.includes("gradient(")
            ? { backgroundImage: shellBg, backgroundColor: "transparent" }
            : { backgroundImage: "none", backgroundColor: shellBg }),
          ...shellTransition,
        }}
      />
    ) : null;

  const agendaRowIds = useMemo(() => {
    if (!isAgendaCard(resolvedTemplateId) || !cardRoot) return [] as string[];
    return getAgendaRows(cardRoot).map((r) => r.id);
  }, [cardRoot, resolvedTemplateId]);
  const bulletListRowIds = useMemo(() => {
    if (!isBulletListCard(resolvedTemplateId) || !cardRoot) return [] as string[];
    return getBulletListRows(cardRoot).map((r) => r.id);
  }, [cardRoot, resolvedTemplateId]);
  const listRowReorderEnabled =
    !!cardNodeSelected &&
    !isReadOnly &&
    !!cardRoot &&
    !!onCardElementsPatch &&
    ((isAgendaCard(resolvedTemplateId) && agendaRowIds.length > 1) ||
      (isBulletListCard(resolvedTemplateId) && bulletListRowIds.length > 1));

  const cardContentInner = (
    <div className="relative z-[1] flex h-full min-h-0 w-full min-w-0 flex-col">
      {innerTree}
    </div>
  );

  const cardContentLayer =
    listRowReorderEnabled && isAgendaCard(resolvedTemplateId) ? (
      <AgendaRowReorderProvider
        enabled
        rowIds={agendaRowIds}
        cardRootElements={cardRoot}
        onPatch={onCardElementsPatch}
        onDragSessionChange={onHeroBoundaryDragSessionChange}
      >
        {cardContentInner}
      </AgendaRowReorderProvider>
    ) : listRowReorderEnabled && isBulletListCard(resolvedTemplateId) ? (
      <BulletListRowReorderProvider
        enabled
        rowIds={bulletListRowIds}
        cardRootElements={cardRoot}
        onPatch={onCardElementsPatch}
        onDragSessionChange={onHeroBoundaryDragSessionChange}
      >
        {cardContentInner}
      </BulletListRowReorderProvider>
    ) : (
      cardContentInner
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
            backgroundImage: borderGradientBackground,
            backgroundColor: styles.borderColors?.[0] ?? "transparent",
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
      slideShellExitStyle={slideShellCardPopStyle}
    >
      {popKeyframes ? <style>{popKeyframes}</style> : null}
      {maskedCard}
    </ShapeWrapper>
  );
}
