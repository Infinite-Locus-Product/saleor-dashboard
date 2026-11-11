/**
 * Rule-tree editor model (TTXY-4841, LLD §3.1 / §5.1).
 *
 * The saved shape (RuleGroup) holds typed values; the editor keeps raw input
 * strings, so a half-typed number never loses keystrokes, plus a stable key per
 * node for React and for pinning errors to a node. Everything here is pure.
 *
 * The field list and each field's operators come from GET /cohorts/rule-fields;
 * only the four field *types* (text / number / product / category) are known here.
 */
import {
  type RuleCondition,
  type RuleErrorDetail,
  type RuleFieldDefinition,
  type RuleGroup,
  type RuleLogic,
} from "../../types";

export const MAX_DEPTH = 3;
export const MAX_CONDITIONS = 50;
export const MAX_TEXT_LENGTH = 200;
export const MAX_ITEMS = 100;
export const BETWEEN = "between";

export interface PickedOption {
  value: string;
  label: string;
}

export interface EditorCondition {
  kind: "condition";
  key: string;
  field: string;
  operator: string;
  /** Text value, or the raw number for a single-number operator. */
  text: string;
  min: string;
  max: string;
  /** Product / category picks: ids go to `value`, names to `label`. */
  options: PickedOption[];
}

export interface EditorGroup {
  kind: "group";
  key: string;
  logic: RuleLogic;
  children: EditorNode[];
}

export type EditorNode = EditorCondition | EditorGroup;

export type RuleClientError =
  | "empty_group"
  | "required"
  | "not_a_number"
  | "min_gt_max"
  | "too_long"
  | "too_many_items"
  | "unknown_field"
  | "unknown_operator"
  | "too_many_conditions";

/** Client-side errors by node key. */
export type RuleValidationErrors = Record<string, RuleClientError>;

/** Server-side messages by node key. */
export type RuleServerErrors = Record<string, string[]>;

let keySeed = 0;

const nextKey = (): string => {
  keySeed += 1;

  return `rule-${keySeed}`;
};

export const emptyGroup = (logic: RuleLogic = "AND"): EditorGroup => ({
  kind: "group",
  key: nextKey(),
  logic,
  children: [],
});

const blankCondition = (field: string, operator: string): EditorCondition => ({
  kind: "condition",
  key: nextKey(),
  field,
  operator,
  text: "",
  min: "",
  max: "",
  options: [],
});

export const newCondition = (fields: RuleFieldDefinition[]): EditorCondition => {
  const first = fields[0];

  return blankCondition(first?.field ?? "", first?.operators[0] ?? "");
};

export const findField = (
  fields: RuleFieldDefinition[],
  field: string,
): RuleFieldDefinition | undefined => fields.find(definition => definition.field === field);

const isGroup = (node: RuleCondition | RuleGroup): node is RuleGroup =>
  Array.isArray((node as RuleGroup).conditions);

const toArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(String)
    : value === undefined || value === null
      ? []
      : [String(value)];

const conditionFromRule = (rule: RuleCondition): EditorCondition => {
  const condition = blankCondition(rule.field, rule.operator);
  const { value } = rule;

  if (Array.isArray(value)) {
    const labels = toArray(rule.label);

    return {
      ...condition,
      options: value.map((id, index) => ({
        value: String(id),
        label: labels[index] ?? String(id),
      })),
    };
  }

  if (value && typeof value === "object") {
    return { ...condition, min: String(value.min ?? ""), max: String(value.max ?? "") };
  }

  if (value === undefined || value === null) return condition;

  const text = String(value);

  // PR #19 C8 — the field type is unknown here, so a single string id is kept
  // both as text and as one picker option; the field type decides which one is
  // used (conditionToRule / validation), so product/category rules written by
  // the API as `value: "<id>"` still open in the picker.
  if (typeof value === "string" && rule.label !== undefined) {
    const [label] = toArray(rule.label);

    return { ...condition, text, options: [{ value: text, label: label ?? text }] };
  }

  return { ...condition, text };
};

export const fromRuleGroup = (group: RuleGroup | null | undefined): EditorGroup => {
  if (!group || !Array.isArray(group.conditions)) {
    return emptyGroup();
  }

  return {
    ...emptyGroup(group.logic === "OR" ? "OR" : "AND"),
    children: group.conditions.map(node =>
      isGroup(node) ? fromRuleGroup(node) : conditionFromRule(node),
    ),
  };
};

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

const parseNumber = (raw: string): number | null => {
  const trimmed = raw.trim();

  return NUMBER_RE.test(trimmed) ? Number(trimmed) : null;
};

const conditionToRule = (
  condition: EditorCondition,
  fields: RuleFieldDefinition[],
): RuleCondition => {
  const type = findField(fields, condition.field)?.type;
  const base = { field: condition.field, operator: condition.operator };

  if (type === "product" || type === "category") {
    return {
      ...base,
      value: condition.options.map(option => option.value),
      label: condition.options.map(option => option.label),
    };
  }

  if (type === "number") {
    if (condition.operator === BETWEEN) {
      return {
        ...base,
        value: { min: parseNumber(condition.min) ?? 0, max: parseNumber(condition.max) ?? 0 },
      };
    }

    return { ...base, value: parseNumber(condition.text) ?? 0 };
  }

  return { ...base, value: condition.text.trim() };
};

/** Converts a (validated) editor tree to the saved shape. */
export const toRuleGroup = (group: EditorGroup, fields: RuleFieldDefinition[]): RuleGroup => ({
  logic: group.logic,
  conditions: group.children.map(node =>
    node.kind === "group" ? toRuleGroup(node, fields) : conditionToRule(node, fields),
  ),
});

export const countConditions = (group: EditorGroup): number =>
  group.children.reduce(
    (total, node) => total + (node.kind === "group" ? countConditions(node) : 1),
    0,
  );

/** 1 for the root; 0 when the key is not a group in the tree. */
export const groupDepth = (root: EditorGroup, key: string, depth = 1): number => {
  if (root.key === key) return depth;

  for (const node of root.children) {
    if (node.kind === "group") {
      const found = groupDepth(node, key, depth + 1);

      if (found) return found;
    }
  }

  return 0;
};

const mapTree = (group: EditorGroup, map: (node: EditorNode) => EditorNode | null): EditorGroup => {
  const children = group.children
    .map(node => map(node.kind === "group" ? mapTree(node, map) : node))
    .filter((node): node is EditorNode => node !== null);

  return { ...group, children };
};

/** Adds a node to the group with `groupKey`; refused past the depth or size limits. */
export const addChild = (root: EditorGroup, groupKey: string, node: EditorNode): EditorGroup => {
  const added = node.kind === "group" ? countConditions(node) : 1;

  if (countConditions(root) + added > MAX_CONDITIONS) return root;

  const depth = groupDepth(root, groupKey);

  if (!depth || (node.kind === "group" && depth >= MAX_DEPTH)) return root;

  const append = (group: EditorGroup): EditorGroup =>
    group.key === groupKey ? { ...group, children: [...group.children, node] } : group;

  return append(mapTree(root, current => (current.kind === "group" ? append(current) : current)));
};

export const removeNode = (root: EditorGroup, key: string): EditorGroup =>
  mapTree(root, node => (node.key === key ? null : node));

export const updateGroupLogic = (root: EditorGroup, key: string, logic: RuleLogic): EditorGroup =>
  root.key === key
    ? { ...root, logic }
    : mapTree(root, node =>
        node.kind === "group" && node.key === key ? { ...node, logic } : node,
      );

export type ConditionPatch = Partial<
  Pick<EditorCondition, "field" | "operator" | "text" | "min" | "max" | "options">
>;

const applyPatch = (
  condition: EditorCondition,
  patch: ConditionPatch,
  fields: RuleFieldDefinition[],
): EditorCondition => {
  if (patch.field !== undefined && patch.field !== condition.field) {
    // A new field starts clean: its first allowed operator and no value.
    const definition = findField(fields, patch.field);

    if (!definition) return condition;

    return {
      ...blankCondition(definition.field, definition.operators[0] ?? ""),
      key: condition.key,
    };
  }

  if (patch.operator !== undefined) {
    const allowed = findField(fields, condition.field)?.operators ?? [];

    if (!allowed.includes(patch.operator)) return condition;
  }

  return { ...condition, ...patch, field: condition.field };
};

export const updateCondition = (
  root: EditorGroup,
  key: string,
  patch: ConditionPatch,
  fields: RuleFieldDefinition[],
): EditorGroup =>
  mapTree(root, node =>
    node.kind === "condition" && node.key === key ? applyPatch(node, patch, fields) : node,
  );

const validateCondition = (
  condition: EditorCondition,
  fields: RuleFieldDefinition[],
): RuleClientError | null => {
  const definition = findField(fields, condition.field);

  if (!definition) return "unknown_field";

  if (!definition.operators.includes(condition.operator)) return "unknown_operator";

  if (definition.type === "number") {
    if (condition.operator === BETWEEN) {
      if (!condition.min.trim() || !condition.max.trim()) return "required";

      const min = parseNumber(condition.min);
      const max = parseNumber(condition.max);

      if (min === null || max === null) return "not_a_number";

      return min > max ? "min_gt_max" : null;
    }

    if (!condition.text.trim()) return "required";

    return parseNumber(condition.text) === null ? "not_a_number" : null;
  }

  if (definition.type === "product" || definition.type === "category") {
    if (condition.options.length === 0) return "required";

    return condition.options.length > MAX_ITEMS ? "too_many_items" : null;
  }

  if (!condition.text.trim()) return "required";

  return condition.text.trim().length > MAX_TEXT_LENGTH ? "too_long" : null;
};

/** Client-side validation (LLD §5.1); an empty result means the tree can be saved. */
export const validateRuleTree = (
  root: EditorGroup,
  fields: RuleFieldDefinition[],
): RuleValidationErrors => {
  const errors: RuleValidationErrors = {};

  const walk = (group: EditorGroup) => {
    if (group.children.length === 0) {
      errors[group.key] = "empty_group";
    }

    group.children.forEach(node => {
      if (node.kind === "group") {
        walk(node);

        return;
      }

      const error = validateCondition(node, fields);

      if (error) errors[node.key] = error;
    });
  };

  walk(root);

  if (!errors[root.key] && countConditions(root) > MAX_CONDITIONS) {
    errors[root.key] = "too_many_conditions";
  }

  return errors;
};

/** Every node's server path: "" for the root, then "conditions[i]" segments. */
const nodePaths = (group: EditorGroup, prefix = ""): Array<[string, string]> => [
  [prefix, group.key],
  ...group.children.flatMap((node, index): Array<[string, string]> => {
    const path = `${prefix ? `${prefix}.` : ""}conditions[${index}]`;

    return node.kind === "group" ? nodePaths(node, path) : [[path, node.key]];
  }),
];

const pathMatches = (errorPath: string, nodePath: string): boolean =>
  nodePath === "" ||
  errorPath === nodePath ||
  errorPath.startsWith(`${nodePath}.`) ||
  errorPath.startsWith(`${nodePath}[`);

/**
 * Pins each server `invalid_rule` detail to the deepest node whose path prefixes
 * it ("conditions[1].conditions[0].operator" → that condition). Paths that match
 * no node land on the root, so no error is ever dropped.
 */
export const mapServerErrors = (
  root: EditorGroup,
  details: RuleErrorDetail[],
): RuleServerErrors => {
  const paths = nodePaths(root).sort((a, b) => b[0].length - a[0].length);
  const errors: RuleServerErrors = {};

  details.forEach(detail => {
    const path = detail.path.trim();
    const match = paths.find(([nodePath]) => pathMatches(path, nodePath)) ?? ["", root.key];
    const key = match[1];

    errors[key] = [...(errors[key] ?? []), detail.message || path];
  });

  return errors;
};
