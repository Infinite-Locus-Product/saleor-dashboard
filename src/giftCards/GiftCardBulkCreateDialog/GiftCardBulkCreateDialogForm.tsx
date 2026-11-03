// @ts-strict-ignore
import BackButton from "@dashboard/components/BackButton";
import {
  ConfirmButton,
  type ConfirmButtonTransitionState,
} from "@dashboard/components/ConfirmButton";
import { DashboardModal } from "@dashboard/components/Modal";
import { TimePeriodTypeEnum } from "@dashboard/graphql";
import useForm from "@dashboard/hooks/useForm";
import { TextField } from "@material-ui/core";
import { Text } from "@saleor/macaw-ui-next";
import { useIntl } from "react-intl";

import { GiftCardCreateMoneyInput } from "../GiftCardCreateDialog/GiftCardCreateMoneyInput";
import { giftCardCreateMessages as messages } from "../GiftCardCreateDialog/messages";
import { getGiftCardErrorMessage } from "../GiftCardUpdate/messages";
import { giftCardBulkCreateDialogMessages as bulkMessages } from "./messages";
import {
  type GiftCardBulkCreateFormCommonProps,
  type GiftCardBulkCreateFormData,
  type GiftCardBulkCreateFormErrors,
} from "./types";

const initialData: GiftCardBulkCreateFormData = {
  tags: "",
  balanceAmount: 1,
  balanceCurrency: null,
  expirySelected: false,
  expiryType: "EXPIRY_PERIOD",
  expiryDate: "",
  expiryPeriodType: TimePeriodTypeEnum.MONTH,
  expiryPeriodAmount: 12,
  requiresActivation: false,
  cardsAmount: 100,
  prefix: "",
};

interface GiftCardBulkCreateDialogFormProps {
  opts: { status: ConfirmButtonTransitionState };
  formErrors: GiftCardBulkCreateFormErrors | null;
  onSubmit: (data: GiftCardBulkCreateFormData) => void;
  onClose: () => void;
}

const GiftCardBulkCreateDialogForm = ({
  onSubmit,
  opts,
  onClose,
  formErrors = {},
}: GiftCardBulkCreateDialogFormProps) => {
  const intl = useIntl();
  const { submit, toggleValue, change, data, set } = useForm(
    {
      ...initialData,
      balanceCurrency: "",
    },
    onSubmit,
  );
  const { tags, cardsAmount, prefix } = data;
  const commonFormProps: GiftCardBulkCreateFormCommonProps = {
    data,
    errors: formErrors,
    toggleValue,
    change,
  };

  return (
    <>
      <TextField
        error={!!formErrors?.count}
        name="cardsAmount"
        onChange={change}
        fullWidth
        label={intl.formatMessage(messages.giftCardsAmountLabel)}
        value={cardsAmount}
        helperText={getGiftCardErrorMessage(formErrors?.count, intl)}
      />

      <GiftCardCreateMoneyInput {...commonFormProps} set={set} />

      <TextField
        error={!!formErrors?.tags}
        name="tags"
        onChange={change}
        fullWidth
        label={intl.formatMessage(bulkMessages.batchNameLabel)}
        placeholder="Spinny Diwali 2026"
        value={tags}
        helperText={getGiftCardErrorMessage(formErrors?.tags, intl)}
      />

      <TextField
        error={!!formErrors?.prefix}
        name="prefix"
        onChange={event =>
          change({ target: { name: "prefix", value: event.target.value.toUpperCase() } })
        }
        fullWidth
        label={intl.formatMessage(bulkMessages.prefixLabel)}
        placeholder="TXYSPN"
        value={prefix}
        inputProps={{ maxLength: 6 }}
        helperText={intl.formatMessage(bulkMessages.prefixHelperText)}
      />

      <Text>{intl.formatMessage(bulkMessages.giftVoucherExplanation)}</Text>

      <DashboardModal.Actions>
        <BackButton onClick={onClose} />
        <ConfirmButton
          variant="primary"
          transitionState={opts?.status}
          type={open ? undefined : "submit"}
          onClick={submit}
        >
          {intl.formatMessage(messages.issueButtonLabel)}
        </ConfirmButton>
      </DashboardModal.Actions>
    </>
  );
};

export default GiftCardBulkCreateDialogForm;
