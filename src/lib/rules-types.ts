/**
 * Diagram rules types - user-definable validation rules for diagram content
 */

/** Rule operator - what we're checking */
export type RuleOperator =
  | 'must_have'           // at least 1 of type
  | 'must_have_more_than' // count > N
  | 'must_have_at_least'  // count >= N
  | 'must_have_exactly'   // count === N
  | 'must_have_all';     // must have each of the types in the list (at least 1 of each)

/** Type match mode - how we match node types */
export type TypeMatchMode =
  | 'exact'    // exact type e.g. aws.compute.ec2-instance
  | 'pattern'; // wildcard pattern e.g. aws.database.*, *.database.*, *firewall*

export interface DiagramRule {
  id: string;
  name: string;
  operator: RuleOperator;
  /** For single-type rules: the type or pattern to match */
  typeValue?: string;
  /** For operator + count: the threshold */
  count?: number;
  /** For must_have_all: array of types/patterns (each must exist at least once) */
  types?: string[];
  /** How to interpret typeValue/types - exact or pattern with * */
  typeMatch?: TypeMatchMode;
}

export interface RulesFile {
  version: '1.0';
  name?: string;
  description?: string;
  rules: DiagramRule[];
}

/** Result of evaluating a single rule against a diagram */
export interface RuleResult {
  rule: DiagramRule;
  passed: boolean;
  message: string;
  /** Actual count found (for count-based rules) */
  actualCount?: number;
}
