import ActionDialog from "@dashboard/components/ActionDialog";
import { useAddressValidation } from "@dashboard/components/AddressEdit/useAddressValidation";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Combobox, Input, Select, Skeleton, Text } from "@saleor/macaw-ui-next";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import {
  fetchHeldOrderDetail,
  submitCancel,
  submitLogCall,
  submitMarkUnreachable,
  submitRelease,
  submitSendPaymentLink,
  submitUpdateAddress,
} from "../api/codHoldApi";
import { CxStatusChip } from "../components/CxStatusChip";
import { SLABadge } from "../components/SLABadge";
import { StatusChip } from "../components/StatusChip";
import {
  type CodHoldCallOutcome,
  type CodHoldOrderDetail,
  type CodHoldShippingAddress,
} from "../types";
import { codHoldQueuePath } from "../urls";

interface OrderDetailViewProps {
  holdId: string;
}

type ActiveAction =
  | "cancel"
  | "updateAddress"
  | "sendPaymentLink"
  | "release"
  | "logCall"
  | "markUnreachable"
  | null;

const EMPTY_ADDRESS: CodHoldShippingAddress = {
  firstName: "",
  lastName: "",
  streetAddress1: "",
  streetAddress2: "",
  city: "",
  postalCode: "",
  countryArea: "",
  country: "IN",
  phone: "",
};

const OUTCOME_OPTIONS: { value: CodHoldCallOutcome | ""; label: string }[] = [
  { value: "", label: "Select outcome…" },
  { value: "ANSWERED", label: "Answered" },
  { value: "NO_ANSWER", label: "No Answer" },
  { value: "BUSY", label: "Busy" },
  { value: "CALLBACK_REQUESTED", label: "Callback Requested" },
];

const OUTCOME_LABELS: Record<CodHoldCallOutcome, string> = {
  ANSWERED: "Answered",
  NO_ANSWER: "No Answer",
  BUSY: "Busy",
  CALLBACK_REQUESTED: "Callback Requested",
};

export const OrderDetailView = ({ holdId }: OrderDetailViewProps) => {
  const navigate = useNavigator();
  const [detail, setDetail] = useState<CodHoldOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [note, setNote] = useState("");
  const [address, setAddress] = useState<CodHoldShippingAddress>(EMPTY_ADDRESS);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const { areas: countryAreaChoices, getDisplayValue: getCountryAreaDisplayValue } =
    useAddressValidation(address.country);

  // Log Call dialog state
  const [callOutcome, setCallOutcome] = useState<CodHoldCallOutcome | "">("");
  const [customerDecision, setCustomerDecision] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [callbackAt, setCallbackAt] = useState("");

  // Shared by the initial load and by re-opening the Update Address dialog
  // (M1) — always derived fresh from the live snapshot, never left as
  // whatever the form happened to hold from a previous, unsaved edit.
  const buildAddressFromSnapshot = (
    snapshot: CodHoldOrderDetail["orderSnapshot"] | undefined,
  ): CodHoldShippingAddress => {
    const a = snapshot?.shippingAddress;

    if (!a) return EMPTY_ADDRESS;

    return {
      firstName: a.firstName || "",
      lastName: a.lastName || "",
      streetAddress1: a.streetAddress1,
      streetAddress2: a.streetAddress2,
      city: a.city,
      postalCode: a.postalCode,
      countryArea: a.countryArea || "",
      country: a.country?.code || "IN",
      phone: a.phone,
    };
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchHeldOrderDetail(holdId);

      setDetail(result);
      setAddress(buildAddressFromSnapshot(result.orderSnapshot));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [holdId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeDialog = () => {
    // M2 — a request is still in flight; closing now would both race the
    // in-progress submit and strand its eventual error with nothing open to
    // show it. Block the close until the request settles.
    if (submitting) return;

    setActiveAction(null);
    setNote("");
    setActionError(null);
    setPaymentLinkUrl(null);
    setCallOutcome("");
    setCustomerDecision("");
    setCallNotes("");
    setCallbackAt("");
  };

  // M2 — every dialog open clears any actionError left over from a previous
  // dialog, so a stale error can't reappear on an unrelated action. Also
  // handles M1's address refill for Update Address specifically.
  const openDialog = (action: Exclude<ActiveAction, null>) => {
    setActionError(null);

    if (action === "updateAddress") {
      setAddress(buildAddressFromSnapshot(detail?.orderSnapshot));
    }

    setActiveAction(action);
  };

  const isHeld = detail?.status === "HELD";
  // Confirm/Cancel/Convert-to-Prepaid/Change-Address stay disabled until at
  // least one call has been logged with outcome Answered (AC-36: all four
  // enable together the moment the gate is satisfied). Trust the backend's
  // callLogGateSatisfied field rather than recomputing it from callLogs.
  const gateSatisfied = detail?.callLogGateSatisfied ?? false;
  const resolutionActionsDisabled = !isHeld || !gateSatisfied;

  const validateLogCall = (): string | null => {
    if (!callOutcome) return "Please select an outcome.";

    if (callOutcome === "ANSWERED" && !customerDecision.trim()) {
      return "Customer decision is required when the outcome is Answered.";
    }

    if (callOutcome === "CALLBACK_REQUESTED" && !callbackAt) {
      return "Callback date/time is required when the outcome is Callback Requested.";
    }

    if (!callNotes.trim()) return "Notes are required.";

    return null;
  };

  const handleConfirm = async () => {
    if (!detail) return;

    const requiresNote =
      activeAction === "cancel" ||
      activeAction === "updateAddress" ||
      activeAction === "sendPaymentLink";

    if (requiresNote && !note.trim()) {
      setActionError("A note is required for this action.");

      return;
    }

    if (activeAction === "updateAddress") {
      // H3 — only firstName is required; real storefront orders save an
      // empty lastName for single-word customer names, and requiring both
      // blocked Update Address entirely for those orders.
      if (!address.firstName.trim()) {
        setActionError("First name is required.");

        return;
      }

      if (!address.countryArea.trim()) {
        setActionError("State (countryArea) is required for this address.");

        return;
      }
    }

    if (activeAction === "logCall") {
      const validationError = validateLogCall();

      if (validationError) {
        setActionError(validationError);

        return;
      }
    }

    setSubmitting(true);
    setActionError(null);

    try {
      if (activeAction === "cancel") {
        await submitCancel(detail.id, note);
        closeDialog();
        await load();
      } else if (activeAction === "release") {
        await submitRelease(detail.id, note);
        closeDialog();
        await load();
      } else if (activeAction === "updateAddress") {
        await submitUpdateAddress(detail.id, address, note);
        closeDialog();
        await load();
      } else if (activeAction === "sendPaymentLink") {
        const snapshot = detail.orderSnapshot;

        const result = await submitSendPaymentLink(detail.id, note, {
          customerName: snapshot?.shippingAddress
            ? `${snapshot.shippingAddress.firstName} ${snapshot.shippingAddress.lastName}`.trim()
            : "",
          customerPhone: snapshot?.shippingAddress?.phone || "",
          customerEmail: snapshot?.userEmail || "",
          amount: snapshot?.total?.gross?.amount || 0,
          orderNumber: detail.orderNumber,
        });

        // S5 — no auto-retry on failure (handled by the catch block below);
        // on success, show the link instead of closing immediately so the
        // agent can confirm it was sent before dismissing.
        setPaymentLinkUrl(result.paymentLinkUrl);
        await load();
      } else if (activeAction === "logCall") {
        await submitLogCall(detail.id, {
          outcome: callOutcome as CodHoldCallOutcome,
          customerDecision: callOutcome === "ANSWERED" ? customerDecision.trim() : undefined,
          notes: callNotes.trim(),
          callbackAt:
            callOutcome === "CALLBACK_REQUESTED" ? new Date(callbackAt).toISOString() : undefined,
        });
        closeDialog();
        await load();
      } else if (activeAction === "markUnreachable") {
        await submitMarkUnreachable(detail.id);
        closeDialog();
        await load();
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box padding={6} display="flex" flexDirection="column" gap={2}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} __height={32} />
        ))}
      </Box>
    );
  }

  if (error || !detail) {
    return (
      <Box padding={8} textAlign="center">
        <Text color="critical1">{error || "Order not found"}</Text>
        <Box marginTop={4}>
          <Button variant="secondary" size="small" onClick={() => navigate(codHoldQueuePath)}>
            Back to queue
          </Button>
        </Box>
      </Box>
    );
  }

  const snapshot = detail.orderSnapshot;

  return (
    <Box padding={6}>
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={6}>
        <Box>
          <Text size={8} fontWeight="bold">
            Order #{detail.orderNumber}
          </Text>
          <Box display="flex" alignItems="center" gap={3} marginTop={2} flexWrap="wrap">
            <StatusChip status={detail.status} />
            {detail.slaTier && <SLABadge tier={detail.slaTier} />}
            <CxStatusChip status={detail.internalCxStatus} />
            <Text size={3} color="default2">
              Assigned to {detail.assignedAgentEmail || "—"}
            </Text>
            <Text size={3} color="default2">
              Held: {new Date(detail.heldAt).toLocaleString()}
            </Text>
            {detail.unreachableMarkedAt && (
              <Text size={3} color="critical1" fontWeight="bold">
                Unreachable
              </Text>
            )}
          </Box>
        </Box>
        <Button variant="secondary" size="small" onClick={() => navigate(codHoldQueuePath)}>
          Back to queue
        </Button>
      </Box>

      <Box display="flex" gap={6} marginBottom={6}>
        {/* Customer / address */}
        <Box
          __flexGrow="1"
          borderWidth={1}
          borderStyle="solid"
          borderColor="default1"
          borderRadius={3}
          padding={4}
        >
          <Text size={4} fontWeight="bold" display="block" marginBottom={3}>
            Customer & Shipping
          </Text>
          {snapshot ? (
            <>
              <Text size={3}>
                {snapshot.shippingAddress &&
                (snapshot.shippingAddress.firstName.trim() ||
                  snapshot.shippingAddress.lastName.trim())
                  ? `${snapshot.shippingAddress.firstName} ${snapshot.shippingAddress.lastName}`.trim()
                  : "—"}
              </Text>
              <Text size={3} color="default2" display="block">
                {snapshot.userEmail} · {snapshot.shippingAddress?.phone}
              </Text>
              <Text size={3} color="default2" display="block" marginTop={2}>
                {snapshot.shippingAddress?.streetAddress1}
                {snapshot.shippingAddress?.streetAddress2
                  ? `, ${snapshot.shippingAddress.streetAddress2}`
                  : ""}
                , {snapshot.shippingAddress?.city} {snapshot.shippingAddress?.postalCode}
              </Text>
              <Text size={3} color="default2" display="block" marginTop={3}>
                Matched on: {detail.matchedPincode ? `pincode ${detail.matchedPincode}` : ""}
                {detail.matchedPincode && detail.matchedPhone ? ", " : ""}
                {detail.matchedPhone ? `phone ${detail.matchedPhone}` : ""}
              </Text>
              <Text size={4} fontWeight="bold" display="block" marginTop={3}>
                Order Value:{" "}
                {snapshot.total?.gross
                  ? `${snapshot.total.gross.amount} ${snapshot.total.gross.currency}`
                  : "—"}
              </Text>
            </>
          ) : (
            <Text size={3} color="default2">
              Order details are temporarily unavailable from Saleor.
            </Text>
          )}
        </Box>

        {/* Call log history */}
        <Box
          __flexGrow="1"
          borderWidth={1}
          borderStyle="solid"
          borderColor="default1"
          borderRadius={3}
          padding={4}
        >
          <Text size={4} fontWeight="bold" display="block" marginBottom={3}>
            Call Log History ({detail.callLogs.length})
          </Text>
          {detail.callLogs.length === 0 ? (
            <Text size={3} color="default2">
              No actions logged yet.
            </Text>
          ) : (
            <Box display="flex" flexDirection="column" gap={3}>
              {detail.callLogs.map(log => (
                <Box
                  key={log.id}
                  borderBottomWidth={1}
                  borderColor="default1"
                  borderStyle="solid"
                  paddingBottom={2}
                >
                  {log.outcome ? (
                    <>
                      <Text size={3} fontWeight="bold">
                        Call logged: {OUTCOME_LABELS[log.outcome] ?? log.outcome}
                      </Text>
                      <Text size={2} color="default2" display="block">
                        {log.agentEmail} · {new Date(log.createdAt).toLocaleString()}
                      </Text>
                      {log.customerDecision && (
                        <Text size={3} display="block" marginTop={1}>
                          Customer decision: {log.customerDecision}
                        </Text>
                      )}
                      <Text size={3} display="block" marginTop={1}>
                        {log.note}
                      </Text>
                      {log.callbackAt && (
                        <Text size={2} color="default2" display="block" marginTop={1}>
                          Callback at {new Date(log.callbackAt).toLocaleString()}
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text size={3} fontWeight="bold">
                        {(log.action ?? "").replace(/_/g, " ")}
                      </Text>
                      <Text size={2} color="default2" display="block">
                        {log.agentEmail} · {new Date(log.createdAt).toLocaleString()}
                      </Text>
                      <Text size={3} display="block" marginTop={1}>
                        {log.note}
                      </Text>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Actions */}
      <Box display="flex" gap={3} flexWrap="wrap" alignItems="center">
        <Button
          variant="secondary"
          disabled={resolutionActionsDisabled}
          onClick={() => openDialog("cancel")}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          disabled={resolutionActionsDisabled}
          onClick={() => openDialog("updateAddress")}
        >
          Update Address
        </Button>
        {detail.sendPaymentLinkEnabled && (
          <Button
            variant="secondary"
            disabled={resolutionActionsDisabled}
            onClick={() => openDialog("sendPaymentLink")}
          >
            Convert to Prepaid
          </Button>
        )}
        <Button
          variant="primary"
          disabled={resolutionActionsDisabled}
          onClick={() => openDialog("release")}
        >
          Confirm Order
        </Button>

        <Button variant="secondary" disabled={!isHeld} onClick={() => openDialog("logCall")}>
          Log Call
        </Button>
        <Button
          variant="secondary"
          disabled={!isHeld || !!detail.unreachableMarkedAt}
          onClick={() => openDialog("markUnreachable")}
        >
          {detail.unreachableMarkedAt ? "Marked Unreachable" : "Mark Unreachable"}
        </Button>

        {isHeld && !gateSatisfied && (
          <Text size={2} color="critical1">
            Log at least one call with outcome Answered before Cancel, Update Address, Convert to
            Prepaid, or Confirm Order become available.
          </Text>
        )}
      </Box>

      {/* Cancel dialog */}
      <ActionDialog
        open={activeAction === "cancel"}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        confirmButtonState={submitting ? "loading" : "default"}
        title="Cancel order"
        confirmButtonLabel="Cancel order"
      >
        <NoteField note={note} onChange={setNote} error={actionError} />
      </ActionDialog>

      {/* Confirm Order (release) dialog — AC-37 explicit confirmation step:
          this creates the order in ERP for the first time and can't be undone. */}
      <ActionDialog
        open={activeAction === "release"}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        confirmButtonState={submitting ? "loading" : "default"}
        title="Confirm order"
        confirmButtonLabel="Confirm order"
      >
        <Text size={3} display="block" marginBottom={3}>
          Confirm this order? This creates the order in ERP for the first time and cannot be undone.
        </Text>
        <NoteField note={note} onChange={setNote} error={actionError} />
      </ActionDialog>

      {/* Update address dialog */}
      <ActionDialog
        open={activeAction === "updateAddress"}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        confirmButtonState={submitting ? "loading" : "default"}
        title="Update shipping address"
        confirmButtonLabel="Save address"
        size="md"
      >
        <Box display="flex" flexDirection="column" gap={3}>
          <Box display="flex" gap={3}>
            <Input
              label="First name"
              value={address.firstName}
              onChange={e => setAddress({ ...address, firstName: e.target.value })}
            />
            <Input
              label="Last name"
              value={address.lastName}
              onChange={e => setAddress({ ...address, lastName: e.target.value })}
            />
          </Box>
          <Input
            label="Street address 1"
            value={address.streetAddress1}
            onChange={e => setAddress({ ...address, streetAddress1: e.target.value })}
          />
          <Input
            label="Street address 2"
            value={address.streetAddress2 || ""}
            onChange={e => setAddress({ ...address, streetAddress2: e.target.value })}
          />
          <Box display="flex" gap={3}>
            <Input
              label="City"
              value={address.city}
              onChange={e => setAddress({ ...address, city: e.target.value })}
            />
            <Input
              label="Postal code"
              value={address.postalCode}
              onChange={e => setAddress({ ...address, postalCode: e.target.value })}
            />
          </Box>
          <Combobox
            label="State"
            options={countryAreaChoices}
            value={{
              label: getCountryAreaDisplayValue(address.countryArea),
              value: address.countryArea,
            }}
            onChange={v => setAddress({ ...address, countryArea: v?.value ?? "" })}
          />
          <Input
            label="Phone"
            value={address.phone}
            onChange={e => setAddress({ ...address, phone: e.target.value })}
          />
          <NoteField note={note} onChange={setNote} error={actionError} />
        </Box>
      </ActionDialog>

      {/* Convert to Prepaid (send payment link) dialog — feature retired behind
          its own flag, independent of the now-standing automatic GoKwik flow;
          not rendered at all when disabled, not just gated by the trigger
          button above. AC-37 explicit confirmation step, same as Confirm Order. */}
      {detail.sendPaymentLinkEnabled && (
        <ActionDialog
          open={activeAction === "sendPaymentLink"}
          onClose={closeDialog}
          onConfirm={paymentLinkUrl ? closeDialog : handleConfirm}
          confirmButtonState={submitting ? "loading" : "default"}
          title="Convert to Prepaid"
          confirmButtonLabel={paymentLinkUrl ? "Done" : "Send link"}
        >
          {paymentLinkUrl ? (
            <Text size={3} color="success1">
              Payment link sent via WhatsApp: {paymentLinkUrl}
            </Text>
          ) : (
            <>
              <Text size={3} display="block" marginBottom={3}>
                Generate a payment link and send it to the customer&apos;s registered mobile number?
                This cannot be undone.
              </Text>
              <NoteField note={note} onChange={setNote} error={actionError} />
            </>
          )}
        </ActionDialog>
      )}

      {/* Log Call dialog */}
      <ActionDialog
        open={activeAction === "logCall"}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        confirmButtonState={submitting ? "loading" : "default"}
        title="Log call"
        confirmButtonLabel="Save call log"
        size="md"
      >
        <Box display="flex" flexDirection="column" gap={3}>
          <Box>
            <Text size={3} display="block" marginBottom={1} fontWeight="bold">
              Outcome *
            </Text>
            <Select
              value={callOutcome}
              onChange={v => {
                const next = v as CodHoldCallOutcome | "";

                setCallOutcome(next);

                if (next !== "ANSWERED") setCustomerDecision("");

                if (next !== "CALLBACK_REQUESTED") setCallbackAt("");
              }}
              options={OUTCOME_OPTIONS}
            />
          </Box>

          {callOutcome === "ANSWERED" && (
            <Input
              label="Customer decision"
              value={customerDecision}
              onChange={e => setCustomerDecision(e.target.value)}
            />
          )}

          {callOutcome === "CALLBACK_REQUESTED" && (
            <Input
              type="datetime-local"
              label="Callback date & time"
              value={callbackAt}
              onChange={e => setCallbackAt(e.target.value)}
            />
          )}

          <Box>
            <Text size={2} color="default2" display="block" marginBottom={1}>
              Notes *
            </Text>
            <Box
              as="textarea"
              aria-label="Notes"
              value={callNotes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCallNotes(e.target.value)}
              __width="100%"
              __minHeight="80px"
              padding={2}
              borderRadius={2}
              borderWidth={1}
              borderStyle="solid"
              borderColor="default1"
            />
          </Box>

          {actionError && (
            <Text size={2} color="critical1" display="block">
              {actionError}
            </Text>
          )}
        </Box>
      </ActionDialog>

      {/* Mark Unreachable dialog */}
      <ActionDialog
        open={activeAction === "markUnreachable"}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        confirmButtonState={submitting ? "loading" : "default"}
        title="Mark unreachable"
        confirmButtonLabel="Mark unreachable"
      >
        <Text size={3} display="block" marginBottom={2}>
          Marking a customer unreachable will auto cancel the order after the configured hold
          duration if no further action is taken.
        </Text>
        {actionError && (
          <Text size={2} color="critical1" display="block">
            {actionError}
          </Text>
        )}
      </ActionDialog>
    </Box>
  );
};

interface NoteFieldProps {
  note: string;
  onChange: (value: string) => void;
  error: string | null;
}

const NoteField = ({ note, onChange, error }: NoteFieldProps) => (
  <Box>
    <Text size={2} color="default2" display="block" marginBottom={1}>
      Note (what did the customer say?)
    </Text>
    <Box
      as="textarea"
      aria-label="Note"
      value={note}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      __width="100%"
      __minHeight="80px"
      padding={2}
      borderRadius={2}
      borderWidth={1}
      borderStyle="solid"
      borderColor="default1"
    />
    {error && (
      <Text size={2} color="critical1" display="block" marginTop={1}>
        {error}
      </Text>
    )}
  </Box>
);
