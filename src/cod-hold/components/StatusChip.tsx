import { Box, Text } from "@saleor/macaw-ui-next";

import { type CodHoldStatus } from "../types";

interface StatusChipProps {
  status: CodHoldStatus;
}

type StatusConfig = {
  label: string;
  color: "default1" | "warning1" | "success1" | "critical1";
};

const statusConfig: Record<CodHoldStatus, StatusConfig> = {
  HELD: { label: "Held", color: "warning1" },
  RELEASED: { label: "Released", color: "success1" },
  CONVERTED_PREPAID: { label: "Converted to Prepaid", color: "success1" },
  CUSTOMER_CANCELLED: { label: "Customer Cancelled", color: "critical1" },
};

export const StatusChip = ({ status }: StatusChipProps) => {
  const config: StatusConfig = statusConfig[status] ?? { label: status, color: "default1" };

  return (
    <Box display="inline-flex" alignItems="center" borderRadius={3} paddingX={2} paddingY={1}>
      <Text size={2} color={config.color} fontWeight="bold">
        {config.label}
      </Text>
    </Box>
  );
};
