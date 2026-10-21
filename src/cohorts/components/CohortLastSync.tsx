// TTXY-6196 — one rendering of a cohort's sync state, shared by list and detail.
import { Box, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { describeLastSync, formatIstDateTime } from "../lastSynced";
import { cohortMessages } from "../messages";
import { type Cohort } from "../types";

interface CohortLastSyncProps {
  cohort: Pick<
    Cohort,
    "last_synced_at" | "last_sync_status" | "last_sync_attempt_at" | "last_sync_error"
  >;
  /** Detail view also shows the last success and the error text under a failure. */
  detailed?: boolean;
}

export const CohortLastSync = ({ cohort, detailed = false }: CohortLastSyncProps) => {
  const intl = useIntl();
  const view = describeLastSync(cohort);

  if (view.kind === "never") {
    return <Text color="default2">{intl.formatMessage(cohortMessages.neverSynced)}</Text>;
  }

  if (view.kind === "success") {
    return <Text>{formatIstDateTime(intl, view.at)}</Text>;
  }

  const headline = intl.formatMessage(
    view.kind === "failed" ? cohortMessages.syncFailedAt : cohortMessages.syncPartialAt,
    { when: formatIstDateTime(intl, view.attemptAt) },
  );

  return (
    <Box display="grid" gap={1} data-test-id="cohort-last-sync-problem">
      <Text color="critical1">{headline}</Text>
      {detailed && cohort.last_sync_error && (
        <Text size={2} color="default2">
          {cohort.last_sync_error}
        </Text>
      )}
      {detailed && view.lastSuccessAt && (
        <Text size={2} color="default2">
          {intl.formatMessage(cohortMessages.lastSuccessfulSync, {
            when: formatIstDateTime(intl, view.lastSuccessAt),
          })}
        </Text>
      )}
    </Box>
  );
};
