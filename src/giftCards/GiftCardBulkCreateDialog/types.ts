import { type GiftCardErrorFragment, type TimePeriodTypeEnum } from "@dashboard/graphql";
import { type FormChange } from "@dashboard/hooks/useForm";
import { type Option } from "@saleor/macaw-ui-next";

import { type GiftCardExpiryType } from "../GiftCardCreateDialog/types";

type GiftCardErrorKey =
  | "prefix"
  | "tags"
  | "expiryDate"
  | "currency"
  | "expiryPeriod"
  | "amount"
  | "balance"
  | "count";

export const giftCardBulkCreateErrorKeys: GiftCardErrorKey[] = [
  "prefix",
  "tags",
  "expiryDate",
  "currency",
  "amount",
  "balance",
  "count",
];

// A batch has exactly one new tag (the batch name), typed as text.
export interface GiftCardBulkCreateFormData extends Omit<GiftCardCreateCommonFormData, "tags"> {
  cardsAmount: number;
  prefix: string;
  tags: string;
}

export type GiftCardBulkCreateFormError = Pick<GiftCardErrorFragment, "code" | "field">;

export type GiftCardBulkCreateFormErrors = Partial<
  Record<GiftCardErrorKey, GiftCardBulkCreateFormError>
>;

export interface GiftCardBulkCreateFormCommonProps {
  change: FormChange;
  toggleValue: FormChange;
  errors: GiftCardBulkCreateFormErrors;
  data: GiftCardBulkCreateFormData;
}

export interface GiftCardCreateCommonFormData {
  expirySelected: boolean;
  expiryType: GiftCardExpiryType;
  expiryPeriodType: TimePeriodTypeEnum;
  expiryPeriodAmount: number;
  requiresActivation: boolean;
  tags: Option[];
  balanceAmount: number;
  balanceCurrency: string;
  expiryDate: string;
}
