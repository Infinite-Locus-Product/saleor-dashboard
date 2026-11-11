// TTXY-4841 — pure rule-tree model behind the rule builder (LLD §3.1, §4.1, §5.1).
import { type RuleFieldDefinition, type RuleGroup } from "../../types";
import {
  addChild,
  countConditions,
  type EditorCondition,
  type EditorGroup,
  emptyGroup,
  fromRuleGroup,
  groupDepth,
  mapServerErrors,
  MAX_CONDITIONS,
  newCondition,
  removeNode,
  toRuleGroup,
  updateCondition,
  updateGroupLogic,
  validateRuleTree,
} from "./ruleModel";

const NUMERIC_OPS = [
  "equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "between",
];

export const ruleFieldsFixture: RuleFieldDefinition[] = [
  { field: "city", type: "text", operators: ["equals", "includes"] },
  { field: "order_count", type: "number", operators: NUMERIC_OPS },
  { field: "gmv", type: "number", operators: NUMERIC_OPS },
  { field: "product_purchased", type: "product", operators: ["includes"] },
  { field: "category_purchased", type: "category", operators: ["includes"] },
];

const savedTree: RuleGroup = {
  logic: "AND",
  conditions: [
    { field: "city", operator: "equals", value: "jaipur" },
    {
      logic: "OR",
      conditions: [
        { field: "order_count", operator: "between", value: { min: 2, max: 5 } },
        {
          field: "product_purchased",
          operator: "includes",
          value: ["UHJvZHVjdDox", "UHJvZHVjdDoy"],
          label: ["Serum", "Toner"],
        },
      ],
    },
  ],
};

const child = (group: EditorGroup, index: number) => group.children[index];

describe("ruleModel", () => {
  it("L5 — round-trips a saved tree (values, labels, nested groups)", () => {
    // Arrange / Act
    const editor = fromRuleGroup(savedTree);

    // Assert
    expect(toRuleGroup(editor, ruleFieldsFixture)).toEqual(savedTree);
  });

  it("L2 — newCondition starts on the first catalog field and its first operator", () => {
    // Arrange / Act
    const condition = newCondition(ruleFieldsFixture);

    // Assert
    expect(condition).toMatchObject({ kind: "condition", field: "city", operator: "equals" });
  });

  it("L2 — add, edit and remove conditions and nested groups; toggle AND/OR", () => {
    // Arrange
    let root = emptyGroup();
    const condition = newCondition(ruleFieldsFixture);
    const nested = emptyGroup();

    // Act
    root = addChild(root, root.key, condition);
    root = addChild(root, root.key, nested);
    root = addChild(root, nested.key, newCondition(ruleFieldsFixture));
    root = updateCondition(root, condition.key, { text: "pune" }, ruleFieldsFixture);
    root = updateGroupLogic(root, nested.key, "OR");

    // Assert
    expect(countConditions(root)).toBe(2);
    expect((child(root, 0) as EditorCondition).text).toBe("pune");
    expect((child(root, 1) as EditorGroup).logic).toBe("OR");

    // Act — remove the nested group with its condition
    root = removeNode(root, nested.key);

    // Assert
    expect(root.children).toHaveLength(1);
    expect(countConditions(root)).toBe(1);
  });

  it("L3 — changing the field resets the operator to one the new field allows, and clears the value", () => {
    // Arrange
    const root = emptyGroup();
    const condition = newCondition(ruleFieldsFixture);
    let tree = addChild(root, root.key, condition);

    tree = updateCondition(tree, condition.key, { text: "jaipur" }, ruleFieldsFixture);

    // Act
    tree = updateCondition(tree, condition.key, { field: "order_count" }, ruleFieldsFixture);

    // Assert
    const updated = child(tree, 0) as EditorCondition;

    expect(updated.field).toBe("order_count");
    expect(updated.operator).toBe("equals");
    expect(updated.text).toBe("");
  });

  it("L3 — an operator the field does not allow is refused", () => {
    // Arrange
    const root = emptyGroup();
    const condition = newCondition(ruleFieldsFixture);
    let tree = addChild(root, root.key, condition);

    // Act
    tree = updateCondition(tree, condition.key, { operator: "between" }, ruleFieldsFixture);

    // Assert — city does not allow between
    expect((child(tree, 0) as EditorCondition).operator).toBe("equals");

    // Act — gmv does
    tree = updateCondition(tree, condition.key, { field: "gmv" }, ruleFieldsFixture);
    tree = updateCondition(tree, condition.key, { operator: "between" }, ruleFieldsFixture);

    // Assert
    expect((child(tree, 0) as EditorCondition).operator).toBe("between");
  });

  it("L4 — an empty root reports 'Add at least one rule' (empty_group on the root)", () => {
    // Arrange
    const root = emptyGroup();

    // Act
    const errors = validateRuleTree(root, ruleFieldsFixture);

    // Assert
    expect(errors[root.key]).toBe("empty_group");
  });

  it("L3 — numeric fields reject text; between needs min ≤ max", () => {
    // Arrange
    const root = emptyGroup();
    const a = { ...newCondition(ruleFieldsFixture), field: "order_count", operator: "equals" };
    const b = { ...newCondition(ruleFieldsFixture), field: "gmv", operator: "between" };
    let tree = addChild(root, root.key, a);

    tree = addChild(tree, root.key, b);
    tree = updateCondition(tree, a.key, { text: "abc" }, ruleFieldsFixture);
    tree = updateCondition(tree, b.key, { min: "500", max: "100" }, ruleFieldsFixture);

    // Act
    const errors = validateRuleTree(tree, ruleFieldsFixture);

    // Assert
    expect(errors[a.key]).toBe("not_a_number");
    expect(errors[b.key]).toBe("min_gt_max");
  });

  it("L3 — text needs a value of at most 200 chars; pickers need at least one item", () => {
    // Arrange
    const root = emptyGroup();
    const text = newCondition(ruleFieldsFixture);
    const longText = newCondition(ruleFieldsFixture);
    const picker = {
      ...newCondition(ruleFieldsFixture),
      field: "category_purchased",
      operator: "includes",
    };
    let tree = addChild(root, root.key, text);

    tree = addChild(tree, root.key, longText);
    tree = addChild(tree, root.key, picker);
    tree = updateCondition(tree, longText.key, { text: "x".repeat(201) }, ruleFieldsFixture);

    // Act
    const errors = validateRuleTree(tree, ruleFieldsFixture);

    // Assert
    expect(errors[text.key]).toBe("required");
    expect(errors[longText.key]).toBe("too_long");
    expect(errors[picker.key]).toBe("required");
  });

  it("L2 — a field missing from the catalog is reported, not silently sent", () => {
    // Arrange
    const tree = fromRuleGroup({
      logic: "AND",
      conditions: [{ field: "retired_field", operator: "equals", value: "x" }],
    });

    // Act
    const errors = validateRuleTree(tree, ruleFieldsFixture);

    // Assert
    expect(errors[tree.children[0].key]).toBe("unknown_field");
  });

  it("L2 — depth is capped at 3 and the condition count at 50", () => {
    // Arrange
    const root = emptyGroup();
    const level2 = emptyGroup();
    const level3 = emptyGroup();
    let tree = addChild(root, root.key, level2);

    tree = addChild(tree, level2.key, level3);

    // Act / Assert
    expect(groupDepth(tree, root.key)).toBe(1);
    expect(groupDepth(tree, level3.key)).toBe(3);

    let full = emptyGroup();

    for (let i = 0; i < MAX_CONDITIONS; i += 1) {
      full = addChild(full, full.key, newCondition(ruleFieldsFixture));
    }

    expect(countConditions(full)).toBe(50);
    // a 51st is refused
    expect(countConditions(addChild(full, full.key, newCondition(ruleFieldsFixture)))).toBe(50);
  });

  it("L4 — server details[].path is mapped to the matching condition or group", () => {
    // Arrange
    const tree = fromRuleGroup(savedTree);
    const nested = tree.children[1] as EditorGroup;

    // Act
    const errors = mapServerErrors(tree, [
      { path: "conditions[1].conditions[0].operator", message: "operator not allowed" },
      { path: "conditions[1]", message: "group too deep" },
      { path: "conditions", message: "too many conditions" },
      { path: "conditions[9].value", message: "unknown node" },
    ]);

    // Assert
    expect(errors[nested.children[0].key]).toEqual(["operator not allowed"]);
    expect(errors[nested.key]).toEqual(["group too deep"]);
    expect(errors[tree.key]).toEqual(["too many conditions", "unknown node"]);
  });
});
