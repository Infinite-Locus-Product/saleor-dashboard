/**
 * TTXY-4841 — saves the "Restrict to cohort(s)" card alongside the voucher.
 *
 * Order: the voucher (Saleor) first, so the backend sees the voucher's new
 * dates; the restriction (TenexuBackend) only after a clean voucher save and
 * only when the card changed. A failed restriction save is shown on the card
 * and never turns the voucher save into a failure.
 */
import {
  type VoucherFormDates,
  voucherWindowFromDates,
} from "@dashboard/discounts/components/VoucherCohortRestrictionCard/model";
import { type VoucherCohortRestrictionController } from "@dashboard/discounts/components/VoucherCohortRestrictionCard/useVoucherCohortRestriction";

export const voucherWindowFromForm = (
  data: VoucherFormDates,
): { voucherStart: string | null; voucherEnd: string | null } => {
  const { start, end } = voucherWindowFromDates(data);

  return { voucherStart: start, voucherEnd: end };
};

export function createCohortRestrictionSubmitHandler<TData extends VoucherFormDates, TError>(
  submitVoucher: (data: TData) => Promise<TError[]>,
  restriction: VoucherCohortRestrictionController,
  onRestrictionNotSaved?: () => void,
) {
  return async (data: TData): Promise<TError[]> => {
    const errors = await submitVoucher(data);

    if (errors.length === 0 && restriction.status === "ready" && restriction.dirty) {
      const saved = await restriction.save(voucherWindowFromForm(data));

      if (!saved) onRestrictionNotSaved?.();
    }

    return errors;
  };
}
