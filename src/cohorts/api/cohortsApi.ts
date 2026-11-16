/**
 * TenexuBackend cohort admin API client (TTXY-4703 / TTXY-4705).
 *
 * Auth: we forward the signed-in staff user's Saleor session (the same pattern
 * as src/returns-exchange/api/returnsApi.ts). Deliberately NOT a shared admin
 * API key — any VITE_* value is inlined into the public bundle at build time and
 * would be readable by anyone in devtools.
 *
 * The backend responds with { success, data, error }; helpers below unwrap
 * `data` and surface failures as a thrown ApiError (status + server text).
 * A request that never got a response becomes ApiError status 0.
 */
import {
  type CampaignFunnel,
  type CampaignListParams,
  type CampaignListResponse,
  type Cohort,
  type CohortCreateInput,
  type CohortIngestSummary,
  type CohortLinkedCoupon,
  type CohortListParams,
  type CohortListResponse,
  type CohortSyncResult,
  type CohortUpdateInput,
  type RuleFieldDefinition,
  type VoucherCohortRestriction,
  type VoucherCohortRestrictionInput,
  type VoucherCohortRestrictionResult,
} from "../types";
import { ApiError, type ApiErrorDetail, NETWORK_ERROR_STATUS } from "./apiError";
import { getTenexuBaseUrl } from "./env";

const AUTH_TOKEN_KEY = "_saleor_auth_token";
const REFRESH_TOKEN_KEY = "_saleorRefreshToken";

/**
 * PR #5 C15 — the access token the backend refreshed in-flight, held ONLY in
 * module memory and paired with the refresh token it was issued for.
 *
 * Never written to localStorage: Saleor logout does not clear
 * `_saleor_auth_token`, and the other TenexuBackend clients (returnsApi,
 * manualExchangeApi, bulkOrderApi) read it, so a stored token would outlive the
 * session and be sent on behalf of the next staff user on the machine.
 *
 * Why not the dashboard's live token: @saleor/sdk 0.6.0 keeps the access token
 * in a module-private store with no public getter (only `createFetch`, which
 * targets the GraphQL API), so it cannot be read cheaply or supportedly here.
 */
let refreshedSession: { accessToken: string; refreshToken: string } | null = null;

interface SessionHeaders {
  headers: Record<string, string>;
  /** The refresh token these headers carry; a refreshed token is paired with it. */
  refreshToken: string;
}

/** The refreshed token, only while the same Saleor session (refresh token) is signed in. */
function currentRefreshedToken(refreshToken: string): string | null {
  if (refreshedSession && refreshToken && refreshedSession.refreshToken === refreshToken) {
    return refreshedSession.accessToken;
  }

  // A different user, or logged out: the token belongs to someone else — drop it for good.
  refreshedSession = null;

  return null;
}

function getAuthHeaders(): SessionHeaders {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || "";
  const token = currentRefreshedToken(refreshToken) ?? (localStorage.getItem(AUTH_TOKEN_KEY) || "");

  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Refresh-Token": refreshToken,
    },
    refreshToken,
  };
}

/**
 * The backend refreshes an expired session in-flight and echoes the new token
 * back; remember it (in memory only) for the session the request was sent with,
 * so the next call doesn't have to refresh again.
 */
function absorbRefreshedToken(res: Response, sentRefreshToken: string): void {
  const refreshed = res.headers.get("X-Refreshed-Auth-Token");

  if (refreshed && sentRefreshToken) {
    refreshedSession = { accessToken: refreshed, refreshToken: sentRefreshToken };
  }
}

async function unwrap<T>(res: Response, sentRefreshToken: string): Promise<T> {
  absorbRefreshedToken(res, sentRefreshToken);

  let json: any = null;

  try {
    json = await res.json();
  } catch {
    // fall through to the status-based error below
  }

  if (!res.ok || json?.success === false) {
    throw toApiError(res.status, json);
  }

  return json?.data as T;
}

const isDetail = (d: any): d is ApiErrorDetail =>
  !!d && typeof d === "object" && typeof d.path === "string";

const nonEmptyString = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * TTXY-4841 — LLD §4.1 gives rule errors as `{code: "invalid_rule", details: [{path, message}]}`
 * without fixing where they sit in the `{success, data, error}` envelope, so the
 * code/details are read from `error` (object form), the top level, or `data`.
 */
function toApiError(status: number, json: any): ApiError {
  const errorField = json?.error;
  const errorObject = errorField && typeof errorField === "object" ? errorField : null;
  const sources = [errorObject, json, json?.data].filter(
    (source): source is Record<string, any> => !!source && typeof source === "object",
  );
  const code = sources.map(source => nonEmptyString(source.code)).find(Boolean) ?? null;
  const rawDetails = sources.map(source => source.details).find(Array.isArray) ?? [];

  return new ApiError({
    status,
    serverMessage: nonEmptyString(errorField) ?? nonEmptyString(errorObject?.message),
    code,
    details: (rawDetails as unknown[]).filter(isDetail).map(d => ({
      path: d.path,
      message: typeof d.message === "string" ? d.message : "",
    })),
  });
}

/** fetch, with "no response at all" (fetch's TypeError) reported as ApiError status 0. */
async function send(path: string, init: RequestInit): Promise<Response> {
  const url = `${getTenexuBaseUrl()}${path}`;

  try {
    return await fetch(url, init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new ApiError({ status: NETWORK_ERROR_STATUS, serverMessage: null });
    }

    throw err;
  }
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = getAuthHeaders();
  const res = await send(path, {
    method,
    headers: { "Content-Type": "application/json", ...auth.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return unwrap<T>(res, auth.refreshToken);
}

/** Multipart upload — Content-Type is intentionally omitted so the browser sets the boundary. */
async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();

  form.append("file", file);

  const auth = getAuthHeaders();
  const res = await send(path, {
    method: "POST",
    headers: auth.headers,
    body: form,
  });

  return unwrap<T>(res, auth.refreshToken);
}

export function buildCohortListQuery(params: CohortListParams = {}): string {
  const qs = new URLSearchParams();

  if (params.limit !== undefined) qs.set("limit", String(params.limit));

  if (params.offset !== undefined) qs.set("offset", String(params.offset));

  if (params.type) qs.set("type", params.type);

  if (params.status !== undefined) qs.set("status", String(params.status));

  if (params.q) qs.set("q", params.q);

  const query = qs.toString();

  return query ? `?${query}` : "";
}

export const fetchCohorts = (params: CohortListParams = {}): Promise<CohortListResponse> =>
  apiRequest<CohortListResponse>("GET", `/cohorts${buildCohortListQuery(params)}`);

export const fetchCohort = (id: string | number): Promise<Cohort> =>
  apiRequest<Cohort>("GET", `/cohorts/${id}`);

export const createCohort = (input: CohortCreateInput): Promise<Cohort> =>
  apiRequest<Cohort>("POST", "/cohorts", input);

export const updateCohort = (id: string | number, input: CohortUpdateInput): Promise<Cohort> =>
  apiRequest<Cohort>("PATCH", `/cohorts/${id}`, input);

export const deleteCohort = (id: string | number): Promise<{ deleted: boolean; id: number }> =>
  apiRequest<{ deleted: boolean; id: number }>("DELETE", `/cohorts/${id}`);

export const uploadCohortCsv = (id: string | number, file: File): Promise<CohortIngestSummary> =>
  apiUpload<CohortIngestSummary>(`/cohorts/${id}/csv`, file);

/** TTXY-6196 — run the tagging pass now (409 for an inactive or expired cohort). */
export const syncCohort = (id: string | number): Promise<CohortSyncResult> =>
  apiRequest<CohortSyncResult>("POST", `/cohorts/${id}/sync`);

/** TTXY-6199 — coupons whose restriction references this cohort. */
export const fetchCohortCoupons = async (id: string | number): Promise<CohortLinkedCoupon[]> => {
  const data = await apiRequest<{ coupons: CohortLinkedCoupon[] }>("GET", `/cohorts/${id}/coupons`);

  return data?.coupons ?? [];
};

// --- Phases 2–4 (TTXY-4841, LLD §4.2–§4.6) -----------------------------------

/** Field catalog for the rule builder; the dashboard has no hard-coded fields. */
export const fetchRuleFields = (): Promise<RuleFieldDefinition[]> =>
  apiRequest<RuleFieldDefinition[]>("GET", "/cohorts/rule-fields");

export const fetchVoucherRestriction = (voucherId: string): Promise<VoucherCohortRestriction> =>
  apiRequest<VoucherCohortRestriction>(
    "GET",
    `/cohorts/voucher-restriction/${encodeURIComponent(voucherId)}`,
  );

/** Replaces the voucher's whole cohort list; a cohort left out is removed (L8). */
export const saveVoucherRestriction = (
  input: VoucherCohortRestrictionInput,
): Promise<VoucherCohortRestrictionResult> =>
  apiRequest<VoucherCohortRestrictionResult>("POST", "/cohorts/voucher-restriction", input);

export function buildCampaignListQuery(params: CampaignListParams = {}): string {
  const qs = new URLSearchParams();

  if (params.page !== undefined) qs.set("page", String(params.page));

  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize));

  if (params.status) qs.set("status", params.status);

  const query = qs.toString();

  return query ? `?${query}` : "";
}

export const fetchCampaigns = (params: CampaignListParams = {}): Promise<CampaignListResponse> =>
  apiRequest<CampaignListResponse>("GET", `/cohorts/campaigns${buildCampaignListQuery(params)}`);

export const fetchCampaignFunnel = (id: string | number): Promise<CampaignFunnel> =>
  apiRequest<CampaignFunnel>("GET", `/cohorts/campaigns/${id}/funnel`);

export interface CsvDownload {
  blob: Blob;
  filename: string;
}

const filenameFromDisposition = (header: string | null): string | null => {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);

  return match ? decodeURIComponent(match[1].trim()) : null;
};

/**
 * GET /cohorts/campaigns/:id/funnel.csv with the same session headers as every
 * other call (a plain <a href> could not send them). Errors use the JSON envelope.
 */
export async function downloadCampaignFunnelCsv(id: string | number): Promise<CsvDownload> {
  const auth = getAuthHeaders();
  const res = await send(`/cohorts/campaigns/${id}/funnel.csv`, {
    method: "GET",
    headers: { Accept: "text/csv", ...auth.headers },
  });

  if (!res.ok) {
    // Throws the enveloped error (status + server text).
    await unwrap<never>(res, auth.refreshToken);
  }

  absorbRefreshedToken(res, auth.refreshToken);

  return {
    blob: await res.blob(),
    filename:
      filenameFromDisposition(res.headers.get("Content-Disposition")) ??
      `campaign-${id}-funnel.csv`,
  };
}
