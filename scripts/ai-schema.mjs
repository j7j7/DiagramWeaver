#!/usr/bin/env node
/**
 * Generate and validate the LLM diagram-authoring schema.
 * Usage:
 *   node scripts/ai-schema.mjs generate
 *   node scripts/ai-schema.mjs validate
 *   node scripts/ai-schema.mjs check
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { validateAuthoringPack } from "./ai-schema-validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/ai-schema");
const RESOURCES = join(ROOT, "public/resources");

function slugify(name) {
  return String(name).replace(/\s+/g, "-").toLowerCase();
}

function paletteType(provider, category, name) {
  const slug = slugify(name);
  if (provider === "generic" && category === "text" && slug === "text-box-heading") {
    return "generic.object.text-box-heading";
  }
  if (provider === "generic" && category === "object") {
    const charts = {
      "pie-chart": "generic.chart.pie",
      "bar-chart": "generic.chart.bar",
      "line-chart": "generic.chart.line",
      "ring-chart": "generic.chart.ring",
      "grid-chart": "generic.chart.grid",
      "gantt-chart": "generic.chart.gantt",
      "loop-chart": "generic.chart.loop",
      "arrow-chart": "generic.chart.arrow",
    };
    if (charts[slug]) return charts[slug];
  }
  if (provider === "generic" && category === "cards") return `generic.card.${slug}`;
  if (provider === "generic" && category === "borders") return `generic.border.${slug}`;
  return `${provider}.${category}.${slug}`;
}

function familyOf(type) {
  if (type.startsWith("generic.chart.")) return "chart";
  if (type.startsWith("generic.card.")) return "card";
  if (type.startsWith("generic.border.")) return "border";
  if (type.startsWith("generic.text.")) return "text";
  if (type.startsWith("generic.icon.") || type.startsWith("generic.emoji.")) return "icon";
  if (type === "generic.object.line") return "line";
  if (type === "generic.object.timeline") return "timeline";
  if (type === "generic.object.timeline-bar") return "timeline-bar";
  if (type === "generic.object.segmented-rectangle") return "segmented-rectangle";
  if (type === "generic.object.pyramid") return "pyramid";
  if (type === "generic.object.progress-bar") return "progress-bar";
  if (type === "generic.object.uml-class") return "uml";
  if (type === "generic.object.mind-map-node") return "mindmap";
  if (type === "generic.object.text-box-heading") return "text-box-heading";
  if (type.startsWith("generic.object.")) return "shape";
  return "resource";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectResourceTypes() {
  const index = readJson(join(RESOURCES, "resource-components.json"));
  const types = [];
  const seen = new Set();
  const providers = [];

  for (const [providerKey, provider] of Object.entries(index.providers || {})) {
    const file = join(RESOURCES, provider.file);
    if (!existsSync(file)) continue;
    const catalog = readJson(file);
    const categories = [];
    let count = 0;
    for (const [categoryKey, category] of Object.entries(catalog.categories || {})) {
      const resources = Array.isArray(category.resources) ? category.resources : [];
      categories.push({ id: categoryKey, name: category.name || categoryKey, count: resources.length });
      for (const resource of resources) {
        const type = paletteType(providerKey, categoryKey, resource.name);
        if (seen.has(type)) continue;
        seen.add(type);
        count += 1;
        types.push({
          type,
          name: resource.name,
          provider: providerKey,
          category: categoryKey,
          family: familyOf(type),
          enabled: !!provider.enabled,
        });
      }
    }
    providers.push({
      id: providerKey,
      name: provider.name || providerKey,
      enabled: !!provider.enabled,
      file: provider.file,
      typeCount: count,
      categories,
    });
  }

  return { types, providers, indexVersion: index.version };
}

function extractLucideIcons(src) {
  const icons = [];
  const re = /icon\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    icons.push({
      name: m[1],
      iconName: m[2],
      type: `generic.icon.${slugify(m[2])}`,
      iconType: "lucide",
    });
  }
  return icons;
}

function extractEmojiIcons(src) {
  const start = src.indexOf("export const EMOJI_ICONS");
  if (start < 0) return [];
  const block = src.slice(start, src.indexOf("];", start) + 2);
  const icons = [];
  const re = /name:\s*"([^"]+)"[\s\S]*?emoji:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(block))) {
    icons.push({
      name: m[1],
      emoji: m[2],
      type: `generic.emoji.${slugify(m[1])}`,
      iconType: "emoji",
    });
  }
  return icons;
}

function extractThemesFromSource(src, sourceFile) {
  const themes = [];
  const re =
    /id:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"][\s\S]{0,1800}?properties:\s*\{([\s\S]*?)\n\s{4,6}\}/g;
  let m;
  while ((m = re.exec(src))) {
    const props = m[3];
    const pick = (key) => {
      const hit = props.match(new RegExp(`${key}:\\s*['"]([^'"]+)['"]`));
      return hit ? hit[1] : undefined;
    };
    const pickList = (key) => {
      const hit = props.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`));
      if (!hit) return undefined;
      return [...hit[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
    };
    themes.push({
      id: m[1],
      name: m[2],
      source: sourceFile,
      borderStyle: pick("borderStyle"),
      borderColor: pick("borderColor"),
      borderColors: pickList("borderColors"),
      backgroundStyle: pick("backgroundStyle"),
      backgroundColor: pick("backgroundColor"),
      backgroundColors: pickList("backgroundColors"),
      textColor: pick("textColor"),
      lineColor: pick("lineColor"),
      lineStyle: pick("lineStyle"),
    });
  }
  return themes;
}

function collectThemes() {
  const files = [
    "src/lib/theme-manager.ts",
    "src/lib/builtin-dark-themes.ts",
    "src/lib/builtin-bright-themes.ts",
  ];
  const themes = [];
  const seen = new Set();
  for (const rel of files) {
    const src = readFileSync(join(ROOT, rel), "utf8");
    for (const theme of extractThemesFromSource(src, rel)) {
      if (seen.has(theme.id)) continue;
      seen.add(theme.id);
      themes.push(theme);
    }
  }
  return themes;
}

function collectBorderTemplates() {
  const src = readFileSync(join(ROOT, "src/lib/border-templates.ts"), "utf8");
  const templates = [];
  const re = /"([a-z0-9-]+)":\s*\{\s*id:\s*"\1"\s*,\s*name:\s*"([^"]+)"\s*,\s*defaultWidth:\s*(\d+)\s*,\s*defaultHeight:\s*(\d+)/g;
  let m;
  while ((m = re.exec(src))) {
    templates.push({
      templateId: m[1],
      nodeType: `generic.border.${m[1]}`,
      name: m[2],
      defaultWidth: Number(m[3]),
      defaultHeight: Number(m[4]),
    });
  }
  return templates;
}

function resolveCardTemplates(sourceCards) {
  return sourceCards.map((card) => {
    if (!card.cloneFrom) return card;
    const base = sourceCards.find((c) => c.templateId === card.cloneFrom);
    if (!base?.defaultElements) return card;
    return { ...card, defaultElements: structuredClone(base.defaultElements) };
  });
}

function buildAuthoringPack() {
  const source = readJson(join(OUT, "authoring-source.json"));
  const { types, providers } = collectResourceTypes();
  const lucideIcons = extractLucideIcons(readFileSync(join(ROOT, "src/lib/icon-resources.ts"), "utf8"));
  const emojiIcons = extractEmojiIcons(readFileSync(join(ROOT, "src/lib/icon-resources.ts"), "utf8"));
  const extraIcons = [
    ...lucideIcons.map((i) => ({
      type: i.type,
      name: i.name,
      provider: "generic",
      category: "icon",
      family: "icon",
      enabled: true,
    })),
    ...emojiIcons.map((i) => ({
      type: i.type,
      name: i.name,
      provider: "generic",
      category: "emoji",
      family: "icon",
      enabled: true,
    })),
    {
      type: "generic.icon.custom",
      name: "Custom image",
      provider: "generic",
      category: "icon",
      family: "icon",
      enabled: true,
    },
  ];
  const typeById = new Map(types.map((t) => [t.type, t]));
  for (const extra of extraIcons) {
    if (!typeById.has(extra.type)) {
      types.push(extra);
      typeById.set(extra.type, extra);
    }
  }

  const cardTemplates = resolveCardTemplates(source.cardTemplates || []);
  const themes = collectThemes();
  const borderTemplates = collectBorderTemplates();
  const genericTypes = types.filter((t) => t.provider === "generic" || t.family === "icon");
  const fixtureDir = join(OUT, "fixtures");
  const examples = {};
  if (existsSync(fixtureDir)) {
    for (const file of readdirSync(fixtureDir).filter((f) => f.endsWith(".json"))) {
      examples[file.replace(/\.json$/, "")] = readJson(join(fixtureDir, file));
    }
  }

  const pack = {
    ...source,
    generatedAt: new Date().toISOString().slice(0, 10),
    catalogs: {
      typeCount: types.length,
      enabledTypeCount: types.filter((t) => t.enabled).length,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        typeCount: p.typeCount,
        categories: p.categories,
      })),
      genericTypes: genericTypes.map((t) => ({ type: t.type, name: t.name, family: t.family, category: t.category })),
      lucideIcons,
      emojiIcons,
      themes,
      borderTemplates,
      cardTemplates,
      resourceTypesFile: "resource-types.json",
    },
    examples,
  };
  delete pack.cardTemplates;
  return { pack, types };
}

function writeGenerated({ pack, types }) {
  mkdirSync(OUT, { recursive: true });
  const authoringPath = join(OUT, "diagram-authoring.json");
  const typesPath = join(OUT, "resource-types.json");
  writeFileSync(authoringPath, `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(
    typesPath,
    `${JSON.stringify(
      {
        generatedAt: pack.generatedAt,
        count: types.length,
        types: types.map((t) => [t.type, t.name, t.provider, t.category, t.family, t.enabled ? 1 : 0]),
        columns: ["type", "name", "provider", "category", "family", "enabled"],
      },
      null,
      2,
    )}\n`,
  );
  return { authoringPath, typesPath };
}

function runValidate() {
  const pack = readJson(join(OUT, "diagram-authoring.json"));
  const typesFile = readJson(join(OUT, "resource-types.json"));
  const fixtureDir = join(OUT, "fixtures");
  const fixtures = existsSync(fixtureDir)
    ? readdirSync(fixtureDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({ name: f, data: readJson(join(fixtureDir, f)) }))
    : [];
  const result = validateAuthoringPack({ pack, typesFile, fixtures, live: collectResourceTypes() });
  return result;
}

function main() {
  const cmd = process.argv[2] || "generate";
  if (cmd === "generate") {
    const built = buildAuthoringPack();
    const paths = writeGenerated(built);
    console.log(`Wrote ${paths.authoringPath}`);
    console.log(`Wrote ${paths.typesPath} (${built.types.length} types)`);
    return;
  }
  if (cmd === "validate" || cmd === "check") {
    if (cmd === "check") {
      const built = buildAuthoringPack();
      const expectedAuthoring = `${JSON.stringify(built.pack, null, 2)}\n`;
      const expectedTypes = `${JSON.stringify(
        {
          generatedAt: built.pack.generatedAt,
          count: built.types.length,
          types: built.types.map((t) => [t.type, t.name, t.provider, t.category, t.family, t.enabled ? 1 : 0]),
          columns: ["type", "name", "provider", "category", "family", "enabled"],
        },
        null,
        2,
      )}\n`;
      const actualAuthoring = readFileSync(join(OUT, "diagram-authoring.json"), "utf8");
      const actualTypes = readFileSync(join(OUT, "resource-types.json"), "utf8");
      const stale =
        stripGeneratedAt(actualAuthoring) !== stripGeneratedAt(expectedAuthoring) ||
        stripGeneratedAt(actualTypes) !== stripGeneratedAt(expectedTypes);
      if (stale) {
        console.error("Generated AI schema files are stale. Run: npm run generate-ai-schema");
        process.exit(1);
      }
    }
    const result = runValidate();
    for (const line of result.logs) console.log(line);
    if (!result.ok) {
      console.error(`\nFAILED (${result.errors.length} error(s))`);
      process.exit(1);
    }
    console.log(`\nOK — ${result.checks} checks`);
    return;
  }
  console.error("Usage: node scripts/ai-schema.mjs generate|validate|check");
  process.exit(2);
}

function stripGeneratedAt(text) {
  return text.replace(/"generatedAt":\s*"[^"]+"/, '"generatedAt":""');
}

if (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1]?.endsWith("ai-schema.mjs")) {
  main();
}

export { paletteType, familyOf, slugify };
