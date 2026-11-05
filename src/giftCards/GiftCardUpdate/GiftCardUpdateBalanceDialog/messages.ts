import { defineMessages } from "react-intl";

export const giftCardUpdateBalanceDialogMessages = defineMessages({
  title: {
    id: "tKxCld",
    defaultMessage: "Set balance",
    description: "set balance dialog title label",
  },
  subtitle: {
    defaultMessage:
      "Set what is left on this gift card. Its original value stays the same, and the balance cannot go above it.",
    id: "PflCcB",
    description: "set balance dialog subtitle",
  },
  reasonLabel: {
    defaultMessage: "Reason (saved in the history)",
    id: "DeaunT",
    description: "set balance dialog reason field label",
  },
  updatedSuccessAlertTitle: {
    id: "vG57x5",
    defaultMessage: "Card balance updated",
    description: "card update success alert title",
  },
  reasonNotSavedAlert: {
    id: "FpXjbR",
    defaultMessage: "Balance updated, but the reason note was not saved. Add it in History.",
    description: "set balance dialog: balance changed but the reason note failed",
  },
  changeButtonLabel: {
    id: "STJx8N",
    defaultMessage: "Change",
    description: "change button label",
  },
});
