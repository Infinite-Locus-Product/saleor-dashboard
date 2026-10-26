import { useUser } from "@dashboard/auth/useUser";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CXApiError } from "../api/cxApiError";
import { fetchProductVariants, fetchReturn, submitConvertToExchange } from "../api/returnsApi";
import { type CXReturnDetail, type ProductVariant } from "../types";
import { requestDetailPath } from "../urls";
import { SizeSelectionView } from "./SizeSelectionView";

const mockNavigate = jest.fn();
const mockNotify = jest.fn();

jest.mock("@dashboard/auth/useUser", () => ({
  useUser: jest.fn(),
}));
jest.mock("@dashboard/hooks/useNotifier", () => ({
  useNotifier: (): jest.Mock => mockNotify,
}));
jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: (): jest.Mock => mockNavigate,
}));
jest.mock("../api/returnsApi", () => ({
  fetchReturn: jest.fn(),
  fetchProductVariants: jest.fn(),
  submitConvertToExchange: jest.fn(),
}));

const fetchReturnMock = fetchReturn as jest.Mock;
const fetchVariantsMock = fetchProductVariants as jest.Mock;
const convertMock = submitConvertToExchange as jest.Mock;

const REQUEST_ID = "REQ-6120";

const makeDetail = (overrides: Record<string, unknown> = {}): CXReturnDetail =>
  ({
    request_id: REQUEST_ID,
    product_name: "Linen Shirt",
    product_variant_id: "V-M",
    product_id: "P1",
    cx_status: "CX_ACTION",
    eligibility: {
      isExchangeable: true,
      withinWindow: true,
      daysInWindow: 3,
      windowDays: 7,
      requiresOverride: false,
      overrideReasons: [],
    },
    ...overrides,
  }) as unknown as CXReturnDetail;

const variant = (id: string, size: string, quantityAvailable = 5): ProductVariant => ({
  id,
  name: size,
  sku: `LS-01-${size}`,
  quantityAvailable,
  attributes: [{ attribute: { name: "Size" }, values: [{ name: size }] }],
});

const renderView = async (detail: CXReturnDetail = makeDetail()): Promise<void> => {
  fetchReturnMock.mockResolvedValue(detail);
  fetchVariantsMock.mockResolvedValue([variant("V-M", "M"), variant("V-L", "L")]);
  render(<SizeSelectionView requestId={REQUEST_ID} />);
  await waitFor(() => expect(fetchReturnMock).toHaveBeenCalled());
};

const selectSizeAndConfirm = async (): Promise<void> => {
  fireEvent.click(await screen.findByText("L"));
  fireEvent.click(screen.getByRole("button", { name: /Confirm Exchange/ }));
};

describe("SizeSelectionView — TTXY-6041 round 2 (R2-C3)", () => {
  beforeEach(() => {
    (useUser as jest.Mock).mockReturnValue({
      user: { id: "VXNlcjo3", email: "ravi@tenxyou.com", firstName: "Ravi", lastName: "Kumar" },
    });
    fetchReturnMock.mockReset();
    fetchVariantsMock.mockReset();
    convertMock.mockReset();
    mockNotify.mockReset();
    mockNavigate.mockReset();
  });

  it("a successful convert navigates back to the request detail", async () => {
    // Arrange
    await renderView();
    convertMock.mockResolvedValue({});

    // Act
    await selectSizeAndConfirm();

    // Assert
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(requestDetailPath(REQUEST_ID)));
    expect(convertMock).toHaveBeenCalledWith(
      REQUEST_ID,
      expect.objectContaining({ replacement_variant_id: "V-L" }),
    );
  });

  it.each([
    [409, "ALREADY_CLOSED", "Return request is already closed (RETURN_REJECTED)"],
    [409, "LINE_REJECTED", "Return line has been rejected"],
    [404, "NOT_FOUND", "Return request not found"],
  ])(
    "R2-C3 a %p (%s) on convert shows a toast and navigates to the request detail",
    async (status, code, message) => {
      // Arrange
      await renderView();
      convertMock.mockRejectedValue(new CXApiError(message, status, code));

      // Act
      await selectSizeAndConfirm();

      // Assert
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith(
          expect.objectContaining({ status: "error", text: message }),
        ),
      );
      expect(mockNavigate).toHaveBeenCalledWith(requestDetailPath(REQUEST_ID));
    },
  );

  it("R2-C3 a 409 APPROVAL_IN_PROGRESS on convert shows a toast and stays on the page", async () => {
    // Arrange
    await renderView();
    convertMock.mockRejectedValue(
      new CXApiError("An approval is in progress", 409, "APPROVAL_IN_PROGRESS"),
    );

    // Act
    await selectSizeAndConfirm();

    // Assert
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error", text: "An approval is in progress" }),
      ),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Confirm Exchange/ })).toBeEnabled();
  });

  it("R2-C3 (control) any other convert error stays on the page with the inline error", async () => {
    // Arrange
    await renderView();
    convertMock.mockRejectedValue(new CXApiError("Out of stock", 400, "OUT_OF_STOCK"));

    // Act
    await selectSizeAndConfirm();

    // Assert
    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Confirm Exchange/ })).toBeEnabled();
  });

  it.each(["APPROVED", "AUTO_APPROVED", "EXCHANGED", "RETURN_REJECTED"])(
    "R2-C3 a request that is already closed (%s) on load redirects to the request detail",
    async status => {
      // Act
      await renderView(makeDetail({ cx_status: status }));

      // Assert
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(requestDetailPath(REQUEST_ID), {
          replace: true,
        }),
      );
      expect(screen.queryByRole("button", { name: /Confirm Exchange/ })).not.toBeInTheDocument();
    },
  );

  it("R2-C3 (control) an open request on load stays on the size page", async () => {
    // Act
    await renderView();

    // Assert
    expect(await screen.findByRole("button", { name: /Confirm Exchange/ })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
