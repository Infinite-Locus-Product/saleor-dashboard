/**
 * Cohort detail (TTXY-4705) + static CSV upload (TTXY-4707) + delete confirmation
 * showing dependencies (TTXY-4713).
 */
import ActionDialog from "@dashboard/components/ActionDialog";
import { TopNav } from "@dashboard/components/AppLayout";
import { DashboardCard } from "@dashboard/components/Card";
import { DetailPageLayout } from "@dashboard/components/Layouts";
import { Savebar } from "@dashboard/components/Savebar";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Text } from "@saleor/macaw-ui-next";
import React from "react";
import { useIntl } from "react-intl";

import { deleteCohort, fetchCohort, updateCohort, uploadCohortCsv } from "../api/cohortsApi";
import { cohortMessages } from "../messages";
import { type Cohort, type CohortIngestSummary } from "../types";
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

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [uploading, setUploading] = React.useState(false);
  const [summary, setSummary] = React.useState<CohortIngestSummary | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const hydrate = React.useCallback((next: Cohort) => {
    setCohort(next);
    setDescription(next.description ?? "");
    setStatus(next.status);
    setSyncHours(String(next.sync_frequency_hours ?? 1));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    setLoading(true);
    fetchCohort(id)
      .then(next => !cancelled && hydrate(next))
      .catch(
        err =>
          !cancelled &&
          setError(
            err instanceof Error ? err.message : intl.formatMessage(cohortMessages.loadCohortError),
          ),
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id, hydrate, intl]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updated = await updateCohort(id, {
        description: description.trim() || null,
        status,
        sync_frequency_hours: Number(syncHours) || 1,
      });

      hydrate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : intl.formatMessage(cohortMessages.updateError));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setSummary(null);

    try {
      const result = await uploadCohortCsv(id, file);

      setSummary(result);

      // member_count changes after ingest — refresh so the header stays truthful.
      const refreshed = await fetchCohort(id);

      hydrate(refreshed);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : intl.formatMessage(cohortMessages.csvError),
      );
    } finally {
      setUploading(false);
      // allow re-uploading the same filename
      event.target.value = "";
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteCohort(id);
      navigate(cohortListUrl());
    } catch (err) {
      // 409 when coupons still reference this cohort — the message lists them.
      setDeleteError(
        err instanceof Error ? err.message : intl.formatMessage(cohortMessages.deleteError),
      );
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
            <Text color="critical1">{error ?? intl.formatMessage(cohortMessages.notFound)}</Text>
          </Box>
        </DetailPageLayout.Content>
      </DetailPageLayout>
    );
  }

  const isStatic = cohort.type === "static";

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
                      type: cohort.type,
                    })}
                  </Text>
                  {error && <Text color="critical1">{error}</Text>}
                </Box>
              </DashboardCard.Content>
            </DashboardCard>
          </form>

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
                  {uploading && <Text>{intl.formatMessage(cohortMessages.uploading)}</Text>}
                  {uploadError && (
                    <Text color="critical1" data-test-id="cohort-csv-error">
                      {uploadError}
                    </Text>
                  )}
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
                <Button
                  variant="secondary"
                  onClick={() => setDeleteOpen(true)}
                  data-test-id="cohort-delete"
                >
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
          disabled={saving}
        />
      </Savebar>

      <ActionDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
        title={intl.formatMessage(cohortMessages.deleteCohort)}
        variant="delete"
        confirmButtonState={deleting ? "loading" : "default"}
      >
        <Text>
          {intl.formatMessage(cohortMessages.deleteConfirm, {
            name: cohort.cohort_name,
            count: cohort.member_count,
          })}
        </Text>
        {deleteError && (
          <Box paddingTop={3}>
            <Text color="critical1" data-test-id="cohort-delete-error">
              {deleteError}
            </Text>
          </Box>
        )}
      </ActionDialog>
    </DetailPageLayout>
  );
};
