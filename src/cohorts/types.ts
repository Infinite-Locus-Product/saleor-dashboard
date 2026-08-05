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
  last_synced_at: string | null;
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
