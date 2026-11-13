import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { type RuleFieldDefinition } from "../../types";
import { RuleBuilder } from "./RuleBuilder";
import { type EditorGroup, fromRuleGroup } from "./ruleModel";

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
  { field: "delivery_address", type: "text", operators: ["includes"] },
  { field: "order_count", type: "number", operators: NUMERIC_OPS },
  { field: "gmv", type: "number", operators: NUMERIC_OPS },
];

const Controlled = ({ initial }: { initial: EditorGroup }) => {
  const [value, setValue] = useState(initial);

  return <RuleBuilder value={value} fields={fields} onChange={setValue} />;
};

const meta: Meta<typeof Controlled> = {
  title: "Cohorts/RuleBuilder",
  component: Controlled,
};

export default meta;

type Story = StoryObj<typeof Controlled>;

export const Empty: Story = {
  args: { initial: fromRuleGroup(null) },
};

export const NestedGroups: Story = {
  args: {
    initial: fromRuleGroup({
      logic: "AND",
      conditions: [
        { field: "city", operator: "equals", value: "jaipur" },
        {
          logic: "OR",
          conditions: [
            { field: "order_count", operator: "between", value: { min: 2, max: 5 } },
            { field: "gmv", operator: "greater_than", value: 5000 },
          ],
        },
      ],
    }),
  },
};
