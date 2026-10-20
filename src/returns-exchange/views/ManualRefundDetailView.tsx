import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Skeleton, Text } from "@saleor/macaw-ui-next";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  fetchManualRefund,
  markManualRefundRefunded,
  saveManualRefundProof,
} from "../api/manualRefundApi";
import { getErrorMessage } from "../api/manualReturnApiError";
import { DetailField } from "../components/DetailField";
import { ManualRefundStatusChip } from "../components/ManualRefundStatusChip";
import { type ManualRefundDetail } from "../types";
import { manualRefundListPath } from "../urls";
import {
  formatDateTime,
  formatMoney,
  REFUND_PAYMENT_MODE_LABELS,
  returnStatusLabel,
} from "../utils/manualReturnStatus";

const PROOF_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

interface ManualRefundDetailViewProps {
  mrfId: string;
}

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box
    as="section"
    borderWidth={1}
    borderColor="default1"
    borderStyle="solid"
    borderRadius={3}
    padding={4}
  >
    <Text as="h2" size={5} fontWeight="bold" display="block" marginBottom={3}>
      {title}
    </Text>
    {children}
  </Box>
);

const Banner = ({ tone, children }: { tone: "red" | "yellow"; children: ReactNode }) => (
  <Box
    role="alert"
    display="flex"
    gap={2}
    borderRadius={2}
    padding={3}
    marginBottom={4}
    style={
      tone === "red"
        ? { background: "#fee2e2", border: "1px solid #fca5a5" }
        : { background: "#fef9c3", border: "1px solid #fde047" }
    }
  >
    <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
    <Box>{children}</Box>
  </Box>
);

const ProofLink = ({ mrf }: { mrf: ManualRefundDetail }) =>
  mrf.proof_url ? (
    <a href={mrf.proof_url} target="_blank" rel="noreferrer">
      {`View proof (uploaded by ${mrf.proof_uploaded_by_name ?? "—"}, ${formatDateTime(mrf.proof_uploaded_at)})`}
    </a>
  ) : null;

export const ManualRefundDetailView = ({ mrfId }: ManualRefundDetailViewProps) => {
  const navigate = useNavigator();
  const [mrf, setMrf] = useState<ManualRefundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Out-of-system payment capture (PRD 5.5 / 5.6)
  const [txnInput, setTxnInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"saving" | "marking" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchManualRefund(mrfId);

        if (cancelled) return;

        setMrf(data);
        setTxnInput(data.txn_reference ?? "");
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
  }, [mrfId, reloadToken]);

  const saveProof = async () => {
    setBusy("saving");
    setActionError(null);

    try {
      setMrf(await saveManualRefundProof(mrfId, txnInput, file));
      setFile(null);

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Could not save the payment proof"));
    } finally {
      setBusy(null);
    }
  };

  const markRefunded = async () => {
    if (!window.confirm(`Mark ${mrfId} as refunded? The customer will see "Refund Completed".`)) {
      return;
    }

    setBusy("marking");
    setActionError(null);

    try {
      setMrf(await markManualRefundRefunded(mrfId));
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Could not mark the refund as refunded"));
    } finally {
      setBusy(null);
    }
  };

  const backButton = (
    <Button
      variant="secondary"
      size="small"
      onClick={() => navigate(manualRefundListPath)}
      marginBottom={4}
    >
      <ArrowLeft size={14} aria-hidden="true" />
      Back to Manual Refunds
    </Button>
  );

  if (loading) {
    return (
      <Box padding={6} aria-busy="true">
        {backButton}
        <Skeleton __height={300} />
      </Box>
    );
  }

  if (error || !mrf) {
    return (
      <Box padding={6}>
        {backButton}
        <Box role="alert" data-test-id="mrf-detail-error" padding={6} textAlign="center">
          <Text as="p" color="critical1" fontWeight="bold" display="block">
            {`Couldn't load ${mrfId}`}
          </Text>
          <Text as="p" size={3} color="default2" display="block" marginBottom={3}>
            {error ?? "Manual refund not found"}
          </Text>
          <Button variant="secondary" size="small" onClick={() => setReloadToken(t => t + 1)}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  const completed = mrf.refund_status === "REFUND_COMPLETED";
  const gatewayName = mrf.payment_mode === "PREPAID" ? "GoKwik" : "Easebuzz";
  const lookFor = mrf.gateway_reference ?? mrf.mrf_id;
  // Closing needs the evidence saved on the server, not just typed in.
  const hasEvidence = Boolean(mrf.txn_reference && mrf.proof_uploaded_at);
  // Same rule as the backend: only once the gateway has failed or is stuck (48 h).
  const canClose = mrf.refund_status === "REFUND_FAILED" || mrf.needs_attention;
  // A typed reference or picked file that isn't saved yet would be silently dropped on close.
  const hasUnsavedProof = file !== null || txnInput.trim() !== (mrf.txn_reference ?? "");

  return (
    <Box padding={6} __maxWidth={1000}>
      {backButton}

      <Box display="flex" alignItems="center" gap={3} flexWrap="wrap" marginBottom={4}>
        <Text as="h1" size={8} fontWeight="bold">
          {mrf.mrf_id}
        </Text>
        <ManualRefundStatusChip status={mrf.refund_status} needsAttention={mrf.needs_attention} />
      </Box>

      {mrf.refund_status === "REFUND_FAILED" && (
        <Banner tone="red">
          <Text size={3} fontWeight="bold" display="block">
            {`Refund failed. Check the ${gatewayName} dashboard for ${lookFor} before paying by hand — the money may already have gone.`}
          </Text>
          {mrf.gateway_message && (
            <Text size={2} display="block" marginTop={1}>
              {`Gateway message: ${mrf.gateway_message}`}
            </Text>
          )}
        </Banner>
      )}

      {mrf.needs_attention && (
        <Banner tone="yellow">
          <Text size={3} display="block">
            {`Not settled after 48 hours. Check the ${gatewayName} dashboard for ${lookFor}.`}
          </Text>
        </Banner>
      )}

      <Box display="grid" gap={5} __gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))">
        <Card title="Refund">
          <DetailField label="Order" value={`#${mrf.order_number}`} />
          <DetailField label="Customer" value={mrf.customer_name} />
          <DetailField label="Delivery note" value={mrf.dn_label} />
          <DetailField
            label="Items"
            value={mrf.items.map(item => `${item.name} × ${item.quantity}`).join(", ")}
          />
          <DetailField label="Amount" value={formatMoney(mrf.amount)} />
          <DetailField label="Payment mode" value={REFUND_PAYMENT_MODE_LABELS[mrf.payment_mode]} />
          <DetailField label="Refund to" value={mrf.destination} />
          <DetailField label={`${gatewayName} reference`} value={mrf.gateway_reference} />
          <DetailField label="Reason" value={mrf.reason} />
          <DetailField label="Raised by" value={mrf.raised_by_name} />
          <DetailField label="Raised on" value={formatDateTime(mrf.created_at)} />
        </Card>

        <Card title="Status history">
          {mrf.status_history.length === 0 ? (
            <Text size={3} color="default2">
              No status written yet
            </Text>
          ) : (
            mrf.status_history.map((entry, i) => (
              <DetailField
                key={i}
                label={formatDateTime(entry.created_at)}
                value={returnStatusLabel(entry.status)}
              />
            ))
          )}
        </Card>
      </Box>

      <Box marginTop={5}>
        {completed ? (
          mrf.closed_at && (
            <Card title="Paid outside the system">
              <DetailField label="Transaction reference" value={mrf.txn_reference} />
              <DetailField label="Payment proof" value={<ProofLink mrf={mrf} />} />
              <DetailField
                label="Closed by"
                value={`${mrf.closed_by_name ?? "—"}, ${formatDateTime(mrf.closed_at)}`}
              />
            </Card>
          )
        ) : (
          <Card title="Record a payment made outside the system">
            <Text size={2} color="default2" display="block" marginBottom={3}>
              Only after the customer has been paid by hand. Save the reference and proof, then mark
              the refund as refunded.
            </Text>
            <Box display="flex" flexDirection="column" gap={3} __maxWidth={480}>
              <Input
                label="Transaction reference (UTR)"
                value={txnInput}
                onChange={event => setTxnInput(event.target.value)}
                size="small"
                data-test-id="mrf-txn-input"
              />
              <Box>
                <Text size={2} color="default2" display="block" marginBottom={1}>
                  Payment proof (PDF or image, max 10 MB)
                </Text>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PROOF_ACCEPT}
                  onChange={event => setFile(event.target.files?.[0] ?? null)}
                  data-test-id="mrf-proof-input"
                />
              </Box>
              <ProofLink mrf={mrf} />
              {!canClose && (
                <Text size={2} color="default2" display="block">
                  {`${gatewayName} is still processing this refund. You can mark it as refunded once it fails, or after 48 hours.`}
                </Text>
              )}
              {canClose && hasUnsavedProof && (
                <Text size={2} color="default2" display="block">
                  Save proof first — the reference or file above isn&apos;t saved yet.
                </Text>
              )}
              {actionError && (
                <Text size={3} color="critical1" display="block" role="alert">
                  {actionError}
                </Text>
              )}
              <Box display="flex" gap={3}>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => void saveProof()}
                  disabled={!txnInput.trim() || (!file && !mrf.proof_uploaded_at) || busy !== null}
                  data-test-id="mrf-save-proof"
                >
                  {busy === "saving" ? "Saving…" : "Save proof"}
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => void markRefunded()}
                  disabled={!hasEvidence || !canClose || hasUnsavedProof || busy !== null}
                  data-test-id="mrf-mark-refunded"
                >
                  {busy === "marking" ? "Closing…" : "Mark as Refunded"}
                </Button>
              </Box>
            </Box>
          </Card>
        )}
      </Box>
    </Box>
  );
};
