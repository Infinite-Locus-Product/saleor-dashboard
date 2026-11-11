import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { type CohortRestrictionRow, newRow } from "./model";
import { type VoucherCohortRestrictionController } from "./useVoucherCohortRestriction";
import { VoucherCohortRestrictionCard } from "./VoucherCohortRestrictionCard";

const voucherWindow = {
  start: "2026-11-10T00:00:00+05:30",
  end: "2026-11-30T23:59:00+05:30",
};

const Controlled = ({ initial }: { initial: CohortRestrictionRow[] }) => {
  const [rows, setRows] = useState(initial);
  const controller: VoucherCohortRestrictionController = {
    status: "ready",
    rows,
    setRows,
    defaultTemplateEvent: "cohort_coupon_default",
    unreadable: false,
    overwriteConfirmed: false,
    confirmOverwrite: () => undefined,
    dirty: false,
    loadError: null,
    saveError: null,
    saving: false,
    reload: () => undefined,
    validate: () => true,
    save: async () => true,
  };

  return <VoucherCohortRestrictionCard controller={controller} voucherWindow={voucherWindow} />;
};

const meta: Meta<typeof Controlled> = {
  title: "Discounts/VoucherCohortRestrictionCard",
  component: Controlled,
};

export default meta;

type Story = StoryObj<typeof Controlled>;

export const NoRestriction: Story = { args: { initial: [] } };

export const TwoCohorts: Story = {
  args: {
    initial: [
      {
        ...newRow(3, "Lapsed buyers"),
        templateEvent: "cohort_coupon_wa",
        storedTemplateEvent: "cohort_coupon_wa",
      },
      // L7 — a start before the voucher's start shows the inline error
      { ...newRow(8, "Jaipur repeaters"), start: "2026-11-01T10:00" },
    ],
  },
};
