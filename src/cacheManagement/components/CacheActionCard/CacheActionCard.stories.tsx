import { getCacheEndpointById } from "@dashboard/cacheManagement/config/endpoints";
import { type CacheEndpointConfig } from "@dashboard/cacheManagement/types";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { CacheActionCard } from "./CacheActionCard";

const requireEndpoint = (id: string): CacheEndpointConfig => {
  const endpoint = getCacheEndpointById(id);

  if (!endpoint) throw new Error(`Unknown endpoint "${id}"`);

  return endpoint;
};

const meta: Meta<typeof CacheActionCard> = {
  title: "Cache Management/CacheActionCard",
  component: CacheActionCard,
  args: {
    endpoint: requireEndpoint("pdp-slugs"),
  },
  argTypes: {
    endpoint: { table: { disable: true } },
  },
};

export default meta;

type Story = StoryObj<typeof CacheActionCard>;

/** One-click GET card — no form, no confirmation. */
export const SimpleAction: Story = {};

/** Admin badge plus a destructive confirmation gate. */
export const DestructiveAdminAction: Story = {
  args: {
    endpoint: requireEndpoint("inventory-full-seed"),
  },
};

/** Renders a textarea from the field schema. */
export const WithIdListPayload: Story = {
  args: {
    endpoint: requireEndpoint("inventory-targeted-seed"),
  },
};

/** Query-param endpoint — values go on the URL, not in a body. */
export const WithQueryParams: Story = {
  args: {
    endpoint: requireEndpoint("tagbox-data-delete"),
  },
};

/** Fixed-value enum restricted to the approved prefixes. */
export const WithEnumSelect: Story = {
  args: {
    endpoint: requireEndpoint("clear-cache-by-prefix"),
  },
};
