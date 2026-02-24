import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseMermaidFlowchart } from '@/lib/mermaid-parser';

const EXAMPLES_DIR = join(process.cwd(), 'public', 'examples');

type ValidationResult = {
  file: string;
  ok: boolean;
  nodes: number;
  edges: number;
  errors: string[];
};

/**
 * GET /api/validate-mermaid
 *
 * Validates all .mmd files in public/examples using the real Mermaid parser.
 * Returns JSON with pass/fail and full error details.
 *
 * Use in browser DevTools: fetch('/api/validate-mermaid').then(r=>r.json()).then(console.log)
 * Or: curl http://localhost:9002/api/validate-mermaid
 */
export async function GET() {
  const results: ValidationResult[] = [];
  let files: string[] = [];

  try {
    if (existsSync(EXAMPLES_DIR)) {
      files = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.mmd'));
    }
  } catch {
    return NextResponse.json(
      { error: 'Cannot read examples directory' },
      { status: 500 }
    );
  }

  if (files.length === 0) {
    return NextResponse.json({
      message: 'No .mmd files found in public/examples',
      results: [],
    });
  }

  for (const filename of files) {
    const filepath = join(EXAMPLES_DIR, filename);
    try {
      const text = readFileSync(filepath, 'utf8');
      const parsed = parseMermaidFlowchart(text);
      const hasContent = parsed.nodes.length > 0 || parsed.edges.length > 0;
      const hasErrors = parsed.errors.length > 0;

      results.push({
        file: filename,
        ok: !hasErrors && hasContent,
        nodes: parsed.nodes.length,
        edges: parsed.edges.length,
        errors: parsed.errors,
      });
    } catch (e) {
      results.push({
        file: filename,
        ok: false,
        nodes: 0,
        edges: 0,
        errors: [e instanceof Error ? e.message : String(e)],
      });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({
    message:
      failed.length > 0
        ? `${failed.length} file(s) failed validation`
        : 'All files passed validation',
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.ok).length,
      failed: failed.length,
    },
  });
}

/**
 * POST /api/validate-mermaid
 *
 * Validates arbitrary Mermaid text from request body.
 * Body: { text: string }
 *
 * Returns parsed result (nodes, edges, errors) for debugging.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text : '';
    if (!text) {
      return NextResponse.json(
        { error: 'Missing or invalid body.text' },
        { status: 400 }
      );
    }
    const parsed = parseMermaidFlowchart(text);
    return NextResponse.json({
      ok: parsed.errors.length === 0 && (parsed.nodes.length > 0 || parsed.edges.length > 0),
      nodes: parsed.nodes.length,
      edges: parsed.edges.length,
      errors: parsed.errors,
      direction: parsed.direction,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
