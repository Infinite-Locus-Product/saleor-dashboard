import { type ApolloQueryResult, useApolloClient } from "@apollo/client";
import {
  CollectionSortableVariantsDocument,
  type CollectionSortableVariantsQuery,
  type CollectionSortableVariantsQueryVariables,
} from "@dashboard/graphql";
import { useEffect, useState } from "react";

import { SORT_ORDER_PAGE_SIZE } from "./constants";
import { type SortableVariant } from "./types";
import { flattenVariants, sortByInventory } from "./utils";

type ProductNode = NonNullable<
  NonNullable<CollectionSortableVariantsQuery["collection"]>["products"]
>["edges"][number]["node"];

interface UseCollectionSortOrderDataResult {
  variants: SortableVariant[];
  loading: boolean;
}

/**
 * Loads every product (with its variants) of a collection by walking through
 * all pages, so the whole set is available for a global drag-and-drop sort.
 */
export const useCollectionSortOrderData = (
  collectionId: string | undefined,
): UseCollectionSortOrderDataResult => {
  const client = useApolloClient();
  const [variants, setVariants] = useState<SortableVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collectionId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

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
          setVariants([]);
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
  }, [collectionId, client]);

  return { variants, loading };
};
