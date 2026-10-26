// Tests for the cohort REST client (TTXY-4705). The auth + error-unwrapping
// behaviour here is security-relevant, so it is pinned rather than assumed.
// ./env is mocked so Jest never parses `import.meta`, which its CJS transform
// cannot handle.
jest.mock("./env", () => ({ getTenexuBaseUrl: () => "http://tenexu.test" }));

import { ApiError } from "./apiError";
import type * as CohortsApiModule from "./cohortsApi";
import {
  buildCohortListQuery,
  createCohort,
  deleteCohort,
  fetchCohortCoupons,
  fetchCohorts,
  syncCohort,
  uploadCohortCsv,
} from "./cohortsApi";

const okResponse = (data: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: true,
    status: 200,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => ({ success: true, data, error: "" }),
  }) as unknown as Response;

const errorResponse = (status: number, error: string) =>
  ({
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => ({ success: false, error }),
  }) as unknown as Response;

describe("buildCohortListQuery", () => {
  it("returns an empty string when no params are given", () => {
    // Arrange / Act / Assert
    expect(buildCohortListQuery()).toBe("");
  });

  it("serialises paging, filters and search", () => {
    // Arrange — no setup needed, the params are inline
    // Act
    const qs = buildCohortListQuery({
      limit: 20,
      offset: 40,
      type: "static",
      status: true,
      q: "vip",
    });

    // Assert
    expect(qs).toContain("limit=20");
    expect(qs).toContain("offset=40");
    expect(qs).toContain("type=static");
    expect(qs).toContain("status=true");
    expect(qs).toContain("q=vip");
  });

  it("keeps status=false rather than dropping it as falsy", () => {
    // Regression: `if (params.status)` would silently lose the "inactive" filter.
    // Arrange / Act / Assert
    expect(buildCohortListQuery({ status: false })).toContain("status=false");
  });
});

describe("cohortsApi requests", () => {
  beforeEach(() => {
    localStorage.setItem("_saleor_auth_token", "auth-123");
    localStorage.setItem("_saleorRefreshToken", "refresh-456");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("forwards the Saleor session on every call and unwraps `data`", async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue(okResponse({ items: [], total: 0 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const result = await fetchCohorts({ limit: 5 });

    // Assert
    expect(result).toEqual({ items: [], total: 0 });

    const [, init] = fetchMock.mock.calls[0];

    expect(init.headers.Authorization).toBe("Bearer auth-123");
    expect(init.headers["X-Refresh-Token"]).toBe("refresh-456");
  });

  it("surfaces the backend error message instead of a generic failure", async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(errorResponse(409, 'A cohort named "VIP" already exists')) as any;

    // Act / Assert
    await expect(createCohort({ cohort_name: "VIP" })).rejects.toThrow(
      'A cohort named "VIP" already exists',
    );
  });

  it("treats success:false as an error even on a 200 response", async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ success: false, error: "nope" }),
    }) as any;

    // Act / Assert
    await expect(fetchCohorts()).rejects.toThrow("nope");
  });

  it("uploads CSV as multipart WITHOUT a Content-Type header", async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValue(okResponse({ total: 1, valid: 1, invalid: 0, sample: [] }));

    global.fetch = fetchMock as unknown as typeof fetch;

    const file = new File(["phone\n9990000001\n"], "cohort.csv", { type: "text/csv" });

    // Act
    await uploadCohortCsv(7, file);

    // Assert — setting Content-Type manually would strip the multipart boundary
    // and the backend's multer parser would reject the upload.
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toContain("/cohorts/7/csv");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.headers.Authorization).toBe("Bearer auth-123");
  });

  it("U4 — syncCohort POSTs /cohorts/:id/sync and returns the run result", async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValue(okResponse({ cohortId: 7, added: 2, skipped: 0, notFound: 0, errors: 0 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const result = await syncCohort(7);

    // Assert
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("http://tenexu.test/cohorts/7/sync");
    expect(init.method).toBe("POST");
    expect(result.added).toBe(2);
  });

  it("U9 — fetchCohortCoupons GETs /cohorts/:id/coupons and returns the list", async () => {
    // Arrange
    const coupons = [{ voucherId: "V1", voucherCode: "FLAT100", startTime: null, endTime: null }];
    const fetchMock = jest.fn().mockResolvedValue(okResponse({ coupons }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const result = await fetchCohortCoupons(7);

    // Assert
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("http://tenexu.test/cohorts/7/coupons");
    expect(init.method).toBe("GET");
    expect(result).toEqual(coupons);
  });

  it("C3 — a non-2xx response rejects with an ApiError carrying status and server text", async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(errorResponse(409, "Cohort is used by 1 coupon(s): FLAT100")) as any;

    // Act
    const error = await deleteCohort(7).catch((err: unknown) => err);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).serverMessage).toBe("Cohort is used by 1 coupon(s): FLAT100");
  });

  it("C3 — a response without a JSON body still rejects with its status", async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: () => null },
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }) as any;

    // Act
    const error = await syncCohort(7).catch((err: unknown) => err);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).serverMessage).toBeNull();
  });

  it("C3 — a network failure (fetch TypeError) becomes ApiError status 0", async () => {
    // Arrange
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as any;

    // Act
    const error = await syncCohort(7).catch((err: unknown) => err);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });

  it("C3 — a failed multipart upload also maps network failures to status 0", async () => {
    // Arrange
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as any;

    const file = new File(["phone\n"], "cohort.csv", { type: "text/csv" });

    // Act
    const error = await uploadCohortCsv(7, file).catch((err: unknown) => err);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});

// PR #5 C15 — the backend's refreshed access token is kept in module memory,
// paired with the refresh token it was issued for, and NEVER written to
// localStorage (Saleor logout does not clear `_saleor_auth_token`, so a stored
// token would outlive the session and leak to the next staff user).
describe("cohortsApi refreshed-token handling (C15)", () => {
  type Api = typeof CohortsApiModule;

  /** A fresh copy of the client, so in-memory token state never leaks between tests. */
  const loadApi = (): Api => {
    let api!: Api;

    jest.isolateModules(() => {
      api = jest.requireActual<Api>("./cohortsApi");
    });

    return api;
  };

  const authHeaderOfCall = (fetchMock: jest.Mock, call: number): string =>
    fetchMock.mock.calls[call][1].headers.Authorization;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("_saleorRefreshToken", "refresh-456");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("keeps the refreshed token in memory and reuses it on the next call", async () => {
    // Arrange
    const api = loadApi();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okResponse({ items: [] }, { "X-Refreshed-Auth-Token": "fresh-999" }))
      .mockResolvedValueOnce(okResponse({ items: [] }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await api.fetchCohorts();
    await api.fetchCohorts();

    // Assert — the second call does not need another refresh
    expect(authHeaderOfCall(fetchMock, 0)).toBe("Bearer ");
    expect(authHeaderOfCall(fetchMock, 1)).toBe("Bearer fresh-999");
  });

  it("never writes the refreshed token to localStorage", async () => {
    // Arrange
    const api = loadApi();

    // jest-localstorage-mock: setItem is a jest.fn that keeps calls across tests
    (localStorage.setItem as jest.Mock).mockClear();
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        okResponse({ items: [] }, { "X-Refreshed-Auth-Token": "fresh-999" }),
      ) as any;

    // Act
    await api.fetchCohorts();

    // Assert
    expect(localStorage.getItem("_saleor_auth_token")).toBeNull();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("discards the in-memory token once the refresh token changes (another user)", async () => {
    // Arrange
    const api = loadApi();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okResponse({ items: [] }, { "X-Refreshed-Auth-Token": "fresh-999" }))
      .mockResolvedValue(okResponse({ items: [] }));

    global.fetch = fetchMock as unknown as typeof fetch;
    await api.fetchCohorts();

    // Act — a different staff user signs in on the same machine
    localStorage.setItem("_saleorRefreshToken", "refresh-OTHER");
    await api.fetchCohorts();
    // ...and even if the first user's refresh token came back, the token stays gone
    localStorage.setItem("_saleorRefreshToken", "refresh-456");
    await api.fetchCohorts();

    // Assert
    expect(authHeaderOfCall(fetchMock, 1)).toBe("Bearer ");
    expect(fetchMock.mock.calls[1][1].headers["X-Refresh-Token"]).toBe("refresh-OTHER");
    expect(authHeaderOfCall(fetchMock, 2)).toBe("Bearer ");
  });

  it("discards the in-memory token after logout (no refresh token)", async () => {
    // Arrange
    const api = loadApi();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okResponse({ items: [] }, { "X-Refreshed-Auth-Token": "fresh-999" }))
      .mockResolvedValue(okResponse({ items: [] }));

    global.fetch = fetchMock as unknown as typeof fetch;
    await api.fetchCohorts();

    // Act
    localStorage.removeItem("_saleorRefreshToken");
    await api.fetchCohorts();

    // Assert
    expect(authHeaderOfCall(fetchMock, 1)).toBe("Bearer ");
  });

  it("pairs the token with the refresh token the request was SENT with", async () => {
    // Arrange — the user changes while the request that triggered the refresh is in flight
    const api = loadApi();
    let resolveFirst!: (res: Response) => void;
    const fetchMock = jest
      .fn()
      .mockReturnValueOnce(new Promise<Response>(res => (resolveFirst = res)))
      .mockResolvedValue(okResponse({ items: [] }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const first = api.fetchCohorts();

    localStorage.setItem("_saleorRefreshToken", "refresh-OTHER");
    resolveFirst(okResponse({ items: [] }, { "X-Refreshed-Auth-Token": "fresh-999" }));
    await first;
    await api.fetchCohorts();

    // Assert — the first user's token is never sent with the second user's session
    expect(authHeaderOfCall(fetchMock, 1)).toBe("Bearer ");
  });

  it("without a refreshed token, still sends the stored token as before", async () => {
    // Arrange
    const api = loadApi();
    const fetchMock = jest.fn().mockResolvedValue(okResponse({ items: [] }));

    localStorage.setItem("_saleor_auth_token", "auth-123");
    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await api.fetchCohorts();

    // Assert
    expect(authHeaderOfCall(fetchMock, 0)).toBe("Bearer auth-123");
    expect(fetchMock.mock.calls[0][1].headers["X-Refresh-Token"]).toBe("refresh-456");
  });

  it("uses the refreshed token for CSV uploads too", async () => {
    // Arrange
    const api = loadApi();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okResponse({ items: [] }, { "X-Refreshed-Auth-Token": "fresh-999" }))
      .mockResolvedValueOnce(okResponse({ total: 1, valid: 1, invalid: 0, sample: [] }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await api.fetchCohorts();
    await api.uploadCohortCsv(7, new File(["phone\n"], "c.csv", { type: "text/csv" }));

    // Assert
    expect(authHeaderOfCall(fetchMock, 1)).toBe("Bearer fresh-999");
  });
});
