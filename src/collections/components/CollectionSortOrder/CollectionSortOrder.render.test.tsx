import { type MetadataInput } from "@dashboard/graphql";
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";

import { CollectionSortOrder } from "./CollectionSortOrder";
import { SORTING_ORDER_METADATA_KEY } from "./constants";
import { type SortOrderConfig } from "./types";
import { serializeSortConfig, upsertMetadata } from "./utils";

jest.mock("./useCollectionSortOrderData", () => {
  // Stable references across renders — mirrors the real hook's useState. Keyed
  // by collection so a test can navigate from one collection to another.
  const variantsByCollection: Record<string, unknown[]> = {
    c1: [
      {
        id: "v1",
        variantId: "v1",
        productId: "p1",
        productName: "Tee",
        colorName: "Forged Iron",
        thumbnailUrl: null,
        availableQty: 1150,
      },
      {
        id: "v2",
        variantId: "v2",
        productId: "p1",
        productName: "Tee",
        colorName: "Peony Pink",
        thumbnailUrl: null,
        availableQty: 2231,
      },
    ],
    c2: [
      {
        id: "w1",
        variantId: "w1",
        productId: "p2",
        productName: "Hoodie",
        colorName: "Midnight",
        thumbnailUrl: null,
        availableQty: 42,
      },
    ],
  };

  return {
    useCollectionSortOrderData: (collectionId: string) => ({
      loading: false,
      variants: variantsByCollection[collectionId] ?? [],
    }),
  };
});

// Mirrors form.tsx: onChange writes the order into the metadata prop, which
// flows back into the card — the exact feedback path the real page uses.
const StatefulHost = ({ initial }: { initial: MetadataInput[] }) => {
  const [metadata, setMetadata] = useState<MetadataInput[]>(initial);
  const onChange = (config: SortOrderConfig) => {
    const value = serializeSortConfig(config);

    setMetadata(prev => upsertMetadata(prev, SORTING_ORDER_METADATA_KEY, value));
  };

  return (
    <StrictMode>
      <CollectionSortOrder
        collectionId="c1"
        metadata={metadata}
        disabled={false}
        onChange={onChange}
      />
    </StrictMode>
  );
};

// Reproduces the real page: the collection query resolves AFTER mount, so the
// `metadata` prop starts undefined and only later carries the saved value.
const AsyncHost = () => {
  const [metadata, setMetadata] = useState<MetadataInput[] | undefined>(undefined);
  const load = () =>
    setMetadata([
      {
        key: SORTING_ORDER_METADATA_KEY,
        value: JSON.stringify({
          show_only_tagged_variants: true,
          is_filter_variants: false,
          order: [{ variant: "v1", productid: "p1", sortIndex: 1 }],
        }),
      },
    ]);

  return (
    <>
      <button data-test-id="load-metadata" onClick={load}>
        load
      </button>
      <CollectionSortOrder
        collectionId="c1"
        metadata={metadata}
        disabled={false}
        onChange={() => undefined}
      />
    </>
  );
};

// Reproduces a client-side route change between two collections. React Router
// v5 reuses the CollectionDetails instance (one route, no key), so the card is
// re-rendered with a new id instead of being remounted — exactly what this host
// does. `metadata` is swapped in the same click because the real page keeps
// both in sync via the collection query.
const NavigationHost = ({ onChange }: { onChange: (config: SortOrderConfig) => void }) => {
  const collections: Record<string, MetadataInput[]> = {
    c1: [
      {
        key: SORTING_ORDER_METADATA_KEY,
        value: JSON.stringify({
          show_only_tagged_variants: true,
          is_filter_variants: true,
          order: [{ variant: "v1", productid: "p1", sortIndex: 1, color: "Forged Iron" }],
        }),
      },
    ],
    c2: [],
  };
  const [collectionId, setCollectionId] = useState("c1");

  return (
    <>
      <button data-test-id="navigate" onClick={() => setCollectionId("c2")}>
        go to c2
      </button>
      <CollectionSortOrder
        collectionId={collectionId}
        metadata={collections[collectionId]}
        disabled={false}
        onChange={onChange}
      />
    </>
  );
};

describe("CollectionSortOrder render", () => {
  it("restores flags and pinned order when metadata arrives after mount", () => {
    render(<AsyncHost />, { wrapper: Wrapper });

    // Before metadata loads: flag is FALSE and nothing is pinned.
    expect(screen.getByTestId("show-only-tagged-variants-value")).toHaveTextContent("FALSE");
    expect(screen.getByTestId("show-only-tagged-variants")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.queryAllByRole("checkbox").filter(cb => cb.getAttribute("aria-checked") === "true"),
    ).toHaveLength(0);

    // Act — the collection metadata arrives (query resolved).
    fireEvent.click(screen.getByTestId("load-metadata"));

    // Assert — saved flag and pinned row are now restored.
    expect(screen.getByTestId("show-only-tagged-variants-value")).toHaveTextContent("TRUE");
    expect(screen.getByTestId("show-only-tagged-variants")).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getAllByRole("checkbox").filter(cb => cb.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1);
  });

  it("re-derives rows and flags when the route moves to another collection", () => {
    const onChange = jest.fn();

    render(<NavigationHost onChange={onChange} />, { wrapper: Wrapper });

    // Collection c1: its own rows, its own flags, its own pin.
    expect(screen.getByText("Forged Iron")).toBeInTheDocument();
    expect(screen.getByTestId("show-only-tagged-variants-value")).toHaveTextContent("TRUE");
    expect(screen.getByTestId("is-filter-variants-value")).toHaveTextContent("TRUE");
    expect(screen.getAllByTestId("sortable-variant-row")).toHaveLength(2);

    // Act — navigate to collection c2 without remounting the card.
    fireEvent.click(screen.getByTestId("navigate"));

    // Assert — c1's rows, flags and pins are gone, replaced by c2's.
    expect(screen.queryByText("Forged Iron")).not.toBeInTheDocument();
    expect(screen.getByText("Midnight")).toBeInTheDocument();
    expect(screen.getAllByTestId("sortable-variant-row")).toHaveLength(1);
    expect(screen.getByTestId("show-only-tagged-variants-value")).toHaveTextContent("FALSE");
    expect(screen.getByTestId("is-filter-variants-value")).toHaveTextContent("FALSE");
    expect(
      screen.queryAllByRole("checkbox").filter(cb => cb.getAttribute("aria-checked") === "true"),
    ).toHaveLength(0);
  });

  it("never persists the previous collection's variants after navigating", () => {
    const onChange = jest.fn();

    render(<NavigationHost onChange={onChange} />, { wrapper: Wrapper });

    fireEvent.click(screen.getByTestId("navigate"));

    // Act — the merchant pins a row on the second collection.
    fireEvent.click(screen.getAllByTestId("include-variant")[0]);

    // Assert — what gets saved is c2's variant, never c1's.
    expect(onChange).toHaveBeenCalledTimes(1);

    const config: SortOrderConfig = onChange.mock.calls[0][0];

    expect(config.order).toEqual([
      { variant: "w1", productid: "p2", sortIndex: 1, color: "Midnight" },
    ]);
    // c1's flags must not leak into c2's payload either.
    expect(config.showOnlyTaggedVariants).toBe(false);
    expect(config.isFilterVariants).toBe(false);
  });

  it("renders without crashing (no saved order)", () => {
    render(<StatefulHost initial={[]} />, { wrapper: Wrapper });

    expect(screen.getByTestId("collection-sort-order")).toBeInTheDocument();
  });

  it("renders with a saved order and toggling does not loop", () => {
    render(
      <StatefulHost
        initial={[
          {
            key: SORTING_ORDER_METADATA_KEY,
            value: JSON.stringify([{ variant: "v1", productid: "p1", sortIndex: 1 }]),
          },
        ]}
      />,
      { wrapper: Wrapper },
    );

    const checkboxes = screen.getAllByTestId("include-variant");

    // Act — toggle a row on and off; must not throw "Maximum update depth".
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByTestId("collection-sort-order")).toBeInTheDocument();
  });
});
