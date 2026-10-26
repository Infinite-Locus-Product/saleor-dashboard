/**
 * Cohort detail (TTXY-4705) + static CSV upload (TTXY-4707) + delete confirmation
 * showing dependencies (TTXY-4713, TTXY-6199) + last sync / Sync now (TTXY-6196).
 */
import { TopNav } from "@dashboard/components/AppLayout";
import { DashboardCard } from "@dashboard/components/Card";
import { DetailPageLayout } from "@dashboard/components/Layouts";
import { Savebar } from "@dashboard/components/Savebar";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Text } from "@saleor/macaw-ui-next";
import React from "react";
import { useIntl } from "react-intl";

import {
  deleteCohort,
  fetchCohort,
  fetchCohortCoupons,
  syncCohort,
  updateCohort,
  uploadCohortCsv,
} from "../api/cohortsApi";
import { CohortDeleteDialog } from "../components/CohortDeleteDialog";
import { CohortErrorText } from "../components/CohortErrorText";
import { CohortLastSync } from "../components/CohortLastSync";
import { type CohortErrorView, describeCohortError } from "../errors";
import { formatIstDateTime, toIstDateInput } from "../lastSynced";
import { cohortMessages, cohortTypeMessages } from "../messages";
import {
  type Cohort,
  type CohortIngestSummary,
  type CohortLinkedCoupon,
  type CohortSyncResult,
} from "../types";
import { cohortListUrl } from "../urls";

interface CohortDetailsViewProps {
  id: string;
}

export const CohortDetailsView: React.FC<CohortDetailsViewProps> = ({ id }) => {
  const intl = useIntl();
  const navigate = useNavigator();

  const [cohort, setCohort] = React.useState<Cohort | null>(null);
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState(false);
  const [syncHours, setSyncHours] = React.useState("1");
  // C17 — YYYY-MM-DD (IST day) or "" for no end date.
  const [endDate, setEndDate] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<CohortErrorView | null>(null);

  const [uploading, setUploading] = React.useState(false);
  const [summary, setSummary] = React.useState<CohortIngestSummary | null>(null);
  const [uploadError, setUploadError] = React.useState<CohortErrorView | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<CohortErrorView | null>(null);
  const [linkedCoupons, setLinkedCoupons] = React.useState<CohortLinkedCoupon[] | null>(null);
  const [couponLookupError, setCouponLookupError] = React.useState<CohortErrorView | null>(null);
  // Bumped to re-run the coupon lookup while the dialog stays open (after a failed delete).
  const [couponLookupRun, setCouponLookupRun] = React.useState(0);

  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<CohortSyncResult | null>(null);
  const [syncError, setSyncError] = React.useState<CohortErrorView | null>(null);
  // Which card failed to re-fetch the cohort after its action succeeded (C7d).
  const [refreshWarning, setRefreshWarning] = React.useState<"sync" | "upload" | null>(null);

  // C9 — incremented when a save STARTS. A background refresh that started
  // before the latest save start may carry pre-save fields, so it is dropped;
  // one that started after it (e.g. a CSV upload during a save) is applied.
  const saveStarts = React.useRef(0);

  /** Load a record into BOTH the cohort and the editable form fields. Only for load and save. */
  const hydrate = React.useCallback((next: Cohort) => {
    setCohort(next);
    setDescription(next.description ?? "");
    setStatus(next.status);
    setSyncHours(String(next.sync_frequency_hours ?? 1));
    setEndDate(toIstDateInput(next.end_date));
  }, []);

  /**
   * C1 — re-fetch the cohort record (member count, sync state) after a sync or
   * CSV upload WITHOUT touching the form, so unsaved edits survive.
   * Resolves false when the refresh failed.
   */
  const refreshRecord = React.useCallback(async (): Promise<boolean> => {
    const savesBefore = saveStarts.current;

    try {
      const next = await fetchCohort(id);

      if (saveStarts.current === savesBefore) {
        setCohort(next);
      }

      return true;
    } catch {
      return false;
    }
  }, [id]);

  React.useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    fetchCohort(id)
      .then(next => {
        if (!cancelled) hydrate(next);
      })
      .catch(err => {
        if (!cancelled) setError(describeCohortError("load", err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, hydrate]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    // C8 — the Save button is type=submit; never send a second update mid-save.
    if (saving) return;

    saveStarts.current += 1;
    setSaving(true);
    setError(null);

    // C17 — only send end_date when it was edited: the backend rejects a past
    // end_date, so re-sending an expired one would block every other edit.
    const endDateChanged = cohort !== null && endDate !== toIstDateInput(cohort.end_date);

    try {
      const updated = await updateCohort(id, {
        description: description.trim() || null,
        status,
        sync_frequency_hours: Number(syncHours) || 1,
        ...(endDateChanged ? { end_date: endDate || null } : {}),
      });

      hydrate(updated);
    } catch (err) {
      setError(describeCohortError("update", err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setSummary(null);
    setRefreshWarning(null);

    try {
      setSummary(await uploadCohortCsv(id, file));

      // member_count changes after ingest — refresh the record (not the form).
      if (!(await refreshRecord())) {
        setRefreshWarning("upload");
      }
    } catch (err) {
      setUploadError(describeCohortError("upload", err));
    } finally {
      setUploading(false);
      // allow re-uploading the same filename
      input.value = "";
    }
  };

  // C2 — every open and close starts from "lookup pending", so the first render
  // after a reopen can never show the previous lookup's enabled Confirm.
  const resetDeleteState = () => {
    setLinkedCoupons(null);
    setCouponLookupError(null);
    setDeleteError(null);
  };

  const openDeleteDialog = () => {
    resetDeleteState();
    setDeleteOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteOpen(false);
    resetDeleteState();
  };

  // TTXY-6199 — load the coupons using this cohort each time the dialog opens
  // (and again after a failed delete), so Confirm is only offered for a cohort
  // no coupon references.
  React.useEffect(() => {
    if (!deleteOpen) return;

    let cancelled = false;

    setLinkedCoupons(null);
    setCouponLookupError(null);
    fetchCohortCoupons(id)
      .then(coupons => {
        if (cancelled) return;

        setLinkedCoupons(coupons);

        // C11 — a 409 ("used by coupons") is out of date once no coupon uses the
        // cohort any more. Other failures (502 untag, network) still apply.
        if (coupons.length === 0) {
          setDeleteError(current =>
            current?.message === cohortMessages.deleteUsedByCoupons ? null : current,
          );
        }
      })
      .catch(err => {
        if (!cancelled) setCouponLookupError(describeCohortError("coupons", err));
      });

    return () => {
      cancelled = true;
    };
  }, [deleteOpen, id, couponLookupRun]);

  const handleSync = async () => {
    if (syncing || saving) return;

    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    setRefreshWarning(null);

    try {
      setSyncResult(await syncCohort(id));
    } catch (err) {
      setSyncError(describeCohortError("sync", err));
    }

    // The outcome (success / partial / failed) is recorded on the cohort; refresh
    // the record only, so unsaved form edits survive (C1).
    if (!(await refreshRecord())) {
      setRefreshWarning("sync");
    }

    setSyncing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteCohort(id);
      navigate(cohortListUrl());
    } catch (err) {
      // 409: coupons now reference the cohort; 502: untagging failed, nothing
      // deleted. Either way re-check the coupons; Confirm stays disabled until
      // the lookup comes back empty.
      setDeleteError(describeCohortError("delete", err));
      setLinkedCoupons(null);
      setCouponLookupRun(run => run + 1);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <DetailPageLayout gridTemplateColumns={1}>
        <TopNav href={cohortListUrl()} title={intl.formatMessage(cohortMessages.sectionTitle)} />
        <DetailPageLayout.Content>
          <Box padding={6}>
            <Text>{intl.formatMessage(cohortMessages.loading)}</Text>
          </Box>
        </DetailPageLayout.Content>
      </DetailPageLayout>
    );
  }

  if (!cohort) {
    return (
      <DetailPageLayout gridTemplateColumns={1}>
        <TopNav href={cohortListUrl()} title={intl.formatMessage(cohortMessages.sectionTitle)} />
        <DetailPageLayout.Content>
          <Box padding={6}>
            {error ? (
              <CohortErrorText error={error} />
            ) : (
              <Text color="critical1">{intl.formatMessage(cohortMessages.notFound)}</Text>
            )}
          </Box>
        </DetailPageLayout.Content>
      </DetailPageLayout>
    );
  }

  const isStatic = cohort.type === "static";
  const isExpired = !!cohort.end_date && new Date(cohort.end_date).getTime() <= Date.now();
  const canSync = cohort.status && !isExpired;
  // C7a — activating an expired cohort would not help, so say why instead.
  const syncBlockedHelp = isExpired
    ? cohortMessages.syncExpiredHelp
    : !cohort.status
      ? cohortMessages.syncInactiveHelp
      : null;

  return (
    <DetailPageLayout gridTemplateColumns={1}>
      <TopNav
        href={cohortListUrl()}
        title={cohort.cohort_name}
        subtitle={cohort.cohort_code ?? undefined}
      />

      <DetailPageLayout.Content>
        <Box paddingX={6} paddingY={4} display="grid" gap={4}>
          <form id="cohort-details-form" onSubmit={handleSave}>
            <DashboardCard>
              <DashboardCard.Header>
                <DashboardCard.Title>
                  {intl.formatMessage(cohortMessages.generalInfo)}
                </DashboardCard.Title>
              </DashboardCard.Header>
              <DashboardCard.Content>
                <Box display="grid" gap={4} paddingBottom={4}>
                  <Input
                    label={intl.formatMessage(cohortMessages.nameLabel)}
                    value={cohort.cohort_name}
                    disabled
                    helperText={intl.formatMessage(
                      cohort.member_count > 0
                        ? cohortMessages.nameLockedHelp
                        : cohortMessages.nameRenameHelp,
                    )}
                  />
                  <Input
                    label={intl.formatMessage(cohortMessages.descriptionLabel)}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                  <Input
                    label={intl.formatMessage(cohortMessages.syncLabel)}
                    type="number"
                    min={1}
                    value={syncHours}
                    onChange={e => setSyncHours(e.target.value)}
                  />
                  <Box display="grid" gap={1}>
                    <Input
                      label={intl.formatMessage(cohortMessages.endDateLabel)}
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      data-test-id="cohort-end-date"
                    />
                    {cohort.end_date ? (
                      <Text size={2} color="default2" data-test-id="cohort-end-date-current">
                        {intl.formatMessage(cohortMessages.endDateCurrent, {
                          when: formatIstDateTime(intl, cohort.end_date),
                        })}
                      </Text>
                    ) : (
                      <Text size={2} color="default2">
                        {intl.formatMessage(cohortMessages.endDateNone)}
                      </Text>
                    )}
                    {isExpired && (
                      <Text size={2} color="warning1" data-test-id="cohort-end-date-expired">
                        {intl.formatMessage(cohortMessages.endDateExpiredHint)}
                      </Text>
                    )}
                  </Box>
                  <label>
                    <input
                      type="checkbox"
                      checked={status}
                      onChange={e => setStatus(e.target.checked)}
                      data-test-id="cohort-status"
                    />{" "}
                    <Text as="span">{intl.formatMessage(cohortMessages.activeLabel)}</Text>
                  </label>
                  <Text size={2} color="default2">
                    {intl.formatMessage(cohortMessages.membersSummary, {
                      count: cohort.member_count,
                      type: intl.formatMessage(cohortTypeMessages[cohort.type]),
                    })}
                  </Text>
                  {error && <CohortErrorText error={error} testId="cohort-save-error" />}
                </Box>
              </DashboardCard.Content>
            </DashboardCard>
          </form>

          <DashboardCard data-test-id="cohort-sync-card">
            <DashboardCard.Header>
              <DashboardCard.Title>
                {intl.formatMessage(cohortMessages.colLastSynced)}
              </DashboardCard.Title>
            </DashboardCard.Header>
            <DashboardCard.Content>
              <Box display="grid" gap={3} paddingBottom={4}>
                <CohortLastSync cohort={cohort} detailed />
                <Box display="flex" gap={3} alignItems="center">
                  <Button
                    variant="secondary"
                    onClick={handleSync}
                    disabled={!canSync || syncing || saving}
                    data-test-id="cohort-sync-now"
                  >
                    {intl.formatMessage(cohortMessages.syncNow)}
                  </Button>
                  {syncBlockedHelp && (
                    <Text size={2} color="default2" data-test-id="cohort-sync-blocked-help">
                      {intl.formatMessage(syncBlockedHelp)}
                    </Text>
                  )}
                </Box>
                {/* C6 — always mounted so screen readers announce the outcome */}
                <Box aria-live="polite" display="grid" gap={2} data-test-id="cohort-sync-status">
                  {syncResult && (
                    <Text size={2} data-test-id="cohort-sync-result">
                      {intl.formatMessage(cohortMessages.syncDone, {
                        added: syncResult.added,
                        skipped: syncResult.skipped,
                        notFound: syncResult.notFound,
                        errors: syncResult.errors,
                      })}
                    </Text>
                  )}
                  {syncError && <CohortErrorText error={syncError} testId="cohort-sync-error" />}
                  {refreshWarning === "sync" && (
                    <Text size={2} color="warning1" data-test-id="cohort-refresh-warning">
                      {intl.formatMessage(cohortMessages.refreshWarning)}
                    </Text>
                  )}
                </Box>
              </Box>
            </DashboardCard.Content>
          </DashboardCard>

          {isStatic && (
            <DashboardCard>
              <DashboardCard.Header>
                <DashboardCard.Title>
                  {intl.formatMessage(cohortMessages.csvCardTitle)}
                </DashboardCard.Title>
              </DashboardCard.Header>
              <DashboardCard.Content>
                <Box display="grid" gap={3} paddingBottom={4}>
                  <Text size={2} color="default2">
                    {intl.formatMessage(cohortMessages.csvHelp)}
                  </Text>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={uploading}
                    onChange={handleUpload}
                    data-test-id="cohort-csv-input"
                  />
                  <Box aria-live="polite" display="grid" gap={2}>
                    {uploading && <Text>{intl.formatMessage(cohortMessages.uploading)}</Text>}
                    {uploadError && (
                      <CohortErrorText error={uploadError} testId="cohort-csv-error" />
                    )}
                    {refreshWarning === "upload" && (
                      <Text size={2} color="warning1" data-test-id="cohort-refresh-warning">
                        {intl.formatMessage(cohortMessages.refreshWarning)}
                      </Text>
                    )}
                  </Box>
                  {summary && (
                    <Box data-test-id="cohort-csv-summary">
                      <Text>
                        {intl.formatMessage(cohortMessages.csvSummary, {
                          invalid: summary.invalid,
                          total: summary.total,
                          valid: summary.valid,
                        })}
                      </Text>
                      {summary.sample.length > 0 && (
                        <Box as="ul" paddingTop={2}>
                          {summary.sample.map(row => (
                            <Box as="li" key={`${row.row}-${row.phone}`}>
                              <Text size={2} color="default2">
                                {intl.formatMessage(cohortMessages.csvSampleRow, {
                                  row: row.row,
                                  phone: row.phone,
                                  reason: row.reason,
                                })}
                              </Text>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              </DashboardCard.Content>
            </DashboardCard>
          )}

          <DashboardCard>
            <DashboardCard.Content>
              <Box paddingY={4}>
                <Button variant="secondary" onClick={openDeleteDialog} data-test-id="cohort-delete">
                  {intl.formatMessage(cohortMessages.deleteCohort)}
                </Button>
              </Box>
            </DashboardCard.Content>
          </DashboardCard>
        </Box>
      </DetailPageLayout.Content>

      <Savebar>
        <Savebar.Spacer />
        <Savebar.CancelButton onClick={() => navigate(cohortListUrl())} />
        <Savebar.ConfirmButton
          form="cohort-details-form"
          type="submit"
          transitionState={saving ? "loading" : "default"}
          // C8 — without noTransition, ConfirmButton ignores `disabled` after a
          // loading -> default cycle.
          noTransition
          disabled={saving}
        />
      </Savebar>

      <CohortDeleteDialog
        open={deleteOpen}
        cohortName={cohort.cohort_name}
        memberCount={cohort.member_count}
        coupons={linkedCoupons}
        lookupError={couponLookupError}
        deleteError={deleteError}
        deleting={deleting}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
      />
    </DetailPageLayout>
  );
};
