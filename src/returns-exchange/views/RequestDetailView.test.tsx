import { useUser } from "@dashboard/auth/useUser";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { fetchReturn, submitRejectReturn } from "../api/returnsApi";
import { type CXReturnDetail } from "../types";
import { RequestDetailView } from "./RequestDetailView";

const mockNavigate = jest.fn();
const mockNotify = jest.fn();

jest.mock("@dashboard/auth/useUser", () => ({
  useUser: jest.fn(),
}));
jest.mock("@dashboard/hooks/useNotifier", () => ({
  useNotifier: () => mockNotify,
}));
jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));
jest.mock("../api/returnsApi", () => ({
  fetchReturn: jest.fn(),
  fetchCallLogs: jest.fn().mockResolvedValue([]),
  fetchProductVariants: jest.fn().mockResolvedValue([]),
  submitApproveReturn: jest.fn(),
  submitMarkUnreachable: jest.fn(),
  submitRejectReturn: jest.fn(),
}));

const fetchReturnMock = fetchReturn as jest.Mock;
const rejectMock = submitRejectReturn as jest.Mock;

const REASON = "Customer used the product; tags removed per photos";

const call = (n: number, user_action: string | null) => ({
  id: n,
  request_id: "REQ-6120",
  call_number: n,
  cx_agent_id: "VXNlcjo3",
  cx_agent_name: "Ravi Kumar",
  outcome: "Answered",
  user_action,
  notes: `call ${n}`,
  callback_date: null,
  callback_time: null,
  created_at: `2026-10-0${n}T10:00:00Z`,
});

const makeDetail = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 1,
    request_id: "REQ-6120",
    saleor_order_id: "T3JkZXI6MQ==",
    saleor_order_number: "5001",
    saleor_fulfillment_id: "F1",
    saleor_return_fulfillment_id: null,
    customer_name: "Asha Rao",
    customer_email: "asha@example.com",
    customer_phone: "+919876543210",
    delivery_address: { postalCode: "560001", city: "Bengaluru", streetAddress1: "1 MG Road" },
    payment_method: "PREPAID",
    order_placed_at: "2026-09-20T10:00:00Z",
    delivery_date: "2026-09-25T10:00:00Z",
    product_name: "Linen Shirt",
    product_sku: "LS-01-M",
    product_size: "M",
    product_colour: "Blue",
    product_variant_id: null,
    product_id: null,
    return_reason: "Size issue",
    customer_images: null,
    cod_refund_email: null,
    cx_status: "RETURN_PENDING",
    last_activity_at: "2026-10-01T10:00:00Z",
    auto_approval_due_at: "2026-10-06T10:00:00Z",
    customer_unreachable: false,
    replacement_order_id: null,
    replacement_order_number: null,
    erp_sync_status: null,
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    last_activity_by_id: null,
    last_activity_by_name: null,
    sla_tier: "SAFE",
    sla_hours_remaining: 20,
    call_count: 0,
    last_call_outcome: null,
    last_call_user_action: null,
    pincode: "560001",
    rejection_reason: null,
    rejected_by_name: null,
    rejected_at: null,
    call_logs: [],
    audit_trail: [],
    last_user_action: null,
    eligibility: null,
    ...overrides,
  }) as unknown as CXReturnDetail;

const rejectedDetail = () =>
  makeDetail({
    cx_status: "RETURN_REJECTED",
    auto_approval_due_at: null,
    sla_hours_remaining: null,
    rejection_reason: REASON,
    rejected_by_name: "Ravi Kumar",
    rejected_at: "2026-10-04T08:30:00Z",
    last_activity_by_name: "Ravi Kumar",
    last_activity_at: "2026-10-04T08:30:00Z",
    call_logs: [call(1, "Agreed to exchange")],
    last_user_action: "Agreed to exchange",
    eligibility: {
      isExchangeable: true,
      withinWindow: true,
      daysInWindow: 3,
      windowDays: 7,
      requiresOverride: false,
      overrideReasons: [],
    },
    audit_trail: [
      {
        id: 10,
        entity_type: "cx_return_request",
        entity_id: "REQ-6120",
        actor_type: "cx_agent",
        actor_id: "VXNlcjo3",
        actor_name: "Ravi Kumar",
        action_type: "STATUS_CHANGED",
        context: { from: "CX_REVIEW", to: "RETURN_REJECTED" },
        created_at: "2026-10-04T08:30:00Z",
      },
      {
        id: 11,
        entity_type: "cx_return_request",
        entity_id: "REQ-6120",
        actor_type: "cx_agent",
        actor_id: "VXNlcjo3",
        actor_name: "Ravi Kumar",
        action_type: "RETURN_REJECTED",
        context: { reason: REASON },
        created_at: "2026-10-04T08:30:00Z",
      },
    ],
  });

const renderDetail = async (detail: CXReturnDetail) => {
  fetchReturnMock.mockResolvedValue(detail);
  render(<RequestDetailView requestId={detail.request_id} />);
  await screen.findAllByText(detail.request_id);
};

const openRejectDialog = () => {
  fireEvent.click(screen.getByTestId("reject-return-button"));

  return screen.getByRole("dialog");
};

const typeReasonAndConfirm = (dialog: HTMLElement, reason = REASON) => {
  fireEvent.change(within(dialog).getByTestId("reject-reason-input"), {
    target: { value: reason },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Reject Return" }));
};

describe("RequestDetailView — TTXY-6032 reject", () => {
  beforeEach(() => {
    (useUser as jest.Mock).mockReturnValue({
      user: { id: "VXNlcjo3", email: "ravi@tenxyou.com", firstName: "Ravi", lastName: "Kumar" },
    });
    fetchReturnMock.mockReset();
    rejectMock.mockReset();
    mockNotify.mockReset();
    mockNavigate.mockReset();
  });

  it.each(["RETURN_PENDING", "CX_REVIEW", "CX_ACTION"])(
    'J10 "Reject Return" is shown on an open (%s) request',
    async status => {
      // Act
      await renderDetail(makeDetail({ cx_status: status }));

      // Assert
      const button = screen.getByTestId("reject-return-button");

      expect(button).toHaveTextContent("Reject Return");
      expect(button).toBeEnabled();
    },
  );

  it.each(["APPROVED", "AUTO_APPROVED", "EXCHANGED", "RETURN_REJECTED"])(
    'J10 "Reject Return" is absent on a closed (%s) request',
    async status => {
      // Act
      await renderDetail(makeDetail({ cx_status: status, auto_approval_due_at: null }));

      // Assert
      expect(screen.queryByTestId("reject-return-button")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Reject Return/ })).not.toBeInTheDocument();
    },
  );

  it("J10 the dialog receives the call count / last user action (no-calls warning)", async () => {
    // Arrange
    await renderDetail(makeDetail({ call_logs: [], call_count: 0 }));

    // Act
    const dialog = openRejectDialog();

    // Assert
    expect(
      within(dialog).getByText("No calls have been logged with this customer."),
    ).toBeInTheDocument();
  });

  it("J10 the dialog shows the agreed-to-exchange warning from the last call", async () => {
    // Arrange
    await renderDetail(
      makeDetail({
        cx_status: "CX_ACTION",
        call_logs: [call(1, "Agreed to exchange")],
        call_count: 1,
        last_user_action: "Agreed to exchange",
      }),
    );

    // Act
    const dialog = openRejectDialog();

    // Assert
    expect(
      within(dialog).getByText("The customer agreed to an exchange on the last call."),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("No calls have been logged with this customer."),
    ).not.toBeInTheDocument();
  });

  it("J14 confirm calls submitRejectReturn, closes the dialog, reloads and shows a success toast", async () => {
    // Arrange
    await renderDetail(makeDetail({ cx_status: "CX_REVIEW", call_logs: [call(1, null)] }));
    rejectMock.mockResolvedValue({ cx_status: "RETURN_REJECTED" });
    fetchReturnMock.mockResolvedValue(rejectedDetail());

    const fetchCallsBefore = fetchReturnMock.mock.calls.length;

    // Act
    typeReasonAndConfirm(openRejectDialog());

    // Assert
    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith("REQ-6120", REASON));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ status: "success" })),
    );
    expect(fetchReturnMock.mock.calls.length).toBeGreaterThan(fetchCallsBefore);
    await waitFor(() =>
      expect(screen.queryByTestId("reject-reason-input")).not.toBeInTheDocument(),
    );
    expect(await screen.findByTestId("rejected-pill")).toBeInTheDocument();
  });

  it("J14 on API error shows an error toast with the API message and keeps the dialog open", async () => {
    // Arrange
    await renderDetail(makeDetail({ cx_status: "CX_REVIEW" }));
    rejectMock.mockRejectedValue(new Error("Return request is already closed (APPROVED)"));

    // Act
    const dialog = openRejectDialog();

    typeReasonAndConfirm(dialog);

    // Assert
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
          text: "Return request is already closed (APPROVED)",
        }),
      ),
    );
    expect(mockNotify).not.toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
    expect(screen.getByTestId("reject-reason-input")).toBeInTheDocument();
    expect(screen.getByTestId("reject-reason-input")).toHaveValue(REASON);
  });

  it("J15 a RETURN_REJECTED request is read-only (no Log Call / Approve / CX Actions; Convert not usable)", async () => {
    // Act
    await renderDetail(rejectedDetail());

    // Assert
    expect(screen.queryByRole("button", { name: /Log Call/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve Return/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /CX Actions/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("reject-return-button")).not.toBeInTheDocument();
    screen
      .queryAllByRole("button", { name: /Convert to Exchange/ })
      .forEach(b => expect(b).toBeDisabled());
    expect(screen.getByText(/Read Only — Return Closed/)).toBeInTheDocument();
  });

  it('J15 shows the red "Return Rejected" pill (not the green approved badge)', async () => {
    // Act
    await renderDetail(rejectedDetail());

    // Assert
    const pill = screen.getByTestId("rejected-pill");

    expect(pill).toHaveTextContent(/^Return Rejected$/);
    // no raw-status green badges ("✓ Return RETURN REJECTED" / "✓ RETURN REJECTED")
    expect(screen.queryByText(/✓ Return RETURN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/✓ RETURN REJECTED/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Approved by/)).not.toBeInTheDocument();
    // header chip
    expect(screen.getAllByText("Rejected").length).toBeGreaterThanOrEqual(1);
  });

  it('J15 the sidebar shows the reason, "Rejected by <agent>" and the time', async () => {
    // Act
    await renderDetail(rejectedDetail());

    // Assert
    const summary = within(screen.getByTestId("rejection-summary"));

    expect(summary.getByText(REASON)).toBeInTheDocument();
    expect(summary.getByText(/Rejected by Ravi Kumar/)).toBeInTheDocument();
    expect(screen.getByTestId("rejection-summary")).toHaveTextContent(/4 Oct/);
  });

  it("J15 the SLA badge is not shown on a rejected request", async () => {
    await renderDetail(rejectedDetail());

    expect(screen.queryByText(/^Safe/)).not.toBeInTheDocument();
  });

  it("J16 the timeline renders the reject entry's reason", async () => {
    // Act
    await renderDetail(rejectedDetail());

    // Assert
    const timeline = within(screen.getByTestId("status-timeline"));

    expect(timeline.getByText(/RETURN REJECTED/)).toBeInTheDocument();
    expect(timeline.getByText(REASON, { exact: false })).toBeInTheDocument();
    expect(timeline.getByText(/CX_REVIEW → RETURN_REJECTED/)).toBeInTheDocument();
  });
});
