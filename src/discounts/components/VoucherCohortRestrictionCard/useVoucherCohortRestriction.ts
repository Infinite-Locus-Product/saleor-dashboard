/**
 * State of the voucher "Restrict to cohort(s)" card (TTXY-4841, L6–L8).
 *
 * Loads GET /cohorts/voucher-restriction/:voucherId and, when the voucher form
 * is saved, POSTs the whole list (a removed cohort is left out, which removes
 * it). It never blocks the voucher save when cohorts are unavailable (flag off,
 * no cohort access, backend URL not configured): the card then only explains
 * why, and nothing is sent.
 *
 * PR #19 C4 — when the backend says the stored restriction is `unreadable`,
 * nothing can be edited or sent until the user confirms the overwrite.
 */
import { isApiError } from "@dashboard/cohorts/api/apiError";
import { fetchVoucherRestriction, saveVoucherRestriction } from "@dashboard/cohorts/api/cohortsApi";
import { type CohortErrorView, describeCohortError } from "@dashboard/cohorts/errors";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type CohortRestrictionRow,
  fromRestrictionEntries,
  hasRowErrors,
  markTemplatesSaved,
  toRestrictionInputs,
  validateRows,
  type VoucherWindow,
} from "./model";

export type RestrictionStatus = "loading" | "ready" | "unavailable" | "error";

export interface VoucherRestrictionSaveInput {
  /** Defaults to the code the backend returned on load. */
  voucherCode?: string | null;
  voucherStart: string | null;
  voucherEnd: string | null;
}

export interface VoucherCohortRestrictionController {
  status: RestrictionStatus;
  rows: CohortRestrictionRow[];
  setRows: (rows: CohortRestrictionRow[]) => void;
  /** The template a row with a blank template uses (shown as its placeholder), PR #19 C1. */
  defaultTemplateEvent: string | null;
  /** The stored restriction exists but could not be read (PR #19 C4); cleared by a save. */
  unreadable: boolean;
  /** True once the user agreed to overwrite an unreadable restriction. */
  overwriteConfirmed: boolean;
  /** Unlocks an unreadable restriction for editing and marks the card changed. */
  confirmOverwrite: () => void;
  /** True once the user changed the list or a row since the last load/save. */
  dirty: boolean;
  loadError: CohortErrorView | null;
  saveError: CohortErrorView | null;
  saving: boolean;
  reload: () => void;
  /**
   * False when a loaded card has a row that must be fixed first (L7). Checked
   * even when the card is unchanged (PR #19 C3): new voucher dates can put a
   * stored cohort window outside the voucher.
   */
  validate: (window: VoucherWindow) => boolean;
  /**
   * Resolves true when there was nothing to send or the save succeeded. A call
   * made while a save is running gets that save's result (PR #19 C5).
   */
  save: (input: VoucherRestrictionSaveInput) => Promise<boolean>;
}

/** 403 / 404 / no backend URL: cohorts are not usable here, which is not an error to fix. */
const isUnavailable = (error: unknown): boolean =>
  !isApiError(error) || error.status === 403 || error.status === 404;

export const useVoucherCohortRestriction = (
  voucherId: string,
): VoucherCohortRestrictionController => {
  const [status, setStatus] = useState<RestrictionStatus>("loading");
  const [rows, setRowsState] = useState<CohortRestrictionRow[]>([]);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [defaultTemplateEvent, setDefaultTemplateEvent] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<CohortErrorView | null>(null);
  const [saveError, setSaveError] = useState<CohortErrorView | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadRun, setLoadRun] = useState(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  // PR #19 C9 — counts edits, so a save can tell whether the user changed the card while it ran.
  const edits = useRef(0);

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setLoadError(null);
    fetchVoucherRestriction(voucherId)
      .then(restriction => {
        if (cancelled) return;

        setRowsState(fromRestrictionEntries(restriction?.cohorts));
        setVoucherCode(restriction?.voucherCode ?? null);
        setDefaultTemplateEvent(restriction?.default_template_event || null);
        setUnreadable(restriction?.unreadable === true);
        setOverwriteConfirmed(false);
        setDirty(false);
        setStatus("ready");
      })
      .catch(err => {
        if (cancelled) return;

        setLoadError(describeCohortError("restrictionLoad", err));
        setStatus(isUnavailable(err) ? "unavailable" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [voucherId, loadRun]);

  const setRows = useCallback((next: CohortRestrictionRow[]) => {
    edits.current += 1;
    setRowsState(next);
    setDirty(true);
    setSaveError(null);
  }, []);

  const confirmOverwrite = useCallback(() => {
    setOverwriteConfirmed(true);
    setDirty(true);
    setSaveError(null);
  }, []);

  const reload = useCallback(() => setLoadRun(run => run + 1), []);

  const validate = useCallback(
    (window: VoucherWindow) => status !== "ready" || !hasRowErrors(validateRows(rows, window)),
    [status, rows],
  );

  const save = useCallback(
    async (input: VoucherRestrictionSaveInput): Promise<boolean> => {
      if (status !== "ready" || !dirty) return true;

      // C4 — never overwrite an unreadable restriction without the user's say-so.
      if (unreadable && !overwriteConfirmed) return true;

      // C5 — a second click while the POST runs must not send it again.
      if (inFlight.current) return inFlight.current;

      // C9 — the rows this POST carries; the user may edit while it runs.
      const sent = rows;
      const editsAtStart = edits.current;

      const run = async (): Promise<boolean> => {
        setSaving(true);
        setSaveError(null);

        try {
          await saveVoucherRestriction({
            voucherId,
            voucherCode: input.voucherCode ?? voucherCode,
            voucherStart: input.voucherStart,
            voucherEnd: input.voucherEnd,
            cohorts: toRestrictionInputs(sent),
          });
          // C9 — what was sent is now stored, so the next save compares against it.
          setRowsState(current => markTemplatesSaved(current, sent));
          setDirty(edits.current !== editsAtStart);
          setUnreadable(false);
          setOverwriteConfirmed(false);

          return true;
        } catch (err) {
          setSaveError(describeCohortError("restrictionSave", err));

          return false;
        } finally {
          inFlight.current = null;
          setSaving(false);
        }
      };

      inFlight.current = run();

      return inFlight.current;
    },
    [status, dirty, unreadable, overwriteConfirmed, voucherId, voucherCode, rows],
  );

  return {
    status,
    rows,
    setRows,
    defaultTemplateEvent,
    unreadable,
    overwriteConfirmed,
    confirmOverwrite,
    dirty,
    loadError,
    saveError,
    saving,
    reload,
    validate,
    save,
  };
};
