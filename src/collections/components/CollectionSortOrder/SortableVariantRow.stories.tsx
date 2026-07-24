import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Box } from "@saleor/macaw-ui-next";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ComponentType } from "react";
import { fn } from "storybook/test";

import { SortableVariantRow } from "./SortableVariantRow";
import { type SortableVariant } from "./types";

const variant: SortableVariant = {
  id: "UHJvZHVjdFZhcmlhbnQ6MTE2OA==",
  variantId: "UHJvZHVjdFZhcmlhbnQ6MTE2OA==",
  productId: "UHJvZHVjdDoyMzI=",
  productName: "Women’s Flex Collective Training Tee",
  colorName: "Forged Iron",
  thumbnailUrl: null,
  availableQty: 1150,
};

const withSortableContext = (Story: ComponentType) => (
  <DndContext>
    <SortableContext items={[variant.id]} strategy={verticalListSortingStrategy}>
      <Box borderColor="default1" borderWidth={1} borderStyle="solid" borderRadius={3}>
        <Story />
      </Box>
    </SortableContext>
  </DndContext>
);

const meta: Meta<typeof SortableVariantRow> = {
  title: "Collections/CollectionSortOrder/SortableVariantRow",
  component: SortableVariantRow,
  decorators: [withSortableContext],
  args: {
    variant,
    position: 1,
    selected: true,
    disabled: false,
    onToggle: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SortableVariantRow>;

export const Default: Story = {};

export const NotSelected: Story = {
  args: {
    selected: false,
    position: null,
  },
};

export const OtherColor: Story = {
  args: {
    variant: { ...variant, colorName: "Peony Pink" },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
