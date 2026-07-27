// Tests for the cohort REST client (TTXY-4705). The auth + error-unwrapping
// behaviour here is security-relevant, so it is pinned rather than assumed.
// ./env is mocked so Jest never parses `import.meta`, which its CJS transform
// cannot handle.
jest.mock("./env", () => ({ getTenexuBaseUrl: () => "http://tenexu.test" }));

import { buildCohortListQuery, createCohort, fetchCohorts, uploadCohortCsv } from "./cohortsApi";

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

  it("persists a refreshed auth token echoed back by the backend", async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        okResponse({ items: [] }, { "X-Refreshed-Auth-Token": "fresh-999" }),
      ) as any;

    // Act
    await fetchCohorts();

    // Assert — otherwise every later call would re-trigger a refresh.
    expect(localStorage.getItem("_saleor_auth_token")).toBe("fresh-999");
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
});
