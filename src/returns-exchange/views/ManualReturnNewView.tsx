import { getAppMountUri } from "@dashboard/config";
import useNavigator from "@dashboard/hooks/useNavigator";
import { Box, Button, Input, Select, Text, Textarea } from "@saleor/macaw-ui-next";
import { AlertTriangle, ArrowLeft, Check, Minus, Plus, RefreshCw, Search, X } from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createManualReturns,
  fetchReturnReasons,
  lookupOrderForManualReturn,
} from "../api/manualReturnApi";
import { getErrorMessage, isManualReturnApiError } from "../api/manualReturnApiError";
import { DetailField } from "../components/DetailField";
import {
  type CreateManualReturnPayload,
  type CreateManualReturnShipmentResult,
  type LookupItem,
  type LookupResult,
  type LookupShipment,
  type OverrideReason,
  type ReturnReason,
} from "../types";
import { manualReturnDetailPath, manualReturnListPath } from "../urls";
import { generateIdempotencyKey } from "../utils/idempotencyKey";
import {
  CLASSIFICATION_LABELS,
  formatDate,
  formatMoney,
  formatPickupAddress,
  humanizeStatus,
  isValidEmail,
  isValidUpi,
  optionValue,
  OVERRIDE_NOTE_MAX,
  OVERRIDE_NOTE_MIN,
  overrideReasonLabel,
  PAYMENT_METHOD_LABELS,
  type SelectOption,
} from "../utils/manualReturnStatus";

// ─── Types & pure helpers ─────────────────────────────────────────────────────

type Step = "lookup" | "items" | "reason" | "contact" | "review" | "confirmation";
type FormStep = Exclude<Step, "confirmation">;
type SelectableLookupItem = LookupItem & { fulfillmentLineId: string };

interface LookupErrorState {
  kind: "not_found" | "error";
  message: string;
}

interface SubmitErrorState {
  message: string;
  retryable: boolean;
}

interface SelectedLine {
  item: SelectableLookupItem;
  quantity: number;
}

const STEP_LABELS: Record<FormStep, string> = {
  lookup: "Order lookup",
  items: "Select items",
  reason: "Reason",
  contact: "Refund contact",
  review: "Review",
};

const CONFLICT_CODES = ["NOT_ELIGIBLE", "CONCURRENT_SUBMISSION"];
const DEFAULT_CONFLICT_MESSAGE =
  "Some selected items are no longer eligible. Eligibility has been refreshed — review your selection.";

const ERROR_IDS = {
  orderNumber: "mr-error-order-number",
  lookup: "mr-lookup-error",
  reason: "mr-error-reason",
  note: "mr-error-note",
  refundEmail: "mr-error-refund-email",
  refundUpi: "mr-error-refund-upi",
} as const;

const NOTE_COUNTER_ID = "mr-note-counter";

const normalizeOrderNumber = (value: string): string => value.trim().replace(/^#+/, "").trim();

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const allLookupItems = (lookup: LookupResult): LookupItem[] => [
  ...lookup.shipments.flatMap(shipment => shipment.items),
  ...lookup.unfulfilledItems,
];

const isSelectable = (item: LookupItem): item is SelectableLookupItem =>
  item.classification === "eligible" && item.eligibleQuantity > 0 && !!item.fulfillmentLineId;

/** Keeps selections that are still selectable, clamped to the (possibly refreshed) eligible quantity. */
const reconcileSelections = (
  previous: Record<string, number>,
  lookup: LookupResult,
): Record<string, number> =>
  allLookupItems(lookup)
    .filter(isSelectable)
    .reduce<Record<string, number>>((next, item) => {
      const quantity = previous[item.fulfillmentLineId];

      if (quantity && quantity > 0) {
        next[item.fulfillmentLineId] = Math.min(quantity, item.eligibleQuantity);
      }

      return next;
    }, {});

const shipmentHeading = (shipment: LookupShipment, index: number): string => {
  const prefix = `Shipment ${index + 1}`;

  if (shipment.deliveredAt) {
    return `${prefix} · Delivered ${formatDate(shipment.deliveredAt)}`;
  }

  const status = shipment.orderStatus ?? shipment.fulfillmentStatus;

  return status ? `${prefix} · ${humanizeStatus(status)}` : prefix;
};

const deliverySummary = (item: LookupItem): string | null => {
  if (!item.deliveredAt) {
    return null;
  }

  const parts = [`Delivered ${formatDate(item.deliveredAt)}`];

  if (item.daysSinceDelivery !== null) {
    parts.push(
      `${item.daysSinceDelivery} day${item.daysSinceDelivery === 1 ? "" : "s"} since delivery`,
    );
  }

  parts.push(`${item.windowDays}-day window`);

  return parts.join(" · ");
};

const validateNote = (note: string, required: boolean): string | null => {
  const length = note.trim().length;

  if (length > OVERRIDE_NOTE_MAX) {
    return `${required ? "Override note" : "Note"} must be ${OVERRIDE_NOTE_MAX} characters or fewer`;
  }

  if (required && length < OVERRIDE_NOTE_MIN) {
    return `Override note must be at least ${OVERRIDE_NOTE_MIN} characters`;
  }

  return null;
};

const describedBy = (...ids: Array<string | false | null | undefined>): string | undefined => {
  const value = ids.filter(Boolean).join(" ");

  return value || undefined;
};

// ─── Small presentational pieces ─────────────────────────────────────────────

const BADGE_TONES: Record<"success" | "warning" | "neutral", CSSProperties> = {
  success: { background: "#dcfce7", color: "#15803d" },
  warning: { background: "#fef3c7", color: "#92400e" },
  neutral: { background: "#f3f4f6", color: "#4b5563" },
};

const Badge = ({
  tone,
  withIcon = false,
  children,
}: {
  tone: keyof typeof BADGE_TONES;
  withIcon?: boolean;
  children: ReactNode;
}) => (
  <Box
    as="span"
    display="inline-flex"
    alignItems="center"
    gap={1}
    borderRadius={2}
    paddingX={2}
    paddingY={1}
    style={{ ...BADGE_TONES[tone], fontSize: "11px", fontWeight: 600 }}
  >
    {withIcon && <AlertTriangle size={12} aria-hidden="true" />}
    {children}
  </Box>
);

/** Polite live region that always exists so assistive tech announces errors as they appear. */
const ErrorRegion = ({ children }: { children?: ReactNode }) => (
  <Box aria-live="polite" data-test-id="mr-error-region" marginTop={3}>
    {children}
  </Box>
);

const FieldError = ({ id, children }: { id: string; children: ReactNode }) => (
  <Box display="flex" alignItems="center" gap={1} marginBottom={1}>
    <AlertTriangle size={14} color="#b91c1c" aria-hidden="true" />
    <Text as="p" id={id} size={3} color="critical1">
      {children}
    </Text>
  </Box>
);

const StepIndicator = ({ steps, current }: { steps: FormStep[]; current: FormStep }) => (
  <Box
    as="ol"
    aria-label="Progress"
    display="flex"
    flexWrap="wrap"
    gap={4}
    marginBottom={5}
    style={{ listStyle: "none", padding: 0 }}
  >
    {steps.map((stepKey, index) => {
      const isCurrent = stepKey === current;

      return (
        <Box as="li" key={stepKey} aria-current={isCurrent ? "step" : undefined}>
          <Text
            size={2}
            fontWeight={isCurrent ? "bold" : "regular"}
            color={isCurrent ? "default1" : "default2"}
          >
            {`${index + 1}. ${STEP_LABELS[stepKey]}`}
          </Text>
        </Box>
      );
    })}
  </Box>
);

interface ItemRowProps {
  item: LookupItem;
  rowKey: string;
  quantity: number;
  onToggle: (item: SelectableLookupItem, checked: boolean) => void;
  onQuantityChange: (item: SelectableLookupItem, quantity: number) => void;
}

const ItemRow = ({ item, rowKey, quantity, onToggle, onQuantityChange }: ItemRowProps) => {
  // Computed before the type guard below narrows `item` (to `never` in the disabled branch).
  const disabledReasonText = item.disabledReason ?? CLASSIFICATION_LABELS[item.classification];
  const selectable = isSelectable(item);
  const selected = selectable && quantity > 0;
  const checkboxId = `mr-item-${rowKey}`;
  const detailsId = `${checkboxId}-details`;
  const delivery = deliverySummary(item);
  const variantText = [item.size ? `Size ${item.size}` : null, item.colour]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box
      data-test-id="mr-item-row"
      display="flex"
      gap={3}
      flexWrap="wrap"
      padding={3}
      borderWidth={1}
      borderStyle="solid"
      borderColor="default1"
      borderRadius={3}
      style={{ opacity: selectable ? 1 : 0.75 }}
    >
      <Box paddingTop={1}>
        <input
          id={checkboxId}
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          aria-describedby={detailsId}
          data-test-id="mr-item-checkbox"
          onChange={event => {
            if (isSelectable(item)) onToggle(item, event.target.checked);
          }}
          style={{ width: 16, height: 16, cursor: selectable ? "pointer" : "not-allowed" }}
        />
      </Box>

      <Box __flexGrow="1" __minWidth="220px" id={detailsId}>
        <label htmlFor={checkboxId} style={{ cursor: selectable ? "pointer" : "default" }}>
          <Text size={4} fontWeight="bold" data-test-id="mr-item-name">
            {item.productName}
          </Text>
        </label>
        {item.sku && (
          <Text size={2} color="default2" display="block">
            {`SKU: ${item.sku}`}
          </Text>
        )}
        {variantText && (
          <Text size={2} color="default2" display="block">
            {variantText}
          </Text>
        )}
        <Text size={3} display="block" marginTop={1}>
          {formatMoney(item.unitPrice, item.currency)}
        </Text>
        <Box display="flex" flexWrap="wrap" gap={2} marginTop={2}>
          <Badge tone={item.classification === "eligible" ? "success" : "neutral"}>
            {CLASSIFICATION_LABELS[item.classification] ?? humanizeStatus(item.classification)}
          </Badge>
          {item.overrideReasons.map(reason => (
            <Badge key={reason} tone="warning" withIcon>
              {overrideReasonLabel(reason)}
            </Badge>
          ))}
        </Box>
        {delivery && (
          <Text size={2} color="default2" display="block" marginTop={2}>
            {delivery}
          </Text>
        )}
        {!selectable && (
          <Text size={2} display="block" marginTop={2} data-test-id="mr-item-disabled-reason">
            {disabledReasonText}
          </Text>
        )}
      </Box>

      {isSelectable(item) && (
        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={2}>
          {selected && (
            <Box
              role="group"
              aria-label={`Quantity for ${item.productName}`}
              display="flex"
              alignItems="center"
              gap={2}
            >
              <Button
                variant="secondary"
                size="small"
                aria-label={`Decrease quantity for ${item.productName}`}
                data-test-id="mr-qty-decrease"
                disabled={quantity <= 1}
                onClick={() => onQuantityChange(item, quantity - 1)}
              >
                <Minus size={14} aria-hidden="true" />
              </Button>
              <Text size={4} fontWeight="bold" data-test-id="mr-qty-value" aria-live="polite">
                {quantity}
              </Text>
              <Button
                variant="secondary"
                size="small"
                aria-label={`Increase quantity for ${item.productName}`}
                data-test-id="mr-qty-increase"
                disabled={quantity >= item.eligibleQuantity}
                onClick={() => onQuantityChange(item, quantity + 1)}
              >
                <Plus size={14} aria-hidden="true" />
              </Button>
            </Box>
          )}
          <Text size={2} color="default2">
            {`${selected ? quantity : 0} of ${item.eligibleQuantity} eligible`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box
    as="section"
    borderWidth={1}
    borderColor="default1"
    borderStyle="solid"
    borderRadius={3}
    padding={4}
    marginBottom={4}
  >
    <Text as="h3" size={4} fontWeight="bold" display="block" marginBottom={3}>
      {title}
    </Text>
    {children}
  </Box>
);

// ─── View ─────────────────────────────────────────────────────────────────────

export const ManualReturnNewView = () => {
  const navigate = useNavigator();
  const mountedRef = useRef(true);

  const [step, setStep] = useState<Step>("lookup");

  // Step 1 — lookup
  const [orderInput, setOrderInput] = useState("");
  const [orderInputError, setOrderInputError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<LookupErrorState | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  // Step 2 — items (fulfillmentLineId → quantity)
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // Step 3 — reason
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [reasonsLoading, setReasonsLoading] = useState(true);
  const [reasonsError, setReasonsError] = useState<string | null>(null);
  const [reasonsReloadToken, setReasonsReloadToken] = useState(0);
  const [reasonId, setReasonId] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const reasonSelectRef = useRef<HTMLDivElement>(null);

  // Step 4 — refund contact (COD)
  const [refundEmail, setRefundEmail] = useState("");
  const [refundUpi, setRefundUpi] = useState("");

  // Validation is shown per step only after the agent tries to continue.
  const [attempted, setAttempted] = useState<Partial<Record<FormStep, boolean>>>({});

  // Step 5 — review / submit
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<SubmitErrorState | null>(null);
  const [results, setResults] = useState<CreateManualReturnShipmentResult[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadReasons = async () => {
      setReasonsLoading(true);
      setReasonsError(null);

      try {
        const data = await fetchReturnReasons();

        if (!cancelled) setReasons(data);
      } catch (err: unknown) {
        if (!cancelled) setReasonsError(getErrorMessage(err, "Couldn't load return reasons"));
      } finally {
        if (!cancelled) setReasonsLoading(false);
      }
    };

    void loadReasons();

    return () => {
      cancelled = true;
    };
  }, [reasonsReloadToken]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const selectedLines = useMemo<SelectedLine[]>(
    () =>
      lookup
        ? allLookupItems(lookup)
            .filter(isSelectable)
            .filter(item => (selections[item.fulfillmentLineId] ?? 0) > 0)
            .map(item => ({ item, quantity: selections[item.fulfillmentLineId] }))
        : [],
    [lookup, selections],
  );

  const totalUnits = selectedLines.reduce((sum, line) => sum + line.quantity, 0);
  const noteRequired = selectedLines.some(line => line.item.requiresOverride);
  const requiresContact = lookup?.requiresRefundContact === true;
  const currency = lookup?.currency ?? "INR";

  const formSteps: FormStep[] = [
    "lookup",
    "items",
    "reason",
    ...(requiresContact ? (["contact"] as FormStep[]) : []),
    "review",
  ];

  const reasonOptions: SelectOption[] = reasons.map(reason => ({
    value: String(reason.id),
    label: reason.reason,
  }));
  const selectedReasonOption = reasonOptions.find(option => option.value === reasonId) ?? null;

  const reasonError = reasonId ? null : "Select a return reason";
  const noteError = validateNote(overrideNote, noteRequired);
  const showReasonErrors = Boolean(attempted.reason);

  const emailError = !refundEmail.trim()
    ? "Enter the refund email"
    : !isValidEmail(refundEmail)
      ? "Enter a valid email address"
      : null;
  const upiError = !refundUpi.trim()
    ? "Enter the UPI ID"
    : !isValidUpi(refundUpi)
      ? "Enter a valid UPI ID (e.g. name@bank)"
      : null;
  const showContactErrors = Boolean(attempted.contact);

  const overrideReasons: OverrideReason[] = Array.from(
    new Set(selectedLines.flatMap(line => line.item.overrideReasons)),
  );
  const estimatedTotal = roundMoney(
    selectedLines.reduce((sum, line) => sum + line.item.estimatedRefundPerUnit * line.quantity, 0),
  );

  const reasonComboboxError = step === "reason" && showReasonErrors && Boolean(reasonError);

  // Macaw's Select puts extra props on an inner element, not on the focusable
  // combobox, so link the error to the combobox directly.
  useEffect(() => {
    const combobox = reasonSelectRef.current?.querySelector<HTMLElement>('[role="combobox"]');

    if (!combobox) return;

    if (reasonComboboxError) {
      combobox.setAttribute("aria-describedby", ERROR_IDS.reason);
      combobox.setAttribute("aria-invalid", "true");
    } else {
      combobox.removeAttribute("aria-describedby");
      combobox.removeAttribute("aria-invalid");
    }
  }, [reasonComboboxError, step]);

  // ─── Navigation ────────────────────────────────────────────────────────────

  const goTo = (target: Step) => {
    if (target === "review") {
      // Generated once per submission attempt and kept for retries; cleared on success.
      setIdempotencyKey(current => current ?? generateIdempotencyKey());
    } else {
      setSubmitError(null);
    }

    setStep(target);
  };

  const resetAll = () => {
    setStep("lookup");
    setOrderInput("");
    setOrderInputError(null);
    setLookupError(null);
    setLookup(null);
    setSelections({});
    setConflictMessage(null);
    setReasonId("");
    setOverrideNote("");
    setRefundEmail("");
    setRefundUpi("");
    setAttempted({});
    setIdempotencyKey(null);
    setSubmitError(null);
    setResults([]);
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const applyLookup = (data: LookupResult) => {
    if (lookup && lookup.orderNumber === data.orderNumber) {
      setSelections(previous => reconcileSelections(previous, data));
    } else {
      setSelections({});
      setReasonId("");
      setOverrideNote("");
      setRefundEmail("");
      setRefundUpi("");
      setAttempted({});
      setIdempotencyKey(null);
    }

    setConflictMessage(null);
    setLookup(data);
  };

  const runLookup = async () => {
    const orderNumber = normalizeOrderNumber(orderInput);

    if (!orderNumber) {
      setLookupError(null);
      setOrderInputError("Enter an order number");

      return;
    }

    setOrderInputError(null);
    setLookupError(null);
    setLookupLoading(true);

    try {
      const data = await lookupOrderForManualReturn(orderNumber);

      if (!mountedRef.current) return;

      applyLookup(data);
      goTo("items");
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      if (isManualReturnApiError(err) && err.status === 404) {
        setLookupError({ kind: "not_found", message: `Order #${orderNumber} not found` });
      } else {
        setLookupError({ kind: "error", message: getErrorMessage(err, "Request failed") });
      }
    } finally {
      if (mountedRef.current) setLookupLoading(false);
    }
  };

  const handleToggle = (item: SelectableLookupItem, checked: boolean) => {
    setSelections(previous => {
      if (checked) {
        return { ...previous, [item.fulfillmentLineId]: previous[item.fulfillmentLineId] || 1 };
      }

      return Object.fromEntries(
        Object.entries(previous).filter(([key]) => key !== item.fulfillmentLineId),
      );
    });
  };

  const handleQuantityChange = (item: SelectableLookupItem, quantity: number) => {
    const clamped = Math.min(Math.max(quantity, 1), item.eligibleQuantity);

    setSelections(previous => ({ ...previous, [item.fulfillmentLineId]: clamped }));
  };

  const handleReasonNext = () => {
    setAttempted(previous => ({ ...previous, reason: true }));

    if (reasonError || noteError) return;

    goTo(requiresContact ? "contact" : "review");
  };

  const handleContactNext = () => {
    setAttempted(previous => ({ ...previous, contact: true }));

    if (emailError || upiError) return;

    goTo("review");
  };

  const buildPayload = (key: string, order: LookupResult): CreateManualReturnPayload => {
    const payload: CreateManualReturnPayload = {
      order_number: order.orderNumber,
      idempotency_key: key,
      reason_id: Number(reasonId),
      lines: selectedLines.map(line => ({
        fulfillment_line_id: line.item.fulfillmentLineId,
        quantity: line.quantity,
      })),
    };
    const note = overrideNote.trim();

    if (note) {
      payload.override_note = note;
    }

    if (order.requiresRefundContact) {
      payload.refund_email = refundEmail.trim();
      payload.refund_upi = refundUpi.trim();
    }

    return payload;
  };

  const handleConflict = async (order: LookupResult, message: string) => {
    let conflictText = message || DEFAULT_CONFLICT_MESSAGE;

    try {
      const refreshed = await lookupOrderForManualReturn(order.orderNumber);

      if (!mountedRef.current) return;

      setSelections(previous => reconcileSelections(previous, refreshed));
      setLookup(refreshed);
    } catch (err: unknown) {
      conflictText = `${conflictText} Couldn't refresh eligibility: ${getErrorMessage(err, "Request failed")}`;
    }

    if (!mountedRef.current) return;

    setConflictMessage(conflictText);
    goTo("items");
  };

  const handleSubmit = async () => {
    if (!lookup || submittingRef.current) return;

    const key = idempotencyKey ?? generateIdempotencyKey();

    if (!idempotencyKey) setIdempotencyKey(key);

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await createManualReturns(buildPayload(key, lookup));

      if (!mountedRef.current) return;

      setResults(response.results);
      setIdempotencyKey(null);
      setStep("confirmation");
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      if (
        isManualReturnApiError(err) &&
        err.status === 409 &&
        CONFLICT_CODES.includes(err.code ?? "")
      ) {
        await handleConflict(lookup, err.message);
      } else if (isManualReturnApiError(err) && err.status === 409) {
        // SUBMISSION_IN_PROGRESS: the same key is still being processed — retrying is safe.
        setSubmitError({ message: err.message, retryable: true });
      } else if (isManualReturnApiError(err) && err.status < 500) {
        setSubmitError({ message: err.message, retryable: false });
      } else {
        setSubmitError({ message: getErrorMessage(err, "Request failed"), retryable: true });
      }
    } finally {
      submittingRef.current = false;

      if (mountedRef.current) setSubmitting(false);
    }
  };

  const openDetail = (event: MouseEvent<HTMLAnchorElement>, mrId: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

    event.preventDefault();
    navigate(manualReturnDetailPath(mrId));
  };

  // ─── Step renderers ────────────────────────────────────────────────────────

  const renderActions = ({
    onBack,
    onNext,
    nextDisabled = false,
  }: {
    onBack: () => void;
    onNext: () => void;
    nextDisabled?: boolean;
  }) => (
    <Box display="flex" gap={3} marginTop={5}>
      <Button variant="secondary" onClick={onBack} data-test-id="mr-back">
        <ArrowLeft size={14} aria-hidden="true" />
        Back
      </Button>
      <Button variant="primary" onClick={onNext} disabled={nextDisabled} data-test-id="mr-next">
        Next
      </Button>
    </Box>
  );

  const renderOrderHeader = (order: LookupResult) => (
    <Box data-test-id="mr-order-header" marginBottom={4}>
      <Text as="h2" size={6} fontWeight="bold" display="block">
        {`Order #${order.orderNumber}`}
      </Text>
      <Text size={3} color="default2" display="block">
        {[
          order.customerName || "Unknown customer",
          `Payment: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </Box>
  );

  const renderLookupStep = () => {
    const inputInvalid = Boolean(orderInputError) || lookupError?.kind === "not_found";

    return (
      <Box data-test-id="mr-step-lookup" __maxWidth={560}>
        <Box display="flex" gap={3} alignItems="center" flexWrap="wrap">
          <Box __flexGrow="1" __minWidth="220px">
            <Input
              id="mr-order-number"
              label="Order number"
              value={orderInput}
              onChange={event => setOrderInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runLookup();
                }
              }}
              aria-invalid={inputInvalid ? true : undefined}
              aria-describedby={describedBy(
                orderInputError && ERROR_IDS.orderNumber,
                lookupError && ERROR_IDS.lookup,
              )}
              data-test-id="mr-lookup-input"
            />
          </Box>
          <Button
            variant="primary"
            onClick={() => void runLookup()}
            disabled={lookupLoading}
            data-test-id="mr-lookup-button"
          >
            <Search size={14} aria-hidden="true" />
            {lookupLoading ? "Looking up…" : "Look up"}
          </Button>
        </Box>
        <ErrorRegion>
          {orderInputError && <FieldError id={ERROR_IDS.orderNumber}>{orderInputError}</FieldError>}
          {lookupError && (
            <Box
              role="alert"
              id={ERROR_IDS.lookup}
              data-test-id="mr-lookup-error"
              borderRadius={2}
              padding={3}
              style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
            >
              <Text as="p" size={3} fontWeight="bold" display="block">
                {lookupError.message}
              </Text>
              {lookupError.kind === "not_found" ? (
                <Text as="p" size={2} display="block">
                  Check the order number and try again.
                </Text>
              ) : (
                <Button
                  variant="secondary"
                  size="small"
                  marginTop={2}
                  onClick={() => void runLookup()}
                  disabled={lookupLoading}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Retry
                </Button>
              )}
            </Box>
          )}
        </ErrorRegion>
      </Box>
    );
  };

  const renderItemGroup = (heading: string, items: LookupItem[], groupKey: string) => (
    <Box
      as="section"
      key={groupKey}
      data-test-id="mr-shipment-group"
      aria-labelledby={`${groupKey}-heading`}
      marginBottom={4}
    >
      <Text
        as="h3"
        id={`${groupKey}-heading`}
        size={4}
        fontWeight="bold"
        display="block"
        marginBottom={2}
      >
        {heading}
      </Text>
      <Box display="flex" flexDirection="column" gap={2}>
        {items.map((item, index) => {
          const rowKey = item.fulfillmentLineId ?? `${groupKey}-${item.orderLineId}-${index}`;

          return (
            <ItemRow
              key={rowKey}
              item={item}
              rowKey={rowKey}
              quantity={item.fulfillmentLineId ? (selections[item.fulfillmentLineId] ?? 0) : 0}
              onToggle={handleToggle}
              onQuantityChange={handleQuantityChange}
            />
          );
        })}
      </Box>
    </Box>
  );

  const renderItemsStep = (order: LookupResult) => (
    <Box data-test-id="mr-step-items">
      {renderOrderHeader(order)}

      <Box aria-live="polite">
        {conflictMessage && (
          <Box
            role="alert"
            data-test-id="mr-conflict-message"
            borderRadius={2}
            padding={3}
            marginBottom={4}
            style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
          >
            <Text size={3}>{conflictMessage}</Text>
          </Box>
        )}
      </Box>

      {!order.hasEligibleItems && (
        <Box
          data-test-id="mr-nothing-eligible"
          borderRadius={2}
          padding={3}
          marginBottom={4}
          style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
        >
          <Text size={3} fontWeight="bold">
            Nothing on this order is eligible for a manual return
          </Text>
        </Box>
      )}

      {order.shipments.map((shipment, index) =>
        renderItemGroup(shipmentHeading(shipment, index), shipment.items, `mr-shipment-${index}`),
      )}
      {order.unfulfilledItems.length > 0 &&
        renderItemGroup("Not yet shipped", order.unfulfilledItems, "mr-unfulfilled")}

      <Box aria-live="polite">
        {noteRequired && (
          <Box
            role="status"
            data-test-id="mr-override-notice"
            display="flex"
            alignItems="center"
            gap={2}
            borderRadius={2}
            padding={3}
            style={{ background: "#fef3c7", border: "1px solid #fcd34d" }}
          >
            <AlertTriangle size={16} color="#92400e" aria-hidden="true" />
            <Text size={3}>
              An override note will be required on the next step because a selected item is outside
              the return policy.
            </Text>
          </Box>
        )}
      </Box>

      {renderActions({
        onBack: () => goTo("lookup"),
        onNext: () => {
          setConflictMessage(null);
          goTo("reason");
        },
        nextDisabled: totalUnits < 1,
      })}
    </Box>
  );

  const renderReasonStep = (order: LookupResult) => {
    const noteLength = overrideNote.trim().length;
    const showNoteError = showReasonErrors && Boolean(noteError);

    return (
      <Box data-test-id="mr-step-reason" __maxWidth={640}>
        {renderOrderHeader(order)}

        {reasonsError && (
          <Box role="alert" marginBottom={3} display="flex" alignItems="center" gap={3}>
            <Text size={3} color="critical1">
              {`Couldn't load return reasons: ${reasonsError}`}
            </Text>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setReasonsReloadToken(t => t + 1)}
            >
              Retry
            </Button>
          </Box>
        )}

        <div ref={reasonSelectRef} data-test-id="mr-reason-select">
          <Select
            id="mr-reason"
            label="Return reason"
            value={selectedReasonOption}
            options={reasonOptions}
            onChange={option => setReasonId(optionValue(option))}
            disabled={reasonsLoading && reasons.length === 0}
            error={showReasonErrors && Boolean(reasonError)}
          />
        </div>

        <Box marginTop={4}>
          <Textarea
            id="mr-override-note"
            label={noteRequired ? "Override note (required)" : "Note (optional)"}
            value={overrideNote}
            onChange={event => setOverrideNote(event.target.value)}
            error={showNoteError}
            aria-invalid={showNoteError ? true : undefined}
            aria-describedby={describedBy(NOTE_COUNTER_ID, showNoteError && ERROR_IDS.note)}
            data-test-id="mr-override-note"
          />
          <Text
            id={NOTE_COUNTER_ID}
            data-test-id="mr-note-counter"
            size={2}
            color="default2"
            display="block"
            marginTop={1}
          >
            {`${noteLength} / ${OVERRIDE_NOTE_MAX}${noteRequired ? ` · minimum ${OVERRIDE_NOTE_MIN}` : ""}`}
          </Text>
        </Box>

        <ErrorRegion>
          {showReasonErrors && reasonError && (
            <FieldError id={ERROR_IDS.reason}>{reasonError}</FieldError>
          )}
          {showNoteError && <FieldError id={ERROR_IDS.note}>{noteError}</FieldError>}
        </ErrorRegion>

        {renderActions({ onBack: () => goTo("items"), onNext: handleReasonNext })}
      </Box>
    );
  };

  const renderContactStep = (order: LookupResult) => {
    const showEmailError = showContactErrors && Boolean(emailError);
    const showUpiError = showContactErrors && Boolean(upiError);

    return (
      <Box data-test-id="mr-step-contact" __maxWidth={560}>
        {renderOrderHeader(order)}
        <Text size={3} color="default2" display="block" marginBottom={4}>
          Cash-on-delivery refunds are paid out to the customer&apos;s UPI ID. Confirm the details
          with the customer.
        </Text>
        <Box display="flex" flexDirection="column" gap={3}>
          <Input
            id="mr-refund-email"
            type="email"
            label="Refund email"
            value={refundEmail}
            onChange={event => setRefundEmail(event.target.value)}
            error={showEmailError}
            aria-invalid={showEmailError ? true : undefined}
            aria-describedby={describedBy(showEmailError && ERROR_IDS.refundEmail)}
            data-test-id="mr-refund-email"
          />
          <Input
            id="mr-refund-upi"
            label="UPI ID"
            value={refundUpi}
            onChange={event => setRefundUpi(event.target.value)}
            error={showUpiError}
            aria-invalid={showUpiError ? true : undefined}
            aria-describedby={describedBy(showUpiError && ERROR_IDS.refundUpi)}
            data-test-id="mr-refund-upi"
          />
        </Box>
        <ErrorRegion>
          {showEmailError && <FieldError id={ERROR_IDS.refundEmail}>{emailError}</FieldError>}
          {showUpiError && <FieldError id={ERROR_IDS.refundUpi}>{upiError}</FieldError>}
        </ErrorRegion>
        {renderActions({ onBack: () => goTo("reason"), onNext: handleContactNext })}
      </Box>
    );
  };

  const renderReviewStep = (order: LookupResult) => {
    const address = order.pickupAddress;
    const contactLine = [order.customerPhone, order.customerEmail].filter(Boolean).join(" · ");
    const addressContact = address
      ? [address.name, address.phone].filter(Boolean).join(" · ")
      : null;
    const trimmedNote = overrideNote.trim();

    return (
      <Box data-test-id="mr-step-review" __maxWidth={720}>
        <Section title="Order">
          <DetailField label="Order #" value={`#${order.orderNumber}`} />
          <DetailField label="Customer" value={order.customerName} />
          {contactLine && (
            <Text size={2} color="default2" display="block" marginBottom={2}>
              {contactLine}
            </Text>
          )}
          <DetailField label="Payment method" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
          <Box data-test-id="mr-review-pickup-address">
            <DetailField label="Pickup address" value={formatPickupAddress(address)} />
            {addressContact && (
              <Text size={2} color="default2" display="block">
                {addressContact}
              </Text>
            )}
          </Box>
        </Section>

        <Section title="Items">
          {selectedLines.map(({ item, quantity }) => (
            <Box
              key={item.fulfillmentLineId}
              data-test-id="mr-review-line"
              display="flex"
              justifyContent="space-between"
              gap={3}
              paddingY={2}
              borderBottomWidth={1}
              borderColor="default1"
              borderStyle="solid"
            >
              <Box>
                <Text size={3} fontWeight="bold" display="block">
                  {item.productName}
                </Text>
                <Text size={2} color="default2" display="block">
                  {[item.size ? `Size ${item.size}` : null, item.colour, `Qty ${quantity}`]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Box>
              <Text size={3}>
                {formatMoney(roundMoney(item.estimatedRefundPerUnit * quantity), currency)}
              </Text>
            </Box>
          ))}
          <Box
            data-test-id="mr-review-total"
            display="flex"
            justifyContent="space-between"
            gap={3}
            paddingTop={3}
          >
            <Text size={3} fontWeight="bold">
              Estimated refund (final amount set after QC)
            </Text>
            <Text size={4} fontWeight="bold">
              {formatMoney(estimatedTotal, currency)}
            </Text>
          </Box>
        </Section>

        <Section title="Reason">
          <DetailField label="Return reason" value={selectedReasonOption?.label} />
          {overrideReasons.length > 0 && (
            <DetailField
              label="Override reasons"
              value={overrideReasons.map(overrideReasonLabel).join(", ")}
            />
          )}
          {trimmedNote && (
            <DetailField label={noteRequired ? "Override note" : "Note"} value={trimmedNote} />
          )}
        </Section>

        {order.requiresRefundContact && (
          <Section title="Refund contact">
            <DetailField label="Refund email" value={refundEmail.trim()} />
            <DetailField label="UPI ID" value={refundUpi.trim()} />
          </Section>
        )}

        <Box aria-live="polite">
          {submitError && (
            <Box
              role="alert"
              data-test-id="mr-submit-error"
              borderRadius={2}
              padding={3}
              marginBottom={3}
              style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}
            >
              <Text as="p" size={3} fontWeight="bold" display="block">
                Couldn&apos;t create the manual return
              </Text>
              <Text as="p" size={3} display="block">
                {submitError.message}
              </Text>
              {submitError.retryable && (
                <Button
                  variant="secondary"
                  size="small"
                  marginTop={2}
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  Retry
                </Button>
              )}
            </Box>
          )}
        </Box>

        <Box display="flex" gap={3} marginTop={4}>
          <Button
            variant="secondary"
            onClick={() => goTo(requiresContact ? "contact" : "reason")}
            disabled={submitting}
            data-test-id="mr-back"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            data-test-id="mr-submit"
          >
            {submitting ? "Submitting…" : "Create manual return"}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderConfirmation = () => {
    const allOk = results.length > 0 && results.every(result => result.ok);
    const mountUri = getAppMountUri().replace(/\/$/, "");

    return (
      <Box data-test-id="mr-step-confirmation" __maxWidth={640}>
        <Text as="h2" size={6} fontWeight="bold" display="block" marginBottom={3}>
          {allOk ? "Manual return created" : "Manual return partially created"}
        </Text>
        <Box
          as="ul"
          display="flex"
          flexDirection="column"
          gap={2}
          style={{ listStyle: "none", padding: 0 }}
        >
          {results.map(result => (
            <Box
              as="li"
              key={result.originalFulfillmentId}
              data-test-id="mr-confirmation-row"
              display="flex"
              alignItems="flex-start"
              gap={2}
              borderWidth={1}
              borderColor="default1"
              borderStyle="solid"
              borderRadius={3}
              padding={3}
            >
              {result.ok && result.mrId ? (
                <>
                  <Check size={16} color="#15803d" aria-hidden="true" />
                  <Box>
                    <a
                      href={`${mountUri}${manualReturnDetailPath(result.mrId)}`}
                      onClick={event => result.mrId && openDetail(event, result.mrId)}
                    >
                      <Text size={4} fontWeight="bold">
                        {result.mrId}
                      </Text>
                    </a>
                    <Text size={2} color="default2" display="block">
                      {result.creationStatus === "INCOMPLETE"
                        ? "Finalizing — remaining steps are being completed."
                        : "Created"}
                    </Text>
                  </Box>
                </>
              ) : (
                <>
                  <X size={16} color="#b91c1c" aria-hidden="true" />
                  <Box>
                    <Text size={3} fontWeight="bold" display="block">
                      {`Failed for shipment ${result.originalFulfillmentId}`}
                    </Text>
                    <Text size={2} color="critical1" display="block">
                      {result.message ?? result.code ?? "Unknown error"}
                    </Text>
                  </Box>
                </>
              )}
            </Box>
          ))}
        </Box>
        <Box display="flex" gap={3} marginTop={5}>
          <Button variant="primary" onClick={resetAll} data-test-id="mr-create-another">
            Create another
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(manualReturnListPath)}
            data-test-id="mr-back-to-list"
          >
            Back to Manual Returns
          </Button>
        </Box>
      </Box>
    );
  };

  const renderStep = () => {
    if (step === "confirmation") return renderConfirmation();

    if (step === "lookup" || !lookup) return renderLookupStep();

    switch (step) {
      case "items":
        return renderItemsStep(lookup);
      case "reason":
        return renderReasonStep(lookup);
      case "contact":
        return renderContactStep(lookup);
      case "review":
        return renderReviewStep(lookup);
      default:
        return renderLookupStep();
    }
  };

  return (
    <Box padding={6}>
      <Button
        variant="secondary"
        size="small"
        onClick={() => navigate(manualReturnListPath)}
        marginBottom={4}
        data-test-id="mr-cancel"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All manual returns
      </Button>
      <Text as="h1" size={8} fontWeight="bold" display="block" marginBottom={3}>
        New Manual Return
      </Text>
      {step !== "confirmation" && (
        <StepIndicator steps={formSteps} current={lookup ? step : "lookup"} />
      )}
      {renderStep()}
    </Box>
  );
};
