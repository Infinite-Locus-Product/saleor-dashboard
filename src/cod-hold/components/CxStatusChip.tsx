import { Box, Text } from "@saleor/macaw-ui-next";

import { type CodHoldInternalCxStatus } from "../types";

interface CxStatusChipProps {
  status: CodHoldInternalCxStatus;
}

type CxStatusConfig = {
  label: string;
  color: "default1" | "warning1" | "success1" | "critical1";
};

// Shared by HeldOrdersQueueView's "CX Status" column and OrderDetailView's
// header badge, so both read the PRD's Internal CX Status the same way.
// Distinct from StatusChip (CodHoldStatus, the ERP-facing state) and from
// SLABadge (CodHoldSlaTier, purely time-based) — don't conflate the three.
export const cxStatusConfig: Record<CodHoldInternalCxStatus, CxStatusConfig> = {
  PENDING: { label: "Pending Review", color: "default1" },
  CX_REVIEW: { label: "In Review", color: "warning1" },
  CX_ACTION: { label: "In Progress", color: "warning1" },
  CONVERTED: { label: "Converted", color: "success1" },
  ADDRESS_CHANGED: { label: "Address Changed", color: "success1" },
  RELEASED: { label: "Released", color: "success1" },
  CANCELLED: { label: "Cancelled", color: "critical1" },
  AUTO_RELEASED: { label: "Auto-Released", color: "success1" },
  AUTO_CANCELLED: { label: "Auto-Cancelled", color: "critical1" },
};

export const CxStatusChip = ({ status }: CxStatusChipProps) => {
  const config: CxStatusConfig = cxStatusConfig[status] ?? { label: status, color: "default1" };

  return (
    <Box display="inline-flex" alignItems="center" borderRadius={3} paddingX={2} paddingY={1}>
      <Text size={2} color={config.color} fontWeight="bold">
        {config.label}
      </Text>
    </Box>
  );
};
