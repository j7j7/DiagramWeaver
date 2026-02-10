import type { DiagramData, HierarchicalDiagramData } from './types';
import { DiagramDataSchema, HierarchicalDiagramDataSchema } from './schemas';
import { convertFromNestedHierarchy } from './nested-hierarchy';

export interface ExportOptions {
  format: 'png' | 'svg';
  quality?: 'low' | 'medium' | 'high';
  backgroundColor?: 'transparent' | 'white';
  width?: number;
  height?: number;
}

export interface ExportResult {
  data: Buffer | string;
  contentType: string;
  filename: string;
}

/**
 * Validate and normalize diagram data for export
 */
export function validateDiagramData(json: unknown): DiagramData {
  // Check if this is hierarchical format
  const isHierarchical = typeof json === 'object' && json !== null &&
    'zones' in json && Array.isArray((json as any).zones) &&
    (json as any).zones.some((zone: any) => 
      zone.children && Array.isArray(zone.children) &&
      zone.children.some((child: any) => child && typeof child === 'object')
    );

  let dataToValidate: unknown = json;

  if (isHierarchical) {
    // Validate hierarchical format first
    const hierarchicalResult = HierarchicalDiagramDataSchema.safeParse(json);
    if (!hierarchicalResult.success) {
      throw new Error(`Invalid hierarchical diagram format: ${hierarchicalResult.error.message}`);
    }
    // Convert hierarchical to flat format
    dataToValidate = convertFromNestedHierarchy(hierarchicalResult.data as HierarchicalDiagramData);
  }

  // Validate flat format
  const flatResult = DiagramDataSchema.safeParse(dataToValidate);
  if (!flatResult.success) {
    throw new Error(`Invalid diagram format: ${flatResult.error.message}`);
  }

  return {
    nodes: flatResult.data.nodes || [],
    connections: flatResult.data.connections || [],
    groupings: flatResult.data.groupings || [],
    layers: flatResult.data.layers,
  } as DiagramData;
}

/**
 * Calculate pixel ratio based on quality setting
 */
export function getPixelRatio(quality: 'low' | 'medium' | 'high'): number {
  switch (quality) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 4;
    default:
      return 2;
  }
}

/**
 * Generate filename for export
 */
export function generateExportFilename(format: 'png' | 'svg', quality: 'low' | 'medium' | 'high'): string {
  const qualitySuffix = quality !== 'medium' ? `-${quality}` : '';
  return `diagram${qualitySuffix}.${format}`;
}

/**
 * Get content type for export format
 */
export function getContentType(format: 'png' | 'svg'): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * NOTE: Actual server-side rendering requires a headless browser (Puppeteer/Playwright)
 * This is a placeholder structure. For production, you would:
 * 
 * 1. Use Puppeteer/Playwright to load the viewer page with the diagram JSON
 * 2. Take a screenshot or export SVG
 * 3. Return the image buffer
 * 
 * Example implementation:
 * 
 * ```typescript
 * import puppeteer from 'puppeteer';
 * 
 * export async function renderDiagramServerSide(
 *   diagramData: DiagramData,
 *   options: ExportOptions
 * ): Promise<ExportResult> {
 *   const browser = await puppeteer.launch();
 *   const page = await browser.newPage();
 *   
 *   // Encode diagram data as base64
 *   const jsonString = JSON.stringify(diagramData);
 *   const base64Json = Buffer.from(jsonString).toString('base64');
 *   
 *   // Load viewer page with diagram data
 *   const viewerUrl = `http://localhost:9002/viewer?json=${encodeURIComponent(base64Json)}`;
 *   await page.goto(viewerUrl, { waitUntil: 'networkidle0' });
 *   
 *   // Take screenshot
 *   const screenshot = await page.screenshot({
 *     type: options.format === 'png' ? 'png' : undefined,
 *     fullPage: true,
 *   });
 *   
 *   await browser.close();
 *   
 *   return {
 *     data: screenshot as Buffer,
 *     contentType: getContentType(options.format),
 *     filename: generateExportFilename(options.format, options.quality || 'medium'),
 *   };
 * }
 * ```
 */
export async function renderDiagramServerSide(
  diagramData: DiagramData,
  options: ExportOptions
): Promise<ExportResult> {
  // This is a placeholder - actual implementation requires headless browser
  throw new Error(
    'Server-side rendering not implemented. ' +
    'Install puppeteer or playwright and implement headless browser rendering. ' +
    'See function comments for example implementation.'
  );
}
