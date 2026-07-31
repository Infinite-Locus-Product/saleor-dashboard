/**
 * One entry of the persisted storefront sort order.
 * `{ variant, productid, sortIndex, color }`.
 *
 * `variant` is the representative variant of a colour — kept so the dashboard
 * can restore the saved order/selection on reopen. `color` is the colour's
 * display name and is what the storefront should match on (product + colour):
 * a specific representative variant may be unpublished, but the colour is
 * stable across the product's published variants, so matching on colour keeps
 * the storefront order intact. `color` is optional on read for backward
 * compatibility with entries saved before it was added.
 */
export interface SortOrderEntry {
  variant: string;
  /**
   * Optional on READ only. `buildSortOrder` always writes it, so an entry
   * without one is legacy data saved before this feature. Such entries are kept
   * (dropping them would silently lose part of a merchant's saved order) but
   * they are useless to a consumer matching on product + colour, so anything
   * reading this must handle absence rather than assume a string.
   */
  productid?: string;
  sortIndex: number;
  color?: string;
}

/**
 * The full persisted `sorting_order` payload: the ordered entries plus two
 * collection-level flags the storefront backend reads to decide how to render
 * the collection. Serialised as JSON on the `sorting_order` metadata key with
 * snake_case keys (`show_only_tagged_variants`, `is_filter_variants`, `order`).
 * The legacy bare-array value (just entries) is still accepted on read.
 */
export interface SortOrderConfig {
  /** Storefront shows only the pinned/tagged variants when true. */
  showOnlyTaggedVariants: boolean;
  /** Master on/off switch for variant filtering on the storefront. */
  isFilterVariants: boolean;
  order: SortOrderEntry[];
}

/**
 * A single draggable row: one colour of one product in the collection. Size
 * variants of the same colour are collapsed into this row and represented by
 * `variantId` (the first variant of that colour).
 */
export interface SortableVariant {
  /** dnd-kit item id — the representative variant id (unique across the list). */
  id: string;
  /** Representative variant id, persisted as `variant`. */
  variantId: string;
  productId: string;
  productName: string;
  /** Colour label, e.g. "Forged Iron". Falls back to the variant name. */
  colorName: string;
  thumbnailUrl: string | null;
  /** Available stock (quantity − allocated) summed across this colour's sizes. */
  availableQty: number;
}
