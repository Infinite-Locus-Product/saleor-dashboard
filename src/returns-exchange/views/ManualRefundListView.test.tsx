import { fireEvent, render, screen } from "@testing-library/react";

import { fetchManualRefunds } from "../api/manualRefundApi";
import { type ManualRefundListItem } from "../types";
import { manualRefundDetailPath } from "../urls";
import { ManualRefundListView } from "./ManualRefundListView";

const mockNavigate = jest.fn();

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));
jest.mock("../api/manualRefundApi", () => ({
  fetchManualRefunds: jest.fn(),
}));

const fetchMock = fetchManualRefunds as jest.Mock;

const row = (overrides: Partial<ManualRefundListItem> = {}): ManualRefundListItem => ({
  mrf_id: "MRF-12",
  order_number: "1001",
  customer_name: "Asha",
  dn_label: "#1001-2",
  items: [{ name: "Cricket Shoe", variant: "9", sku: "SHOE-9", quantity: 1 }],
  raised_by_name: "Agent One",
  created_at: "2026-10-20T10:00:00Z",
  refund_status: "REFUND_INITIATED",
  needs_attention: false,
  ...overrides,
});

describe("ManualRefundListView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens a refund's detail when its row is clicked", async () => {
    // Arrange
    fetchMock.mockResolvedValue({ data: [row()], pagination: { total: 1, page: 1, limit: 20 } });
    render(<ManualRefundListView />);

    // Act
    fireEvent.click(await screen.findByTestId("mrf-row"));

    // Assert
    expect(mockNavigate).toHaveBeenCalledWith(manualRefundDetailPath("MRF-12"));
  });

  it("shows failed in red, over-48 h in yellow, and the rest in the default colour", async () => {
    // Arrange
    fetchMock.mockResolvedValue({
      data: [
        row({ mrf_id: "MRF-1", refund_status: "REFUND_FAILED" }),
        row({ mrf_id: "MRF-2", refund_status: "REFUND_INITIATED", needs_attention: true }),
        row({ mrf_id: "MRF-3", refund_status: "REFUND_INITIATED", needs_attention: false }),
      ],
      pagination: { total: 3, page: 1, limit: 20 },
    });

    // Act
    render(<ManualRefundListView />);

    // Assert
    const [failed, stuck, fresh] = await screen.findAllByTestId("mrf-status-chip");

    expect(failed).toHaveStyle({ background: "#fee2e2" });
    expect(stuck).toHaveStyle({ background: "#fef9c3" });
    expect(fresh).toHaveStyle({ background: "#f1f5f9" });
  });
});
