"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { polygonToRoundedPath, boundingBoxFromSvgPolygonPointsString } from '@/components/diagram/shapes/shape-utils';
import { getTextEffectsShadowCss, getTextOutlineShadowCss } from '@/lib/text-styling';
import type { NodeChartSpec, NodeChartSpecBar, NodeChartSpecGrid, NodeChartSpecLine, NodeChartSpecRing, PyramidDirection, MeshGradientPoint } from '@/lib/types';
import { pieSlicesForSvg, truncatePieSliceLabel, defaultBarChartSpec, defaultGridChartSpec, defaultLineChartSpec, defaultRingChartSpec, ringSlicesForSvg } from '@/lib/chart-node';
import { buildGridChartLayout } from '@/lib/grid-chart-layout';
import {
  barChartWantsRoundedColumnEnds,
  barColumnAutoRoundRadius,
  barColumnClipPathHorizontal,
  barColumnClipPathVertical,
  barLegendEntries,
  buildBarChartLayout,
  chartSegmentLegendEntries,
  wrapBarLabelLines,
} from '@/lib/bar-chart-layout';
import {
  buildLineChartLayout,
  lineAreaClosedPath,
  lineChartPolylineStrokeFallbackFromNodeBorder,
  linePathPolyline,
  linePathSmooth,
  resolveLineChartPolylineStrokeWidth,
} from '@/lib/line-chart-layout';
import { CompositeCardSilhouette, compositeCardSilhouetteMeshDescriptor } from '@/components/diagram/shapes/composite-card-silhouette';
import { normalizeCompositeBodyShapeKind } from '@/lib/shape-type-swap';
import { multiplyLightnessOfColor, shiftHueOfColor } from '@/lib/color-shift';
import { useThemeMenuHueStepDeg } from '@/hooks/use-theme-menu-hue-step-deg';
import { roundedRectangleMeshGradientSvg, clippedMeshGradientSvg } from '@/lib/mesh-gradient';
import { pyramidStackWideNarrowYs, pyramidWidthFracAtY, type PyramidInterpolatedWidthParams } from '@/lib/pyramid';

function formatBarPreviewValue(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(1).replace(/\.0$/, '');
}

const PREVIEW_BAR_LH_EM = 1.15;

function BarPreviewTextBlock(props: {
  lines: string[];
  x: number;
  yCenter: number;
  fontSize: number;
  textAnchor: 'start' | 'middle' | 'end';
  fill: string;
  fontWeight: number;
  pointerEvents?: 'auto' | 'none';
  style?: React.CSSProperties;
  extra?: React.SVGProps<SVGTextElement>;
}) {
  const lh = props.fontSize * PREVIEW_BAR_LH_EM;
  const yFirst = props.yCenter - ((props.lines.length - 1) * lh) / 2;
  return (
    <text
      x={props.x}
      y={yFirst}
      textAnchor={props.textAnchor}
      dominantBaseline="middle"
      fill={props.fill}
      fontSize={props.fontSize}
      fontWeight={props.fontWeight}
      {...props.extra}
      pointerEvents={props.pointerEvents}
      style={props.style}
    >
      {props.lines.map((line, i) => (
        <tspan key={i} x={props.x} dy={i === 0 ? 0 : lh}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

const PREVIEW_PIE_POINTER_LEAVE_MS = 140;
const PREVIEW_PIE_HIT_STROKE_PAD = 3;
const PREVIEW_BAR_POINTER_LEAVE_MS = 140;
const PREVIEW_BAR_HIT_STROKE_PAD = 0.75;

interface ShapePreviewProps {
  type: string;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderStyle?: string;
  backgroundColor?: string;
  borderColor?: string;
  backgroundStyle?: string;
  backgroundColors?: string[];
  /** Hubs for rounded-rectangle mesh gradient preview */
  meshGradientPoints?: MeshGradientPoint[];
  borderColors?: string[];
  gradientAngle?: number;
  borderGradientAngle?: number;
  label?: string;
  textColor?: string;
  textOutlineWidth?: number;
  textOutlineColor?: string;
  textGlowBlur?: number;
  textGlowColor?: string;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textShadowBlur?: number;
  textShadowColor?: string;
  textDropShadowEnabled?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  shadow?: boolean;
  roundedEdges?: boolean;
  cornerRadius?: number; // Rounded-rectangle only: 0=straight, 1=full
  headingBackgroundColor?: string;
  headingBackgroundStyle?: 'gradient' | 'solid';
  chart?: NodeChartSpec;
  compositeBodyShape?: string;
}

// Helper function to convert gradient angle to SVG coordinates
const getGradientCoordinates = (angle: number = 135) => {
  const radians = (angle * Math.PI) / 180;
  const x2 = 50 + 50 * Math.cos(radians);
  const y2 = 50 + 50 * Math.sin(radians);
  const x1 = 50 - 50 * Math.cos(radians);
  const y1 = 50 - 50 * Math.sin(radians);
  return {
    x1: `${x1}%`,
    y1: `${y1}%`,
    x2: `${x2}%`,
    y2: `${y2}%`
  };
}

export function ShapePreview({
  type,
  width = 40,
  height = 40,
  fill,
  stroke,
  strokeWidth = 2,
  borderStyle = 'solid',
  backgroundColor,
  borderColor,
  backgroundStyle = 'solid',
  backgroundColors,
  meshGradientPoints,
  borderColors,
  gradientAngle = 135,
  borderGradientAngle,
  label,
  textColor = '#000000',
  textOutlineWidth,
  textOutlineColor,
  textGlowBlur,
  textGlowColor,
  textShadowOffsetX,
  textShadowOffsetY,
  textShadowBlur,
  textShadowColor,
  textDropShadowEnabled,
  fontFamily,
  fontSize = 10,
  fontWeight,
  fontStyle,
  textDecoration,
  shadow = false,
  roundedEdges = false,
  cornerRadius = 0.2,
  headingBackgroundColor: headingBgColorProp,
  headingBackgroundStyle: headingBgStyleProp,
  chart,
  compositeBodyShape,
}: ShapePreviewProps) {
  const themeMenuHueStepDeg = useThemeMenuHueStepDeg();
  const [pieSliceTooltip, setPieSliceTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const pieTooltipLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPieTooltipLeaveTimer = () => {
    const t = pieTooltipLeaveTimerRef.current;
    if (t != null) {
      clearTimeout(t);
      pieTooltipLeaveTimerRef.current = null;
    }
  };

  const schedulePieTooltipLeave = () => {
    cancelPieTooltipLeaveTimer();
    pieTooltipLeaveTimerRef.current = setTimeout(() => {
      pieTooltipLeaveTimerRef.current = null;
      setPieSliceTooltip(null);
    }, PREVIEW_PIE_POINTER_LEAVE_MS);
  };

  useEffect(() => {
    return () => {
      const t = pieTooltipLeaveTimerRef.current;
      if (t != null) {
        clearTimeout(t);
        pieTooltipLeaveTimerRef.current = null;
      }
    };
  }, []);

  const [barPreviewCellTooltip, setBarPreviewCellTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const barPreviewLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelBarPreviewLeaveTimer = () => {
    const t = barPreviewLeaveTimerRef.current;
    if (t != null) {
      clearTimeout(t);
      barPreviewLeaveTimerRef.current = null;
    }
  };

  const scheduleBarPreviewLeave = () => {
    cancelBarPreviewLeaveTimer();
    barPreviewLeaveTimerRef.current = setTimeout(() => {
      barPreviewLeaveTimerRef.current = null;
      setBarPreviewCellTooltip(null);
    }, PREVIEW_BAR_POINTER_LEAVE_MS);
  };

  useEffect(() => {
    return () => {
      const t = barPreviewLeaveTimerRef.current;
      if (t != null) {
        clearTimeout(t);
        barPreviewLeaveTimerRef.current = null;
      }
    };
  }, []);

  const textEffectsShadow = getTextEffectsShadowCss({
    textGlowBlur,
    textGlowColor,
    textShadowOffsetX,
    textShadowOffsetY,
    textShadowBlur,
    textShadowColor,
    textDropShadowEnabled,
  });
  const textOutlineShadow =
    textOutlineWidth != null && textOutlineWidth > 0
      ? getTextOutlineShadowCss({
          textOutlineWidth,
          textOutlineColor: textOutlineColor ?? '#ffffff',
        })
      : undefined;
  const labelTextShadow = [textOutlineShadow, textEffectsShadow].filter(Boolean).join(', ') || undefined;
  const gradientId = useId();
  const borderGradientId = useId();
  const isPlainRectangle = type === 'generic.object.rectangle' || type?.endsWith('.rectangle');
  const isDefaultRectanglePreview =
    isPlainRectangle &&
    backgroundColor === undefined &&
    backgroundColors === undefined &&
    fill === undefined &&
    borderColor === undefined &&
    borderColors === undefined &&
    stroke === undefined;

  // Use provided colors or fallback to fill/stroke for backward compatibility
  // Only apply defaults if NO color is provided at all
  const effectiveBackgroundColor = backgroundColor !== undefined
    ? backgroundColor
    : (fill !== undefined ? fill : (isDefaultRectanglePreview ? '#ecfccb' : '#6b7280'));
  const effectiveBorderColor = borderColor !== undefined
    ? borderColor
    : (stroke !== undefined ? stroke : (isDefaultRectanglePreview ? '#57534e' : '#6b7280'));
  
  // Normalize dimensions to fit in the preview area while maintaining aspect ratio if needed
  // For scratchpad, we usually want a fixed square-ish preview
  const displayWidth = width;
  const displayHeight = height;
  
  // Handle background colors array - ensure we have valid colors
  const bgColors = backgroundColors && backgroundColors.length >= 2 
    ? backgroundColors 
    : [effectiveBackgroundColor, isDefaultRectanglePreview ? '#d9f99d' : effectiveBackgroundColor];
  const borderColorArray = borderColors && borderColors.length >= 2
    ? borderColors
    : [effectiveBorderColor, isDefaultRectanglePreview ? '#78716c' : effectiveBorderColor];
  
  // Ensure backgroundStyle defaults to 'solid' if not provided (matching canvas behavior)
  const effectiveBackgroundStyle =
    isDefaultRectanglePreview
      ? 'gradient'
      : (backgroundStyle !== undefined ? backgroundStyle : 'solid');
  


  const commonSvgProps = {
    width: displayWidth,
    height: displayHeight,
    style: { display: 'block' }
  };

  const borderCoords = getGradientCoordinates(borderGradientAngle ?? gradientAngle);

  const headingStripColor = headingBgColorProp ?? '#1f2937';
  const headingStripSolid = headingBgStyleProp === 'solid';

  const renderShape = () => {
    if (type === 'generic.chart.bar' || chart?.kind === 'bar') {
      const spec: NodeChartSpecBar = chart?.kind === 'bar' ? chart : defaultBarChartSpec();
      const model = buildBarChartLayout(spec, { vbW: 100, vbH: 68 });
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      const sliceStroke = spec.sliceBorderColor?.trim() || effectiveBorderColor;
      const gradBase = `sp-bar-${gradientId.replace(/:/g, '')}`;
      const coords = getGradientCoordinates(gradientAngle);
      const axisC = spec.axisColor?.trim() || effectiveBorderColor;
      const gridC = spec.gridColor?.trim() || 'rgba(148,163,184,0.45)';
      const vertical = spec.vertical !== false;
      const {
        plot,
        valueAxisMax,
        valueTicks,
        categoryCount,
        vbH,
        legendLabelFontSize,
        legendLabelLines,
      } = model;
      const legendList = spec.showLegend === true ? barLegendEntries(spec) : [];
      const catSlot = vertical ? plot.w / Math.max(1, categoryCount) : plot.h / Math.max(1, categoryCount);
      const valueGridLines = valueTicks.map((t) =>
        vertical
          ? { x1: plot.x0, x2: plot.x0 + plot.w, y1: plot.y0 + plot.h - (t / valueAxisMax) * plot.h, y2: plot.y0 + plot.h - (t / valueAxisMax) * plot.h }
          : { x1: plot.x0 + (t / valueAxisMax) * plot.w, x2: plot.x0 + (t / valueAxisMax) * plot.w, y1: plot.y0, y2: plot.y0 + plot.h }
      );
      const categoryGridLines: { x1: number; x2: number; y1: number; y2: number }[] = [];
      for (let j = 0; j <= categoryCount; j++) {
        if (vertical) {
          const x = plot.x0 + j * catSlot;
          categoryGridLines.push({ x1: x, x2: x, y1: plot.y0, y2: plot.y0 + plot.h });
        } else {
          const y = plot.y0 + j * catSlot;
          categoryGridLines.push({ x1: plot.x0, x2: plot.x0 + plot.w, y1: y, y2: y });
        }
      }
      const showVG = vertical ? spec.showGridY === true : spec.showGridX === true;
      const showCG = vertical ? spec.showGridX === true : spec.showGridY === true;
      const legendSlotW =
        legendList.length > 0 ? plot.w / Math.max(1, legendList.length) : 0;
      const legendYLift = 1.5;
      const useRoundedColumnEnds = barChartWantsRoundedColumnEnds(spec);
      const rectsByCat = new Map<number, (typeof model.rects)[number][]>();
      for (const r of model.rects) {
        const arr = rectsByCat.get(r.categoryIndex) ?? [];
        arr.push(r);
        rectsByCat.set(r.categoryIndex, arr);
      }
      const clipBase = `${gradBase}-cclip`;
      const showBarSegmentValueHoverTip = spec.showSegmentValues !== true;
      const previewBarValueHandlers = (r: (typeof model.rects)[number]) => {
        const tipText =
          showBarSegmentValueHoverTip && Number.isFinite(r.value)
            ? formatBarPreviewValue(r.value)
            : '';
        const showTip = tipText !== '';
        return {
          onPointerEnter: (e: React.PointerEvent<SVGElement>) => {
            cancelBarPreviewLeaveTimer();
            if (showTip) {
              setBarPreviewCellTooltip({
                x: e.clientX,
                y: e.clientY,
                text: tipText,
              });
            } else {
              setBarPreviewCellTooltip(null);
            }
          },
          onPointerMove: (e: React.PointerEvent<SVGElement>) => {
            if (!showTip) return;
            setBarPreviewCellTooltip((prev) =>
              prev
                ? { ...prev, x: e.clientX, y: e.clientY }
                : { x: e.clientX, y: e.clientY, text: tipText }
            );
          },
          onPointerLeave: scheduleBarPreviewLeave,
        };
      };
      return (
        <svg {...commonSvgProps} viewBox={`0 0 100 ${vbH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            {useRoundedColumnEnds
              ? Array.from({ length: categoryCount }, (_, j) => {
                  const list = rectsByCat.get(j) ?? [];
                  const rAuto = barColumnAutoRoundRadius(list, vertical);
                  const d = vertical
                    ? barColumnClipPathVertical(list, rAuto)
                    : barColumnClipPathHorizontal(list, rAuto);
                  if (!d) return null;
                  return (
                    <clipPath key={`sp-cp-${j}`} id={`${clipBase}-${j}`} clipPathUnits="userSpaceOnUse">
                      <path d={d} />
                    </clipPath>
                  );
                })
              : null}
            {model.rects.map((r) =>
              r.fillMode === 'gradient' ? (
                <linearGradient
                  key={`sp-bar-lg-${r.segmentIndex}-${r.categoryIndex}`}
                  id={`${gradBase}-${r.segmentIndex}-${r.categoryIndex}`}
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  gradientUnits="objectBoundingBox"
                >
                  <stop offset="0%" stopColor={r.gradientColor1} />
                  <stop offset="100%" stopColor={r.gradientColor2} />
                </linearGradient>
              ) : null
            )}
            {legendList.map((en, i) =>
              en.fillMode === 'gradient' ? (
                <linearGradient
                  key={`sp-bar-leg-${i}`}
                  id={`${gradBase}-leg-${i}`}
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  gradientUnits="objectBoundingBox"
                >
                  <stop offset="0%" stopColor={en.gradientColor1} />
                  <stop offset="100%" stopColor={en.gradientColor2} />
                </linearGradient>
              ) : null
            )}
          </defs>
          <g pointerEvents="none">
            {showVG
              ? valueGridLines.map((ln, i) => (
                  <line key={`vg-${i}`} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke={gridC} strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
                ))
              : null}
            {showCG
              ? categoryGridLines.map((ln, i) => (
                  <line key={`cg-${i}`} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke={gridC} strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
                ))
              : null}
          </g>
          {useRoundedColumnEnds
            ? Array.from({ length: categoryCount }, (_, j) => {
                const list = rectsByCat.get(j) ?? [];
                if (list.length === 0) return null;
                const rAuto = barColumnAutoRoundRadius(list, vertical);
                const clipD = vertical
                  ? barColumnClipPathVertical(list, rAuto)
                  : barColumnClipPathHorizontal(list, rAuto);
                const inner = list.map((r) => {
                  const fill =
                    r.fillMode === 'none'
                      ? 'transparent'
                      : r.fillMode === 'gradient'
                        ? `url(#${gradBase}-${r.segmentIndex}-${r.categoryIndex})`
                        : r.solidFill;
                  const outlineOnColumnPath = !!clipD;
                  const brKey = `br-${r.segmentIndex}-${r.categoryIndex}`;
                  if (!showBarSegmentValueHoverTip) {
                    return (
                      <rect
                        key={brKey}
                        x={r.x}
                        y={r.y}
                        width={Math.max(0, r.w)}
                        height={Math.max(0, r.h)}
                        fill={fill}
                        stroke={outlineOnColumnPath ? 'none' : sw ? sliceStroke : 'none'}
                        strokeWidth={outlineOnColumnPath ? 0 : sw}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  }
                  return (
                    <g key={brKey}>
                      <rect
                        x={r.x}
                        y={r.y}
                        width={Math.max(0, r.w)}
                        height={Math.max(0, r.h)}
                        fill="#000000"
                        fillOpacity={0}
                        stroke="rgba(0,0,0,0)"
                        strokeWidth={PREVIEW_BAR_HIT_STROKE_PAD}
                        vectorEffect="non-scaling-stroke"
                        {...previewBarValueHandlers(r)}
                      />
                      <rect
                        x={r.x}
                        y={r.y}
                        width={Math.max(0, r.w)}
                        height={Math.max(0, r.h)}
                        fill={fill}
                        stroke={outlineOnColumnPath ? 'none' : sw ? sliceStroke : 'none'}
                        strokeWidth={outlineOnColumnPath ? 0 : sw}
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: 'none' }}
                      />
                    </g>
                  );
                });
                if (!clipD) {
                  return <g key={`sp-col-${j}`}>{inner}</g>;
                }
                return (
                  <g key={`sp-col-${j}`}>
                    <g clipPath={`url(#${clipBase}-${j})`}>{inner}</g>
                    {sw ? (
                      <path
                        d={clipD}
                        fill="none"
                        stroke={sliceStroke}
                        strokeWidth={sw}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                      />
                    ) : null}
                  </g>
                );
              })
            : model.rects.map((r) => {
                const fill =
                  r.fillMode === 'none'
                    ? 'transparent'
                    : r.fillMode === 'gradient'
                      ? `url(#${gradBase}-${r.segmentIndex}-${r.categoryIndex})`
                      : r.solidFill;
                const brKey = `br-${r.segmentIndex}-${r.categoryIndex}`;
                if (!showBarSegmentValueHoverTip) {
                  return (
                    <rect
                      key={brKey}
                      x={r.x}
                      y={r.y}
                      width={Math.max(0, r.w)}
                      height={Math.max(0, r.h)}
                      fill={fill}
                      stroke={sw ? sliceStroke : 'none'}
                      strokeWidth={sw}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }
                return (
                  <g key={brKey}>
                    <rect
                      x={r.x}
                      y={r.y}
                      width={Math.max(0, r.w)}
                      height={Math.max(0, r.h)}
                      fill="#000000"
                      fillOpacity={0}
                      stroke="rgba(0,0,0,0)"
                      strokeWidth={PREVIEW_BAR_HIT_STROKE_PAD}
                      vectorEffect="non-scaling-stroke"
                      {...previewBarValueHandlers(r)}
                    />
                    <rect
                      x={r.x}
                      y={r.y}
                      width={Math.max(0, r.w)}
                      height={Math.max(0, r.h)}
                      fill={fill}
                      stroke={sw ? sliceStroke : 'none'}
                      strokeWidth={sw}
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                );
              })}
          {spec.showSegmentLabels !== false || spec.showSegmentValues === true
            ? model.rects.map((r) => {
                const wantsName = spec.showSegmentLabels !== false && !!r.name.trim();
                const wantsVal = spec.showSegmentValues === true && r.value > 0;
                if (!wantsName && !wantsVal) return null;
                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;
                const fs = r.labelFontSize;
                const fsV = Math.min(fs * 0.88, 3.2);
                const twoLine = vertical ? r.h >= 8.5 : r.w >= 12;
                const valThin = Math.min(r.w, r.h) < 4.5;
                const showV = wantsVal && !valThin;
                const lhSeg = fs * PREVIEW_BAR_LH_EM;
                const nameMaxW = Math.max(2, vertical ? r.w - 0.5 : r.w - 0.5);
                const reserveVal = showV && twoLine ? fsV * 1.25 : 0;
                const usableName = (vertical ? r.h : r.w) - reserveVal;
                const maxNameLines = Math.max(1, Math.floor(usableName / lhSeg));
                const nameLines = wantsName
                  ? wrapBarLabelLines(r.name.trim(), nameMaxW, fs, maxNameLines)
                  : [];
                const showN = wantsName && nameLines.length > 0 && usableName >= lhSeg * 0.5;
                if (!showN && !showV) return null;
                if (showN && showV && twoLine) {
                  return (
                    <g key={`bt-${r.segmentIndex}-${r.categoryIndex}`}>
                      <BarPreviewTextBlock
                        lines={nameLines}
                        x={cx}
                        yCenter={cy - fsV * 0.35}
                        fontSize={fs}
                        textAnchor="middle"
                        fill={r.labelColor}
                        fontWeight={600}
                        pointerEvents="none"
                        style={{ textShadow: '0 0 1px rgba(0,0,0,0.5)' }}
                      />
                      <text
                        x={cx}
                        y={cy + fs * 0.42}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={r.labelColor}
                        fontSize={fsV}
                        fontWeight={600}
                        pointerEvents="none"
                        style={{ textShadow: '0 0 1px rgba(0,0,0,0.5)' }}
                      >
                        {formatBarPreviewValue(r.value)}
                      </text>
                    </g>
                  );
                }
                if (showV && (!showN || !twoLine)) {
                  return (
                    <text
                      key={`bt-${r.segmentIndex}-${r.categoryIndex}`}
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={r.labelColor}
                      fontSize={fsV}
                      fontWeight={600}
                      pointerEvents="none"
                      style={{ textShadow: '0 0 1px rgba(0,0,0,0.5)' }}
                    >
                      {formatBarPreviewValue(r.value)}
                    </text>
                  );
                }
                const showBarLabelValueTip =
                  showBarSegmentValueHoverTip && Number.isFinite(r.value);
                return (
                  <BarPreviewTextBlock
                    key={`bt-${r.segmentIndex}-${r.categoryIndex}`}
                    lines={nameLines}
                    x={cx}
                    yCenter={cy}
                    fontSize={fs}
                    textAnchor="middle"
                    fill={r.labelColor}
                    fontWeight={600}
                    pointerEvents={showBarLabelValueTip ? 'auto' : 'none'}
                    style={{ textShadow: '0 0 1px rgba(0,0,0,0.5)' }}
                    extra={
                      showBarLabelValueTip
                        ? (previewBarValueHandlers(r) as React.SVGProps<SVGTextElement>)
                        : undefined
                    }
                  />
                );
              })
            : null}
          {legendList.length > 0
            ? legendList.map((en, i) => {
                const cx = plot.x0 + (i + 0.5) * legendSlotW;
                const sw = 3;
                const fill =
                  en.fillMode === 'none'
                    ? 'transparent'
                    : en.fillMode === 'gradient'
                      ? `url(#${gradBase}-leg-${i})`
                      : en.solidFill;
                const legFont = legendLabelFontSize;
                const legLines = legendLabelLines[i] ?? [en.name];
                const ty = vbH - 3.5 - legendYLift;
                const legMidY = ty - legFont * 0.35;
                return (
                  <g key={`leg-${en.segmentIndex}`} transform={`translate(${cx}, 0)`}>
                    <rect
                      x={-legendSlotW / 2 + 0.5}
                      y={legMidY - sw / 2}
                      width={sw}
                      height={sw}
                      rx={0.4}
                      fill={fill}
                      stroke={sliceStroke}
                      strokeWidth={0.35}
                      vectorEffect="non-scaling-stroke"
                    />
                    <BarPreviewTextBlock
                      lines={legLines}
                      x={-legendSlotW / 2 + sw + 1.8}
                      yCenter={legMidY}
                      fontSize={legFont}
                      textAnchor="start"
                      fill={axisC}
                      fontWeight={500}
                      pointerEvents="none"
                    />
                  </g>
                );
              })
            : null}
          {spec.showValueAxis !== false
            ? valueTicks.map((t, i) => {
                if (vertical) {
                  const y = plot.y0 + plot.h - (t / valueAxisMax) * plot.h;
                  return (
                    <text key={`va-${i}`} x={plot.x0 - 2} y={y + 1.1} textAnchor="end" fill={axisC} fontSize={3.1} fontWeight={500} pointerEvents="none">
                      {Number.isInteger(t) ? String(t) : t.toFixed(1)}
                    </text>
                  );
                }
                const x = plot.x0 + (t / valueAxisMax) * plot.w;
                return (
                  <text key={`va-${i}`} x={x} y={plot.y0 + plot.h + 4} textAnchor="middle" fill={axisC} fontSize={3.1} fontWeight={500} pointerEvents="none">
                    {Number.isInteger(t) ? String(t) : t.toFixed(1)}
                  </text>
                );
              })
            : null}
        </svg>
      );
    }

    if (type === 'generic.chart.line' || chart?.kind === 'line') {
      const spec: NodeChartSpecLine = chart?.kind === 'line' ? chart : defaultLineChartSpec();
      const model = buildLineChartLayout(spec, { vbW: 100, vbH: 68 });
      const gradBase = `sp-line-${gradientId.replace(/:/g, '')}`;
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      const axisC = spec.axisColor?.trim() || effectiveBorderColor;
      const gridC = spec.gridColor?.trim() || 'rgba(148,163,184,0.45)';
      const smooth = spec.smooth !== false;
      const showArea = spec.showAreaFill !== false;
      const areaOp = Math.max(0, Math.min(1, spec.areaFillOpacity ?? 0.42));
      const dotRConfigured =
        typeof spec.dotRadius === 'number' && Number.isFinite(spec.dotRadius)
          ? Math.min(3, Math.max(0, spec.dotRadius))
          : null;
      const dotR = dotRConfigured != null && dotRConfigured > 0 ? dotRConfigured : 1.85;
      const showDots =
        spec.showDots !== false && (dotRConfigured == null ? true : dotRConfigured > 0);
      const lineW = resolveLineChartPolylineStrokeWidth(
        spec,
        lineChartPolylineStrokeFallbackFromNodeBorder(sw)
      );
      const {
        plot,
        valueAxisMax,
        valueTicks,
        categoryCount,
        baseY,
        vbH,
        legendLabelFontSize,
        legendLabelLines,
      } = model;
      const legendList = spec.showLegend === true ? chartSegmentLegendEntries(spec.series) : [];
      const catSlot = plot.w / Math.max(1, categoryCount);
      const valueGridLines = valueTicks.map((t) => ({
        x1: plot.x0,
        x2: plot.x0 + plot.w,
        y1: plot.y0 + plot.h - (t / valueAxisMax) * plot.h,
        y2: plot.y0 + plot.h - (t / valueAxisMax) * plot.h,
      }));
      const categoryGridLines: { x1: number; x2: number; y1: number; y2: number }[] = [];
      for (let j = 0; j <= categoryCount; j++) {
        const x = plot.x0 + j * catSlot;
        categoryGridLines.push({ x1: x, x2: x, y1: plot.y0, y2: plot.y0 + plot.h });
      }
      const showVG = spec.showGridY === true;
      const showCG = spec.showGridX === true;
      const legendSlotW = legendList.length > 0 ? plot.w / Math.max(1, legendList.length) : 0;
      const legendYLift = 1.5;
      const previewLineDotHandlers = (tip: string) => ({
        onPointerEnter: (e: React.PointerEvent<SVGElement>) => {
          cancelBarPreviewLeaveTimer();
          setBarPreviewCellTooltip({ x: e.clientX, y: e.clientY, text: tip });
        },
        onPointerMove: (e: React.PointerEvent<SVGElement>) => {
          setBarPreviewCellTooltip((prev) =>
            prev
              ? { ...prev, x: e.clientX, y: e.clientY }
              : { x: e.clientX, y: e.clientY, text: tip }
          );
        },
        onPointerLeave: scheduleBarPreviewLeave,
      });
      const catLabelEls =
        spec.showCategoryLabels !== false && Array.isArray(spec.categoryLabels)
          ? spec.categoryLabels.slice(0, categoryCount).map((raw, j) => {
              const lab = (raw ?? '').trim();
              if (!lab) return null;
              const lines = model.categoryLabelLines[j] ?? [];
              if (lines.length === 0) return null;
              const cx = plot.x0 + (j + 0.5) * catSlot;
              const ty = plot.y0 + plot.h + 3.6;
              const midY = ty - model.categoryLabelFontSize * 0.35;
              return (
                <BarPreviewTextBlock
                  key={`lc-${j}`}
                  lines={lines}
                  x={cx}
                  yCenter={midY}
                  fontSize={model.categoryLabelFontSize}
                  textAnchor="middle"
                  fill={axisC}
                  fontWeight={500}
                  pointerEvents="none"
                />
              );
            })
          : null;
      return (
        <svg {...commonSvgProps} viewBox={`0 0 100 ${vbH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            {legendList.map((en, i) =>
              en.fillMode === 'gradient' ? (
                <linearGradient
                  key={`lg-leg-${i}`}
                  id={`${gradBase}-leg-${i}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={en.gradientColor1} />
                  <stop offset="100%" stopColor={en.gradientColor2} />
                </linearGradient>
              ) : null
            )}
            {model.series.map((sLayout, si) => (
              <React.Fragment key={`d-${si}`}>
                {sLayout.fillMode === 'gradient' ? (
                  <linearGradient id={`${gradBase}-s-${si}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={sLayout.gradientColor1} />
                    <stop offset="100%" stopColor={sLayout.gradientColor2} />
                  </linearGradient>
                ) : null}
                {showArea && sLayout.fillMode !== 'none' ? (
                  <linearGradient
                    id={`${gradBase}-a-${si}`}
                    x1={plot.x0}
                    y1={plot.y0}
                    x2={plot.x0}
                    y2={baseY}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={sLayout.strokeRgb} stopOpacity={areaOp} />
                    <stop offset="100%" stopColor={sLayout.strokeRgb} stopOpacity={0} />
                  </linearGradient>
                ) : null}
              </React.Fragment>
            ))}
          </defs>
          <g pointerEvents="none">
            {showVG
              ? valueGridLines.map((ln, i) => (
                  <line
                    key={`vg-${i}`}
                    x1={ln.x1}
                    y1={ln.y1}
                    x2={ln.x2}
                    y2={ln.y2}
                    stroke={gridC}
                    strokeWidth={0.35}
                    vectorEffect="non-scaling-stroke"
                  />
                ))
              : null}
            {showCG
              ? categoryGridLines.map((ln, i) => (
                  <line
                    key={`cg-${i}`}
                    x1={ln.x1}
                    y1={ln.y1}
                    x2={ln.x2}
                    y2={ln.y2}
                    stroke={gridC}
                    strokeWidth={0.35}
                    vectorEffect="non-scaling-stroke"
                  />
                ))
              : null}
          </g>
          {model.series.map((sLayout, si) => {
            const pts = sLayout.points;
            if (pts.length === 0) return null;
            const lineD = smooth ? linePathSmooth(pts) : linePathPolyline(pts);
            const areaD =
              showArea && sLayout.fillMode !== 'none'
                ? lineAreaClosedPath(pts, smooth, baseY)
                : '';
            const strokePaint =
              sLayout.fillMode === 'gradient'
                ? `url(#${gradBase}-s-${si})`
                : sLayout.fillMode === 'none'
                  ? sLayout.strokeRgb
                  : sLayout.stroke;
            return (
              <g key={`ls-${si}`}>
                {areaD ? (
                  <path
                    d={areaD}
                    fill={`url(#${gradBase}-a-${si})`}
                    stroke="none"
                  />
                ) : null}
                <path
                  d={lineD}
                  fill="none"
                  stroke={strokePaint}
                  strokeWidth={lineW}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                {showDots
                  ? pts.map((p) => {
                      const cat =
                        spec.categoryLabels?.[p.categoryIndex]?.trim() || `P${p.categoryIndex + 1}`;
                      const tip = `${sLayout.name}\n${cat}: ${formatBarPreviewValue(p.value)}`;
                      return (
                        <g key={`d-${si}-${p.categoryIndex}`}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={dotR + PREVIEW_BAR_HIT_STROKE_PAD}
                            fill="transparent"
                            stroke="none"
                            {...previewLineDotHandlers(tip)}
                          />
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={dotR}
                            fill={sLayout.strokeRgb}
                            stroke="rgba(255,255,255,0.9)"
                            strokeWidth={0.75}
                            vectorEffect="non-scaling-stroke"
                            pointerEvents="none"
                          />
                        </g>
                      );
                    })
                  : null}
              </g>
            );
          })}
          {catLabelEls}
          {spec.showValueAxis !== false
            ? valueTicks.map((t, i) => {
                const y = plot.y0 + plot.h - (t / valueAxisMax) * plot.h;
                return (
                  <text
                    key={`va-${i}`}
                    x={plot.x0 - 2}
                    y={y + 1.1}
                    textAnchor="end"
                    fill={axisC}
                    fontSize={3.1}
                    fontWeight={500}
                    pointerEvents="none"
                  >
                    {Number.isInteger(t) ? String(t) : t.toFixed(1)}
                  </text>
                );
              })
            : null}
          {legendList.length > 0
            ? legendList.map((en, i) => {
                const cx = plot.x0 + (i + 0.5) * legendSlotW;
                const swL = 3;
                const fill =
                  en.fillMode === 'none'
                    ? 'transparent'
                    : en.fillMode === 'gradient'
                      ? `url(#${gradBase}-leg-${i})`
                      : en.solidFill;
                const legFont = legendLabelFontSize;
                const legLines = legendLabelLines[i] ?? [en.name];
                const ty = vbH - 3.5 - legendYLift;
                const legMidY = ty - legFont * 0.35;
                return (
                  <g key={`leg-${en.segmentIndex}`} transform={`translate(${cx}, 0)`}>
                    <line
                      x1={-legendSlotW / 2 + 0.5}
                      x2={-legendSlotW / 2 + swL + 0.5}
                      y1={legMidY}
                      y2={legMidY}
                      stroke={en.fillMode === 'none' ? axisC : fill}
                      strokeWidth={1.1}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {en.fillMode !== 'none' ? (
                      <circle
                        cx={-legendSlotW / 2 + swL * 0.55}
                        cy={legMidY}
                        r={1.15}
                        fill={en.fillMode === 'gradient' ? `url(#${gradBase}-leg-${i})` : en.solidFill}
                        stroke="rgba(255,255,255,0.85)"
                        strokeWidth={0.35}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                    <BarPreviewTextBlock
                      lines={legLines}
                      x={-legendSlotW / 2 + swL + 1.8}
                      yCenter={legMidY}
                      fontSize={legFont}
                      textAnchor="start"
                      fill={axisC}
                      fontWeight={500}
                      pointerEvents="none"
                    />
                  </g>
                );
              })
            : null}
        </svg>
      );
    }

    if (type === 'generic.chart.grid' || chart?.kind === 'grid') {
      const spec: NodeChartSpecGrid =
        chart?.kind === 'grid' ? chart : defaultGridChartSpec();
      const previewNode = {
        id: "preview-grid",
        type: "generic.chart.grid",
        width: displayWidth,
        height: displayHeight,
        backgroundColor: effectiveBackgroundColor,
        backgroundStyle,
        borderStyle,
        borderColor: effectiveBorderColor,
        borderWidth: strokeWidth,
        cornerRadius: 0.2,
      } as import("@/lib/types").DiagramNodeData;
      const layout = buildGridChartLayout(previewNode, spec);
      const { body } = layout;
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      const gridGradBase = `sp-grid-${gradientId.replace(/:/g, '')}`;
      const gridGradCoords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps} viewBox={`0 0 ${layout.vbW} ${layout.vbH}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            {layout.cells.map((cell, i) =>
              cell.fillMode === 'gradient' ? (
                <linearGradient
                  key={`sp-grid-lg-${i}`}
                  id={`${gridGradBase}-${i}`}
                  x1={gridGradCoords.x1}
                  y1={gridGradCoords.y1}
                  x2={gridGradCoords.x2}
                  y2={gridGradCoords.y2}
                  gradientUnits="objectBoundingBox"
                >
                  <stop offset="0%" stopColor={cell.gradientColor1} />
                  <stop offset="100%" stopColor={cell.gradientColor2} />
                </linearGradient>
              ) : null
            )}
          </defs>
          <rect
            x={body.x}
            y={body.y}
            width={body.w}
            height={body.h}
            rx={body.rx}
            ry={body.ry}
            fill={effectiveBackgroundColor}
            stroke={effectiveBorderColor}
            strokeWidth={sw}
            vectorEffect="non-scaling-stroke"
          />
          <g pointerEvents="none">
            {layout.gridLines.map((ln, i) => (
              <line
                key={`sp-gl-${i}`}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                stroke={layout.gridLineColor}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          {layout.cells.map((cell, i) => {
            const fill =
              cell.fillMode === 'none'
                ? 'transparent'
                : cell.fillMode === 'gradient'
                  ? `url(#${gridGradBase}-${i})`
                  : cell.solidFill;
            return (
              <rect
                key={`sp-gc-${i}`}
                x={cell.x}
                y={cell.y}
                width={cell.size}
                height={cell.size}
                fill={fill}
                rx={Math.min(cell.size * 0.12, 3)}
              />
            );
          })}
          {layout.title ? (
            <text
              x={layout.title.x}
              y={layout.title.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={layout.titleColor}
              fontSize={layout.title.fontSize}
              fontWeight={600}
            >
              {layout.title.text}
            </text>
          ) : null}
        </svg>
      );
    }

    if (type === 'generic.chart.ring' || chart?.kind === 'ring') {
      const spec: NodeChartSpecRing =
        chart?.kind === 'ring' ? chart : defaultRingChartSpec();
      const borderSw = borderStyle === 'none' ? 0 : strokeWidth;
      const chartSpecifiedW = spec.sliceBorderWidth;
      const defaultOutlineWidthVb =
        typeof chartSpecifiedW === 'number' && Number.isFinite(chartSpecifiedW)
          ? Math.max(0, Math.min(5, chartSpecifiedW))
          : borderSw <= 0
            ? 0
            : Math.max(0.25, Math.min(5, borderSw));
      const { slices } = ringSlicesForSvg(30, 30, spec.series, spec, {
        defaultOutlineWidthVb,
      });
      const chartStrokeFallback =
        spec.sliceBorderColor?.trim() || effectiveBorderColor;
      const ringSliceOutlineDasharray = borderStyle === 'dotted' ? '3,3' : undefined;
      const ringGradBase = `sp-ring-${gradientId.replace(/:/g, '')}`;
      const ringGradCoords = getGradientCoordinates(gradientAngle);
      const previewRingPointerHandlers = (s: (typeof slices)[number]) => {
        const showVal = s.tooltipValue != null && Number.isFinite(s.tooltipValue);
        return {
          onPointerEnter: (e: React.PointerEvent<SVGElement>) => {
            cancelPieTooltipLeaveTimer();
            if (showVal) {
              setPieSliceTooltip({
                x: e.clientX,
                y: e.clientY,
                text: s.tooltipValue!.toLocaleString(),
              });
            } else {
              setPieSliceTooltip(null);
            }
          },
          onPointerMove: (e: React.PointerEvent<SVGElement>) => {
            if (!showVal) return;
            setPieSliceTooltip((prev) =>
              prev
                ? { ...prev, x: e.clientX, y: e.clientY }
                : {
                    x: e.clientX,
                    y: e.clientY,
                    text: s.tooltipValue!.toLocaleString(),
                  }
            );
          },
          onPointerLeave: schedulePieTooltipLeave,
        };
      };
      const RING_PREVIEW_LABEL_FALLBACK_R = 16;
      const RING_PREVIEW_MIN_SPAN_FOR_LABEL = 0.11;
      return (
        <svg {...commonSvgProps} viewBox="0 0 60 60" preserveAspectRatio="xMidYMid meet">
          <defs>
            {slices.map((s, i) =>
              s.fillMode === 'gradient' ? (
                <linearGradient
                  key={`sp-ring-lg-${i}`}
                  id={`${ringGradBase}-${i}`}
                  x1={ringGradCoords.x1}
                  y1={ringGradCoords.y1}
                  x2={ringGradCoords.x2}
                  y2={ringGradCoords.y2}
                  gradientUnits="objectBoundingBox"
                >
                  <stop offset="0%" stopColor={s.gradientColor1} />
                  <stop offset="100%" stopColor={s.gradientColor2} />
                </linearGradient>
              ) : null
            )}
          </defs>
          {slices.map((s, i) => {
            const outlineWResolved =
              typeof s.sliceStrokeWidth === 'number' &&
              Number.isFinite(s.sliceStrokeWidth)
                ? s.sliceStrokeWidth
                : defaultOutlineWidthVb;
            const outlineColorEffective =
              s.sliceStrokeColor?.trim() || chartStrokeFallback;
            const hasBorder = outlineWResolved > 0;
            const fill =
              s.fillMode === 'none'
                ? 'transparent'
                : s.fillMode === 'gradient'
                  ? `url(#${ringGradBase}-${i})`
                  : s.solidFill;
            return (
              <g key={i} transform={`translate(${s.explodeX},${s.explodeY})`}>
                <path
                  d={s.d}
                  fill="#000000"
                  fillOpacity={0}
                  stroke="rgba(0,0,0,0)"
                  strokeWidth={PREVIEW_PIE_HIT_STROKE_PAD}
                  vectorEffect="non-scaling-stroke"
                  {...previewRingPointerHandlers(s)}
                />
                <path
                  d={s.d}
                  fill={fill}
                  stroke={hasBorder ? outlineColorEffective : 'none'}
                  strokeWidth={hasBorder ? outlineWResolved : 0}
                  strokeDasharray={hasBorder ? ringSliceOutlineDasharray : undefined}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          })}
          {spec.showSegmentLabels !== false
            ? slices.map((s, i) => {
                if (!s.name.trim() || (slices.length > 1 && s.span < RING_PREVIEW_MIN_SPAN_FOR_LABEL)) return null;
                const lx = 30 + s.explodeX;
                const ly = 30 + s.explodeY;
                const radialDist =
                  typeof s.segmentMidRadius === 'number' &&
                  Number.isFinite(s.segmentMidRadius) &&
                  s.segmentMidRadius > 0.05
                    ? s.segmentMidRadius
                    : RING_PREVIEW_LABEL_FALLBACK_R;
                const isFull = s.span >= 2 * Math.PI - 1e-6;
                const ta = isFull
                  ? { x: lx, y: ly + Math.min(6, s.labelFontSize * 0.85) }
                  : {
                      x: lx + radialDist * Math.cos(s.midAngle),
                      y: ly + radialDist * Math.sin(s.midAngle),
                    };
                const maxChars = isFull
                  ? Math.max(4, Math.min(24, Math.round(18 * (5.5 / s.labelFontSize))))
                  : Math.max(4, Math.min(20, Math.round(12 * (4.75 / s.labelFontSize))));
                const showVal =
                  s.tooltipValue != null && Number.isFinite(s.tooltipValue);
                return (
                  <text
                    key={`t-ring-${i}`}
                    x={ta.x}
                    y={ta.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={s.labelColor}
                    fontSize={s.labelFontSize}
                    fontWeight={600}
                    pointerEvents={showVal ? 'auto' : 'none'}
                    style={{ textShadow: '0 0 1px rgba(0,0,0,0.5)' }}
                    {...previewRingPointerHandlers(s)}
                  >
                    {truncatePieSliceLabel(s.name, maxChars)}
                  </text>
                );
              })
            : null}
        </svg>
      );
    }

    if (type === 'generic.chart.pie' || chart?.kind === 'pie') {
      const pieOuterR = 28;
      const { slices, rDraw } = pieSlicesForSvg(30, 30, pieOuterR, chart?.series, {
        segmentGapDeg: chart?.segmentGapDeg,
      });
      const labelR = (rDraw / pieOuterR) * 16;
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      const sliceStroke = chart?.sliceBorderColor?.trim() || effectiveBorderColor;
      const pieGradBase = `sp-pie-${gradientId.replace(/:/g, '')}`;
      const pieGradCoords = getGradientCoordinates(gradientAngle);
      const previewPiePointerHandlers = (s: (typeof slices)[number]) => {
        const showVal = s.tooltipValue != null && Number.isFinite(s.tooltipValue);
        return {
          onPointerEnter: (e: React.PointerEvent<SVGElement>) => {
            cancelPieTooltipLeaveTimer();
            if (showVal) {
              setPieSliceTooltip({
                x: e.clientX,
                y: e.clientY,
                text: s.tooltipValue!.toLocaleString(),
              });
            } else {
              setPieSliceTooltip(null);
            }
          },
          onPointerMove: (e: React.PointerEvent<SVGElement>) => {
            if (!showVal) return;
            setPieSliceTooltip((prev) =>
              prev
                ? { ...prev, x: e.clientX, y: e.clientY }
                : {
                    x: e.clientX,
                    y: e.clientY,
                    text: s.tooltipValue!.toLocaleString(),
                  }
            );
          },
          onPointerLeave: schedulePieTooltipLeave,
        };
      };
      return (
        <svg {...commonSvgProps} viewBox="0 0 60 60" preserveAspectRatio="xMidYMid meet">
          <defs>
            {slices.map((s, i) =>
              s.fillMode === 'gradient' ? (
                <linearGradient
                  key={`sp-pie-lg-${i}`}
                  id={`${pieGradBase}-${i}`}
                  x1={pieGradCoords.x1}
                  y1={pieGradCoords.y1}
                  x2={pieGradCoords.x2}
                  y2={pieGradCoords.y2}
                  gradientUnits="objectBoundingBox"
                >
                  <stop offset="0%" stopColor={s.gradientColor1} />
                  <stop offset="100%" stopColor={s.gradientColor2} />
                </linearGradient>
              ) : null
            )}
          </defs>
          {slices.map((s, i) => {
            const fill =
              s.fillMode === 'none'
                ? 'transparent'
                : s.fillMode === 'gradient'
                  ? `url(#${pieGradBase}-${i})`
                  : s.solidFill;
            return (
              <g key={i} transform={`translate(${s.explodeX},${s.explodeY})`}>
                <path
                  d={s.d}
                  fill="#000000"
                  fillOpacity={0}
                  stroke="rgba(0,0,0,0)"
                  strokeWidth={PREVIEW_PIE_HIT_STROKE_PAD}
                  vectorEffect="non-scaling-stroke"
                  {...previewPiePointerHandlers(s)}
                />
                <path
                  d={s.d}
                  fill={fill}
                  stroke={sw ? sliceStroke : 'none'}
                  strokeWidth={sw}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          })}
                   {chart?.showSegmentLabels !== false
            ? slices.map((s, i) => {
                if (!s.name.trim() || (slices.length > 1 && s.span < 0.11)) return null;
                const lx = 30 + s.explodeX;
                const ly = 30 + s.explodeY;
                const isFull = s.span >= 2 * Math.PI - 1e-6;
                const ta = isFull
                  ? { x: lx, y: ly + Math.min(6, s.labelFontSize * 0.85) }
                  : { x: lx + labelR * Math.cos(s.midAngle), y: ly + labelR * Math.sin(s.midAngle) };
                const maxChars = isFull
                  ? Math.max(4, Math.min(24, Math.round(18 * (5.5 / s.labelFontSize))))
                  : Math.max(4, Math.min(20, Math.round(12 * (4.75 / s.labelFontSize))));
                const showVal =
                  s.tooltipValue != null && Number.isFinite(s.tooltipValue);
                return (
                  <text
                    key={`t-${i}`}
                    x={ta.x}
                    y={ta.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={s.labelColor}
                    fontSize={s.labelFontSize}
                    fontWeight={600}
                    pointerEvents={showVal ? 'auto' : 'none'}
                    style={{ textShadow: '0 0 1px rgba(0,0,0,0.5)' }}
                    {...previewPiePointerHandlers(s)}
                  >
                    {truncatePieSliceLabel(s.name, maxChars)}
                  </text>
                );
              })
            : null}
        </svg>
      );
    }

    // Circle
    if (type === 'generic.object.circle' || type?.endsWith('.circle')) {
      const r = (Math.min(displayWidth, displayHeight) / 2) - (borderStyle === 'none' ? 0 : strokeWidth / 2);
      const coords = getGradientCoordinates(gradientAngle);

      if (effectiveBackgroundStyle === 'mesh_gradient') {
        const meshUid = `sp-circ-${gradientId.replace(/:/g, '')}`;
        const cx = displayWidth / 2;
        const cy = displayHeight / 2;
        const side = 2 * Math.max(0, r);
        const ix = cx - r;
        const iy = cy - r;
        const { defs: mgDefs, fillClipGroup } = clippedMeshGradientSvg({
          uidBase: meshUid,
          innerX: ix,
          innerY: iy,
          innerW: side,
          innerH: side,
          baseColor: effectiveBackgroundColor,
          points: meshGradientPoints ?? [],
          clipPathChildren: <circle cx={cx} cy={cy} r={Math.max(0, r)} />,
        });
        return (
          <svg {...commonSvgProps}>
            <defs>
              {borderStyle === 'gradient' && (
                <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                  <stop offset="0%" stopColor={borderColorArray[0]} />
                  <stop offset="100%" stopColor={borderColorArray[1]} />
                </linearGradient>
              )}
            </defs>
            {mgDefs}
            {fillClipGroup}
            <circle
              cx={cx}
              cy={cy}
              r={Math.max(0, r)}
              fill="none"
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            />
          </svg>
        );
      }

      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <circle
            cx={displayWidth / 2}
            cy={displayHeight / 2}
            r={r > 0 ? r : 0}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
        </svg>
      );
    }

    // Triangle
    if (type === 'generic.object.triangle' || type?.endsWith('.triangle')) {
      const coords = getGradientCoordinates(gradientAngle);
      const points = `${displayWidth / 2},${strokeWidth} ${displayWidth - strokeWidth},${displayHeight - strokeWidth} ${strokeWidth},${displayHeight - strokeWidth}`;
      const viewBox: [number, number] = [displayWidth, displayHeight];

      if (effectiveBackgroundStyle === 'mesh_gradient') {
        const meshUid = `sp-tri-${gradientId.replace(/:/g, "")}`;
        const bbox = boundingBoxFromSvgPolygonPointsString(points);
        const clip = roundedEdges ? (
          <path d={polygonToRoundedPath(points, undefined, viewBox)} />
        ) : (
          <polygon points={points} />
        );
        const { defs: mgDefs, fillClipGroup } = clippedMeshGradientSvg({
          uidBase: meshUid,
          innerX: bbox.x,
          innerY: bbox.y,
          innerW: bbox.w,
          innerH: bbox.h,
          baseColor: effectiveBackgroundColor,
          points: meshGradientPoints ?? [],
          clipPathChildren: clip,
        });
        const strokePaint =
          borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor;
        return (
          <svg {...commonSvgProps}>
            <defs>
              {borderStyle === 'gradient' && (
                <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                  <stop offset="0%" stopColor={borderColorArray[0]} />
                  <stop offset="100%" stopColor={borderColorArray[1]} />
                </linearGradient>
              )}
            </defs>
            {mgDefs}
            {fillClipGroup}
            {roundedEdges ? (
              <path
                d={polygonToRoundedPath(points, undefined, viewBox)}
                fill="none"
                stroke={strokePaint}
                strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
                strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : (
              <polygon
                points={points}
                fill="none"
                stroke={strokePaint}
                strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
                strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
              />
            )}
          </svg>
        );
      }

      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          {roundedEdges ? (
            <path
              d={polygonToRoundedPath(points, undefined, viewBox)}
              fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <polygon
              points={points}
              fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            />
          )}
        </svg>
      );
    }

    // Star (exclude icon/emoji - generic.icon.star is Lucide icon, not polygon)
    if ((type === 'generic.object.star' || type?.endsWith('.star')) && !type?.startsWith('generic.icon.') && !type?.startsWith('generic.emoji.')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${displayWidth / 2},${strokeWidth / 2} 
                L ${displayWidth * 0.61},${displayHeight * 0.38} 
                L ${displayWidth - strokeWidth / 2},${displayHeight * 0.38} 
                L ${displayWidth * 0.68},${displayHeight * 0.62} 
                L ${displayWidth * 0.82},${displayHeight - strokeWidth / 2} 
                L ${displayWidth / 2},${displayHeight * 0.75} 
                L ${displayWidth * 0.18},${displayHeight - strokeWidth / 2} 
                L ${displayWidth * 0.32},${displayHeight * 0.62} 
                L ${strokeWidth / 2},${displayHeight * 0.38} 
                L ${displayWidth * 0.39},${displayHeight * 0.38} Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Cloud (exclude icon/emoji)
    if ((type === 'generic.object.cloud' || type?.endsWith('.cloud')) && !type?.startsWith('generic.icon.') && !type?.startsWith('generic.emoji.')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${displayWidth * 18 / 100},${displayHeight * 50 / 60}
                L ${displayWidth * 82 / 100},${displayHeight * 50 / 60}
                C ${displayWidth * 92 / 100},${displayHeight * 50 / 60} ${displayWidth * 96 / 100},${displayHeight * 42 / 60} ${displayWidth * 92 / 100},${displayHeight * 34 / 60}
                C ${displayWidth * 98 / 100},${displayHeight * 28 / 60} ${displayWidth * 92 / 100},${displayHeight * 16 / 60} ${displayWidth * 80 / 100},${displayHeight * 18 / 60}
                C ${displayWidth * 78 / 100},${displayHeight * 8 / 60} ${displayWidth * 64 / 100},${displayHeight * 6 / 60} ${displayWidth * 56 / 100},${displayHeight * 14 / 60}
                C ${displayWidth * 50 / 100},${displayHeight * 4 / 60} ${displayWidth * 36 / 100},${displayHeight * 4 / 60} ${displayWidth * 30 / 100},${displayHeight * 16 / 60}
                C ${displayWidth * 18 / 100},${displayHeight * 10 / 60} ${displayWidth * 6 / 100},${displayHeight * 22 / 60} ${displayWidth * 12 / 100},${displayHeight * 34 / 60}
                C ${displayWidth * 4 / 100},${displayHeight * 38 / 60} ${displayWidth * 8 / 100},${displayHeight * 50 / 60} ${displayWidth * 18 / 100},${displayHeight * 50 / 60} Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Parallelogram
    if (type === 'generic.object.parallelogram' || type?.endsWith('.parallelogram')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={`${displayWidth * 0.2},${strokeWidth} ${displayWidth - strokeWidth},${strokeWidth} ${displayWidth * 0.8},${displayHeight - strokeWidth} ${strokeWidth},${displayHeight - strokeWidth}`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Chevron
    if (type === 'generic.object.chevron' || type?.endsWith('.chevron')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.3},${strokeWidth} 
                L ${displayWidth - strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.3},${displayHeight - strokeWidth} 
                Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Loop (sequence diagram self-loop - curved path)
    if (type === 'generic.object.loop' || type?.endsWith('.loop')) {
      const lineColor = stroke || '#6b7280';
      const pathD = `M 0 0 C ${displayWidth} 0, ${displayWidth} ${displayHeight}, 0 ${displayHeight}`;
      return (
        <svg {...commonSvgProps}>
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth={strokeWidth || 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    // Trapezoid
    if (type === 'generic.object.trapezoid' || type?.endsWith('.trapezoid')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={`${displayWidth * 0.25},${strokeWidth} ${displayWidth * 0.75},${strokeWidth} ${displayWidth - strokeWidth},${displayHeight - strokeWidth} ${strokeWidth},${displayHeight - strokeWidth}`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Kite
    if (type === 'generic.object.kite' || type?.endsWith('.kite')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={`${displayWidth / 2},${strokeWidth} ${displayWidth * 0.75},${displayHeight * 0.4} ${displayWidth / 2},${displayHeight - strokeWidth} ${displayWidth * 0.25},${displayHeight * 0.4}`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Hexagon
    if (type === 'generic.object.hexagon' || type?.endsWith('.hexagon')) {
      const coords = getGradientCoordinates(gradientAngle);
      const hexWidth = displayWidth - strokeWidth;
      const hexHeight = displayHeight - strokeWidth;
      const centerX = hexWidth / 2 + strokeWidth / 2;
      const centerY = hexHeight / 2 + strokeWidth / 2;
      const radius = Math.min(hexWidth, hexHeight) / 2;
      
      const hexPoints = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        hexPoints.push(`${x},${y}`);
      }
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={hexPoints.join(' ')}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Pentagon
    if (type === 'generic.object.pentagon' || type?.endsWith('.pentagon')) {
      const coords = getGradientCoordinates(gradientAngle);
      const pentWidth = displayWidth - strokeWidth;
      const pentHeight = displayHeight - strokeWidth;
      const centerX = pentWidth / 2 + strokeWidth / 2;
      const centerY = pentHeight / 2 + strokeWidth / 2;
      const radius = Math.min(pentWidth, pentHeight) / 2;
      
      const pentPoints = [];
      for (let i = 0; i < 5; i++) {
        const angle = (2 * Math.PI / 5) * i - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        pentPoints.push(`${x},${y}`);
      }
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={pentPoints.join(' ')}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Octagon
    if (type === 'generic.object.octagon' || type?.endsWith('.octagon')) {
      const coords = getGradientCoordinates(gradientAngle);
      const octWidth = displayWidth - strokeWidth;
      const octHeight = displayHeight - strokeWidth;
      const centerX = octWidth / 2 + strokeWidth / 2;
      const centerY = octHeight / 2 + strokeWidth / 2;
      const radius = Math.min(octWidth, octHeight) / 2;
      
      const octPoints = [];
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        octPoints.push(`${x},${y}`);
      }
      
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <polygon
            points={octPoints.join(' ')}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Jigsaw
    if (type === 'generic.object.jigsaw' || type?.endsWith('.jigsaw')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${strokeWidth},${displayHeight * 0.3} 
                Q ${strokeWidth},${displayHeight * 0.1} ${displayWidth * 0.2},${strokeWidth} 
                L ${displayWidth * 0.4},${strokeWidth} 
                Q ${displayWidth * 0.5},${displayHeight * 0.1} ${displayWidth * 0.6},${strokeWidth} 
                L ${displayWidth * 0.8},${strokeWidth} 
                Q ${displayWidth - strokeWidth},${displayHeight * 0.1} ${displayWidth - strokeWidth},${displayHeight * 0.3} 
                L ${displayWidth - strokeWidth},${displayHeight * 0.7} 
                Q ${displayWidth - strokeWidth},${displayHeight * 0.9} ${displayWidth * 0.8},${displayHeight - strokeWidth} 
                L ${displayWidth * 0.6},${displayHeight - strokeWidth} 
                Q ${displayWidth * 0.5},${displayHeight * 0.9} ${displayWidth * 0.4},${displayHeight - strokeWidth} 
                L ${displayWidth * 0.2},${displayHeight - strokeWidth} 
                Q ${strokeWidth},${displayHeight * 0.9} ${strokeWidth},${displayHeight * 0.7} 
                Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Arrowhead
    if (type === 'generic.object.arrowhead' || type?.endsWith('.arrowhead')) {
      const coords = getGradientCoordinates(gradientAngle);
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <path
            d={`M ${strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.7},${strokeWidth} 
                L ${displayWidth - strokeWidth},${displayHeight / 2} 
                L ${displayWidth * 0.7},${displayHeight - strokeWidth} 
                Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    if (type === 'generic.object.rounded-rectangle' || type?.endsWith('.rounded-rectangle')) {
      const coords = getGradientCoordinates(gradientAngle);
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const radius = cr * Math.min(displayWidth, displayHeight) * 0.5; // 0=straight, 1=full pill
      const iw = Math.max(0, displayWidth - strokeWidth);
      const ih = Math.max(0, displayHeight - strokeWidth);
      const hx = strokeWidth / 2;
      const hy = strokeWidth / 2;
      const meshUid = `sp-rr-${gradientId.replace(/:/g, '')}`;

      if (effectiveBackgroundStyle === 'mesh_gradient') {
        const { defs: mgDefs, fillClipGroup } = roundedRectangleMeshGradientSvg({
          uidBase: meshUid,
          innerX: hx,
          innerY: hy,
          innerW: iw,
          innerH: ih,
          rx: radius,
          ry: radius,
          baseColor: effectiveBackgroundColor,
          points: meshGradientPoints ?? [],
        });
        return (
          <svg {...commonSvgProps}>
            <defs>
              {borderStyle === 'gradient' && (
                <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                  <stop offset="0%" stopColor={borderColorArray[0]} />
                  <stop offset="100%" stopColor={borderColorArray[1]} />
                </linearGradient>
              )}
            </defs>
            {mgDefs}
            {fillClipGroup}
            <rect
              x={hx}
              y={hy}
              width={iw}
              height={ih}
              rx={radius}
              ry={radius}
              fill="none"
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            />
          </svg>
        );
      }

      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                  <stop offset="0%" stopColor={bgColors[0]} />
                  <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                  <stop offset="0%" stopColor={borderColorArray[0]} />
                  <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={iw}
            height={ih}
            rx={radius}
            ry={radius}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
        </svg>
      );
    }

    if (type === 'generic.object.mind-map-node' || type?.endsWith('.mind-map-node')) {
      const coords = getGradientCoordinates(gradientAngle);
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const iw = Math.max(0, displayWidth - strokeWidth);
      const ih = Math.max(0, displayHeight - strokeWidth);
      const hx = strokeWidth / 2;
      const hy = strokeWidth / 2;
      const ccx = hx + iw / 2;
      const ccy = hy + ih / 2;
      const cornerPx = cr * Math.min(iw, ih);
      const kind = normalizeCompositeBodyShapeKind(compositeBodyShape);

      if (effectiveBackgroundStyle === 'mesh_gradient') {
        const meshUid = `sp-mm-${gradientId.replace(/:/g, '')}`;
        const desc = compositeCardSilhouetteMeshDescriptor(kind, ccx, ccy, iw, ih, cornerPx);
        const { defs: mgDefs, fillClipGroup } = clippedMeshGradientSvg({
          uidBase: meshUid,
          innerX: desc.innerX,
          innerY: desc.innerY,
          innerW: desc.innerW,
          innerH: desc.innerH,
          baseColor: effectiveBackgroundColor,
          points: meshGradientPoints ?? [],
          clipPathChildren: desc.clipPathChildren,
        });
        const strokePaint =
          borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor;
        return (
          <svg {...commonSvgProps}>
            <defs>
              {borderStyle === 'gradient' && (
                <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                  <stop offset="0%" stopColor={borderColorArray[0]} />
                  <stop offset="100%" stopColor={borderColorArray[1]} />
                </linearGradient>
              )}
            </defs>
            {mgDefs}
            {fillClipGroup}
            <CompositeCardSilhouette
              kind={kind}
              cx={ccx}
              cy={ccy}
              w={iw}
              h={ih}
              cornerRadiusPx={cornerPx}
              fill="none"
              stroke={strokePaint}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            />
          </svg>
        );
      }

      const fillPaint =
        effectiveBackgroundStyle === 'gradient'
          ? `url(#${gradientId})`
          : effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted'
            ? 'transparent'
            : effectiveBackgroundColor;
      const strokePaint =
        borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor;
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                  <stop offset="0%" stopColor={bgColors[0]} />
                  <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                  <stop offset="0%" stopColor={borderColorArray[0]} />
                  <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <CompositeCardSilhouette
            kind={kind}
            cx={ccx}
            cy={ccy}
            w={iw}
            h={ih}
            cornerRadiusPx={cornerPx}
            fill={fillPaint}
            stroke={strokePaint}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
          />
        </svg>
      );
    }

    // Progress bar (track = Background; completion fill below)
    if (type === 'generic.object.progress-bar' || type?.endsWith('.progress-bar')) {
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      const iw = Math.max(0, displayWidth - sw);
      const ih = Math.max(0, displayHeight - sw);
      const hx = sw / 2;
      const hy = sw / 2;
      const radius = cr * Math.min(iw, ih) * 0.5;
      const pct = 0.62;
      const fillWidth = iw * pct;
      const cid = gradientId.replace(/:/g, '');
      const bgCoords = getGradientCoordinates(gradientAngle);
      const fillCoords = getGradientCoordinates(90);
      const fillG = `${cid}-dw-pbf`;
      const trackFill =
        effectiveBackgroundStyle === 'gradient'
          ? `url(#${gradientId})`
          : effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted'
            ? 'transparent'
            : effectiveBackgroundColor;
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={bgCoords.x1} y1={bgCoords.y1} x2={bgCoords.x2} y2={bgCoords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
            <linearGradient id={fillG} x1={fillCoords.x1} y1={fillCoords.y1} x2={fillCoords.x2} y2={fillCoords.y2}>
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <clipPath id={`${cid}-dw-pbc`}>
              <rect x={hx} y={hy} width={iw} height={ih} rx={radius} ry={radius} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${cid}-dw-pbc)`}>
            <rect x={hx} y={hy} width={iw} height={ih} rx={radius} ry={radius} fill={trackFill} />
            {fillWidth > 0 ? (
              <rect x={hx} y={hy} width={fillWidth} height={ih} rx={radius} ry={radius} fill={`url(#${fillG})`} />
            ) : null}
          </g>
          {sw > 0 ? (
            <rect
              x={hx}
              y={hy}
              width={iw}
              height={ih}
              rx={radius}
              ry={radius}
              fill="none"
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={sw}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            />
          ) : null}
          <text
            x={(hx + iw / 2) as number}
            y={(hy + ih / 2) as number}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={textColor}
            fontSize={Math.min(11, ih * 0.42)}
            fontWeight={600}
          >
            62%
          </text>
        </svg>
      );
    }

    // Timeline bar (segmented; preview uses four equal sections)
    if (type === "generic.object.timeline-bar" || type?.endsWith(".timeline-bar")) {
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const sw = borderStyle === "none" ? 0 : strokeWidth;
      const iw = Math.max(0, displayWidth - sw);
      const ih = Math.max(0, displayHeight - sw);
      const hx = sw / 2;
      const hy = sw / 2;
      const radius = cr * Math.min(iw, ih) * 0.5;
      const cid = gradientId.replace(/:/g, "");
      const fills = ["#3b82f6", "#8b5cf6", "#f97316", "#22c55e"];
      const ew = iw / 4;
      const trackFill =
        effectiveBackgroundStyle === "gradient"
          ? `url(#${gradientId})`
          : effectiveBackgroundStyle === "none" || effectiveBackgroundStyle === "frosted"
            ? "transparent"
            : effectiveBackgroundColor;
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === "gradient" && (
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === "gradient" && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
            <clipPath id={`${cid}-tb-prev`}>
              <rect x={hx} y={hy} width={iw} height={ih} rx={radius} ry={radius} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${cid}-tb-prev)`}>
            <rect x={hx} y={hy} width={iw} height={ih} fill={trackFill} />
            {fills.map((c, i) => (
              <rect key={i} x={hx + i * ew} y={hy} width={ew} height={ih} fill={c} opacity={0.92} />
            ))}
          </g>
          {sw > 0 ? (
            <rect
              x={hx}
              y={hy}
              width={iw}
              height={ih}
              rx={radius}
              ry={radius}
              fill="none"
              stroke={
                borderStyle === "gradient"
                  ? `url(#${borderGradientId})`
                  : borderStyle === "none"
                    ? "transparent"
                    : effectiveBorderColor
              }
              strokeWidth={sw}
              strokeDasharray={borderStyle === "dotted" ? "3,3" : undefined}
            />
          ) : null}
        </svg>
      );
    }

    // Segmented rectangle (palette preview: four segments + light gap)
    if (type === "generic.object.segmented-rectangle" || type?.endsWith(".segmented-rectangle")) {
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const sw = borderStyle === "none" ? 0 : strokeWidth;
      const iw = Math.max(0, displayWidth - sw);
      const ih = Math.max(0, displayHeight - sw);
      const hx = sw / 2;
      const hy = sw / 2;
      const radius = cr * Math.min(iw, ih) * 0.5;
      const cid = gradientId.replace(/:/g, "");
      const fills = ["#ea580c", "#f97316", "#fb923c", "#fbbf24"];
      const gap = Math.min(3, iw * 0.04);
      const n = 4;
      const contentW = Math.max(0, iw - gap * (n - 1));
      const ew = contentW / n;
      return (
        <svg {...commonSvgProps}>
          <defs>
            {borderStyle === "gradient" && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
            <clipPath id={`${cid}-sr-prev`}>
              <rect x={hx} y={hy} width={iw} height={ih} rx={radius} ry={radius} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${cid}-sr-prev)`}>
            {fills.map((c, i) => (
              <rect
                key={i}
                x={hx + i * (ew + gap)}
                y={hy}
                width={ew}
                height={ih}
                fill={c}
                opacity={0.92}
              />
            ))}
          </g>
          {sw > 0 ? (
            <rect
              x={hx}
              y={hy}
              width={iw}
              height={ih}
              rx={radius}
              ry={radius}
              fill="none"
              stroke={
                borderStyle === "gradient"
                  ? `url(#${borderGradientId})`
                  : borderStyle === "none"
                    ? "transparent"
                    : effectiveBorderColor
              }
              strokeWidth={sw}
              strokeDasharray={borderStyle === "dotted" ? "3,3" : undefined}
            />
          ) : null}
        </svg>
      );
    }

    // Pyramid (segmented; preview uses narrow-at-top + four tiers)
    if (type === "generic.object.pyramid" || type?.endsWith(".pyramid")) {
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const sw = borderStyle === "none" ? 0 : strokeWidth;
      const iw = Math.max(0, displayWidth - sw);
      const ih = Math.max(0, displayHeight - sw);
      const hx = sw / 2;
      const hy = sw / 2;
      const radius = cr * Math.min(iw, ih) * 0.5;
      const cid = gradientId.replace(/:/g, "");
      const tierCount = 4;
      const n = tierCount;
      const gapPx = Math.min(Math.max(ih * 0.035, 0), 14);
      const tierHRaw = ih - gapPx * Math.max(0, n - 1);
      const tierH = n > 0 && tierHRaw > 0 ? tierHRaw / n : ih / Math.max(n, 1);
      const apex = 0.12;
      const direction: PyramidDirection = "narrow-at-top";
      const cx = hx + iw / 2;
      const hueBase = "#94a3b8";
      const pyGradCoords = getGradientCoordinates(gradientAngle);
      const pyUseThemeHueGradientTiers =
        effectiveBackgroundStyle === "gradient" && bgColors.length >= 2;
      const tierBands: { yBottom: number; yTop: number }[] = [];
      let yCursor = hy + ih;
      for (let di = 0; di < n; di++) {
        const bandH = Math.max(1, tierH);
        const yTopBand = yCursor - bandH;
        tierBands.push({ yBottom: yCursor, yTop: yTopBand });
        yCursor = yTopBand - gapPx;
      }
      let yLo = Infinity;
      let yHi = -Infinity;
      for (const b of tierBands) {
        yLo = Math.min(yLo, b.yTop, b.yBottom);
        yHi = Math.max(yHi, b.yTop, b.yBottom);
      }
      const { stackYWide, stackYNarrow } = pyramidStackWideNarrowYs(direction, yLo, yHi);
      const wp: PyramidInterpolatedWidthParams = {
        stackYWide,
        stackYNarrow,
        apexFraction: apex,
        direction,
      };

      const tierPaths = Array.from({ length: tierCount }, (_, i) => {
        const band = tierBands[i];
        const wb = iw * pyramidWidthFracAtY(band.yBottom, wp);
        const wt = iw * pyramidWidthFracAtY(band.yTop, wp);
        const xl0 = cx - wb / 2;
        const xr0 = cx + wb / 2;
        const xl1 = cx - wt / 2;
        const xr1 = cx + wt / 2;
        const yB = band.yBottom;
        const yT = band.yTop;
        const d = `M ${xl0} ${yB} L ${xr0} ${yB} L ${xr1} ${yT} L ${xl1} ${yT} Z`;
        const fillHue = shiftHueOfColor(hueBase, i * themeMenuHueStepDeg);
        const fillAttr = pyUseThemeHueGradientTiers ? `url(#${cid}-py-th-${i})` : fillHue;
        const segStrokeAttr = pyUseThemeHueGradientTiers
          ? sw > 0
            ? `url(#${cid}-py-th-stroke-${i})`
            : "none"
          : sw > 0
            ? multiplyLightnessOfColor(fillHue, 0.62)
            : "none";
        return (
          <path
            key={`py-prev-${i}`}
            d={d}
            fill={fillAttr}
            opacity={0.95}
            stroke={segStrokeAttr}
            strokeWidth={sw}
            strokeDasharray={borderStyle === "dotted" ? "3,3" : undefined}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="miter"
          />
        );
      });
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === "gradient" && (
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === "gradient" && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
            <clipPath id={`${cid}-py-prev`}>
              <rect x={hx} y={hy} width={iw} height={ih} rx={radius} ry={radius} />
            </clipPath>
            {pyUseThemeHueGradientTiers
              ? Array.from({ length: tierCount }, (_, pi) => {
                  const c0 = shiftHueOfColor(bgColors[0], pi * themeMenuHueStepDeg);
                  const c1 = shiftHueOfColor(bgColors[1] ?? bgColors[0], pi * themeMenuHueStepDeg);
                  return (
                    <React.Fragment key={`py-th-def-${pi}`}>
                      <linearGradient
                        id={`${cid}-py-th-${pi}`}
                        x1={pyGradCoords.x1}
                        y1={pyGradCoords.y1}
                        x2={pyGradCoords.x2}
                        y2={pyGradCoords.y2}
                      >
                        <stop offset="0%" stopColor={c0} />
                        <stop offset="100%" stopColor={c1} />
                      </linearGradient>
                      {sw > 0 ? (
                        <linearGradient
                          id={`${cid}-py-th-stroke-${pi}`}
                          x1={pyGradCoords.x1}
                          y1={pyGradCoords.y1}
                          x2={pyGradCoords.x2}
                          y2={pyGradCoords.y2}
                        >
                          <stop offset="0%" stopColor={multiplyLightnessOfColor(c0, 0.62)} />
                          <stop offset="100%" stopColor={multiplyLightnessOfColor(c1, 0.62)} />
                        </linearGradient>
                      ) : null}
                    </React.Fragment>
                  );
                })
              : null}
          </defs>
          <g clipPath={`url(#${cid}-py-prev)`}>{tierPaths}</g>
        </svg>
      );
    }

    // Text box with heading (rounded body + top heading strip)
    if (type === 'generic.object.text-box-heading' || type?.endsWith('.text-box-heading')) {
      const coords = getGradientCoordinates(gradientAngle);
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const radius = cr * Math.min(displayWidth, displayHeight) * 0.5;
      const stripH = Math.max(displayHeight * 0.22, 4);
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      const iw = Math.max(0, displayWidth - sw);
      const ih = Math.max(0, displayHeight - sw);
      const hx1 = sw / 2;
      const hy1 = sw / 2;
      const hx2 = hx1 + iw;
      const hb = hy1 + stripH;
      const hdg = `${gradientId}-hdg`;
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
            {!headingStripSolid && (
              <linearGradient id={hdg} x1="0%" y1="0%" x2="0%" y2="100%" gradientUnits="objectBoundingBox">
                <stop offset="0%" stopColor={headingStripColor} stopOpacity={1} />
                <stop offset="100%" stopColor={headingStripColor} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <rect
            x={sw / 2}
            y={sw / 2}
            width={iw}
            height={ih}
            rx={radius}
            ry={radius}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
          />
          <path
            d={`M ${hx1 + radius} ${hy1} L ${hx2 - radius} ${hy1} Q ${hx2} ${hy1} ${hx2} ${hy1 + radius} L ${hx2} ${hb} L ${hx1} ${hb} L ${hx1} ${hy1 + radius} Q ${hx1} ${hy1} ${hx1 + radius} ${hy1} Z`}
            fill={headingStripSolid ? headingStripColor : `url(#${hdg})`}
          />
          <rect
            x={sw / 2}
            y={sw / 2}
            width={iw}
            height={ih}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
        </svg>
      );
    }

    // UML Class (rectangle with compartment dividers)
    if (type === 'generic.object.uml-class' || type?.endsWith('.uml-class')) {
      const coords = getGradientCoordinates(gradientAngle);
      const sw = borderStyle === 'none' ? 0 : strokeWidth;
      return (
        <svg {...commonSvgProps}>
          <defs>
            {effectiveBackgroundStyle === 'gradient' && (
              <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
              </linearGradient>
            )}
            {borderStyle === 'gradient' && (
              <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
              </linearGradient>
            )}
          </defs>
          <rect
            x={sw / 2}
            y={sw / 2}
            width={Math.max(0, displayWidth - sw)}
            height={Math.max(0, displayHeight - sw)}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={sw}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
          <line x1={sw} y1={displayHeight / 3} x2={displayWidth - sw} y2={displayHeight / 3} stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : effectiveBorderColor} strokeWidth={1} />
          <line x1={sw} y1={(2 * displayHeight) / 3} x2={displayWidth - sw} y2={(2 * displayHeight) / 3} stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : effectiveBorderColor} strokeWidth={1} />
        </svg>
      );
    }

    // Rectangle / Square (Default)
    const coords = getGradientCoordinates(gradientAngle);
    // Calculate borderRadius when roundedEdges is enabled (6% of smaller dimension)
    const borderRadius = roundedEdges ? Math.min(displayWidth, displayHeight) * 0.06 : 0;
    return (
      <svg {...commonSvgProps}>
        <defs>
          {effectiveBackgroundStyle === 'gradient' && (
            <linearGradient id={gradientId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
                <stop offset="0%" stopColor={bgColors[0]} />
                <stop offset="100%" stopColor={bgColors[1]} />
            </linearGradient>
          )}
          {borderStyle === 'gradient' && (
            <linearGradient id={borderGradientId} x1={borderCoords.x1} y1={borderCoords.y1} x2={borderCoords.x2} y2={borderCoords.y2}>
                <stop offset="0%" stopColor={borderColorArray[0]} />
                <stop offset="100%" stopColor={borderColorArray[1]} />
            </linearGradient>
          )}
        </defs>
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={Math.max(0, displayWidth - strokeWidth)}
            height={Math.max(0, displayHeight - strokeWidth)}
            rx={borderRadius}
            ry={borderRadius}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : (effectiveBackgroundStyle === 'none' || effectiveBackgroundStyle === 'frosted') ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
      </svg>
    );
  };

  return (
    <>
      <div
        className="relative flex items-center justify-center"
        style={{
          width: displayWidth,
          height: displayHeight,
          filter: shadow ? 'var(--shape-shadow-preview)' : undefined,
        }}
      >
        {renderShape()}

        {label && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-1">
            <span
              className="font-medium leading-tight text-center"
              style={{
                color: textColor,
                fontFamily,
                fontWeight: fontWeight as any,
                fontStyle: fontStyle as any,
                textDecoration,
                fontSize: `${fontSize}px`,
                textShadow:
                  labelTextShadow ??
                  (shadow ? 'var(--shape-text-shadow)' : undefined),
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </div>
        )}
      </div>
      {pieSliceTooltip != null && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[10000] rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
              style={{ left: pieSliceTooltip.x + 12, top: pieSliceTooltip.y + 12 }}
            >
              {pieSliceTooltip.text}
            </div>,
            document.body
          )
        : null}
      {barPreviewCellTooltip != null && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[10000] rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
              style={{
                left: barPreviewCellTooltip.x + 12,
                top: barPreviewCellTooltip.y + 12,
              }}
            >
              {barPreviewCellTooltip.text}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
