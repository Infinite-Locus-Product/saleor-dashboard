/**
 * Error thrown by the TenexuBackend CX returns API client. `message` is the backend's
 * message (or "Request failed: <status>"), so callers that only read `message` are unaffected;
 * `status` / `code` let views branch on e.g. 409 ALREADY_CLOSED.
 */
export class CXApiError extends Error {
  readonly status: number;

  /** Backend error code (`ALREADY_CLOSED`, `NOT_FOUND`, `INVALID_REASON`, …) when provided. */
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "CXApiError";
    this.status = status;
    this.code = code;
    // Keep `instanceof` working when the class is transpiled to ES5.
    Object.setPrototypeOf(this, CXApiError.prototype);
  }
}

export const isCXApiError = (error: unknown): error is CXApiError => error instanceof CXApiError;

// 409 codes from the CX returns API (TenexuBackend PR #634) that mean the request can no longer
// be acted on: it was closed, or its line was rejected.
const STALE_CONFLICT_CODES: ReadonlySet<string> = new Set(["ALREADY_CLOSED", "LINE_REJECTED"]);

/**
 * The request was closed (approved / rejected / exchanged), its line was rejected, or it was
 * removed since the page loaded, so retrying can never succeed (LLD §7). A 409 without a code is
 * treated as stale to stay safe.
 */
export const isStaleRequestError = (error: unknown): boolean => {
  if (!isCXApiError(error)) return false;

  if (error.status === 404) return true;

  return error.status === 409 && (error.code === null || STALE_CONFLICT_CODES.has(error.code));
};

/** Another agent holds the approval claim; the request is still open and can be retried later. */
export const isApprovalInProgressError = (error: unknown): boolean =>
  isCXApiError(error) && error.status === 409 && error.code === "APPROVAL_IN_PROGRESS";
