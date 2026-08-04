import { cacheManagementMessages } from "@dashboard/cacheManagement/messages";
import { type CacheEndpointConfig } from "@dashboard/cacheManagement/types";
import ActionDialog from "@dashboard/components/ActionDialog";
import { Box, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

interface CacheConfirmDialogProps {
  open: boolean;
  endpoint: CacheEndpointConfig;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation gate for destructive cache operations. Copy comes from the
 * endpoint config so each dialog explains the specific blast radius.
 */
export const CacheConfirmDialog = ({
  open,
  endpoint,
  loading,
  onClose,
  onConfirm,
}: CacheConfirmDialogProps) => {
  const intl = useIntl();
  const title = endpoint.confirmation
    ? intl.formatMessage(endpoint.confirmation.title)
    : intl.formatMessage(cacheManagementMessages.confirmDefaultTitle);
  const description = endpoint.confirmation
    ? intl.formatMessage(endpoint.confirmation.description)
    : intl.formatMessage(cacheManagementMessages.confirmDefaultDescription);

  return (
    <ActionDialog
      open={open}
      title={title}
      variant="delete"
      confirmButtonState={loading ? "loading" : "default"}
      confirmButtonLabel={intl.formatMessage(cacheManagementMessages.confirmRun)}
      disabled={loading}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <Box display="grid" gap={2}>
        <Text>{description}</Text>
        <Text size={2} color="default2">
          {endpoint.method} {endpoint.path}
        </Text>
      </Box>
    </ActionDialog>
  );
};
