/**
 * The backend answers a repeat rebuild inside its cooldown with 429 + a
 * "try again in Ns" message the card shows as-is.
 */
import { rebuildProductVariantCache } from "./rebuildProductCacheApi";

jest.mock("@dashboard/returns-exchange/api/tenexuBaseUrl", () => ({
  getTenexuBaseUrl: () => "https://api.test",
}));

const fetchMock = jest.fn();

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

describe("rebuildProductVariantCache", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it("POSTs the product id to rebuild-product-variant-cache", async () => {
    // Arrange
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));

    // Act
    await rebuildProductVariantCache({ productId: "UHJvZHVjdDo1MTc=" });

    // Assert
    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("https://api.test/saleor/rebuild-product-variant-cache");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({
      first: 10,
      productId: "UHJvZHVjdDo1MTc=",
      channel: "txy",
    });
  });

  it("surfaces the backend's cooldown message on 429", async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        success: false,
        error: "This product's cache was rebuilt or is rebuilding. Try again in 126s.",
        retryAfterSeconds: 126,
      }),
    );

    // Act + Assert
    await expect(rebuildProductVariantCache({ productId: "P" })).rejects.toThrow(
      "Try again in 126s.",
    );
  });
});
