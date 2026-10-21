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
  type Cohort,
  type CohortCreateInput,
  type CohortIngestSummary,
  type CohortLinkedCoupon,
  type CohortListParams,
  type CohortListResponse,
  type CohortSyncResult,
  type CohortUpdateInput,
} from "../types";
import { ApiError, NETWORK_ERROR_STATUS } from "./apiError";
import { getTenexuBaseUrl } from "./env";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("_saleor_auth_token") || "";
  const refreshToken = localStorage.getItem("_saleorRefreshToken") || "";

  return {
    Authorization: `Bearer ${token}`,
    "X-Refresh-Token": refreshToken,
  };
}

/**
 * The backend refreshes an expired session in-flight and echoes the new token
 * back; persist it so the next call doesn't have to refresh again.
 */
function absorbRefreshedToken(res: Response): void {
  const refreshed = res.headers.get("X-Refreshed-Auth-Token");

  if (refreshed) {
    localStorage.setItem("_saleor_auth_token", refreshed);
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  absorbRefreshedToken(res);

  let json: any = null;

  try {
    json = await res.json();
  } catch {
    // fall through to the status-based error below
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError({
      status: res.status,
      serverMessage: typeof json?.error === "string" && json.error ? json.error : null,
    });
  }

  return json?.data as T;
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
  const res = await send(path, {
    method,
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return unwrap<T>(res);
}

/** Multipart upload — Content-Type is intentionally omitted so the browser sets the boundary. */
async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();

  form.append("file", file);

  const res = await send(path, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });

  return unwrap<T>(res);
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
