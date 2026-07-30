import { type ApolloQueryResult, useApolloClient } from "@apollo/client";
import {
  CollectionSortableVariantsDocument,
  type CollectionSortableVariantsQuery,
  type CollectionSortableVariantsQueryVariables,
} from "@dashboard/graphql";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { useCallback, useEffect, useState } from "react";
import { defineMessages, useIntl } from "react-intl";

import { SORT_ORDER_PAGE_SIZE } from "./constants";
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
}

/**
 * Loads every product (with its variants) of a collection by walking through
 * all pages, so the whole set is available for a global drag-and-drop sort.
 */
export const useCollectionSortOrderData = (
  collectionId: string | undefined,
): UseCollectionSortOrderDataResult => {
  const client = useApolloClient();
  const intl = useIntl();
  const notify = useNotifier();
  const [variants, setVariants] = useState<SortableVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // Bumping this re-runs the effect, which is the whole retry mechanism.
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(current => current + 1), []);

  useEffect(() => {
    if (!collectionId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      // Clear the previous outcome before trying again, so a successful retry
      // doesn't stay stuck in the error state.
      setHasError(false);
      // Drop the previous collection's rows. This hook is not remounted when the
      // route moves between two collections, so keeping them would let one
      // collection's variants be displayed — and saved — under another's id.
      setVariants([]);

      const nodes: ProductNode[] = [];
      let after: string | null = null;
      let hasNextPage = true;

      try {
        while (hasNextPage && !cancelled) {
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

          nodes.push(...(connection?.edges.map(edge => edge.node) ?? []));
          hasNextPage = connection?.pageInfo.hasNextPage ?? false;
          after = connection?.pageInfo.endCursor ?? null;
        }

        if (!cancelled) {
          // Default order = highest available stock first.
          setVariants(sortByInventory(flattenVariants(nodes)));
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
  }, [collectionId, client, attempt, notify, intl]);

  return { variants, loading, hasError, retry };
};
