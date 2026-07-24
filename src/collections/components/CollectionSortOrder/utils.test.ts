import { type CollectionSortableVariantsQuery } from "@dashboard/graphql";

import { type SortableVariant, type SortOrderEntry } from "./types";
import {
  applySavedOrder,
  buildSortOrder,
  flattenVariants,
  getMetadataValue,
  getVariantAvailableQty,
  getVariantColor,
  parseSortConfig,
  parseSortOrder,
  serializeSortConfig,
  sortByInventory,
  upsertMetadata,
} from "./utils";

type ProductNode = NonNullable<
  NonNullable<CollectionSortableVariantsQuery["collection"]>["products"]
>["edges"][number]["node"];
type VariantNode = NonNullable<ProductNode["variants"]>[number];

const makeVariantNode = (id: string, color: string | null, available = 0): VariantNode => ({
  __typename: "ProductVariant",
  id,
  name: `Variant ${id}`,
  sku: `SKU-${id}`,
  media: null,
  stocks: [{ __typename: "Stock", quantity: available, quantityAllocated: 0 }],
  attributes: color
    ? [
        {
          __typename: "SelectedAttribute",
          attribute: { __typename: "Attribute", id: "attr-color", slug: "color", name: "Color" },
          values: [
            {
              __typename: "AttributeValue",
              id: `av-${color}`,
              slug: color.toLowerCase(),
              name: color,
            },
          ],
        },
      ]
    : [],
});

const makeProductNode = (id: string, variants: VariantNode[]): ProductNode => ({
  __typename: "Product",
  id,
  name: `Product ${id}`,
  thumbnail: { __typename: "Image", url: `https://img/${id}.jpg` },
  variants,
});

const makeVariant = (variantId: string, productId: string, availableQty = 0): SortableVariant => ({
  id: variantId,
  variantId,
  productId,
  productName: `Product ${productId}`,
  colorName: `Color ${variantId}`,
  thumbnailUrl: null,
  availableQty,
});

describe("CollectionSortOrder utils", () => {
  describe("getVariantColor", () => {
    it("reads the colour attribute value", () => {
      // Act
      const result = getVariantColor(makeVariantNode("v1", "Forged Iron"));

      // Assert
      expect(result).toEqual({ name: "Forged Iron", key: "forged iron" });
    });

    it("falls back to the SKU and a per-variant key when there is no colour attribute", () => {
      // Act
      const result = getVariantColor(makeVariantNode("v1", null));

      // Assert
      expect(result).toEqual({ name: "SKU-v1", key: "variant:v1" });
    });
  });

  describe("getVariantAvailableQty", () => {
    it("sums quantity minus allocated across warehouses", () => {
      // Arrange
      const variant = makeVariantNode("v1", "Red");

      variant.stocks = [
        { __typename: "Stock", quantity: 10, quantityAllocated: 3 },
        { __typename: "Stock", quantity: 5, quantityAllocated: 1 },
      ];

      // Act / Assert — (10-3) + (5-1) = 11
      expect(getVariantAvailableQty(variant)).toBe(11);
    });

    it("returns 0 when there are no stocks", () => {
      // Arrange
      const variant = makeVariantNode("v1", "Red");

      variant.stocks = null;

      // Act / Assert
      expect(getVariantAvailableQty(variant)).toBe(0);
    });
  });

  describe("flattenVariants", () => {
    it("sums available stock across a colour's sizes into one row", () => {
      // Arrange — Forged Iron across 3 sizes (4 + 38 + 1053), plus one Plum Smoke
      const product = makeProductNode("p1", [
        makeVariantNode("v1", "Forged Iron", 4),
        makeVariantNode("v2", "Forged Iron", 38),
        makeVariantNode("v3", "Forged Iron", 1053),
        makeVariantNode("v4", "Plum Smoke", 100),
      ]);

      // Act
      const rows = flattenVariants([product]);

      // Assert
      expect(rows.map(r => ({ variantId: r.variantId, availableQty: r.availableQty }))).toEqual([
        { variantId: "v1", availableQty: 1095 },
        { variantId: "v4", availableQty: 100 },
      ]);
    });

    it("collapses size variants into one row per colour, keeping order", () => {
      // Arrange — one product, 3 colours × 2 sizes each
      const product = makeProductNode("p1", [
        makeVariantNode("v1", "Forged Iron"),
        makeVariantNode("v2", "Forged Iron"),
        makeVariantNode("v3", "Plum Smoke"),
        makeVariantNode("v4", "Plum Smoke"),
        makeVariantNode("v5", "Peony Pink"),
        makeVariantNode("v6", "Peony Pink"),
      ]);

      // Act
      const rows = flattenVariants([product]);

      // Assert — 3 rows, each using the first variant of its colour
      expect(rows.map(r => ({ variantId: r.variantId, colorName: r.colorName }))).toEqual([
        { variantId: "v1", colorName: "Forged Iron" },
        { variantId: "v3", colorName: "Plum Smoke" },
        { variantId: "v5", colorName: "Peony Pink" },
      ]);
    });

    it("merges colours that share a name but have different attribute-value slugs", () => {
      // Arrange — two "Citrus Pop" values with different slugs on the same product
      const v1 = makeVariantNode("v1", "Citrus Pop", 10);
      const v2 = makeVariantNode("v2", "Citrus Pop", 5);

      v2.attributes = [
        {
          __typename: "SelectedAttribute",
          attribute: { __typename: "Attribute", id: "attr-color", slug: "color", name: "Color" },
          values: [
            { __typename: "AttributeValue", id: "av2", slug: "citrus-pop-2", name: "Citrus Pop" },
          ],
        },
      ];

      const product = makeProductNode("p1", [v1, v2]);

      // Act
      const rows = flattenVariants([product]);

      // Assert — one row, stock summed
      expect(rows).toHaveLength(1);
      expect(rows[0].colorName).toBe("Citrus Pop");
      expect(rows[0].availableQty).toBe(15);
    });

    it("keeps products with no colour attribute as one row per variant", () => {
      // Arrange
      const product = makeProductNode("p1", [
        makeVariantNode("v1", null),
        makeVariantNode("v2", null),
      ]);

      // Act
      const rows = flattenVariants([product]);

      // Assert
      expect(rows.map(r => r.variantId)).toEqual(["v1", "v2"]);
    });

    it("uses variant media when present, otherwise the product thumbnail", () => {
      // Arrange
      const withMedia = makeVariantNode("v1", "Red");

      withMedia.media = [{ __typename: "ProductMedia", url: "https://img/variant.jpg" }];

      const product = makeProductNode("p1", [withMedia, makeVariantNode("v2", "Blue")]);

      // Act
      const rows = flattenVariants([product]);

      // Assert
      expect(rows[0].thumbnailUrl).toBe("https://img/variant.jpg");
      expect(rows[1].thumbnailUrl).toBe("https://img/p1.jpg");
    });
  });

  describe("parseSortOrder", () => {
    it("returns [] for undefined or invalid JSON", () => {
      // Arrange / Act / Assert
      expect(parseSortOrder(undefined)).toEqual([]);
      expect(parseSortOrder("")).toEqual([]);
      expect(parseSortOrder("not json")).toEqual([]);
      expect(parseSortOrder('{"variant":"a"}')).toEqual([]);
    });

    it("parses valid entries and drops malformed ones", () => {
      // Arrange
      const value = JSON.stringify([
        { variant: "v1", productid: "p1", sortIndex: 1 },
        { variant: "v2", sortIndex: 2 },
        { variant: 3, productid: "p3", sortIndex: 3 },
        { productid: "p4", sortIndex: 4 },
      ]);

      // Act
      const result = parseSortOrder(value);

      // Assert
      expect(result).toEqual([
        { variant: "v1", productid: "p1", sortIndex: 1 },
        { variant: "v2", sortIndex: 2 },
      ]);
    });
  });

  describe("parseSortConfig", () => {
    it("returns defaults for undefined or invalid JSON", () => {
      // Arrange / Act / Assert
      const empty = { showOnlyTaggedVariants: false, isFilterVariants: false, order: [] };

      expect(parseSortConfig(undefined)).toEqual(empty);
      expect(parseSortConfig("")).toEqual(empty);
      expect(parseSortConfig("not json")).toEqual(empty);
      expect(parseSortConfig("42")).toEqual(empty);
    });

    it("reads flags and order from the object shape", () => {
      // Arrange
      const value = JSON.stringify({
        show_only_tagged_variants: true,
        is_filter_variants: true,
        order: [{ variant: "v1", productid: "p1", sortIndex: 1 }],
      });

      // Act / Assert
      expect(parseSortConfig(value)).toEqual({
        showOnlyTaggedVariants: true,
        isFilterVariants: true,
        order: [{ variant: "v1", productid: "p1", sortIndex: 1 }],
      });
    });

    it("defaults missing flags to false and drops malformed entries", () => {
      // Arrange
      const value = JSON.stringify({
        is_filter_variants: true,
        order: [
          { variant: "v1", productid: "p1", sortIndex: 1 },
          { variant: 2, sortIndex: 2 },
        ],
      });

      // Act / Assert
      expect(parseSortConfig(value)).toEqual({
        showOnlyTaggedVariants: false,
        isFilterVariants: true,
        order: [{ variant: "v1", productid: "p1", sortIndex: 1 }],
      });
    });

    it("accepts the legacy bare-array value with flags defaulting to false", () => {
      // Arrange — old format was just the array of entries
      const value = JSON.stringify([{ variant: "v1", productid: "p1", sortIndex: 1 }]);

      // Act / Assert
      expect(parseSortConfig(value)).toEqual({
        showOnlyTaggedVariants: false,
        isFilterVariants: false,
        order: [{ variant: "v1", productid: "p1", sortIndex: 1 }],
      });
    });
  });

  describe("serializeSortConfig", () => {
    it("returns an empty string when there is nothing to persist", () => {
      // Act / Assert — no order, both flags default
      expect(
        serializeSortConfig({ showOnlyTaggedVariants: false, isFilterVariants: false, order: [] }),
      ).toBe("");
    });

    it("persists when a flag is set even with an empty order", () => {
      // Act
      const value = serializeSortConfig({
        showOnlyTaggedVariants: false,
        isFilterVariants: true,
        order: [],
      });

      // Assert — round-trips through parseSortConfig
      expect(parseSortConfig(value)).toEqual({
        showOnlyTaggedVariants: false,
        isFilterVariants: true,
        order: [],
      });
    });

    it("serialises flags and order with snake_case keys", () => {
      // Arrange
      const config = {
        showOnlyTaggedVariants: true,
        isFilterVariants: false,
        order: [{ variant: "v1", productid: "p1", sortIndex: 1 }],
      };

      // Act
      const parsed = JSON.parse(serializeSortConfig(config));

      // Assert
      expect(parsed).toEqual({
        show_only_tagged_variants: true,
        is_filter_variants: false,
        order: [{ variant: "v1", productid: "p1", sortIndex: 1 }],
      });
    });
  });

  describe("applySavedOrder", () => {
    const variants = [makeVariant("v1", "p1"), makeVariant("v2", "p2"), makeVariant("v3", "p3")];

    it("returns variants unchanged when there is no saved order", () => {
      // Act / Assert
      expect(applySavedOrder(variants, [])).toEqual(variants);
    });

    it("orders by sortIndex, appending unreferenced variants in natural order", () => {
      // Arrange
      const savedOrder: SortOrderEntry[] = [
        { variant: "v3", productid: "p3", sortIndex: 1 },
        { variant: "v1", productid: "p1", sortIndex: 2 },
      ];

      // Act
      const result = applySavedOrder(variants, savedOrder).map(v => v.variantId);

      // Assert — v3, v1 pinned first; v2 (unreferenced) appended last
      expect(result).toEqual(["v3", "v1", "v2"]);
    });

    it("ignores saved entries whose variant no longer exists", () => {
      // Arrange
      const savedOrder: SortOrderEntry[] = [
        { variant: "gone", productid: "p9", sortIndex: 1 },
        { variant: "v2", productid: "p2", sortIndex: 2 },
      ];

      // Act
      const result = applySavedOrder(variants, savedOrder).map(v => v.variantId);

      // Assert
      expect(result).toEqual(["v2", "v1", "v3"]);
    });
  });

  describe("buildSortOrder", () => {
    it("maps ordered variants to 1-based sortIndex entries", () => {
      // Arrange
      const ordered = [makeVariant("v2", "p2"), makeVariant("v1", "p1")];

      // Act / Assert
      expect(buildSortOrder(ordered)).toEqual([
        { variant: "v2", productid: "p2", sortIndex: 1 },
        { variant: "v1", productid: "p1", sortIndex: 2 },
      ]);
    });
  });

  describe("sortByInventory", () => {
    it("orders rows by available stock, highest first", () => {
      // Arrange
      const rows = [
        makeVariant("v1", "p1", 10),
        makeVariant("v2", "p2", 500),
        makeVariant("v3", "p3", 100),
      ];

      // Act
      const result = sortByInventory(rows).map(r => r.variantId);

      // Assert
      expect(result).toEqual(["v2", "v3", "v1"]);
    });

    it("does not mutate the input array", () => {
      // Arrange
      const rows = [makeVariant("v1", "p1", 10), makeVariant("v2", "p2", 500)];

      // Act
      sortByInventory(rows);

      // Assert — original order preserved
      expect(rows.map(r => r.variantId)).toEqual(["v1", "v2"]);
    });
  });

  describe("getMetadataValue / upsertMetadata", () => {
    it("reads a metadata value by key", () => {
      // Arrange
      const metadata = [{ key: "sorting_order", value: "abc" }];

      // Act / Assert
      expect(getMetadataValue(metadata, "sorting_order")).toBe("abc");
      expect(getMetadataValue(metadata, "missing")).toBeUndefined();
      expect(getMetadataValue(undefined, "sorting_order")).toBeUndefined();
    });

    it("adds a new key without touching existing entries", () => {
      // Arrange
      const metadata = [{ key: "other", value: "x" }];

      // Act
      const result = upsertMetadata(metadata, "sorting_order", "json");

      // Assert
      expect(result).toEqual([
        { key: "other", value: "x" },
        { key: "sorting_order", value: "json" },
      ]);
    });

    it("replaces the value of an existing key", () => {
      // Arrange
      const metadata = [
        { key: "sorting_order", value: "old" },
        { key: "other", value: "x" },
      ];

      // Act
      const result = upsertMetadata(metadata, "sorting_order", "new");

      // Assert
      expect(result).toEqual([
        { key: "other", value: "x" },
        { key: "sorting_order", value: "new" },
      ]);
    });

    it("removes the key when the value is empty", () => {
      // Arrange
      const metadata = [
        { key: "sorting_order", value: "old" },
        { key: "other", value: "x" },
      ];

      // Act
      const result = upsertMetadata(metadata, "sorting_order", "");

      // Assert
      expect(result).toEqual([{ key: "other", value: "x" }]);
    });
  });
});
