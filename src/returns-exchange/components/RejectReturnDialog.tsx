import ActionDialog from "@dashboard/components/ActionDialog";
import { Box, Text, Textarea } from "@saleor/macaw-ui-next";
import { useState } from "react";

import { type CXUserAction } from "../types";
import { REJECTION_REASON_MAX, REJECTION_REASON_MIN } from "../utils/cxReturnStatus";

export interface RejectReturnDialogProps {
  open: boolean;
  onClose: () => void;
  /** Receives the trimmed reason. */
  onConfirm: (reason: string) => void;
  submitting: boolean;
  callCount: number;
  lastUserAction: CXUserAction | string | null | undefined;
}

// Static ids: only one reject dialog is ever mounted (React 17 has no useId).
const HINT_ID = "reject-reason-hint";
const COUNTER_ID = "reject-reason-counter";
const HELPER_ID = "reject-reason-helper";

const HELPER_TEXT =
  "This is final and can't be undone. The customer will see 'Return rejected' and can't raise a return or exchange on this item.";

const Warning = ({ children }: { children: string }): JSX.Element => (
  <Box backgroundColor="warning1" borderRadius={3} paddingX={3} paddingY={2}>
    <Text size={2} color="warning1" fontWeight="medium">
      {children}
    </Text>
  </Box>
);

export const RejectReturnDialog = ({
  open,
  onClose,
  onConfirm,
  submitting,
  callCount,
  lastUserAction,
}: RejectReturnDialogProps): JSX.Element => {
  // The parent mounts this dialog per open, so each open starts with an empty reason; a
  // failed submit keeps it mounted, so the typed reason survives.
  const [reason, setReason] = useState("");

  const trimmed = reason.trim();
  const tooLong = trimmed.length > REJECTION_REASON_MAX;
  const tooShort = trimmed.length < REJECTION_REASON_MIN;
  const isValid = !tooShort && !tooLong;
  // "Too short" only counts as an error once the agent has typed something.
  const invalid = tooLong || (tooShort && reason.length > 0);

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      onConfirm={() => {
        if (isValid && !submitting) onConfirm(trimmed);
      }}
      // ConfirmButton ignores `disabled` while in its "loading" state, so keep it at "default"
      // and disable it explicitly; the disabled textarea shows the submit is in flight.
      confirmButtonState="default"
      disabled={!isValid || submitting}
      title="Reject return request"
      confirmButtonLabel="Reject Return"
      variant="delete"
    >
      <Box display="flex" flexDirection="column" gap={3}>
        {callCount === 0 && <Warning>No calls have been logged with this customer.</Warning>}
        {lastUserAction === "Agreed to exchange" && (
          <Warning>The customer agreed to an exchange on the last call.</Warning>
        )}
        <Box display="flex" flexDirection="column" gap={1}>
          <Textarea
            label="Reason for rejection (internal)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            width="100%"
            error={invalid}
            disabled={submitting}
            aria-invalid={invalid}
            aria-describedby={`${HINT_ID} ${COUNTER_ID} ${HELPER_ID}`}
            data-test-id="reject-reason-input"
          />
          <Box display="flex" justifyContent="space-between" gap={2}>
            <Text
              id={HINT_ID}
              size={2}
              color={invalid ? "critical1" : "default2"}
              data-test-id="reject-reason-hint"
            >
              {tooLong
                ? `Maximum ${REJECTION_REASON_MAX} characters`
                : `Minimum ${REJECTION_REASON_MIN} characters`}
            </Text>
            <Text
              id={COUNTER_ID}
              size={2}
              color={tooLong ? "critical1" : "default2"}
              data-test-id="reject-reason-counter"
            >
              {`${trimmed.length}/${REJECTION_REASON_MAX}`}
            </Text>
          </Box>
        </Box>
        <Text id={HELPER_ID} size={2} color="default2">
          {HELPER_TEXT}
        </Text>
      </Box>
    </ActionDialog>
  );
};
