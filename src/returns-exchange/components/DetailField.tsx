import { Box, Text } from "@saleor/macaw-ui-next";
import { type ReactNode } from "react";

interface DetailFieldProps {
  label: string;
  value: ReactNode;
  testId?: string;
}

export const DetailField = ({ label, value, testId }: DetailFieldProps) => (
  <Box marginBottom={2} data-test-id={testId}>
    <Text size={2} color="default2" display="block">
      {label}
    </Text>
    <Text size={3} display="block">
      {value === null || value === undefined || value === "" ? "—" : value}
    </Text>
  </Box>
);
