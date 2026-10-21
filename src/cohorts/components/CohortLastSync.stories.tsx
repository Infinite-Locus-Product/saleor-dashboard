import type { Meta, StoryObj } from "@storybook/react-vite";

import { CohortLastSync } from "./CohortLastSync";

const meta: Meta<typeof CohortLastSync> = {
  title: "Cohorts/CohortLastSync",
  component: CohortLastSync,
};

export default meta;

type Story = StoryObj<typeof CohortLastSync>;

export const NeverSynced: Story = {
  args: {
    cohort: {
      last_synced_at: null,
      last_sync_status: null,
      last_sync_attempt_at: null,
      last_sync_error: null,
    },
  },
};

export const Success: Story = {
  args: {
    cohort: {
      last_synced_at: "2026-10-22T05:30:00Z",
      last_sync_status: "success",
      last_sync_attempt_at: "2026-10-22T05:30:00Z",
      last_sync_error: null,
    },
  },
};

export const FailedInList: Story = {
  args: {
    cohort: {
      last_synced_at: "2026-10-21T05:30:00Z",
      last_sync_status: "failed",
      last_sync_attempt_at: "2026-10-22T05:30:00Z",
      last_sync_error: "Shopify API timed out",
    },
  },
};

export const FailedDetailed: Story = {
  args: {
    ...FailedInList.args,
    detailed: true,
  },
};

export const PartialDetailed: Story = {
  args: {
    cohort: {
      last_synced_at: null,
      last_sync_status: "partial",
      last_sync_attempt_at: "2026-10-22T05:30:00Z",
      last_sync_error: "3 of 40 members could not be tagged",
    },
    detailed: true,
  },
};
