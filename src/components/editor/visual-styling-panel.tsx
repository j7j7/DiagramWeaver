"use client";

import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import type { NodeSize } from "@/lib/types";
import { VisualStyling, VISUAL_STYLES, getPredefinedVisualStyle, findClosestPredefinedStyle } from "@/lib/visual-styling";
import {
  createRandomMeshGradientPoints,
  MESH_GRADIENT_INITIAL_BASE_COLOR,
  normalizeMeshGradientPoints,
} from "@/lib/mesh-gradient";
import {
  HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC,
  HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR,
  HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY,
  HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC,
  highlightGlowApproxHaloPx,
} from "@/lib/highlight-anim";
import { ChevronDown, Palette, RotateCcw, Shuffle, X } from "lucide-react";
import { CARD_ICON_PLACEMENTS, CARD_ICON_SIZE_MODES } from "@/lib/card-icon-layout";
import type { CardIconPlacement, CardIconSizeMode } from "@/lib/card-types";
import { GradientAnglePicker } from "./gradient-angle-picker";
import {
  ICON_BEVEL_DEFAULT_DEPTH,
  ICON_BEVEL_DEFAULT_GRID_OFFSET,
  ICON_BEVEL_DEFAULT_ROTATION,
  ICON_BEVEL_MAX_DEPTH,
  ICON_BEVEL_MAX_GRID_OFFSET,
  ICON_BEVEL_MIN_DEPTH,
  ICON_BEVEL_MIN_GRID_OFFSET,
  normalizeIconBevelDepth,
  normalizeIconBevelGridOffset,
  normalizeIconBevelRotation,
  buildIconBevelSampleNode,
  resolveIconBevelSampleSrcAsync,
  sampleIconPlateColorFromUrl,
  type IconBevelSampleNode,
} from "@/lib/icon-bevel";
import { Slider } from "@/components/ui/slider";
import Draggable from "react-draggable";
import { RECORDING_SURFACE_VISUAL_STYLING } from "@/lib/interaction-recording-surfaces";
import { emitDwOverlayClose, emitDwOverlayOpen } from "@/lib/interaction-recording-bridge";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DIAGRAM_THEME_HUE_STEP_DEG } from "@/lib/theme-manager";
import { COMMON_FONT_FAMILIES } from "@/lib/text-styling";
import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import { CardPropertiesPanel } from "./card-properties-panel";
import { CardFillStyleControls } from "./card-fill-style-controls";
import { CardBorderStyleControls } from "./card-border-style-controls";
import { BorderPropertiesPanel } from "./border-properties-panel";
import { cardTemplateHasDedicatedPropertiesPanel } from "@/lib/card-compact-horizontal";
import {
  FRAMED_HEADING_TEMPLATE_ID,
  getFramedHeadingRegions,
  updateFramedHeadingElementStyle,
  FRAMED_HEADING_TAB_ID,
} from "@/lib/card-framed-heading";
import type { NodeBorderSpec } from "@/lib/border-types";

/** Native steppers steal horizontal space on short inputs and clip fractional values (Chrome/Safari/Firefox). */
const NUMBER_INPUT_NO_SPINNER =
  "[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** Spatial halo radius (blur size), distinct from RGBA opacity on the glow colour picker. */
function HighlightGlowStrengthSlider({
  intensity,
  onChange,
  className,
}: {
  intensity: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY));
  const approxPx = highlightGlowApproxHaloPx(v);
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">Glow spread (~size)</Label>
      <div className="flex items-center gap-3 pr-1">
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[v]}
          onValueChange={([nv]) => onChange(nv)}
          className="flex-1"
        />
        <span className="w-14 tabular-nums text-xs text-muted-foreground text-right">~{approxPx}px</span>
      </div>
    </div>
  );
}

/** Free-typing ° step: avoids `<input type="number" min={1}>` blocking backspace/clear while editing. */
function TimelineBarHueStepInput({
  committedDeg,
  onCommit,
  className,
}: {
  committedDeg: number | undefined;
  onCommit: (value: number | null) => void;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");
  const committedStr =
    typeof committedDeg === "number" && Number.isFinite(committedDeg) ? String(committedDeg) : "";

  useEffect(() => {
    if (!focused) setDraft(committedStr);
  }, [committedStr, focused]);

  const shown = focused ? draft : committedStr;

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={String(DIAGRAM_THEME_HUE_STEP_DEG)}
      value={shown}
      onFocus={() => {
        setFocused(true);
        setDraft(committedStr);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        setFocused(false);
        const t = e.currentTarget.value.trim();
        if (t === "") {
          onCommit(null);
          setDraft("");
          return;
        }
        const n = parseFloat(t.replace(",", "."));
        if (!Number.isFinite(n)) {
          onCommit(null);
          setDraft("");
          return;
        }
        const clamped = Math.min(180, Math.max(1, n));
        onCommit(clamped);
        setDraft(String(clamped));
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
}

function HighlightAnimEffectControls({
  styling,
  handlePropertyChange,
  onStylingChange,
}: {
  styling: Partial<VisualStyling>;
  handlePropertyChange: (property: keyof VisualStyling, value: unknown, immediate?: boolean) => void;
  onStylingChange: (styling: Partial<VisualStyling>) => void;
}) {
  const triSelect: "off" | "constant" | "pulse" = !styling.highlightAnim
    ? "off"
    : styling.highlightAnimMode === "constant"
      ? "constant"
      : "pulse"; /* legacy omit / undefined / 'pulse' */
  const committedDurStr = String(styling.highlightAnimDurationSec ?? HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC);
  const committedIntStr = String(styling.highlightAnimIntervalSec ?? HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC);
  const [durFocused, setDurFocused] = useState(false);
  const [intFocused, setIntFocused] = useState(false);
  const [durDraft, setDurDraft] = useState(committedDurStr);
  const [intDraft, setIntDraft] = useState(committedIntStr);

  const durDisplay = durFocused ? durDraft : committedDurStr;
  const intDisplay = intFocused ? intDraft : committedIntStr;

  const commitDuration = useCallback(() => {
    const n = parseFloat(durDraft);
    let v: number;
    if (!Number.isFinite(n) || durDraft.trim() === "") {
      v = HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC;
    } else {
      v = Math.min(120, Math.max(0.05, n));
    }
    setDurDraft(String(v));
    handlePropertyChange("highlightAnimDurationSec", v, true);
  }, [durDraft, handlePropertyChange]);

  const commitInterval = useCallback(() => {
    const n = parseFloat(intDraft);
    let v: number;
    if (!Number.isFinite(n) || intDraft.trim() === "") {
      v = HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC;
    } else {
      v = Math.min(600, Math.max(0, n));
    }
    setIntDraft(String(v));
    handlePropertyChange("highlightAnimIntervalSec", v, true);
  }, [intDraft, handlePropertyChange]);

  return (
    <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Glow</Label>
          <Select
            value={triSelect}
            onValueChange={(v) => {
              if (v === "off") {
                onStylingChange({ highlightAnim: false, highlightAnimMode: undefined });
              } else if (v === "constant") {
                onStylingChange({
                  highlightAnim: true,
                  highlightAnimMode: "constant",
                  highlightAnimGlowColor:
                    styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR,
                  highlightAnimGlowIntensity:
                    styling.highlightAnimGlowIntensity ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY,
                });
              } else {
                /* Explicit `'pulse'` so merges overwrite persisted `'constant'` (undefined strips in some spreads). */
                onStylingChange({
                  highlightAnim: true,
                  highlightAnimMode: "pulse",
                  highlightAnimDurationSec:
                    styling.highlightAnimDurationSec ?? HIGHLIGHT_ANIM_DEFAULT_DURATION_SEC,
                  highlightAnimIntervalSec:
                    styling.highlightAnimIntervalSec ?? HIGHLIGHT_ANIM_DEFAULT_INTERVAL_SEC,
                  highlightAnimGlowColor:
                    styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR,
                  highlightAnimGlowIntensity:
                    styling.highlightAnimGlowIntensity ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY,
                });
              }
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Glow" />
            </SelectTrigger>
            <SelectContent className="z-[70]">
              <SelectItem value="off" className="text-sm">
                Off
              </SelectItem>
              <SelectItem value="constant" className="text-sm">
                Constant glow
              </SelectItem>
              <SelectItem value="pulse" className="text-sm">
                Pulse (animate)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(triSelect === "constant" || triSelect === "pulse") && (
          <div className={cn(triSelect === "pulse" && "grid grid-cols-2 gap-2")}>
            {triSelect === "pulse" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Duration (s)</Label>
                  <Input
                    type="number"
                    min={0.05}
                    max={120}
                    step={0.1}
                    value={durDisplay}
                    onChange={(e) => setDurDraft(e.target.value)}
                    onFocus={() => {
                      setDurFocused(true);
                      setDurDraft(committedDurStr);
                    }}
                    onBlur={() => {
                      commitDuration();
                      setDurFocused(false);
                    }}
                    className={cn(NUMBER_INPUT_NO_SPINNER, "h-9 text-sm")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Interval (s)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    step={0.1}
                    value={intDisplay}
                    onChange={(e) => setIntDraft(e.target.value)}
                    onFocus={() => {
                      setIntFocused(true);
                      setIntDraft(committedIntStr);
                    }}
                    onBlur={() => {
                      commitInterval();
                      setIntFocused(false);
                    }}
                    className={cn(NUMBER_INPUT_NO_SPINNER, "h-9 text-sm")}
                  />
                </div>
              </>
            )}
            <div className={cn("space-y-3", triSelect === "pulse" && "col-span-2")}>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Glow color</Label>
                <ColorPicker
                  value={styling.highlightAnimGlowColor ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR}
                  onChange={(value) => handlePropertyChange("highlightAnimGlowColor", value)}
                  placeholder={HIGHLIGHT_ANIM_DEFAULT_GLOW_COLOR}
                  showAlpha={true}
                  allowTransparent={true}
                />
              </div>
              <HighlightGlowStrengthSlider
                intensity={styling.highlightAnimGlowIntensity ?? HIGHLIGHT_ANIM_DEFAULT_GLOW_INTENSITY}
                onChange={(nv) => handlePropertyChange("highlightAnimGlowIntensity", nv, true)}
              />
            </div>
          </div>
        )}
      </div>
  );
}

function StylingAccordionSection(props: {
  title: string;
  dotClassName: string;
  outerClassName: string;
  defaultOpen?: boolean;
  triggerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { title, dotClassName, outerClassName, defaultOpen = true, triggerExtra, children } = props;
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn(
      "group min-w-0 rounded-md border",
      outerClassName,
      "dark:border-border dark:bg-background",
    )}>
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-muted/40"
      >
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90"
          aria-hidden
        />
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotClassName)} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {triggerExtra}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 overflow-hidden border-t border-border/70 px-3 pb-3 pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface VisualStylingPanelProps {
  styling: Partial<VisualStyling>;
  onStylingChange: (styling: Partial<VisualStyling>) => void;
  onReset?: () => void;
  onClose?: () => void;
  selectedItemIds?: Set<string>; // Multi-selected items
  tag?: string;
  tagPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  onTagChange?: (tag: string) => void;
  onTagPositionChange?: (position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => void;
  /** When true, shows Icon Color control (Lucide icons only) */
  isLucideIcon?: boolean;
  /** Icon/resource/emoji tile — opacity, size, remove background (see `isDiagramIconTileNodeType`). */
  showIconTileStyling?: boolean;
  /** Card icon-slot with a dropped icon — show position control in Icon Styling. */
  showCardIconPlacement?: boolean;
  /** When true, shows 3D bevel + rotation (icon/resource/emoji tiles). */
  showIconBevel?: boolean;
  /** Node fields for raster plate-colour sampling (catalog lookup by type when needed). */
  iconBevelSampleNode?: IconBevelSampleNode;
  /** When true, shows Remove background toggle (resource items and Lucide icons) */
  showRemoveBackground?: boolean;
  noIconBackground?: boolean;
  /** When true, shows full styling (Preset, Border, Background, Effects, Tags) - shapes and text nodes */
  showFullStyling?: boolean;
  /** When true, hides Size control - shapes */
  isShape?: boolean;
  /** When true, shows corner radius control (rounded-rectangle & progress-bar) */
  isRoundedRectangle?: boolean;
  /** When true, Background may include mesh gradient (simple closed shapes; excludes charts, pyramid, timelines, etc.) */
  supportsMeshGradientBackground?: boolean;
  /** When true, shows progress fill/track controls */
  isProgressBar?: boolean;
  /** When true, shows segmented timeline bar layout controls */
  isTimelineBar?: boolean;
  /** When true, shows segmented rectangle layout controls */
  isSegmentedRectangle?: boolean;
  /** When true, shows segmented pyramid layout controls */
  isPyramid?: boolean;
  /** When true, shows heading strip color (text-box-heading only) */
  isTextBoxHeading?: boolean;
  /** When true, shows profile card region styling (top fill, text segments). */
  isCardProfile?: boolean;
  /** When true, selected item is any card template. */
  isCardNode?: boolean;
  cardTemplateId?: string;
  cardElements?: CardElementData;
  onCardElementsChange?: (elements: CardElementData) => void;
  agendaRowThemeHue?: boolean;
  onAgendaRowThemeHueChange?: (enabled: boolean) => void;
  agendaDividersEnabled?: boolean;
  onAgendaDividersEnabledChange?: (enabled: boolean) => void;
  bulletListItemThemeHue?: boolean;
  onBulletListItemThemeHueChange?: (enabled: boolean) => void;
  bulletListUseItemIcons?: boolean;
  onBulletListUseItemIconsChange?: (enabled: boolean) => void;
  /** Selected slide border template node. */
  isBorderNode?: boolean;
  borderTemplateId?: string;
  border?: NodeBorderSpec;
  onBorderChange?: (patch: Partial<NodeBorderSpec>) => void;
  footer?: React.ReactNode;
}

function IconBevelMatchColorPreview({
  enabled,
  sampleNode,
  blockColor,
  onPickedColor,
}: {
  enabled: boolean;
  sampleNode?: IconBevelSampleNode;
  blockColor?: string;
  onPickedColor: (hex: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [picked, setPicked] = useState<string | undefined>(blockColor);
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
  const enabledRef = useRef(enabled);
  const sampleGenRef = useRef(0);

  const runSample = useCallback(() => {
    if (!enabledRef.current) {
      setStatus("idle");
      return;
    }
    const gen = ++sampleGenRef.current;
    setStatus("loading");
    void resolveIconBevelSampleSrcAsync(buildIconBevelSampleNode(sampleNode)).then((url) => {
      if (gen !== sampleGenRef.current || !enabledRef.current) return;
      setResolvedSrc(url);
      if (!url) {
        setStatus("fail");
        setPicked(undefined);
        return;
      }
      return sampleIconPlateColorFromUrl(url);
    }).then((hex) => {
      if (gen !== sampleGenRef.current || !enabledRef.current) return;
      if (hex) {
        setPicked(hex);
        setStatus("ok");
        onPickedColor(hex);
      } else {
        setStatus("fail");
      }
    });
  }, [sampleNode, onPickedColor]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      sampleGenRef.current += 1;
      setStatus("idle");
      setResolvedSrc(undefined);
      return;
    }
    runSample();
  }, [enabled, sampleNode?.type, sampleNode?.provider, sampleNode?.category, sampleNode?.file, sampleNode?.imageUrl, runSample]);

  useEffect(() => {
    setPicked(blockColor);
  }, [blockColor]);

  if (!enabled) return null;

  const displayHex = picked ?? blockColor;

  return (
    <div className="space-y-2 rounded-md border border-border bg-background/90 p-2.5">
      <Label className="text-xs font-medium text-foreground">Picked icon colour</Label>
      <div className="flex items-center gap-3">
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md border border-border bg-muted/40 object-contain"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-1 text-center text-[10px] leading-tight text-muted-foreground">
            {status === "loading" ? "…" : "No icon path"}
          </div>
        )}
        <div
          className="h-14 w-14 shrink-0 rounded-md border border-border shadow-inner"
          style={{ background: displayHex ?? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px" }}
          title={displayHex ?? "No colour sampled"}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-mono text-sm tabular-nums text-foreground">{displayHex ?? "—"}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {status === "loading" && "Sampling from icon image…"}
            {status === "ok" && "Saved to bevel block colour"}
            {status === "fail" &&
              (resolvedSrc
                ? "Could not read a plate colour — try Re-sample"
                : sampleNode?.type
                  ? sampleNode.type.startsWith("generic.icon.") || sampleNode.type.startsWith("generic.emoji.")
                    ? "Lucide/emoji icons have no raster plate to sample — use Block color"
                    : "Could not resolve icon file from type (catalog)"
                  : "No icon path — missing type or provider/category/file")}
            {status === "idle" && resolvedSrc && "Waiting…"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={runSample}
            disabled={status === "loading"}
          >
            Re-sample
          </Button>
        </div>
      </div>
      {resolvedSrc ? (
        <p className="truncate text-[10px] text-muted-foreground" title={resolvedSrc}>
          {resolvedSrc}
        </p>
      ) : sampleNode?.type ? (
        <p className="truncate text-[10px] text-muted-foreground" title={sampleNode.type}>
          {sampleNode.type}
        </p>
      ) : null}
    </div>
  );
}

export const VisualStylingPanel = React.memo(function VisualStylingPanel({ styling, onStylingChange, onReset, onClose, selectedItemIds, tag, tagPosition, onTagChange, onTagPositionChange, isLucideIcon = false, showIconTileStyling = false, showCardIconPlacement = false, showIconBevel = false, iconBevelSampleNode, showRemoveBackground = false, noIconBackground = false, showFullStyling = true, isShape = false, isRoundedRectangle = false, supportsMeshGradientBackground = false, isProgressBar = false, isTimelineBar = false, isSegmentedRectangle = false, isPyramid = false, isTextBoxHeading = false, isCardProfile = false, isCardNode = false, cardTemplateId, cardElements, onCardElementsChange, agendaRowThemeHue, onAgendaRowThemeHueChange, agendaDividersEnabled, onAgendaDividersEnabledChange, bulletListItemThemeHue, onBulletListItemThemeHueChange, bulletListUseItemIcons, onBulletListUseItemIconsChange, isBorderNode = false, borderTemplateId, border, onBorderChange, footer }: VisualStylingPanelProps) {
  const [position, setPosition] = useState({ x: 200, y: 100 });
  const [isMounted, setIsMounted] = useState(false);
  const nodeRef = useRef(null);
  const [pyramidTierOutlineFocused, setPyramidTierOutlineFocused] = useState(false);
  const [pyramidTierOutlineDraft, setPyramidTierOutlineDraft] = useState("");
  const [pyramidTierGapFocused, setPyramidTierGapFocused] = useState(false);
  const [pyramidTierGapDraft, setPyramidTierGapDraft] = useState("");
  const [borderWidthFocused, setBorderWidthFocused] = useState(false);
  const [borderWidthDraft, setBorderWidthDraft] = useState("");
  const [segmentedRectangleDividerWidthFocused, setSegmentedRectangleDividerWidthFocused] = useState(false);
  const [segmentedRectangleDividerWidthDraft, setSegmentedRectangleDividerWidthDraft] = useState("");
  const [segmentedRectangleSegmentGapFocused, setSegmentedRectangleSegmentGapFocused] = useState(false);
  const [segmentedRectangleSegmentGapDraft, setSegmentedRectangleSegmentGapDraft] = useState("");

  useEffect(() => {
    emitDwOverlayOpen({ surface: RECORDING_SURFACE_VISUAL_STYLING });
    return () => emitDwOverlayClose({ surface: RECORDING_SURFACE_VISUAL_STYLING });
  }, []);

  useEffect(() => {
    if (!borderWidthFocused) {
      const bw = styling.borderWidth;
      const shown = typeof bw === "number" && Number.isFinite(bw) ? bw : 2;
      setBorderWidthDraft(String(shown));
    }
  }, [styling.borderWidth, borderWidthFocused]);

  useEffect(() => {
    if (!pyramidTierOutlineFocused) {
      const v = styling.pyramidSectionBorderWidth;
      const shown = typeof v === "number" && Number.isFinite(v) ? v : 1;
      setPyramidTierOutlineDraft(String(shown));
    }
  }, [styling.pyramidSectionBorderWidth, pyramidTierOutlineFocused]);

  useEffect(() => {
    if (!pyramidTierGapFocused) {
      const v = styling.pyramidSegmentGap;
      const shown = typeof v === "number" && Number.isFinite(v) ? v : 2;
      setPyramidTierGapDraft(String(shown));
    }
  }, [styling.pyramidSegmentGap, pyramidTierGapFocused]);

  useEffect(() => {
    if (!segmentedRectangleDividerWidthFocused) {
      const v = styling.segmentedRectangleDividerWidth;
      const shown = typeof v === "number" && Number.isFinite(v) ? v : 1.5;
      setSegmentedRectangleDividerWidthDraft(String(shown));
    }
  }, [styling.segmentedRectangleDividerWidth, segmentedRectangleDividerWidthFocused]);

  useEffect(() => {
    if (!segmentedRectangleSegmentGapFocused) {
      const v = styling.segmentedRectangleSegmentGap;
      const shown = typeof v === "number" && Number.isFinite(v) ? v : 0;
      setSegmentedRectangleSegmentGapDraft(String(shown));
    }
  }, [styling.segmentedRectangleSegmentGap, segmentedRectangleSegmentGapFocused]);

  useEffect(() => {
    setIsMounted(true);

    // Load position from localStorage
    if (typeof window !== "undefined") {
      const savedPosition = localStorage.getItem("dw:visual-styling:position");
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          setPosition(parsed);
        } catch (e) {
          console.error("Failed to load visual styling panel position", e);
        }
      }
    }
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isMounted) {
      try {
        localStorage.setItem('dw:visual-styling:position', JSON.stringify(position));
      } catch (e) {
        console.error('Failed to save visual styling panel position', e);
      }
    }
  }, [position, isMounted]);

  // Debounced property change to prevent excessive updates during color dragging
  const propertyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handlePropertyChange = useCallback((property: keyof VisualStyling, value: any, immediate = false) => {
    // Clear existing timeout
    if (propertyTimeoutRef.current) {
      clearTimeout(propertyTimeoutRef.current);
    }
    
    // Only update the specific property that changed
    const updatedStyling = { [property]: value };
    
    // If multiple items are selected, always use immediate updates to avoid debouncing conflicts
    const isMultiSelect = selectedItemIds && selectedItemIds.size > 1;
    
    if (immediate || isMultiSelect) {
      // Immediate update for final values or multi-select
      onStylingChange(updatedStyling);
    } else {
      // Debounced update during dragging for single select
      propertyTimeoutRef.current = setTimeout(() => {
        onStylingChange(updatedStyling);
      }, 150);
    }
  }, [onStylingChange, selectedItemIds]);

  const iconBevelMatchSampleGenRef = useRef(0);
  const iconBevelSupportsRasterMatch = useMemo(() => {
    const t = iconBevelSampleNode?.type?.trim() ?? "";
    return !t.startsWith("generic.emoji.") && !t.startsWith("generic.icon.");
  }, [iconBevelSampleNode?.type]);
  const handleIconBevelPickedColor = useCallback(
    (hex: string) => handlePropertyChange("iconBevelBlockColor", hex, true),
    [handlePropertyChange],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (propertyTimeoutRef.current) {
        clearTimeout(propertyTimeoutRef.current);
      }
    };
  }, []);

  const handlePredefinedStyleChange = (styleKey: keyof typeof VISUAL_STYLES) => {
    const predefinedStyle = getPredefinedVisualStyle(styleKey);
    onStylingChange(predefinedStyle);
  };

  const handleBackgroundStyleSelect = (value: string) => {
    if (value === "frosted") {
      onStylingChange({
        backgroundStyle: "frosted" as const,
        frostedDiffusion: styling.frostedDiffusion ?? 0.45,
        frostedTransparency: styling.frostedTransparency ?? 0.55,
        frostedPerlinNoise: styling.frostedPerlinNoise ?? 0,
        backgroundColor: (styling.backgroundColor as string | undefined) || "#f3f4f6",
      });
    } else if (value === "mesh_gradient") {
      const existing = styling.meshGradientPoints;
      const isFirstMeshSetup = !existing || existing.length !== 3;
      const base = isFirstMeshSetup
        ? MESH_GRADIENT_INITIAL_BASE_COLOR
        : ((styling.backgroundColor as string | undefined) || MESH_GRADIENT_INITIAL_BASE_COLOR);
      const points =
        existing && existing.length === 3 ? existing : createRandomMeshGradientPoints(base);
      onStylingChange({
        backgroundStyle: "mesh_gradient" as const,
        meshGradientPoints: points,
        backgroundColor: base,
      });
    } else if (value === "none") {
      onStylingChange({ backgroundStyle: "none" as const });
    } else {
      handlePropertyChange("backgroundStyle", value as "solid" | "gradient", true);
    }
  };

  const handleRandomizeMeshGradient = useCallback(() => {
    const base =
      (styling.backgroundColor as string | undefined) || MESH_GRADIENT_INITIAL_BASE_COLOR;
    handlePropertyChange("meshGradientPoints", createRandomMeshGradientPoints(base), true);
  }, [styling.backgroundColor, handlePropertyChange]);

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  // Find the closest predefined style for the current styling
  const currentPredefinedStyle = findClosestPredefinedStyle(styling as VisualStyling);

  /** Progress bar, timeline bar, pyramid, and all cards: accordion sections start collapsed */
  const accordionDefaultOpen =
    !isProgressBar && !isTimelineBar && !isSegmentedRectangle && !isPyramid && !isCardNode;
  const accordionRemountKey = `${[...(selectedItemIds ?? new Set<string>())].sort().join("|")}-${isProgressBar ? "pb" : isTimelineBar ? "tb" : isSegmentedRectangle ? "sr" : isPyramid ? "py" : isCardNode ? "card" : "std"}`;

  const isFramedHeadingCard = cardTemplateId === FRAMED_HEADING_TEMPLATE_ID;
  const framedHeadingTab = useMemo(() => {
    if (!isFramedHeadingCard || !cardElements) return null;
    return getFramedHeadingRegions(cardElements).headingTab;
  }, [isFramedHeadingCard, cardElements]);

  const patchFramedHeadingTabStyle = useCallback(
    (style: CardElementStyle) => {
      if (!cardElements || !onCardElementsChange) return;
      onCardElementsChange(
        updateFramedHeadingElementStyle(cardElements, FRAMED_HEADING_TAB_ID, style),
      );
    },
    [cardElements, onCardElementsChange],
  );

  return (
    <Draggable
      handle=".dw-visual-styling-drag-handle"
      nodeRef={nodeRef}
      position={position}
      onStop={(e, data) => {
        setPosition({ x: data.x, y: data.y });
      }}
    >
      <div
        ref={nodeRef}
        data-dw-recording-surface={RECORDING_SURFACE_VISUAL_STYLING}
        className={cn(
          "fixed top-20 left-20 z-50 flex max-h-[min(75vh,calc(100vh-4rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg",
          showFullStyling ? "w-[640px]" : "w-[512px]",
          "max-w-[calc(100vw-2rem)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
          <div className="dw-visual-styling-drag-handle flex min-w-0 flex-1 cursor-move items-center gap-2 select-none">
            <Palette className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="truncate text-sm font-semibold text-foreground">
              {showIconTileStyling || isLucideIcon ? "Icon Styling" : "Visual Styling"}
            </h3>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 shrink-0 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5">
          <div className="space-y-4">
          {(showIconTileStyling || showRemoveBackground) && (
            <>
            <div className={`grid gap-4 ${isLucideIcon && showRemoveBackground ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isLucideIcon && (
                <div className="bg-muted/50 dark:bg-background rounded-md p-3 border border-border min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-primary rounded-full shrink-0" />
                    <Label className="text-sm font-semibold text-foreground">Icon Color</Label>
                  </div>
                  <ColorPicker
                    value={styling.iconColor || '#374151'}
                    onChange={(value) => handlePropertyChange('iconColor', value)}
                    placeholder="#374151"
                    showAlpha={false}
                    allowTransparent={false}
                  />
                </div>
              )}
              {showRemoveBackground && (
                <div className="bg-muted/50 dark:bg-background rounded-md p-3 border border-border min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold text-foreground">Remove background</Label>
                    <Switch
                      checked={noIconBackground}
                      onCheckedChange={(checked) => onStylingChange({ noIconBackground: checked })}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-muted/50 dark:bg-background rounded-md p-3 border border-border min-w-0">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold text-foreground">Icon opacity</Label>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {Math.round(
                    (typeof styling.iconOpacity === "number" && Number.isFinite(styling.iconOpacity)
                      ? Math.min(1, Math.max(0, styling.iconOpacity))
                      : 1) * 100,
                  )}
                  %
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[
                  typeof styling.iconOpacity === "number" && Number.isFinite(styling.iconOpacity)
                    ? Math.min(1, Math.max(0, styling.iconOpacity))
                    : 1,
                ]}
                onValueChange={([v]) => handlePropertyChange("iconOpacity", v, true)}
                className="mt-2 w-full"
              />
            </div>
            {showIconBevel && (
              <div className="bg-muted/50 dark:bg-background rounded-md p-3 border border-border min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold text-foreground">3D bevel</Label>
                  <Switch
                    checked={Boolean(styling.iconBevel)}
                    onCheckedChange={(checked) =>
                      onStylingChange({
                        iconBevel: checked,
                        ...(checked && styling.iconBevelRotation == null
                          ? { iconBevelRotation: ICON_BEVEL_DEFAULT_ROTATION }
                          : {}),
                        ...(checked && styling.iconBevelDepth == null
                          ? { iconBevelDepth: ICON_BEVEL_DEFAULT_DEPTH }
                          : {}),
                        ...(checked && styling.iconBevelGridOffset == null
                          ? { iconBevelGridOffset: ICON_BEVEL_DEFAULT_GRID_OFFSET }
                          : {}),
                      })
                    }
                  />
                </div>
                {styling.iconBevel && (
                  <>
                    {iconBevelSupportsRasterMatch && (
                      <>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-muted-foreground">Match icon background</Label>
                      <Switch
                        checked={Boolean(styling.iconBevelMatchIconBackground)}
                        onCheckedChange={(checked) => {
                          iconBevelMatchSampleGenRef.current += 1;
                          const gen = iconBevelMatchSampleGenRef.current;
                          onStylingChange({ iconBevelMatchIconBackground: checked });
                          if (!checked) return;
                          void resolveIconBevelSampleSrcAsync(buildIconBevelSampleNode(iconBevelSampleNode)).then((url) => {
                            if (gen !== iconBevelMatchSampleGenRef.current || !url) return;
                            return sampleIconPlateColorFromUrl(url);
                          }).then((hex) => {
                            if (gen !== iconBevelMatchSampleGenRef.current || !hex) return;
                            onStylingChange({
                              iconBevelMatchIconBackground: true,
                              iconBevelBlockColor: hex,
                            });
                          });
                        }}
                      />
                    </div>
                    <IconBevelMatchColorPreview
                      enabled={Boolean(styling.iconBevelMatchIconBackground)}
                      sampleNode={iconBevelSampleNode}
                      blockColor={styling.iconBevelBlockColor}
                      onPickedColor={handleIconBevelPickedColor}
                    />
                      </>
                    )}
                    {(!iconBevelSupportsRasterMatch || !styling.iconBevelMatchIconBackground) && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Block color</Label>
                      <ColorPicker
                        value={styling.iconBevelBlockColor || "#9aa3ab"}
                        onChange={(value) => handlePropertyChange("iconBevelBlockColor", value, true)}
                        placeholder="#9aa3ab"
                        showAlpha={false}
                        allowTransparent={false}
                      />
                    </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Block thickness</Label>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {(normalizeIconBevelDepth(styling.iconBevelDepth) * 100).toFixed(1)}
                          %
                        </span>
                      </div>
                      <Slider
                        min={ICON_BEVEL_MIN_DEPTH}
                        max={ICON_BEVEL_MAX_DEPTH}
                        step={0.005}
                        value={[normalizeIconBevelDepth(styling.iconBevelDepth)]}
                        onValueChange={([v]) => handlePropertyChange("iconBevelDepth", v, true)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Bevel angle</Label>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {Math.round(normalizeIconBevelRotation(styling.iconBevelRotation))}°
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={359}
                        step={1}
                        value={[normalizeIconBevelRotation(styling.iconBevelRotation)]}
                        onValueChange={([v]) => handlePropertyChange("iconBevelRotation", v, true)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Grid alignment</Label>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {Math.round(normalizeIconBevelGridOffset(styling.iconBevelGridOffset))}°
                        </span>
                      </div>
                      <Slider
                        min={ICON_BEVEL_MIN_GRID_OFFSET}
                        max={ICON_BEVEL_MAX_GRID_OFFSET}
                        step={1}
                        value={[normalizeIconBevelGridOffset(styling.iconBevelGridOffset)]}
                        onValueChange={([v]) => handlePropertyChange("iconBevelGridOffset", v, true)}
                        className="w-full"
                      />
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Fine-tune so neighbouring icons line up. Use 0° for a square-on view; try 8–12° when tiling icons in a row.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
            </>
          )}

          {!showFullStyling && (
            <div className="bg-purple-50/50 dark:bg-background rounded-md p-3 border border-purple-200/50 dark:border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full shrink-0" />
                <Label className="text-sm font-semibold text-foreground">Effects</Label>
              </div>
              <HighlightAnimEffectControls
                styling={styling}
                handlePropertyChange={handlePropertyChange}
                onStylingChange={onStylingChange}
              />
            </div>
          )}

          {(!isShape || showIconTileStyling) && (
            <div className="bg-muted/50 dark:bg-background rounded-md p-3 border border-border min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-muted-foreground rounded-full shrink-0" />
                <Label className="text-sm font-semibold text-foreground">
                  {showIconTileStyling ? "Icon size" : "Size"}
                </Label>
              </div>
              <Select
                value={styling.nodeSize || 'normal'}
                onValueChange={(value) => onStylingChange({ nodeSize: value as NodeSize })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Normal" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="normal" className="text-sm">Normal</SelectItem>
                  <SelectItem value="half" className="text-sm">Half</SelectItem>
                  <SelectItem value="quarter" className="text-sm">Quarter</SelectItem>
                  <SelectItem value="double" className="text-sm">Double</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showCardIconPlacement && (
            <div className="bg-muted/50 dark:bg-background rounded-md p-3 border border-border min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-muted-foreground rounded-full shrink-0" />
                <Label className="text-sm font-semibold text-foreground">Sizing</Label>
              </div>
              <Select
                value={styling.iconSizeMode ?? "scaled"}
                onValueChange={(value) =>
                  onStylingChange({ iconSizeMode: value as CardIconSizeMode })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Scaled" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {CARD_ICON_SIZE_MODES.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="text-sm">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showCardIconPlacement && (
            <div className="bg-muted/50 dark:bg-background rounded-md p-3 border border-border min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-muted-foreground rounded-full shrink-0" />
                <Label className="text-sm font-semibold text-foreground">Icon position</Label>
              </div>
              <Select
                value={styling.iconPlacement ?? "center"}
                onValueChange={(value) =>
                  onStylingChange({ iconPlacement: value as CardIconPlacement })
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Center" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {CARD_ICON_PLACEMENTS.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="text-sm">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showFullStyling && (
          <div key={accordionRemountKey} className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4 min-w-0">
              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Preset" dotClassName="bg-primary" outerClassName="bg-muted/50 border-border">
                <Select
                  value={currentPredefinedStyle || 'custom'}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      return;
                    }
                    handlePredefinedStyleChange(value as keyof typeof VISUAL_STYLES);
                  }}
                >
                  <SelectTrigger className="h-auto min-h-9 items-start gap-2 py-2 text-sm [&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:flex-1">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent className="z-[70]">
                    {Object.entries(VISUAL_STYLES).map(([key, style]) => (
                      <SelectItem key={key} value={key} className="text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{style.name}</span>
                          <span className="text-muted-foreground text-xs">{style.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-sm">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </StylingAccordionSection>

              {!isBorderNode ? (
              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Border" dotClassName="bg-amber-500" outerClassName="border-amber-200/50 bg-amber-50/50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Style</Label>
                    <Select
                      value={styling.borderStyle || 'solid'}
                      onValueChange={(value) => handlePropertyChange('borderStyle', value as any)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="none" className="text-sm">None</SelectItem>
                        <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                        <SelectItem value="dotted" className="text-sm">Dotted</SelectItem>
                        <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {styling.borderStyle && styling.borderStyle !== 'none' && (
                    <div className="space-y-1 flex flex-col">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-sm text-muted-foreground shrink-0">Width</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={
                            borderWidthFocused ? borderWidthDraft : String(typeof styling.borderWidth === "number" && Number.isFinite(styling.borderWidth) ? styling.borderWidth : 2)
                          }
                          onFocus={() => {
                            setBorderWidthFocused(true);
                            const bw = styling.borderWidth;
                            setBorderWidthDraft(
                              String(typeof bw === "number" && Number.isFinite(bw) ? bw : 2),
                            );
                          }}
                          onChange={(e) => setBorderWidthDraft(e.target.value)}
                          onBlur={() => {
                            setBorderWidthFocused(false);
                            const t = borderWidthDraft.trim();
                            const revert =
                              typeof styling.borderWidth === "number" && Number.isFinite(styling.borderWidth)
                                ? styling.borderWidth
                                : 2;
                            if (t === "") {
                              setBorderWidthDraft(String(revert));
                              return;
                            }
                            const n = parseFloat(t.replace(",", "."));
                            if (!Number.isFinite(n)) {
                              setBorderWidthDraft(String(revert));
                              return;
                            }
                            const clamped = Math.min(20, Math.max(0, n));
                            handlePropertyChange("borderWidth", clamped, true);
                            setBorderWidthDraft(String(clamped));
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                          }}
                          className={cn(NUMBER_INPUT_NO_SPINNER, "h-9 min-w-[4rem] w-16 tabular-nums text-sm")}
                        />
                        {styling.borderStyle === 'gradient' && (
                          <GradientAnglePicker
                            value={styling.borderGradientAngle ?? styling.gradientAngle ?? 135}
                            onChange={(angle) => handlePropertyChange('borderGradientAngle', angle)}
                            label="Dir"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {styling.borderStyle && styling.borderStyle !== 'none' && (
                  <div className="space-y-2">
                    {styling.borderStyle === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">Start</Label>
                          <ColorPicker
                            value={styling.borderColors?.[0] || '#6b7280'}
                            onChange={(value) => {
                              const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                              handlePropertyChange('borderColors', [value, currentColors[1]]);
                            }}
                            placeholder="#6b7280"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">End</Label>
                          <ColorPicker
                            value={styling.borderColors?.[1] || '#3b82f6'}
                            onChange={(value) => {
                              const currentColors = styling.borderColors || ['#6b7280', '#3b82f6'];
                              handlePropertyChange('borderColors', [currentColors[0], value]);
                            }}
                            placeholder="#3b82f6"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <ColorPicker
                        value={styling.borderColor || '#d1d5db'}
                        onChange={(value) => handlePropertyChange('borderColor', value)}
                        placeholder="#d1d5db"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    )}
                  </div>
                )}
              </StylingAccordionSection>
              ) : null}

              {!isBorderNode ? (
              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Background" dotClassName="bg-emerald-500" outerClassName="border-emerald-200/50 bg-emerald-50/50">
                {isCardNode ? (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {isFramedHeadingCard
                      ? "Interior fill for the rounded frame (transparent by default). Border styles the outer frame; use Heading for the tab fill and border."
                      : `Card fill area${cardTemplateId ? ` (${cardTemplateId.replace(/-/g, " ")})` : ""}. Border styles the card outline; click inner regions on the canvas to style segments individually.`}
                  </p>
                ) : null}
                <div
                  className={cn(
                    "mb-2 grid gap-2",
                    styling.backgroundStyle === "gradient" ? "grid-cols-2" : "grid-cols-1",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <Label className="text-sm text-muted-foreground">Style</Label>
                    <div
                      className={cn(
                        "items-center gap-2",
                        styling.backgroundStyle === "mesh_gradient" && supportsMeshGradientBackground
                          ? "grid grid-cols-[minmax(0,1fr)_auto]"
                          : "grid grid-cols-1",
                      )}
                    >
                      <div className="min-w-0">
                        <Select
                          value={styling.backgroundStyle || 'solid'}
                          onValueChange={handleBackgroundStyleSelect}
                        >
                          <SelectTrigger className="h-9 w-full min-w-0 text-sm [&>span]:min-w-0 [&>span]:truncate [&>span]:block [&>span]:text-left">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="none" className="text-sm">None</SelectItem>
                            <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                            <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
                            {supportsMeshGradientBackground ? (
                              <SelectItem value="mesh_gradient" className="text-sm">
                                Mesh gradient
                              </SelectItem>
                            ) : null}
                            <SelectItem value="frosted" className="text-sm">Frosted glass</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {styling.backgroundStyle === "mesh_gradient" && supportsMeshGradientBackground ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 shrink-0 gap-1 px-2.5"
                          onClick={handleRandomizeMeshGradient}
                          title="Randomize hub positions and colours"
                        >
                          <Shuffle className="h-3.5 w-3.5 shrink-0" />
                          Random
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {styling.backgroundStyle === 'gradient' && (
                    <GradientAnglePicker
                      value={styling.gradientAngle ?? 135}
                      onChange={(angle) => handlePropertyChange('gradientAngle', angle)}
                      label="Direction"
                    />
                  )}
                </div>
                {styling.backgroundStyle === 'mesh_gradient' && supportsMeshGradientBackground ? (
                  <div className="space-y-3 mb-2">
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Base fill</Label>
                      <p className="text-xs text-muted-foreground">
                        Underpaint for the mesh; hub colours are multiplied or screened on top for contrast.
                        With Visual styling open and the shape selected, numbered markers (1–3) appear at each hub’s position.
                      </p>
                      <ColorPicker
                        value={styling.backgroundColor || '#f3f4f6'}
                        onChange={(value) => handlePropertyChange('backgroundColor', value, true)}
                        placeholder="#f3f4f6"
                        showAlpha={true}
                        allowTransparent={true}
                      />
                    </div>
                    {normalizeMeshGradientPoints(
                      styling.meshGradientPoints,
                      styling.backgroundColor || '#f3f4f6',
                    ).map((pt, idx) => (
                      <div key={idx} className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                        <Label className="text-xs font-medium text-foreground">Hub {idx + 1}</Label>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs text-muted-foreground">Horizontal (X %)</Label>
                              <span className="w-9 tabular-nums text-right text-xs text-muted-foreground">
                                {Math.round(pt.xPct)}
                              </span>
                            </div>
                            <Slider
                              min={0}
                              max={100}
                              step={1}
                              value={[Math.min(100, Math.max(0, Math.round(pt.xPct)))]}
                              onValueChange={([v]) => {
                                const meshPts = normalizeMeshGradientPoints(
                                  styling.meshGradientPoints,
                                  styling.backgroundColor || '#f3f4f6',
                                );
                                const next = meshPts.map((p, i) =>
                                  i === idx ? { ...p, xPct: v } : p,
                                );
                                handlePropertyChange('meshGradientPoints', next, true);
                              }}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs text-muted-foreground">Vertical (Y %)</Label>
                              <span className="w-9 tabular-nums text-right text-xs text-muted-foreground">
                                {Math.round(pt.yPct)}
                              </span>
                            </div>
                            <Slider
                              min={0}
                              max={100}
                              step={1}
                              value={[Math.min(100, Math.max(0, Math.round(pt.yPct)))]}
                              onValueChange={([v]) => {
                                const meshPts = normalizeMeshGradientPoints(
                                  styling.meshGradientPoints,
                                  styling.backgroundColor || '#f3f4f6',
                                );
                                const next = meshPts.map((p, i) =>
                                  i === idx ? { ...p, yPct: v } : p,
                                );
                                handlePropertyChange('meshGradientPoints', next, true);
                              }}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Colour</Label>
                          <ColorPicker
                            value={pt.color}
                            onChange={(value) => {
                              const meshPts = normalizeMeshGradientPoints(
                                styling.meshGradientPoints,
                                styling.backgroundColor || '#f3f4f6',
                              );
                              const next = meshPts.map((p, i) =>
                                i === idx ? { ...p, color: value } : p,
                              );
                              handlePropertyChange('meshGradientPoints', next, true);
                            }}
                            placeholder="#6b7280"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {styling.backgroundStyle === 'frosted' && (
                  <div className="space-y-3 mb-2">
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Diffusion (blur strength)</Label>
                      <div className="flex items-center gap-3 pr-1">
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[Math.min(1, Math.max(0, Number(styling.frostedDiffusion ?? 0.45)))]}
                          onValueChange={([v]) => handlePropertyChange("frostedDiffusion", v, true)}
                          className="flex-1"
                        />
                        <span className="w-8 tabular-nums text-xs text-muted-foreground">
                          {((styling.frostedDiffusion ?? 0.45) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Transparency (see-through)</Label>
                      <div className="flex items-center gap-3 pr-1">
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[Math.min(1, Math.max(0, Number(styling.frostedTransparency ?? 0.55)))]}
                          onValueChange={([v]) => handlePropertyChange("frostedTransparency", v, true)}
                          className="flex-1"
                        />
                        <span className="w-8 tabular-nums text-xs text-muted-foreground">
                          {((styling.frostedTransparency ?? 0.55) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-muted-foreground">Perlin noise (texture)</Label>
                      <div className="flex items-center gap-3 pr-1">
                        <Slider
                          min={0}
                          max={10}
                          step={1}
                          value={[Math.min(10, Math.max(0, Math.round(Number(styling.frostedPerlinNoise ?? 0))))]}
                          onValueChange={([v]) => handlePropertyChange("frostedPerlinNoise", v, true)}
                          className="flex-1"
                        />
                        <span className="w-6 tabular-nums text-xs text-muted-foreground text-right">
                          {Math.min(10, Math.max(0, Math.round(Number(styling.frostedPerlinNoise ?? 0))))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {styling.backgroundStyle &&
                  styling.backgroundStyle !== 'none' &&
                  styling.backgroundStyle !== 'mesh_gradient' && (
                  <div className="space-y-2">
                    {styling.backgroundStyle === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">Start</Label>
                          <ColorPicker
                            value={styling.backgroundColors?.[0] || '#f3f4f6'}
                            onChange={(value) => {
                              const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                              handlePropertyChange('backgroundColors', [value, currentColors[1]]);
                            }}
                            placeholder="#f3f4f6"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-sm text-muted-foreground">End</Label>
                          <ColorPicker
                            value={styling.backgroundColors?.[1] || '#e5e7eb'}
                            onChange={(value) => {
                              const currentColors = styling.backgroundColors || ['#f3f4f6', '#e5e7eb'];
                              handlePropertyChange('backgroundColors', [currentColors[0], value]);
                            }}
                            placeholder="#e5e7eb"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {styling.backgroundStyle === "frosted" ? (
                          <p className="text-xs text-muted-foreground">Tint color (applies a light wash on top of the blurred backdrop)</p>
                        ) : null}
                        <ColorPicker
                          value={styling.backgroundColor || '#f3f4f6'}
                          onChange={(value) => handlePropertyChange('backgroundColor', value)}
                          placeholder="#f3f4f6"
                          showAlpha={true}
                          allowTransparent={true}
                        />
                      </div>
                    )}
                  </div>
                )}
              </StylingAccordionSection>
              ) : null}

              {isProgressBar ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Progress bar"
                  dotClassName="bg-sky-500"
                  outerClassName="border-sky-200/50 bg-sky-50/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Corner radius</Label>
                      <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                        {Math.round((styling.cornerRadius ?? 0.35) * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[styling.cornerRadius ?? 0.35]}
                      onValueChange={([v]) => handlePropertyChange("cornerRadius", v, true)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Fill amount</Label>
                      <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                        {Math.round(styling.progressPercent ?? 62)}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[Math.round(styling.progressPercent ?? 62)]}
                      onValueChange={([v]) => handlePropertyChange('progressPercent', v, true)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Show percent label</Label>
                    <Switch
                      checked={styling.progressShowPercent !== false}
                      onCheckedChange={(checked) => handlePropertyChange('progressShowPercent', checked, true)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Fill (complete)</Label>
                    <Select
                      value={styling.progressFillStyle === 'solid' ? 'solid' : 'gradient'}
                      onValueChange={(v) =>
                        handlePropertyChange('progressFillStyle', v === 'solid' ? 'solid' : 'gradient', true)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="solid" className="text-sm">Solid</SelectItem>
                        <SelectItem value="gradient" className="text-sm">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                    {styling.progressFillStyle === 'gradient' ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <ColorPicker
                            value={styling.progressFillColors?.[0] || '#22c55e'}
                            onChange={(value) => {
                              const c = styling.progressFillColors || ['#22c55e', '#15803d'];
                              handlePropertyChange('progressFillColors', [value, c[1]], true);
                            }}
                            placeholder="#22c55e"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <ColorPicker
                            value={styling.progressFillColors?.[1] || '#15803d'}
                            onChange={(value) => {
                              const c = styling.progressFillColors || ['#22c55e', '#15803d'];
                              handlePropertyChange('progressFillColors', [c[0], value], true);
                            }}
                            placeholder="#15803d"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1">
                        <ColorPicker
                          value={styling.progressFillColors?.[0] || '#22c55e'}
                          onChange={(value) => handlePropertyChange('progressFillColors', [value], true)}
                          placeholder="#22c55e"
                          showAlpha={true}
                          allowTransparent={true}
                        />
                      </div>
                    )}
                    {styling.progressFillStyle === 'gradient' ? (
                      <div className="pt-1">
                        <Label className="text-xs text-muted-foreground">Fill gradient angle</Label>
                        <GradientAnglePicker
                          label=""
                          value={styling.progressFillGradientAngle ?? 90}
                          onChange={(a) => handlePropertyChange('progressFillGradientAngle', a, true)}
                        />
                      </div>
                    ) : null}
                  </div>
                </StylingAccordionSection>
              ) : null}

              {isTimelineBar ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Timeline bar"
                  dotClassName="bg-teal-500"
                  outerClassName="border-teal-200/50 bg-teal-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Orientation</Label>
                    <Select
                      value={styling.timelineBarOrientation === "vertical" ? "vertical" : "horizontal"}
                      onValueChange={(v) =>
                        handlePropertyChange(
                          "timelineBarOrientation",
                          v === "vertical" ? "vertical" : "horizontal",
                          true,
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[160px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="horizontal" className="text-sm">
                          Horizontal
                        </SelectItem>
                        <SelectItem value="vertical" className="text-sm">
                          Vertical
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Corner radius</Label>
                      <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                        {Math.round((styling.cornerRadius ?? 0.35) * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[styling.cornerRadius ?? 0.35]}
                      onValueChange={([v]) => handlePropertyChange("cornerRadius", v, true)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Auto-size sections</Label>
                    <Select
                      value={styling.timelineBarSizing === "weighted" ? "weighted" : "equal"}
                      onValueChange={(v) =>
                        handlePropertyChange("timelineBarSizing", v === "weighted" ? "weighted" : "equal", true)
                      }
                    >
                      <SelectTrigger className="h-9 w-[160px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="equal" className="text-sm">
                          Equal widths
                        </SelectItem>
                        <SelectItem value="weighted" className="text-sm">
                          By weight
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Date / tick row</Label>
                    <Switch
                      checked={styling.timelineBarShowTicks !== false}
                      onCheckedChange={(checked) => handlePropertyChange("timelineBarShowTicks", checked, true)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Tick markers</Label>
                    <Switch
                      checked={styling.timelineBarTickMarkers === true}
                      onCheckedChange={(checked) => handlePropertyChange("timelineBarTickMarkers", checked, true)}
                    />
                  </div>
                  <div className="space-y-2 pt-1">
                    <Label className="text-sm text-muted-foreground">Axis row text</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Font</Label>
                        <Select
                          value={styling.timelineBarAxisLabelFontFamily ? styling.timelineBarAxisLabelFontFamily : "__inherit__"}
                          onValueChange={(v) =>
                            handlePropertyChange("timelineBarAxisLabelFontFamily", v === "__inherit__" ? null : v, true)
                          }
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Font" />
                          </SelectTrigger>
                          <SelectContent className="z-[70]">
                            <SelectItem value="__inherit__" className="text-sm">
                              Same as shape text
                            </SelectItem>
                            {COMMON_FONT_FAMILIES.map((font) => (
                              <SelectItem key={font} value={font} className="text-sm">
                                <span style={{ fontFamily: font }}>{font.split(",")[0]}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Size (px, blank = auto)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={200}
                          step={0.5}
                          className={cn(NUMBER_INPUT_NO_SPINNER, "h-9 text-sm tabular-nums")}
                          value={
                            styling.timelineBarAxisLabelFontSize !== undefined &&
                            styling.timelineBarAxisLabelFontSize !== null
                              ? styling.timelineBarAxisLabelFontSize
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              handlePropertyChange("timelineBarAxisLabelFontSize", null, true);
                              return;
                            }
                            const n = parseFloat(raw);
                            if (!Number.isNaN(n) && n > 0) {
                              handlePropertyChange("timelineBarAxisLabelFontSize", n, true);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Axis labels (e.g. Q1–Q4) and per-section tick labels. Leave size blank for automatic scaling (~twice the old default).
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Borders between sections</Label>
                    <Switch
                      checked={styling.timelineBarSectionBorder === true}
                      onCheckedChange={(checked) => handlePropertyChange("timelineBarSectionBorder", checked, true)}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Theme hue step (°)</Label>
                      <TimelineBarHueStepInput
                        committedDeg={styling.timelineBarHueStepDeg}
                        onCommit={(v) => handlePropertyChange("timelineBarHueStepDeg", v, true)}
                        className="h-9 min-w-[5rem] w-[5.25rem] tabular-nums text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hue difference between consecutive segments when Fill is Theme hue. Pyramid tiers follow the Hue step
                      field in the Themes menu under &quot;Step hue for multi-selection&quot;. Use this field for an optional
                      per-shape timeline bar override (empty = {`${DIAGRAM_THEME_HUE_STEP_DEG}°`}, same default as timeline cards).
                    </p>
                  </div>
                  {styling.timelineBarSectionBorder === true ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Divider width</Label>
                        <Input
                          type="number"
                          min={0.5}
                          max={4}
                          step={0.5}
                          value={styling.timelineBarSectionBorderWidth ?? 1}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            if (!isNaN(n)) handlePropertyChange("timelineBarSectionBorderWidth", n, true);
                          }}
                          className={cn(NUMBER_INPUT_NO_SPINNER, "h-8 min-w-[4rem] w-16 tabular-nums text-xs")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Divider color</Label>
                        <ColorPicker
                          value={styling.timelineBarSectionBorderColor || "#ffffff"}
                          onChange={(value) => handlePropertyChange("timelineBarSectionBorderColor", value, true)}
                          showAlpha={true}
                          allowTransparent={true}
                        />
                      </div>
                    </div>
                  ) : null}
                </StylingAccordionSection>
              ) : null}

              {isBorderNode && onBorderChange ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Border properties"
                  dotClassName="bg-teal-500"
                  outerClassName="border-teal-200/50 bg-teal-50/50"
                >
                  <BorderPropertiesPanel
                    borderTemplateId={borderTemplateId}
                    border={border}
                    onBorderChange={onBorderChange}
                  />
                </StylingAccordionSection>
              ) : null}

              {isFramedHeadingCard && framedHeadingTab && onCardElementsChange ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Heading"
                  dotClassName="bg-rose-500"
                  outerClassName="border-rose-200/50 bg-rose-50/50"
                >
                  <div className="space-y-3">
                    <CardFillStyleControls
                      label="Heading box fill"
                      style={framedHeadingTab.style}
                      onChange={patchFramedHeadingTabStyle}
                      supportsMesh={false}
                    />
                    <CardBorderStyleControls
                      label="Heading box border"
                      style={framedHeadingTab.style}
                      onChange={patchFramedHeadingTabStyle}
                    />
                  </div>
                </StylingAccordionSection>
              ) : null}

              {cardTemplateHasDedicatedPropertiesPanel(cardTemplateId) &&
              cardElements &&
              onCardElementsChange ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Card properties"
                  dotClassName="bg-sky-500"
                  outerClassName="border-sky-200/50 bg-sky-50/50"
                >
                  <CardPropertiesPanel
                    cardTemplateId={cardTemplateId}
                    elements={cardElements}
                    onElementsChange={onCardElementsChange}
                    agendaRowThemeHue={agendaRowThemeHue}
                    onAgendaRowThemeHueChange={onAgendaRowThemeHueChange}
                    agendaDividersEnabled={agendaDividersEnabled}
                    onAgendaDividersEnabledChange={onAgendaDividersEnabledChange}
                    bulletListItemThemeHue={bulletListItemThemeHue}
                    onBulletListItemThemeHueChange={onBulletListItemThemeHueChange}
                    bulletListUseItemIcons={bulletListUseItemIcons}
                    onBulletListUseItemIconsChange={onBulletListUseItemIconsChange}
                  />
                </StylingAccordionSection>
              ) : isCardNode && !cardTemplateHasDedicatedPropertiesPanel(cardTemplateId) ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Card properties"
                  dotClassName="bg-sky-500"
                  outerClassName="border-sky-200/50 bg-sky-50/50"
                >
                  <p className="text-xs text-muted-foreground">
                    Select regions on the card to style icon areas, text chips, and tags in the panel
                    footer. Use <span className="font-medium">Background</span> above for the card fill and{" "}
                    <span className="font-medium">Border</span> for the outline.
                  </p>
                </StylingAccordionSection>
              ) : null}

              {isSegmentedRectangle ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Segmented rectangle"
                  dotClassName="bg-cyan-500"
                  outerClassName="border-cyan-200/50 bg-cyan-50/50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Vertical segments</Label>
                      <Switch
                        checked={(styling.segmentedRectanglePlacementOrder ?? "horizontal") === "vertical"}
                        onCheckedChange={(checked) =>
                          handlePropertyChange(
                            "segmentedRectanglePlacementOrder",
                            checked ? "vertical" : "horizontal",
                            true,
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Corner radius</Label>
                      <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                        {Math.round((styling.cornerRadius ?? 0.12) * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[styling.cornerRadius ?? 0.12]}
                      onValueChange={([v]) => handlePropertyChange("cornerRadius", v, true)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Auto-size sections</Label>
                    <Select
                      value={styling.segmentedRectangleSizing === "weighted" ? "weighted" : "equal"}
                      onValueChange={(v) =>
                        handlePropertyChange("segmentedRectangleSizing", v === "weighted" ? "weighted" : "equal", true)
                      }
                    >
                      <SelectTrigger className="h-9 w-[160px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="equal" className="text-sm">
                          Equal widths
                        </SelectItem>
                        <SelectItem value="weighted" className="text-sm">
                          By weight
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Gap between segments (px)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className={cn(NUMBER_INPUT_NO_SPINNER, "h-9 w-[4.5rem] tabular-nums text-sm")}
                      value={
                        segmentedRectangleSegmentGapFocused
                          ? segmentedRectangleSegmentGapDraft
                          : String(
                              typeof styling.segmentedRectangleSegmentGap === "number" &&
                                Number.isFinite(styling.segmentedRectangleSegmentGap)
                                ? styling.segmentedRectangleSegmentGap
                                : 0,
                            )
                      }
                      onFocus={() => {
                        setSegmentedRectangleSegmentGapFocused(true);
                        const v = styling.segmentedRectangleSegmentGap;
                        setSegmentedRectangleSegmentGapDraft(
                          String(typeof v === "number" && Number.isFinite(v) ? v : 0),
                        );
                      }}
                      onChange={(e) => setSegmentedRectangleSegmentGapDraft(e.target.value)}
                      onBlur={() => {
                        setSegmentedRectangleSegmentGapFocused(false);
                        const t = segmentedRectangleSegmentGapDraft.trim();
                        const revert =
                          typeof styling.segmentedRectangleSegmentGap === "number" &&
                          Number.isFinite(styling.segmentedRectangleSegmentGap)
                            ? styling.segmentedRectangleSegmentGap
                            : 0;
                        if (t === "") {
                          setSegmentedRectangleSegmentGapDraft(String(revert));
                          return;
                        }
                        const n = parseFloat(t.replace(",", "."));
                        if (!Number.isFinite(n)) {
                          setSegmentedRectangleSegmentGapDraft(String(revert));
                          return;
                        }
                        const clamped = Math.min(64, Math.max(0, n));
                        handlePropertyChange("segmentedRectangleSegmentGap", clamped, true);
                        setSegmentedRectangleSegmentGapDraft(String(clamped));
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Outline mode</Label>
                    <Select
                      value={
                        styling.segmentedRectangleOutlineMode === "segments"
                          ? "segments"
                          : styling.segmentedRectangleOutlineMode === "none"
                            ? "none"
                            : "container"
                      }
                      onValueChange={(v) =>
                        handlePropertyChange(
                          "segmentedRectangleOutlineMode",
                          v === "segments" ? "segments" : v === "none" ? "none" : "container",
                          true,
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[160px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="container" className="text-sm">
                          Single container
                        </SelectItem>
                        <SelectItem value="segments" className="text-sm">
                          Per segment
                        </SelectItem>
                        <SelectItem value="none" className="text-sm">
                          No outline
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Internal dividers</Label>
                    <Switch
                      checked={styling.segmentedRectangleDividers === true}
                      onCheckedChange={(checked) => handlePropertyChange("segmentedRectangleDividers", checked, true)}
                    />
                  </div>
                  {styling.segmentedRectangleDividers === true ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Divider width</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={
                            segmentedRectangleDividerWidthFocused
                              ? segmentedRectangleDividerWidthDraft
                              : String(
                                  typeof styling.segmentedRectangleDividerWidth === "number" &&
                                    Number.isFinite(styling.segmentedRectangleDividerWidth)
                                    ? styling.segmentedRectangleDividerWidth
                                    : 1.5,
                                )
                          }
                          onFocus={() => {
                            setSegmentedRectangleDividerWidthFocused(true);
                            const v = styling.segmentedRectangleDividerWidth;
                            setSegmentedRectangleDividerWidthDraft(
                              String(
                                typeof v === "number" && Number.isFinite(v) ? v : 1.5,
                              ),
                            );
                          }}
                          onChange={(e) => setSegmentedRectangleDividerWidthDraft(e.target.value)}
                          onBlur={() => {
                            setSegmentedRectangleDividerWidthFocused(false);
                            const t = segmentedRectangleDividerWidthDraft.trim();
                            const revert =
                              typeof styling.segmentedRectangleDividerWidth === "number" &&
                              Number.isFinite(styling.segmentedRectangleDividerWidth)
                                ? styling.segmentedRectangleDividerWidth
                                : 1.5;
                            if (t === "") {
                              setSegmentedRectangleDividerWidthDraft(String(revert));
                              return;
                            }
                            const n = parseFloat(t.replace(",", "."));
                            if (!Number.isFinite(n)) {
                              setSegmentedRectangleDividerWidthDraft(String(revert));
                              return;
                            }
                            const clamped = Math.min(8, Math.max(0.5, n));
                            handlePropertyChange("segmentedRectangleDividerWidth", clamped, true);
                            setSegmentedRectangleDividerWidthDraft(String(clamped));
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                          }}
                          className={cn(NUMBER_INPUT_NO_SPINNER, "h-8 min-w-[4rem] w-16 tabular-nums text-xs")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Divider colour</Label>
                        <ColorPicker
                          value={styling.segmentedRectangleDividerColor || "#64748b"}
                          onChange={(value) => handlePropertyChange("segmentedRectangleDividerColor", value, true)}
                          showAlpha={true}
                          allowTransparent={true}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">Divider inset (0–0.45)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={0.45}
                          step={0.02}
                          value={
                            typeof styling.segmentedRectangleDividerInset === "number"
                              ? styling.segmentedRectangleDividerInset
                              : 0.1
                          }
                          onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            if (!Number.isNaN(n))
                              handlePropertyChange(
                                "segmentedRectangleDividerInset",
                                Math.min(0.45, Math.max(0, n)),
                                true,
                              );
                          }}
                          className={cn(NUMBER_INPUT_NO_SPINNER, "h-8 w-[4.5rem] tabular-nums text-xs")}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Inset shrinks divider length from top and bottom (fraction of bar height).
                      </p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm text-muted-foreground">Theme hue step (°)</Label>
                      <TimelineBarHueStepInput
                        committedDeg={styling.segmentedRectangleHueStepDeg}
                        onCommit={(v) => handlePropertyChange("segmentedRectangleHueStepDeg", v, true)}
                        className="h-9 min-w-[5rem] w-[5.25rem] tabular-nums text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hue shift between consecutive segments when fill is Theme hue (per-shape override; empty uses diagram
                      default).
                    </p>
                  </div>
                </StylingAccordionSection>
              ) : null}

              {isPyramid ? (
                <StylingAccordionSection
                  defaultOpen={accordionDefaultOpen}
                  title="Pyramid tiers"
                  dotClassName="bg-amber-500"
                  outerClassName="border-amber-200/50 bg-amber-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Auto-size tiers</Label>
                    <Select
                      value={styling.pyramidSizing === "weighted" ? "weighted" : "equal"}
                      onValueChange={(v) =>
                        handlePropertyChange("pyramidSizing", v === "weighted" ? "weighted" : "equal", true)
                      }
                    >
                      <SelectTrigger className="h-9 w-[160px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="equal" className="text-sm">
                          Equal heights
                        </SelectItem>
                        <SelectItem value="weighted" className="text-sm">
                          By weight
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Gap between tiers</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="h-9 min-w-[4.75rem] w-[5rem] text-sm tabular-nums"
                      value={
                        pyramidTierGapFocused
                          ? pyramidTierGapDraft
                          : String(
                              typeof styling.pyramidSegmentGap === "number" && Number.isFinite(styling.pyramidSegmentGap)
                                ? styling.pyramidSegmentGap
                                : 2,
                            )
                      }
                      onFocus={() => {
                        setPyramidTierGapFocused(true);
                        const v = styling.pyramidSegmentGap;
                        setPyramidTierGapDraft(
                          String(typeof v === "number" && Number.isFinite(v) ? v : 2),
                        );
                      }}
                      onChange={(e) => setPyramidTierGapDraft(e.target.value)}
                      onBlur={() => {
                        setPyramidTierGapFocused(false);
                        const t = pyramidTierGapDraft.trim();
                        const revert =
                          typeof styling.pyramidSegmentGap === "number" && Number.isFinite(styling.pyramidSegmentGap)
                            ? styling.pyramidSegmentGap
                            : 2;
                        if (t === "") {
                          setPyramidTierGapDraft(String(revert));
                          return;
                        }
                        const n = parseFloat(t.replace(",", "."));
                        if (!Number.isFinite(n)) {
                          setPyramidTierGapDraft(String(revert));
                          return;
                        }
                        const clamped = Math.min(32, Math.max(0, n));
                        handlePropertyChange("pyramidSegmentGap", clamped, true);
                        setPyramidTierGapDraft(String(clamped));
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Narrow end</Label>
                    <Select
                      value={styling.pyramidDirection === "narrow-at-bottom" ? "narrow-at-bottom" : "narrow-at-top"}
                      onValueChange={(v) =>
                        handlePropertyChange(
                          "pyramidDirection",
                          v === "narrow-at-bottom" ? "narrow-at-bottom" : "narrow-at-top",
                          true,
                        )
                      }
                    >
                      <SelectTrigger className="h-9 w-[200px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="narrow-at-top">Top · wide base</SelectItem>
                        <SelectItem value="narrow-at-bottom">Bottom · inverted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Narrow end (% base, 0 = point)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className={cn(NUMBER_INPUT_NO_SPINNER, "h-9 min-w-[4.75rem] w-[5rem] text-sm tabular-nums")}
                      value={Math.round((styling.pyramidApexWidthRatio ?? 0.12) * 100)}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value);
                        if (!Number.isFinite(n)) return;
                        handlePropertyChange("pyramidApexWidthRatio", Math.min(100, Math.max(0, n)) / 100, true);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Typography follows first tier</Label>
                    <Switch
                      checked={styling.pyramidLabelsFollowFirstSection === true}
                      onCheckedChange={(checked) => handlePropertyChange("pyramidLabelsFollowFirstSection", checked, true)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Borders between tiers</Label>
                    <Switch
                      checked={styling.pyramidSectionBorder === true}
                      onCheckedChange={(checked) => handlePropertyChange("pyramidSectionBorder", checked, true)}
                    />
                  </div>
                  {styling.pyramidSectionBorder === true ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">
                          Tier outline width (0 = none)
                        </Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          className="h-8 min-w-[4rem] w-16 tabular-nums text-xs"
                          value={
                            pyramidTierOutlineFocused
                              ? pyramidTierOutlineDraft
                              : String(
                                  typeof styling.pyramidSectionBorderWidth === "number" &&
                                    Number.isFinite(styling.pyramidSectionBorderWidth)
                                    ? styling.pyramidSectionBorderWidth
                                    : 1,
                                )
                          }
                          onFocus={() => {
                            setPyramidTierOutlineFocused(true);
                            const v = styling.pyramidSectionBorderWidth;
                            setPyramidTierOutlineDraft(
                              String(typeof v === "number" && Number.isFinite(v) ? v : 1),
                            );
                          }}
                          onChange={(e) => setPyramidTierOutlineDraft(e.target.value)}
                          onBlur={() => {
                            setPyramidTierOutlineFocused(false);
                            const t = pyramidTierOutlineDraft.trim();
                            const revert =
                              typeof styling.pyramidSectionBorderWidth === "number" &&
                              Number.isFinite(styling.pyramidSectionBorderWidth)
                                ? styling.pyramidSectionBorderWidth
                                : 1;
                            if (t === "") {
                              setPyramidTierOutlineDraft(String(revert));
                              return;
                            }
                            const n = parseFloat(t.replace(",", "."));
                            if (!Number.isFinite(n)) {
                              setPyramidTierOutlineDraft(String(revert));
                              return;
                            }
                            const clamped = Math.min(4, Math.max(0, n));
                            handlePropertyChange("pyramidSectionBorderWidth", clamped, true);
                            setPyramidTierOutlineDraft(String(clamped));
                          }}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Tier outline color (solid / gradient tiers; Theme hue tiers use a darker hue-matched stroke)
                        </Label>
                        <ColorPicker
                          value={styling.pyramidSectionBorderColor || "#ffffff"}
                          onChange={(value) => handlePropertyChange("pyramidSectionBorderColor", value, true)}
                          showAlpha={true}
                          allowTransparent={true}
                        />
                      </div>
                    </div>
                  ) : null}
                </StylingAccordionSection>
              ) : null}
            </div>

            <div className="space-y-4 min-w-0 border-l border-border pl-8">
              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Effects" dotClassName="bg-purple-500" outerClassName="border-purple-200/50 bg-purple-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Shadow</Label>
                    <Switch
                      checked={styling.shadow || false}
                      onCheckedChange={(checked) => handlePropertyChange('shadow', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm text-muted-foreground">Rounded Edges</Label>
                    <Switch
                      checked={styling.roundedEdges || false}
                      onCheckedChange={(checked) => handlePropertyChange('roundedEdges', checked)}
                    />
                  </div>
                  <HighlightAnimEffectControls
                    styling={styling}
                    handlePropertyChange={handlePropertyChange}
                    onStylingChange={onStylingChange}
                  />
                  {isRoundedRectangle && !isProgressBar && !isTimelineBar && !isSegmentedRectangle && !isPyramid && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm text-muted-foreground">Corner radius</Label>
                        <span className="w-12 text-right tabular-nums text-xs text-muted-foreground">
                          {Math.round((styling.cornerRadius ?? 0.2) * 100)}%
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={1}
                        step={0.01}
                        value={[styling.cornerRadius ?? 0.2]}
                        onValueChange={([v]) => handlePropertyChange("cornerRadius", v, true)}
                        className="w-full"
                      />
                    </div>
                  )}
                  {isTextBoxHeading && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Heading background</Label>
                      <Select
                        value={styling.headingBackgroundStyle === "solid" ? "solid" : "gradient"}
                        onValueChange={(v) =>
                          handlePropertyChange(
                            "headingBackgroundStyle",
                            v === "solid" ? "solid" : "gradient"
                          )
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[70]">
                          <SelectItem value="gradient" className="text-sm">
                            Gradient (fade to transparent)
                          </SelectItem>
                          <SelectItem value="solid" className="text-sm">
                            Solid
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Label className="text-sm text-muted-foreground">Heading color</Label>
                      <ColorPicker
                        value={
                          styling.headingBackgroundColor?.startsWith("#")
                            ? styling.headingBackgroundColor
                            : "#1f2937"
                        }
                        onChange={(value) =>
                          handlePropertyChange("headingBackgroundColor", value)
                        }
                        placeholder="#1f2937"
                        showAlpha={false}
                        allowTransparent={false}
                      />
                    </div>
                  )}
              </StylingAccordionSection>

              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Connectors" dotClassName="bg-teal-500" outerClassName="border-teal-200/50 bg-teal-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <Label className="text-sm text-muted-foreground font-normal">Let lines pass through</Label>
                    <p className="text-xs text-muted-foreground">
                      Orthogonal connector paths ignore this shape as an obstacle (they may cross the outline).
                    </p>
                  </div>
                  <Switch
                    className="shrink-0 mt-0.5"
                    checked={styling.ignoreConnectionAvoidance === true}
                    onCheckedChange={(checked) => handlePropertyChange('ignoreConnectionAvoidance', checked, true)}
                  />
                </div>
              </StylingAccordionSection>

              <StylingAccordionSection defaultOpen={accordionDefaultOpen} title="Tags" dotClassName="bg-indigo-500" outerClassName="border-indigo-200/50 bg-indigo-50/50">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Text</Label>
                    <Input
                      value={tag || ''}
                      onChange={(e) => onTagChange?.(e.target.value)}
                      placeholder="Tag text"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1 block">Position</Label>
                    <Select
                      value={tagPosition || 'top-center'}
                      onValueChange={(value) => onTagPositionChange?.(value as any)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="top-left" className="text-sm">Top L</SelectItem>
                        <SelectItem value="top-center" className="text-sm">Top C</SelectItem>
                        <SelectItem value="top-right" className="text-sm">Top R</SelectItem>
                        <SelectItem value="bottom-left" className="text-sm">Bot L</SelectItem>
                        <SelectItem value="bottom-center" className="text-sm">Bot C</SelectItem>
                        <SelectItem value="bottom-right" className="text-sm">Bot R</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </StylingAccordionSection>

              {footer}
            </div>
          </div>
          )}
        </div>
        </div>
      </div>
    </Draggable>
  );
});