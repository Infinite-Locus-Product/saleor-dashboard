import { Box } from "@saleor/macaw-ui-next";
import { type CSSProperties } from "react";

import { returnStatusLabel } from "../utils/manualReturnStatus";

interface ManualRefundStatusChipProps {
  status: string;
  needsAttention: boolean;
}

const RED: CSSProperties = { background: "#fee2e2", color: "#b91c1c" };
const YELLOW: CSSProperties = { background: "#fef9c3", color: "#92400e" };
const DEFAULT: CSSProperties = { background: "#f1f5f9", color: "#334155" };

/**
 * PRD 1.4: red = failed, yellow = initiated/processing for more than 48 h, default otherwise.
 * Unlike Manual Returns, yellow is not the normal in-progress colour here — on purpose.
 */
export const ManualRefundStatusChip = ({ status, needsAttention }: ManualRefundStatusChipProps) => {
  const tone = status === "REFUND_FAILED" ? RED : needsAttention ? YELLOW : DEFAULT;

  return (
    <Box
      as="span"
      display="inline-block"
      borderRadius={2}
      paddingX={2}
      paddingY={1}
      data-test-id="mrf-status-chip"
      style={{ ...tone, fontSize: "12px", fontWeight: 600 }}
    >
      {returnStatusLabel(status)}
    </Box>
  );
};
