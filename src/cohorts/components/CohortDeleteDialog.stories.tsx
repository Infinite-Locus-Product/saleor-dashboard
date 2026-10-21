import type { Meta, StoryObj } from "@storybook/react-vite";

import { cohortMessages } from "../messages";
import { CohortDeleteDialog } from "./CohortDeleteDialog";

const meta: Meta<typeof CohortDeleteDialog> = {
  title: "Cohorts/CohortDeleteDialog",
  component: CohortDeleteDialog,
  args: {
    open: true,
    cohortName: "include821",
    memberCount: 12,
    coupons: [],
    lookupError: null,
    deleteError: null,
    deleting: false,
    onClose: () => {},
    onConfirm: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof CohortDeleteDialog>;

export const Unused: Story = {};

export const LoadingCoupons: Story = {
  args: { coupons: null },
};

export const UsedByCoupons: Story = {
  args: {
    coupons: [
      { voucherId: "V1", voucherCode: "FLAT100", startTime: null, endTime: null },
      { voucherId: "V2", voucherCode: "NEW50", startTime: null, endTime: null },
      { voucherId: "Vm91Y2hlcjoz", voucherCode: null, startTime: null, endTime: null },
    ],
  },
};

export const LookupFailed: Story = {
  args: {
    coupons: null,
    lookupError: { message: cohortMessages.networkError, detail: null },
  },
};

export const Deleting: Story = {
  args: { deleting: true },
};

export const DeleteFailedUntag: Story = {
  args: {
    deleteError: { message: cohortMessages.deleteUntagFailed, detail: null },
  },
};
