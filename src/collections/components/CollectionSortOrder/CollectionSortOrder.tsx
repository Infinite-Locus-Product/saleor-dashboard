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

import { SORTING_ORDER_METADATA_KEY } from "./constants";
import { SortableVariantRow } from "./SortableVariantRow";
import { type SortableVariant, type SortOrderConfig } from "./types";
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
  const { variants, loading } = useCollectionSortOrderData(collectionId);

  // The collection this component's state was derived for. React Router v5
  // reuses a single CollectionDetails instance across /collections/A ->
  // /collections/B (one route, no key), so this component is NOT remounted on
  // navigation: the state has to be re-derived when the id changes, or the card
  // would keep showing — and saving — the previous collection's rows.
  const stateCollectionIdRef = useRef<string | undefined>(undefined);
  // Set on the merchant's first edit of this collection's card. From then on the
  // `metadata` prop (which our own edits flow back through) must not overwrite
  // what is on screen. Cleared whenever the collection changes.
  const editedRef = useRef(false);
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
      editedRef.current = false;
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
    if (metadata === undefined || editedRef.current) {
      return;
    }

    const config = parseSortConfig(getMetadataValue(metadata, SORTING_ORDER_METADATA_KEY));

    setShowOnlyTagged(config.showOnlyTaggedVariants);
    setIsFilter(config.isFilterVariants);
    setItems(applySavedOrder(variants, config.order));
    setSelected(new Set(config.order.map(entry => entry.variant)));
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
    // From here on the on-screen state is the merchant's, not the saved one.
    editedRef.current = true;
    onChange({
      showOnlyTaggedVariants: flags.showOnlyTagged,
      isFilterVariants: flags.isFilter,
      order: buildSortOrder(nextItems.filter(item => nextSelected.has(item.variantId))),
    });
  };

  const handleToggle = (variantId: string) => {
    const next = new Set(selected);

    if (next.has(variantId)) {
      next.delete(variantId);
    } else {
      next.add(variantId);
    }

    setSelected(next);
    emit(items, next, { showOnlyTagged, isFilter });
  };

  const handleShowOnlyTaggedChange = (pressed: boolean) => {
    setShowOnlyTagged(pressed);
    emit(items, selected, { showOnlyTagged: pressed, isFilter });
  };

  const handleIsFilterChange = (pressed: boolean) => {
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
    emit(moved, selected, { showOnlyTagged, isFilter });
  };

  const handleSortByInventory = () => {
    const sorted = sortByInventory(items);

    setItems(sorted);
    emit(sorted, selected, { showOnlyTagged, isFilter });
  };

  const handleClear = () => {
    const reset = sortByInventory(variants);

    setSelected(new Set());
    setItems(reset);
    // Clear the pinned order but keep the flags — they are separate settings.
    emit(reset, new Set(), { showOnlyTagged, isFilter });
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
            disabled={disabled || loading || items.length === 0}
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
            disabled={disabled || selected.size === 0}
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
                // Locked while the rows load: emitting now would persist an
                // order built from an empty (or not-yet-swapped) variant list.
                disabled={disabled || loading}
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
                disabled={disabled || loading}
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

        {loading ? (
          <Box display="flex" flexDirection="column" gap={2}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} height={8} />
            ))}
          </Box>
        ) : items.length === 0 ? (
          <Text size={2} color="default2" textAlign="center" display="block" paddingY={6}>
            <FormattedMessage
              defaultMessage="No products in this collection yet"
              id="RaZPbP"
              description="collection sort order empty state"
            />
          </Text>
        ) : (
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
