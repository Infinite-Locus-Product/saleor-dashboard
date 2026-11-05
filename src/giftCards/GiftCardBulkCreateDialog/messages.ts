import { defineMessages } from "react-intl";

export const giftCardBulkCreateDialogMessages = defineMessages({
  title: {
    id: "7dhhzL",
    defaultMessage: "Bulk Issue Gift Cards",
    description: "bulk issue gift cards dialog title",
  },
  createdSuccessAlertTitle: {
    id: "3bQz2o",
    defaultMessage: "Gift Cards Issued",
    description: "bulk issue gift cards success alert title",
  },
  batchNameLabel: {
    defaultMessage: "Batch name (tag), must be new",
    id: "sQAqn7",
    description: "gift voucher batch tag field label",
  },
  prefixLabel: {
    defaultMessage: "Code prefix (6 letters, starting with TX)",
    id: "PSqMuS",
    description: "gift voucher batch code prefix field label",
  },
  prefixHelperText: {
    defaultMessage: "Every code = this prefix + 6 random letters and digits, e.g. TXYSPN4K7Q2M",
    id: "5NXlKx",
    description: "gift voucher batch code prefix field helper text",
  },
  giftVoucherExplanation: {
    defaultMessage:
      "All vouchers are active and expire 12 months from today. The tag is the batch name and must be new. After creation you can export the codes.",
    id: "qplndl",
    description: "gift voucher bulk create modal bottom explanation",
  },
  createdSuccessAlertDescription: {
    id: "a/x3DZ",
    defaultMessage: "{cardsAmount} gift cards issued",
    description: "bulk issue gift cards success alert description",
  },
});
