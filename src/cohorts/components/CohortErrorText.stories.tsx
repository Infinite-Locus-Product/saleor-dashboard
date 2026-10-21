import type { Meta, StoryObj } from "@storybook/react-vite";

import { cohortMessages } from "../messages";
import { CohortErrorText } from "./CohortErrorText";

const meta: Meta<typeof CohortErrorText> = {
  title: "Cohorts/CohortErrorText",
  component: CohortErrorText,
};

export default meta;

type Story = StoryObj<typeof CohortErrorText>;

export const MappedMessage: Story = {
  args: {
    error: { message: cohortMessages.syncNotAllowed, detail: null },
  },
};

export const FallbackWithServerDetail: Story = {
  args: {
    error: { message: cohortMessages.createError, detail: 'A cohort named "VIP" already exists' },
  },
};
