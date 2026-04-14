/** Client → SVG user space (viewBox units) for chart interaction. */
export function svgUserPointFromClient(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Map SVG Y to value on a vertical value axis (Y grows down; bottom of plot =0). */
export function chartValueFromVerticalValueAxis(
  svgY: number,
  plotY0: number,
  plotH: number,
  valueAxisMax: number
): number {
  if (!Number.isFinite(svgY) || plotH <= 0 || !Number.isFinite(valueAxisMax) || valueAxisMax <= 0) {
    return 0;
  }
  const t = (plotY0 + plotH - svgY) / plotH;
  const v = t * valueAxisMax;
  return Math.max(0, Number.isFinite(v) ? v : 0);
}

/** Map SVG X to value on a horizontal value axis (X grows right; left of plot = 0). */
export function chartValueFromHorizontalValueAxis(
  svgX: number,
  plotX0: number,
  plotW: number,
  valueAxisMax: number
): number {
  if (!Number.isFinite(svgX) || plotW <= 0 || !Number.isFinite(valueAxisMax) || valueAxisMax <= 0) {
    return 0;
  }
  const t = (svgX - plotX0) / plotW;
  const v = t * valueAxisMax;
  return Math.max(0, Number.isFinite(v) ? v : 0);
}
