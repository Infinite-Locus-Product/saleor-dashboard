import { getCacheEndpointById } from "@dashboard/cacheManagement/config/endpoints";
import { type CacheEndpointConfig } from "@dashboard/cacheManagement/types";

import { buildCacheRequest, parseIdList } from "./buildRequest";

const BASE_URL = "https://api.tenxyou.com";

const getEndpoint = (id: string): CacheEndpointConfig => {
  const endpoint = getCacheEndpointById(id);

  if (!endpoint) throw new Error(`Fixture endpoint "${id}" is missing from the registry`);

  return endpoint;
};

describe("parseIdList", () => {
  it("splits on newlines and commas and drops blanks", () => {
    // Arrange
    const raw = "  a1 \n\n b2,c3 ,\n , d4  ";

    // Act
    const result = parseIdList(raw);

    // Assert
    expect(result).toEqual(["a1", "b2", "c3", "d4"]);
  });

  it("returns an empty array for whitespace only input", () => {
    // Arrange
    const raw = "  \n , \n ";

    // Act
    const result = parseIdList(raw);

    // Assert
    expect(result).toEqual([]);
  });
});

describe("buildCacheRequest", () => {
  it("builds a GET slug request without a body", () => {
    // Arrange
    const endpoint = getEndpoint("pdp-slugs");

    // Act
    const request = buildCacheRequest({ endpoint, values: {}, baseUrl: BASE_URL });

    // Assert
    expect(request).toEqual({
      url: "https://api.tenxyou.com/saleor/pdp-slugs",
      method: "GET",
      body: undefined,
    });
  });

  it("omits the body for an admin endpoint that takes no payload", () => {
    // Arrange
    const endpoint = getEndpoint("inventory-full-seed");

    // Act
    const request = buildCacheRequest({ endpoint, values: {}, baseUrl: BASE_URL });

    // Assert
    expect(request.url).toBe("https://api.tenxyou.com/saleor/inventory-stock-cache-init");
    expect(request.body).toBeUndefined();
  });

  it("sends an idList field as a string array in the body", () => {
    // Arrange
    const endpoint = getEndpoint("inventory-targeted-seed");
    const values = { variantIds: "UHJvZHVjdFZhcmlhbnQ6MTIz\nUHJvZHVjdFZhcmlhbnQ6NDU2" };

    // Act
    const request = buildCacheRequest({ endpoint, values, baseUrl: BASE_URL });

    // Assert
    expect(request.body).toEqual({
      variantIds: ["UHJvZHVjdFZhcmlhbnQ6MTIz", "UHJvZHVjdFZhcmlhbnQ6NDU2"],
    });
  });

  it("merges staticBody with user supplied fields", () => {
    // Arrange
    const endpoint = getEndpoint("clear-rating-cache-user-rating");
    const values = { order_ids: "T3JkZXI6MTIz,T3JkZXI6NDU2" };

    // Act
    const request = buildCacheRequest({ endpoint, values, baseUrl: BASE_URL });

    // Assert
    expect(request.body).toEqual({
      scope: "user_rating",
      order_ids: ["T3JkZXI6MTIz", "T3JkZXI6NDU2"],
    });
  });

  it("sends a staticBody-only endpoint with just its fixed payload", () => {
    // Arrange
    const endpoint = getEndpoint("clear-rating-cache-all");

    // Act
    const request = buildCacheRequest({ endpoint, values: {}, baseUrl: BASE_URL });

    // Assert
    expect(request.body).toEqual({ scope: "all" });
  });

  it("puts fields in the query string when fieldTarget is query", () => {
    // Arrange
    const endpoint = getEndpoint("clear-testimonial-cache");
    const values = { productId: "UHJvZHVjdDoxMjM=" };

    // Act
    const request = buildCacheRequest({ endpoint, values, baseUrl: BASE_URL });

    // Assert
    expect(request.url).toBe(
      "https://api.tenxyou.com/saleor/clear-testimonial-cache?productId=UHJvZHVjdDoxMjM%3D",
    );
    expect(request.body).toBeUndefined();
  });

  it("builds the taggbox DELETE with all three query params and no body", () => {
    // Arrange
    const endpoint = getEndpoint("tagbox-data-delete");
    const values = { galleryId: "g1", feedId: "f2", postId: "p3" };

    // Act
    const request = buildCacheRequest({ endpoint, values, baseUrl: BASE_URL });

    // Assert
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe(
      "https://api.tenxyou.com/saleor/tagbox-data?galleryId=g1&feedId=f2&postId=p3",
    );
    expect(request.body).toBeUndefined();
  });

  it("normalises a base url with a trailing slash", () => {
    // Arrange
    const endpoint = getEndpoint("clear-navbar-cache");

    // Act
    const request = buildCacheRequest({
      endpoint,
      values: {},
      baseUrl: "https://api.tenxyou.com///",
    });

    // Assert
    expect(request.url).toBe("https://api.tenxyou.com/saleor/clear-navbar-cache");
  });

  it("skips empty optional values instead of sending blank strings", () => {
    // Arrange
    const endpoint = getEndpoint("clear-cache-by-prefix");

    // Act
    const request = buildCacheRequest({
      endpoint,
      values: { cache_key_prefix: "   " },
      baseUrl: BASE_URL,
    });

    // Assert
    expect(request.body).toBeUndefined();
  });
});
