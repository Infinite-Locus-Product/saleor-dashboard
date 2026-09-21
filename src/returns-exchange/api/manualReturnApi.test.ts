import {
  type CreateManualReturnPayload,
  type LookupResult,
  type ManualReturnDetail,
  type ManualReturnListItem,
} from "../types";
import {
  createManualReturns,
  fetchManualReturn,
  fetchManualReturns,
  fetchReturnReasons,
  lookupOrderForManualReturn,
} from "./manualReturnApi";
import { isManualReturnApiError } from "./manualReturnApiError";

jest.mock("./tenexuBaseUrl", () => ({
  getTenexuBaseUrl: () => "https://api.test",
}));

interface MockResponseInit {
  status: number;
  body?: unknown;
  rawBody?: string;
}

const mockResponse = ({ status, body, rawBody }: MockResponseInit) => ({
  ok: status >= 200 && status < 300,
  status,
  text: () => Promise.resolve(rawBody ?? (body === undefined ? "" : JSON.stringify(body))),
});

const fetchMock = jest.fn();

const lastRequest = (): { url: URL; init: RequestInit } => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];

  return { url: new URL(url as string), init: init as RequestInit };
};

const payload: CreateManualReturnPayload = {
  order_number: "1001",
  idempotency_key: "7d1f3a52-0b2c-4f7a-9a41-1f0b8a3c2d11",
  reason_id: 3,
  override_note: "Customer called about a stitching defect",
  refund_email: "asha@example.com",
  refund_upi: "asha@okaxis",
  lines: [{ fulfillment_line_id: "RnVsZmlsbG1lbnRMaW5lOjE=", quantity: 1 }],
};

describe("manualReturnApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem("_saleor_auth_token", "token-123");
    localStorage.setItem("_saleorRefreshToken", "refresh-456");
  });

  describe("FE-API01 auth headers", () => {
    it("sends the Bearer token and refresh token on every request", async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        mockResponse({ status: 200, body: { ok: true, data: [{ id: 1, reason: "Size issue" }] } }),
      );

      // Act
      const reasons = await fetchReturnReasons();

      // Assert
      const { url, init } = lastRequest();
      const headers = init.headers as Record<string, string>;

      expect(url.origin + url.pathname).toBe("https://api.test/cx/manual-returns/return-reasons");
      expect(init.method).toBe("GET");
      expect(headers.Authorization).toBe("Bearer token-123");
      expect(headers["X-Refresh-Token"]).toBe("refresh-456");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(reasons).toEqual([{ id: 1, reason: "Size issue" }]);
    });

    it("sends empty token headers when the user has no stored tokens", async () => {
      // Arrange
      localStorage.removeItem("_saleor_auth_token");
      localStorage.removeItem("_saleorRefreshToken");
      fetchMock.mockResolvedValue(mockResponse({ status: 200, body: { ok: true, data: [] } }));

      // Act
      await fetchReturnReasons();

      // Assert
      const headers = lastRequest().init.headers as Record<string, string>;

      expect(headers.Authorization).toBe("Bearer ");
      expect(headers["X-Refresh-Token"]).toBe("");
    });
  });

  describe("FE-API02 list query string", () => {
    it("builds page, limit, search, status and erp_sync_status params", async () => {
      // Arrange
      const rows: ManualReturnListItem[] = [];

      fetchMock.mockResolvedValue(
        mockResponse({
          status: 200,
          body: { ok: true, data: rows, pagination: { total: 0, page: 2, limit: 50 } },
        }),
      );

      // Act
      const result = await fetchManualReturns(2, 50, {
        search: "MR-00 12",
        status: "REFUND_FAILED",
        erpSyncStatus: "FAILED",
      });

      // Assert
      const { url, init } = lastRequest();

      expect(init.method).toBe("GET");
      expect(url.pathname).toBe("/cx/manual-returns");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("limit")).toBe("50");
      expect(url.searchParams.get("search")).toBe("MR-00 12");
      expect(url.searchParams.get("status")).toBe("REFUND_FAILED");
      expect(url.searchParams.get("erp_sync_status")).toBe("FAILED");
      expect(result).toEqual({ data: rows, pagination: { total: 0, page: 2, limit: 50 } });
    });

    it("omits empty filters and defaults to page 1 / limit 20", async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        mockResponse({
          status: 200,
          body: { ok: true, data: [], pagination: { total: 0, page: 1, limit: 20 } },
        }),
      );

      // Act
      await fetchManualReturns(undefined, undefined, { search: "", status: "" });

      // Assert
      const { url } = lastRequest();

      expect(Array.from(url.searchParams.keys()).sort()).toEqual(["limit", "page"]);
      expect(url.searchParams.get("page")).toBe("1");
      expect(url.searchParams.get("limit")).toBe("20");
    });
  });

  describe("endpoints", () => {
    it("posts the trimmed order number to order-lookup and returns data", async () => {
      // Arrange
      const lookup = { orderId: "T3JkZXI6MQ==", orderNumber: "1001" } as LookupResult;

      fetchMock.mockResolvedValue(mockResponse({ status: 200, body: { ok: true, data: lookup } }));

      // Act
      const result = await lookupOrderForManualReturn("  1001 ");

      // Assert
      const { url, init } = lastRequest();

      expect(url.pathname).toBe("/cx/manual-returns/order-lookup");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ order_number: "1001" });
      expect(result).toEqual(lookup);
    });

    it("fetches a single manual return by id", async () => {
      // Arrange
      const detail = { mr_id: "MR-0001" } as ManualReturnDetail;

      fetchMock.mockResolvedValue(mockResponse({ status: 200, body: { ok: true, data: detail } }));

      // Act
      const result = await fetchManualReturn("MR-0001");

      // Assert
      expect(lastRequest().url.pathname).toBe("/cx/manual-returns/MR-0001");
      expect(result).toEqual(detail);
    });

    it("posts the create payload as-is and returns results for 201", async () => {
      // Arrange
      const results = [
        { originalFulfillmentId: "F1", ok: true, mrId: "MR-0001", creationStatus: "COMPLETED" },
      ];

      fetchMock.mockResolvedValue(
        mockResponse({ status: 201, body: { ok: true, data: { results } } }),
      );

      // Act
      const result = await createManualReturns(payload);

      // Assert
      const { url, init } = lastRequest();

      expect(url.pathname).toBe("/cx/manual-returns");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual(payload);
      expect(result).toEqual({ status: 201, ok: true, results });
    });

    it("does not throw on 207 multi-status and returns every shipment result", async () => {
      // Arrange
      const results = [
        { originalFulfillmentId: "F1", ok: true, mrId: "MR-0001", creationStatus: "COMPLETED" },
        { originalFulfillmentId: "F2", ok: false, code: "SALEOR_ERROR", message: "Saleor down" },
      ];

      fetchMock.mockResolvedValue(
        mockResponse({ status: 207, body: { ok: false, data: { results } } }),
      );

      // Act
      const result = await createManualReturns(payload);

      // Assert
      expect(result).toEqual({ status: 207, ok: false, results });
    });
  });

  describe("FE-API03 error handling", () => {
    it("surfaces the backend message, status and code on a non-ok response", async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        mockResponse({
          status: 409,
          body: { ok: false, message: "Item is no longer eligible", code: "NOT_ELIGIBLE" },
        }),
      );

      // Act
      const error = await createManualReturns(payload).catch((err: unknown) => err);

      // Assert
      expect(isManualReturnApiError(error)).toBe(true);
      expect(error).toMatchObject({
        message: "Item is no longer eligible",
        status: 409,
        code: "NOT_ELIGIBLE",
      });
    });

    it("maps a 404 lookup to ORDER_NOT_FOUND", async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        mockResponse({
          status: 404,
          body: { ok: false, message: "Order 9999 not found", code: "ORDER_NOT_FOUND" },
        }),
      );

      // Act
      const error = await lookupOrderForManualReturn("9999").catch((err: unknown) => err);

      // Assert
      expect(error).toMatchObject({ status: 404, code: "ORDER_NOT_FOUND" });
    });

    it("throws a generic error without crashing when a 5xx body is not JSON", async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        mockResponse({ status: 502, rawBody: "<html><body>Bad Gateway</body></html>" }),
      );

      // Act
      const error = await fetchManualReturns(1, 20).catch((err: unknown) => err);

      // Assert
      expect(isManualReturnApiError(error)).toBe(true);
      expect(error).toMatchObject({ message: "Request failed: 502", status: 502, code: null });
    });

    it("throws when a 200 response carries ok:false", async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        mockResponse({
          status: 200,
          body: { ok: false, message: "Something went wrong", code: "SALEOR_ERROR" },
        }),
      );

      // Act
      const error = await fetchManualReturn("MR-0001").catch((err: unknown) => err);

      // Assert
      expect(error).toMatchObject({ message: "Something went wrong", code: "SALEOR_ERROR" });
    });

    it("uses the first failed shipment result when an all-failed create has no top-level message", async () => {
      // Arrange
      fetchMock.mockResolvedValue(
        mockResponse({
          status: 502,
          body: {
            ok: false,
            data: {
              results: [
                {
                  originalFulfillmentId: "F1",
                  ok: false,
                  code: "SALEOR_ERROR",
                  message: "Saleor rejected the return",
                },
              ],
            },
          },
        }),
      );

      // Act
      const error = await createManualReturns(payload).catch((err: unknown) => err);

      // Assert
      expect(error).toMatchObject({
        message: "Saleor rejected the return",
        status: 502,
        code: "SALEOR_ERROR",
      });
    });

    it("propagates network failures so callers can offer a retry", async () => {
      // Arrange
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      // Act
      const error = await createManualReturns(payload).catch((err: unknown) => err);

      // Assert
      expect(error).toBeInstanceOf(TypeError);
      expect(isManualReturnApiError(error)).toBe(false);
    });
  });
});
