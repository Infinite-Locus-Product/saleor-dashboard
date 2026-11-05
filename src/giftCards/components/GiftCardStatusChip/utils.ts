export interface GiftCardWithBalance {
  currentBalance?: { amount: number } | null;
}

/** A gift card with nothing left on it (gift voucher status "Exhausted"). */
export const isExhausted = (giftCard: GiftCardWithBalance): boolean =>
  giftCard.currentBalance?.amount === 0;
