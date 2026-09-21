import { Box } from "@saleor/macaw-ui-next";
import { type CSSProperties } from "react";

interface ManualReturnStatusChipProps {
  status: string;
  label: string;
}

const CRITICAL: CSSProperties = { background: "#fee2e2", color: "#b91c1c" };
const SUCCESS: CSSProperties = { background: "#dcfce7", color: "#15803d" };
const WARNING: CSSProperties = { background: "#fef9c3", color: "#92400e" };
const NEUTRAL: CSSProperties = { background: "#e0e7ff", color: "#3730a3" };

const toneFor = (status: string): CSSProperties => {
  if (["REFUND_FAILED", "RETURN_CANCELLED", "RTO_INITIATED"].includes(status)) {
    return CRITICAL;
  }

  if (["REFUND_COMPLETED", "RETURN_COMPLETED"].includes(status)) {
    return SUCCESS;
  }

  if (["REFUND_INITIATED", "REFUND_IN_PROCESS", "REFUND_PROCESSING"].includes(status)) {
    return WARNING;
  }

  return NEUTRAL;
};

export const ManualReturnStatusChip = ({ status, label }: ManualReturnStatusChipProps) => (
  <Box
    as="span"
    display="inline-block"
    borderRadius={2}
    paddingX={2}
    paddingY={1}
    data-test-id="mr-status-chip"
    style={{ ...toneFor(status), fontSize: "12px", fontWeight: 600 }}
  >
    {label}
  </Box>
);
