// @ts-strict-ignore
import { GiftCardErrorCode, type GiftCardErrorFragment } from "@dashboard/graphql";
import reduce from "lodash/reduce";

import { type GiftCardBulkCreateFormData, type GiftCardBulkCreateFormErrors } from "./types";

// Gift voucher codes start with this prefix: 6 uppercase letters starting with TX.
export const GIFT_VOUCHER_PREFIX_RE = /^TX[A-Z]{4}$/;

const validateField = (
  {
    expiryDate,
    expiryPeriodAmount,
    expiryType,
    expirySelected,
    expiryPeriodType,
  }: GiftCardBulkCreateFormData,
  value,
  key: keyof GiftCardBulkCreateFormData,
): Pick<GiftCardErrorFragment, "field" | "code"> | null => {
  const error = { code: GiftCardErrorCode.INVALID, field: key };
  const expiryDateSelected = expirySelected && expiryType === "EXPIRY_DATE";
  const expiryPeriodSelected = expirySelected && expiryType === "EXPIRY_PERIOD";

  switch (key) {
    case "prefix":
      return GIFT_VOUCHER_PREFIX_RE.test(value) ? null : error;

    case "tags":
      return !value?.trim() ? error : null;

    case "cardsAmount":
    case "balanceCurrency":
    case "balanceAmount":
      return !value ? error : null;

    case "expiryDate":
      return expiryDateSelected && !expiryDate ? error : null;

    case "expiryPeriodAmount":
      return expiryPeriodSelected && (!expiryPeriodType || !expiryPeriodAmount)
        ? { ...error, field: "expiryDate" }
        : null;
  }
};

export const validateForm = (formData: GiftCardBulkCreateFormData): GiftCardBulkCreateFormErrors =>
  reduce(
    formData,
    (resultErrors, value, key: keyof GiftCardBulkCreateFormData) => {
      const correspondingKeys = {
        cardsAmount: "count",
        balanceCurrency: "balance",
        balanceAmount: "balance",
        expiryPeriodAmount: "expiryDate",
      };
      const formError = validateField(formData, value, key);

      if (!formError) {
        return resultErrors;
      }

      return { ...resultErrors, [correspondingKeys[key] || key]: formError };
    },
    {},
  );
