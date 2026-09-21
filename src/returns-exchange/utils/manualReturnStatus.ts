import {
  type LookupClassification,
  type ManualReturnPaymentMethod,
  type OverrideReason,
  type PickupAddress,
} from "../types";

export interface SelectOption {
  value: string;
  label: string;
}

// ─── Return status ────────────────────────────────────────────────────────────

/** Storefront return-status labels (backend FULFILLMENT_STATUS_MAP + REFUND_IN_PROCESS). */
export const RETURN_STATUS_LABELS: Record<string, string> = {
  RETURN_APPROVED: "Return Approved",
  RETURN_SCHEDULED: "Pickup Scheduled",
  RETURN_PICKED_UP: "Return Picked Up",
  RETURN_COMPLETED: "Return Completed",
  RETURN_CANCELLED: "Return Cancelled",
  REFUND_INITIATED: "Refund Initiated",
  REFUND_IN_PROCESS: "Refund Processing",
  REFUND_PROCESSING: "Refund Processing",
  REFUND_COMPLETED: "Refund Completed",
  REFUND_FAILED: "Refund Failed",
  RTO_INITIATED: "Return To Origin",
};

/** "RETURN_QC_PENDING" → "Return Qc Pending" */
export function humanizeStatus(status: string): string {
  return status
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function returnStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return "—";
  }

  return RETURN_STATUS_LABELS[status] ?? humanizeStatus(status);
}

/**
 * Only REFUND_IN_PROCESS is ever written to the status tables (Easebuzz payout
 * mapper); REFUND_PROCESSING exists only as a storefront tracker step, so it
 * keeps a chip label but gets no filter option.
 */
export const RETURN_STATUS_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "RETURN_APPROVED", label: "Return Approved" },
  { value: "RETURN_SCHEDULED", label: "Pickup Scheduled" },
  { value: "RETURN_PICKED_UP", label: "Return Picked Up" },
  { value: "RETURN_COMPLETED", label: "Return Completed" },
  { value: "RETURN_CANCELLED", label: "Return Cancelled" },
  { value: "REFUND_INITIATED", label: "Refund Initiated" },
  { value: "REFUND_IN_PROCESS", label: "Refund Processing" },
  { value: "REFUND_COMPLETED", label: "Refund Completed" },
  { value: "REFUND_FAILED", label: "Refund Failed" },
  { value: "RTO_INITIATED", label: "Return To Origin" },
];

// ─── ERP sync ─────────────────────────────────────────────────────────────────

const ERP_SYNC_LABELS: Record<string, string> = {
  PENDING: "Pending",
  SUCCESS: "Synced",
  FAILED: "Failed",
};

export function erpSyncLabel(status: string | null | undefined): string {
  if (!status) {
    return "—";
  }

  return ERP_SYNC_LABELS[status] ?? humanizeStatus(status);
}

export const ERP_SYNC_FILTER_OPTIONS: SelectOption[] = [
  { value: "", label: "All ERP sync" },
  { value: "PENDING", label: "ERP: Pending" },
  { value: "SUCCESS", label: "ERP: Synced" },
  { value: "FAILED", label: "ERP: Failed" },
];

// ─── Eligibility ──────────────────────────────────────────────────────────────

export const OVERRIDE_REASON_LABELS: Record<OverrideReason, string> = {
  window_exceeded: "Return window exceeded",
  not_returnable: "Product not returnable",
  cant_return_flag: "Return blocked flag set",
};

export function overrideReasonLabel(reason: string): string {
  const labels: Record<string, string> = OVERRIDE_REASON_LABELS;

  return labels[reason] ?? humanizeStatus(reason);
}

export const CLASSIFICATION_LABELS: Record<LookupClassification, string> = {
  eligible: "Eligible",
  in_transit: "In transit",
  already_claimed: "Already claimed",
  unfulfilled: "Not yet shipped",
  returned_or_cancelled: "Returned / cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<ManualReturnPaymentMethod, string> = {
  COD: "COD",
  PREPAID: "Prepaid",
};

// ─── Validation ───────────────────────────────────────────────────────────────

export const OVERRIDE_NOTE_MIN = 15;
export const OVERRIDE_NOTE_MAX = 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPI_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidUpi(value: string): boolean {
  return UPI_REGEX.test(value.trim());
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Macaw Select hands back either the option or its value depending on the `value` prop shape. */
export function optionValue(option: string | SelectOption | null | undefined): string {
  if (!option) {
    return "";
  }

  return typeof option === "string" ? option : option.value;
}

export function formatMoney(amount: number | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const toDate = (iso: string | null | undefined): Date | null => {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : date;
};

export function formatDate(iso: string | null | undefined): string {
  const date = toDate(iso);

  return date
    ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
}

export function formatTime(iso: string | null | undefined): string {
  const date = toDate(iso);

  return date ? date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function formatDateTime(iso: string | null | undefined): string {
  return toDate(iso) ? `${formatDate(iso)}, ${formatTime(iso)}` : "—";
}

export function formatPickupAddress(address: PickupAddress | null | undefined): string {
  if (!address) {
    return "—";
  }

  return [
    address.streetAddress1,
    address.streetAddress2,
    address.city,
    address.countryArea,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}
