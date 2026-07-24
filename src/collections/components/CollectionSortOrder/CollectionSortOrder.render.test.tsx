import { type MetadataInput } from "@dashboard/graphql";
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";

import { CollectionSortOrder } from "./CollectionSortOrder";
import { SORTING_ORDER_METADATA_KEY } from "./constants";
import { type SortOrderConfig } from "./types";
import { serializeSortConfig, upsertMetadata } from "./utils";

jest.mock("./useCollectionSortOrderData", () => {
  // Stable reference across renders — mirrors the real hook's useState.
  const variants = [
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
  ];

  return { useCollectionSortOrderData: () => ({ loading: false, variants }) };
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
