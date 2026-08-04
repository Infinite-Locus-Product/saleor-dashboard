import { CacheConfirmDialog } from "@dashboard/cacheManagement/components/CacheConfirmDialog/CacheConfirmDialog";
import { CachePayloadForm } from "@dashboard/cacheManagement/components/CachePayloadForm/CachePayloadForm";
import { ExecutionStatusBadge } from "@dashboard/cacheManagement/components/ExecutionStatusBadge/ExecutionStatusBadge";
import { JsonViewer } from "@dashboard/cacheManagement/components/JsonViewer/JsonViewer";
import { useCacheAction } from "@dashboard/cacheManagement/hooks/useCacheAction";
import { cacheManagementMessages } from "@dashboard/cacheManagement/messages";
import {
  type CacheEndpointConfig,
  type CacheExecutionResult,
} from "@dashboard/cacheManagement/types";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { Box, Button, Text } from "@saleor/macaw-ui-next";
import { Lock, Play, TriangleAlert } from "lucide-react";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";

import styles from "./CacheActionCard.module.css";

interface CacheActionCardProps {
  endpoint: CacheEndpointConfig;
}

/**
 * One endpoint rendered as a self-contained card: optional payload form,
 * confirmation gate for destructive routes, and the raw response.
 */
export const CacheActionCard = ({ endpoint }: CacheActionCardProps) => {
  const intl = useIntl();
  const notify = useNotifier();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleExecuted = useCallback(
    (executionResult: CacheExecutionResult) => {
      const title = intl.formatMessage(endpoint.title);

      if (executionResult.status === "success") {
        notify({
          status: "success",
          text: intl.formatMessage(cacheManagementMessages.executionSucceeded, {
            title,
            duration: executionResult.durationMs,
          }),
        });
      } else {
        notify({
          status: "error",
          title: intl.formatMessage(cacheManagementMessages.executionFailed, { title }),
          text: executionResult.errorMessage,
        });
      }
    },
    [endpoint.title, intl, notify],
  );

  const { values, setValue, errors, loading, result, configError, execute } = useCacheAction({
    endpoint,
    onExecuted: handleExecuted,
  });

  const requiresConfirmation = Boolean(endpoint.destructive);

  const handleActionClick = useCallback(() => {
    if (loading) return;

    if (requiresConfirmation) {
      setConfirmOpen(true);

      return;
    }

    void execute();
  }, [execute, loading, requiresConfirmation]);

  const handleConfirm = useCallback(async () => {
    await execute();
    setConfirmOpen(false);
  }, [execute]);

  const actionLabel = endpoint.actionLabel
    ? intl.formatMessage(endpoint.actionLabel)
    : intl.formatMessage(cacheManagementMessages.clearCache);

  return (
    <Box
      className={`${styles.card} ${endpoint.destructive ? styles.destructive : ""}`}
      data-test-id={`cache-card-${endpoint.id}`}
    >
      <Box display="flex" flexDirection="column" gap={2}>
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          <span className={styles.methodTag}>{endpoint.method}</span>
          {endpoint.requiresAdmin && (
            <Box display="flex" alignItems="center" gap={1}>
              <Lock size={12} />
              <Text size={1} color="default2">
                {intl.formatMessage(cacheManagementMessages.adminBadge)}
              </Text>
            </Box>
          )}
          {endpoint.destructive && (
            <Box display="flex" alignItems="center" gap={1}>
              <TriangleAlert size={12} />
              <Text size={1} color="critical1">
                {intl.formatMessage(cacheManagementMessages.destructiveBadge)}
              </Text>
            </Box>
          )}
        </Box>

        <Text size={4} fontWeight="medium">
          {intl.formatMessage(endpoint.title)}
        </Text>
        <Text size={2} color="default2">
          {intl.formatMessage(endpoint.description)}
        </Text>
        <span className={styles.path}>{endpoint.path}</span>
      </Box>

      {endpoint.fields && endpoint.fields.length > 0 && (
        <CachePayloadForm
          fields={endpoint.fields}
          values={values}
          errors={errors}
          disabled={loading}
          onChange={setValue}
        />
      )}

      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={3}
        flexWrap="wrap"
      >
        <Button
          type="button"
          variant={endpoint.destructive ? "secondary" : "primary"}
          size="small"
          icon={<Play size={14} />}
          disabled={loading || configError}
          onClick={handleActionClick}
          data-test-id={`cache-run-${endpoint.id}`}
        >
          {loading ? intl.formatMessage(cacheManagementMessages.running) : actionLabel}
        </Button>

        {result && (
          <ExecutionStatusBadge
            status={result.status}
            httpStatus={result.httpStatus}
            durationMs={result.durationMs}
          />
        )}
      </Box>

      {configError && (
        <Text size={2} color="critical1">
          {intl.formatMessage(cacheManagementMessages.missingBaseUrl)}
        </Text>
      )}

      {result?.errorMessage && (
        <Text size={2} color="critical1">
          {result.errorMessage}
        </Text>
      )}

      {result && (
        <JsonViewer
          label={intl.formatMessage(cacheManagementMessages.responseLabel)}
          value={result.response}
          copyLabel={intl.formatMessage(cacheManagementMessages.copyResponse)}
        />
      )}

      {requiresConfirmation && (
        <CacheConfirmDialog
          open={confirmOpen}
          endpoint={endpoint}
          loading={loading}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </Box>
  );
};
