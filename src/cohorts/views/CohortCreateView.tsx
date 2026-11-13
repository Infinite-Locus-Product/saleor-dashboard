/**
 * Create a cohort (TTXY-4705). TTXY-4841 adds the Static/Dynamic choice: a
 * dynamic cohort is created with a rule tree instead of a CSV (L1, L4).
 */
import { TopNav } from "@dashboard/components/AppLayout";
import { DashboardCard } from "@dashboard/components/Card";
import { DetailPageLayout } from "@dashboard/components/Layouts";
import { Savebar } from "@dashboard/components/Savebar";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Input, Text } from "@saleor/macaw-ui-next";
import React from "react";
import { useIntl } from "react-intl";

import { isApiError } from "../api/apiError";
import { createCohort } from "../api/cohortsApi";
import { CohortErrorText } from "../components/CohortErrorText";
import { RuleBuilderCard } from "../components/RuleBuilder/RuleBuilderCard";
import {
  type EditorGroup,
  emptyGroup,
  mapServerErrors,
  type RuleServerErrors,
  toRuleGroup,
  validateRuleTree,
} from "../components/RuleBuilder/ruleModel";
import { useRuleFields } from "../components/RuleBuilder/useRuleFields";
import { type CohortErrorView, describeCohortError } from "../errors";
import { cohortMessages } from "../messages";
import { type CohortType } from "../types";
import { cohortListUrl, cohortUrl } from "../urls";

export const CohortCreateView: React.FC = () => {
  const intl = useIntl();
  const navigate = useNavigator();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [syncHours, setSyncHours] = React.useState("1");
  const [endDate, setEndDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<CohortErrorView | null>(null);

  const [type, setType] = React.useState<CohortType>("static");
  const [rules, setRules] = React.useState<EditorGroup>(() => emptyGroup());
  // Client errors show only after the first save attempt, then stay live.
  const [rulesSubmitted, setRulesSubmitted] = React.useState(false);
  const [ruleServerErrors, setRuleServerErrors] = React.useState<RuleServerErrors>({});
  const isDynamic = type === "dynamic";
  const ruleFields = useRuleFields(isDynamic);
  const ruleErrors = React.useMemo(
    () => (rulesSubmitted ? validateRuleTree(rules, ruleFields.fields) : {}),
    [rulesSubmitted, rules, ruleFields.fields],
  );
  const rulesUnavailable = isDynamic && !ruleFields.ready;

  const handleRulesChange = (next: EditorGroup) => {
    setRules(next);
    setRuleServerErrors({});
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // C8 — the Create button is type=submit; never send a second create
    // mid-flight, nor a blank name (the `required` attribute accepts spaces).
    if (saving || name.trim().length === 0 || rulesUnavailable) return;

    if (isDynamic) {
      setRulesSubmitted(true);

      // L4 — "Add at least one rule" and per-condition errors block the request.
      if (Object.keys(validateRuleTree(rules, ruleFields.fields)).length > 0) return;
    }

    setSaving(true);
    setError(null);
    setRuleServerErrors({});

    try {
      const created = await createCohort({
        cohort_name: name.trim(),
        description: description.trim() || null,
        type,
        end_date: endDate || null,
        sync_frequency_hours: Number(syncHours) || 1,
        ...(isDynamic ? { rules: toRuleGroup(rules, ruleFields.fields) } : {}),
      });

      navigate(cohortUrl(created.id));
    } catch (err) {
      // A duplicate name is a 409 whose server text names the clash — kept as detail.
      setError(describeCohortError("create", err));

      if (isDynamic && isApiError(err) && err.details.length > 0) {
        setRuleServerErrors(mapServerErrors(rules, err.details));
      }
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
                  <Box as="fieldset" display="grid" gap={2} data-test-id="cohort-type">
                    <legend>
                      <Text size={2} color="default2">
                        {intl.formatMessage(cohortMessages.typeLabel)}
                      </Text>
                    </legend>
                    {(["static", "dynamic"] as const).map(option => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="cohort-type"
                          value={option}
                          checked={type === option}
                          onChange={() => setType(option)}
                          data-test-id={`cohort-type-${option}`}
                        />{" "}
                        <Text as="span">
                          {intl.formatMessage(
                            option === "static"
                              ? cohortMessages.typeStaticOption
                              : cohortMessages.typeDynamicOption,
                          )}
                        </Text>
                      </label>
                    ))}
                    {!isDynamic && (
                      <Text size={2} color="default2" data-test-id="cohort-csv-hint">
                        {intl.formatMessage(cohortMessages.csvAfterCreate)}
                      </Text>
                    )}
                  </Box>
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
                  {error && <CohortErrorText error={error} testId="cohort-create-error" />}
                </Box>
              </DashboardCard.Content>
            </DashboardCard>
            {isDynamic && (
              <Box paddingTop={4}>
                <RuleBuilderCard
                  ruleFields={ruleFields}
                  value={rules}
                  onChange={handleRulesChange}
                  errors={ruleErrors}
                  serverErrors={ruleServerErrors}
                  disabled={saving}
                />
              </Box>
            )}
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
          // C8 — without noTransition, ConfirmButton ignores `disabled` after a
          // loading -> default cycle.
          noTransition
          disabled={saving || name.trim().length === 0 || rulesUnavailable}
        />
      </Savebar>
    </DetailPageLayout>
  );
};
