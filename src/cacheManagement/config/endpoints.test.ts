import { cacheCategories } from "./categories";
import { allowedCacheKeyPrefixes, cacheEndpoints } from "./endpoints";

describe("cache endpoint registry", () => {
  it("has unique endpoint ids", () => {
    // Arrange
    const ids = cacheEndpoints.map(endpoint => endpoint.id);

    // Act
    const unique = new Set(ids);

    // Assert
    expect(unique.size).toBe(ids.length);
  });

  it("only references categories that exist in the display config", () => {
    // Arrange
    const knownCategories = new Set(cacheCategories.map(category => category.id));

    // Act
    const orphans = cacheEndpoints.filter(endpoint => !knownCategories.has(endpoint.category));

    // Assert
    expect(orphans).toEqual([]);
  });

  it("gives every destructive endpoint its own confirmation copy", () => {
    // Arrange
    const destructive = cacheEndpoints.filter(endpoint => endpoint.destructive);

    // Act
    const missingConfirmation = destructive.filter(endpoint => !endpoint.confirmation);

    // Assert
    expect(destructive.length).toBeGreaterThan(0);
    expect(missingConfirmation.map(endpoint => endpoint.id)).toEqual([]);
  });

  it("marks only the inventory stock seed routes as admin-only", () => {
    // Arrange
    const adminEndpoints = cacheEndpoints.filter(endpoint => endpoint.requiresAdmin);

    // Act
    const paths = new Set(adminEndpoints.map(endpoint => endpoint.path));

    // Assert
    expect(paths).toEqual(new Set(["/saleor/inventory-stock-cache-init"]));
  });

  it("restricts the generic prefix select to the approved allow-list", () => {
    // Arrange
    const advanced = cacheEndpoints.find(endpoint => endpoint.id === "clear-cache-by-prefix");
    const prefixField = advanced?.fields?.[0];

    // Act
    const values =
      prefixField?.type === "select" ? prefixField.options.map(option => option.value) : [];

    // Assert
    expect(values).toEqual(allowedCacheKeyPrefixes.map(prefix => prefix.value));
    expect(values).toEqual(["cache:freebie", "taggbox:", "preorder", "edd-config"]);
  });

  it("never sends a body on GET or DELETE endpoints", () => {
    // Arrange
    const bodylessMethods = cacheEndpoints.filter(
      endpoint => endpoint.method === "GET" || endpoint.method === "DELETE",
    );

    // Act
    const offenders = bodylessMethods.filter(
      endpoint => endpoint.staticBody || (endpoint.fields && endpoint.fieldTarget !== "query"),
    );

    // Assert
    expect(offenders.map(endpoint => endpoint.id)).toEqual([]);
  });
});
