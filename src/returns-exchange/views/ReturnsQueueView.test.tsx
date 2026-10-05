import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { fetchReturns } from "../api/returnsApi";
import { type CXReturnRequest } from "../types";
import { ReturnsQueueView } from "./ReturnsQueueView";

const mockNavigate = jest.fn();

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));
jest.mock("../api/returnsApi", () => ({
  fetchReturns: jest.fn(),
}));

const fetchMock = fetchReturns as jest.Mock;

const makeRow = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 1,
    request_id: "REQ-1001",
    saleor_order_id: "T3JkZXI6MQ==",
    saleor_order_number: "5001",
    saleor_fulfillment_id: "F1",
    saleor_return_fulfillment_id: null,
    customer_name: "Asha Rao",
    customer_email: "asha@example.com",
    customer_phone: "+919876543210",
    delivery_address: { postalCode: "560001" },
    payment_method: "PREPAID",
    order_placed_at: "2026-09-20T10:00:00Z",
    delivery_date: "2026-09-25T10:00:00Z",
    product_name: "Linen Shirt",
    product_sku: "LS-01-M",
    product_size: "M",
    product_colour: "Blue",
    product_variant_id: "V1",
    product_id: "P1",
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
    ...overrides,
  }) as unknown as CXReturnRequest;

const page = (rows: CXReturnRequest[], total = rows.length, pageNo = 1) => ({
  data: rows,
  pagination: { total, page: pageNo, limit: 20 },
});

const lastParams = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];

const headerLabels = () =>
  screen.getAllByRole("columnheader").map(th => (th.textContent ?? "").trim());

const rowFor = (requestId: string) =>
  screen.getAllByRole("row").find(r => within(r).queryByText(requestId)) as HTMLElement;

const pincodeCell = (requestId: string) => {
  const idx = headerLabels().indexOf("Pincode");

  expect(idx).toBeGreaterThanOrEqual(0);

  return within(rowFor(requestId)).getAllByRole("cell")[idx];
};

const applyPincode = (value: string) => {
  fireEvent.change(screen.getByTestId("pincode-filter-input"), { target: { value } });
  fireEvent.click(screen.getByTestId("pincode-filter-apply"));
};

describe("ReturnsQueueView — TTXY-6032 pincode + rejected", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockNavigate.mockReset();
  });

  it("J5 shows a Pincode column right after Order #", async () => {
    // Arrange
    fetchMock.mockResolvedValue(page([makeRow()]));

    // Act
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    // Assert
    const labels = headerLabels();
    const orderIdx = labels.indexOf("Order #");

    expect(orderIdx).toBeGreaterThanOrEqual(0);
    expect(labels[orderIdx + 1]).toBe("Pincode");
  });

  it('J5 renders the pincode value, and "—" when the row has none', async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      page([
        makeRow(),
        makeRow({ id: 2, request_id: "REQ-1002", pincode: null, delivery_address: null }),
      ]),
    );

    // Act
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1002");

    // Assert
    expect(pincodeCell("REQ-1001")).toHaveTextContent(/^560001$/);
    expect(pincodeCell("REQ-1002")).toHaveTextContent(/^—$/);
  });

  it.each(["56000", "5600011", "56000a", "abcdef"])(
    'J6 invalid pincode %p shows "Enter a 6-digit pincode" and does not refetch',
    async value => {
      // Arrange
      fetchMock.mockResolvedValue(page([makeRow()]));
      render(<ReturnsQueueView />);
      await screen.findByText("REQ-1001");

      const callsBefore = fetchMock.mock.calls.length;

      // Act
      applyPincode(value);

      // Assert
      expect(await screen.findByText("Enter a 6-digit pincode")).toBeInTheDocument();
      expect(fetchMock.mock.calls.length).toBe(callsBefore);
      expect(fetchMock.mock.calls.every(c => !c[0]?.pincode)).toBe(true);
    },
  );

  it("J6 typing alone does not refetch; Enter applies a valid pincode", async () => {
    // Arrange
    fetchMock.mockResolvedValue(page([makeRow()]));
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    const callsBefore = fetchMock.mock.calls.length;
    const input = screen.getByTestId("pincode-filter-input");

    // Act
    fireEvent.change(input, { target: { value: "560001" } });

    // Assert (no fetch per keystroke)
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    // Act
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // Assert
    await waitFor(() => expect(lastParams().pincode).toBe("560001"));
    expect(screen.queryByText("Enter a 6-digit pincode")).not.toBeInTheDocument();
  });

  it("J7 applying a pincode resets to page 1 and keeps the other active filters", async () => {
    // Arrange: 45 rows → 3 pages
    fetchMock.mockResolvedValue(page([makeRow()], 45));
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    await waitFor(() => expect(lastParams().status).toBe("RETURN_PENDING"));
    await screen.findByText("REQ-1001");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastParams().page).toBe(2));
    await screen.findByText("REQ-1001");

    // Act (value is trimmed before validation)
    applyPincode(" 560001 ");

    // Assert
    await waitFor(() => expect(lastParams().pincode).toBe("560001"));
    expect(lastParams()).toEqual(
      expect.objectContaining({ pincode: "560001", status: "RETURN_PENDING", page: 1 }),
    );
  });

  it('J8 no results with a pincode names it and "Clear pincode" restores the list', async () => {
    // Arrange
    fetchMock.mockImplementation(async (params: any) =>
      params?.pincode ? page([], 0) : page([makeRow()]),
    );
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    // Act
    applyPincode("110011");

    // Assert
    expect(await screen.findByText("No return requests for pincode 110011.")).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Clear pincode" }));

    // Assert
    expect(await screen.findByText("REQ-1001")).toBeInTheDocument();
    expect(lastParams().pincode).toBeFalsy();
    expect(screen.queryByText(/No return requests for pincode/)).not.toBeInTheDocument();
  });

  it("J8 the × clear button is shown only while the pincode filter is set", async () => {
    // Arrange
    fetchMock.mockResolvedValue(page([makeRow()]));
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    // Assert (not set)
    expect(screen.queryByTestId("pincode-filter-clear")).not.toBeInTheDocument();

    // Act
    applyPincode("560001");
    await waitFor(() => expect(lastParams().pincode).toBe("560001"));
    fireEvent.click(await screen.findByTestId("pincode-filter-clear"));

    // Assert
    await waitFor(() => expect(lastParams().pincode).toBeFalsy());
    expect(screen.queryByTestId("pincode-filter-clear")).not.toBeInTheDocument();
  });

  it("C4 a slow, stale pincode response does not overwrite the newer unfiltered result", async () => {
    // Arrange
    let resolveSlow: (v: unknown) => void = () => undefined;
    const slowPincode = new Promise(resolve => {
      resolveSlow = resolve;
    });

    fetchMock.mockImplementation((params: any) =>
      params?.pincode
        ? slowPincode
        : Promise.resolve(page([makeRow(), makeRow({ id: 2, request_id: "REQ-1002" })], 2)),
    );
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1002");

    // Act: apply (slow) then clear straight away (fast)
    applyPincode("560001");
    fireEvent.click(await screen.findByTestId("pincode-filter-clear"));
    await waitFor(() => expect(lastParams().pincode).toBeFalsy());
    await screen.findByText("REQ-1002");

    await act(async () => {
      resolveSlow(page([makeRow({ id: 3, request_id: "REQ-1003" })], 1));
    });

    // Assert: the late 560001 response is ignored
    expect(screen.getByText("REQ-1001")).toBeInTheDocument();
    expect(screen.getByText("REQ-1002")).toBeInTheDocument();
    expect(screen.queryByText("REQ-1003")).not.toBeInTheDocument();
    expect(screen.getByText("2 total requests")).toBeInTheDocument();
  });

  it("C5 with another filter active, the empty state is generic and offers Clear all + Clear pincode", async () => {
    // Arrange
    fetchMock.mockImplementation(async (params: any) =>
      params?.pincode ? page([], 0) : page([makeRow()]),
    );
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    await waitFor(() => expect(lastParams().status).toBe("RETURN_PENDING"));
    await screen.findByText("REQ-1001");

    // Act
    applyPincode("110011");

    // Assert
    expect(
      await screen.findByText("No return requests match the current filters."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No return requests for pincode/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear pincode" })).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByTestId("empty-state-clear-all"));

    // Assert
    expect(await screen.findByText("REQ-1001")).toBeInTheDocument();
    expect(lastParams()).toEqual(
      expect.objectContaining({ status: undefined, pincode: undefined, page: 1 }),
    );
  });

  it("C5 with no pincode but other filters, the empty state is generic with Clear all only", async () => {
    // Arrange
    fetchMock.mockImplementation(async (params: any) =>
      params?.status ? page([], 0) : page([makeRow()]),
    );
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Rejected" }));

    // Assert
    expect(
      await screen.findByText("No return requests match the current filters."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("empty-state-clear-all")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear pincode" })).not.toBeInTheDocument();
  });

  it("C6 the inline pincode error is linked to the input (aria-describedby, aria-invalid)", async () => {
    // Arrange
    fetchMock.mockResolvedValue(page([makeRow()]));
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    // Act
    applyPincode("56000");

    // Assert
    const error = await screen.findByText("Enter a 6-digit pincode");
    const input = screen.getByTestId("pincode-filter-input");

    expect(error.id).toBeTruthy();
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("C6 a typed-but-unapplied pincode shows which pincode is actually applied", async () => {
    // Arrange
    fetchMock.mockResolvedValue(page([makeRow()]));
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");
    applyPincode("560001");
    await waitFor(() => expect(lastParams().pincode).toBe("560001"));
    await screen.findByText("REQ-1001");

    // Assert: draft == applied -> no hint
    expect(screen.queryByTestId("pincode-filter-applied")).not.toBeInTheDocument();

    // Act
    fireEvent.change(screen.getByTestId("pincode-filter-input"), { target: { value: "560002" } });

    // Assert
    expect(screen.getByTestId("pincode-filter-applied")).toHaveTextContent("Filtering by 560001");
    expect(lastParams().pincode).toBe("560001");
  });

  it('J9 "Rejected" is a status filter chip that filters by RETURN_REJECTED', async () => {
    // Arrange
    fetchMock.mockResolvedValue(page([makeRow()]));
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1001");

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Rejected" }));

    // Assert
    await waitFor(() => expect(lastParams().status).toBe("RETURN_REJECTED"));
  });

  it("J9 closed rows (Rejected, Approved) hide the SLA badge; open rows keep it", async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      page([
        makeRow(),
        makeRow({
          id: 2,
          request_id: "REQ-1002",
          cx_status: "RETURN_REJECTED",
          sla_tier: "SAFE",
          sla_hours_remaining: null,
          auto_approval_due_at: null,
        }),
        makeRow({
          id: 3,
          request_id: "REQ-1003",
          cx_status: "APPROVED",
          sla_tier: "SAFE",
          sla_hours_remaining: null,
          auto_approval_due_at: null,
        }),
      ]),
    );

    // Act
    render(<ReturnsQueueView />);
    await screen.findByText("REQ-1003");

    // Assert
    const rejectedRow = rowFor("REQ-1002");

    expect(within(rejectedRow).getByText("Rejected")).toBeInTheDocument();
    expect(within(rejectedRow).queryByText(/^Safe/)).not.toBeInTheDocument();
    expect(within(rowFor("REQ-1003")).queryByText(/^Safe/)).not.toBeInTheDocument();
    expect(within(rowFor("REQ-1001")).getByText(/^Safe/)).toBeInTheDocument();
  });
});
