import ActionDialog from "@dashboard/components/ActionDialog";
import { useAddressValidation } from "@dashboard/components/AddressEdit/useAddressValidation";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Combobox, Input, Skeleton, Text } from "@saleor/macaw-ui-next";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import {
  fetchHeldOrderDetail,
  submitCancel,
  submitRelease,
  submitSendPaymentLink,
  submitUpdateAddress,
} from "../api/codHoldApi";
import { SLABadge } from "../components/SLABadge";
import { StatusChip } from "../components/StatusChip";
import { type CodHoldOrderDetail, type CodHoldShippingAddress } from "../types";
import { codHoldQueuePath } from "../urls";

interface OrderDetailViewProps {
  holdId: string;
}

type ActiveAction = "cancel" | "updateAddress" | "sendPaymentLink" | "release" | null;

const EMPTY_ADDRESS: CodHoldShippingAddress = {
  streetAddress1: "",
  streetAddress2: "",
  city: "",
  postalCode: "",
  countryArea: "",
  country: "IN",
  phone: "",
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchHeldOrderDetail(holdId);

      setDetail(result);

      if (result.orderSnapshot?.shippingAddress) {
        const a = result.orderSnapshot.shippingAddress;

        setAddress({
          streetAddress1: a.streetAddress1,
          streetAddress2: a.streetAddress2,
          city: a.city,
          postalCode: a.postalCode,
          countryArea: a.countryArea || "",
          country: a.country?.code || "IN",
          phone: a.phone,
        });
      }
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
    setActiveAction(null);
    setNote("");
    setActionError(null);
    setPaymentLinkUrl(null);
  };

  const isHeld = detail?.status === "HELD";

  const handleConfirm = async () => {
    if (!detail) return;

    if (activeAction !== "release" && !note.trim()) {
      setActionError("A note is required for this action.");

      return;
    }

    if (activeAction === "updateAddress" && !address.countryArea.trim()) {
      setActionError("State (countryArea) is required for this address.");

      return;
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
          amount: snapshot?.total?.amount || 0,
          orderNumber: detail.orderNumber,
        });

        // S5 — no auto-retry on failure (handled by the catch block below);
        // on success, show the link instead of closing immediately so the
        // agent can confirm it was sent before dismissing.
        setPaymentLinkUrl(result.paymentLinkUrl);
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
          <Box display="flex" alignItems="center" gap={3} marginTop={2}>
            <StatusChip status={detail.status} />
            {detail.slaTier && <SLABadge tier={detail.slaTier} />}
            <Text size={3} color="default2">
              Assigned to {detail.assignedAgentEmail || "—"}
            </Text>
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
                {snapshot.shippingAddress
                  ? `${snapshot.shippingAddress.firstName} ${snapshot.shippingAddress.lastName}`
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
                Total: {snapshot.total?.amount} {snapshot.total?.currency}
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
            Call Log History
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
                  <Text size={3} fontWeight="bold">
                    {log.action.replace(/_/g, " ")}
                  </Text>
                  <Text size={2} color="default2" display="block">
                    {log.agentEmail} · {new Date(log.createdAt).toLocaleString()}
                  </Text>
                  <Text size={3} display="block" marginTop={1}>
                    {log.note}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Actions */}
      <Box display="flex" gap={3} flexWrap="wrap">
        <Button variant="secondary" disabled={!isHeld} onClick={() => setActiveAction("cancel")}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          disabled={!isHeld}
          onClick={() => setActiveAction("updateAddress")}
        >
          Update Address
        </Button>
        <Button
          variant="secondary"
          disabled={!isHeld}
          onClick={() => setActiveAction("sendPaymentLink")}
        >
          Send Payment Link
        </Button>
        <Button variant="primary" disabled={!isHeld} onClick={() => setActiveAction("release")}>
          Release as COD
        </Button>
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

      {/* Release dialog */}
      <ActionDialog
        open={activeAction === "release"}
        onClose={closeDialog}
        onConfirm={handleConfirm}
        confirmButtonState={submitting ? "loading" : "default"}
        title="Release as COD"
        confirmButtonLabel="Release"
      >
        <Text size={3} display="block" marginBottom={3}>
          This order will be processed as a normal COD order and synced to the ERP.
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

      {/* Send payment link dialog */}
      <ActionDialog
        open={activeAction === "sendPaymentLink"}
        onClose={closeDialog}
        onConfirm={paymentLinkUrl ? closeDialog : handleConfirm}
        confirmButtonState={submitting ? "loading" : "default"}
        title="Send payment link"
        confirmButtonLabel={paymentLinkUrl ? "Done" : "Send link"}
      >
        {paymentLinkUrl ? (
          <Text size={3} color="success1">
            Payment link sent via WhatsApp: {paymentLinkUrl}
          </Text>
        ) : (
          <NoteField note={note} onChange={setNote} error={actionError} />
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
