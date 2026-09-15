import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { fetchManualReturn } from "../api/manualReturnApi";
import { makeDetail } from "../manualReturnFixtures";
import { type ManualReturnDetail } from "../types";
import { ManualReturnDetailView } from "./ManualReturnDetailView";

const mockNavigate = jest.fn();

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));
jest.mock("../api/manualReturnApi", () => ({
  fetchManualReturn: jest.fn(),
}));

const fetchMock = fetchManualReturn as jest.Mock;

const renderDetail = async (detail: ManualReturnDetail) => {
  fetchMock.mockResolvedValue(detail);
  render(<ManualReturnDetailView mrId={detail.mr_id} />);
  await screen.findByTestId("mr-card-original-order");
};

describe("ManualReturnDetailView", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    mockNavigate.mockReset();
  });

  it("shows a loading skeleton while the manual return loads", () => {
    // Arrange
    fetchMock.mockReturnValue(new Promise(() => undefined));

    // Act
    render(<ManualReturnDetailView mrId="MR-0042" />);

    // Assert
    expect(screen.getByTestId("mr-detail-loading")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("MR-0042");
  });

  it("FE-DETAIL01 renders the header and the four cards", async () => {
    // Act
    await renderDetail(makeDetail());

    // Assert
    expect(screen.getByRole("heading", { name: "MR-0042" })).toBeInTheDocument();
    expect(within(screen.getByTestId("mr-detail-status-chip")).getByText("Return Picked Up"));

    const order = within(screen.getByTestId("mr-card-original-order"));

    expect(order.getByText("Original Order")).toBeInTheDocument();
    expect(order.getByText("#1001")).toBeInTheDocument();
    expect(order.getByText("Asha Rao")).toBeInTheDocument();
    expect(order.getByText("asha@example.com")).toBeInTheDocument();
    expect(order.getByText("+919876543210")).toBeInTheDocument();
    expect(order.getByText("COD")).toBeInTheDocument();

    expect(
      within(screen.getByTestId("mr-card-items")).getByText("Items Being Returned"),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId("mr-card-refund")).getByText("Refund")).toBeInTheDocument();

    const agent = within(screen.getByTestId("mr-card-agent"));

    expect(agent.getByText("Agent Info")).toBeInTheDocument();
    expect(agent.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(agent.getByText("ravi@tenxyou.com")).toBeInTheDocument();
    expect(agent.getByText("Created")).toBeInTheDocument();
  });

  it("FE-DETAIL02 items card shows product, SKU, size, eligibility, reason and override", async () => {
    // Act
    await renderDetail(makeDetail());

    // Assert
    const items = within(screen.getByTestId("mr-card-items"));

    expect(items.getByText("Linen Shirt")).toBeInTheDocument();
    expect(items.getByText("SKU-LINEN-M")).toBeInTheDocument();
    expect(items.getByText("M")).toBeInTheDocument();
    expect(items.getByText("1 of 2 eligible")).toBeInTheDocument();
    expect(items.getByText("Reason for Return")).toBeInTheDocument();
    expect(items.getByText("Size issue")).toBeInTheDocument();
    expect(items.getByText("Policy Override")).toBeInTheDocument();
    expect(items.getByText("Yes")).toBeInTheDocument();
    expect(items.getByText("Return window exceeded")).toBeInTheDocument();
    expect(
      items.getByText("Customer was travelling and could not return in time"),
    ).toBeInTheDocument();
  });

  it("FE-DETAIL02 shows Policy Override No without a note when not overridden", async () => {
    // Act
    await renderDetail(
      makeDetail({ is_override: false, override_note: null, override_reasons: [] }),
    );

    // Assert
    const items = within(screen.getByTestId("mr-card-items"));

    expect(items.getByText("No")).toBeInTheDocument();
    expect(items.queryByText("Override Note")).not.toBeInTheDocument();
  });

  it("FE-DETAIL03 refund card shows estimate, status and COD refund contact", async () => {
    // Act
    await renderDetail(
      makeDetail({
        refund: {
          provider: "EASEBUZZ",
          status: "REFUND_INITIATED",
          status_label: "Refund Initiated",
          amount: 1199,
          reference_id: "TRF-778",
          failure_reason: null,
        },
      }),
    );

    // Assert
    const refund = within(screen.getByTestId("mr-card-refund"));

    expect(refund.getByText(/₹\s?1,199\.00/)).toBeInTheDocument();
    expect(refund.getByText("Refund Initiated")).toBeInTheDocument();
    expect(refund.getByText("Easebuzz")).toBeInTheDocument();
    expect(refund.getByText("TRF-778")).toBeInTheDocument();
    expect(refund.getByText("asha@example.com")).toBeInTheDocument();
    expect(refund.getByText("asha@okaxis")).toBeInTheDocument();
  });

  it("FE-DETAIL03 shows 'Not started' and no refund contact for a prepaid MR without a refund", async () => {
    // Act
    await renderDetail(
      makeDetail({ payment_method: "PREPAID", refund_email: null, refund_upi: null }),
    );

    // Assert
    const refund = within(screen.getByTestId("mr-card-refund"));

    expect(refund.getByText("Not started")).toBeInTheDocument();
    expect(refund.queryByText("Refund UPI")).not.toBeInTheDocument();
    expect(refund.queryByText("Refund Email")).not.toBeInTheDocument();
  });

  it("FE-DETAIL04 COD refund failure points the agent to the Easebuzz dashboard", async () => {
    // Act
    await renderDetail(
      makeDetail({
        refund: {
          provider: "EASEBUZZ",
          status: "REFUND_FAILED",
          status_label: "Refund Failed",
          amount: 1199,
          reference_id: "TRF-778",
          failure_reason: "Beneficiary VPA invalid",
        },
      }),
    );

    // Assert
    const guidance = screen.getByTestId("mr-refund-failure-guidance");

    expect(guidance).toHaveAttribute("role", "alert");
    expect(
      within(guidance).getByText(
        "Payout failed — check the Easebuzz dashboard (transfer ID TRF-778) and process the refund manually.",
      ),
    ).toBeInTheDocument();
    expect(within(guidance).getByText(/Beneficiary VPA invalid/)).toBeInTheDocument();
  });

  it("FE-DETAIL04 prepaid refund failure points the agent to the GoKwik dashboard with the failure reason", async () => {
    // Act
    await renderDetail(
      makeDetail({
        payment_method: "PREPAID",
        refund_email: null,
        refund_upi: null,
        refund: {
          provider: "GOKWIK",
          status: "REFUND_FAILED",
          status_label: "Refund Failed",
          amount: 1199,
          reference_id: "GK-991",
          failure_reason: "Bank account closed",
        },
      }),
    );

    // Assert
    const guidance = within(screen.getByTestId("mr-refund-failure-guidance"));

    expect(
      guidance.getByText(
        "Refund failed — check the GoKwik dashboard (refund ID GK-991) and process the refund manually.",
      ),
    ).toBeInTheDocument();
    expect(guidance.getByText(/Bank account closed/)).toBeInTheDocument();
  });

  it("FE-DETAIL05 shows return status and ERP sync below the cards and no audit trail", async () => {
    // Act
    await renderDetail(makeDetail());

    // Assert
    const status = within(screen.getByTestId("mr-detail-status-section"));

    expect(status.getByText("Return Picked Up")).toBeInTheDocument();
    expect(status.getByText("ERP sync: Pending")).toBeInTheDocument();
    expect(screen.queryByText(/audit/i)).not.toBeInTheDocument();
  });

  it("FE-DETAIL05 shows the last ERP error and attempts when sync failed", async () => {
    // Act
    await renderDetail(
      makeDetail({
        erp_sync_status: "FAILED",
        erp_sync_attempts: 3,
        erp_sync_last_error: "ERP did not acknowledge after 3 attempts",
      }),
    );

    // Assert
    const status = within(screen.getByTestId("mr-detail-status-section"));

    expect(status.getByText("ERP sync: Failed")).toBeInTheDocument();
    expect(status.getByText(/ERP did not acknowledge after 3 attempts/)).toBeInTheDocument();
    expect(status.getByText(/Attempts: 3/)).toBeInTheDocument();
  });

  it("shows a finalizing banner for INCOMPLETE manual returns", async () => {
    // Act
    await renderDetail(makeDetail({ creation_status: "INCOMPLETE" }));

    // Assert
    expect(
      screen.getByText("Finalizing — Saleor return created, remaining steps are being completed."),
    ).toBeInTheDocument();
  });

  it("FE-DETAIL06 load failure renders an error state with retry instead of a blank page", async () => {
    // Arrange
    fetchMock.mockRejectedValueOnce(new Error("Request failed: 502"));
    fetchMock.mockResolvedValueOnce(makeDetail());
    render(<ManualReturnDetailView mrId="MR-0042" />);

    // Assert
    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText("Couldn't load MR-0042")).toBeInTheDocument();
    expect(within(alert).getByText("Request failed: 502")).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    // Assert
    await screen.findByTestId("mr-card-original-order");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("navigates back to the manual returns list", async () => {
    // Arrange
    await renderDetail(makeDetail());

    // Act
    fireEvent.click(screen.getByRole("button", { name: /Back to Manual Returns/ }));

    // Assert
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/returns-exchange/manual-returns"),
    );
  });
});
