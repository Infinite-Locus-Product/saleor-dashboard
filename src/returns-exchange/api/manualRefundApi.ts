import {
  type ManualRefundDetail,
  type ManualRefundListItem,
  type ManualRefundLookup,
  type ManualReturnPagination,
} from "../types";
import { createManualReturnApiError } from "./manualReturnApiError";
import { getTenexuBaseUrl } from "./tenexuBaseUrl";

const BASE_URL = getTenexuBaseUrl();

type JsonRecord = Record<string, unknown>;

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${localStorage.getItem("_saleor_auth_token") || ""}`,
    "X-Refresh-Token": localStorage.getItem("_saleorRefreshToken") || "",
  };
}

/** Sends JSON (or a FormData upload) and returns the response body; throws with the backend's message and code. */
async function request(
  method: "GET" | "POST",
  path: string,
  body?: JsonRecord | FormData,
): Promise<JsonRecord> {
  const isUpload = body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    // A FormData body sets its own multipart Content-Type.
    headers:
      body && !isUpload ? { ...authHeaders(), "Content-Type": "application/json" } : authHeaders(),
    body: body && !isUpload ? JSON.stringify(body) : body,
  });
  const json: JsonRecord | null = await res.json().catch(() => null);

  if (!res.ok || !json || json.ok === false) {
    throw createManualReturnApiError({
      message:
        (typeof json?.message === "string" && json.message) || `Request failed: ${res.status}`,
      status: res.status,
      code: typeof json?.code === "string" ? json.code : null,
    });
  }

  return json;
}

export async function lookupOrderForManualRefund(orderNumber: string): Promise<ManualRefundLookup> {
  const body = await request("POST", "/cx/manual-refunds/order-lookup", {
    order_number: orderNumber.trim(),
  });

  return body.data as ManualRefundLookup;
}

/** Locks the delivery note and sends the refund to the gateway. */
export async function createManualRefund(payload: {
  order_number: string;
  fulfillment_id: string;
  reason: string;
}): Promise<ManualRefundDetail> {
  const body = await request("POST", "/cx/manual-refunds", payload);

  return body.data as ManualRefundDetail;
}

export async function fetchManualRefunds(
  page: number,
  limit: number,
  filters: { search?: string; status?: string } = {},
): Promise<{ data: ManualRefundListItem[]; pagination: ManualReturnPagination }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });

  if (filters.search) qs.set("search", filters.search);

  if (filters.status) qs.set("status", filters.status);

  const body = await request("GET", `/cx/manual-refunds?${qs.toString()}`);

  return {
    data: (body.data as ManualRefundListItem[]) ?? [],
    pagination: (body.pagination as ManualReturnPagination) ?? { total: 0, page, limit },
  };
}

export async function fetchManualRefund(mrfId: string): Promise<ManualRefundDetail> {
  const body = await request("GET", `/cx/manual-refunds/${encodeURIComponent(mrfId)}`);

  return body.data as ManualRefundDetail;
}

/** Saves the transaction reference and, when given, a new proof file (PDF or image). */
export async function saveManualRefundProof(
  mrfId: string,
  txnReference: string,
  file: File | null,
): Promise<ManualRefundDetail> {
  const form = new FormData();

  form.append("txn_reference", txnReference.trim());

  if (file) form.append("file", file);

  const body = await request("POST", `/cx/manual-refunds/${encodeURIComponent(mrfId)}/proof`, form);

  return body.data as ManualRefundDetail;
}

export async function markManualRefundRefunded(mrfId: string): Promise<ManualRefundDetail> {
  const body = await request(
    "POST",
    `/cx/manual-refunds/${encodeURIComponent(mrfId)}/mark-refunded`,
  );

  return body.data as ManualRefundDetail;
}
