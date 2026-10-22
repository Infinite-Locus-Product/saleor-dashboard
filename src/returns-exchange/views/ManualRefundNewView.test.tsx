import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { createManualRefund, lookupOrderForManualRefund } from "../api/manualRefundApi";
import { createManualReturnApiError } from "../api/manualReturnApiError";
import { type ManualRefundDeliveryNote, type ManualRefundLookup } from "../types";
import { manualRefundDetailPath } from "../urls";
import { ManualRefundNewView } from "./ManualRefundNewView";

const mockNavigate = jest.fn();

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));
jest.mock("../api/manualRefundApi", () => ({
  lookupOrderForManualRefund: jest.fn(),
  createManualRefund: jest.fn(),
}));

const lookupMock = lookupOrderForManualRefund as jest.Mock;
const createMock = createManualRefund as jest.Mock;

const note = (overrides: Partial<ManualRefundDeliveryNote> = {}): ManualRefundDeliveryNote => ({
  fulfillmentId: "F2",
  label: "#1001-2",
  isReturn: true,
  items: [{ name: "Cricket Shoe", variant: "9", sku: "SHOE-9", quantity: 1 }],
  returnStatus: "RETURN_APPROVED",
  refundStatus: null,
  amount: 1000,
  destination: "ab****@okicici",
  lock: null,
  eligible: true,
  ineligibleReason: null,
  ...overrides,
});

const lookup = (notes: ManualRefundDeliveryNote[]): ManualRefundLookup => ({
  order_id: "O1",
  order_number: "1001",
  customer_name: "Asha",
  payment_mode: "COD",
  delivery_notes: notes,
});

const search = (orderNumber = "1001") => {
  fireEvent.change(screen.getByTestId("mrf-order-input"), { target: { value: orderNumber } });
  fireEvent.click(screen.getByTestId("mrf-search-button"));
};

describe("ManualRefundNewView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a not-found message with the search term", async () => {
    // Arrange
    lookupMock.mockRejectedValue(
      createManualReturnApiError({
        message: "Order 9999 not found",
        status: 404,
        code: "ORDER_NOT_FOUND",
      }),
    );
    render(<ManualRefundNewView />);

    // Act
    search("9999");

    // Assert
    expect(await screen.findByTestId("mrf-lookup-error")).toHaveTextContent(
      'No order found for "9999"',
    );
  });

  it("lists an ineligible delivery note as disabled, with its reason", async () => {
    // Arrange
    lookupMock.mockResolvedValue(
      lookup([
        note({
          eligible: false,
          ineligibleReason: "This return was exchanged, so it is not refunded.",
        }),
      ]),
    );
    render(<ManualRefundNewView />);

    // Act
    search();

    // Assert
    const card = await screen.findByTestId("mrf-dn-card");

    expect(card).toBeDisabled();
    expect(card).toHaveTextContent("This return was exchanged, so it is not refunded.");
  });

  it("sends one refund on a double click of Confirm, then opens it", async () => {
    // Arrange
    lookupMock.mockResolvedValue(lookup([note()]));

    let finish: (value: unknown) => void = () => {};

    createMock.mockReturnValue(new Promise(resolve => (finish = resolve)));
    render(<ManualRefundNewView />);
    search();
    fireEvent.click(await screen.findByTestId("mrf-dn-card"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByTestId("mrf-reason"), {
      target: { value: "Courier missed the pickup" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Act
    const confirm = screen.getByTestId("mrf-confirm-button");

    fireEvent.click(confirm);
    fireEvent.click(confirm);
    finish({ mrf_id: "MRF-12" });

    // Assert
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(manualRefundDetailPath("MRF-12")),
    );
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      order_number: "1001",
      fulfillment_id: "F2",
      reason: "Courier missed the pickup",
    });
  });
});
