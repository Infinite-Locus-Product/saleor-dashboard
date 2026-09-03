import { Box, Text } from "@saleor/macaw-ui-next";

import { type CodHoldSlaTier } from "../types";

interface SLABadgeProps {
  tier: CodHoldSlaTier;
}

// Mirrors returns-exchange/components/SLABadge.tsx's tier -> semantic-token
// mapping so both dashboards read consistently to an agent working either
// queue.
const tierConfig: Record<
  CodHoldSlaTier,
  { background: "success1" | "warning1" | "critical1"; label: string }
> = {
  ON_TRACK: { background: "success1", label: "On Track" },
  DELAYED: { background: "warning1", label: "Delayed" },
  BREACHED: { background: "critical1", label: "Breached" },
};

export const SLABadge = ({ tier }: SLABadgeProps) => {
  const config = tierConfig[tier];

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Box
        __width={8}
        __height={8}
        borderRadius="50%"
        backgroundColor={config.background}
        flexShrink="0"
      />
      <Text size={2} color="default2">
        {config.label}
      </Text>
    </Box>
  );
};
