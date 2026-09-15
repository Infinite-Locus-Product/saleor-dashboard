import {
  type CreateManualReturnPayload,
  type CreateManualReturnResult,
  type CreateManualReturnShipmentResult,
  type LookupResult,
  type ManualReturnDetail,
  type ManualReturnListFilters,
  type ManualReturnListItem,
  type ManualReturnPagination,
  type ReturnReason,
} from "../types";
import { createManualReturnApiError, type ManualReturnApiError } from "./manualReturnApiError";
import { getTenexuBaseUrl } from "./tenexuBaseUrl";

// Resolved at import time, like returnsApi / manualExchangeApi, so a missing
// VITE_TENEXU_API_URL fails fast instead of on the first request.
const BASE_URL = getTenexuBaseUrl();

type JsonRecord = Record<string, unknown>;

interface ApiResponse {
  status: number;
  body: JsonRecord;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("_saleor_auth_token") || "";
  // Saleor SDK stores the user's refresh token under "_saleorRefreshToken".
  // The CX backend middleware uses it to refresh an expired auth token.
  const refreshToken = localStorage.getItem("_saleorRefreshToken") || "";

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Refresh-Token": refreshToken,
  };
}

/** Parses the body as JSON; returns null for empty or non-JSON bodies (e.g. a proxy's HTML 502). */
async function readJson(res: Response): Promise<unknown> {
  try {
    const text = await res.text();

    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function extractResults(body: JsonRecord): CreateManualReturnShipmentResult[] {
  const data = body.data;

  if (isRecord(data) && Array.isArray(data.results)) {
    return data.results as CreateManualReturnShipmentResult[];
  }

  return [];
}

function toApiError(status: number, body: unknown): ManualReturnApiError {
  const record = isRecord(body) ? body : {};
  const firstFailure = extractResults(record).find(result => !result.ok);
  const message =
    (typeof record.message === "string" && record.message) ||
    firstFailure?.message ||
    `Request failed: ${status}`;
  const code = (typeof record.code === "string" && record.code) || firstFailure?.code || null;

  return createManualReturnApiError({ message, status, code });
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  acceptedStatuses: number[] = [],
): Promise<ApiResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getAuthHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await readJson(res);

  if (acceptedStatuses.includes(res.status) && isRecord(json)) {
    return { status: res.status, body: json };
  }

  if (!res.ok || !isRecord(json) || json.ok === false) {
    throw toApiError(res.status, json);
  }

  return { status: res.status, body: json };
}

export async function fetchReturnReasons(): Promise<ReturnReason[]> {
  const { body } = await request("GET", "/cx/manual-returns/return-reasons");

  return Array.isArray(body.data) ? (body.data as ReturnReason[]) : [];
}

export async function lookupOrderForManualReturn(orderNumber: string): Promise<LookupResult> {
  const { body } = await request("POST", "/cx/manual-returns/order-lookup", {
    order_number: orderNumber.trim(),
  });

  return body.data as LookupResult;
}

/**
 * Creates one MR per original shipment. 201 (all ok) and 207 (mixed) resolve
 * with every shipment result; any other non-2xx status throws.
 */
export async function createManualReturns(
  payload: CreateManualReturnPayload,
): Promise<CreateManualReturnResult> {
  const { status, body } = await request("POST", "/cx/manual-returns", payload, [201, 207]);

  return { status, ok: body.ok === true, results: extractResults(body) };
}

export async function fetchManualReturns(
  page = 1,
  limit = 20,
  filters: ManualReturnListFilters = {},
): Promise<{ data: ManualReturnListItem[]; pagination: ManualReturnPagination }> {
  const qs = new URLSearchParams();

  qs.set("page", String(page));
  qs.set("limit", String(limit));

  if (filters.search) qs.set("search", filters.search);

  if (filters.status) qs.set("status", filters.status);

  if (filters.erpSyncStatus) qs.set("erp_sync_status", filters.erpSyncStatus);

  const { body } = await request("GET", `/cx/manual-returns?${qs.toString()}`);
  const data = Array.isArray(body.data) ? (body.data as ManualReturnListItem[]) : [];
  const pagination = isRecord(body.pagination)
    ? (body.pagination as unknown as ManualReturnPagination)
    : { total: data.length, page, limit };

  return { data, pagination };
}

export async function fetchManualReturn(mrId: string): Promise<ManualReturnDetail> {
  const { body } = await request("GET", `/cx/manual-returns/${encodeURIComponent(mrId)}`);

  return body.data as ManualReturnDetail;
}
