// TTXY-4841 — rule builder UI (L2, L3, L4): recursive groups, AND/OR per group,
// catalog-driven fields/operators, between min/max, numeric validation, and
// product/category pickers that store ids in `value` and names in `label`.
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";

import { type RuleFieldDefinition, type RuleGroup } from "../../types";
import { RuleBuilder } from "./RuleBuilder";
import {
  type EditorGroup,
  fromRuleGroup,
  type RuleServerErrors,
  type RuleValidationErrors,
  toRuleGroup,
} from "./ruleModel";

jest.mock("@dashboard/searches/useProductSearch", () => ({
  __esModule: true,
  default: () => ({
    search: jest.fn(),
    loadMore: jest.fn(),
    result: {
      loading: false,
      data: {
        search: {
          edges: [{ node: { id: "UHJvZHVjdDox", name: "Vitamin C Serum" } }],
          pageInfo: { hasNextPage: false },
        },
      },
    },
  }),
}));

jest.mock("@dashboard/searches/useCategorySearch", () => ({
  __esModule: true,
  default: () => ({
    search: jest.fn(),
    loadMore: jest.fn(),
    result: {
      loading: false,
      data: {
        search: {
          edges: [{ node: { id: "Q2F0ZWdvcnk6MQ==", name: "Skincare" } }],
          pageInfo: { hasNextPage: false },
        },
      },
    },
  }),
}));

// The macaw multiselect needs a real layout engine; a stub keeps the contract:
// it offers the search options and reports picks as { value, label } options.
jest.mock("@dashboard/components/Combobox", () => ({
  Multiselect: Object.assign(
    ({
      options,
      onChange,
      value,
      label,
    }: {
      options: Array<{ value: string; label: string }>;
      onChange: (event: { target: { value: unknown; name: string } }) => void;
      value: Array<{ value: string; label: string }>;
      label?: string;
    }) => (
      <div data-test-id="rule-entity-picker" aria-label={label}>
        <span data-test-id="rule-entity-selected">{value.map(v => v.label).join(",")}</span>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ target: { value: [...value, option], name: "" } })}
          >
            {`pick ${option.label}`}
          </button>
        ))}
      </div>
    ),
    { NoOptions: () => null },
  ),
}));

const NUMERIC_OPS = [
  "equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "between",
];

const fields: RuleFieldDefinition[] = [
  { field: "city", type: "text", operators: ["equals", "includes"] },
  { field: "order_count", type: "number", operators: NUMERIC_OPS },
  { field: "product_purchased", type: "product", operators: ["includes"] },
  { field: "category_purchased", type: "category", operators: ["includes"] },
];

let latest: EditorGroup;

const Harness = ({
  initial,
  errors,
  serverErrors,
}: {
  initial?: RuleGroup;
  errors?: RuleValidationErrors;
  serverErrors?: RuleServerErrors;
}) => {
  const [value, setValue] = React.useState<EditorGroup>(() => fromRuleGroup(initial));

  latest = value;

  return (
    <RuleBuilder
      value={value}
      fields={fields}
      onChange={setValue}
      errors={errors}
      serverErrors={serverErrors}
    />
  );
};

const renderBuilder = (props: React.ComponentProps<typeof Harness> = {}) =>
  render(
    <Wrapper>
      <Harness {...props} />
    </Wrapper>,
  );

const conditions = () => screen.queryAllByTestId("rule-condition");
const groups = () => screen.getAllByTestId("rule-group");
const optionValues = (select: HTMLElement) =>
  Array.from((select as HTMLSelectElement).options).map(option => option.value);

describe("RuleBuilder", () => {
  it("L2 — adds, edits and removes conditions", () => {
    // Arrange
    renderBuilder();

    // Act — add two conditions, type into the first
    fireEvent.click(screen.getByTestId("rule-add-condition"));
    fireEvent.click(screen.getByTestId("rule-add-condition"));
    fireEvent.change(within(conditions()[0]).getByTestId("rule-value"), {
      target: { value: "jaipur" },
    });

    // Assert
    expect(conditions()).toHaveLength(2);
    expect(toRuleGroup(latest, fields).conditions[0]).toEqual({
      field: "city",
      operator: "equals",
      value: "jaipur",
    });

    // Act — remove the second
    fireEvent.click(within(conditions()[1]).getByTestId("rule-remove"));

    // Assert
    expect(conditions()).toHaveLength(1);
  });

  it("L2 — adds a nested group and toggles AND/OR per group", () => {
    // Arrange
    renderBuilder();

    // Act
    fireEvent.click(screen.getByTestId("rule-add-condition"));
    fireEvent.click(screen.getByTestId("rule-add-group"));

    const nested = groups()[1];

    fireEvent.click(within(nested).getByTestId("rule-add-condition"));
    fireEvent.change(within(nested).getByTestId("rule-logic"), { target: { value: "OR" } });

    // Assert
    expect(groups()).toHaveLength(2);
    expect(latest.logic).toBe("AND");
    expect((latest.children[1] as EditorGroup).logic).toBe("OR");
    // a new group starts with one condition (an empty group cannot be saved), plus the added one
    expect((latest.children[1] as EditorGroup).children).toHaveLength(2);
  });

  it("L2 — 'Add group' is disabled at depth 3", () => {
    // Arrange
    renderBuilder({
      initial: {
        logic: "AND",
        conditions: [
          {
            logic: "OR",
            conditions: [
              {
                logic: "AND",
                conditions: [{ field: "city", operator: "equals", value: "pune" }],
              },
            ],
          },
        ],
      },
    });

    // Act
    const deepest = groups()[2];

    // Assert — a group's own actions come after its children, so the root's are last
    const rootAddGroup = within(groups()[0]).getAllByTestId("rule-add-group");

    expect(within(deepest).getByTestId("rule-add-group")).toBeDisabled();
    expect(rootAddGroup[rootAddGroup.length - 1]).toBeEnabled();
  });

  it("L3 — each field offers only its own operators, from the catalog", () => {
    // Arrange
    renderBuilder();
    fireEvent.click(screen.getByTestId("rule-add-condition"));

    const row = conditions()[0];

    // Assert — field list mirrors /rule-fields
    expect(optionValues(within(row).getByTestId("rule-field"))).toEqual(
      fields.map(field => field.field),
    );
    expect(optionValues(within(row).getByTestId("rule-operator"))).toEqual(["equals", "includes"]);

    // Act
    fireEvent.change(within(row).getByTestId("rule-field"), { target: { value: "order_count" } });

    // Assert
    expect(optionValues(within(conditions()[0]).getByTestId("rule-operator"))).toEqual(NUMERIC_OPS);
  });

  it("L3 — between shows min and max inputs", () => {
    // Arrange
    renderBuilder({
      initial: {
        logic: "AND",
        conditions: [{ field: "order_count", operator: "equals", value: 2 }],
      },
    });

    // Act
    fireEvent.change(within(conditions()[0]).getByTestId("rule-operator"), {
      target: { value: "between" },
    });
    fireEvent.change(screen.getByTestId("rule-min"), { target: { value: "2" } });
    fireEvent.change(screen.getByTestId("rule-max"), { target: { value: "5" } });

    // Assert
    expect(screen.queryByTestId("rule-value")).not.toBeInTheDocument();
    expect(toRuleGroup(latest, fields).conditions[0]).toEqual({
      field: "order_count",
      operator: "between",
      value: { min: 2, max: 5 },
    });
  });

  it("L3 — a numeric field shows 'Enter a number' for text", () => {
    // Arrange
    const initial: RuleGroup = {
      logic: "AND",
      conditions: [{ field: "order_count", operator: "equals", value: 1 }],
    };
    const tree = fromRuleGroup(initial);

    // Act
    render(
      <Wrapper>
        <RuleBuilder
          value={{ ...tree, children: [{ ...tree.children[0], text: "abc" } as never] }}
          fields={fields}
          onChange={jest.fn()}
          errors={{ [tree.children[0].key]: "not_a_number" }}
        />
      </Wrapper>,
    );

    // Assert
    expect(screen.getByTestId("rule-value")).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByTestId("rule-error")).toHaveTextContent("Enter a number");
  });

  it("L3 — product picks store ids in value and names in label", () => {
    // Arrange
    renderBuilder({
      initial: {
        logic: "AND",
        conditions: [{ field: "city", operator: "equals", value: "x" }],
      },
    });

    // Act
    fireEvent.change(within(conditions()[0]).getByTestId("rule-field"), {
      target: { value: "product_purchased" },
    });
    fireEvent.click(screen.getByText("pick Vitamin C Serum"));

    // Assert
    expect(toRuleGroup(latest, fields).conditions[0]).toEqual({
      field: "product_purchased",
      operator: "includes",
      value: ["UHJvZHVjdDox"],
      label: ["Vitamin C Serum"],
    });
  });

  it("L3 — category picks use the category search", () => {
    // Arrange
    renderBuilder({
      initial: {
        logic: "AND",
        conditions: [
          {
            field: "category_purchased",
            operator: "includes",
            value: [],
          },
        ],
      },
    });

    // Act
    fireEvent.click(screen.getByText("pick Skincare"));

    // Assert
    expect(toRuleGroup(latest, fields).conditions[0]).toMatchObject({
      value: ["Q2F0ZWdvcnk6MQ=="],
      label: ["Skincare"],
    });
  });

  it("L4 — an empty rule set shows 'Add at least one rule'", () => {
    // Arrange
    const tree = fromRuleGroup(null);

    // Act
    render(
      <Wrapper>
        <RuleBuilder
          value={tree}
          fields={fields}
          onChange={jest.fn()}
          errors={{ [tree.key]: "empty_group" }}
        />
      </Wrapper>,
    );

    // Assert
    expect(screen.getByTestId("rule-error")).toHaveTextContent("Add at least one rule");
  });

  it("L4 — server errors are shown on the matching condition", () => {
    // Arrange
    const tree = fromRuleGroup({
      logic: "AND",
      conditions: [
        { field: "city", operator: "equals", value: "pune" },
        { field: "order_count", operator: "greater_than", value: 3 },
      ],
    });

    // Act
    render(
      <Wrapper>
        <RuleBuilder
          value={tree}
          fields={fields}
          onChange={jest.fn()}
          serverErrors={{ [tree.children[1].key]: ["operator not allowed for this field"] }}
        />
      </Wrapper>,
    );

    // Assert
    const rows = conditions();

    expect(within(rows[0]).queryByTestId("rule-error")).not.toBeInTheDocument();
    expect(within(rows[1]).getByTestId("rule-error")).toHaveTextContent(
      "operator not allowed for this field",
    );
  });
});
