import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Text, Textarea } from "@saleor/macaw-ui-next";
import { ArrowLeft, Search } from "lucide-react";
import { useRef, useState } from "react";

import { createManualRefund, lookupOrderForManualRefund } from "../api/manualRefundApi";
import { getErrorMessage, isManualReturnApiError } from "../api/manualReturnApiError";
import { DetailField } from "../components/DetailField";
import {
  type ManualRefundDeliveryNote,
  type ManualRefundItem,
  type ManualRefundLookup,
  type ManualRefundPaymentMode,
} from "../types";
import { manualRefundDetailPath, manualRefundListPath } from "../urls";
import {
  formatMoney,
  REFUND_PAYMENT_MODE_LABELS,
  returnStatusLabel,
} from "../utils/manualReturnStatus";

const STEPS = ["Order lookup", "Select DN", "Reason", "Review"];
const REASON_MAX = 1000;

const itemsText = (items: ManualRefundItem[]) =>
  items.map(item => `${item.name} × ${item.quantity}`).join(", ");

const lockText = (lock: ManualRefundDeliveryNote["lock"]) =>
  lock
    ? ["Locked", lock.mrfId, lock.refundedBy && `by ${lock.refundedBy}`].filter(Boolean).join(" ")
    : "Not locked";

const StepIndicator = ({ current }: { current: number }) => (
  <Box
    as="ol"
    aria-label="Progress"
    display="flex"
    flexWrap="wrap"
    gap={4}
    marginBottom={5}
    style={{ listStyle: "none", padding: 0 }}
  >
    {STEPS.map((label, index) => {
      const isCurrent = index + 1 === current;

      return (
        <Box as="li" key={label} aria-current={isCurrent ? "step" : undefined}>
          <Text
            size={2}
            fontWeight={isCurrent ? "bold" : "regular"}
            color={isCurrent ? "default1" : "default2"}
          >
            {`${index + 1}. ${label}`}
          </Text>
        </Box>
      );
    })}
  </Box>
);

interface DeliveryNoteCardProps {
  note: ManualRefundDeliveryNote;
  paymentMode: ManualRefundPaymentMode;
  selected: boolean;
  onSelect: () => void;
}

/** PRD 1.8: every delivery note is listed; only an eligible one can be selected. */
const DeliveryNoteCard = ({ note, paymentMode, selected, onSelect }: DeliveryNoteCardProps) => (
  <Box
    as="button"
    type="button"
    disabled={!note.eligible}
    onClick={onSelect}
    aria-pressed={selected}
    data-test-id="mrf-dn-card"
    width="100%"
    textAlign="left"
    borderRadius={3}
    padding={4}
    style={{
      background: "transparent",
      border: selected ? "2px solid #2563eb" : "1px solid #e2e8f0",
      cursor: note.eligible ? "pointer" : "not-allowed",
      opacity: note.eligible ? 1 : 0.6,
    }}
  >
    <Text size={4} fontWeight="bold" display="block">
      {note.label}
    </Text>
    <Text size={2} color="default2" display="block" marginBottom={3}>
      {itemsText(note.items)}
    </Text>
    <Box display="grid" gap={2} __gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))">
      <DetailField label="Payment mode" value={REFUND_PAYMENT_MODE_LABELS[paymentMode]} />
      <DetailField label="Return status" value={returnStatusLabel(note.returnStatus)} />
      <DetailField label="Refund status" value={returnStatusLabel(note.refundStatus)} />
      <DetailField label="Lock" value={lockText(note.lock)} />
      <DetailField label="Refund amount" value={formatMoney(note.amount)} />
      <DetailField label="Refund to" value={note.destination} />
    </Box>
    {!note.eligible && note.ineligibleReason && (
      <Text size={2} color="critical1" display="block">
        {note.ineligibleReason}
      </Text>
    )}
  </Box>
);

export const ManualRefundNewView = () => {
  const navigate = useNavigator();
  const [step, setStep] = useState(1);

  // Step 1 — lookup
  const [orderInput, setOrderInput] = useState("");
  const [lookup, setLookup] = useState<ManualRefundLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 2 — delivery note; Step 3 — reason
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);

  // Step 4 — confirm
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Stops a second click landing before the disabled button re-renders.
  const confirmingRef = useRef(false);

  const selected = lookup?.delivery_notes.find(note => note.fulfillmentId === selectedId) ?? null;
  const reasonError = !reason.trim()
    ? "A reason is required"
    : reason.length > REASON_MAX
      ? `Reason must be ${REASON_MAX} characters or fewer`
      : null;

  const search = async () => {
    const orderNumber = orderInput.trim();

    if (!orderNumber || searching) return;

    setSearching(true);
    setLookupError(null);

    try {
      const result = await lookupOrderForManualRefund(orderNumber);

      setLookup(result);

      // Keep the earlier choice only if it is still on this order and still eligible.
      if (!result.delivery_notes.some(note => note.fulfillmentId === selectedId && note.eligible)) {
        setSelectedId(null);
      }

      setStep(2);
    } catch (err: unknown) {
      setLookup(null);
      setSelectedId(null);
      setLookupError(
        isManualReturnApiError(err) && err.code === "ORDER_NOT_FOUND"
          ? `No order found for "${orderNumber}"`
          : getErrorMessage(err, "Order lookup failed"),
      );
    } finally {
      setSearching(false);
    }
  };

  const confirm = async () => {
    if (!lookup || !selected || reasonError || confirmingRef.current) return;

    confirmingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const mrf = await createManualRefund({
        order_number: lookup.order_number,
        fulfillment_id: selected.fulfillmentId,
        reason: reason.trim(),
      });

      navigate(manualRefundDetailPath(mrf.mrf_id));
    } catch (err: unknown) {
      // The backend lock blocks a real repeat, so retrying after an error is safe.
      setSubmitError(getErrorMessage(err, "The refund could not be created"));
      confirmingRef.current = false;
      setSubmitting(false);
    }
  };

  const nextFromReason = () => {
    setReasonTouched(true);

    if (!reasonError) setStep(4);
  };

  const gatewayName = lookup?.payment_mode === "PREPAID" ? "GoKwik" : "Easebuzz";

  return (
    <Box padding={6} __maxWidth={900}>
      <Button
        variant="secondary"
        size="small"
        onClick={() => navigate(manualRefundListPath)}
        marginBottom={4}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Manual Refunds
      </Button>

      <Text as="h1" size={8} fontWeight="bold" display="block" marginBottom={3}>
        Create Manual Refund
      </Text>

      <StepIndicator current={step} />

      {step === 1 && (
        <Box>
          <Box display="flex" gap={3} alignItems="flex-end">
            <Box __flexGrow="1">
              <Input
                label="Order ID"
                placeholder="e.g. 72666"
                value={orderInput}
                onChange={event => setOrderInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") void search();
                }}
                size="small"
                data-test-id="mrf-order-input"
              />
            </Box>
            <Button
              variant="primary"
              size="small"
              onClick={() => void search()}
              disabled={!orderInput.trim() || searching}
              data-test-id="mrf-search-button"
            >
              <Search size={14} aria-hidden="true" />
              {searching ? "Searching…" : "Search"}
            </Button>
          </Box>
          {lookupError && (
            <Text
              size={3}
              color="critical1"
              display="block"
              marginTop={3}
              role="alert"
              data-test-id="mrf-lookup-error"
            >
              {lookupError}
            </Text>
          )}
        </Box>
      )}

      {step === 2 && lookup && (
        <Box>
          <Text size={3} color="default2" display="block" marginBottom={4}>
            {`Order #${lookup.order_number} · ${lookup.customer_name || "—"} · ${REFUND_PAYMENT_MODE_LABELS[lookup.payment_mode]}`}
          </Text>
          {lookup.delivery_notes.length === 0 ? (
            <Text color="default2">This order has no delivery notes.</Text>
          ) : (
            <>
              {!lookup.delivery_notes.some(note => note.eligible) && (
                <Text size={3} color="critical1" display="block" marginBottom={3} role="alert">
                  None of these delivery notes can be refunded. An active return is required.
                </Text>
              )}
              <Box display="flex" flexDirection="column" gap={3}>
                {lookup.delivery_notes.map(note => (
                  <DeliveryNoteCard
                    key={note.fulfillmentId}
                    note={note}
                    paymentMode={lookup.payment_mode}
                    selected={note.fulfillmentId === selectedId}
                    onSelect={() => setSelectedId(note.fulfillmentId)}
                  />
                ))}
              </Box>
            </>
          )}
        </Box>
      )}

      {step === 3 && (
        <Box>
          <Textarea
            label="Reason for manual refund"
            value={reason}
            onChange={event => setReason(event.target.value)}
            onBlur={() => setReasonTouched(true)}
            error={reasonTouched && Boolean(reasonError)}
            data-test-id="mrf-reason"
          />
          <Text
            size={2}
            color={reasonTouched && reasonError ? "critical1" : "default2"}
            display="block"
            marginTop={1}
          >
            {reasonTouched && reasonError ? reasonError : `${reason.length}/${REASON_MAX}`}
          </Text>
        </Box>
      )}

      {step === 4 && lookup && selected && (
        <Box
          borderWidth={1}
          borderColor="default1"
          borderStyle="solid"
          borderRadius={3}
          padding={4}
          data-test-id="mrf-review"
        >
          <DetailField label="Order" value={`#${lookup.order_number}`} />
          <DetailField label="Customer" value={lookup.customer_name} />
          <DetailField label="Delivery note" value={selected.label} />
          <DetailField label="Items" value={itemsText(selected.items)} />
          <DetailField
            label="Payment mode"
            value={REFUND_PAYMENT_MODE_LABELS[lookup.payment_mode]}
          />
          <DetailField label="Refund to" value={selected.destination} />
          <DetailField label="Refund amount" value={formatMoney(selected.amount)} />
          <DetailField label="Reason" value={reason.trim()} />
          <Text size={2} color="default2" display="block" marginTop={2}>
            {`Confirming sends ${formatMoney(selected.amount)} through ${gatewayName} straight away and locks this delivery note. It can't be undone.`}
          </Text>
          {submitError && (
            <Text
              size={3}
              color="critical1"
              display="block"
              marginTop={3}
              role="alert"
              data-test-id="mrf-submit-error"
            >
              {submitError}
            </Text>
          )}
        </Box>
      )}

      <Box display="flex" justifyContent="space-between" marginTop={5}>
        {step > 1 ? (
          <Button
            variant="secondary"
            size="small"
            onClick={() => setStep(step - 1)}
            disabled={submitting}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        {step === 2 && (
          <Button variant="primary" size="small" onClick={() => setStep(3)} disabled={!selected}>
            Next
          </Button>
        )}
        {step === 3 && (
          <Button variant="primary" size="small" onClick={nextFromReason}>
            Next
          </Button>
        )}
        {step === 4 && (
          <Button
            variant="primary"
            size="small"
            onClick={() => void confirm()}
            disabled={submitting}
            data-test-id="mrf-confirm-button"
          >
            {submitting ? "Sending refund…" : "Confirm refund"}
          </Button>
        )}
      </Box>
    </Box>
  );
};
