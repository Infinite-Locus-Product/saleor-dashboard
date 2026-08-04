import { getCacheEndpointById } from "@dashboard/cacheManagement/config/endpoints";
import { type CacheEndpointConfig } from "@dashboard/cacheManagement/types";

import { getInitialFieldValues, hasValidationErrors, validateCacheFields } from "./validation";

const getEndpoint = (id: string): CacheEndpointConfig => {
  const endpoint = getCacheEndpointById(id);

  if (!endpoint) throw new Error(`Fixture endpoint "${id}" is missing from the registry`);

  return endpoint;
};

describe("validateCacheFields", () => {
  it("returns no errors for an endpoint without fields", () => {
    // Arrange
    const endpoint = getEndpoint("clear-navbar-cache");

    // Act
    const errors = validateCacheFields({ endpoint, values: {} });

    // Assert
    expect(errors).toEqual({});
    expect(hasValidationErrors(errors)).toBe(false);
  });

  it("flags a required text field that is blank", () => {
    // Arrange
    const endpoint = getEndpoint("clear-testimonial-cache");

    // Act
    const errors = validateCacheFields({ endpoint, values: { productId: "   " } });

    // Assert
    expect(errors).toEqual({ productId: "required" });
  });

  it("flags a required idList that parses to nothing", () => {
    // Arrange
    const endpoint = getEndpoint("inventory-targeted-seed");

    // Act
    const errors = validateCacheFields({ endpoint, values: { variantIds: " , \n , " } });

    // Assert
    expect(errors).toEqual({ variantIds: "emptyList" });
  });

  it("accepts an idList with at least one id", () => {
    // Arrange
    const endpoint = getEndpoint("inventory-targeted-seed");

    // Act
    const errors = validateCacheFields({ endpoint, values: { variantIds: "abc" } });

    // Assert
    expect(hasValidationErrors(errors)).toBe(false);
  });

  it("reports every missing query param on the taggbox endpoint", () => {
    // Arrange
    const endpoint = getEndpoint("tagbox-data-delete");

    // Act
    const errors = validateCacheFields({ endpoint, values: { galleryId: "g1" } });

    // Assert
    expect(errors).toEqual({ feedId: "required", postId: "required" });
  });
});

describe("getInitialFieldValues", () => {
  it("seeds every field with an empty string so inputs stay controlled", () => {
    // Arrange
    const endpoint = getEndpoint("tagbox-data-delete");

    // Act
    const values = getInitialFieldValues(endpoint);

    // Assert
    expect(values).toEqual({ galleryId: "", feedId: "", postId: "" });
  });

  it("returns an empty object for an endpoint with no fields", () => {
    // Arrange
    const endpoint = getEndpoint("pdp-slugs");

    // Act
    const values = getInitialFieldValues(endpoint);

    // Assert
    expect(values).toEqual({});
  });
});
