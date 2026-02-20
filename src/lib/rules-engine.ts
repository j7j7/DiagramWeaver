/**
 * Rules engine - evaluates diagram against user-defined rules
 */

import type { DiagramData, DiagramNodeData } from './types';
import type { DiagramRule, RuleResult } from './rules-types';

/** Check if node type matches pattern (supports * wildcard) */
export function typeMatchesPattern(nodeType: string, pattern: string, exact: boolean): boolean {
  if (!pattern || !nodeType) return false;
  const n = nodeType.toLowerCase();
  let p = pattern.toLowerCase().trim();
  if (exact) return n === p;
  // If pattern has no *, treat as substring match (e.g. "firewall" matches "aws.securityidentity.firewall-manager")
  if (!p.includes('*')) {
    return n.includes(p);
  }
  const parts = p.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  const regexStr = '^' + parts.join('.*') + '$';
  try {
    return new RegExp(regexStr).test(n);
  } catch {
    return n === p;
  }
}

/** Count nodes matching the given type/pattern */
function countMatchingNodes(nodes: DiagramNodeData[], typeValue: string, exact: boolean): number {
  return nodes.filter(n => n.type && typeMatchesPattern(n.type, typeValue, exact)).length;
}

/** Evaluate a single rule against diagram nodes */
export function evaluateRule(rule: DiagramRule, nodes: DiagramNodeData[]): RuleResult {
  const exact = rule.typeMatch !== 'pattern';
  const typeValue = rule.typeValue?.trim() || '';
  const types = rule.types || [];

  switch (rule.operator) {
    case 'must_have': {
      const count = countMatchingNodes(nodes, typeValue, exact);
      const passed = count >= 1;
      return {
        rule,
        passed,
        message: passed
          ? `Has ${count} matching node(s)`
          : `Missing: diagram must have at least 1 object of type "${typeValue}"`,
        actualCount: count,
      };
    }

    case 'must_have_at_least': {
      const count = countMatchingNodes(nodes, typeValue, exact);
      const min = rule.count ?? 1;
      const passed = count >= min;
      return {
        rule,
        passed,
        message: passed
          ? `Has ${count} (≥ ${min})`
          : `Needs ${min - count} more: found ${count}, need at least ${min} of "${typeValue}"`,
        actualCount: count,
      };
    }

    case 'must_have_more_than': {
      const count = countMatchingNodes(nodes, typeValue, exact);
      const min = rule.count ?? 0;
      const passed = count > min;
      return {
        rule,
        passed,
        message: passed
          ? `Has ${count} (> ${min})`
          : `Needs more: found ${count}, must have more than ${min} of "${typeValue}"`,
        actualCount: count,
      };
    }

    case 'must_have_exactly': {
      const count = countMatchingNodes(nodes, typeValue, exact);
      const target = rule.count ?? 0;
      const passed = count === target;
      return {
        rule,
        passed,
        message: passed
          ? `Has exactly ${count}`
          : `Wrong count: found ${count}, need exactly ${target} of "${typeValue}"`,
        actualCount: count,
      };
    }

    case 'must_have_all': {
      const missing: string[] = [];
      for (const t of types) {
        const trimmed = t.trim();
        const useExact = !trimmed.includes('*');
        const c = countMatchingNodes(nodes, trimmed, useExact);
        if (c < 1) missing.push(trimmed);
      }
      const passed = missing.length === 0;
      return {
        rule,
        passed,
        message: passed
          ? `Has all ${types.length} required types`
          : `Missing: ${missing.join(', ')}`,
      };
    }

    default:
      return {
        rule,
        passed: false,
        message: `Unknown rule operator: ${(rule as any).operator}`,
      };
  }
}

/** Collect all nodes from diagram (flat list, excluding zones) */
export function getDiagramNodes(data: DiagramData): DiagramNodeData[] {
  return data.nodes?.filter(n => n.type !== 'zone') ?? [];
}

/** Evaluate all rules against a diagram */
export function evaluateRules(rules: DiagramRule[], data: DiagramData): RuleResult[] {
  const nodes = getDiagramNodes(data);
  return rules.map(rule => evaluateRule(rule, nodes));
}
