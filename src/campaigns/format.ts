// Display helpers for campaign numbers (TTXY-4841). 10XU reports GMV in INR.
import { type IntlShape } from "react-intl";

import { campaignMessages } from "./messages";

const GMV_CURRENCY = "INR";

type Intl = Pick<IntlShape, "formatNumber" | "formatMessage">;

/** A stage count; `null` is "Not tracked", never 0 (L10). */
export const formatStageCount = (intl: Intl, value: number | null): string =>
  value === null
    ? intl.formatMessage(campaignMessages.notTracked)
    : String(intl.formatNumber(value));

/** A conversion rate; "—" when there is no previous stage to convert from. */
export const formatConversion = (intl: Intl, value: number | null): string =>
  value === null
    ? "—"
    : String(intl.formatNumber(value, { style: "percent", maximumFractionDigits: 1 }));

export const formatRate = (intl: Intl, value: number | null): string =>
  value === null
    ? intl.formatMessage(campaignMessages.notAvailable)
    : String(intl.formatNumber(value, { style: "percent", maximumFractionDigits: 2 }));

/** A lift is a difference of two rates, shown signed. */
export const formatLift = (intl: Intl, value: number | null): string =>
  value === null
    ? intl.formatMessage(campaignMessages.notAvailable)
    : String(
        intl.formatNumber(value, {
          style: "percent",
          maximumFractionDigits: 2,
          signDisplay: "exceptZero",
        }),
      );

export const formatGmv = (intl: Intl, value: number | null): string =>
  value === null
    ? intl.formatMessage(campaignMessages.notAvailable)
    : String(intl.formatNumber(value, { style: "currency", currency: GMV_CURRENCY }));
