// TTXY-6196 — how a cohort's sync state is shown in the list and detail views.
import { type FormatDateOptions, type IntlShape } from "react-intl";

import { cohortMessages } from "./messages";
import { type Cohort } from "./types";

type SyncFields = Pick<Cohort, "last_synced_at" | "last_sync_status" | "last_sync_attempt_at">;

export type LastSyncView =
  | { kind: "never" }
  | { kind: "success"; at: string }
  | { kind: "failed" | "partial"; attemptAt: string; lastSuccessAt: string | null };

/** Options for intl.formatDate: IST wall-clock time in the dashboard's locale. */
const IST_DATE_TIME_OPTIONS: FormatDateOptions = {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
};

/**
 * Date and time in IST (the operating team's timezone), formatted through
 * react-intl, e.g. "Oct 22, 2026, 11:00 AM IST" (en) or "22 Oct 2026, 11:00 am IST" (en-IN).
 * Never throws: an unparseable value is shown as-is (a dash when empty), since
 * date formatting throws a RangeError on an invalid Date.
 */
export const formatIstDateTime = (
  intl: Pick<IntlShape, "formatDate" | "formatMessage">,
  value: string,
): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "—";
  }

  return intl.formatMessage(cohortMessages.istDateTime, {
    dateTime: intl.formatDate(date, IST_DATE_TIME_OPTIONS),
  });
};

/**
 * A failed or partial latest attempt wins over an older success, so a stale
 * success time is never presented as the current state.
 */
export const describeLastSync = (cohort: SyncFields): LastSyncView => {
  const { last_synced_at, last_sync_status, last_sync_attempt_at } = cohort;

  if ((last_sync_status === "failed" || last_sync_status === "partial") && last_sync_attempt_at) {
    return {
      kind: last_sync_status,
      attemptAt: last_sync_attempt_at,
      lastSuccessAt: last_synced_at,
    };
  }

  if (last_synced_at) {
    return { kind: "success", at: last_synced_at };
  }

  return { kind: "never" };
};
