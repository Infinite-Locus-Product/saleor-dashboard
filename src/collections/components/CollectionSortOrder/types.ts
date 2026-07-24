/**
 * One entry of the persisted storefront sort order. Matches the shape the
 * storefront backend already reads (previously stored in Strapi):
 * `{ variant, productid, sortIndex }`. `variant` is the representative variant
 * of a colour (each colour renders as one card on the storefront).
 */
export interface SortOrderEntry {
  variant: string;
  productid: string;
  sortIndex: number;
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
