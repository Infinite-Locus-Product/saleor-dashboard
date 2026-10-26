import { type CXReturnStatus } from "../types";

/**
 * Statuses that end a CX return request (TTXY-6032). Mirrors TenexuBackend
 * `src/constant/cxReturnStatus.ts` (`CX_CLOSED_STATUSES`). A closed request is read-only:
 * no calls, approve, convert or reject.
 */
export const CX_CLOSED_STATUSES: readonly CXReturnStatus[] = [
  "EXCHANGED",
  "APPROVED",
  "AUTO_APPROVED",
  "RETURN_REJECTED",
];

export const isClosedStatus = (status: CXReturnStatus | null | undefined): boolean =>
  !!status && CX_CLOSED_STATUSES.includes(status);

/** Bounds on the trimmed rejection reason (LLD §4.1). */
export const REJECTION_REASON_MIN = 10;
export const REJECTION_REASON_MAX = 500;

const PINCODE_RE = /^\d{6}$/;

/** A pincode filter value is valid when, after trimming, it is exactly 6 digits. */
export const isValidPincode = (value: string): boolean => PINCODE_RE.test(value.trim());
