/**
 * Public metadata key on a collection that stores the storefront sort order.
 * The value is a JSON-stringified `SortOrderConfig`:
 * `{ show_only_tagged_variants, is_filter_variants, order: SortOrderEntry[] }`.
 * A legacy value that is a bare array of `SortOrderEntry` is still read. The
 * storefront backend consumes this to order/filter products in the collection.
 */
export const SORTING_ORDER_METADATA_KEY = "sorting_order";

/** Number of products fetched per page while loading the full collection. */
export const SORT_ORDER_PAGE_SIZE = 100;

/**
 * Variant attribute slug/name used to group size variants into a single colour
 * card. Matching is case-insensitive against both the attribute slug and name.
 */
export const COLOR_ATTRIBUTE_SLUG = "color";
