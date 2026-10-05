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
