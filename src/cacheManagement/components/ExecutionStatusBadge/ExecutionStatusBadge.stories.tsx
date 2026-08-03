import type { Meta, StoryObj } from "@storybook/react-vite";

import { ExecutionStatusBadge } from "./ExecutionStatusBadge";

const meta: Meta<typeof ExecutionStatusBadge> = {
  title: "Cache Management/ExecutionStatusBadge",
  component: ExecutionStatusBadge,
  args: {
    status: "success",
    httpStatus: 200,
    durationMs: 342,
  },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["success", "error"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof ExecutionStatusBadge>;

export const Success: Story = {};

export const Failed: Story = {
  args: {
    status: "error",
    httpStatus: 500,
    durationMs: 1204,
  },
};

export const NetworkFailure: Story = {
  args: {
    status: "error",
    httpStatus: 0,
    durationMs: 30,
  },
};
