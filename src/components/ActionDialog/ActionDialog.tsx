import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "@dashboard/components/ConfirmButton";
import { buttonMessages } from "@dashboard/intl";
import { type DialogProps } from "@dashboard/types";
import { Box } from "@saleor/macaw-ui-next";
import type * as React from "react";
import { useIntl } from "react-intl";

import BackButton from "../BackButton";
import { DashboardModal, type DashboardModalContentSize } from "../Modal";
import { type ActionDialogVariant } from "./types";

export interface ActionDialogProps extends DialogProps {
  children?: React.ReactNode;
  confirmButtonLabel?: string;
  confirmButtonState: ConfirmButtonTransitionState;
  /**
   * Skip ConfirmButton's success/error transition. Needed when `disabled` must
   * hold again right after a loading -> default cycle (e.g. a failed request):
   * with the transition on, the button ignores `disabled` until success/error.
   */
  confirmButtonNoTransition?: boolean;
  disabled?: boolean;
  title: string;
  variant?: ActionDialogVariant;
  backButtonText?: string;
  onConfirm: () => any;
  size?: DashboardModalContentSize;
}

const ActionDialog = ({
  children,
  open,
  title,
  onClose,
  variant,
  confirmButtonState,
  confirmButtonNoTransition,
  backButtonText,
  disabled,
  onConfirm,
  confirmButtonLabel,
  size = "sm",
}: ActionDialogProps) => {
  const intl = useIntl();

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size={size}>
        <DashboardModal.Header>{title}</DashboardModal.Header>
        <Box fontSize={3}>{children}</Box>
        <DashboardModal.Actions>
          <BackButton onClick={onClose}>{backButtonText}</BackButton>
          {variant !== "info" && (
            <ConfirmButton
              transitionState={confirmButtonState}
              noTransition={confirmButtonNoTransition}
              disabled={disabled}
              onClick={onConfirm}
              variant={variant === "delete" ? "error" : "primary"}
              data-test-id="submit"
            >
              {confirmButtonLabel ||
                (variant === "delete"
                  ? intl.formatMessage(buttonMessages.delete)
                  : intl.formatMessage(buttonMessages.confirm))}
            </ConfirmButton>
          )}
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

ActionDialog.displayName = "ActionDialog";
export default ActionDialog;
