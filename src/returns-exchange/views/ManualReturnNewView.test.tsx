import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createManualReturns,
  fetchReturnReasons,
  lookupOrderForManualReturn,
} from "../api/manualReturnApi";
import { createManualReturnApiError } from "../api/manualReturnApiError";
import {
  cottonTeeItem,
  deliveredShipment,
  denimJacketItem,
  inTransitShipment,
  makeLookupItem,
  makeLookupResult,
  returnedShipment,
  returnReasonsFixture,
  silkTieItem,
} from "../manualReturnFixtures";
import { type CreateManualReturnResult, type LookupResult } from "../types";
import { ManualReturnNewView } from "./ManualReturnNewView";

const mockNavigate = jest.fn();

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => mockNavigate,
}));
jest.mock("../api/manualReturnApi", () => ({
  fetchReturnReasons: jest.fn(),
  lookupOrderForManualReturn: jest.fn(),
  createManualReturns: jest.fn(),
}));

const reasonsMock = fetchReturnReasons as jest.Mock;
const lookupMock = lookupOrderForManualReturn as jest.Mock;
const createMock = createManualReturns as jest.Mock;

const NOTE = "Customer was travelling and missed the return window";

const prepaidLookup: LookupResult = makeLookupResult();
const codLookup: LookupResult = makeLookupResult({
  paymentMethod: "COD",
  requiresRefundContact: true,
});

const successResult: CreateManualReturnResult = {
  status: 201,
  ok: true,
  results: [
    { originalFulfillmentId: "F1", ok: true, mrId: "MR-0042", creationStatus: "COMPLETED" },
  ],
};

// ─── helpers ────────────────────────────────────────────────────────────────

const renderView = () => render(<ManualReturnNewView />);

const lookUp = async (orderNumber = "1001") => {
  fireEvent.change(screen.getByLabelText("Order number"), { target: { value: orderNumber } });
  fireEvent.click(screen.getByTestId("mr-lookup-button"));
  await screen.findByTestId("mr-step-items");
};

const rowFor = (productName: string): HTMLElement => {
  const row = screen
    .getAllByTestId("mr-item-row")
    .find(r => within(r).getByTestId("mr-item-name").textContent === productName);

  if (!row) {
    throw new Error(`Row for "${productName}" not found`);
  }

  return row;
};

const toggleItem = (productName: string) =>
  fireEvent.click(within(rowFor(productName)).getByRole("checkbox"));

const increase = (productName: string) =>
  fireEvent.click(within(rowFor(productName)).getByTestId("mr-qty-increase"));

const decrease = (productName: string) =>
  fireEvent.click(within(rowFor(productName)).getByTestId("mr-qty-decrease"));

const qtyOf = (productName: string) => within(rowFor(productName)).getByTestId("mr-qty-value");

const chooseReason = async (label: string) => {
  const user = userEvent.setup();

  await act(async () => {
    await user.click(within(screen.getByTestId("mr-reason-select")).getByRole("combobox"));
  });

  const option = screen.getAllByTestId("select-option").find(o => o.textContent === label);

  if (!option) {
    throw new Error(`Reason "${label}" not found`);
  }

  await act(async () => {
    await user.click(option);
  });
};

const next = () => fireEvent.click(screen.getByTestId("mr-next"));
const back = () => fireEvent.click(screen.getByTestId("mr-back"));
const typeNote = (value: string) =>
  fireEvent.change(screen.getByTestId("mr-override-note"), { target: { value } });

interface FlowOptions {
  lookup?: LookupResult;
  items?: Array<{ name: string; quantity?: number }>;
  reason?: string;
  note?: string;
  email?: string;
  upi?: string;
}

const goToReview = async ({
  lookup = prepaidLookup,
  items = [{ name: "Linen Shirt" }],
  reason = "Size issue",
  note,
  email = "asha@example.com",
  upi = "asha@okaxis",
}: FlowOptions = {}) => {
  lookupMock.mockResolvedValue(lookup);
  renderView();
  await lookUp(lookup.orderNumber);

  for (const { name, quantity = 1 } of items) {
    toggleItem(name);

    for (let i = 1; i < quantity; i++) {
      increase(name);
    }
  }

  next();
  await screen.findByTestId("mr-step-reason");
  await chooseReason(reason);

  if (note !== undefined) {
    typeNote(note);
  }

  next();

  if (lookup.requiresRefundContact) {
    await screen.findByTestId("mr-step-contact");
    fireEvent.change(screen.getByLabelText("Refund email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("UPI ID"), { target: { value: upi } });
    next();
  }

  await screen.findByTestId("mr-step-review");
};

/** `document.getElementById` is stubbed in testUtils/setup.ts, so resolve ids via querySelector. */
const byId = (id: string) => document.querySelector<HTMLElement>(`[id="${id}"]`);

const expectLinkedError = (control: HTMLElement, message: string) => {
  const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  const errorElement = ids.map(byId).find(el => el?.textContent?.includes(message));

  expect(errorElement).toBeTruthy();
  expect(errorElement?.closest('[aria-live="polite"]')).not.toBeNull();
  expect(control).toHaveAttribute("aria-invalid", "true");
};

// ─── tests ──────────────────────────────────────────────────────────────────

describe("ManualReturnNewView", () => {
  beforeEach(() => {
    reasonsMock.mockReset().mockResolvedValue(returnReasonsFixture);
    lookupMock.mockReset();
    createMock.mockReset();
    mockNavigate.mockReset();
  });

  describe("Step 1 — order lookup", () => {
    it("FE-NEW01 shows a validation error for an empty order number", async () => {
      // Arrange
      renderView();

      // Act
      fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "   " } });
      fireEvent.click(screen.getByTestId("mr-lookup-button"));

      // Assert
      expect(await screen.findByText("Enter an order number")).toBeInTheDocument();
      expect(lookupMock).not.toHaveBeenCalled();
      expectLinkedError(screen.getByLabelText("Order number"), "Enter an order number");
    });

    it("FE-NEW02 shows 'not found' and keeps the input so the agent can retry", async () => {
      // Arrange
      lookupMock
        .mockRejectedValueOnce(
          createManualReturnApiError({
            message: "Order 9999 not found",
            status: 404,
            code: "ORDER_NOT_FOUND",
          }),
        )
        .mockResolvedValueOnce(prepaidLookup);
      renderView();

      // Act
      fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "9999" } });
      fireEvent.click(screen.getByTestId("mr-lookup-button"));

      // Assert
      expect(await screen.findByText("Order #9999 not found")).toBeInTheDocument();
      expect(screen.getByLabelText("Order number")).toHaveValue("9999");
      expect(screen.queryByTestId("mr-step-items")).not.toBeInTheDocument();

      // Act
      await lookUp("#1001");

      // Assert
      expect(lookupMock).toHaveBeenLastCalledWith("1001");
    });

    it("FE-NEW03 network error shows a retryable error and keeps the input", async () => {
      // Arrange
      lookupMock
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(prepaidLookup);
      renderView();

      // Act
      fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "1001" } });
      fireEvent.click(screen.getByTestId("mr-lookup-button"));

      // Assert
      const alert = await screen.findByRole("alert");

      expect(alert).toHaveTextContent("Failed to fetch");
      expect(screen.getByLabelText("Order number")).toHaveValue("1001");

      // Act
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

      // Assert
      await screen.findByTestId("mr-step-items");
      expect(lookupMock).toHaveBeenCalledTimes(2);
      expect(lookupMock).toHaveBeenNthCalledWith(2, "1001");
    });

    it("looks up the order when Enter is pressed in the order number field", async () => {
      // Arrange
      lookupMock.mockResolvedValue(prepaidLookup);
      renderView();

      // Act
      const input = screen.getByLabelText("Order number");

      fireEvent.change(input, { target: { value: "1001" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // Assert
      await screen.findByTestId("mr-step-items");
      expect(lookupMock).toHaveBeenCalledWith("1001");
    });
  });

  describe("Step 2 — select items", () => {
    it("FE-NEW04 groups items per shipment and disables ineligible rows with a reason", async () => {
      // Arrange
      lookupMock.mockResolvedValue(prepaidLookup);
      renderView();

      // Act
      await lookUp();

      // Assert
      const header = screen.getByTestId("mr-order-header");

      expect(header).toHaveTextContent("Order #1001");
      expect(header).toHaveTextContent("Asha Rao");
      expect(header).toHaveTextContent("Prepaid");

      const groups = screen.getAllByTestId("mr-shipment-group");

      expect(groups).toHaveLength(4);
      expect(within(groups[0]).getByRole("heading")).toHaveTextContent(/^Shipment 1 · Delivered /);
      expect(
        within(groups[0])
          .getAllByTestId("mr-item-name")
          .map(el => el.textContent),
      ).toEqual(["Linen Shirt", "Denim Jacket", "Cotton Tee"]);
      expect(within(groups[1]).getByRole("heading")).toHaveTextContent(/^Shipment 2/);
      expect(within(groups[2]).getByRole("heading")).toHaveTextContent(/^Shipment 3/);
      expect(within(groups[3]).getByRole("heading")).toHaveTextContent("Not yet shipped");

      const linen = rowFor("Linen Shirt");

      expect(within(linen).getByRole("checkbox")).toBeEnabled();
      expect(linen).toHaveTextContent("SKU-LINEN-M");
      expect(linen).toHaveTextContent("Size M · Blue");
      expect(linen).toHaveTextContent(/₹\s?1,299\.00/);
      expect(linen).toHaveTextContent("Eligible");
      expect(linen).toHaveTextContent("5 days since delivery · 7-day window");

      for (const [name, reason] of [
        [cottonTeeItem.productName, "Return REQ-0042 · CX_REVIEW"],
        ["Chino Pants", "Status: OUT_FOR_DELIVERY"],
        ["Wool Scarf", "Return REQ-0007 · RETURN_CANCELLED"],
        [silkTieItem.productName, "Not yet shipped"],
      ]) {
        const row = rowFor(name);

        expect(within(row).getByRole("checkbox")).toBeDisabled();
        expect(within(row).getByTestId("mr-item-disabled-reason")).toHaveTextContent(reason);
        expect(within(row).queryByTestId("mr-qty-increase")).not.toBeInTheDocument();
      }
    });

    it("FE-NEW05 caps the quantity stepper at eligibleQuantity and allows partial quantity", async () => {
      // Arrange
      lookupMock.mockResolvedValue(prepaidLookup);
      renderView();
      await lookUp();

      // Assert
      expect(screen.getByTestId("mr-next")).toBeDisabled();
      expect(rowFor("Linen Shirt")).toHaveTextContent("0 of 2 eligible");

      // Act
      toggleItem("Linen Shirt");

      // Assert
      expect(qtyOf("Linen Shirt")).toHaveTextContent("1");
      expect(rowFor("Linen Shirt")).toHaveTextContent("1 of 2 eligible");
      expect(within(rowFor("Linen Shirt")).getByTestId("mr-qty-decrease")).toBeDisabled();
      expect(screen.getByTestId("mr-next")).toBeEnabled();

      // Act
      increase("Linen Shirt");

      // Assert
      expect(qtyOf("Linen Shirt")).toHaveTextContent("2");
      expect(rowFor("Linen Shirt")).toHaveTextContent("2 of 2 eligible");
      expect(within(rowFor("Linen Shirt")).getByTestId("mr-qty-increase")).toBeDisabled();

      // Act
      increase("Linen Shirt");
      decrease("Linen Shirt");

      // Assert
      expect(qtyOf("Linen Shirt")).toHaveTextContent("1");

      // Act
      toggleItem("Linen Shirt");

      // Assert
      expect(within(rowFor("Linen Shirt")).queryByTestId("mr-qty-value")).not.toBeInTheDocument();
      expect(screen.getByTestId("mr-next")).toBeDisabled();
    });

    it("FE-NEW06 shows a badge per override reason and an override notice when selected", async () => {
      // Arrange
      lookupMock.mockResolvedValue(prepaidLookup);
      renderView();
      await lookUp();

      // Assert
      const denim = rowFor(denimJacketItem.productName);

      expect(within(denim).getByText("Return window exceeded")).toBeInTheDocument();
      expect(within(denim).getByText("Product not returnable")).toBeInTheDocument();
      expect(
        within(rowFor("Linen Shirt")).queryByText("Return window exceeded"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("mr-override-notice")).not.toBeInTheDocument();

      // Act
      toggleItem("Denim Jacket");

      // Assert
      expect(screen.getByTestId("mr-override-notice")).toHaveTextContent(
        /override note will be required/i,
      );
    });

    it("FE-NEW07 shows a 'nothing eligible' state when the order has no eligible units", async () => {
      // Arrange
      lookupMock.mockResolvedValue(
        makeLookupResult({
          hasEligibleItems: false,
          shipments: [inTransitShipment, returnedShipment],
          unfulfilledItems: [silkTieItem],
        }),
      );
      renderView();

      // Act
      await lookUp();

      // Assert
      expect(
        screen.getByText("Nothing on this order is eligible for a manual return"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("mr-next")).toBeDisabled();
      expect(screen.getAllByRole("checkbox").every(box => (box as HTMLInputElement).disabled)).toBe(
        true,
      );
    });
  });

  describe("Step 3 — reason", () => {
    it("FE-NEW08 requires a reason; note is optional when no override applies", async () => {
      // Arrange
      lookupMock.mockResolvedValue(prepaidLookup);
      renderView();
      await lookUp();
      toggleItem("Linen Shirt");
      next();
      await screen.findByTestId("mr-step-reason");

      // Assert
      expect(screen.getByLabelText("Note (optional)")).toBeInTheDocument();
      expect(screen.queryByLabelText("Override note (required)")).not.toBeInTheDocument();

      // Act
      next();

      // Assert
      expect(screen.getByText("Select a return reason")).toBeInTheDocument();
      expect(screen.getByTestId("mr-step-reason")).toBeInTheDocument();

      // Act
      await chooseReason("Size issue");
      next();

      // Assert
      await screen.findByTestId("mr-step-review");
    });

    it("FE-NEW08 requires an override note of 15–1000 characters when a selected unit needs override", async () => {
      // Arrange
      lookupMock.mockResolvedValue(prepaidLookup);
      renderView();
      await lookUp();
      toggleItem("Denim Jacket");
      next();
      await screen.findByTestId("mr-step-reason");
      await chooseReason("Damaged product");

      // Assert
      expect(screen.getByLabelText("Override note (required)")).toBeInTheDocument();

      // Act
      next();

      // Assert
      expect(screen.getByText("Override note must be at least 15 characters")).toBeInTheDocument();

      // Act
      typeNote("Too short");
      next();

      // Assert
      expect(screen.getByTestId("mr-note-counter")).toHaveTextContent("9 / 1000");
      expect(screen.getByTestId("mr-step-reason")).toBeInTheDocument();

      // Act
      typeNote("x".repeat(1001));
      next();

      // Assert
      expect(
        screen.getByText("Override note must be 1000 characters or fewer"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("mr-step-reason")).toBeInTheDocument();

      // Act
      typeNote(NOTE);
      next();

      // Assert
      await screen.findByTestId("mr-step-review");
    });
  });

  describe("Step 4 — refund contact", () => {
    it("FE-NEW09 COD orders require a valid refund email and UPI ID", async () => {
      // Arrange
      lookupMock.mockResolvedValue(codLookup);
      renderView();
      await lookUp();
      toggleItem("Linen Shirt");
      next();
      await screen.findByTestId("mr-step-reason");
      await chooseReason("Size issue");
      next();
      await screen.findByTestId("mr-step-contact");

      // Act
      next();

      // Assert
      expect(screen.getByText("Enter the refund email")).toBeInTheDocument();
      expect(screen.getByText("Enter the UPI ID")).toBeInTheDocument();

      // Act
      fireEvent.change(screen.getByLabelText("Refund email"), { target: { value: "asha@" } });
      fireEvent.change(screen.getByLabelText("UPI ID"), { target: { value: "asha@ok1" } });
      next();

      // Assert
      expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
      expect(screen.getByText("Enter a valid UPI ID (e.g. name@bank)")).toBeInTheDocument();
      expect(screen.getByTestId("mr-step-contact")).toBeInTheDocument();

      // Act
      fireEvent.change(screen.getByLabelText("Refund email"), {
        target: { value: "asha@example.com" },
      });
      fireEvent.change(screen.getByLabelText("UPI ID"), { target: { value: "asha@okaxis" } });
      next();

      // Assert
      const review = await screen.findByTestId("mr-step-review");

      expect(review).toHaveTextContent("asha@example.com");
      expect(review).toHaveTextContent("asha@okaxis");
    });

    it("FE-NEW09 prepaid orders skip the refund contact step", async () => {
      // Arrange
      await goToReview();

      // Assert
      expect(screen.queryByTestId("mr-step-contact")).not.toBeInTheDocument();

      // Act
      back();

      // Assert
      expect(await screen.findByTestId("mr-step-reason")).toBeInTheDocument();
    });
  });

  describe("Step 5 — review", () => {
    it("FE-NEW10 shows order, customer, pickup address, lines, estimate, reason, note and COD contact", async () => {
      // Arrange / Act
      await goToReview({
        lookup: codLookup,
        items: [{ name: "Linen Shirt", quantity: 2 }, { name: "Denim Jacket" }],
        reason: "Damaged product",
        note: NOTE,
      });

      // Assert
      const review = within(screen.getByTestId("mr-step-review"));

      expect(review.getByText("#1001")).toBeInTheDocument();
      expect(review.getByText("Asha Rao")).toBeInTheDocument();
      expect(screen.getByTestId("mr-review-pickup-address")).toHaveTextContent(
        "12 MG Road, Flat 4B, Bengaluru, Karnataka, 560001",
      );

      const lines = screen.getAllByTestId("mr-review-line");

      expect(lines).toHaveLength(2);
      expect(lines[0]).toHaveTextContent("Linen Shirt");
      expect(lines[0]).toHaveTextContent("Qty 2");
      expect(lines[0]).toHaveTextContent(/₹\s?2,398\.00/);
      expect(lines[1]).toHaveTextContent("Denim Jacket");
      expect(lines[1]).toHaveTextContent("Qty 1");
      expect(lines[1]).toHaveTextContent(/₹\s?3,299\.00/);

      const total = screen.getByTestId("mr-review-total");

      expect(total).toHaveTextContent("Estimated refund (final amount set after QC)");
      expect(total).toHaveTextContent(/₹\s?5,697\.00/);
      expect(review.getByText("Damaged product")).toBeInTheDocument();
      expect(review.getByText(NOTE)).toBeInTheDocument();
      expect(
        review.getByText("Return window exceeded, Product not returnable"),
      ).toBeInTheDocument();
      expect(review.getByText("COD")).toBeInTheDocument();
      expect(review.getByText("asha@example.com")).toBeInTheDocument();
      expect(review.getByText("asha@okaxis")).toBeInTheDocument();
    });

    it("FE-NEW11 Back from any step preserves entered data", async () => {
      // Arrange
      await goToReview({
        lookup: codLookup,
        items: [{ name: "Denim Jacket" }],
        reason: "Damaged product",
        note: NOTE,
      });

      // Act / Assert — review → contact
      back();
      await screen.findByTestId("mr-step-contact");
      expect(screen.getByLabelText("Refund email")).toHaveValue("asha@example.com");
      expect(screen.getByLabelText("UPI ID")).toHaveValue("asha@okaxis");

      // contact → reason
      back();
      await screen.findByTestId("mr-step-reason");
      expect(screen.getByLabelText("Override note (required)")).toHaveValue(NOTE);
      expect(
        within(screen.getByTestId("mr-reason-select")).getByText("Damaged product"),
      ).toBeInTheDocument();

      // reason → items
      back();
      await screen.findByTestId("mr-step-items");
      expect(within(rowFor("Denim Jacket")).getByRole("checkbox")).toBeChecked();

      // items → lookup
      back();
      await screen.findByTestId("mr-step-lookup");
      expect(screen.getByLabelText("Order number")).toHaveValue("1001");

      // and forward again without re-entering anything
      fireEvent.click(screen.getByTestId("mr-lookup-button"));
      await screen.findByTestId("mr-step-items");
      expect(within(rowFor("Denim Jacket")).getByRole("checkbox")).toBeChecked();
      next();
      await screen.findByTestId("mr-step-reason");
      expect(screen.getByLabelText("Override note (required)")).toHaveValue(NOTE);
      next();
      await screen.findByTestId("mr-step-contact");
      expect(screen.getByLabelText("UPI ID")).toHaveValue("asha@okaxis");
      next();

      const review = await screen.findByTestId("mr-step-review");

      expect(review).toHaveTextContent(NOTE);
    });
  });

  describe("Submit", () => {
    it("FE-NEW12 success shows a confirmation with links to the created MR", async () => {
      // Arrange
      await goToReview({ items: [{ name: "Linen Shirt", quantity: 1 }] });
      createMock.mockResolvedValue(successResult);

      // Act
      fireEvent.click(screen.getByTestId("mr-submit"));

      // Assert
      await screen.findByTestId("mr-step-confirmation");
      expect(createMock).toHaveBeenCalledTimes(1);

      const payload = createMock.mock.calls[0][0];

      expect(payload).toEqual({
        order_number: "1001",
        idempotency_key: expect.any(String),
        reason_id: 1,
        lines: [{ fulfillment_line_id: "FL1", quantity: 1 }],
      });
      expect(payload.idempotency_key.length).toBeGreaterThan(0);
      expect(payload).not.toHaveProperty("refund_email");
      expect(payload).not.toHaveProperty("refund_upi");
      expect(payload).not.toHaveProperty("override_note");

      const rows = screen.getAllByTestId("mr-confirmation-row");

      expect(rows).toHaveLength(1);

      // Act
      fireEvent.click(within(rows[0]).getByRole("link", { name: "MR-0042" }));

      // Assert
      expect(mockNavigate).toHaveBeenCalledWith("/returns-exchange/manual-returns/MR-0042");
    });

    it("FE-NEW12 sends the override note and COD refund contact", async () => {
      // Arrange
      await goToReview({
        lookup: codLookup,
        items: [{ name: "Denim Jacket" }],
        reason: "Damaged product",
        note: `  ${NOTE}  `,
      });
      createMock.mockResolvedValue(successResult);

      // Act
      fireEvent.click(screen.getByTestId("mr-submit"));

      // Assert
      await screen.findByTestId("mr-step-confirmation");
      expect(createMock.mock.calls[0][0]).toEqual({
        order_number: "1001",
        idempotency_key: expect.any(String),
        reason_id: 2,
        override_note: NOTE,
        refund_email: "asha@example.com",
        refund_upi: "asha@okaxis",
        lines: [{ fulfillment_line_id: "FL2", quantity: 1 }],
      });
    });

    it("FE-NEW12 207 lists every shipment result with finalizing and failure notes", async () => {
      // Arrange
      await goToReview();
      createMock.mockResolvedValue({
        status: 207,
        ok: false,
        results: [
          { originalFulfillmentId: "F1", ok: true, mrId: "MR-0042", creationStatus: "INCOMPLETE" },
          {
            originalFulfillmentId: "F4",
            ok: false,
            code: "SALEOR_ERROR",
            message: "Saleor rejected the return",
          },
        ],
      } satisfies CreateManualReturnResult);

      // Act
      fireEvent.click(screen.getByTestId("mr-submit"));

      // Assert
      await screen.findByTestId("mr-step-confirmation");

      const rows = screen.getAllByTestId("mr-confirmation-row");

      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByRole("link", { name: "MR-0042" })).toBeInTheDocument();
      expect(rows[0]).toHaveTextContent("Finalizing");
      expect(rows[1]).toHaveTextContent("Saleor rejected the return");
      expect(within(rows[1]).queryByRole("link")).not.toBeInTheDocument();

      // Act
      fireEvent.click(screen.getByRole("button", { name: "Back to Manual Returns" }));

      // Assert
      expect(mockNavigate).toHaveBeenCalledWith("/returns-exchange/manual-returns");

      // Act
      fireEvent.click(screen.getByRole("button", { name: "Create another" }));

      // Assert
      await screen.findByTestId("mr-step-lookup");
      expect(screen.getByLabelText("Order number")).toHaveValue("");
    });

    it.each(["NOT_ELIGIBLE", "CONCURRENT_SUBMISSION"])(
      "FE-NEW13 409 %s shows the conflict and returns to items with refreshed eligibility",
      async code => {
        // Arrange
        const refreshed = makeLookupResult({
          shipments: [
            {
              ...deliveredShipment,
              items: [
                makeLookupItem({ eligibleQuantity: 1, claimedQuantity: 1 }),
                denimJacketItem,
                cottonTeeItem,
              ],
            },
            inTransitShipment,
            returnedShipment,
          ],
        });

        await goToReview({ items: [{ name: "Linen Shirt", quantity: 2 }] });
        lookupMock.mockResolvedValue(refreshed);
        createMock.mockRejectedValue(
          createManualReturnApiError({
            message: "Linen Shirt: only 1 unit is still eligible",
            status: 409,
            code,
          }),
        );

        // Act
        fireEvent.click(screen.getByTestId("mr-submit"));

        // Assert
        await screen.findByTestId("mr-step-items");

        const conflict = screen.getByTestId("mr-conflict-message");

        expect(conflict).toHaveAttribute("role", "alert");
        expect(conflict).toHaveTextContent("Linen Shirt: only 1 unit is still eligible");
        expect(lookupMock).toHaveBeenCalledTimes(2);
        expect(lookupMock).toHaveBeenLastCalledWith("1001");
        expect(rowFor("Linen Shirt")).toHaveTextContent("1 of 1 eligible");
        expect(qtyOf("Linen Shirt")).toHaveTextContent("1");

        // Act
        next();

        // Assert
        await screen.findByTestId("mr-step-reason");
        expect(
          within(screen.getByTestId("mr-reason-select")).getByText("Size issue"),
        ).toBeInTheDocument();
      },
    );

    it.each([
      ["network error", new TypeError("Failed to fetch"), "Failed to fetch"],
      [
        "502",
        createManualReturnApiError({
          message: "Saleor unavailable",
          status: 502,
          code: "SALEOR_ERROR",
        }),
        "Saleor unavailable",
      ],
    ])(
      "FE-NEW14 %s shows Retry that resubmits with the same idempotency key and inputs",
      async (_label, error, message) => {
        // Arrange
        await goToReview({ items: [{ name: "Linen Shirt", quantity: 2 }] });
        createMock.mockRejectedValueOnce(error).mockResolvedValueOnce(successResult);

        // Act
        fireEvent.click(screen.getByTestId("mr-submit"));

        // Assert
        const banner = await screen.findByTestId("mr-submit-error");

        expect(banner).toHaveAttribute("role", "alert");
        expect(banner).toHaveTextContent(message);
        expect(screen.getByTestId("mr-step-review")).toHaveTextContent("Linen Shirt");
        expect(screen.getByTestId("mr-step-review")).toHaveTextContent("Size issue");

        // Act
        fireEvent.click(within(banner).getByRole("button", { name: "Retry" }));

        // Assert
        await screen.findByTestId("mr-step-confirmation");
        expect(createMock).toHaveBeenCalledTimes(2);
        expect(createMock.mock.calls[1][0]).toEqual(createMock.mock.calls[0][0]);
      },
    );

    it("FE-NEW14 keeps the idempotency key across Back/Next and replaces it after a success", async () => {
      // Arrange
      await goToReview();
      createMock
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(successResult);

      // Act — fail, go back and forward, submit again
      fireEvent.click(screen.getByTestId("mr-submit"));
      await screen.findByTestId("mr-submit-error");
      back();
      await screen.findByTestId("mr-step-reason");
      next();
      await screen.findByTestId("mr-step-review");
      fireEvent.click(screen.getByTestId("mr-submit"));
      await screen.findByTestId("mr-step-confirmation");

      // Act — start a new return
      fireEvent.click(screen.getByRole("button", { name: "Create another" }));
      await screen.findByTestId("mr-step-lookup");
      await lookUp();
      toggleItem("Linen Shirt");
      next();
      await screen.findByTestId("mr-step-reason");
      await chooseReason("Size issue");
      next();
      await screen.findByTestId("mr-step-review");
      fireEvent.click(screen.getByTestId("mr-submit"));
      await screen.findByTestId("mr-step-confirmation");

      // Assert
      const keys = createMock.mock.calls.map(call => call[0].idempotency_key);

      expect(keys[1]).toBe(keys[0]);
      expect(keys[2]).not.toBe(keys[0]);
    });

    it("FE-NEW15 disables submit while submitting to prevent double submission", async () => {
      // Arrange
      await goToReview();

      let resolveCreate: (value: CreateManualReturnResult) => void = () => undefined;

      createMock.mockReturnValue(
        new Promise<CreateManualReturnResult>(resolve => {
          resolveCreate = resolve;
        }),
      );

      // Act
      const submit = screen.getByTestId("mr-submit");

      fireEvent.click(submit);
      fireEvent.click(submit);
      fireEvent.click(submit);

      // Assert
      expect(submit).toBeDisabled();
      expect(submit).toHaveTextContent("Submitting…");
      expect(screen.getByTestId("mr-back")).toBeDisabled();
      expect(createMock).toHaveBeenCalledTimes(1);

      // Act
      await act(async () => {
        resolveCreate(successResult);
      });

      // Assert
      await waitFor(() => expect(screen.getByTestId("mr-step-confirmation")).toBeInTheDocument());
    });
  });

  describe("FE-NEW16 accessibility", () => {
    it("renders reason and note errors in an aria-live region linked to their controls", async () => {
      // Arrange
      lookupMock.mockResolvedValue(prepaidLookup);
      renderView();
      await lookUp();
      toggleItem("Denim Jacket");
      next();
      await screen.findByTestId("mr-step-reason");

      // Act
      next();

      // Assert
      expectLinkedError(
        within(screen.getByTestId("mr-reason-select")).getByRole("combobox"),
        "Select a return reason",
      );
      expectLinkedError(
        screen.getByLabelText("Override note (required)"),
        "Override note must be at least 15 characters",
      );
    });

    it("links refund contact errors to the email and UPI inputs", async () => {
      // Arrange
      lookupMock.mockResolvedValue(codLookup);
      renderView();
      await lookUp();
      toggleItem("Linen Shirt");
      next();
      await screen.findByTestId("mr-step-reason");
      await chooseReason("Size issue");
      next();
      await screen.findByTestId("mr-step-contact");

      // Act
      next();

      // Assert
      expectLinkedError(screen.getByLabelText("Refund email"), "Enter the refund email");
      expectLinkedError(screen.getByLabelText("UPI ID"), "Enter the UPI ID");
    });
  });
});
