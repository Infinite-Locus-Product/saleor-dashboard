import { MetadataDialog } from "@dashboard/components/MetadataDialog/MetadataDialog";
import { useHandleMetadataSubmit } from "@dashboard/components/MetadataDialog/useHandleMetadataSubmit";
import { useMetadataForm } from "@dashboard/components/MetadataDialog/useMetadataForm";
import { mapFieldArrayToMetadataInput } from "@dashboard/components/MetadataDialog/validation";
import { OrderDetailsDocument, type OrderDetailsFragment } from "@dashboard/graphql";
import { useEffect } from "react";
import { useIntl } from "react-intl";

import { ManualRefundButton } from "./ManualRefundButton";

export type FulfillmentMetadataDialogData = OrderDetailsFragment["fulfillments"][0];

interface OrderFulfillmentMetadataDialogProps {
  open: boolean;
  onClose: () => void;
  fulfillment: FulfillmentMetadataDialogData | undefined;
  order: OrderDetailsFragment | undefined | null;
}

export const OrderFulfillmentMetadataDialog = ({
  onClose,
  open,
  fulfillment,
  order,
}: OrderFulfillmentMetadataDialogProps) => {
  const intl = useIntl();
  const { onSubmit, lastSubmittedData, submitInProgress } = useHandleMetadataSubmit({
    initialData: fulfillment,
    onClose,
    refetchDocument: OrderDetailsDocument,
  });

  const {
    metadataFields,
    privateMetadataFields,
    metadataErrors,
    privateMetadataErrors,
    reset,
    formIsDirty,
    handleChange,
    formData,
  } = useMetadataForm({
    graphqlData: fulfillment,
    submitInProgress,
    lastSubmittedData,
  });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  // Amount refunded for this fulfillment only: sum of each fulfilled line's
  // unit price times the quantity fulfilled (order total may cover other
  // fulfillments / shipping, so we don't use it here).
  const fulfillmentAmount =
    fulfillment?.lines?.reduce((total, line) => {
      const unitPrice = line.orderLine?.unitPrice?.gross?.amount ?? 0;

      return total + unitPrice * (line.quantity ?? 0);
    }, 0) ?? 0;

  return (
    <MetadataDialog
      open={open}
      onClose={onClose}
      onSave={async () => {
        await onSubmit(formData);
      }}
      title={intl.formatMessage({
        defaultMessage: "Fulfillment Metadata",
        id: "lDdWo9",
      })}
      headerAction={
        order && fulfillment ? (
          <ManualRefundButton
            orderId={order.id}
            fulfillmentId={fulfillment.id}
            orderNumber={order.number ?? ""}
            amount={fulfillmentAmount}
          />
        ) : undefined
      }
      data={{
        metadata: mapFieldArrayToMetadataInput(metadataFields),
        privateMetadata: mapFieldArrayToMetadataInput(privateMetadataFields),
      }}
      onChange={handleChange}
      loading={submitInProgress}
      errors={{
        metadata: metadataErrors.length ? metadataErrors.join(", ") : undefined,
        privateMetadata: privateMetadataErrors.length
          ? privateMetadataErrors.join(", ")
          : undefined,
      }}
      formIsDirty={formIsDirty}
    />
  );
};
