import {
  createManualRefund,
  fetchManualRefunds,
  lookupOrderForManualRefund,
  saveManualRefundProof,
} from "./manualRefundApi";
import { isManualReturnApiError } from "./manualReturnApiError";

jest.mock("./tenexuBaseUrl", () => ({
  getTenexuBaseUrl: () => "https://api.test",
}));

const fetchMock = jest.fn();

const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

const lastRequest = (): { url: URL; init: RequestInit } => {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];

  return { url: new URL(url as string), init: init as RequestInit };
};

describe("manualRefundApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.setItem("_saleor_auth_token", "token-123");
    localStorage.setItem("_saleorRefreshToken", "refresh-456");
  });

  it("looks up an order as JSON with the auth headers and a trimmed order number", async () => {
    // Arrange
    respond(200, { ok: true, data: { order_number: "1001", delivery_notes: [] } });

    // Act
    await lookupOrderForManualRefund("  1001 ");

    // Assert
    const { url, init } = lastRequest();

    expect(url.pathname).toBe("/cx/manual-refunds/order-lookup");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer token-123",
      "X-Refresh-Token": "refresh-456",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({ order_number: "1001" });
  });

  it("uploads proof as multipart form data with txn_reference and file", async () => {
    // Arrange
    respond(200, { ok: true, data: { mrf_id: "MRF-12" } });

    const file = new File(["%PDF"], "proof.pdf", { type: "application/pdf" });

    // Act
    await saveManualRefundProof("MRF-12", "  UTR123 ", file);

    // Assert
    const { url, init } = lastRequest();
    const form = init.body as FormData;

    expect(url.pathname).toBe("/cx/manual-refunds/MRF-12/proof");
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("txn_reference")).toBe("UTR123");
    expect((form.get("file") as File).name).toBe("proof.pdf");
    // The browser sets the multipart boundary itself, so no JSON Content-Type.
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("puts search and status into the list query", async () => {
    // Arrange
    respond(200, { ok: true, data: [], pagination: { total: 0, page: 2, limit: 20 } });

    // Act
    await fetchManualRefunds(2, 20, { search: "MRF-12", status: "REFUND_FAILED" });

    // Assert
    const { url } = lastRequest();

    expect(url.pathname).toBe("/cx/manual-refunds");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      limit: "20",
      search: "MRF-12",
      status: "REFUND_FAILED",
    });
  });

  it("throws the backend's code and message", async () => {
    // Arrange
    respond(409, { ok: false, code: "ALREADY_LOCKED", message: "Just refunded by someone else" });

    // Act
    const error = await createManualRefund({
      order_number: "1001",
      fulfillment_id: "F1",
      reason: "late pickup",
    }).catch((err: unknown) => err);

    // Assert
    expect(isManualReturnApiError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 409,
      code: "ALREADY_LOCKED",
      message: "Just refunded by someone else",
    });
  });
});
