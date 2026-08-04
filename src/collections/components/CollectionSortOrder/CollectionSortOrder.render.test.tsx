import { type MetadataInput } from "@dashboard/graphql";
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useEffect, useState } from "react";

import { CollectionSortOrder } from "./CollectionSortOrder";
import { SORTING_ORDER_METADATA_KEY } from "./constants";
import { type SortableVariant, type SortOrderConfig } from "./types";
import { useCollectionSortOrderData } from "./useCollectionSortOrderData";
import { serializeSortConfig, upsertMetadata } from "./utils";

jest.mock("./useCollectionSortOrderData", () => ({
  useCollectionSortOrderData: jest.fn(),
}));

// Module-scope constants: the component's seeding effect depends on `variants`,
// so the hook must return the SAME array reference across renders (as the real
// one does, holding it in state) or the effect would re-run forever.
const NO_VARIANTS: SortableVariant[] = [];
const variantsByCollection: Record<string, SortableVariant[]> = {
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

const mockedHook = useCollectionSortOrderData as jest.MockedFunction<
  typeof useCollectionSortOrderData
>;

// The list is only fetched once requested, so tests that need rows must click
// "Load products to reorder" first — same as a merchant would.
const loadList = () => fireEvent.click(screen.getByTestId("load-sort-order"));

beforeEach(() => {
  mockedHook.mockImplementation((collectionId?: string, options?: { enabled: boolean }) => ({
    loading: false,
    hasError: false,
    truncated: false,
    stockDataMissing: false,
    retry: jest.fn(),
    variants:
      options?.enabled && collectionId
        ? (variantsByCollection[collectionId] ?? NO_VARIANTS)
        : NO_VARIANTS,
  }));
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
const collectionsMetadata: Record<string, MetadataInput[]> = {
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

const NavigationHost = ({ onChange }: { onChange: (config: SortOrderConfig) => void }) => {
  const collections = collectionsMetadata;
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

// The metadata prop does NOT change in the same render as collectionId: the page
// derives it through useForm -> useStateFromProps, which syncs in an effect. So
// there is exactly one render carrying the new collection's id together with the
// PREVIOUS collection's metadata. Any fix that reads the saved config only once
// per mount — including a `key={collection?.id}` remount — latches that stale
// value permanently, which is why the reset lives inside the component.
const LaggingHost = ({ onChange }: { onChange: (config: SortOrderConfig) => void }) => {
  const [collectionId, setCollectionId] = useState("c1");
  const [metadata, setMetadata] = useState<MetadataInput[]>(collectionsMetadata.c1);

  useEffect(() => {
    setMetadata(collectionsMetadata[collectionId]);
  }, [collectionId]);

  return (
    <>
      <button data-test-id="navigate" onClick={() => setCollectionId("c2")}>
        go to c2
      </button>
      <CollectionSortOrder
        collectionId={collectionId}
        metadata={metadata}
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

    // Act — the collection metadata arrives (query resolved), and the merchant
    // asks for the product list.
    fireEvent.click(screen.getByTestId("load-metadata"));
    loadList();

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
    loadList();

    // Collection c1: its own rows, its own flags, its own pin.
    expect(screen.getByText("Forged Iron")).toBeInTheDocument();
    expect(screen.getByTestId("show-only-tagged-variants-value")).toHaveTextContent("TRUE");
    expect(screen.getByTestId("is-filter-variants-value")).toHaveTextContent("TRUE");
    expect(screen.getAllByTestId("sortable-variant-row")).toHaveLength(2);

    // Act — navigate to collection c2 without remounting the card.
    fireEvent.click(screen.getByTestId("navigate"));
    loadList();

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
    loadList();

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

  it("recovers when metadata arrives a render after the collection id changes", () => {
    const onChange = jest.fn();

    render(<LaggingHost onChange={onChange} />, { wrapper: Wrapper });
    loadList();

    expect(screen.getByTestId("show-only-tagged-variants-value")).toHaveTextContent("TRUE");

    // Act — navigate; for one render the card sees c2's id with c1's metadata.
    fireEvent.click(screen.getByTestId("navigate"));
    loadList();

    // Assert — the stale config is not latched: c2's own (empty) config wins.
    expect(screen.getByTestId("show-only-tagged-variants-value")).toHaveTextContent("FALSE");
    expect(screen.getByTestId("is-filter-variants-value")).toHaveTextContent("FALSE");
    expect(screen.getByText("Midnight")).toBeInTheDocument();
    expect(screen.queryByText("Forged Iron")).not.toBeInTheDocument();

    // And an edit persists c2's variant with c2's flags, not c1's.
    fireEvent.click(screen.getAllByTestId("include-variant")[0]);

    const config: SortOrderConfig = onChange.mock.calls[0][0];

    expect(config.order).toEqual([
      { variant: "w1", productid: "p2", sortIndex: 1, color: "Midnight" },
    ]);
    expect(config.showOnlyTaggedVariants).toBe(false);
    expect(config.isFilterVariants).toBe(false);
  });

  it("shows a failed load as an error, not as an empty collection", () => {
    const retry = jest.fn();

    mockedHook.mockImplementation(() => ({
      loading: false,
      hasError: true,
      truncated: false,
      stockDataMissing: false,
      retry,
      variants: NO_VARIANTS,
    }));

    render(<StatefulHost initial={[]} />, { wrapper: Wrapper });
    loadList();

    // The merchant is told the load failed — never that the collection is empty.
    expect(screen.getByTestId("sort-order-error")).toBeInTheDocument();
    expect(screen.queryByTestId("sort-order-empty")).not.toBeInTheDocument();

    // Act — the retry button re-runs the load.
    fireEvent.click(screen.getByTestId("retry-sort-order"));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state only when the load succeeded with no products", () => {
    mockedHook.mockImplementation(() => ({
      loading: false,
      hasError: false,
      truncated: false,
      stockDataMissing: false,
      retry: jest.fn(),
      variants: NO_VARIANTS,
    }));

    render(<StatefulHost initial={[]} />, { wrapper: Wrapper });
    loadList();

    expect(screen.getByTestId("sort-order-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("sort-order-error")).not.toBeInTheDocument();
    // A genuinely empty collection can still have its flags set.
    expect(screen.getByTestId("show-only-tagged-variants")).not.toBeDisabled();
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

    loadList();

    const checkboxes = screen.getAllByTestId("include-variant");

    // Act — toggle a row on and off; must not throw "Maximum update depth".
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByTestId("collection-sort-order")).toBeInTheDocument();
  });

  it("fetches nothing until the merchant asks for the list", () => {
    render(<StatefulHost initial={[]} />, { wrapper: Wrapper });

    // The card is on every Collection detail page, so it must start inert.
    expect(screen.getByTestId("sort-order-idle")).toBeInTheDocument();
    expect(screen.queryAllByTestId("sortable-variant-row")).toHaveLength(0);
    expect(mockedHook).toHaveBeenCalledWith("c1", { enabled: false });

    // Act — the merchant opens the list.
    loadList();

    expect(mockedHook).toHaveBeenLastCalledWith("c1", { enabled: true });
    expect(screen.queryByTestId("sort-order-idle")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("sortable-variant-row")).toHaveLength(2);
  });

  it("keeps the saved order when a flag is changed before the list is loaded", () => {
    const onChange = jest.fn();
    const savedOrder = [
      { variant: "v1", productid: "p1", sortIndex: 1, color: "Forged Iron" },
      { variant: "v2", productid: "p1", sortIndex: 2, color: "Peony Pink" },
    ];

    render(
      <CollectionSortOrder
        collectionId="c1"
        metadata={[
          {
            key: SORTING_ORDER_METADATA_KEY,
            value: JSON.stringify({
              show_only_tagged_variants: false,
              is_filter_variants: false,
              order: savedOrder,
            }),
          },
        ]}
        disabled={false}
        onChange={onChange}
      />,
      { wrapper: Wrapper },
    );

    // Act — flip a flag without ever loading the products.
    fireEvent.click(screen.getByTestId("show-only-tagged-variants"));

    // Assert — the flag changed, and the order was carried through untouched
    // rather than rebuilt from an empty on-screen list.
    const config: SortOrderConfig = onChange.mock.calls[0][0];

    expect(config.showOnlyTaggedVariants).toBe(true);
    expect(config.order).toEqual(savedOrder);
  });

  it("discloses when the collection is too large to load fully", () => {
    mockedHook.mockImplementation((collectionId?: string, options?: { enabled: boolean }) => ({
      loading: false,
      hasError: false,
      truncated: true,
      stockDataMissing: false,
      retry: jest.fn(),
      variants:
        options?.enabled && collectionId
          ? (variantsByCollection[collectionId] ?? NO_VARIANTS)
          : NO_VARIANTS,
    }));

    render(<StatefulHost initial={[]} />, { wrapper: Wrapper });
    loadList();

    // Silently showing a partial list would let a merchant believe they had
    // ordered the whole collection.
    expect(screen.getByTestId("sort-order-truncated")).toBeInTheDocument();
    expect(screen.getAllByTestId("sortable-variant-row")).toHaveLength(2);
  });
  it("hides stock numbers and inventory sort when stock couldn't be read", () => {
    mockedHook.mockImplementation((collectionId?: string, options?: { enabled: boolean }) => ({
      loading: false,
      hasError: false,
      truncated: false,
      // Field-level error on `stocks`: every availableQty defaulted to 0.
      stockDataMissing: true,
      retry: jest.fn(),
      variants:
        options?.enabled && collectionId
          ? (variantsByCollection[collectionId] ?? NO_VARIANTS)
          : NO_VARIANTS,
    }));

    render(<StatefulHost initial={[]} />, { wrapper: Wrapper });
    loadList();

    // The merchant is told, rather than shown a confident "0 in stock".
    expect(screen.getByTestId("sort-order-stock-missing")).toBeInTheDocument();
    expect(screen.queryByText("1,150")).not.toBeInTheDocument();
    // Sorting by a quantity we don't have would look authoritative and be arbitrary.
    expect(screen.getByTestId("sort-by-inventory")).toBeDisabled();
  });
});
