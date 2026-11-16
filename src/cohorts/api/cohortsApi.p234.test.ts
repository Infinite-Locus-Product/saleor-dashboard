// TTXY-4841 — REST client for cohort phases 2–4 (LLD §4.1–§4.6): rule fields,
// rule errors with paths, voucher restriction get/set, campaigns, funnel, CSV.
// Same envelope, auth headers and refreshed-token handling as Phase 1.
jest.mock("./env", () => ({ getTenexuBaseUrl: () => "http://tenexu.test" }));

import { ApiError } from "./apiError";
import type * as CohortsApiModule from "./cohortsApi";
import {
  buildCampaignListQuery,
  createCohort,
  downloadCampaignFunnelCsv,
  fetchCampaignFunnel,
  fetchCampaigns,
  fetchRuleFields,
  fetchVoucherRestriction,
  saveVoucherRestriction,
  updateCohort,
} from "./cohortsApi";

const okResponse = (data: unknown, headers: Record<string, string> = {}) =>
  ({
    ok: true,
    status: 200,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => ({ success: true, data, error: "" }),
  }) as unknown as Response;

const jsonErrorResponse = (status: number, body: unknown) =>
  ({
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as Response;

const lastCall = (fetchMock: jest.Mock) => fetchMock.mock.calls[fetchMock.mock.calls.length - 1];

const ruleTree = {
  logic: "AND" as const,
  conditions: [{ field: "order_count", operator: "greater_than", value: 2 }],
};

describe("cohortsApi phases 2–4", () => {
  beforeEach(() => {
    localStorage.setItem("_saleor_auth_token", "auth-123");
    localStorage.setItem("_saleorRefreshToken", "refresh-456");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("L3 — fetchRuleFields GETs /cohorts/rule-fields and returns the catalog", async () => {
    // Arrange
    const catalog = [{ field: "city", type: "text", operators: ["equals", "includes"] }];
    const fetchMock = jest.fn().mockResolvedValue(okResponse(catalog));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const result = await fetchRuleFields();

    // Assert
    expect(result).toEqual(catalog);

    const [url, init] = lastCall(fetchMock);

    expect(url).toBe("http://tenexu.test/cohorts/rule-fields");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer auth-123");
  });

  it("L1 — createCohort sends `rules` for a dynamic cohort", async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue(okResponse({ id: 1 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await createCohort({ cohort_name: "Repeat buyers", type: "dynamic", rules: ruleTree });

    // Assert
    const [url, init] = lastCall(fetchMock);

    expect(url).toBe("http://tenexu.test/cohorts");
    expect(JSON.parse(init.body)).toEqual({
      cohort_name: "Repeat buyers",
      type: "dynamic",
      rules: ruleTree,
    });
  });

  it("L5 — updateCohort PATCHes `rules`", async () => {
    // Arrange
    const fetchMock = jest.fn().mockResolvedValue(okResponse({ id: 4 }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await updateCohort(4, { rules: ruleTree });

    // Assert
    const [url, init] = lastCall(fetchMock);

    expect(url).toBe("http://tenexu.test/cohorts/4");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ rules: ruleTree });
  });

  it.each([
    [
      "error object",
      {
        success: false,
        error: {
          code: "invalid_rule",
          message: "Rule is invalid",
          details: [{ path: "conditions[0].value", message: "must be a number" }],
        },
      },
    ],
    [
      "top-level code/details",
      {
        success: false,
        error: "Rule is invalid",
        code: "invalid_rule",
        details: [{ path: "conditions[0].value", message: "must be a number" }],
      },
    ],
    [
      "code/details under data",
      {
        success: false,
        error: "Rule is invalid",
        data: {
          code: "invalid_rule",
          details: [{ path: "conditions[0].value", message: "must be a number" }],
        },
      },
    ],
  ])("L4 — a 400 invalid_rule exposes code + details[].path (%s)", async (_label, body) => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(jsonErrorResponse(400, body)) as any;

    // Act
    const error = await createCohort({ cohort_name: "x", type: "dynamic", rules: ruleTree }).catch(
      e => e,
    );

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("invalid_rule");
    expect(error.details).toEqual([{ path: "conditions[0].value", message: "must be a number" }]);
    expect(error.serverMessage).toBe("Rule is invalid");
  });

  it("L4 — a plain string error keeps code/details null (Phase 1 behaviour)", async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonErrorResponse(409, { success: false, error: "duplicate" })) as any;

    // Act
    const error = await createCohort({ cohort_name: "x" }).catch(e => e);

    // Assert
    expect(error.serverMessage).toBe("duplicate");
    expect(error.code).toBeNull();
    expect(error.details).toEqual([]);
  });

  it("L6 — fetchVoucherRestriction GETs /cohorts/voucher-restriction/:voucherId (id encoded)", async () => {
    // Arrange
    const payload = {
      voucherId: "Vm91Y2hlcjox",
      voucherCode: "FLAT100",
      startDate: "2026-11-01T00:00:00+05:30",
      endDate: null,
      cohorts: [],
    };
    const fetchMock = jest.fn().mockResolvedValue(okResponse(payload));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const result = await fetchVoucherRestriction("Vm91Y2hlcjox/=");

    // Assert
    expect(result).toEqual(payload);
    expect(lastCall(fetchMock)[0]).toBe(
      "http://tenexu.test/cohorts/voucher-restriction/Vm91Y2hlcjox%2F%3D",
    );
  });

  it("L8 — saveVoucherRestriction POSTs the full cohort list (empty list clears it)", async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValue(okResponse({ voucherId: "V1", restricted: false }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const result = await saveVoucherRestriction({ voucherId: "V1", cohorts: [] });

    // Assert
    expect(result).toEqual({ voucherId: "V1", restricted: false });

    const [url, init] = lastCall(fetchMock);

    expect(url).toBe("http://tenexu.test/cohorts/voucher-restriction");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ voucherId: "V1", cohorts: [] });
  });

  it("L9 — buildCampaignListQuery serialises page, pageSize and status", () => {
    // Arrange / Act / Assert
    expect(buildCampaignListQuery({})).toBe("");
    expect(buildCampaignListQuery({ page: 2, pageSize: 20, status: "open" })).toBe(
      "?page=2&pageSize=20&status=open",
    );
  });

  it("L9 — fetchCampaigns and fetchCampaignFunnel hit the campaign routes", async () => {
    // Arrange
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(okResponse({ items: [], page: 1, pageSize: 20, total: 0 }))
      .mockResolvedValueOnce(okResponse({ campaign: { id: 3 } }));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await fetchCampaigns({ page: 1, pageSize: 20 });
    await fetchCampaignFunnel(3);

    // Assert
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://tenexu.test/cohorts/campaigns?page=1&pageSize=20",
    );
    expect(fetchMock.mock.calls[1][0]).toBe("http://tenexu.test/cohorts/campaigns/3/funnel");
  });

  it("L9 — downloadCampaignFunnelCsv sends the same auth headers and returns the CSV blob", async () => {
    // Arrange
    const blob = new Blob(["group,stage,count,conversion_from_previous\n"], { type: "text/csv" });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (k: string) =>
          ({ "Content-Disposition": 'attachment; filename="campaign-3-funnel.csv"' })[k] ?? null,
      },
      blob: async () => blob,
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    const result = await downloadCampaignFunnelCsv(3);

    // Assert
    const [url, init] = lastCall(fetchMock);

    expect(url).toBe("http://tenexu.test/cohorts/campaigns/3/funnel.csv");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer auth-123");
    expect(init.headers["X-Refresh-Token"]).toBe("refresh-456");
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe("campaign-3-funnel.csv");
  });

  it("L9 — downloadCampaignFunnelCsv falls back to a default filename and rejects on 404", async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        blob: async () => new Blob(["x"]),
      })
      .mockResolvedValueOnce(jsonErrorResponse(404, { success: false, error: "Not found" })) as any;

    // Act
    const ok = await downloadCampaignFunnelCsv(9);
    const failure = await downloadCampaignFunnelCsv(10).catch(e => e);

    // Assert
    expect(ok.filename).toBe("campaign-9-funnel.csv");
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(404);
  });
});

describe("cohortsApi CSV download refreshed-token handling (C15)", () => {
  type Api = typeof CohortsApiModule;

  const loadApi = (): Api => {
    let api!: Api;

    jest.isolateModules(() => {
      api = jest.requireActual<Api>("./cohortsApi");
    });

    return api;
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("_saleorRefreshToken", "refresh-456");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("L9 — a refreshed token echoed by the CSV route is reused by the next JSON call", async () => {
    // Arrange
    const api = loadApi();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (k: string) => (k === "X-Refreshed-Auth-Token" ? "fresh-777" : null),
        },
        blob: async () => new Blob(["x"]),
      })
      .mockResolvedValueOnce(okResponse([]));

    global.fetch = fetchMock as unknown as typeof fetch;

    // Act
    await api.downloadCampaignFunnelCsv(1);
    await api.fetchRuleFields();

    // Assert
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh-777");
  });
});
