export type CodHoldStatus = "HELD" | "RELEASED" | "CONVERTED_PREPAID" | "CUSTOMER_CANCELLED";
export type CodHoldSlaTier = "ON_TRACK" | "DELAYED" | "BREACHED";
export type CodHoldCallLogAction = "CANCEL" | "UPDATE_ADDRESS" | "SEND_PAYMENT_LINK" | "RELEASE";

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
}

export interface CodHoldCallLog {
  id: string;
  agentEmail: string;
  action: CodHoldCallLogAction;
  note: string;
  createdAt: string;
}

export interface CodHoldOrderSnapshot {
  id: string;
  number: string;
  status: string;
  created: string;
  userEmail: string | null;
  total: { amount: number; currency: string } | null;
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
  alertRecipients: string[];
}

export interface CodHoldShippingAddress {
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
