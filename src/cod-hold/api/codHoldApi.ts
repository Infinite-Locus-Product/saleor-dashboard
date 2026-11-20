import {
  type CodHoldCallOutcome,
  type CodHoldListItem,
  type CodHoldOrder,
  type CodHoldOrderDetail,
  type CodHoldSettings,
  type CodHoldShippingAddress,
  type CodHoldSortDir,
  type CodHoldSortField,
} from "../types";

const BASE_URL = import.meta.env.VITE_TENEXU_API_URL;

if (!BASE_URL) {
  throw new Error(
    "VITE_TENEXU_API_URL is not set. The COD Hold module cannot reach the backend without it.",
  );
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("_saleor_auth_token") || "";
  // Same convention as returns-exchange/api/returnsApi.ts — the Saleor SDK
  // stores the refresh token under this key, and the backend's
  // checkAndRefreshToken middleware needs it to refresh an expired token
  // without forcing a re-login.
  const refreshToken = localStorage.getItem("_saleorRefreshToken") || "";

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Refresh-Token": refreshToken,
  };
}

async function apiRequest<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();

  if (!res.ok) {
    // Most endpoints send {error, detail} — a machine-readable code plus an
    // optional detail string. The answered_call_required 400 (the call-log
    // gate) is the one case that also sends a human-readable {message}, so
    // that's tried first; detail/error are the fallbacks for every other
    // endpoint.
    throw new Error(
      json?.message || json?.detail || json?.error || `Request failed: ${res.status}`,
    );
  }

  return json;
}

async function uploadCsv<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();

  formData.append("file", file);

  const token = localStorage.getItem("_saleor_auth_token") || "";
  const refreshToken = localStorage.getItem("_saleorRefreshToken") || "";
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "X-Refresh-Token": refreshToken },
    body: formData,
  });
  const json = await res.json();

  if (!res.ok) {
    // Kept consistent with apiRequest's error-message precedence above.
    throw new Error(
      json?.message || json?.detail || json?.error || `Request failed: ${res.status}`,
    );
  }

  return json;
}

// ─── Held orders ────────────────────────────────────────────────────────────

export async function fetchHeldOrders(params: {
  status?: string;
  assignedAgentEmail?: string;
  pincode?: string;
  from?: string;
  to?: string;
  orderNumber?: string;
  phone?: string;
  minValue?: number;
  maxValue?: number;
  sortBy?: CodHoldSortField;
  sortDir?: CodHoldSortDir;
  cursor?: string;
  limit?: number;
}): Promise<{ orders: CodHoldOrder[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();

  if (params.status) qs.set("status", params.status);

  if (params.assignedAgentEmail) qs.set("assignedAgentEmail", params.assignedAgentEmail);

  if (params.pincode) qs.set("pincode", params.pincode);

  if (params.from) qs.set("from", params.from);

  if (params.to) qs.set("to", params.to);

  if (params.orderNumber) qs.set("orderNumber", params.orderNumber);

  if (params.phone) qs.set("phone", params.phone);

  if (params.minValue !== undefined) qs.set("minValue", String(params.minValue));

  if (params.maxValue !== undefined) qs.set("maxValue", String(params.maxValue));

  if (params.sortBy) qs.set("sortBy", params.sortBy);

  if (params.sortDir) qs.set("sortDir", params.sortDir);

  if (params.cursor) qs.set("cursor", params.cursor);

  if (params.limit) qs.set("limit", String(params.limit));

  return apiRequest("GET", `/cod-hold/orders?${qs.toString()}`);
}

export async function fetchHeldOrderDetail(holdId: string): Promise<CodHoldOrderDetail> {
  return apiRequest("GET", `/cod-hold/orders/${holdId}`);
}

export async function submitCancel(holdId: string, note: string): Promise<void> {
  await apiRequest("POST", `/cod-hold/orders/${holdId}/cancel`, { note });
}

export async function submitUpdateAddress(
  holdId: string,
  shippingAddress: CodHoldShippingAddress,
  note: string,
): Promise<void> {
  await apiRequest("POST", `/cod-hold/orders/${holdId}/update-address`, { shippingAddress, note });
}

export async function submitSendPaymentLink(
  holdId: string,
  note: string,
  customer: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    amount: number;
    orderNumber: string;
  },
): Promise<{ paymentLinkUrl: string }> {
  return apiRequest("POST", `/cod-hold/orders/${holdId}/send-payment-link`, { note, ...customer });
}

export async function submitRelease(holdId: string, note: string): Promise<void> {
  await apiRequest("POST", `/cod-hold/orders/${holdId}/release`, { note });
}

// Both endpoints below actually respond with just {status: "..."} — nothing
// in the caller reads the response (OrderDetailView always reloads the full
// detail via fetchHeldOrderDetail afterwards), so these are typed Promise<void>
// rather than inventing a response shape nothing uses.
export async function submitLogCall(
  holdId: string,
  input: {
    outcome: CodHoldCallOutcome;
    customerDecision?: string;
    notes: string;
    callbackAt?: string;
  },
): Promise<void> {
  await apiRequest("POST", `/cod-hold/orders/${holdId}/call-log`, input);
}

export async function submitMarkUnreachable(holdId: string): Promise<void> {
  await apiRequest("POST", `/cod-hold/orders/${holdId}/mark-unreachable`, {});
}

// ─── List management (pincodes / phones / agents) ──────────────────────────

export type CodHoldListName = "pincodes" | "phones" | "agents";

export async function fetchList(list: CodHoldListName): Promise<CodHoldListItem[]> {
  const result = await apiRequest<{ items: CodHoldListItem[] }>("GET", `/cod-hold/${list}`);

  return result.items;
}

export async function addListValue(list: CodHoldListName, value: string): Promise<void> {
  await apiRequest("POST", `/cod-hold/${list}`, { value });
}

export async function removeListValue(list: CodHoldListName, value: string): Promise<void> {
  await apiRequest("DELETE", `/cod-hold/${list}/${encodeURIComponent(value)}`);
}

export async function uploadListCsv(
  list: CodHoldListName,
  file: File,
): Promise<{ inserted: number; errors: { row: number; message: string }[] }> {
  return uploadCsv(`/cod-hold/${list}/upload`, file);
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<CodHoldSettings> {
  return apiRequest("GET", "/cod-hold/settings");
}

export async function saveSettings(
  settings: Pick<
    CodHoldSettings,
    "slaOnTrackHours" | "slaDelayedHours" | "slaBreachedHours" | "conversionHoldMinutes"
  >,
): Promise<CodHoldSettings> {
  return apiRequest("PUT", "/cod-hold/settings", settings);
}

export async function addAlertEmail(email: string): Promise<void> {
  await apiRequest("POST", "/cod-hold/settings/alert-emails", { email });
}

export async function removeAlertEmail(email: string): Promise<void> {
  await apiRequest("DELETE", `/cod-hold/settings/alert-emails/${encodeURIComponent(email)}`);
}
