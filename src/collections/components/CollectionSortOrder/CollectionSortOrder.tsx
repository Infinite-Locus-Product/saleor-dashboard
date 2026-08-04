import { DashboardCard } from "@dashboard/components/Card";
import { type MetadataInput } from "@dashboard/graphql";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Box, Button, Skeleton, Text, Toggle } from "@saleor/macaw-ui-next";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { SORT_ORDER_MAX_PRODUCTS, SORTING_ORDER_METADATA_KEY } from "./constants";
import { SortableVariantRow } from "./SortableVariantRow";
import { type SortableVariant, type SortOrderConfig, type SortOrderEntry } from "./types";
import { useCollectionSortOrderData } from "./useCollectionSortOrderData";
import {
  applySavedOrder,
  buildSortOrder,
  getMetadataValue,
  parseSortConfig,
  sortByInventory,
} from "./utils";

interface CollectionSortOrderProps {
  collectionId: string | undefined;
  metadata: MetadataInput[] | undefined;
  disabled: boolean;
  onChange: (config: SortOrderConfig) => void;
}

export const CollectionSortOrder = ({
  collectionId,
  metadata,
  disabled,
  onChange,
}: CollectionSortOrderProps) => {
  const intl = useIntl();
  // The product list is loaded on request only: this card is on every Collection
  // detail page, and paging the whole collection on each visit made every
  // merchant pay for a feature most of them never open.
  const [listRequested, setListRequested] = useState(false);
  const { variants, loading, hasError, retry, truncated, stockDataMissing } =
    useCollectionSortOrderData(collectionId, { enabled: listRequested });
  // The rows are on screen and safe to build an order from.
  const listReady = listRequested && !loading && !hasError;
  // The flags stay usable without the list — emit() carries the saved order
  // through untouched. The one moment they must not be touched is before the
  // collection itself has loaded, when we don't yet know what that order is.
  const flagsLocked = disabled || metadata === undefined;

  // The collection this component's state was derived for. React Router v5
  // reuses a single CollectionDetails instance across /collections/A ->
  // /collections/B (one route, no key), so this component is NOT remounted on
  // navigation: the state has to be re-derived when the id changes, or the card
  // would keep showing — and saving — the previous collection's rows.
  const stateCollectionIdRef = useRef<string | undefined>(undefined);
  // Set on the merchant's first edit of the flags / of the list. Tracked apart
  // so that editing one doesn't freeze the other: the flags are usable before
  // the list has loaded, and the list must still seed from the saved order once
  // it arrives. Both cleared whenever the collection changes.
  const flagsEditedRef = useRef(false);
  const listEditedRef = useRef(false);
  // Last order we know is persisted. Used to carry the saved order through
  // untouched when a flag is changed before the rows have loaded — rebuilding it
  // from an unloaded list would save an empty order over the real one.
  const savedOrderRef = useRef<SortOrderEntry[]>([]);
  const [items, setItems] = useState<SortableVariant[]>([]);
  // Which colour rows are included in the storefront order. Only these are
  // written to metadata. Selection persists via the saved order itself.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Collection-level storefront flags, persisted alongside the order.
  const [showOnlyTagged, setShowOnlyTagged] = useState(false);
  const [isFilter, setIsFilter] = useState(false);

  useEffect(() => {
    if (stateCollectionIdRef.current !== collectionId) {
      // Switched collections — discard everything belonging to the previous one
      // and start accepting the new collection's saved config again.
      stateCollectionIdRef.current = collectionId;
      flagsEditedRef.current = false;
      listEditedRef.current = false;
      savedOrderRef.current = [];
      setListRequested(false);
      setItems([]);
      setSelected(new Set());
      setShowOnlyTagged(false);
      setIsFilter(false);
    }

    // `metadata` is undefined until the collection query resolves, and it lags
    // one render behind `collectionId` (useForm syncs it in an effect). So keep
    // re-deriving from it until the merchant edits the card: a value belonging
    // to the previous collection is corrected as soon as the real one arrives,
    // instead of being latched for the lifetime of the component.
    if (metadata === undefined) {
      return;
    }

    const config = parseSortConfig(getMetadataValue(metadata, SORTING_ORDER_METADATA_KEY));

    // Always current, even once the merchant is editing: it is what a flag
    // change has to preserve while the list is unloaded.
    savedOrderRef.current = config.order;

    if (!flagsEditedRef.current) {
      setShowOnlyTagged(config.showOnlyTaggedVariants);
      setIsFilter(config.isFilterVariants);
    }

    if (!listEditedRef.current) {
      setItems(applySavedOrder(variants, config.order));
      setSelected(new Set(config.order.map(entry => entry.variant)));
    }
  }, [collectionId, metadata, variants]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Serialise the selected rows (in on-screen order) plus the current flags.
  const emit = (
    nextItems: SortableVariant[],
    nextSelected: Set<string>,
    flags: { showOnlyTagged: boolean; isFilter: boolean },
  ) => {
    onChange({
      showOnlyTaggedVariants: flags.showOnlyTagged,
      isFilterVariants: flags.isFilter,
      // Only rebuild the order from the rows when they are actually loaded.
      // Otherwise pass the saved order straight through: a flag change must
      // never blank out an order the merchant hasn't even looked at.
      order: listReady
        ? buildSortOrder(nextItems.filter(item => nextSelected.has(item.variantId)))
        : savedOrderRef.current,
    });
  };

  // Editing the list: from here the saved order must not overwrite the screen.
  const emitListChange = (nextItems: SortableVariant[], nextSelected: Set<string>) => {
    listEditedRef.current = true;
    emit(nextItems, nextSelected, { showOnlyTagged, isFilter });
  };

  const handleToggle = (variantId: string) => {
    const next = new Set(selected);

    if (next.has(variantId)) {
      next.delete(variantId);
    } else {
      next.add(variantId);
    }

    setSelected(next);
    emitListChange(items, next);
  };

  const handleShowOnlyTaggedChange = (pressed: boolean) => {
    flagsEditedRef.current = true;
    setShowOnlyTagged(pressed);
    emit(items, selected, { showOnlyTagged: pressed, isFilter });
  };

  const handleIsFilterChange = (pressed: boolean) => {
    flagsEditedRef.current = true;
    setIsFilter(pressed);
    emit(items, selected, { showOnlyTagged, isFilter: pressed });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const moved = arrayMove(items, oldIndex, newIndex);

    setItems(moved);
    emitListChange(moved, selected);
  };

  const handleSortByInventory = () => {
    const sorted = sortByInventory(items);

    setItems(sorted);
    emitListChange(sorted, selected);
  };

  const handleClear = () => {
    const reset = sortByInventory(variants);

    setSelected(new Set());
    setItems(reset);
    // Clear the pinned order but keep the flags — they are separate settings.
    emitListChange(reset, new Set());
  };

  const itemIds = useMemo(() => items.map(item => item.id), [items]);

  return (
    <DashboardCard paddingBottom={4} data-test-id="collection-sort-order">
      <DashboardCard.Header>
        <DashboardCard.Title>
          <FormattedMessage
            id="9E66l6"
            defaultMessage="Storefront sort order"
            description="collection sort order card title"
          />
        </DashboardCard.Title>
        <DashboardCard.Toolbar>
          <Button
            data-test-id="sort-by-inventory"
            variant="secondary"
            disabled={disabled || !listReady || stockDataMissing || items.length === 0}
            onClick={handleSortByInventory}
          >
            <FormattedMessage
              defaultMessage="Sort by inventory"
              id="bUqn+U"
              description="button, sort collection products by available stock"
            />
          </Button>
          <Button
            data-test-id="clear-sort-order"
            variant="secondary"
            disabled={disabled || !listReady || selected.size === 0}
            onClick={handleClear}
          >
            <FormattedMessage
              id="AVRcCR"
              defaultMessage="Clear custom order"
              description="button"
            />
          </Button>
        </DashboardCard.Toolbar>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Box
          display="flex"
          flexDirection="column"
          gap={3}
          marginBottom={4}
          padding={4}
          borderColor="default1"
          borderWidth={1}
          borderStyle="solid"
          borderRadius={3}
          backgroundColor="default1"
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={5}>
            <Box __minWidth="0">
              <Text size={3} display="block">
                <FormattedMessage
                  defaultMessage="Show only tagged variants"
                  id="/t8Lqw"
                  description="collection sort order flag label"
                />
              </Text>
              <Text size={1} color="default2">
                <FormattedMessage
                  defaultMessage="Storefront shows only the pinned variants of this collection."
                  id="7Lo6Es"
                  description="collection sort order flag help"
                />
              </Text>
            </Box>
            <Box display="flex" alignItems="center" gap={3}>
              <Toggle
                data-test-id="show-only-tagged-variants"
                pressed={showOnlyTagged}
                // Usable without loading the list: the order is carried through
                // from metadata, so changing a flag can't blank it out.
                disabled={flagsLocked}
                onPressedChange={handleShowOnlyTaggedChange}
              />
              <Text
                size={2}
                color="default2"
                textAlign="right"
                __minWidth="44px"
                data-test-id="show-only-tagged-variants-value"
              >
                {showOnlyTagged ? "TRUE" : "FALSE"}
              </Text>
            </Box>
          </Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={5}>
            <Box __minWidth="0">
              <Text size={3} display="block">
                <FormattedMessage
                  defaultMessage="Filter variants"
                  id="y9274l"
                  description="collection sort order flag label"
                />
              </Text>
              <Text size={1} color="default2">
                <FormattedMessage
                  defaultMessage="Master switch enabling variant filtering on the storefront."
                  id="CxbkEo"
                  description="collection sort order flag help"
                />
              </Text>
            </Box>
            <Box display="flex" alignItems="center" gap={3}>
              <Toggle
                data-test-id="is-filter-variants"
                pressed={isFilter}
                disabled={flagsLocked}
                onPressedChange={handleIsFilterChange}
              />
              <Text
                size={2}
                color="default2"
                textAlign="right"
                __minWidth="44px"
                data-test-id="is-filter-variants-value"
              >
                {isFilter ? "TRUE" : "FALSE"}
              </Text>
            </Box>
          </Box>
        </Box>

        <Text size={2} color="default2" display="block" marginBottom={4}>
          <FormattedMessage
            defaultMessage="Tick the colours you want to pin, then drag to set their order on the storefront. Unticked rows aren't saved and just sort after. Each row is one colour of a product; changes are saved with the collection."
            id="Cmyt1W"
            description="collection sort order help text"
          />
        </Text>

        {!listRequested ? (
          // Nothing is fetched until asked for. Paging a whole collection on
          // every Collection detail visit made every merchant pay for a card
          // most of them never open.
          <Box
            data-test-id="sort-order-idle"
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={3}
            paddingY={6}
          >
            <Text size={2} color="default2" textAlign="center">
              <FormattedMessage
                defaultMessage="Products aren't loaded yet. The flags above can be changed without loading them."
                id="RUWWvd"
                description="collection sort order idle state"
              />
            </Text>
            <Button
              data-test-id="load-sort-order"
              variant="secondary"
              disabled={disabled || !collectionId}
              onClick={() => setListRequested(true)}
            >
              <FormattedMessage
                defaultMessage="Load products to reorder"
                id="pRd7W9"
                description="button, load collection products for sorting"
              />
            </Button>
          </Box>
        ) : loading ? (
          <Box display="flex" flexDirection="column" gap={2}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} height={8} />
            ))}
          </Box>
        ) : hasError ? (
          // Checked before the empty state: a failed load also leaves `items`
          // empty, and telling a merchant their collection is empty when we
          // simply could not read it is worse than saying nothing.
          <Box
            data-test-id="sort-order-error"
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={3}
            paddingY={6}
          >
            <Text size={2} color="default2" textAlign="center">
              <FormattedMessage
                defaultMessage="Couldn't load this collection's products, so the storefront order can't be edited right now."
                id="fblzrM"
                description="collection sort order error state"
              />
            </Text>
            <Button data-test-id="retry-sort-order" variant="secondary" onClick={retry}>
              <FormattedMessage
                defaultMessage="Try again"
                id="UoACX9"
                description="button, retry loading collection sort order"
              />
            </Button>
          </Box>
        ) : items.length === 0 ? (
          <Text
            data-test-id="sort-order-empty"
            size={2}
            color="default2"
            textAlign="center"
            display="block"
            paddingY={6}
          >
            <FormattedMessage
              defaultMessage="No products in this collection yet"
              id="RaZPbP"
              description="collection sort order empty state"
            />
          </Text>
        ) : (
          <>
            {stockDataMissing && (
              // Every availableQty defaulted to 0 because stock didn't resolve.
              // Sorting by it would look authoritative and be arbitrary.
              <Text
                data-test-id="sort-order-stock-missing"
                size={2}
                color="critical1"
                display="block"
                marginBottom={3}
              >
                <FormattedMessage
                  defaultMessage="Stock levels couldn't be read, so quantities are hidden and sorting by inventory is unavailable."
                  id="8TV3SO"
                  description="collection sort order missing stock notice"
                />
              </Text>
            )}
            {truncated && (
              // Say it out loud. A silently partial list would let a merchant
              // reorder what they can see and believe the rest is ordered too.
              <Text
                data-test-id="sort-order-truncated"
                size={2}
                color="critical1"
                display="block"
                marginBottom={3}
              >
                {intl.formatMessage(
                  {
                    defaultMessage:
                      "This collection is too large to sort here — showing the first {count} products only.",
                    id: "QS7cjf",
                    description: "collection sort order truncation notice",
                  },
                  { count: SORT_ORDER_MAX_PRODUCTS },
                )}
              </Text>
            )}
            <Box
              borderColor="default1"
              borderWidth={1}
              borderStyle="solid"
              borderRadius={3}
              overflowY="auto"
              __maxHeight="480px"
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  {(() => {
                    let pinNo = 0;

                    return items.map(variant => {
                      const isSelected = selected.has(variant.variantId);

                      return (
                        <SortableVariantRow
                          key={variant.id}
                          variant={variant}
                          position={isSelected ? (pinNo += 1) : null}
                          showStock={!stockDataMissing}
                          selected={isSelected}
                          disabled={disabled}
                          onToggle={handleToggle}
                        />
                      );
                    });
                  })()}
                </SortableContext>
              </DndContext>
            </Box>
          </>
        )}

        <Text size={1} color="default2" display="block" marginTop={3}>
          {intl.formatMessage(
            {
              defaultMessage: "{selected} of {total} pinned",
              id: "yMhDl4",
              description: "collection sort order pinned count",
            },
            { selected: selected.size, total: items.length },
          )}
        </Text>
      </DashboardCard.Content>
    </DashboardCard>
  );
};

CollectionSortOrder.displayName = "CollectionSortOrder";
