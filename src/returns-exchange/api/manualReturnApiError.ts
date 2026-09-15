export interface ManualReturnApiError extends Error {
  /** HTTP status of the failed response. */
  status: number;
  /** Backend error code (`NOT_ELIGIBLE`, `ORDER_NOT_FOUND`, …) when provided. */
  code: string | null;
}

interface CreateManualReturnApiErrorInput {
  message: string;
  status: number;
  code?: string | null;
}

export function createManualReturnApiError({
  message,
  status,
  code = null,
}: CreateManualReturnApiErrorInput): ManualReturnApiError {
  return Object.assign(new Error(message), { name: "ManualReturnApiError", status, code });
}

export function isManualReturnApiError(error: unknown): error is ManualReturnApiError {
  return error instanceof Error && "status" in error && typeof error.status === "number";
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return fallback;
}
