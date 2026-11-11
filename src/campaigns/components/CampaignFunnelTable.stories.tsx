import type { Meta, StoryObj } from "@storybook/react-vite";

import { campaignFunnelFixture } from "../fixtures";
import { buildFunnelRows } from "../funnel";
import { CampaignFunnelTable } from "./CampaignFunnelTable";

const funnel = campaignFunnelFixture();

const meta: Meta<typeof CampaignFunnelTable> = {
  title: "Campaigns/CampaignFunnelTable",
  component: CampaignFunnelTable,
};

export default meta;

type Story = StoryObj<typeof CampaignFunnelTable>;

// LLD §4.5 example: delivered is not tracked (L10) and shows "Not tracked".
export const MessagedVsHoldout: Story = {
  args: { rows: buildFunnelRows(funnel), groups: funnel.groups },
};
