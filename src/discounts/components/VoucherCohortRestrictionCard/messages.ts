import { defineMessages, type MessageDescriptor } from "react-intl";

import { type RowFieldError } from "./model";

// User-facing copy for the voucher "Restrict to cohort(s)" card (TTXY-4841).
export const voucherCohortMessages = defineMessages({
  title: {
    defaultMessage: "Restrict to cohort(s)",
    id: "a3tETg",
    description: "voucher details, cohort restriction card title",
  },
  help: {
    defaultMessage:
      "Only members of these cohorts can use this voucher. Each cohort's window must sit inside the voucher's dates; leave it blank to use the voucher's dates.",
    id: "htZXVm",
    description: "voucher details, cohort restriction card help text",
  },
  pickerLabel: {
    defaultMessage: "Cohorts",
    id: "yJt0qm",
    description: "voucher details, cohort multi-select label",
  },
  noOptions: {
    defaultMessage: "No cohorts match",
    id: "VDqHrU",
    description: "voucher details, cohort search returned nothing",
  },
  searchError: {
    defaultMessage: "Couldn't search cohorts. Try again.",
    id: "YGJane",
    description: "voucher details, cohort search failed",
  },
  empty: {
    defaultMessage: "No cohort restriction: every customer can use this voucher.",
    id: "9W3Occ",
    description: "voucher details, no cohort selected",
  },
  loading: {
    defaultMessage: "Loading cohort restriction…",
    id: "dIISTL",
    description: "voucher details, cohort restriction loading",
  },
  fixBeforeSaving: {
    defaultMessage: "Fix the cohort restriction before saving the voucher.",
    id: "drEECd",
    description: "voucher save blocked by an invalid cohort restriction row",
  },
  restrictionNotSaved: {
    defaultMessage: "The voucher was saved, but its cohort restriction was not.",
    id: "CgIBZ4",
    description: "notification after the cohort restriction save failed",
  },
  retry: {
    defaultMessage: "Retry",
    id: "/mvZ7U",
    description: "voucher details, retry loading the cohort restriction",
  },
  startLabel: {
    defaultMessage: "Start (IST)",
    id: "ozL/OM",
    description: "voucher cohort window start input label",
  },
  endLabel: {
    defaultMessage: "End (IST)",
    id: "ykoYOw",
    description: "voucher cohort window end input label",
  },
  windowHelp: {
    defaultMessage: "Blank uses the voucher's date.",
    id: "gl3HC5",
    description: "voucher cohort window inputs helper text",
  },
  templateLabel: {
    defaultMessage: "WhatsApp template event",
    id: "FxWI+H",
    description: "voucher cohort template event input label",
  },
  templateHelp: {
    defaultMessage: "Optional. Lowercase letters, digits and _; blank uses the default template.",
    id: "NEi7yr",
    description: "voucher cohort template event helper text",
  },
  holdoutLabel: {
    defaultMessage: "Holdout %",
    id: "bvc5aE",
    description: "voucher cohort holdout percentage input label",
  },
  holdoutHelp: {
    defaultMessage: "0–50, default 10. Held-out members get no message.",
    id: "9wls9n",
    description: "voucher cohort holdout percentage helper text",
  },
  repeatLabel: {
    defaultMessage: "Repeat window (days)",
    id: "jTl5s2",
    description: "voucher cohort repeat window input label",
  },
  repeatHelp: {
    defaultMessage: "1–365, default 30.",
    id: "Nkw3AT",
    description: "voucher cohort repeat window helper text",
  },
  remove: {
    defaultMessage: "Remove {name}",
    id: "ZJ21u4",
    description: "voucher cohort restriction, remove one cohort button",
  },
  errorOutsideVoucher: {
    defaultMessage: "Must be inside the voucher's dates",
    id: "8GwcMM",
    description: "voucher cohort window outside the voucher start/end",
  },
  errorEndBeforeStart: {
    defaultMessage: "End must be after the start",
    id: "NN116q",
    description: "voucher cohort window end not after its start",
  },
  errorInvalidDate: {
    defaultMessage: "Enter a valid date and time",
    id: "MdvuCF",
    description: "voucher cohort window date unparseable",
  },
  errorInvalidTemplate: {
    defaultMessage: "Use 1–64 lowercase letters, digits or _",
    id: "dzEufN",
    description: "voucher cohort template event invalid",
  },
  errorInvalidHoldout: {
    defaultMessage: "Enter a whole number from 0 to 50",
    id: "4LiI9S",
    description: "voucher cohort holdout out of range",
  },
  errorInvalidRepeat: {
    defaultMessage: "Enter a whole number of days from 1 to 365",
    id: "RXMzXs",
    description: "voucher cohort repeat window out of range",
  },
});

export const rowErrorMessages: Record<RowFieldError, MessageDescriptor> = {
  outside_voucher: voucherCohortMessages.errorOutsideVoucher,
  end_before_start: voucherCohortMessages.errorEndBeforeStart,
  invalid_date: voucherCohortMessages.errorInvalidDate,
  invalid_template: voucherCohortMessages.errorInvalidTemplate,
  invalid_holdout: voucherCohortMessages.errorInvalidHoldout,
  invalid_repeat: voucherCohortMessages.errorInvalidRepeat,
};
