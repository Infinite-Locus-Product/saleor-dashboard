import { type CampaignStatus, type FunnelStage } from "@dashboard/cohorts/types";
import { defineMessages, type MessageDescriptor } from "react-intl";

// User-facing copy for the Campaigns section (TTXY-4841).
export const campaignMessages = defineMessages({
  listTitle: {
    defaultMessage: "Campaigns",
    id: "XSVtOi",
    description: "campaign list page title",
  },
  colCampaign: { defaultMessage: "Campaign", id: "qMyyGh", description: "campaign column id" },
  colVoucher: {
    defaultMessage: "Voucher code",
    id: "yer9FS",
    description: "campaign column voucher code",
  },
  colCohort: { defaultMessage: "Cohort", id: "5YItCr", description: "campaign column cohort" },
  colWindow: {
    defaultMessage: "Window (IST)",
    id: "o28CST",
    description: "campaign column window",
  },
  colStatus: { defaultMessage: "Status", id: "2jdrNz", description: "campaign column status" },
  colRecipients: {
    defaultMessage: "Recipients",
    id: "Dwk2UZ",
    description: "campaign column recipients",
  },
  colSent: { defaultMessage: "Sent", id: "xZbLMJ", description: "campaign column sent" },
  colHoldout: { defaultMessage: "Holdout", id: "LRjdcN", description: "campaign column holdout" },
  allStatuses: {
    defaultMessage: "All statuses",
    id: "WL8GYd",
    description: "campaign status filter, any",
  },
  statusFilterLabel: {
    defaultMessage: "Status",
    id: "p6SvBk",
    description: "campaign status filter label",
  },
  statusOpen: { defaultMessage: "Open", id: "CluK8r", description: "campaign status open" },
  statusBlocked: {
    defaultMessage: "Blocked",
    id: "n/y72M",
    description: "campaign status blocked",
  },
  statusClosed: { defaultMessage: "Closed", id: "WnozCC", description: "campaign status closed" },
  campaignNumber: {
    defaultMessage: "Campaign #{id}",
    id: "xQ9IhI",
    description: "campaign title with its id",
  },
  empty: {
    defaultMessage:
      "No campaigns yet. A campaign starts when a cohort-restricted voucher's window opens.",
    id: "YFS2B+",
    description: "campaign list empty state",
  },
  loading: { defaultMessage: "Loading…", id: "nV0ZwM", description: "campaign page loading" },
  countLabel: {
    defaultMessage: "{count} campaigns",
    id: "twpPZm",
    description: "campaign list total count",
  },
  previous: {
    defaultMessage: "Previous",
    id: "2FOYGw",
    description: "campaign list previous page",
  },
  next: { defaultMessage: "Next", id: "y42U57", description: "campaign list next page" },
  openEnded: {
    defaultMessage: "no end",
    id: "sYS3x+",
    description: "campaign window without an end",
  },
  summaryTitle: {
    defaultMessage: "Campaign",
    id: "u1tcSr",
    description: "campaign summary card title",
  },
  blockedReason: {
    defaultMessage: "Blocked: {reason}",
    id: "coyV3L",
    description: "campaign blocked reason",
  },
  funnelTitle: {
    defaultMessage: "Funnel: messaged vs holdout",
    id: "ilgyQZ",
    description: "campaign funnel card title",
  },
  funnelHelp: {
    defaultMessage:
      "Holdout members are in the cohort but get no message, so the difference between the groups is the campaign's effect. Conversion is from the previous tracked stage.",
    id: "3JUnf1",
    description: "campaign funnel card help text",
  },
  colStage: { defaultMessage: "Stage", id: "KS1RkT", description: "funnel column stage" },
  colMessaged: {
    defaultMessage: "Messaged",
    id: "jZvCqf",
    description: "funnel column messaged count",
  },
  colMessagedConversion: {
    defaultMessage: "Messaged conversion",
    id: "4mIXF3",
    description: "funnel column messaged conversion",
  },
  colHoldoutCount: {
    defaultMessage: "Holdout",
    id: "VHzwQ4",
    description: "funnel column holdout count",
  },
  colHoldoutConversion: {
    defaultMessage: "Holdout conversion",
    id: "CcN/ca",
    description: "funnel column holdout conversion",
  },
  groupSize: { defaultMessage: "Group size", id: "MP1HCg", description: "funnel row group size" },
  groupGmv: { defaultMessage: "GMV", id: "nd5FIw", description: "funnel row group GMV" },
  notTracked: {
    defaultMessage: "Not tracked",
    id: "YLmQi5",
    description: "funnel stage that is not tracked or not applicable",
  },
  notAvailable: {
    defaultMessage: "Not available",
    id: "8ex57r",
    description: "campaign metric that cannot be computed yet (e.g. an empty group)",
  },
  metricsTitle: {
    defaultMessage: "Results",
    id: "e4Ojpo",
    description: "campaign metrics card title",
  },
  purchaseLift: {
    defaultMessage: "Purchase lift (messaged − holdout)",
    id: "L4d2KJ",
    description: "campaign metric purchase lift",
  },
  repeatLift: {
    defaultMessage: "Repeat lift (messaged − holdout)",
    id: "UtY3qO",
    description: "campaign metric repeat lift",
  },
  reactivationRate: {
    defaultMessage: "Reactivation (dormant members who ordered)",
    id: "YR7fog",
    description: "campaign metric reactivation rate",
  },
  redemptionRate: {
    defaultMessage: "Redemption (orders with the code ÷ sent)",
    id: "UofnMZ",
    description: "campaign metric redemption rate",
  },
  incrementalGmv: {
    defaultMessage: "Incremental GMV",
    id: "P5JLpY",
    description: "campaign metric incremental GMV",
  },
  exportCsv: {
    defaultMessage: "Export CSV",
    id: "Zmta2y",
    description: "campaign funnel CSV export button",
  },
  exporting: {
    defaultMessage: "Exporting…",
    id: "cykXlN",
    description: "campaign funnel CSV export running",
  },
});

export const campaignStatusMessages: Record<CampaignStatus, MessageDescriptor> = {
  open: campaignMessages.statusOpen,
  blocked: campaignMessages.statusBlocked,
  closed: campaignMessages.statusClosed,
};

export const funnelStageMessages: Record<FunnelStage, MessageDescriptor> = defineMessages({
  tagged: { defaultMessage: "1 Tagged", id: "7SmOWi", description: "funnel stage 1" },
  sent: { defaultMessage: "2 Sent", id: "rktjBY", description: "funnel stage 2" },
  delivered: { defaultMessage: "3 Delivered", id: "iWMVOJ", description: "funnel stage 3" },
  clicked: { defaultMessage: "4 Clicked", id: "WnpT63", description: "funnel stage 4" },
  added_to_cart: { defaultMessage: "5 Added to cart", id: "PaiySq", description: "funnel stage 5" },
  code_entered: { defaultMessage: "6 Code entered", id: "DAWz1l", description: "funnel stage 6" },
  applied: { defaultMessage: "7 Applied", id: "mrUPdq", description: "funnel stage 7" },
  order_placed: { defaultMessage: "8 Order placed", id: "10GBDW", description: "funnel stage 8" },
  repeat_order: { defaultMessage: "9 Repeat order", id: "t0x21/", description: "funnel stage 9" },
});
