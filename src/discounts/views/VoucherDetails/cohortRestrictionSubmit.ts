/**
 * TTXY-4841 — saves the "Restrict to cohort(s)" card alongside the voucher.
 *
 * Order: the voucher (Saleor) first, so the backend sees the voucher's new
 * dates; the restriction (TenexuBackend) only after a clean voucher save and
 * only when the card changed. A failed restriction save is shown on the card
 * and never undoes the voucher save, but it does keep the form dirty (PR #19
 * C2): the result carries COHORT_RESTRICTION_NOT_SAVED, so the form's
 * unsaved-changes guard stays on and leaving the page still asks first.
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

/**
 * Returned (alone) when the voucher saved but its cohort restriction did not.
 * The form only checks that the result is non-empty; the card shows the error.
 */
export const COHORT_RESTRICTION_NOT_SAVED = {
  code: "COHORT_RESTRICTION_NOT_SAVED",
  field: "cohortRestriction",
  message: "The voucher was saved, but its cohort restriction was not.",
} as const;

export type CohortRestrictionNotSaved = typeof COHORT_RESTRICTION_NOT_SAVED;

export function createCohortRestrictionSubmitHandler<TData extends VoucherFormDates, TError>(
  submitVoucher: (data: TData) => Promise<TError[]>,
  restriction: VoucherCohortRestrictionController,
  onRestrictionNotSaved?: () => void,
) {
  return async (data: TData): Promise<Array<TError | CohortRestrictionNotSaved>> => {
    const errors = await submitVoucher(data);

    if (errors.length === 0 && restriction.status === "ready" && restriction.dirty) {
      const saved = await restriction.save(voucherWindowFromForm(data));

      if (!saved) {
        onRestrictionNotSaved?.();

        return [COHORT_RESTRICTION_NOT_SAVED];
      }
    }

    return errors;
  };
}
