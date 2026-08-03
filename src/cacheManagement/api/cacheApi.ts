/**
 * Thin REST client for the TenxYou cache management endpoints.
 *
 * These routes live on the TenxYou backend, not the Saleor GraphQL API, so they
 * deliberately bypass Apollo. Auth mirrors src/orders/api/bulkOrderApi.ts: the
 * signed-in staff user's Saleor token, swapped for a shared admin key on the
 * routes the Postman collection marks [Admin].
 */
import {
  type CacheExecutionResult,
  type CacheRequestDescriptor,
} from "@dashboard/cacheManagement/types";

const ADMIN_API_KEY = import.meta.env.VITE_TENEXU_ADMIN_API_KEY;

export const getCacheApiBaseUrl = (): string | undefined => import.meta.env.VITE_TENEXU_API_URL;

export class MissingCacheApiConfigError extends Error {
  constructor() {
    super("VITE_TENEXU_API_URL is not set. Cache operations cannot reach the backend.");
    this.name = "MissingCacheApiConfigError";
  }
}

const getAuthHeaders = (requiresAdmin: boolean): Record<string, string> => {
  const token = localStorage.getItem("_saleor_auth_token") || "";
  const refreshToken = localStorage.getItem("_saleorRefreshToken") || "";
  // Admin routes accept a shared key when one is configured; otherwise the
  // staff token is sent and the backend enforces the permission itself.
  const bearer = requiresAdmin && ADMIN_API_KEY ? ADMIN_API_KEY : token;

  return {
    Authorization: `Bearer ${bearer}`,
    "X-Refresh-Token": refreshToken,
  };
};

/** Best-effort JSON parse; falls back to the raw text so nothing is lost. */
const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const extractErrorMessage = (payload: unknown, httpStatus: number): string => {
  if (payload && typeof payload === "object") {
    const record: Record<string, unknown> = payload as Record<string, unknown>;
    const candidate = record.error ?? record.message ?? record.detail;

    if (typeof candidate === "string" && candidate) return candidate;
  }

  return `Request failed with status ${httpStatus}`;
};

/**
 * Executes one cache request and always resolves — transport failures are
 * reported as an error result rather than a rejection, so the caller has a
 * single code path for timing and history.
 */
export const executeCacheRequest = async ({
  request,
  requiresAdmin = false,
  signal,
}: {
  request: CacheRequestDescriptor;
  requiresAdmin?: boolean;
  signal?: AbortSignal;
}): Promise<CacheExecutionResult> => {
  const startedAt = performance.now();
  const headers: Record<string, string> = getAuthHeaders(requiresAdmin);

  if (request.body) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal,
    });
    const payload = await readResponseBody(response);
    const durationMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      return {
        status: "error",
        httpStatus: response.status,
        response: payload,
        durationMs,
        errorMessage: extractErrorMessage(payload, response.status),
      };
    }

    return {
      status: "success",
      httpStatus: response.status,
      response: payload,
      durationMs,
    };
  } catch (error) {
    return {
      status: "error",
      httpStatus: 0,
      response: null,
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage: error instanceof Error ? error.message : "Network request failed",
    };
  }
};
