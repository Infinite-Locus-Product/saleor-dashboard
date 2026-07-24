import { type CollectionSortableVariantsQuery, type MetadataInput } from "@dashboard/graphql";

import { COLOR_ATTRIBUTE_SLUG } from "./constants";
import { type SortableVariant, type SortOrderConfig, type SortOrderEntry } from "./types";

type ProductNode = NonNullable<
  NonNullable<CollectionSortableVariantsQuery["collection"]>["products"]
>["edges"][number]["node"];
type VariantNode = NonNullable<ProductNode["variants"]>[number];

/**
 * Resolve the colour of a variant from its attributes. Returns the colour value
 * name and a grouping key derived from that name, so colours that share a
 * display name (e.g. duplicate "Citrus Pop" attribute values with different
 * slugs) collapse into a single row per product. Falls back to the variant SKU
 * when the product has no colour attribute, so every variant still groups.
 */
export const getVariantColor = (variant: VariantNode): { name: string; key: string } => {
  const colorAttribute = variant.attributes.find(({ attribute }) => {
    const slug = attribute.slug?.toLowerCase();
    const name = attribute.name?.toLowerCase();

    return slug === COLOR_ATTRIBUTE_SLUG || name === COLOR_ATTRIBUTE_SLUG;
  });
  const value = colorAttribute?.values[0];

  if (value) {
    const label = value.name ?? value.slug ?? "";

    return { name: label, key: label.trim().toLowerCase() };
  }

  // No colour attribute — treat each variant as its own group. Prefer the SKU
  // as a human label; variant names in this catalogue can be encoded IDs.
  return { name: variant.sku ?? "Default", key: `variant:${variant.id}` };
};

/** Available stock for one variant: (quantity − allocated) summed over warehouses. */
export const getVariantAvailableQty = (variant: VariantNode): number =>
  (variant.stocks ?? []).reduce(
    (sum, stock) => sum + (stock.quantity - stock.quantityAllocated),
    0,
  );

/**
 * Collapse products into one row per colour. Size variants that share a colour
 * are represented by the first variant of that colour, and their available
 * stock is summed into the row. Product and colour order is preserved from the
 * query response.
 */
export const flattenVariants = (products: ProductNode[]): SortableVariant[] => {
  const rows: SortableVariant[] = [];
  const byGroup = new Map<string, SortableVariant>();

  products.forEach(product => {
    (product.variants ?? []).forEach(variant => {
      const color = getVariantColor(variant);
      const groupKey = `${product.id}:${color.key}`;
      const qty = getVariantAvailableQty(variant);
      const existing = byGroup.get(groupKey);

      if (existing) {
        // Same colour, another size — add its stock to the colour's total.
        existing.availableQty += qty;

        return;
      }

      const row: SortableVariant = {
        id: variant.id,
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        colorName: color.name,
        thumbnailUrl: variant.media?.[0]?.url ?? product.thumbnail?.url ?? null,
        availableQty: qty,
      };

      byGroup.set(groupKey, row);
      // `rows` holds the same object reference, so the `+=` above updates it too.
      rows.push(row);
    });
  });

  return rows;
};

/** Order rows by available stock, highest first (stable on ties). */
export const sortByInventory = (rows: SortableVariant[]): SortableVariant[] =>
  [...rows].sort((a, b) => b.availableQty - a.availableQty);

/** Keep only well-formed entries from an arbitrary parsed array. */
const filterEntries = (value: unknown): SortOrderEntry[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is SortOrderEntry =>
          !!entry && typeof entry.variant === "string" && typeof entry.sortIndex === "number",
      )
    : [];

/** Safely parse the persisted `sorting_order` value into just the order entries. */
export const parseSortOrder = (value: string | undefined): SortOrderEntry[] =>
  parseSortConfig(value).order;

/**
 * Parse the persisted `sorting_order` metadata value into the full config
 * (flags + order). Accepts both the current object shape and the legacy bare
 * array of entries, always returning safe defaults on missing/invalid input.
 */
export const parseSortConfig = (value: string | undefined): SortOrderConfig => {
  const empty: SortOrderConfig = {
    showOnlyTaggedVariants: false,
    isFilterVariants: false,
    order: [],
  };

  if (!value) {
    return empty;
  }

  try {
    const parsed = JSON.parse(value);

    // Legacy shape: value was a bare array of entries, no flags.
    if (Array.isArray(parsed)) {
      return { ...empty, order: filterEntries(parsed) };
    }

    if (parsed && typeof parsed === "object") {
      return {
        showOnlyTaggedVariants: parsed.show_only_tagged_variants === true,
        isFilterVariants: parsed.is_filter_variants === true,
        order: filterEntries(parsed.order),
      };
    }

    return empty;
  } catch {
    return empty;
  }
};

/**
 * Serialise a config into the `sorting_order` metadata value. Returns an empty
 * string (which removes the metadata key) only when there is nothing to
 * persist — no pinned entries and both flags at their default (false).
 */
export const serializeSortConfig = (config: SortOrderConfig): string => {
  const hasOrder = config.order.length > 0;
  const hasFlags = config.showOnlyTaggedVariants || config.isFilterVariants;

  if (!hasOrder && !hasFlags) {
    return "";
  }

  return JSON.stringify({
    show_only_tagged_variants: config.showOnlyTaggedVariants,
    is_filter_variants: config.isFilterVariants,
    order: config.order,
  });
};

/**
 * Order the loaded variants by a previously saved order. Variants present in
 * `savedOrder` come first (by `sortIndex`); any variant not referenced keeps its
 * natural order and is appended afterwards.
 */
export const applySavedOrder = (
  variants: SortableVariant[],
  savedOrder: SortOrderEntry[],
): SortableVariant[] => {
  if (savedOrder.length === 0) {
    return variants;
  }

  const byVariantId = new Map(variants.map(variant => [variant.variantId, variant]));
  const seen = new Set<string>();
  const ordered: SortableVariant[] = [];

  [...savedOrder]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .forEach(entry => {
      const variant = byVariantId.get(entry.variant);

      if (variant && !seen.has(variant.variantId)) {
        ordered.push(variant);
        seen.add(variant.variantId);
      }
    });

  variants.forEach(variant => {
    if (!seen.has(variant.variantId)) {
      ordered.push(variant);
    }
  });

  return ordered;
};

/** Build the persisted entries from the current on-screen order (1-based index). */
export const buildSortOrder = (orderedVariants: SortableVariant[]): SortOrderEntry[] =>
  orderedVariants.map((variant, index) => ({
    variant: variant.variantId,
    productid: variant.productId,
    sortIndex: index + 1,
  }));

/** Read a metadata value by key from a metadata input array. */
export const getMetadataValue = (
  metadata: MetadataInput[] | undefined,
  key: string,
): string | undefined => metadata?.find(item => item.key === key)?.value;

/**
 * Upsert a metadata key. A falsy value removes the key entirely so an empty /
 * cleared order does not leave a dangling metadata entry.
 */
export const upsertMetadata = (
  metadata: MetadataInput[] | undefined,
  key: string,
  value: string,
): MetadataInput[] => {
  const rest = (metadata ?? []).filter(item => item.key !== key);

  if (!value) {
    return rest;
  }

  return [...rest, { key, value }];
};
