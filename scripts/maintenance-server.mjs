#!/usr/bin/env node
/**
 * Local maintenance API for DiagramWeaver icon generation.
 * Proxies Ollama, validates password, writes SVG assets + catalog entries.
 *
 * Run: npm run maintenance:server
 * Requires .env.local with MAINTENANCE_PASSWORD, OLLAMA_URL, OLLAMA_MODEL.
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, timingSafeEqual } from 'crypto';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

dotenv.config({ path: join(ROOT, '.env.local') });
dotenv.config({ path: join(ROOT, '.env') });

const PORT = parseInt(process.env.MAINTENANCE_PORT || '9005', 10);
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const MAINTENANCE_PASSWORD = process.env.MAINTENANCE_PASSWORD || '';

const GENERIC_CATALOG_PATH = join(ROOT, 'public/resources/resource-generic.json');
const LLM_ICON_DIR = join(ROOT, 'public/resources/generic/llm');
const LLM_CATEGORY = 'llm';
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** @type {Map<string, number>} */
const sessions = new Map();

const ICON_SYSTEM_PROMPT = `You are an SVG icon generator for DiagramWeaver, a technical diagram editor.
Generate a single clean, minimal SVG icon suitable for architecture and flow diagrams.

Rules:
- Output ONLY raw SVG markup — no markdown fences, no explanation, no comments
- Root element must be <svg> with viewBox="0 0 64 64" and xmlns="http://www.w3.org/2000/svg"
- Flat design: 1–3 solid fill colors, no gradients unless essential
- No external references (no images, fonts, or xlink:href to URLs)
- No <script>, no event handlers, no foreignObject
- Center the icon with comfortable padding inside the 64×64 viewBox
- Use simple geometric shapes and paths readable at small sizes`;

function jsonResponse(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(payload);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function pruneSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(token);
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requireSession(req) {
  pruneSessions();
  const token = extractBearerToken(req);
  if (!token || !sessions.has(token)) return null;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return token;
}

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'icon';
}

function extractSvg(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:svg|xml)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const start = cleaned.indexOf('<svg');
  const end = cleaned.lastIndexOf('</svg>');
  if (start === -1 || end === -1) return null;
  return cleaned.slice(start, end + 6);
}

function sanitizeSvg(svg) {
  let out = svg;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/javascript:/gi, '');
  if (!/xmlns=/.test(out)) {
    out = out.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/viewBox=/.test(out)) {
    out = out.replace('<svg', '<svg viewBox="0 0 64 64"');
  }
  return out.trim();
}

function validateSvg(svg) {
  if (!svg || !/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) {
    throw new Error('Model did not return valid SVG markup.');
  }
  if (/<script/i.test(svg)) {
    throw new Error('Generated SVG contained disallowed script tags.');
  }
}

async function callOllama(userPrompt) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: ICON_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Ollama request failed (${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.message?.content ?? data?.response ?? '';
  const svg = sanitizeSvg(extractSvg(content) || '');
  validateSvg(svg);
  return svg;
}

function readGenericCatalog() {
  const raw = readFileSync(GENERIC_CATALOG_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeGenericCatalog(catalog) {
  writeFileSync(GENERIC_CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
}

function addIconToCatalog({ name, fileName }) {
  const catalog = readGenericCatalog();
  if (!catalog.categories) catalog.categories = {};
  if (!catalog.categories[LLM_CATEGORY]) {
    catalog.categories[LLM_CATEGORY] = {
      name: 'LLM Generated',
      path: `generic/${LLM_CATEGORY}`,
      resources: [],
    };
  }
  const category = catalog.categories[LLM_CATEGORY];
  const resources = category.resources || [];
  const slug = slugify(name);
  const duplicate = resources.some(
    (r) => slugify(r.name) === slug || r.file === fileName,
  );
  if (duplicate) {
    throw new Error(`An icon named "${name}" already exists in the LLM category.`);
  }
  resources.push({ name, file: fileName, type: 'shape' });
  category.resources = resources;
  catalog.totalResources = (catalog.totalResources || 0) + 1;
  writeGenericCatalog(catalog);
}

function replaceIconInCatalog({ name, fileName }) {
  const catalog = readGenericCatalog();
  if (!catalog.categories) catalog.categories = {};
  if (!catalog.categories[LLM_CATEGORY]) {
    catalog.categories[LLM_CATEGORY] = {
      name: 'LLM Generated',
      path: `generic/${LLM_CATEGORY}`,
      resources: [],
    };
  }
  const category = catalog.categories[LLM_CATEGORY];
  const resources = category.resources || [];
  const idx = resources.findIndex((r) => r.file === fileName);
  if (idx >= 0) {
    resources[idx].name = name;
  } else {
    resources.push({ name, file: fileName, type: 'shape' });
    catalog.totalResources = (catalog.totalResources || 0) + 1;
  }
  category.resources = resources;
  writeGenericCatalog(catalog);
}

function removeIconFromCatalog(fileName) {
  const catalog = readGenericCatalog();
  const category = catalog.categories?.[LLM_CATEGORY];
  if (!category?.resources) return false;
  const idx = category.resources.findIndex((r) => r.file === fileName);
  if (idx < 0) return false;
  category.resources.splice(idx, 1);
  catalog.totalResources = Math.max(0, (catalog.totalResources || 0) - 1);
  writeGenericCatalog(catalog);
  return true;
}

function listLlmIcons() {
  const catalog = readGenericCatalog();
  const resources = catalog.categories?.[LLM_CATEGORY]?.resources || [];
  return resources.map((r) => {
    const slug = slugify(r.name);
    return {
      name: r.name,
      fileName: r.file,
      resourceType: `generic.${LLM_CATEGORY}.${slug}`,
      publicPath: `/resources/generic/${LLM_CATEGORY}/${r.file}`,
    };
  });
}

function ensureConfigured() {
  if (!MAINTENANCE_PASSWORD) {
    throw new Error('MAINTENANCE_PASSWORD is not set in .env.local');
  }
}

async function handleAuth(req, res) {
  ensureConfigured();
  const body = await readJsonBody(req);
  const password = body.password ?? '';
  if (!safeEqual(password, MAINTENANCE_PASSWORD)) {
    jsonResponse(res, 401, { ok: false, error: 'Invalid password.' });
    return;
  }
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + TOKEN_TTL_MS);
  jsonResponse(res, 200, { ok: true, token, expiresIn: TOKEN_TTL_MS });
}

async function handleGenerate(req, res) {
  ensureConfigured();
  if (!requireSession(req)) {
    jsonResponse(res, 401, { ok: false, error: 'Unauthorized. Sign in again.' });
    return;
  }

  const body = await readJsonBody(req);
  const description = String(body.description ?? '').trim();
  const name = String(body.name ?? '').trim();
  const attempt = Math.max(1, parseInt(String(body.attempt ?? '1'), 10) || 1);
  const replace = Boolean(body.replace);
  const replaceFileName = String(body.replaceFileName ?? '').trim();

  if (!description) {
    jsonResponse(res, 400, { ok: false, error: 'Description is required.' });
    return;
  }
  if (!name) {
    jsonResponse(res, 400, { ok: false, error: 'Icon name is required.' });
    return;
  }

  const slug = slugify(name);
  const fileName = replace && replaceFileName ? replaceFileName : `${slug}.svg`;
  const filePath = join(LLM_ICON_DIR, fileName);

  if (existsSync(filePath) && !replace) {
    jsonResponse(res, 409, { ok: false, error: `File already exists: ${fileName}` });
    return;
  }

  try {
    let userPrompt = `Create an SVG icon for a diagram resource named "${name}".\n\nDescription: ${description}`;
    if (replace) {
      userPrompt += '\n\nReplace the existing saved icon with a fresh design for the same resource name.';
    }
    if (attempt > 1) {
      userPrompt += `\n\nThis is retry attempt ${attempt}. Produce a visibly different design from a typical first attempt while still matching the description.`;
    }
    const svg = await callOllama(userPrompt);

    jsonResponse(res, 200, {
      ok: true,
      name,
      fileName,
      svg,
      attempt,
    });
  } catch (err) {
    jsonResponse(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Icon generation failed.',
    });
  }
}

async function handleConfirm(req, res) {
  ensureConfigured();
  if (!requireSession(req)) {
    jsonResponse(res, 401, { ok: false, error: 'Unauthorized. Sign in again.' });
    return;
  }

  const body = await readJsonBody(req);
  const name = String(body.name ?? '').trim();
  const svgRaw = String(body.svg ?? '').trim();
  const replace = Boolean(body.replace);
  const replaceFileName = String(body.replaceFileName ?? '').trim();

  if (!name) {
    jsonResponse(res, 400, { ok: false, error: 'Icon name is required.' });
    return;
  }
  if (!svgRaw) {
    jsonResponse(res, 400, { ok: false, error: 'SVG content is required.' });
    return;
  }

  const slug = slugify(name);
  const fileName = replace && replaceFileName ? replaceFileName : `${slug}.svg`;
  const filePath = join(LLM_ICON_DIR, fileName);

  if (existsSync(filePath) && !replace) {
    jsonResponse(res, 409, { ok: false, error: `File already exists: ${fileName}` });
    return;
  }

  try {
    const svg = sanitizeSvg(extractSvg(svgRaw) || svgRaw);
    validateSvg(svg);

    mkdirSync(LLM_ICON_DIR, { recursive: true });
    writeFileSync(filePath, `${svg}\n`, 'utf8');
    if (replace) {
      replaceIconInCatalog({ name, fileName });
    } else {
      addIconToCatalog({ name, fileName });
    }

    const resourceType = `generic.${LLM_CATEGORY}.${slugify(name)}`;
    const publicPath = `/resources/generic/${LLM_CATEGORY}/${fileName}`;

    jsonResponse(res, 200, {
      ok: true,
      name,
      fileName,
      resourceType,
      publicPath,
      svg,
    });
  } catch (err) {
    jsonResponse(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not save icon.',
    });
  }
}

async function handleListIcons(req, res) {
  ensureConfigured();
  if (!requireSession(req)) {
    jsonResponse(res, 401, { ok: false, error: 'Unauthorized. Sign in again.' });
    return;
  }
  jsonResponse(res, 200, { ok: true, icons: listLlmIcons() });
}

async function handleDeleteIcon(req, res) {
  ensureConfigured();
  if (!requireSession(req)) {
    jsonResponse(res, 401, { ok: false, error: 'Unauthorized. Sign in again.' });
    return;
  }

  const body = await readJsonBody(req);
  const fileName = String(body.fileName ?? '').trim();
  if (!fileName || !fileName.endsWith('.svg') || fileName.includes('..')) {
    jsonResponse(res, 400, { ok: false, error: 'Valid fileName is required.' });
    return;
  }

  const filePath = join(LLM_ICON_DIR, fileName);
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    removeIconFromCatalog(fileName);
    jsonResponse(res, 200, { ok: true, fileName });
  } catch (err) {
    jsonResponse(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not delete icon.',
    });
  }
}

async function handleHealth(_req, res) {
  jsonResponse(res, 200, {
    ok: true,
    ollamaUrl: OLLAMA_URL,
    model: OLLAMA_MODEL,
    passwordConfigured: Boolean(MAINTENANCE_PASSWORD),
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/maintenance/health') {
      await handleHealth(req, res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/maintenance/icons') {
      await handleListIcons(req, res);
      return;
    }
    if (req.method === 'DELETE' && url.pathname === '/api/maintenance/icons') {
      await handleDeleteIcon(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/maintenance/auth') {
      await handleAuth(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/maintenance/generate-icon') {
      await handleGenerate(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/maintenance/confirm-icon') {
      await handleConfirm(req, res);
      return;
    }
    jsonResponse(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    jsonResponse(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`DiagramWeaver maintenance API listening on http://127.0.0.1:${PORT}`);
  console.log(`  Ollama: ${OLLAMA_URL} (model: ${OLLAMA_MODEL})`);
  if (!MAINTENANCE_PASSWORD) {
    console.warn('  WARNING: MAINTENANCE_PASSWORD is not set — auth will fail.');
  }
});
