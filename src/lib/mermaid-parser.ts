/**
 * Mermaid flowchart parser - extracts nodes and edges from flowchart TD/LR/BT/RL syntax.
 * Supports node shapes and edge labels. Used for Mermaid import into DiagramWeaver.
 */

import yaml from 'js-yaml';

export type MermaidDirection = 'TD' | 'LR' | 'BT' | 'RL';

export interface MermaidNode {
  id: string;
  label: string;
  /** Mermaid shape hint for DiagramWeaver mapping */
  shape: 'rect' | 'rounded' | 'circle' | 'diamond' | 'subroutine' | 'hexagon'
    | 'parallelogram' | 'parallelogram-alt' | 'trapezoid' | 'trapezoid-alt' | 'stadium' | 'cylinder' | 'default';
}

export interface MermaidEdge {
  from: string;
  to: string;
  /** Optional text on the edge/connector */
  label?: string;
  /** Arrow/directional: true for -->, false for --- */
  hasArrow: boolean;
}

/** Mermaid flowchart layout config from frontmatter */
export interface MermaidFlowchartConfig {
  /** Layout algorithm: dagre (default) or elk */
  layout?: 'dagre' | 'elk';
  /** Spacing between nodes on same rank (Mermaid default: 50) */
  nodeSpacing?: number;
  /** Spacing between ranks (Mermaid default: 50) */
  rankSpacing?: number;
  /** ELK-specific options when layout: elk */
  elk?: {
    nodePlacementStrategy?: string;
    mergeEdges?: boolean;
    cycleBreakingStrategy?: string;
  };
}

export interface ParsedMermaid {
  direction: MermaidDirection;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  errors: string[];
  /** Parsed from YAML frontmatter, if present */
  config?: MermaidFlowchartConfig;
}

const DIRECTION_RE = /^\s*(?:flowchart|graph)\s+(TD|TB|BT|RL|LR)\s*$/i;
const COMMENT_RE = /^\s*%%/;

// Node patterns: id[text], id(text), id((text)), id{text}, id[[text]], id{{text}},
// id[/text/], id[\text\], id[/text\], id[\text/], id([text]), id>text]
// We match: id followed by shape brackets
const NODE_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]*\))?)\s*([\[\(\)\{\}\[\<\>\|\/\\]+)([^\]\)\}\>\|\\\/]*?)\2\s*$/;

// Simpler node regex - ID is alphanumeric/underscore, then shape delimiters
// Mermaid: A[text], A(text), A((text)), A{text}, A[[text]], A{{text}}
//          A[/text/], A[\text\], A[/text\], A[\text/], A([text]) stadium
const NODE_PATTERNS: Array<{ re: RegExp; shape: MermaidNode['shape'] }> = [
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\(([^)]*)\)\)\s*$/, shape: 'circle' },           // ((text))
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\[([^\]]*)\]\]\s*$/, shape: 'subroutine' },       // [[text]]
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{\{([^}]*)\}\}\s*$/, shape: 'hexagon' },           // {{text}}
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{([^}]*)\}\s*$/, shape: 'diamond' },              // {text}
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\[([^\]]*)\)\]\s*$/, shape: 'stadium' },          // ([text])
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\]\/\s*([^\/]*)\/\s*\[\]\s*$/, shape: 'parallelogram' },  // [/text/] - different
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*$/, shape: 'rounded' },               // (text)
  { re: /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[([^\]]*)\]\s*$/, shape: 'rect' },                // [text]
  // Parallelogram and trapezoid need to handle / and \ - order matters
];

// Parallelogram / trapezoid: id[/text/], id[\text\], id[/text\], id[\text/]
const PARALLELOGRAM_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\/\s*([^\/]*)\s*\/\]\s*$/;
const PARALLELOGRAM_ALT_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\\\s*([^\\]*)\s*\\\]\s*$/;
const TRAPEZOID_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\/\s*([^\\]*)\s*\\\]\s*$/;
const TRAPEZOID_ALT_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\\\s*([^\/]*)\s*\/\]\s*$/;

// Edge patterns: A --> B, A -- text --> B, A --- B, A -.-> B, A ==> B, A -- text --- B
// Also: A ---o B, A ---x B (circle/cross at end)
const EDGE_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*((?:--|-\.-|==)(?:[^-\s][^-]*(?:--|-\.-|==))?)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/;

// Simpler: split by --- or --> or -.-> or ==> and extract optional label between
// Format: fromId (--|-->|-.->|==>) [label] (--|-->|-.->|==>) toId
function parseEdgeLine(line: string): MermaidEdge | null {
  const trimmed = line.trim();
  // Match: id [-- or -. or ==] [optional text] [-- or --> or ---] id
  const m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*((?:--|==|-\.)(?:[->]|(?:[^\s\-][^-]*(?:--|==|-\.))?[->]?)?)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
  if (!m) return null;
  const [, from, middle, to] = m;
  if (!from || !to) return null;

  // Parse middle for label: --text--> or --text--- or ---
  let label: string | undefined;
  let hasArrow = false;
  const arrowMatch = middle.match(/-->(?:\s|$)/) || middle.match(/==>(?:\s|$)/) || middle.match(/-\.->(?:\s|$)/);
  const lineMatch = middle.match(/---(?:\s|$)/) || middle.match(/--(?:\s|$)/) || middle.match(/==(?:\s|$)/);
  hasArrow = !!arrowMatch;

  // Extract label: between first -- and last --> or ---
  const labelMatch = middle.match(/--\s*([^-]+?)\s*(?:--|$)/) || middle.match(/-\.\s*([^.]+?)\s*->/) || middle.match(/==\s*([^=]+?)\s*>/);
  if (labelMatch) {
    label = labelMatch[1].trim();
    if (label === '') label = undefined;
  }

  return { from, to, label, hasArrow };
}

/** Strip Mermaid quoted labels: "text" or 'text' -> text */
function unquoteLabel(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return t;
}

function parseNodeLine(line: string): MermaidNode | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try parallelogram/trapezoid first (they use / and \)
  let m = trimmed.match(PARALLELOGRAM_RE);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'parallelogram' };
  m = trimmed.match(PARALLELOGRAM_ALT_RE);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'parallelogram-alt' };
  m = trimmed.match(TRAPEZOID_RE);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'trapezoid' };
  m = trimmed.match(TRAPEZOID_ALT_RE);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'trapezoid-alt' };

  // Cylinder/database: [(text)]
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\(\s*([^)]*)\s*\)\s*\]\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2] || ''), shape: 'cylinder' };

  // Circle: ((text))
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\(\s*([^)]*)\s*\)\)\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'circle' };

  // Hexagon: {{text}}
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{\{\s*([^}]*)\s*\}\}\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'hexagon' };

  // Subroutine: [[text]]
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\[\s*([^\]]*)\s*\]\]\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'subroutine' };

  // Diamond: {text}
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{\s*([^}]*)\s*\}\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'diamond' };

  // Stadium: ([text]) - rounded ends
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\[\s*([^\]]*)\s*\]\)\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2] || ''), shape: 'stadium' };

  // Rounded: (text)
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([^)]*)\s*\)\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'rounded' };

  // Rectangle: [text]
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*([^\]]*)\s*\]\s*$/);
  if (m) return { id: m[1], label: unquoteLabel(m[2]), shape: 'rect' };

  // Plain id without shape - default rectangle
  m = trimmed.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
  if (m) return { id: m[1], label: m[1], shape: 'default' };

  return null;
}

/** Check if line is an edge (contains --> or --- or similar) */
function isEdgeLine(line: string): boolean {
  const t = line.trim();
  return /[a-zA-Z_][a-zA-Z0-9_]*\s*(?:--|==|-\.)(?:[^=\s]*(?:--|==|-\.)?)?[>\s]+\s*[a-zA-Z_][a-zA-Z0-9_]*/.test(t)
    || /--\s*[^-\s]+\s*--/.test(t); // -- text --
}

/** Extract node id from ref that may include shape e.g. "A[text]" -> "A", A["text"] -> "A" */
function extractNodeId(ref: string): string {
  const m = ref.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
  return m ? m[1] : ref.trim();
}

/** Match edge operator from right; prefer longest when positions overlap (e.g. --- over --) */
function findEdgeOperator(line: string): { op: string; pos: number } | null {
  const ops = ['-.->', '-->', '==>', '---', '--'];
  let best: { op: string; pos: number } | null = null;
  for (const op of ops) {
    const idx = line.lastIndexOf(op);
    if (idx >= 0 && (!best || idx > best.pos || (idx === best.pos && op.length > (best?.op.length ?? 0))))
      best = { op, pos: idx };
  }
  return best;
}

function parseEdgeWithTarget(line: string): { edge: MermaidEdge; fromRaw?: string; targetRaw?: string } | null {
  const t = line.trim();
  if (!t) return null;

  // A -->|label| B - handle pipe label first (unambiguous)
  const pipeMatch = t.match(/-->\s*\|([^|]*)\|\s+(.+)$/);
  if (pipeMatch) {
    const beforePipe = t.slice(0, t.indexOf('-->'));
    const fromRaw = beforePipe.trim();
    const targetRaw = pipeMatch[2].trim();
    return {
      edge: {
        from: extractNodeId(fromRaw),
        to: extractNodeId(targetRaw),
        label: pipeMatch[1].trim() || undefined,
        hasArrow: true,
      },
      fromRaw,
      targetRaw,
    };
  }

  const found = findEdgeOperator(t);
  if (!found) return null;
  const { op, pos } = found;
  const leftPart = t.slice(0, pos).trim();
  const rightPart = t.slice(pos + op.length).trim();
  if (!rightPart) return null;

  let fromRaw = leftPart;
  let label: string | undefined;
  const hasArrow = op.includes('>');
  const isDoubleLine = op === '---' || op === '==';

  // Check for inline label: "from -- label" before the operator (e.g. B -- Critical --> C)
  const labelMatch = leftPart.match(/^(.+?)\s+--\s+([^\-]+)\s*$/);
  if (labelMatch && (op === '-->' || op === '---')) {
    fromRaw = labelMatch[1].trim();
    label = labelMatch[2].trim();
  }

  return {
    edge: {
      from: extractNodeId(fromRaw),
      to: extractNodeId(rightPart),
      label: label || undefined,
      hasArrow,
    },
    fromRaw,
    targetRaw: rightPart,
  };
}

/** Extract and parse YAML frontmatter (config) from Mermaid diagram text */
function parseFrontmatterConfig(text: string): MermaidFlowchartConfig | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith('---')) return undefined;
  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) return undefined;
  const yamlBlock = trimmed.slice(3, endIdx).trim();
  if (!yamlBlock) return undefined;
  try {
    const parsed = yaml.load(yamlBlock) as Record<string, unknown>;
    const config = parsed?.config as Record<string, unknown> | undefined;
    if (!config || typeof config !== 'object') return undefined;
    const result: MermaidFlowchartConfig = {};
    if (config.layout === 'dagre' || config.layout === 'elk') {
      result.layout = config.layout;
    }
    if (typeof config.nodeSpacing === 'number') result.nodeSpacing = config.nodeSpacing;
    if (typeof config.rankSpacing === 'number') result.rankSpacing = config.rankSpacing;
    if (config.elk && typeof config.elk === 'object') {
      const elk = config.elk as Record<string, unknown>;
      result.elk = {};
      if (typeof elk.nodePlacementStrategy === 'string') result.elk.nodePlacementStrategy = elk.nodePlacementStrategy;
      if (typeof elk.mergeEdges === 'boolean') result.elk.mergeEdges = elk.mergeEdges;
      if (typeof elk.cycleBreakingStrategy === 'string') result.elk.cycleBreakingStrategy = elk.cycleBreakingStrategy;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

// -------- Class Diagram --------

export interface MermaidClassNode {
  id: string;
  name: string;
  attributes: string[];
  methods: string[];
}

export interface MermaidClassEdge {
  from: string; // child
  to: string;   // parent
  type: 'inheritance';
}

export interface ParsedMermaidClassDiagram {
  classes: MermaidClassNode[];
  edges: MermaidClassEdge[];
  errors: string[];
}

const CLASS_DIAGRAM_RE = /^\s*classDiagram\s*$/i;
const INHERITANCE_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*<\|--\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*$/;
// ClassName : member or ClassName: member
const COLON_MEMBER_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)$/;
// class ClassName { ... } - single line
const CLASS_BLOCK_RE = /^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{([^}]*)\}\s*$/;
// class ClassName { - start of multi-line block
const CLASS_BLOCK_START_RE = /^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{\s*$/;

// -------- Sequence Diagram --------

export interface MermaidSequenceParticipant {
  id: string;
  label: string; // Display name (from "as" or id)
}

export interface MermaidSequenceMessage {
  from: string;
  to: string;
  label?: string;
  /** Solid (->>) or dashed (-->>) */
  lineType: 'solid' | 'dashed';
  /** Arrow at end (->> style) */
  hasArrow: boolean;
  /** Order index for vertical layout */
  orderIndex: number;
}

export interface ParsedMermaidSequenceDiagram {
  participants: MermaidSequenceParticipant[];
  messages: MermaidSequenceMessage[];
  errors: string[];
}

const SEQUENCE_DIAGRAM_RE = /^\s*sequenceDiagram\s*$/i;
const PARTICIPANT_SIMPLE_RE = /^\s*participant\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i;
// A->>B: msg (solid+arrow), A-->>B: msg (dashed+arrow), A->B, A-->B
const MESSAGE_RE = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(-{1,2})(>{0,2})\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:?\s*(.*)$/;

/** Detect Mermaid diagram type from first lines of text */
export function detectMermaidDiagramType(text: string): 'flowchart' | 'classDiagram' | 'sequenceDiagram' | null {
  const trimmed = text.trim();
  const firstLines = trimmed.split(/\r?\n/).slice(0, 20);
  for (const line of firstLines) {
    const t = line.trim();
    if (SEQUENCE_DIAGRAM_RE.test(t)) return 'sequenceDiagram';
    if (CLASS_DIAGRAM_RE.test(t)) return 'classDiagram';
    if (/^\s*(?:flowchart|graph)\s+(TD|TB|BT|RL|LR)\s*$/i.test(t)) return 'flowchart';
  }
  return null;
}

/**
 * Parse Mermaid sequenceDiagram syntax into participants and messages.
 */
export function parseMermaidSequenceDiagram(text: string): ParsedMermaidSequenceDiagram {
  const errors: string[] = [];
  const participantMap = new Map<string, MermaidSequenceParticipant>();
  const messages: MermaidSequenceMessage[] = [];
  const lines = text.split(/\r?\n/);
  let messageOrder = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (COMMENT_RE.test(trimmed)) continue;

    if (SEQUENCE_DIAGRAM_RE.test(trimmed)) continue;

    // participant Id as DisplayName
    const partAsMatch = trimmed.match(/^\s*participant\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s+(.+)$/i);
    if (partAsMatch) {
      const id = partAsMatch[1];
      const label = unquoteLabel(partAsMatch[2].trim());
      participantMap.set(id, { id, label });
      continue;
    }

    // participant Id
    const partMatch = trimmed.match(PARTICIPANT_SIMPLE_RE);
    if (partMatch) {
      const id = partMatch[1];
      if (!participantMap.has(id)) {
        participantMap.set(id, { id, label: id });
      }
      continue;
    }

    // Message: A->>B: label or A-->>B: label
    const msgMatch = trimmed.match(MESSAGE_RE);
    if (msgMatch) {
      const [, from, dashes, arrows, to, labelRaw] = msgMatch;
      if (!from || !to) continue;
      const isDashed = dashes === '--';
      const hasArrow = (arrows?.length ?? 0) > 0;
      const label = labelRaw?.trim() || undefined;

      if (!participantMap.has(from)) {
        participantMap.set(from, { id: from, label: from });
      }
      if (!participantMap.has(to)) {
        participantMap.set(to, { id: to, label: to });
      }

      messages.push({
        from,
        to,
        label: label || undefined,
        lineType: isDashed ? 'dashed' : 'solid',
        hasArrow,
        orderIndex: messageOrder++,
      });
      continue;
    }

    if (trimmed.length > 0 && !trimmed.startsWith('%%')) {
      errors.push(`Line ${i + 1}: Could not parse "${trimmed.slice(0, 50)}${trimmed.length > 50 ? '...' : ''}"`);
    }
  }

  const participants = Array.from(participantMap.values());
  return { participants, messages, errors };
}

function parseClassMember(member: string): { type: 'attr' | 'method'; text: string } {
  const s = member.trim();
  if (!s) return { type: 'attr', text: '' };
  const hasParens = /\([^)]*\)\s*$/.test(s);
  return { type: hasParens ? 'method' : 'attr', text: s };
}

/**
 * Parse Mermaid classDiagram syntax into classes and inheritance edges.
 * Supports both single-line and multi-line class blocks.
 */
export function parseMermaidClassDiagram(text: string): ParsedMermaidClassDiagram {
  const errors: string[] = [];
  const classMap = new Map<string, MermaidClassNode>();
  const edges: MermaidClassEdge[] = [];
  const lines = text.split(/\r?\n/);
  let blockClassName: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (blockClassName !== null) {
      if (trimmed === '}') {
        blockClassName = null;
      } else if (trimmed) {
        const node = ensureClass(classMap, blockClassName);
        const { type, text } = parseClassMember(trimmed);
        if (text) {
          if (type === 'attr') node.attributes.push(text);
          else node.methods.push(text);
        }
      }
      continue;
    }

    if (!trimmed) continue;
    if (COMMENT_RE.test(trimmed)) continue;
    if (trimmed === '---' || trimmed.startsWith('---')) continue;

    if (CLASS_DIAGRAM_RE.test(trimmed)) continue;

    const inhMatch = trimmed.match(INHERITANCE_RE);
    if (inhMatch) {
      const [, parent, child] = inhMatch;
      if (parent && child) {
        edges.push({ from: child, to: parent, type: 'inheritance' });
        ensureClass(classMap, parent);
        ensureClass(classMap, child);
      }
      continue;
    }

    const colonMatch = trimmed.match(COLON_MEMBER_RE);
    if (colonMatch) {
      const [, className, memberStr] = colonMatch;
      if (className && memberStr) {
        const node = ensureClass(classMap, className);
        const { type, text } = parseClassMember(memberStr);
        if (text) {
          if (type === 'attr') node.attributes.push(text);
          else node.methods.push(text);
        }
      }
      continue;
    }

    const blockStartMatch = trimmed.match(CLASS_BLOCK_START_RE);
    if (blockStartMatch) {
      blockClassName = blockStartMatch[1];
      ensureClass(classMap, blockClassName);
      continue;
    }

    const blockMatch = trimmed.match(CLASS_BLOCK_RE);
    if (blockMatch) {
      const [, className, body] = blockMatch;
      if (className && body !== undefined) {
        const node = ensureClass(classMap, className);
        const memberLines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const m of memberLines) {
          const { type, text } = parseClassMember(m);
          if (text) {
            if (type === 'attr') node.attributes.push(text);
            else node.methods.push(text);
          }
        }
      }
      continue;
    }

    if (trimmed.length > 0 && !trimmed.startsWith('%%')) {
      errors.push(`Line ${i + 1}: Could not parse "${trimmed.slice(0, 50)}${trimmed.length > 50 ? '...' : ''}"`);
    }
  }

  const classes = Array.from(classMap.values());
  return { classes, edges, errors };
}

function ensureClass(map: Map<string, MermaidClassNode>, id: string): MermaidClassNode {
  let node = map.get(id);
  if (!node) {
    node = { id, name: id, attributes: [], methods: [] };
    map.set(id, node);
  }
  return node;
}

// -------- Flowchart --------

/**
 * Parse Mermaid flowchart syntax into structured nodes and edges.
 */
export function parseMermaidFlowchart(text: string): ParsedMermaid {
  const errors: string[] = [];
  let direction: MermaidDirection = 'TD';
  const nodeMap = new Map<string, MermaidNode>();
  const edges: MermaidEdge[] = [];
  const config = parseFrontmatterConfig(text);

  const lines = text.split(/\r?\n/).map(l => l.trim());
  const flowStartIdx = lines.findIndex(l => DIRECTION_RE.test(l));
  const startIdx = flowStartIdx >= 0 ? flowStartIdx : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (COMMENT_RE.test(line)) continue;
    if (line === '---' || line.startsWith('---')) continue; // YAML frontmatter delimiter
    if (/^\s*style\s+/i.test(line)) continue; // style directives
    if (/^\s*config\s*:/i.test(line)) continue; // frontmatter config
    if (/^\s*[\w-]+\s*:/i.test(line) && !line.match(/^\s*(?:flowchart|graph)\s+/i)) continue; // YAML key: value
    if (/^\s*subgraph\s+/i.test(line) || /^\s*end\s*$/i.test(line)) continue; // subgraph

    // Direction
    const dirMatch = line.match(DIRECTION_RE);
    if (dirMatch) {
      const d = dirMatch[1].toUpperCase();
      direction = (d === 'TB' ? 'TD' : d) as MermaidDirection;
      continue;
    }

    // Node
    const node = parseNodeLine(line);
    if (node) {
      if (nodeMap.has(node.id)) {
        nodeMap.set(node.id, { ...nodeMap.get(node.id)!, label: node.label, shape: node.shape });
      } else {
        nodeMap.set(node.id, node);
      }
      continue;
    }

    // Edge (may include inline node def on source and/or target, e.g. A["text"] --> B{text})
    const edgeResult = parseEdgeWithTarget(line);
    if (edgeResult) {
      const { edge, fromRaw, targetRaw } = edgeResult;
      edges.push(edge);
      // Only update nodeMap when we have a real node def (shape brackets/braces),
      // not a plain id like "B" which would overwrite "Severity Assessment" with "B"
      const isRealNodeDef = (n: { id: string; label: string; shape: string }) =>
        n.shape !== 'default' || n.label !== n.id;
      if (fromRaw) {
        const inlineFrom = parseNodeLine(fromRaw);
        if (inlineFrom && inlineFrom.id === edge.from && isRealNodeDef(inlineFrom)) {
          nodeMap.set(edge.from, inlineFrom);
        }
      }
      if (targetRaw) {
        const inlineTo = parseNodeLine(targetRaw);
        if (inlineTo && inlineTo.id === edge.to && isRealNodeDef(inlineTo)) {
          nodeMap.set(edge.to, inlineTo);
        }
      }
      if (!nodeMap.has(edge.from)) {
        nodeMap.set(edge.from, { id: edge.from, label: edge.from, shape: 'default' });
      }
      if (!nodeMap.has(edge.to)) {
        nodeMap.set(edge.to, { id: edge.to, label: edge.to, shape: 'default' });
      }
      continue;
    }

    if (line.length > 0 && !line.startsWith('%%')) {
      errors.push(`Line ${i + 1}: Could not parse "${line.slice(0, 50)}${line.length > 50 ? '...' : ''}"`);
    }
  }

  const nodes = Array.from(nodeMap.values());
  return { direction, nodes, edges, errors, config };
}
