// @ts-strict-ignore
import ActionDialog from "@dashboard/components/ActionDialog";
import CardSpacer from "@dashboard/components/CardSpacer";
import { type INotification } from "@dashboard/components/notifications";
import { useGiftCardPermissions } from "@dashboard/giftCards/hooks/useGiftCardPermissions";
import { useGiftCardAddNoteMutation, useGiftCardUpdateMutation } from "@dashboard/graphql";
import useForm from "@dashboard/hooks/useForm";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { type DialogProps } from "@dashboard/types";
import commonErrorMessages from "@dashboard/utils/errors/common";
import { Input, Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { giftCardsListTableMessages as tableMessages } from "../../GiftCardsList/messages";
import { useDialogFormReset } from "../GiftCardResendCodeDialog/utils";
import { getGiftCardErrorMessage } from "../messages";
import useGiftCardDetails from "../providers/GiftCardDetailsProvider/hooks/useGiftCardDetails";
import { giftCardUpdateBalanceDialogMessages as messages } from "./messages";

interface GiftCardBalanceUpdateFormData {
  balanceAmount: number;
  reason: string;
}

const GiftCardUpdateBalanceDialog = ({ open, onClose }: DialogProps) => {
  const intl = useIntl();
  const notify = useNotifier();
  const { canSeeCreatedBy } = useGiftCardPermissions();
  const {
    giftCard: {
      id,
      currentBalance: { amount, currency },
    },
  } = useGiftCardDetails();
  const initialFormData: GiftCardBalanceUpdateFormData = {
    balanceAmount: amount,
    reason: "",
  };
  const [addNote] = useGiftCardAddNoteMutation();
  const [updateGiftCardBalance, updateGiftCardBalanceOpts] = useGiftCardUpdateMutation({
    onCompleted: data => {
      const errors = data?.giftCardUpdate?.errors;
      const notifierData: INotification = errors?.length
        ? {
            status: "error",
            text: intl.formatMessage(commonErrorMessages.unknownError),
          }
        : {
            status: "success",
            text: intl.formatMessage(messages.updatedSuccessAlertTitle),
          };

      notify(notifierData);

      if (!errors.length) {
        onClose();
      }
    },
  });
  const handleSubmit = async ({ balanceAmount, reason }: GiftCardBalanceUpdateFormData) => {
    // currentBalanceAmount keeps the initial balance (the voucher's value).
    const result = await updateGiftCardBalance({
      variables: {
        id,
        input: {
          currentBalanceAmount: balanceAmount,
        },
        showCreatedBy: canSeeCreatedBy,
      },
    });
    const errors = result?.data?.giftCardUpdate?.errors;

    if (!errors?.length) {
      await addNote({
        variables: {
          id,
          input: { message: `Balance adjusted to ${balanceAmount} ${currency}. Reason: ${reason}` },
        },
      });
    }

    return errors;
  };
  const { data, change, submit, reset } = useForm(initialFormData, handleSubmit);
  const { loading, status, data: submitData } = updateGiftCardBalanceOpts;
  const { formErrors } = useDialogFormReset({
    open,
    reset,
    keys: ["currentBalanceAmount"],
    apiErrors: submitData?.giftCardUpdate?.errors,
  });

  return (
    <ActionDialog
      open={open}
      onConfirm={submit}
      confirmButtonLabel={intl.formatMessage(messages.changeButtonLabel)}
      onClose={onClose}
      title={intl.formatMessage(messages.title)}
      confirmButtonState={status}
      disabled={loading || !data.reason.trim()}
    >
      <Text>{intl.formatMessage(messages.subtitle)}</Text>
      <CardSpacer />
      <Input
        error={!!formErrors?.currentBalanceAmount}
        helperText={getGiftCardErrorMessage(formErrors?.currentBalanceAmount, intl)}
        name="balanceAmount"
        value={data.balanceAmount}
        onChange={change}
        label={intl.formatMessage(tableMessages.giftCardsTableColumnBalanceTitle)}
        min={0}
        endAdornment={
          <Text size={2} fontWeight="light">
            {currency}
          </Text>
        }
        width="100%"
      />
      <CardSpacer />
      <Input
        name="reason"
        value={data.reason}
        onChange={change}
        label={intl.formatMessage(messages.reasonLabel)}
        width="100%"
      />
    </ActionDialog>
  );
};

export default GiftCardUpdateBalanceDialog;
