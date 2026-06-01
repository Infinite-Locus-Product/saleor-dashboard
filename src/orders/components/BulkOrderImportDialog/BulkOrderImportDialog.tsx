import BackButton from "@dashboard/components/BackButton";
import { ConfirmButton } from "@dashboard/components/ConfirmButton";
import { DashboardModal } from "@dashboard/components/Modal";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { Box, Button, Input, Text } from "@saleor/macaw-ui-next";
import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";

import { type BulkOrderImportAck, importBulkOrders } from "../../api/bulkOrderApi";
import { messages } from "./messages";

interface BulkOrderImportDialogProps {
  open: boolean;
  channelSlug: string;
  channelName: string;
  onClose: () => void;
}

const MAX_CSV_BYTES = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// State is owned by the inner component, so unmounting it (via the `open` key
// in the parent below) is the cleanest way to reset between opens.
const BulkOrderImportDialogContent = ({
  channelSlug,
  channelName,
  onClose,
}: Omit<BulkOrderImportDialogProps, "open">): JSX.Element => {
  const intl = useIntl();
  const notify = useNotifier();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ack, setAck] = useState<BulkOrderImportAck | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0] ?? null;

    if (f && f.size > MAX_CSV_BYTES) {
      notify({ status: "error", text: intl.formatMessage(messages.fileTooLarge) });
      e.target.value = "";

      return;
    }

    setFile(f);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!file || !channelSlug) return;

    const emailTrimmed = notifyEmail.trim();

    if (emailTrimmed && !EMAIL_RE.test(emailTrimmed)) {
      notify({ status: "error", text: intl.formatMessage(messages.invalidEmail) });

      return;
    }

    setSubmitting(true);

    try {
      const result = await importBulkOrders({
        file,
        defaultChannel: channelSlug,
        notifyEmail: emailTrimmed || undefined,
      });

      setAck(result);
    } catch (err: unknown) {
      notify({
        status: "error",
        text: err instanceof Error ? err.message : intl.formatMessage(messages.importFailed),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardModal onChange={onClose} open>
      <DashboardModal.Content size="sm">
        <DashboardModal.Header>
          {ack ? intl.formatMessage(messages.ackTitle) : intl.formatMessage(messages.title)}
        </DashboardModal.Header>

        {ack ? (
          <Box display="flex" flexDirection="column" gap={3}>
            <Text>{ack.message}</Text>
            <Box display="grid" gap={2}>
              <Text size={2}>
                <b>{intl.formatMessage(messages.batchRef)}</b> <code>{ack.batchRef}</code>
              </Text>
              <Text size={2}>
                <b>{intl.formatMessage(messages.rowsLabel)}</b> {ack.totalRows} &nbsp;{" "}
                <b>{intl.formatMessage(messages.ordersQueued)}</b> {ack.totalOrders}
              </Text>
              <Text size={2} color="default2">
                {intl.formatMessage(messages.requestId)} <code>{ack.requestId}</code>
              </Text>
            </Box>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={4}>
            <Text>{intl.formatMessage(messages.description)}</Text>

            <Box display="grid" gap={1}>
              <Text size={2} fontWeight="medium">
                {intl.formatMessage(messages.channelLabel)}
              </Text>
              <Text size={3}>{channelName}</Text>
            </Box>

            <Box display="grid" gap={2}>
              {/* htmlFor associates this label with the hidden input for screen readers */}
              <label htmlFor="bulk-order-file-input">
                <Text size={2} fontWeight="medium">
                  {intl.formatMessage(messages.fileLabel)}
                </Text>
              </label>
              <input
                ref={fileInputRef}
                id="bulk-order-file-input"
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={handleFileChange}
                data-test-id="bulk-order-file"
              />
              <Box display="flex" gap={2} alignItems="center">
                <Button
                  variant="secondary"
                  size="small"
                  icon={<UploadCloud size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {intl.formatMessage(messages.chooseCsv)}
                </Button>
                <Text size={2} color={file ? "default1" : "default2"}>
                  {file ? file.name : intl.formatMessage(messages.noFileSelected)}
                </Text>
              </Box>
            </Box>

            <Input
              label={intl.formatMessage(messages.notifyEmailLabel)}
              type="email"
              size="small"
              value={notifyEmail}
              onChange={e => setNotifyEmail(e.target.value)}
              helperText={intl.formatMessage(messages.notifyEmailHint)}
              data-test-id="bulk-order-email"
            />
          </Box>
        )}

        <DashboardModal.Actions>
          {ack ? (
            <BackButton onClick={onClose}>{intl.formatMessage(messages.close)}</BackButton>
          ) : (
            <BackButton onClick={onClose} />
          )}
          {!ack && (
            <ConfirmButton
              transitionState={submitting ? "loading" : "default"}
              disabled={!file || submitting}
              onClick={handleSubmit}
              variant="primary"
              data-test-id="bulk-order-submit"
            >
              {intl.formatMessage(messages.submit)}
            </ConfirmButton>
          )}
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

BulkOrderImportDialogContent.displayName = "BulkOrderImportDialogContent";

// Wrapper renders the dialog content only when `open` is true so React unmounts
// it on close — that handles state reset without a useEffect.
export const BulkOrderImportDialog = ({
  open,
  ...rest
}: BulkOrderImportDialogProps): JSX.Element | null => {
  if (!open) return null;

  return <BulkOrderImportDialogContent {...rest} />;
};

BulkOrderImportDialog.displayName = "BulkOrderImportDialog";
