/**
 * Typed failure from the TenexuBackend cohort API (TTXY-4699 PR #5 C3).
 *
 * `status` is the HTTP status, or 0 when the request never got a response
 * (offline, DNS, CORS — fetch rejects with a TypeError). `serverMessage` is the
 * backend's own `error` text; the UI maps known statuses to translated copy and
 * only ever shows this as secondary detail.
 *
 * Lives outside cohortsApi.ts so tests can mock the client and still build
 * real ApiError instances.
 */
export const NETWORK_ERROR_STATUS = 0;

/** A structured error detail, e.g. one invalid_rule entry with its rule-tree path (TTXY-4841). */
export interface ApiErrorDetail {
  path: string;
  message: string;
}

interface ApiErrorInit {
  status: number;
  serverMessage: string | null;
  /** Machine-readable code (e.g. "invalid_rule", "dynamic_disabled"); null when the server sent none. */
  code?: string | null;
  details?: ApiErrorDetail[];
}

export class ApiError extends Error {
  readonly status: number;

  readonly serverMessage: string | null;

  readonly code: string | null;

  readonly details: ApiErrorDetail[];

  constructor({ status, serverMessage, code = null, details = [] }: ApiErrorInit) {
    super(
      serverMessage ||
        (status === NETWORK_ERROR_STATUS ? "Network request failed" : `Request failed: ${status}`),
    );
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
    this.code = code;
    this.details = details;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
