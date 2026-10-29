import { fireEvent, render, screen } from "@testing-library/react";

import { fetchManualRefund, markManualRefundRefunded } from "../api/manualRefundApi";
import { type ManualRefundDetail } from "../types";
import { ManualRefundDetailView } from "./ManualRefundDetailView";

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => jest.fn(),
}));
jest.mock("../api/manualRefundApi", () => ({
  fetchManualRefund: jest.fn(),
  saveManualRefundProof: jest.fn(),
  markManualRefundRefunded: jest.fn(),
}));

const fetchMock = fetchManualRefund as jest.Mock;

const refund = (overrides: Partial<ManualRefundDetail> = {}): ManualRefundDetail => ({
  mrf_id: "MRF-12",
  order_number: "1001",
  customer_name: "Asha",
  dn_label: "#1001-2",
  items: [{ name: "Cricket Shoe", variant: "9", sku: "SHOE-9", quantity: 1 }],
  raised_by_name: "Agent One",
  created_at: "2026-10-20T10:00:00Z",
  refund_status: "REFUND_FAILED",
  needs_attention: false,
  payment_mode: "COD",
  destination: "ab****@okicici",
  amount: 1000,
  reason: "Courier missed the pickup",
  gateway_reference: "MRF12_1792481489342",
  gateway_message: null,
  txn_reference: "UTR123",
  proof_url: "https://s3.test/proof.png",
  proof_uploaded_by_name: "Agent One",
  proof_uploaded_at: "2026-10-20T11:00:00Z",
  closed_by_name: null,
  closed_at: null,
  status_history: [],
  ...overrides,
});

const renderWith = async (mrf: ManualRefundDetail) => {
  fetchMock.mockResolvedValue(mrf);
  render(<ManualRefundDetailView mrfId="MRF-12" />);

  return screen.findByTestId("mrf-mark-refunded");
};

describe("ManualRefundDetailView — Mark as Refunded", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is enabled on a failed refund with the proof saved", async () => {
    // Act
    const button = await renderWith(refund());

    // Assert
    expect(button).toBeEnabled();
  });

  it("is disabled while the gateway is still processing (under 48 h)", async () => {
    // Act
    const button = await renderWith(
      refund({ refund_status: "REFUND_INITIATED", needs_attention: false }),
    );

    // Assert
    expect(button).toBeDisabled();
    expect(screen.getByText(/still processing this refund/)).toBeInTheDocument();
  });

  it("is enabled once a processing refund is over 48 h", async () => {
    // Act
    const button = await renderWith(
      refund({ refund_status: "REFUND_IN_PROCESS", needs_attention: true }),
    );

    // Assert
    expect(button).toBeEnabled();
  });

  it("is disabled until the proof is saved", async () => {
    // Act
    const button = await renderWith(
      refund({ txn_reference: null, proof_uploaded_at: null, proof_url: null }),
    );

    // Assert
    expect(button).toBeDisabled();
  });

  it("is disabled while a typed reference is not saved yet", async () => {
    // Arrange
    const button = await renderWith(refund());

    // Act
    fireEvent.change(screen.getByTestId("mrf-txn-input"), { target: { value: "UTR999" } });

    // Assert
    expect(button).toBeDisabled();
    expect(screen.getByText(/Save proof first/)).toBeInTheDocument();
  });

  it("is not shown on a completed refund", async () => {
    // Arrange
    fetchMock.mockResolvedValue(
      refund({
        refund_status: "REFUND_COMPLETED",
        closed_at: "2026-10-21T10:00:00Z",
        closed_by_name: "Agent One",
      }),
    );

    // Act
    render(<ManualRefundDetailView mrfId="MRF-12" />);

    // Assert
    expect(await screen.findByText("Paid outside the system")).toBeInTheDocument();
    expect(screen.queryByTestId("mrf-mark-refunded")).not.toBeInTheDocument();
  });

  it("reloads the refund after a failed close, so a lost response still shows Completed", async () => {
    // Arrange
    jest.spyOn(window, "confirm").mockReturnValue(true);

    const button = await renderWith(refund());

    (markManualRefundRefunded as jest.Mock).mockRejectedValue(new Error("Request failed: 504"));
    fetchMock.mockResolvedValue(
      refund({
        refund_status: "REFUND_COMPLETED",
        closed_at: "2026-10-21T10:00:00Z",
        closed_by_name: "Agent One",
      }),
    );

    // Act
    fireEvent.click(button);

    // Assert
    expect(await screen.findByText("Paid outside the system")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("ManualRefundDetailView — proof file check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const pick = (file: File) =>
    fireEvent.change(screen.getByTestId("mrf-proof-input"), { target: { files: [file] } });

  it("rejects a file over 10 MB before uploading", async () => {
    // Arrange
    await renderWith(refund({ txn_reference: null, proof_uploaded_at: null, proof_url: null }));

    const big = new File(["x"], "proof.pdf", { type: "application/pdf" });

    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });

    // Act
    pick(big);

    // Assert
    expect(screen.getByText("Payment proof must be 10 MB or smaller")).toBeInTheDocument();
    expect(screen.getByTestId("mrf-save-proof")).toBeDisabled();
  });

  it("rejects a file that isn't a PDF or an image", async () => {
    // Arrange
    await renderWith(refund({ txn_reference: null, proof_uploaded_at: null, proof_url: null }));

    // Act
    pick(new File(["x"], "proof.zip", { type: "application/zip" }));

    // Assert
    expect(
      screen.getByText("Payment proof must be a PDF or a JPG, PNG or WEBP image"),
    ).toBeInTheDocument();
  });
});
