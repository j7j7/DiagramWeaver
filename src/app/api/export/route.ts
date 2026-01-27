import { NextRequest, NextResponse } from 'next/server';
import { validateDiagramData, getContentType, generateExportFilename } from '@/lib/server-export';
import type { ExportOptions } from '@/lib/server-export';

/**
 * POST /api/export
 * 
 * Export diagram as PNG or SVG image
 * 
 * Request body: {
 *   diagram: DiagramData (JSON object)
 * }
 * 
 * Query parameters:
 *   - format: 'png' | 'svg' (default: 'png')
 *   - quality: 'low' | 'medium' | 'high' (default: 'medium')
 *   - bg: 'transparent' | 'white' (default: 'white')
 * 
 * Returns: Image file with appropriate content-type headers
 */
export async function POST(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'png') as 'png' | 'svg';
    const quality = (searchParams.get('quality') || 'medium') as 'low' | 'medium' | 'high';
    const backgroundColor = (searchParams.get('bg') || 'white') as 'transparent' | 'white';

    // Validate format
    if (format !== 'png' && format !== 'svg') {
      return NextResponse.json(
        { error: 'Invalid format. Must be "png" or "svg"' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    if (!body.diagram) {
      return NextResponse.json(
        { error: 'Missing required field: diagram' },
        { status: 400 }
      );
    }

    // Validate and normalize diagram data
    const diagramData = validateDiagramData(body.diagram);

    // Export options
    const options: ExportOptions = {
      format,
      quality,
      backgroundColor,
    };

    // NOTE: Server-side rendering requires Puppeteer/Playwright
    // For now, return an error with instructions
    // In production, implement headless browser rendering here
    
    // Option 1: Return viewer URL for client-side export
    // This allows the client to render and export the diagram
    const jsonString = JSON.stringify(diagramData);
    const base64Json = Buffer.from(jsonString).toString('base64');
    const viewerUrl = `${request.nextUrl.origin}/viewer?json=${encodeURIComponent(base64Json)}`;

    return NextResponse.json({
      message: 'Server-side rendering not yet implemented. Use viewer URL for client-side export.',
      viewerUrl,
      instructions: [
        '1. Open the viewerUrl in a headless browser (Puppeteer/Playwright)',
        '2. Wait for the diagram to load',
        '3. Take a screenshot or export SVG',
        '4. Return the image buffer',
      ],
      // For development: return the diagram data so client can render it
      diagramData,
      options,
    }, {
      status: 501, // Not Implemented
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Option 2: Implement actual server-side rendering (requires Puppeteer/Playwright)
    /*
    import { renderDiagramServerSide } from '@/lib/server-export';
    
    const result = await renderDiagramServerSide(diagramData, options);
    
    return new NextResponse(result.data, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    */

  } catch (error) {
    console.error('Export API error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { error: 'Failed to export diagram', details: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/export
 * 
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/export',
    method: 'POST',
    description: 'Export diagram as PNG or SVG image',
    requestBody: {
      diagram: 'DiagramData object (JSON)',
    },
    queryParameters: {
      format: 'png | svg (default: png)',
      quality: 'low | medium | high (default: medium)',
      bg: 'transparent | white (default: white)',
    },
    example: {
      url: '/api/export?format=png&quality=medium&bg=white',
      body: {
        diagram: {
          nodes: [],
          connections: [],
          zones: [],
        },
      },
    },
    note: 'Server-side rendering requires Puppeteer/Playwright. Currently returns viewer URL for client-side export.',
  });
}
