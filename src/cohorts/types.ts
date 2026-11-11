// Cohort types (TTXY-4705). Hand-written: this section talks to the TenexuBackend
// REST API, so there is no GraphQL codegen for these shapes.
// Source of truth: TenexuBackend docs/cohort-engine/LLD.md §3–§4.

export type CohortType = "static" | "dynamic";

export interface Cohort {
  id: number;
  cohort_code: string | null;
  cohort_name: string;
  description: string | null;
  type: CohortType;
  status: boolean;
  created_date: string;
  end_date: string | null;
  message_batch_size: number;
  sync_frequency_hours: number;
  member_count: number;
  /** Moves only on a fully successful sync (TTXY-6196). */
  last_synced_at: string | null;
  last_sync_status: CohortSyncStatus | null;
  last_sync_attempt_at: string | null;
  last_sync_error: string | null;
  /** Phase 2 (TTXY-4841) — the rule tree of a dynamic cohort; null/absent for static. */
  rules?: RuleGroup | null;
}

export type CohortSyncStatus = "success" | "partial" | "failed";

/** Result of POST /cohorts/:id/sync. */
export interface CohortSyncResult {
  cohortId: number;
  cohortName: string;
  added: number;
  skipped: number;
  notFound: number;
  errors: number;
}

/** A coupon whose restriction references the cohort (GET /cohorts/:id/coupons). */
export interface CohortLinkedCoupon {
  voucherId: string;
  voucherCode: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface CohortListResponse {
  items: Cohort[];
  limit: number;
  offset: number;
  total: number;
}

export interface CohortListParams {
  limit?: number;
  offset?: number;
  type?: CohortType;
  status?: boolean;
  q?: string;
}

export interface CohortCreateInput {
  cohort_name: string;
  description?: string | null;
  type?: CohortType;
  end_date?: string | null;
  message_batch_size?: number;
  sync_frequency_hours?: number;
  /** Required for a dynamic cohort, rejected for a static one (LLD §4.1). */
  rules?: RuleGroup;
}

export type CohortUpdateInput = Partial<Omit<CohortCreateInput, "type"> & { status: boolean }>;

/** One rejected row from a CSV import. */
export interface CohortInvalidRow {
  row: number;
  phone: string;
  reason: string;
}

/** Result of a static-cohort CSV upload — the sheet is never rejected wholesale. */
export interface CohortIngestSummary {
  total: number;
  valid: number;
  invalid: number;
  sample: CohortInvalidRow[];
}

// --- Phase 2: dynamic cohort rules (TTXY-4841, LLD §3.1 / §4.2) -------------

export type RuleLogic = "AND" | "OR";

/** Field identifiers come from GET /cohorts/rule-fields; the UI never hard-codes the list. */
export type RuleField = string;

export type RuleOperator = string;

export type RuleFieldType = "text" | "number" | "product" | "category";

export interface RuleBetweenValue {
  min: number;
  max: number;
}

export type RuleValue = string | number | string[] | RuleBetweenValue;

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: RuleValue;
  /** Display names for id values (product / category pickers). */
  label?: string | string[];
}

export interface RuleGroup {
  logic: RuleLogic;
  conditions: Array<RuleCondition | RuleGroup>;
}

/** One entry of GET /cohorts/rule-fields. */
export interface RuleFieldDefinition {
  field: RuleField;
  type: RuleFieldType;
  operators: RuleOperator[];
}

/** One `details[]` entry of a 400 invalid_rule response (LLD §4.1). */
export interface RuleErrorDetail {
  path: string;
  message: string;
}

// --- Phase 3: voucher cohort restriction (LLD §4.3) --------------------------

export interface VoucherCohortRestrictionEntry {
  cohort_id: number;
  cohort_name: string;
  start_time: string | null;
  end_time: string | null;
  /** The stored value; null = follow the environment default (`default_template_event`). */
  template_event: string | null;
  holdout_pct: number;
  repeat_window_days: number;
}

/** GET /cohorts/voucher-restriction/:voucherId */
export interface VoucherCohortRestriction {
  voucherId: string;
  voucherCode: string | null;
  startDate: string | null;
  endDate: string | null;
  /** The WhatsApp template a cohort with no `template_event` of its own uses (PR #19 C1). */
  default_template_event?: string | null;
  cohorts: VoucherCohortRestrictionEntry[];
}

/** One cohort in the POST /cohorts/voucher-restriction body. Missing optional fields keep stored values (F3). */
export interface VoucherCohortRestrictionEntryInput {
  cohort_id: number;
  cohort_name: string;
  start_time?: string | null;
  end_time?: string | null;
  template_event?: string | null;
  holdout_pct?: number;
  repeat_window_days?: number;
}

export interface VoucherCohortRestrictionInput {
  voucherId: string;
  voucherCode?: string | null;
  voucherStart?: string | null;
  voucherEnd?: string | null;
  cohorts: VoucherCohortRestrictionEntryInput[];
}

export interface VoucherCohortRestrictionResult {
  voucherId: string;
  restricted: boolean;
}

// --- Phase 4: campaigns + funnel (LLD §4.4–§4.6) -----------------------------

export type CampaignStatus = "open" | "blocked" | "closed";

export interface CampaignSummary {
  id: number;
  voucher_code: string;
  cohort_id: number;
  cohort_name: string;
  start_time: string;
  end_time: string | null;
  status: CampaignStatus;
  blocked_reason: string | null;
  recipients: number;
  sent: number;
  holdout: number;
}

export interface CampaignListResponse {
  items: CampaignSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CampaignListParams {
  page?: number;
  pageSize?: number;
  status?: CampaignStatus;
}

/** Funnel stages in order (LLD §3.3 tenxyou_campaign_funnel_events.stage). */
export const FUNNEL_STAGES = [
  "tagged",
  "sent",
  "delivered",
  "clicked",
  "added_to_cart",
  "code_entered",
  "applied",
  "order_placed",
  "repeat_order",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** `null` means "not tracked or not applicable" (LLD §4.5). */
export type FunnelStageCounts = Partial<Record<FunnelStage, number | null>>;

export interface FunnelGroup {
  size: number;
  stages: FunnelStageCounts;
  gmv: number | null;
}

export interface FunnelMetrics {
  purchase_lift: number | null;
  repeat_lift: number | null;
  reactivation_rate: number | null;
  redemption_rate: number | null;
  incremental_gmv: number | null;
}

/** GET /cohorts/campaigns/:id/funnel */
export interface CampaignFunnel {
  campaign: CampaignSummary;
  groups: { messaged: FunnelGroup; holdout: FunnelGroup };
  metrics: FunnelMetrics;
  tracked?: Partial<Record<FunnelStage, boolean>>;
}
