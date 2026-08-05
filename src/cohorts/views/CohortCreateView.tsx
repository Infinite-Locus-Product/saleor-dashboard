/** Create a cohort (TTXY-4705). Static-only in Phase 1; dynamic arrives in Phase 2. */
import { TopNav } from "@dashboard/components/AppLayout";
import { DashboardCard } from "@dashboard/components/Card";
import { DetailPageLayout } from "@dashboard/components/Layouts";
import { Savebar } from "@dashboard/components/Savebar";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Input, Text } from "@saleor/macaw-ui-next";
import React from "react";
import { useIntl } from "react-intl";

import { createCohort } from "../api/cohortsApi";
import { cohortMessages } from "../messages";
import { cohortListUrl, cohortUrl } from "../urls";

export const CohortCreateView: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigator();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [syncHours, setSyncHours] = React.useState("1");
  const [endDate, setEndDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const created = await createCohort({
        cohort_name: name.trim(),
        description: description.trim() || null,
        type: "static",
        end_date: endDate || null,
        sync_frequency_hours: Number(syncHours) || 1,
      });

      navigate(cohortUrl(created.id));
    } catch (err) {
      // Backend maps a duplicate name to 409 — surface its message verbatim.
      setError(err instanceof Error ? err.message : intl.formatMessage(cohortMessages.createError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailPageLayout gridTemplateColumns={1}>
      <TopNav href={cohortListUrl()} title={intl.formatMessage(cohortMessages.createTitle)} />

      <DetailPageLayout.Content>
        <Box paddingX={6} paddingY={4}>
          <form id="cohort-create-form" onSubmit={handleSubmit}>
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
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    helperText={intl.formatMessage(cohortMessages.nameHelp)}
                    data-test-id="cohort-name"
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
                    helperText={intl.formatMessage(cohortMessages.syncHelp)}
                  />
                  <Input
                    label={intl.formatMessage(cohortMessages.endDateLabel)}
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    helperText={intl.formatMessage(cohortMessages.endDateHelp)}
                  />
                  <Text size={2} color="default2">
                    {intl.formatMessage(cohortMessages.createdInactive)}
                  </Text>
                  {error && (
                    <Text color="critical1" data-test-id="cohort-create-error">
                      {error}
                    </Text>
                  )}
                </Box>
              </DashboardCard.Content>
            </DashboardCard>
          </form>
        </Box>
      </DetailPageLayout.Content>

      <Savebar>
        <Savebar.Spacer />
        <Savebar.CancelButton onClick={() => navigate(cohortListUrl())} />
        <Savebar.ConfirmButton
          form="cohort-create-form"
          type="submit"
          transitionState={saving ? "loading" : "default"}
          disabled={saving || name.trim().length === 0}
        />
      </Savebar>
    </DetailPageLayout>
  );
};
