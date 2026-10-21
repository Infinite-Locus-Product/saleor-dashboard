// TTXY-6196 — how a cohort's sync state is shown in the list and detail views.
import { type Cohort } from "./types";

type SyncFields = Pick<Cohort, "last_synced_at" | "last_sync_status" | "last_sync_attempt_at">;

export type LastSyncView =
  | { kind: "never" }
  | { kind: "success"; at: string }
  | { kind: "failed" | "partial"; attemptAt: string; lastSuccessAt: string | null };

const IST_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

/** Date and time in IST (the operating team's timezone), e.g. "22 Oct 2026, 11:00 am IST". */
export const formatIstDateTime = (value: string): string =>
  `${IST_FORMAT.format(new Date(value))} IST`;

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
