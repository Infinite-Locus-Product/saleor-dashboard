import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  fetchHeldOrderDetail,
  submitCancel,
  submitLogCall,
  submitMarkUnreachable,
  submitRelease,
  submitUpdateAddress,
} from "../api/codHoldApi";
import { type CodHoldOrderDetail } from "../types";
import { OrderDetailView } from "./OrderDetailView";

jest.mock("@dashboard/hooks/useNavigator", () => () => jest.fn());

jest.mock("@dashboard/components/AddressEdit/useAddressValidation", () => ({
  useAddressValidation: () => ({
    areas: [],
    getDisplayValue: (value: string) => value,
  }),
}));

jest.mock("../api/codHoldApi", () => ({
  fetchHeldOrderDetail: jest.fn(),
  submitCancel: jest.fn(),
  submitRelease: jest.fn(),
  submitUpdateAddress: jest.fn(),
  submitSendPaymentLink: jest.fn(),
  submitLogCall: jest.fn(),
  submitMarkUnreachable: jest.fn(),
}));

const mockFetchHeldOrderDetail = fetchHeldOrderDetail as jest.Mock;
const mockSubmitLogCall = submitLogCall as jest.Mock;
const mockSubmitMarkUnreachable = submitMarkUnreachable as jest.Mock;
const mockSubmitCancel = submitCancel as jest.Mock;
const mockSubmitRelease = submitRelease as jest.Mock;
const mockSubmitUpdateAddress = submitUpdateAddress as jest.Mock;

const baseDetail: CodHoldOrderDetail = {
  id: "hold-1",
  saleorOrderId: "order-1",
  orderNumber: "1001",
  status: "HELD",
  matchedPincode: "110001",
  matchedPhone: null,
  assignedAgentEmail: "agent@example.com",
  heldAt: "2026-01-01T10:00:00.000Z",
  resolvedAt: null,
  resolvedBy: null,
  releaseReason: null,
  slaTier: "ON_TRACK",
  orderValue: 1200,
  orderValueCurrency: "INR",
  internalCxStatus: "PENDING",
  callLogs: [],
  orderSnapshot: {
    id: "order-1",
    number: "1001",
    status: "unfulfilled",
    created: "2026-01-01T10:00:00.000Z",
    userEmail: "customer@example.com",
    total: { gross: { amount: 1200, currency: "INR" } },
    shippingAddress: {
      firstName: "",
      lastName: "",
      phone: "9876543210",
      streetAddress1: "123 Main St",
      streetAddress2: "",
      city: "Delhi",
      cityArea: "",
      postalCode: "110001",
      countryArea: "DL",
      country: { code: "IN", country: "India" },
    },
    lines: [],
  },
  sendPaymentLinkEnabled: true,
  firstViewedAt: null,
  unreachableMarkedAt: null,
  callLogGateSatisfied: false,
};

function mockDetail(overrides: Partial<CodHoldOrderDetail> = {}) {
  mockFetchHeldOrderDetail.mockResolvedValue({ ...baseDetail, ...overrides });
}

// The Outcome Select's floating options list renders in its own body-level
// portal, which Radix's open ActionDialog marks aria-hidden (it only knows
// about its own portal's subtree) — so role-based queries can't see the
// options while the dialog is open. Query by the library's own
// data-test-id instead and dispatch the click directly.
async function selectOutcome(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("combobox"));

  const option = Array.from(document.querySelectorAll('[data-test-id="select-option"]')).find(
    el => el.textContent === label,
  );

  if (!option) throw new Error(`Outcome option "${label}" not found`);

  fireEvent.click(option);
}

describe("OrderDetailView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the live snapshot Order Value (gross), Time Held, and Internal CX Status", async () => {
    // Arrange
    mockDetail({ internalCxStatus: "CX_REVIEW" });

    // Act
    render(<OrderDetailView holdId="hold-1" />);

    // Assert
    expect(await screen.findByText(/Order Value:/)).toHaveTextContent("Order Value: 1200 INR");
    expect(screen.getByText(/Held:/)).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
  });

  it("falls back Customer Name to — when both first and last name are blank", async () => {
    // Arrange — snapshot.shippingAddress present but firstName/lastName are empty strings
    mockDetail();

    // Act
    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("disables Cancel/Update Address/Convert to Prepaid/Confirm Order until the call-log gate is satisfied", async () => {
    // Arrange
    mockDetail({ callLogGateSatisfied: false });

    // Act
    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Assert
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update Address" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Convert to Prepaid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm Order" })).toBeDisabled();
    expect(screen.getByText(/Log at least one call with outcome Answered/i)).toBeInTheDocument();
    // Log Call and Mark Unreachable are NOT gated by the call-log gate itself
    expect(screen.getByRole("button", { name: "Log Call" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Mark Unreachable" })).toBeEnabled();
  });

  it("enables the four resolution actions once the call-log gate is satisfied", async () => {
    // Arrange
    mockDetail({ callLogGateSatisfied: true });

    // Act
    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Assert
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update Address" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Convert to Prepaid" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Confirm Order" })).toBeEnabled();
    expect(
      screen.queryByText(/Log at least one call with outcome Answered/i),
    ).not.toBeInTheDocument();
  });

  it("requires an outcome before submitting a logged call", async () => {
    // Arrange
    mockDetail();

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Log Call" }));
    await user.click(screen.getByRole("button", { name: "Save call log" }));

    // Assert
    expect(await screen.findByText("Please select an outcome.")).toBeInTheDocument();
    expect(mockSubmitLogCall).not.toHaveBeenCalled();
  });

  it("requires a customer decision when the outcome is Answered", async () => {
    // Arrange
    mockDetail();

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Log Call" }));
    await selectOutcome(user, "Answered");
    await user.click(screen.getByRole("button", { name: "Save call log" }));

    // Assert
    expect(
      await screen.findByText("Customer decision is required when the outcome is Answered."),
    ).toBeInTheDocument();
    expect(mockSubmitLogCall).not.toHaveBeenCalled();
  });

  it("requires a callback date/time when the outcome is Callback Requested", async () => {
    // Arrange
    mockDetail();

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Log Call" }));
    await selectOutcome(user, "Callback Requested");
    await user.type(screen.getByLabelText(/Notes/i), "Will call back tomorrow");
    await user.click(screen.getByRole("button", { name: "Save call log" }));

    // Assert
    expect(
      await screen.findByText(
        "Callback date/time is required when the outcome is Callback Requested.",
      ),
    ).toBeInTheDocument();
    expect(mockSubmitLogCall).not.toHaveBeenCalled();
  });

  it("logs a call and refreshes the detail after a successful Answered submit", async () => {
    // Arrange
    mockDetail();
    // submitLogCall actually responds with just {status: "call_logged"} and
    // nothing reads it — the component always reloads the full detail
    // afterwards, so the mock resolves to undefined like the real void return.
    mockSubmitLogCall.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Log Call" }));
    await selectOutcome(user, "Answered");
    await user.type(screen.getByLabelText("Customer decision"), "Agreed to receive the order");
    await user.type(screen.getByLabelText(/Notes/i), "Customer confirmed the order.");
    await user.click(screen.getByRole("button", { name: "Save call log" }));

    // Assert
    await waitFor(() =>
      expect(mockSubmitLogCall).toHaveBeenCalledWith("hold-1", {
        outcome: "ANSWERED",
        customerDecision: "Agreed to receive the order",
        notes: "Customer confirmed the order.",
        callbackAt: undefined,
      }),
    );
    await waitFor(() => expect(mockFetchHeldOrderDetail).toHaveBeenCalledTimes(2));
  });

  it("marks the order unreachable on confirm", async () => {
    // Arrange
    mockDetail();
    // submitMarkUnreachable actually responds with just
    // {status: "marked_unreachable"}; nothing reads it, same as above.
    mockSubmitMarkUnreachable.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Mark Unreachable" }));

    const dialog = await screen.findByText(/auto cancel the order/i);

    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark unreachable" }));

    // Assert
    await waitFor(() => expect(mockSubmitMarkUnreachable).toHaveBeenCalledWith("hold-1"));
    await waitFor(() => expect(mockFetchHeldOrderDetail).toHaveBeenCalledTimes(2));
  });

  it("surfaces the backend's answered_call_required message on a 400 (defense in depth)", async () => {
    // Arrange — buttons are disabled client-side, but this covers the race
    // where cancel is still attempted (e.g. a stale disabled-state).
    mockDetail({ callLogGateSatisfied: true });
    mockSubmitCancel.mockRejectedValue(
      new Error(
        "At least one call must be logged with outcome Answered before this action is available.",
      ),
    );

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.type(screen.getByLabelText("Note"), "Customer wants to cancel");
    await user.click(screen.getByRole("button", { name: "Cancel order" }));

    // Assert
    expect(
      await screen.findByText(/At least one call must be logged with outcome Answered/i),
    ).toBeInTheDocument();
  });

  it("confirms the order with the AC-37 copy before calling release", async () => {
    // Arrange
    mockDetail({ callLogGateSatisfied: true });
    mockSubmitRelease.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Confirm Order" }));

    // Assert — explicit confirmation copy per AC-37
    const dialog = await screen.findByText(/creates the order in ERP for the first time/i);

    expect(dialog).toBeInTheDocument();
  });

  it("H1: renders log.note (not log.notes) for both legacy action logs and new outcome-based call logs", async () => {
    // Arrange — the backend's listCallLogs never returns "notes"; both kinds
    // of entries share the same "note" field on the wire.
    mockDetail({
      callLogs: [
        {
          id: "log-legacy",
          agentEmail: "agent@example.com",
          action: "CANCEL",
          note: "Legacy action note text",
          createdAt: "2026-01-01T12:00:00.000Z",
        },
        {
          id: "log-call",
          agentEmail: "agent@example.com",
          outcome: "NO_ANSWER",
          note: "New call-log note text",
          createdAt: "2026-01-01T13:00:00.000Z",
        },
      ],
    });

    // Act
    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Assert
    expect(await screen.findByText("Legacy action note text")).toBeInTheDocument();
    expect(screen.getByText("New call-log note text")).toBeInTheDocument();
  });

  it("H3: allows Update Address with an empty last name (only firstName is required)", async () => {
    // Arrange
    mockDetail({ callLogGateSatisfied: true });
    mockSubmitUpdateAddress.mockResolvedValue(undefined);

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act — firstName filled, lastName left blank
    await user.click(screen.getByRole("button", { name: "Update Address" }));
    await user.type(screen.getByLabelText("First name"), "Asha");
    await user.type(screen.getByLabelText("Note"), "Confirmed new address with customer");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    // Assert
    await waitFor(() => expect(mockSubmitUpdateAddress).toHaveBeenCalled());

    const [, submittedAddress] = mockSubmitUpdateAddress.mock.calls[0];

    expect(submittedAddress.firstName).toBe("Asha");
    expect(submittedAddress.lastName).toBe("");
  });

  it("M1: refills the Update Address form from the live snapshot every time the dialog reopens", async () => {
    // Arrange
    mockDetail({ callLogGateSatisfied: true });

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act — edit a field, close WITHOUT saving
    await user.click(screen.getByRole("button", { name: "Update Address" }));

    const streetInput = screen.getByLabelText("Street address 1");

    await user.clear(streetInput);
    await user.type(streetInput, "999 Changed Street");
    await user.click(screen.getByRole("button", { name: "Back" }));

    // Act — reopen the dialog
    await user.click(screen.getByRole("button", { name: "Update Address" }));

    // Assert — refilled from the snapshot, not the stale unsaved edit
    expect(screen.getByLabelText("Street address 1")).toHaveValue("123 Main St");
  });

  it("M2: clears a leftover validation error when a different dialog is opened", async () => {
    // Arrange
    mockDetail({ callLogGateSatisfied: true });

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act — trigger a client-side validation error in the Cancel dialog
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(await screen.findByText("A note is required for this action.")).toBeInTheDocument();

    // Close (no request was in flight, so Back works) and open a different dialog
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Log Call" }));

    // Assert — the Cancel dialog's error doesn't leak into Log Call
    expect(screen.queryByText("A note is required for this action.")).not.toBeInTheDocument();
  });

  it("M2: blocks closing a dialog while its submit is still in flight", async () => {
    // Arrange
    mockDetail({ callLogGateSatisfied: true });

    let resolveCancel: () => void = () => undefined;

    mockSubmitCancel.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveCancel = resolve;
        }),
    );

    const user = userEvent.setup();

    render(<OrderDetailView holdId="hold-1" />);
    await screen.findByText(/Order Value:/);

    // Act
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.type(screen.getByLabelText("Note"), "Customer called to cancel");
    await user.click(screen.getByRole("button", { name: "Cancel order" }));

    // The submit is still in flight — Back must not close the dialog
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();

    // Assert — once the request settles, the dialog closes normally
    resolveCancel();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument(),
    );
  });
});
