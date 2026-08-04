import { type ApolloQueryResult, useApolloClient } from "@apollo/client";
import {
  CollectionSortableVariantsDocument,
  type CollectionSortableVariantsQuery,
  type CollectionSortableVariantsQueryVariables,
} from "@dashboard/graphql";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { useCallback, useEffect, useState } from "react";
import { defineMessages, useIntl } from "react-intl";

import { SORT_ORDER_MAX_PAGES, SORT_ORDER_PAGE_SIZE } from "./constants";
import { type SortableVariant } from "./types";
import { flattenVariants, sortByInventory } from "./utils";

const messages = defineMessages({
  loadError: {
    id: "Sc6m2U",
    defaultMessage: "Couldn't load this collection's products for sorting",
    description: "error notification",
  },
});

type ProductNode = NonNullable<
  NonNullable<CollectionSortableVariantsQuery["collection"]>["products"]
>["edges"][number]["node"];

interface UseCollectionSortOrderDataResult {
  variants: SortableVariant[];
  loading: boolean;
  /**
   * The load failed. Distinct from `variants` being empty: an empty list is a
   * valid answer ("this collection has no products"), while this means we have
   * no answer at all and must not present the collection as empty.
   */
  hasError: boolean;
  /** Run the load again — for a retry button in the error state. */
  retry: () => void;
  /** The collection has more products than SORT_ORDER_MAX_PRODUCTS. */
  truncated: boolean;
  /**
   * Stock resolved with a field-level error (e.g. no permission), so every
   * `availableQty` is 0 by default rather than by fact. The card must not sort
   * by inventory or report those zeros as real numbers.
   */
  stockDataMissing: boolean;
}

interface UseCollectionSortOrderDataOptions {
  /**
   * Only load once the merchant has asked for the list. The card sits on every
   * Collection detail page, so loading eagerly would make every visit pay for a
   * feature most visits never use.
   */
  enabled: boolean;
}

/**
 * Loads a collection's products (with their variants) by walking pages up to
 * SORT_ORDER_MAX_PAGES, so a large set can be sorted without an unbounded walk.
 */
export const useCollectionSortOrderData = (
  collectionId: string | undefined,
  { enabled }: UseCollectionSortOrderDataOptions,
): UseCollectionSortOrderDataResult => {
  const client = useApolloClient();
  const intl = useIntl();
  const notify = useNotifier();
  const [variants, setVariants] = useState<SortableVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [stockDataMissing, setStockDataMissing] = useState(false);
  // Bumping this re-runs the effect, which is the whole retry mechanism.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(current => current + 1), []);

  useEffect(() => {
    if (!collectionId || !enabled) {
      // Nothing to load — make sure we aren't left showing skeletons forever
      // (e.g. a collection that never resolves).
      setLoading(false);

      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      // Clear the previous outcome before trying again, so a successful retry
      // doesn't stay stuck in the error state.
      setHasError(false);
      setTruncated(false);
      setStockDataMissing(false);
      // Drop the previous collection's rows. This hook is not remounted when the
      // route moves between two collections, so keeping them would let one
      // collection's variants be displayed — and saved — under another's id.
      setVariants([]);

      const nodes: ProductNode[] = [];
      let after: string | null = null;
      let hasNextPage = true;
      let page = 0;
      let stocksDenied = false;

      try {
        while (hasNextPage && !cancelled && page < SORT_ORDER_MAX_PAGES) {
          const result: ApolloQueryResult<CollectionSortableVariantsQuery> = await client.query<
            CollectionSortableVariantsQuery,
            CollectionSortableVariantsQueryVariables
          >({
            query: CollectionSortableVariantsDocument,
            variables: { id: collectionId, first: SORT_ORDER_PAGE_SIZE, after },
            fetchPolicy: "network-only",
            // Tolerate field-level errors (e.g. stock permissions) — keep the
            // products/variants that did resolve instead of throwing.
            errorPolicy: "all",
          });

          const connection = result.data?.collection?.products;

          // `errorPolicy: "all"` keeps partial data instead of throwing, so the
          // field-level errors land here rather than in the catch. Unread, they
          // would turn "stock is unknown" into a confident "0 in stock".
          if ((result.errors ?? []).some(error => error.path?.includes("stocks"))) {
            stocksDenied = true;
          }

          nodes.push(...(connection?.edges.map(edge => edge.node) ?? []));
          hasNextPage = connection?.pageInfo.hasNextPage ?? false;

          const nextAfter = connection?.pageInfo.endCursor ?? null;

          // A cursor that doesn't advance while hasNextPage stays true would
          // refetch the same page until the cap — stop instead.
          if (hasNextPage && nextAfter === after) {
            break;
          }

          after = nextAfter;
          page += 1;
        }

        if (!cancelled) {
          // Default order = highest available stock first.
          setVariants(sortByInventory(flattenVariants(nodes)));
          // Pages remain but the cap was reached — the card must disclose that
          // the list it shows is partial rather than silently truncating.
          setTruncated(hasNextPage);
          setStockDataMissing(stocksDenied);
        }
      } catch (error) {
        // A failed sort-order load must never take down the collection page.
        console.error("Failed to load collection sort order data:", error);

        if (!cancelled) {
          // `variants` is already empty (cleared above), so the failure has to be
          // recorded separately — otherwise the card cannot tell this apart from
          // a collection that genuinely has no products.
          setHasError(true);
          notify({
            status: "error",
            text: intl.formatMessage(messages.loadError),
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [collectionId, client, attempt, enabled, notify, intl]);

  return { variants, loading, hasError, retry, truncated, stockDataMissing };
};
