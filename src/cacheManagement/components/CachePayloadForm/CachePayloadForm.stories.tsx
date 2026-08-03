import { getCacheEndpointById } from "@dashboard/cacheManagement/config/endpoints";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { CachePayloadForm } from "./CachePayloadForm";

const taggboxFields = getCacheEndpointById("tagbox-data-delete")?.fields ?? [];
const prefixFields = getCacheEndpointById("clear-cache-by-prefix")?.fields ?? [];
const idListFields = getCacheEndpointById("inventory-targeted-seed")?.fields ?? [];

const meta: Meta<typeof CachePayloadForm> = {
  title: "Cache Management/CachePayloadForm",
  component: CachePayloadForm,
  args: {
    fields: taggboxFields,
    values: {},
    errors: {},
    onChange: fn(),
  },
  argTypes: {
    onChange: { table: { disable: true } },
  },
};

export default meta;

type Story = StoryObj<typeof CachePayloadForm>;

export const QueryParams: Story = {};

export const WithValidationErrors: Story = {
  args: {
    values: { galleryId: "g-1", feedId: "", postId: "" },
    errors: { feedId: "required", postId: "required" },
  },
};

export const EnumSelect: Story = {
  args: {
    fields: prefixFields,
    values: { cache_key_prefix: "preorder" },
  },
};

export const IdList: Story = {
  args: {
    fields: idListFields,
    values: { variantIds: "UHJvZHVjdFZhcmlhbnQ6MTIz\nUHJvZHVjdFZhcmlhbnQ6NDU2" },
  },
};

export const Disabled: Story = {
  args: {
    fields: idListFields,
    values: { variantIds: "UHJvZHVjdFZhcmlhbnQ6MTIz" },
    disabled: true,
  },
};
