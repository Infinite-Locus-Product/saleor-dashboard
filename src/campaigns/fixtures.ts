// Campaign API fixtures (LLD §4.4, §4.5) shared by the campaign tests and stories.
import { type CampaignFunnel, type CampaignSummary } from "@dashboard/cohorts/types";

export const campaignSummaryFixture = (over: Partial<CampaignSummary> = {}): CampaignSummary => ({
  id: 31,
  voucher_code: "LAPSED20",
  cohort_id: 3,
  cohort_name: "Lapsed buyers",
  start_time: "2026-11-10T04:30:00Z",
  end_time: "2026-11-20T18:29:00Z",
  status: "open",
  blocked_reason: null,
  recipients: 1000,
  sent: 880,
  holdout: 100,
  ...over,
});

/** The LLD §4.5 example payload. */
export const campaignFunnelFixture = (over: Partial<CampaignFunnel> = {}): CampaignFunnel => ({
  campaign: campaignSummaryFixture(),
  groups: {
    messaged: {
      size: 900,
      stages: {
        tagged: 900,
        sent: 880,
        delivered: null,
        clicked: 120,
        added_to_cart: 60,
        code_entered: 45,
        applied: 40,
        order_placed: 38,
        repeat_order: 9,
      },
      gmv: 45600,
    },
    holdout: {
      size: 100,
      stages: {
        tagged: 100,
        sent: null,
        delivered: null,
        clicked: null,
        added_to_cart: 4,
        code_entered: 1,
        applied: 1,
        order_placed: 2,
        repeat_order: 0,
      },
      gmv: 2100,
    },
  },
  metrics: {
    purchase_lift: 0.0222,
    repeat_lift: 0.01,
    reactivation_rate: 0.05,
    redemption_rate: 0.0455,
    incremental_gmv: 26100,
  },
  tracked: { delivered: false, clicked: true },
  ...over,
});
