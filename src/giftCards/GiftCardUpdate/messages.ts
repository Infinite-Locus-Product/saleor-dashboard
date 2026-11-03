// @ts-strict-ignore
import { GiftCardErrorCode, type GiftCardErrorFragment } from "@dashboard/graphql";
import commonErrorMessages, {
  getCommonFormFieldErrorMessage,
} from "@dashboard/utils/errors/common";
import { defineMessages, type IntlShape } from "react-intl";

const giftCardErrorMessages = defineMessages({
  notFound: {
    id: "29L5Yq",
    defaultMessage: "Couldn't find gift card",
    description: "gift card not found message",
  },
  unique: {
    defaultMessage: "This value is already used. Please use a new one.",
    id: "MZ57TX",
    description: "gift card value already exists message, e.g. a batch tag",
  },
});

export function getGiftCardErrorMessage(
  error: Omit<GiftCardErrorFragment, "__typename" | "message"> | undefined,
  intl: IntlShape,
): string {
  if (error) {
    switch (error.code) {
      case GiftCardErrorCode.NOT_FOUND:
        return intl.formatMessage(giftCardErrorMessages.notFound);
      case GiftCardErrorCode.INVALID:
        return intl.formatMessage(commonErrorMessages.invalid);
      case GiftCardErrorCode.UNIQUE:
        return intl.formatMessage(giftCardErrorMessages.unique);
    }
  }

  return getCommonFormFieldErrorMessage(error, intl);
}
