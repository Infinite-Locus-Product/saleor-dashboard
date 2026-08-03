import { cacheManagementMessages } from "@dashboard/cacheManagement/messages";
import { type CacheExecutionStatus } from "@dashboard/cacheManagement/types";
import { Box, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

interface ExecutionStatusBadgeProps {
  status: CacheExecutionStatus;
  httpStatus?: number;
  durationMs?: number;
}

export const ExecutionStatusBadge = ({
  status,
  httpStatus,
  durationMs,
}: ExecutionStatusBadgeProps) => {
  const intl = useIntl();
  const isSuccess = status === "success";

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Box
        display="flex"
        alignItems="center"
        gap={1}
        paddingX={1.5}
        paddingY={0.5}
        borderRadius={2}
        backgroundColor={isSuccess ? "success1" : "critical1"}
      >
        <Text size={1} fontWeight="medium" color={isSuccess ? "success1" : "critical1"}>
          {intl.formatMessage(
            isSuccess
              ? cacheManagementMessages.statusSuccess
              : cacheManagementMessages.statusFailed,
          )}
          {httpStatus ? ` · ${httpStatus}` : ""}
        </Text>
      </Box>
      {typeof durationMs === "number" && (
        <Text size={1} color="default2">
          {intl.formatMessage(cacheManagementMessages.durationMs, { duration: durationMs })}
        </Text>
      )}
    </Box>
  );
};
