import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { fetchHeldOrders } from "../api/codHoldApi";
import { type CodHoldOrder } from "../types";
import { HeldOrdersQueueView } from "./HeldOrdersQueueView";

jest.mock("@dashboard/hooks/useNavigator", () => () => jest.fn());

jest.mock("../api/codHoldApi", () => ({
  fetchHeldOrders: jest.fn(),
}));

const mockFetchHeldOrders = fetchHeldOrders as jest.Mock;

const order: CodHoldOrder = {
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
  orderValue: 1500,
  orderValueCurrency: "INR",
  internalCxStatus: "CX_REVIEW",
};

describe("HeldOrdersQueueView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchHeldOrders.mockResolvedValue({ orders: [order], nextCursor: null });
  });

  it("renders the Order Value and CX Status columns", async () => {
    // Arrange / Act
    render(<HeldOrdersQueueView />);

    // Assert
    expect(await screen.findByText("INR 1,500")).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
  });

  it("omits unset filters and sort params on the initial load", async () => {
    // Arrange / Act
    render(<HeldOrdersQueueView />);
    await waitFor(() => expect(mockFetchHeldOrders).toHaveBeenCalled());

    // Assert
    expect(mockFetchHeldOrders).toHaveBeenCalledWith({
      status: undefined,
      assignedAgentEmail: undefined,
      pincode: undefined,
      from: undefined,
      to: undefined,
      orderNumber: undefined,
      phone: undefined,
      minValue: undefined,
      maxValue: undefined,
      sortBy: undefined,
      sortDir: undefined,
      limit: 25,
    });
  });

  it("wires the new orderNumber/phone/minValue/maxValue filters into fetchHeldOrders", async () => {
    // Arrange
    const user = userEvent.setup();

    render(<HeldOrdersQueueView />);
    await waitFor(() => expect(mockFetchHeldOrders).toHaveBeenCalledTimes(1));

    // Act
    await user.type(screen.getByLabelText("12345"), "1001");
    await user.type(screen.getByLabelText("9876543210"), "999");
    await user.type(screen.getByLabelText("0"), "100");
    await user.type(screen.getByLabelText("10000"), "2000");

    // Assert
    await waitFor(() =>
      expect(mockFetchHeldOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderNumber: "1001",
          phone: "999",
          minValue: 100,
          maxValue: 2000,
        }),
      ),
    );
  });

  it("toggles sort asc -> desc -> unsorted when clicking a sortable column header", async () => {
    // Arrange
    const user = userEvent.setup();

    render(<HeldOrdersQueueView />);
    await waitFor(() => expect(mockFetchHeldOrders).toHaveBeenCalledTimes(1));

    // Act — first click: ascending
    await user.click(screen.getByText("Order #"));

    // Assert
    await waitFor(() =>
      expect(mockFetchHeldOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "orderNumber", sortDir: "asc" }),
      ),
    );

    // Act — second click: descending
    await user.click(screen.getByText("Order #"));

    await waitFor(() =>
      expect(mockFetchHeldOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "orderNumber", sortDir: "desc" }),
      ),
    );

    // Act — third click: back to unsorted
    await user.click(screen.getByText("Order #"));

    await waitFor(() =>
      expect(mockFetchHeldOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: undefined, sortDir: undefined }),
      ),
    );
  });
});
