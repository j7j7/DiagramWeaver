/**
 * Structural validation for LLM diagram JSON.
 * Mirrors importer rules that Zod does not encode (type catalogs, family payloads).
 */

function familyOf(type) {
  if (!type) return "unknown";
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

function walkCardElements(el, visit) {
  if (!el || typeof el !== "object") return;
  visit(el);
  for (const child of el.children || []) walkCardElements(child, visit);
}

/**
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateLlmDiagram(diagram, options = {}) {
  const errors = [];
  const warnings = [];
  const typeSet = options.typeSet instanceof Set ? options.typeSet : null;
  const cardTemplateIds = options.cardTemplateIds instanceof Set ? options.cardTemplateIds : null;

  if (!diagram || typeof diagram !== "object" || Array.isArray(diagram)) {
    return { ok: false, errors: ["Root must be a JSON object"], warnings };
  }
  for (const bad of ["groups", "rootGroupId"]) {
    if (bad in diagram) errors.push(`Forbidden key "${bad}"`);
  }
  if (!Array.isArray(diagram.nodes)) errors.push("nodes must be an array");
  if (!Array.isArray(diagram.connections)) errors.push("connections must be an array");
  if (errors.length) return { ok: false, errors, warnings };

  const ids = new Set();
  const positions = new Map();
  for (const [i, node] of diagram.nodes.entries()) {
    const prefix = `nodes[${i}]`;
    if (!node || typeof node !== "object") {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof node.id !== "string" || !node.id.trim()) {
      errors.push(`${prefix}.id is required`);
      continue;
    }
    if (/\s/.test(node.id)) errors.push(`${prefix}.id "${node.id}" must not contain spaces`);
    if (ids.has(node.id)) errors.push(`Duplicate node id "${node.id}"`);
    ids.add(node.id);
    if (typeof node.type !== "string" || !node.type.trim()) {
      errors.push(`${prefix} (${node.id}) missing type`);
      continue;
    }
    if (typeSet && !typeSet.has(node.type)) {
      const msg = `${prefix} type "${node.type}" is not in the resource catalog`;
      if (options.unknownType === "error") errors.push(msg);
      else warnings.push(msg);
    }
    const family = familyOf(node.type);
    if (typeof node.x === "number" && typeof node.y === "number") {
      const key = `${node.x},${node.y}`;
      const prev = positions.get(key);
      if (prev) warnings.push(`Nodes "${prev}" and "${node.id}" share the same x,y (${key})`);
      else positions.set(key, node.id);
    } else {
      warnings.push(`${prefix} (${node.id}) missing x/y`);
    }

    if (family === "chart") {
      const kind = node.type.split(".").pop();
      if (!node.chart || typeof node.chart !== "object") {
        errors.push(`${prefix} (${node.id}) chart payload required`);
      } else if (node.chart.kind !== kind) {
        errors.push(`${prefix} (${node.id}) chart.kind must be "${kind}"`);
      } else if (kind === "grid") {
        if (!Number.isInteger(node.chart.cols) || !Number.isInteger(node.chart.rows)) {
          errors.push(`${prefix} (${node.id}) grid chart needs integer cols and rows`);
        }
        if (!Array.isArray(node.chart.cells)) errors.push(`${prefix} (${node.id}) grid chart needs cells[]`);
      } else if (!Array.isArray(node.chart.series) || node.chart.series.length === 0) {
        errors.push(`${prefix} (${node.id}) chart.series must be a non-empty array`);
      }
    }
    if (family === "card") {
      const templateId = node.type.slice("generic.card.".length);
      if (!node.card || typeof node.card !== "object") {
        errors.push(`${prefix} (${node.id}) card payload required`);
      } else {
        if (node.card.templateId !== templateId) {
          errors.push(`${prefix} (${node.id}) card.templateId must be "${templateId}"`);
        }
        if (cardTemplateIds && !cardTemplateIds.has(templateId)) {
          errors.push(`${prefix} (${node.id}) unknown card template "${templateId}"`);
        }
        if (!node.card.elements || node.card.elements.kind !== "section") {
          errors.push(`${prefix} (${node.id}) card.elements must be a section tree`);
        } else {
          const kinds = new Set();
          walkCardElements(node.card.elements, (el) => {
            if (!el.id) errors.push(`${prefix} (${node.id}) card element missing id`);
            if (el.kind) kinds.add(el.kind);
          });
          if (!kinds.has("text") && !kinds.has("icon-slot") && !kinds.has("tag")) {
            warnings.push(`${prefix} (${node.id}) card has no text/icon-slot/tag elements`);
          }
        }
      }
    }
    if (family === "border") {
      const templateId = node.type.slice("generic.border.".length);
      if (node.border && node.border.templateId && node.border.templateId !== templateId) {
        errors.push(`${prefix} (${node.id}) border.templateId must match type suffix`);
      }
    }
    if (family === "icon" && node.type.startsWith("generic.icon.") && node.type !== "generic.icon.custom") {
      if (node.iconType && node.iconType !== "lucide") {
        errors.push(`${prefix} (${node.id}) Lucide icons should set iconType lucide`);
      }
    }
    if (family === "uml" && (!node.umlClass || typeof node.umlClass.name !== "string")) {
      errors.push(`${prefix} (${node.id}) umlClass.name required`);
    }
    if (family === "line" && (!node.startPos || !node.endPos)) {
      warnings.push(`${prefix} (${node.id}) line should set startPos and endPos`);
    }
  }

  for (const [i, conn] of diagram.connections.entries()) {
    const prefix = `connections[${i}]`;
    if (!conn || typeof conn !== "object") {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof conn.from !== "string" || typeof conn.to !== "string") {
      errors.push(`${prefix} needs from and to`);
      continue;
    }
    if (!ids.has(conn.from)) errors.push(`${prefix} from "${conn.from}" is not a node id`);
    if (!ids.has(conn.to)) errors.push(`${prefix} to "${conn.to}" is not a node id`);
    if (conn.style && !["bezier", "orthogonal"].includes(conn.style)) {
      errors.push(`${prefix} style must be bezier or orthogonal`);
    }
  }

  if (Array.isArray(diagram.groupings)) {
    for (const [i, g] of diagram.groupings.entries()) {
      if (g?.type && g.type !== "grouping") errors.push(`groupings[${i}].type must be "grouping"`);
      for (const mid of g?.memberIds || []) {
        if (!ids.has(mid)) errors.push(`groupings[${i}] member "${mid}" is not a node id`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateAuthoringPack({ pack, typesFile, fixtures, live }) {
  const logs = [];
  const errors = [];
  let checks = 0;
  const fail = (msg) => {
    errors.push(msg);
    logs.push(`FAIL ${msg}`);
  };
  const pass = (msg) => {
    checks += 1;
    logs.push(`ok   ${msg}`);
  };

  if (!pack?.outputContract || !pack?.nodeFamilies || !pack?.catalogs) {
    fail("diagram-authoring.json missing outputContract/nodeFamilies/catalogs");
  } else {
    pass("authoring pack has core sections");
  }

  const catalogTypes = Array.isArray(typesFile?.types) ? typesFile.types : [];
  const typeSet = new Set(catalogTypes.map((row) => row[0]));
  if (typeSet.size < 200) fail(`resource-types.json looks too small (${typeSet.size})`);
  else pass(`resource-types.json has ${typeSet.size} types`);

  const liveTypes = new Set((live?.types || []).map((t) => t.type));
  for (const extra of pack.catalogs.lucideIcons || []) liveTypes.add(extra.type);
  for (const extra of pack.catalogs.emojiIcons || []) liveTypes.add(extra.type);
  liveTypes.add("generic.icon.custom");

  const missingLive = [...typeSet].filter((t) => !liveTypes.has(t) && !t.startsWith("generic.icon.") && !t.startsWith("generic.emoji."));
  if (missingLive.length) fail(`catalog types missing from live scan: ${missingLive.slice(0, 8).join(", ")}`);
  else pass("generated types match live resource scan");

  const requiredGeneric = [
    "generic.object.rectangle",
    "generic.object.circle",
    "generic.chart.pie",
    "generic.chart.bar",
    "generic.chart.line",
    "generic.chart.ring",
    "generic.chart.grid",
    "generic.card.icon-border",
    "generic.card.agenda",
    "generic.text.textbox",
  ];
  const missingGeneric = requiredGeneric.filter((t) => !typeSet.has(t));
  if (missingGeneric.length) fail(`missing generic types: ${missingGeneric.join(", ")}`);
  else pass("core generic types present");

  const cardIds = new Set((pack.catalogs.cardTemplates || []).map((c) => c.templateId));
  const expectedCards = (live?.types || [])
    .filter((t) => t.family === "card")
    .map((t) => t.type.slice("generic.card.".length));
  const missingCards = expectedCards.filter((id) => !cardIds.has(id));
  if (missingCards.length) fail(`card templates missing from authoring pack: ${missingCards.join(", ")}`);
  else pass(`card templates cover palette (${cardIds.size})`);

  const opts = { typeSet, cardTemplateIds: cardIds, unknownType: "error" };
  const examples = pack.examples || {};
  for (const [name, diagram] of Object.entries(examples)) {
    const result = validateLlmDiagram(diagram, opts);
    if (!result.ok) fail(`example "${name}": ${result.errors.join("; ")}`);
    else pass(`example "${name}"`);
  }

  const negative = validateLlmDiagram(
    {
      nodes: [{ id: "a", type: "generic.chart.pie", x: 10, y: 10 }],
      connections: [{ from: "a", to: "missing" }],
    },
    opts,
  );
  if (negative.ok) fail("negative test should reject missing chart + missing endpoint");
  else pass("negative test rejects incomplete chart/connection");

  for (const fixture of fixtures || []) {
    const result = validateLlmDiagram(fixture.data, opts);
    if (!result.ok) fail(`fixture ${fixture.name}: ${result.errors.join("; ")}`);
    else pass(`fixture ${fixture.name}`);
    for (const w of result.warnings) logs.push(`warn ${fixture.name}: ${w}`);
  }

  return { ok: errors.length === 0, errors, logs, checks };
}
