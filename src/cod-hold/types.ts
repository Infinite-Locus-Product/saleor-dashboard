export type CodHoldStatus = "HELD" | "RELEASED" | "CONVERTED_PREPAID" | "CUSTOMER_CANCELLED";
export type CodHoldSlaTier = "ON_TRACK" | "DELAYED" | "BREACHED";
export type CodHoldCallLogAction =
  | "CANCEL"
  | "UPDATE_ADDRESS"
  | "SEND_PAYMENT_LINK"
  | "RELEASE"
  | "LOG_CALL";

// Internal CX Status — the PRD's call-logging / mark-unreachable / resolution-gate
// workflow state. Distinct from CodHoldStatus (the order's ERP-facing state) and
// from CodHoldSlaTier (a purely time-based SLA badge) — do not conflate the three.
export type CodHoldInternalCxStatus =
  | "PENDING"
  | "CX_REVIEW"
  | "CX_ACTION"
  | "CONVERTED"
  | "ADDRESS_CHANGED"
  | "RELEASED"
  | "CANCELLED"
  | "AUTO_RELEASED"
  | "AUTO_CANCELLED";

export type CodHoldCallOutcome = "ANSWERED" | "NO_ANSWER" | "BUSY" | "CALLBACK_REQUESTED";

// Backend's sort whitelist for GET /cod-hold/orders (TTXY-6559).
export type CodHoldSortField = "orderNumber" | "matchedPhone" | "orderValue" | "heldAt" | "status";
export type CodHoldSortDir = "asc" | "desc";

export interface CodHoldOrder {
  id: string;
  saleorOrderId: string;
  orderNumber: string;
  status: CodHoldStatus;
  matchedPincode: string | null;
  matchedPhone: string | null;
  assignedAgentEmail: string | null;
  heldAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  releaseReason: "MANUAL" | "AUTO_TIMEOUT" | null;
  slaTier: CodHoldSlaTier | null;
  // Persisted at hold-entry time — NOT the same value as the detail view's live
  // Saleor snapshot total (CodHoldOrderSnapshot.total). The queue list uses this
  // persisted value since it doesn't fetch a full live snapshot per row.
  orderValue: number | null;
  orderValueCurrency: string | null;
  internalCxStatus: CodHoldInternalCxStatus;
}

// A legacy "action" log (created by Cancel / Update Address / Send Payment Link /
// Release — action + note) and a new PRD "logged call" (created by the Log Call
// dialog — outcome + note) share this same callLogs array on the detail
// response, told apart by which optional fields are present. Both kinds use the
// same "note" field name on the wire (listCallLogs never returns "notes").
export interface CodHoldCallLog {
  id: string;
  agentEmail: string;
  action?: CodHoldCallLogAction;
  note: string;
  outcome?: CodHoldCallOutcome;
  customerDecision?: string | null;
  callbackAt?: string | null;
  createdAt: string;
}

export interface CodHoldOrderSnapshot {
  id: string;
  number: string;
  status: string;
  created: string;
  userEmail: string | null;
  // Live Saleor snapshot total — the detail view's "Order Value" field reads
  // this, NOT the queue list's persisted CodHoldOrder.orderValue.
  total: { gross: { amount: number; currency: string } } | null;
  shippingAddress: {
    firstName: string;
    lastName: string;
    phone: string;
    streetAddress1: string;
    streetAddress2: string;
    city: string;
    cityArea: string;
    postalCode: string;
    countryArea: string;
    country: { code: string; country: string };
  } | null;
  lines: { id: string; productName: string; variantName: string; quantity: number }[];
}

export interface CodHoldOrderDetail extends CodHoldOrder {
  callLogs: CodHoldCallLog[];
  orderSnapshot: CodHoldOrderSnapshot | null;
  // COD → Prepaid Conversion via WhatsApp: the manual Send Payment Link
  // (Easebuzz) action is retired behind its own flag, independent of the
  // now-standing automatic GoKwik flow — false hides the feature entirely,
  // not just disables the button.
  sendPaymentLinkEnabled: boolean;
  firstViewedAt: string | null;
  // Non-null = the Unreachable flag is set on this order.
  unreachableMarkedAt: string | null;
  // True once at least one call log has outcome ANSWERED. Drives disabling
  // Confirm/Cancel/Convert/ChangeAddress client-side — trust this field,
  // don't recompute it from callLogs.
  callLogGateSatisfied: boolean;
}

export interface CodHoldListItem {
  id: string;
  value: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface CodHoldSettings {
  slaOnTrackHours: number;
  slaDelayedHours: number;
  slaBreachedHours: number;
  // COD → Prepaid Conversion via WhatsApp: how long every COD order sits in
  // the universal pre-CX hold window before the risk-list check runs.
  conversionHoldMinutes: number;
  alertRecipients: string[];
}

export interface CodHoldShippingAddress {
  firstName: string;
  // Optional — real storefront orders save an empty lastName for single-word
  // customer names; only firstName is actually required (H3). The backend's
  // UpdateAddressInput treats this the same way.
  lastName?: string;
  streetAddress1: string;
  streetAddress2?: string;
  city: string;
  cityArea?: string;
  postalCode: string;
  // Required, not optional: Saleor's per-country address rules reject a
  // missing state for India (and most other countries) with an unhelpful,
  // field-name-less "This field is required." x2. The backend's own
  // skipValidation: true does NOT bypass this on the deployed instance
  // (confirmed 2026-09-04 by calling orderUpdate directly against Saleor),
  // so this is a real required field in the form instead.
  countryArea: string;
  country: string;
  phone: string;
}
