import { useUser } from "@dashboard/auth/useUser";
import { useNotifier } from "@dashboard/hooks/useNotifier";
import { triggerManualRefund } from "@dashboard/orders/api/manualRefundApi";
import { Button } from "@saleor/macaw-ui-next";
import { useState } from "react";
import { useIntl } from "react-intl";

interface ManualRefundButtonProps {
  orderId: string;
  fulfillmentId: string;
  orderNumber: string;
  amount: number;
}

export const ManualRefundButton = ({
  orderId,
  fulfillmentId,
  orderNumber,
  amount,
}: ManualRefundButtonProps) => {
  const intl = useIntl();
  const notify = useNotifier();
  const { user } = useUser();

  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleClick = async () => {
    // First click arms the confirmation, second click actually fires the refund
    // so ops don't trigger an irreversible refund by accident.
    if (!confirming) {
      setConfirming(true);

      return;
    }

    setConfirming(false);
    setLoading(true);

    try {
      await triggerManualRefund({
        orderId,
        fulfillmentId,
        orderNumber,
        amount,
        reason: "Refunded manually",
        refundedBy: user?.email ?? "unknown",
      });

      notify({
        status: "success",
        text: intl.formatMessage(
          {
            defaultMessage: "Manual refund triggered for order #{orderNumber}",
            id: "x9iS/H",
          },
          { orderNumber },
        ),
      });
    } catch (error) {
      notify({
        status: "error",
        text:
          error instanceof Error
            ? error.message
            : intl.formatMessage({
                defaultMessage: "Failed to trigger manual refund",
                id: "FweFrF",
              }),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={confirming ? "primary" : "secondary"}
      disabled={loading}
      onClick={handleClick}
      onMouseLeave={() => setConfirming(false)}
      data-test-id="trigger-manual-refund"
    >
      {loading
        ? intl.formatMessage({ defaultMessage: "Refunding…", id: "JgitMx" })
        : confirming
          ? intl.formatMessage({ defaultMessage: "Confirm refund?", id: "mM0D67" })
          : intl.formatMessage({ defaultMessage: "Trigger manual refund", id: "NXt/Hw" })}
    </Button>
  );
};
