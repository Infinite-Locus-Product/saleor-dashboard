/**
 * TenexuBackend cohort admin API client (TTXY-4703 / TTXY-4705).
 *
 * Auth: we forward the signed-in staff user's Saleor session (the same pattern
 * as src/returns-exchange/api/returnsApi.ts). Deliberately NOT a shared admin
 * API key — any VITE_* value is inlined into the public bundle at build time and
 * would be readable by anyone in devtools.
 *
 * The backend responds with { success, data, error }; helpers below unwrap
 * `data` and surface `error` as a thrown Error.
 */
import {
  type Cohort,
  type CohortCreateInput,
  type CohortIngestSummary,
  type CohortListParams,
  type CohortListResponse,
  type CohortUpdateInput,
} from "../types";
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
    throw new Error(json?.error || `Request failed: ${res.status}`);
  }

  return json?.data as T;
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${getTenexuBaseUrl()}${path}`, {
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

  const res = await fetch(`${getTenexuBaseUrl()}${path}`, {
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
