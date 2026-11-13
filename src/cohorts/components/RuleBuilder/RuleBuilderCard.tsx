// TTXY-4841 — the "Rules" card shared by cohort create and details (L1, L5).
import { DashboardCard } from "@dashboard/components/Card";
import { Box, Button, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { CohortErrorText } from "../CohortErrorText";
import { ruleBuilderMessages } from "./messages";
import { RuleBuilder, type RuleBuilderProps } from "./RuleBuilder";
import { type RuleFieldsState } from "./useRuleFields";

interface RuleBuilderCardProps extends Omit<RuleBuilderProps, "fields"> {
  ruleFields: RuleFieldsState;
}

export const RuleBuilderCard = ({ ruleFields, ...builderProps }: RuleBuilderCardProps) => {
  const intl = useIntl();

  return (
    <DashboardCard data-test-id="cohort-rules-card">
      <DashboardCard.Header>
        <DashboardCard.Title>
          {intl.formatMessage(ruleBuilderMessages.cardTitle)}
        </DashboardCard.Title>
      </DashboardCard.Header>
      <DashboardCard.Content>
        <Box display="grid" gap={3} paddingBottom={4}>
          <Text size={2} color="default2">
            {intl.formatMessage(ruleBuilderMessages.cardHelp)}
          </Text>
          {ruleFields.error ? (
            <Box display="grid" gap={2}>
              <CohortErrorText error={ruleFields.error} testId="rule-fields-error" />
              <Box>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={ruleFields.loading}
                  onClick={ruleFields.retry}
                  data-test-id="rule-fields-retry"
                >
                  {intl.formatMessage(ruleBuilderMessages.fieldsRetry)}
                </Button>
              </Box>
            </Box>
          ) : ruleFields.ready ? (
            <RuleBuilder {...builderProps} fields={ruleFields.fields} />
          ) : (
            <Text aria-live="polite">{intl.formatMessage(ruleBuilderMessages.fieldsLoading)}</Text>
          )}
        </Box>
      </DashboardCard.Content>
    </DashboardCard>
  );
};
