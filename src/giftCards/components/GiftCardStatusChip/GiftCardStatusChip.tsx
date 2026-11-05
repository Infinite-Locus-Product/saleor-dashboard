import { Pill } from "@dashboard/components/Pill";
import {
  type ExtendedGiftCard,
  type GiftCardBase,
} from "@dashboard/giftCards/GiftCardUpdate/providers/GiftCardDetailsProvider/types";
import { useIntl } from "react-intl";

import { giftCardUpdatePageHeaderMessages as giftCardStatusChipMessages } from "../../GiftCardUpdate/GiftCardUpdatePageHeader/messages";
import { type GiftCardWithBalance, isExhausted } from "./utils";

interface GiftCardStatusChipProps<
  T extends ExtendedGiftCard<GiftCardBase & { isActive: boolean } & GiftCardWithBalance>,
> {
  giftCard: T;
}

function GiftCardStatusChip<
  T extends ExtendedGiftCard<GiftCardBase & { isActive: boolean } & GiftCardWithBalance>,
>({ giftCard }: GiftCardStatusChipProps<T>) {
  const { isExpired, isActive } = giftCard;
  const intl = useIntl();

  if (isExpired) {
    return (
      <Pill
        color="info"
        label={intl.formatMessage(giftCardStatusChipMessages.expiredStatusLabel)}
      />
    );
  }

  if (!isActive) {
    return (
      <Pill
        color="error"
        label={intl.formatMessage(giftCardStatusChipMessages.disabledStatusLabel)}
      />
    );
  }

  if (isExhausted(giftCard)) {
    return (
      <Pill
        color="info"
        label={intl.formatMessage(giftCardStatusChipMessages.exhaustedStatusLabel)}
      />
    );
  }

  return null;
}

export default GiftCardStatusChip;
