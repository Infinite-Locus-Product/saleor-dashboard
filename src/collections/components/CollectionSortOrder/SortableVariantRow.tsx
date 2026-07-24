import { EmptyImage } from "@dashboard/components/EmptyImage";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Box, Checkbox, Text } from "@saleor/macaw-ui-next";
import { GripVertical } from "lucide-react";
import { FormattedMessage } from "react-intl";

import { type SortableVariant } from "./types";

interface SortableVariantRowProps {
  variant: SortableVariant;
  /** Position among the selected rows (1-based), or null when not included. */
  position: number | null;
  selected: boolean;
  disabled: boolean;
  onToggle: (variantId: string) => void;
}

export const SortableVariantRow = ({
  variant,
  position,
  selected,
  disabled,
  onToggle,
}: SortableVariantRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } =
    useSortable({ id: variant.id, disabled: disabled || !selected });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      data-test-id="sortable-variant-row"
      display="flex"
      alignItems="center"
      gap={3}
      paddingX={4}
      paddingY={2}
      borderBottomWidth={1}
      borderBottomStyle="solid"
      borderColor="default1"
      backgroundColor={isDragging ? "default1Hovered" : "default1"}
      __opacity={isDragging ? 0.6 : selected ? 1 : 0.5}
    >
      <Box display="flex" alignItems="center">
        <Checkbox
          data-test-id="include-variant"
          checked={selected}
          disabled={disabled}
          onCheckedChange={() => onToggle(variant.variantId)}
        />
      </Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="default2"
        __cursor={disabled || !selected ? "not-allowed" : isSorting ? "grabbing" : "grab"}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </Box>
      <Text size={2} color="default2" __minWidth="28px" textAlign="right">
        {position ?? ""}
      </Text>
      {variant.thumbnailUrl ? (
        <Box borderColor="default1" borderWidth={1} borderRadius={2} borderStyle="solid">
          <Box
            as="img"
            src={variant.thumbnailUrl}
            alt={variant.productName}
            __width="31px"
            __height="31px"
          />
        </Box>
      ) : (
        <EmptyImage />
      )}
      <Box display="flex" flexDirection="column" __minWidth="0" flexGrow="1">
        <Text size={3} ellipsis>
          {variant.productName}
        </Text>
        <Text size={2} color="default2" ellipsis>
          {variant.colorName}
        </Text>
      </Box>
      <Box display="flex" flexDirection="column" alignItems="flex-end" __minWidth="72px">
        <Text size={3} style={{ fontVariantNumeric: "tabular-nums" }}>
          {variant.availableQty.toLocaleString()}
        </Text>
        <Text size={1} color="default2">
          <FormattedMessage
            defaultMessage="in stock"
            id="hRDeBH"
            description="collection sort order variant availability label"
          />
        </Text>
      </Box>
    </Box>
  );
};
