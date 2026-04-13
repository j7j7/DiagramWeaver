"use client";

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { polygonToRoundedPath } from '@/components/diagram/shapes/shape-utils';
import { getTextEffectsShadowCss } from '@/lib/text-styling';
import type { NodeChartSpec, NodeChartSpecBar } from '@/lib/types';
import { pieSlicesForSvg, truncatePieSliceLabel, defaultBarChartSpec } from '@/lib/chart-node';
import {
  barChartWantsRoundedColumnEnds,
  barColumnAutoRoundRadius,
  barColumnClipPathHorizontal,
  barColumnClipPathVertical,
  barLegendEntries,
  buildBarChartLayout,
  wrapBarLabelLines,
} from '@/lib/bar-chart-layout';

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
}: ShapePreviewProps) {
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
      const legendYLift = 4.25;
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

    if (type === 'generic.chart.pie' || type?.startsWith('generic.chart.')) {
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
              fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
              stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
              strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
              strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <polygon
              points={points}
              fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            d={`M ${displayWidth * 0.1},${displayHeight * 0.5} 
                C ${displayWidth * 0.1},${displayHeight * 0.36} ${displayWidth * 0.15},${displayHeight * 0.24} ${displayWidth * 0.225},${displayHeight * 0.24} 
                C ${displayWidth * 0.25},${displayHeight * 0.16} ${displayWidth * 0.3},${displayHeight * 0.12} ${displayWidth * 0.35},${displayHeight * 0.16} 
                C ${displayWidth * 0.375},${displayHeight * 0.08} ${displayWidth * 0.425},${displayHeight * 0.04} ${displayWidth * 0.475},${displayHeight * 0.08} 
                C ${displayWidth * 0.525},${displayHeight * 0.04} ${displayWidth * 0.575},${displayHeight * 0.08} ${displayWidth * 0.6},${displayHeight * 0.16} 
                C ${displayWidth * 0.65},${displayHeight * 0.12} ${displayWidth * 0.7},${displayHeight * 0.16} ${displayWidth * 0.725},${displayHeight * 0.24} 
                C ${displayWidth * 0.85},${displayHeight * 0.24} ${displayWidth * 0.9},${displayHeight * 0.36} ${displayWidth * 0.9},${displayHeight * 0.5} 
                C ${displayWidth * 0.94},${displayHeight * 0.52} ${displayWidth * 0.96},${displayHeight * 0.58} ${displayWidth * 0.96},${displayHeight * 0.66} 
                C ${displayWidth * 0.96},${displayHeight * 0.74} ${displayWidth * 0.94},${displayHeight * 0.8} ${displayWidth * 0.9},${displayHeight * 0.82} 
                C ${displayWidth * 0.88},${displayHeight * 0.88} ${displayWidth * 0.84},${displayHeight * 0.9} ${displayWidth * 0.8},${displayHeight * 0.86} 
                C ${displayWidth * 0.76},${displayHeight * 0.9} ${displayWidth * 0.72},${displayHeight * 0.86} ${displayWidth * 0.7},${displayHeight * 0.82} 
                C ${displayWidth * 0.66},${displayHeight * 0.84} ${displayWidth * 0.62},${displayHeight * 0.82} ${displayWidth * 0.6},${displayHeight * 0.78} 
                C ${displayWidth * 0.56},${displayHeight * 0.82} ${displayWidth * 0.52},${displayHeight * 0.78} ${displayWidth * 0.5},${displayHeight * 0.74} 
                C ${displayWidth * 0.48},${displayHeight * 0.78} ${displayWidth * 0.44},${displayHeight * 0.74} ${displayWidth * 0.42},${displayHeight * 0.7} 
                C ${displayWidth * 0.38},${displayHeight * 0.72} ${displayWidth * 0.34},${displayHeight * 0.7} ${displayWidth * 0.32},${displayHeight * 0.66} 
                C ${displayWidth * 0.28},${displayHeight * 0.68} ${displayWidth * 0.24},${displayHeight * 0.66} ${displayWidth * 0.225},${displayHeight * 0.62} 
                C ${displayWidth * 0.18},${displayHeight * 0.64} ${displayWidth * 0.14},${displayHeight * 0.58} ${displayWidth * 0.14},${displayHeight * 0.52} 
                C ${displayWidth * 0.14},${displayHeight * 0.5} ${displayWidth * 0.15},${displayHeight * 0.44} ${displayWidth * 0.2},${displayHeight * 0.42} 
                C ${displayWidth * 0.15},${displayHeight * 0.4} ${displayWidth * 0.1},${displayHeight * 0.46} ${displayWidth * 0.1},${displayHeight * 0.5} Z`}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
            strokeLinejoin={roundedEdges ? 'round' : 'miter'}
            strokeLinecap={roundedEdges ? 'round' : 'butt'}
          />
        </svg>
      );
    }

    // Rounded Rectangle
    if (type === 'generic.object.rounded-rectangle' || type?.endsWith('.rounded-rectangle')) {
      const coords = getGradientCoordinates(gradientAngle);
      const cr = Math.max(0, Math.min(1, cornerRadius));
      const radius = cr * Math.min(displayWidth, displayHeight) * 0.5; // 0=straight, 1=full pill
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
            rx={radius}
            ry={radius}
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
            stroke={borderStyle === 'gradient' ? `url(#${borderGradientId})` : borderStyle === 'none' ? 'transparent' : effectiveBorderColor}
            strokeWidth={borderStyle === 'none' ? 0 : strokeWidth}
            strokeDasharray={borderStyle === 'dotted' ? '3,3' : undefined}
          />
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
            fill={effectiveBackgroundStyle === 'gradient' ? `url(#${gradientId})` : effectiveBackgroundStyle === 'none' ? 'transparent' : effectiveBackgroundColor}
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
                  textEffectsShadow ??
                  (shadow && !(textOutlineWidth != null && textOutlineWidth > 0)
                    ? 'var(--shape-text-shadow)'
                    : undefined),
                ...(textOutlineWidth != null && textOutlineWidth > 0
                  ? { WebkitTextStroke: `${textOutlineWidth}px ${textOutlineColor ?? "#ffffff"}` }
                  : {}),
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
