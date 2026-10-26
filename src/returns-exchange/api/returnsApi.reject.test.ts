/**
 * TTXY-6032 J3/J4. returnsApi must resolve its base URL through the jest-safe
 * getTenexuBaseUrl() (./tenexuBaseUrl) instead of reading import.meta.env at module top,
 * otherwise this file cannot be imported under @swc/jest.
 */
import { CXApiError } from "./cxApiError";
import { fetchReturns, submitRejectReturn } from "./returnsApi";

jest.mock("./tenexuBaseUrl", () => ({
  getTenexuBaseUrl: () => "https://api.test",
}));

const fetchMock = jest.fn();

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
});

const lastCall = (): { url: URL; init: RequestInit } => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];

  return { url: new URL(url as string), init: init as RequestInit };
};

describe("returnsApi — reject + pincode (TTXY-6032)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    localStorage.setItem("_saleor_auth_token", "tok-123");
    localStorage.setItem("_saleorRefreshToken", "ref-456");
  });

  it("J3 submitRejectReturn POSTs /cx/returns/:id/reject with { reason } and auth headers", async () => {
    // Arrange
    const updated = { request_id: "REQ-6120", cx_status: "RETURN_REJECTED" };

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true, data: updated }));

    // Act
    await submitRejectReturn("REQ-6120", "Customer used the product; tags removed");

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { url, init } = lastCall();

    expect(url.origin).toBe("https://api.test");
    expect(url.pathname).toBe("/cx/returns/REQ-6120/reject");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      reason: "Customer used the product; tags removed",
    });

    const headers = init.headers as Record<string, string>;

    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers["X-Refresh-Token"]).toBe("ref-456");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("J3 submitRejectReturn does not send agent fields in the body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true, data: {} }));

    await submitRejectReturn("REQ-1", "A valid reason here");

    const body = JSON.parse(lastCall().init.body as string);

    expect(Object.keys(body)).toEqual(["reason"]);
  });

  it("J3 submitRejectReturn surfaces the API error message (409 ALREADY_CLOSED)", async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        ok: false,
        code: "ALREADY_CLOSED",
        message: "Return request is already closed (APPROVED)",
      }),
    );

    // Act & Assert
    await expect(submitRejectReturn("REQ-1", "A valid reason here")).rejects.toThrow(
      "Return request is already closed (APPROVED)",
    );
  });

  it.each([
    [409, "ALREADY_CLOSED", "Return request is already closed (APPROVED)"],
    [404, "NOT_FOUND", "Return request not found"],
    [400, "INVALID_REASON", "Reason must be 10–500 characters"],
  ])(
    "C1 submitRejectReturn throws a CXApiError carrying status %p and code %p",
    async (status, code, message) => {
      // Arrange
      fetchMock.mockResolvedValue(jsonResponse(status, { ok: false, code, message }));

      // Act
      const error = await submitRejectReturn("REQ-1", "A valid reason here").catch(e => e);

      // Assert
      expect(error).toBeInstanceOf(CXApiError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toEqual(expect.objectContaining({ status, code, message }));
    },
  );

  it("C1 a failure without a JSON body still carries the HTTP status and a null code", async () => {
    // Arrange
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    });

    // Act
    const error = await submitRejectReturn("REQ-1", "A valid reason here").catch(e => e);

    // Assert
    expect(error).toBeInstanceOf(CXApiError);
    expect(error).toEqual(
      expect.objectContaining({ status: 502, code: null, message: "Request failed: 502" }),
    );
  });

  it("J3 submitRejectReturn surfaces 400 INVALID_REASON message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        ok: false,
        code: "INVALID_REASON",
        message: "Reason must be 10–500 characters",
      }),
    );

    await expect(submitRejectReturn("REQ-1", "short")).rejects.toThrow(
      "Reason must be 10–500 characters",
    );
  });

  it("J4 fetchReturns sends pincode when set, alongside the other filters", async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ok: true, data: [], pagination: { total: 0, page: 1, limit: 20 } }),
    );

    // Act
    await fetchReturns({ status: "RETURN_PENDING", pincode: "560001", page: 1, limit: 20 } as any);

    // Assert
    const { url, init } = lastCall();

    expect(init.method).toBe("GET");
    expect(url.pathname).toBe("/cx/returns");
    expect(url.searchParams.get("pincode")).toBe("560001");
    expect(url.searchParams.get("status")).toBe("RETURN_PENDING");
    expect(url.searchParams.get("page")).toBe("1");
  });

  it("J4 fetchReturns omits pincode when not set or empty", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ok: true, data: [], pagination: { total: 0, page: 1, limit: 20 } }),
    );

    await fetchReturns({ page: 1 });
    expect(lastCall().url.searchParams.has("pincode")).toBe(false);

    await fetchReturns({ page: 1, pincode: "" } as any);
    expect(lastCall().url.searchParams.has("pincode")).toBe(false);
  });
});
