import { fireEvent, render, screen, within } from "@testing-library/react";

import { RejectReturnDialog } from "./RejectReturnDialog";

const NO_CALLS_WARNING = "No calls have been logged with this customer.";
const AGREED_WARNING = "The customer agreed to an exchange on the last call.";
const HELPER_TEXT =
  "This is final and can't be undone. The customer will see 'Return rejected' and can't raise a return or exchange on this item.";

type Props = React.ComponentProps<typeof RejectReturnDialog>;

const renderDialog = (overrides: Partial<Props> = {}) => {
  const props: Props = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    submitting: false,
    callCount: 2,
    lastUserAction: null,
    ...overrides,
  } as Props;

  render(<RejectReturnDialog {...props} />);

  return props;
};

const reasonInput = () => screen.getByTestId("reject-reason-input");
const counter = () => screen.getByTestId("reject-reason-counter");
const confirmButton = () =>
  within(screen.getByRole("dialog")).getByRole("button", { name: "Reject Return" });
const typeReason = (value: string) => fireEvent.change(reasonInput(), { target: { value } });

describe("RejectReturnDialog (TTXY-6032)", () => {
  it("J11 renders the labelled reason field, 0/500 counter, helper text and a disabled confirm", () => {
    // Act
    renderDialog();

    // Assert
    expect(screen.getByText("Reason for rejection (internal)")).toBeInTheDocument();
    expect(reasonInput().tagName).toBe("TEXTAREA");
    expect(counter()).toHaveTextContent("0/500");
    expect(screen.getByText(HELPER_TEXT)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("J11 confirm stays disabled at 9 trimmed chars and enables at 10", () => {
    // Arrange
    renderDialog();

    // Act
    typeReason("123456789");

    // Assert
    expect(counter()).toHaveTextContent("9/500");
    expect(confirmButton()).toBeDisabled();

    // Act
    typeReason("1234567890");

    // Assert
    expect(counter()).toHaveTextContent("10/500");
    expect(confirmButton()).toBeEnabled();
  });

  it("J11 whitespace does not count toward the minimum (trimmed length)", () => {
    renderDialog();

    typeReason("    123456789     ");
    expect(confirmButton()).toBeDisabled();

    typeReason("          ");
    expect(confirmButton()).toBeDisabled();
  });

  it("J11 500 chars is accepted, 501 is not", () => {
    renderDialog();

    typeReason("x".repeat(500));
    expect(counter()).toHaveTextContent("500/500");
    expect(confirmButton()).toBeEnabled();

    typeReason("x".repeat(501));
    expect(confirmButton()).toBeDisabled();
  });

  it("J11 confirm is disabled while submitting even with a valid reason", () => {
    renderDialog({ submitting: true });

    typeReason("Customer used the product; tags removed");

    expect(confirmButton()).toBeDisabled();
  });

  it("J11 confirm passes the trimmed reason to onConfirm", () => {
    // Arrange
    const props = renderDialog();

    // Act
    typeReason("  Customer used the product; tags removed  ");
    fireEvent.click(confirmButton());

    // Assert
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).toHaveBeenCalledWith("Customer used the product; tags removed");
  });

  it("J11 Back closes the dialog without confirming", () => {
    const props = renderDialog();

    fireEvent.click(within(screen.getByRole("dialog")).getByTestId("back"));

    expect(props.onClose).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("J12 shows the no-calls warning when callCount is 0", () => {
    renderDialog({ callCount: 0 });

    expect(screen.getByText(NO_CALLS_WARNING)).toBeInTheDocument();
  });

  it("J12 hides the no-calls warning when calls were logged", () => {
    renderDialog({ callCount: 1 });

    expect(screen.queryByText(NO_CALLS_WARNING)).not.toBeInTheDocument();
  });

  it('J13 shows the agreed-to-exchange warning when lastUserAction is "Agreed to exchange"', () => {
    renderDialog({ callCount: 1, lastUserAction: "Agreed to exchange" });

    expect(screen.getByText(AGREED_WARNING)).toBeInTheDocument();
    expect(screen.queryByText(NO_CALLS_WARNING)).not.toBeInTheDocument();
  });

  it("J13 hides the agreed-to-exchange warning for other user actions", () => {
    renderDialog({ callCount: 3, lastUserAction: "Disagreed to exchange" });

    expect(screen.queryByText(AGREED_WARNING)).not.toBeInTheDocument();
  });

  it("C2 shows a 'Minimum 10 characters' hint linked to the textarea, not invalid before typing", () => {
    // Act
    renderDialog();

    // Assert
    const hint = screen.getByTestId("reject-reason-hint");

    expect(hint).toHaveTextContent("Minimum 10 characters");
    expect(hint.id).toBeTruthy();
    expect(reasonInput().getAttribute("aria-describedby")?.split(" ")).toContain(hint.id);
    expect(reasonInput()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("C2 1–9 typed chars mark the field invalid and keep the minimum hint", () => {
    renderDialog();

    typeReason("damaged");

    expect(reasonInput()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("reject-reason-hint")).toHaveTextContent("Minimum 10 characters");
  });

  it("C2 a valid reason clears aria-invalid", () => {
    renderDialog();

    typeReason("damaged");
    typeReason("1234567890");

    expect(reasonInput()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("C2 more than 500 chars marks the field invalid and says so", () => {
    renderDialog();

    typeReason("x".repeat(501));

    expect(reasonInput()).toHaveAttribute("aria-invalid", "true");
    expect(counter()).toHaveTextContent("501/500");
    expect(screen.getByTestId("reject-reason-hint")).toHaveTextContent("Maximum 500 characters");
  });

  it("J11 renders nothing when closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByTestId("reject-reason-input")).not.toBeInTheDocument();
  });
});
