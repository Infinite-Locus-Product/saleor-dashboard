/**
 * Public metadata key on a collection that stores the storefront sort order.
 * The value is a JSON-stringified `SortOrderConfig`:
 * `{ show_only_tagged_variants, is_filter_variants, order: SortOrderEntry[] }`.
 * A legacy value that is a bare array of `SortOrderEntry` is still read. The
 * storefront backend consumes this to order/filter products in the collection.
 */
export const SORTING_ORDER_METADATA_KEY = "sorting_order";

/** Number of products fetched per page while loading the collection. */
export const SORT_ORDER_PAGE_SIZE = 100;

/**
 * Hard ceiling on how many pages are walked. Paging is sequential (each page
 * needs the previous cursor), every row is rendered without virtualization, and
 * all of them register with dnd-kit — so an uncapped walk both hammers the API
 * and makes dragging unusable. Collections beyond this are truncated, and the
 * card says so rather than silently showing a partial list.
 */
export const SORT_ORDER_MAX_PAGES = 5;

/** Products loaded at most, i.e. the point where the list is truncated. */
export const SORT_ORDER_MAX_PRODUCTS = SORT_ORDER_PAGE_SIZE * SORT_ORDER_MAX_PAGES;

/**
 * Variant attribute slug/name used to group size variants into a single colour
 * card. Matching is case-insensitive against both the attribute slug and name.
 */
export const COLOR_ATTRIBUTE_SLUG = "color";
