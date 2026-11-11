/**
 * Per-cohort rows of the voucher "Restrict to cohort(s)" card (TTXY-4841,
 * HLD §5.4, LLD §4.3). Pure helpers: load/save conversion and validation.
 *
 * Times: a row's start/end is a `datetime-local` value read as India time
 * (the backend treats an offset-less value as IST); it is sent with an explicit
 * +05:30 so nothing depends on the browser's timezone.
 */
import {
  type VoucherCohortRestrictionEntry,
  type VoucherCohortRestrictionEntryInput,
} from "@dashboard/cohorts/types";
import { joinDateTime } from "@dashboard/misc";

export const DEFAULT_HOLDOUT_PCT = 10;
export const MAX_HOLDOUT_PCT = 50;
export const DEFAULT_REPEAT_WINDOW_DAYS = 30;
export const MAX_REPEAT_WINDOW_DAYS = 365;
export const TEMPLATE_EVENT_RE = /^[a-z0-9_]{1,64}$/;

const IST_OFFSET = "+05:30";
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export interface CohortRestrictionRow {
  cohortId: number;
  cohortName: string;
  /** "YYYY-MM-DDTHH:mm" in IST, or "" for the voucher's own start. */
  start: string;
  /** "YYYY-MM-DDTHH:mm" in IST, or "" for the voucher's own end. */
  end: string;
  templateEvent: string;
  holdoutPct: string;
  repeatWindowDays: string;
}

/** The voucher's own dates (ISO with offset), as currently in the voucher form. */
export interface VoucherWindow {
  start: string | null;
  end: string | null;
}

export interface VoucherFormDates {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  hasEndDate: boolean;
}

/** The voucher's window as currently in the voucher form (browser-local date/time inputs). */
export const voucherWindowFromDates = (data: VoucherFormDates): VoucherWindow => ({
  start: joinDateTime(data.startDate, data.startTime),
  end: data.hasEndDate ? joinDateTime(data.endDate, data.endTime) : null,
});

export type RowFieldError =
  | "outside_voucher"
  | "end_before_start"
  | "invalid_date"
  | "invalid_template"
  | "invalid_holdout"
  | "invalid_repeat";

export type RowErrors = Partial<
  Record<"start" | "end" | "templateEvent" | "holdoutPct" | "repeatWindowDays", RowFieldError>
>;

/** Errors by cohort id; a row without errors has no entry. */
export type RestrictionErrors = Record<number, RowErrors>;

export const newRow = (cohortId: number, cohortName: string): CohortRestrictionRow => ({
  cohortId,
  cohortName,
  start: "",
  end: "",
  templateEvent: "",
  holdoutPct: String(DEFAULT_HOLDOUT_PCT),
  repeatWindowDays: String(DEFAULT_REPEAT_WINDOW_DAYS),
});

/** A stored instant as a `datetime-local` value in IST; "" when empty or unparseable. */
export const toIstDateTimeInput = (value: string | null | undefined): string => {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(entry => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

/** Epoch ms of an IST `datetime-local` value; null when blank or malformed. */
const istInputToEpoch = (value: string): number | null => {
  if (!DATETIME_LOCAL_RE.test(value)) return null;

  const time = new Date(`${value}:00${IST_OFFSET}`).getTime();

  return Number.isNaN(time) ? null : time;
};

const isoToEpoch = (value: string | null): number | null => {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
};

export const fromRestrictionEntries = (
  entries: VoucherCohortRestrictionEntry[] | null | undefined,
): CohortRestrictionRow[] =>
  (entries ?? []).map(entry => ({
    cohortId: entry.cohort_id,
    cohortName: entry.cohort_name,
    start: toIstDateTimeInput(entry.start_time),
    end: toIstDateTimeInput(entry.end_time),
    templateEvent: entry.template_event ?? "",
    holdoutPct: String(entry.holdout_pct ?? DEFAULT_HOLDOUT_PCT),
    repeatWindowDays: String(entry.repeat_window_days ?? DEFAULT_REPEAT_WINDOW_DAYS),
  }));

const parseIntInRange = (raw: string, min: number, max: number): number | null => {
  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);

  return value >= min && value <= max ? value : null;
};

/** The full list for POST /cohorts/voucher-restriction; a cohort left out is removed. */
export const toRestrictionInputs = (
  rows: CohortRestrictionRow[],
): VoucherCohortRestrictionEntryInput[] =>
  rows.map(row => ({
    cohort_id: row.cohortId,
    cohort_name: row.cohortName,
    start_time: row.start ? `${row.start}${IST_OFFSET}` : null,
    end_time: row.end ? `${row.end}${IST_OFFSET}` : null,
    template_event: row.templateEvent.trim() || null,
    holdout_pct: parseIntInRange(row.holdoutPct, 0, MAX_HOLDOUT_PCT) ?? DEFAULT_HOLDOUT_PCT,
    repeat_window_days:
      parseIntInRange(row.repeatWindowDays, 1, MAX_REPEAT_WINDOW_DAYS) ??
      DEFAULT_REPEAT_WINDOW_DAYS,
  }));

const validateRow = (row: CohortRestrictionRow, window: VoucherWindow): RowErrors => {
  const errors: RowErrors = {};
  const voucherStart = isoToEpoch(window.start);
  const voucherEnd = isoToEpoch(window.end);
  const start = row.start ? istInputToEpoch(row.start) : null;
  const end = row.end ? istInputToEpoch(row.end) : null;

  if (row.start && start === null) {
    errors.start = "invalid_date";
  } else if (
    start !== null &&
    ((voucherStart !== null && start < voucherStart) ||
      (voucherEnd !== null && start >= voucherEnd))
  ) {
    errors.start = "outside_voucher";
  }

  if (row.end && end === null) {
    errors.end = "invalid_date";
  } else if (
    end !== null &&
    ((voucherEnd !== null && end > voucherEnd) || (voucherStart !== null && end <= voucherStart))
  ) {
    errors.end = "outside_voucher";
  } else if (end !== null && start !== null && end <= start) {
    errors.end = "end_before_start";
  }

  if (row.templateEvent.trim() && !TEMPLATE_EVENT_RE.test(row.templateEvent.trim())) {
    errors.templateEvent = "invalid_template";
  }

  if (parseIntInRange(row.holdoutPct, 0, MAX_HOLDOUT_PCT) === null) {
    errors.holdoutPct = "invalid_holdout";
  }

  if (parseIntInRange(row.repeatWindowDays, 1, MAX_REPEAT_WINDOW_DAYS) === null) {
    errors.repeatWindowDays = "invalid_repeat";
  }

  return errors;
};

/** L7 — each cohort's window must sit inside the voucher's dates. */
export const validateRows = (
  rows: CohortRestrictionRow[],
  window: VoucherWindow,
): RestrictionErrors =>
  rows.reduce<RestrictionErrors>((all, row) => {
    const errors = validateRow(row, window);

    return Object.keys(errors).length > 0 ? { ...all, [row.cohortId]: errors } : all;
  }, {});

export const hasRowErrors = (errors: RestrictionErrors): boolean => Object.keys(errors).length > 0;
