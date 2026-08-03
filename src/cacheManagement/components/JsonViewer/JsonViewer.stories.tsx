import type { Meta, StoryObj } from "@storybook/react-vite";

import { JsonViewer } from "./JsonViewer";

const meta: Meta<typeof JsonViewer> = {
  title: "Cache Management/JsonViewer",
  component: JsonViewer,
  args: {
    label: "Response",
    copyLabel: "Copy response",
    value: { status: "ok", cleared: 128, prefix: "cache:freebie" },
  },
};

export default meta;

type Story = StoryObj<typeof JsonViewer>;

export const Default: Story = {};

export const NullResponse: Story = {
  args: {
    value: null,
  },
};

export const LongResponse: Story = {
  args: {
    value: {
      status: "ok",
      clearedKeys: Array.from({ length: 40 }, (_, index) => `cache:freebie:variant:${index}`),
    },
  },
};
