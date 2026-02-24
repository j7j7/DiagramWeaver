#!/usr/bin/env node
/**
 * Validates Mermaid import - parses example .mmd files and reports results.
 * Run: npm run validate-mermaid
 *
 * For full fidelity (uses real mermaid-parser): start dev server and visit
 * GET http://localhost:9002/api/validate-mermaid
 * Or in browser console: fetch('/api/validate-mermaid').then(r=>r.json()).then(console.log)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Inline minimal parser for validation (avoids ESM/TS import issues in plain Node)
function parseMermaidFlowchart(text) {
  const errors = [];
  const nodeMap = new Map();
  const edges = [];
  let direction = 'TD';

  const lines = text.split(/\r?\n/).map(l => l.trim());
  const flowStartIdx = lines.findIndex(l => /^\s*(?:flowchart|graph)\s+(TD|TB|BT|RL|LR)\s*$/i.test(l));
  const startIdx = flowStartIdx >= 0 ? flowStartIdx : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (/^\s*%%/.test(line)) continue;
    if (line === '---' || line.startsWith('---')) continue;
    if (/^\s*style\s+/i.test(line)) continue;
    if (/^\s*config\s*:/i.test(line)) continue;
    if (/^\s*[\w-]+\s*:/i.test(line) && !/^\s*(?:flowchart|graph)\s+/i.test(line)) continue;
    if (/^\s*subgraph\s+/i.test(line) || /^\s*end\s*$/i.test(line)) continue;

    const dirMatch = line.match(/^\s*(?:flowchart|graph)\s+(TD|TB|BT|RL|LR)\s*$/i);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase() === 'TB' ? 'TD' : dirMatch[1];
      continue;
    }

    // Simplified: just detect node/edge patterns to avoid full parse
    const edgeMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:--|==|-\.)(?:[^>]*(?:--|==|-\.)?)?>\s*(.+)$/);
    if (edgeMatch) {
      const toId = edgeMatch[2].match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1] || edgeMatch[2];
      edges.push({ from: edgeMatch[1], to: toId });
      if (!nodeMap.has(edgeMatch[1])) nodeMap.set(edgeMatch[1], true);
      if (!nodeMap.has(toId)) nodeMap.set(toId, true);
      continue;
    }

    const nodeMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*[\[\(\{\<]/);
    if (nodeMatch) {
      nodeMap.set(nodeMatch[1], true);
      continue;
    }

    if (line.length > 0) {
      errors.push(`Line ${i + 1}: Could not parse "${line.slice(0, 50)}${line.length > 50 ? '...' : ''}"`);
    }
  }

  const nodes = Array.from(nodeMap.keys()).map(id => ({ id, label: id }));
  return { direction, nodes, edges, errors };
}

const examples = [
  'public/examples/simple.mmd',
  'public/examples/complex.mmd',
  'public/examples/Incident Management-2026-02-24-003424.mmd',
];

console.log('=== Mermaid Validation ===\n');

let failed = 0;
for (const relPath of examples) {
  const path = join(ROOT, relPath);
  if (!existsSync(path)) {
    console.log(`SKIP ${relPath} (not found)`);
    continue;
  }
  try {
    const text = readFileSync(path, 'utf8');
    const result = parseMermaidFlowchart(text);
    const hasContent = result.nodes.length > 0 || result.edges.length > 0;
    const hasErrors = result.errors.length > 0;

    if (hasErrors) {
      console.log(`FAIL ${relPath}`);
      console.log('  Errors:', result.errors);
      failed++;
    } else if (hasContent) {
      console.log(`OK   ${relPath} (${result.nodes.length} nodes, ${result.edges.length} edges)`);
    } else {
      console.log(`WARN ${relPath} (no nodes/edges found)`);
    }
  } catch (e) {
    console.log(`ERR  ${relPath}:`, e.message);
    failed++;
  }
}

console.log(`\nDone. ${failed > 0 ? failed + ' failed' : 'All passed'}.`);
