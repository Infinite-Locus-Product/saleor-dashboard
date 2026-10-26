import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Skeleton, Text } from "@saleor/macaw-ui-next";
import { AlertTriangle, ArrowLeft, Info, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { fetchManualReturn } from "../api/manualReturnApi";
import { getErrorMessage } from "../api/manualReturnApiError";
import { DetailField } from "../components/DetailField";
import { ManualReturnStatusChip } from "../components/ManualReturnStatusChip";
import { type ManualReturnDetail } from "../types";
import { manualReturnListPath } from "../urls";
import {
  erpSyncLabel,
  formatDateTime,
  formatMoney,
  overrideReasonLabel,
  PAYMENT_METHOD_LABELS,
  returnStatusLabel,
} from "../utils/manualReturnStatus";

interface ManualReturnDetailViewProps {
  mrId: string;
}

const PROVIDER_LABELS: Record<"EASEBUZZ" | "GOKWIK", string> = {
  EASEBUZZ: "Easebuzz",
  GOKWIK: "GoKwik",
};

interface CardProps {
  testId: string;
  title: string;
  children: ReactNode;
}

const Card = ({ testId, title, children }: CardProps) => {
  const headingId = `${testId}-title`;

  return (
    <Box
      as="section"
      aria-labelledby={headingId}
      data-test-id={testId}
      borderWidth={1}
      borderColor="default1"
      borderStyle="solid"
      borderRadius={3}
      padding={4}
    >
      <Text as="h2" id={headingId} size={5} fontWeight="bold" display="block" marginBottom={3}>
        {title}
      </Text>
      {children}
    </Box>
  );
};

const RefundFailureGuidance = ({ mr }: { mr: ManualReturnDetail }) => {
  const reference = mr.refund.reference_id ?? "unavailable";
  const guidance =
    mr.payment_method === "COD"
      ? `Payout failed — check the Easebuzz dashboard (transfer ID ${reference}) and process the refund manually.`
      : `Refund failed — check the GoKwik dashboard (refund ID ${reference}) and process the refund manually.`;

  return (
    <Box
      role="alert"
      data-test-id="mr-refund-failure-guidance"
      display="flex"
      gap={2}
      borderRadius={2}
      padding={3}
      marginTop={2}
      style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
    >
      <AlertTriangle size={16} color="#b91c1c" aria-hidden="true" style={{ flexShrink: 0 }} />
      <Box>
        <Text as="p" size={3} fontWeight="bold" display="block">
          {guidance}
        </Text>
        {mr.refund.failure_reason && (
          <Text as="p" size={2} display="block" marginTop={1}>
            {`Failure reason: ${mr.refund.failure_reason}`}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export const ManualReturnDetailView = ({ mrId }: ManualReturnDetailViewProps) => {
  const navigate = useNavigator();
  const [mr, setMr] = useState<ManualReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchManualReturn(mrId);

        if (!cancelled) setMr(data);
      } catch (err: unknown) {
        if (!cancelled) setError(getErrorMessage(err, "Request failed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [mrId, reloadToken]);

  const backButton = (
    <Button
      variant="secondary"
      size="small"
      onClick={() => navigate(manualReturnListPath)}
      marginBottom={4}
    >
      <ArrowLeft size={14} aria-hidden="true" />
      Back to Manual Returns
    </Button>
  );

  if (loading) {
    return (
      <Box padding={6} data-test-id="mr-detail-loading" aria-busy="true">
        {backButton}
        <Skeleton __height={300} />
      </Box>
    );
  }

  if (error || !mr) {
    return (
      <Box padding={6}>
        {backButton}
        <Box role="alert" data-test-id="mr-detail-error" padding={6} textAlign="center">
          <Text as="p" color="critical1" fontWeight="bold" display="block">
            {`Couldn't load ${mrId}`}
          </Text>
          <Text as="p" size={3} color="default2" display="block" marginBottom={3}>
            {error ?? "Manual return not found"}
          </Text>
          <Button variant="secondary" size="small" onClick={() => setReloadToken(t => t + 1)}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  const isCod = mr.payment_method === "COD";
  const returnLabel = mr.return_status_label || returnStatusLabel(mr.return_status);
  const refund = mr.refund;
  const refundStatusText =
    refund.status_label || (refund.status ? returnStatusLabel(refund.status) : "Not started");
  const erpFailed = mr.erp_sync_status === "FAILED";

  return (
    <Box padding={6} __maxWidth={1000}>
      {backButton}

      <Box display="flex" alignItems="center" gap={3} flexWrap="wrap" marginBottom={4}>
        <Text as="h1" size={8} fontWeight="bold">
          {mr.mr_id}
        </Text>
        <Box data-test-id="mr-detail-status-chip">
          <ManualReturnStatusChip status={mr.return_status} label={returnLabel} />
        </Box>
      </Box>

      {mr.creation_status === "INCOMPLETE" && (
        <Box
          role="status"
          data-test-id="mr-finalizing-banner"
          display="flex"
          alignItems="center"
          gap={2}
          borderRadius={2}
          padding={3}
          marginBottom={4}
          style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
        >
          <Info size={16} aria-hidden="true" />
          <Text size={3}>
            Finalizing — Saleor return created, remaining steps are being completed.
          </Text>
        </Box>
      )}

      <Box display="grid" gap={5} __gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))">
        <Card testId="mr-card-original-order" title="Original Order">
          <DetailField label="Order #" value={`#${mr.saleor_order_number}`} />
          <DetailField label="Customer" value={mr.customer_name} />
          <DetailField label="Email" value={mr.customer_email} />
          <DetailField label="Phone" value={mr.customer_phone} />
          <DetailField
            label="Payment method"
            value={PAYMENT_METHOD_LABELS[mr.payment_method] ?? mr.payment_method}
          />
        </Card>

        <Card testId="mr-card-items" title="Items Being Returned">
          {mr.lines.map(line => (
            <Box
              key={line.fulfillmentLineId}
              data-test-id="mr-detail-line"
              borderBottomWidth={1}
              borderColor="default1"
              borderStyle="solid"
              marginBottom={3}
            >
              <DetailField label="Product" value={line.productName} />
              <DetailField label="SKU" value={line.sku} />
              <DetailField label="Size" value={line.size} />
              <DetailField
                label="Quantity"
                value={`${line.quantity} of ${line.eligibleQuantity} eligible`}
              />
            </Box>
          ))}
          <DetailField label="Reason for Return" value={mr.return_reason} />
          <DetailField label="Policy Override" value={mr.is_override ? "Yes" : "No"} />
          {mr.is_override && (
            <>
              <DetailField
                label="Override Reasons"
                value={mr.override_reasons.map(overrideReasonLabel).join(", ")}
              />
              <DetailField label="Override Note" value={mr.override_note} />
            </>
          )}
        </Card>

        <Card testId="mr-card-refund" title="Refund">
          <DetailField
            label="Estimated amount"
            value={formatMoney(mr.estimated_refund_amount, mr.currency)}
          />
          <DetailField label="Refund status" value={refundStatusText} />
          {refund.provider && (
            <DetailField label="Provider" value={PROVIDER_LABELS[refund.provider]} />
          )}
          {refund.reference_id && (
            <DetailField
              label={refund.provider === "GOKWIK" || !isCod ? "Refund ID" : "Transfer ID"}
              value={refund.reference_id}
            />
          )}
          {isCod && (
            <>
              <DetailField label="Refund Email" value={mr.refund_email} />
              <DetailField label="Refund UPI" value={mr.refund_upi} />
            </>
          )}
          {refund.status === "REFUND_FAILED" && <RefundFailureGuidance mr={mr} />}
        </Card>

        <Card testId="mr-card-agent" title="Agent Info">
          <DetailField label="Created By" value={mr.cx_agent_name} />
          <DetailField label="Agent email" value={mr.cx_agent_email} />
          <DetailField label="Created" value={formatDateTime(mr.created_at)} />
        </Card>
      </Box>

      <Box
        data-test-id="mr-detail-status-section"
        marginTop={5}
        borderWidth={1}
        borderColor="default1"
        borderStyle="solid"
        borderRadius={3}
        padding={4}
      >
        <DetailField label="Return status" value={returnLabel} />
        <Box display="flex" alignItems="center" gap={1}>
          {erpFailed && <AlertTriangle size={14} color="#b91c1c" aria-hidden="true" />}
          <Text size={3} color={erpFailed ? "critical1" : "default1"}>
            {`ERP sync: ${erpSyncLabel(mr.erp_sync_status)}`}
          </Text>
        </Box>
        {erpFailed && (
          <>
            {mr.erp_sync_last_error && (
              <Text size={2} color="default2" display="block" marginTop={1}>
                {`Last error: ${mr.erp_sync_last_error}`}
              </Text>
            )}
            <Text size={2} color="default2" display="block" marginTop={1}>
              {`Attempts: ${mr.erp_sync_attempts}`}
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
};
