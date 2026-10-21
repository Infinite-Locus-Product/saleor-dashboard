// TTXY-4699 PR #5 C3 — a mapped cohort error: translated headline, optional
// server text underneath as secondary detail.
import { Box, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { type CohortErrorView } from "../errors";

interface CohortErrorTextProps {
  error: CohortErrorView;
  testId?: string;
}

export const CohortErrorText = ({ error, testId }: CohortErrorTextProps) => {
  const intl = useIntl();

  return (
    <Box display="grid" gap={1} data-test-id={testId}>
      <Text color="critical1">{intl.formatMessage(error.message)}</Text>
      {error.detail && (
        <Text size={2} color="default2">
          {error.detail}
        </Text>
      )}
    </Box>
  );
};
