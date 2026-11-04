import "@testing-library/jest-dom/extend-expect";

import { ThemeProvider } from "@saleor/macaw-ui-next";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type PropsWithChildren } from "react";
import { IntlProvider } from "react-intl";

import GiftCardUpdateBalanceDialog from "./GiftCardUpdateBalanceDialog";

/** What the balance update resolves with: no data when the request itself failed. */
interface UpdateResult {
  data?: {
    giftCardUpdate: {
      errors: Array<{ field: string; code: string; message: string | null }>;
    };
  };
}

/** What adding the reason note resolves with: no data when the request itself failed. */
interface NoteResult {
  data?: {
    giftCardAddNote: {
      errors: Array<{ field: string; code: string; message: string | null }>;
    };
  };
}

const mockUpdateBalance = jest.fn();
const mockAddNote = jest.fn();
const mockNotify = jest.fn();
const reasonNotSaved = "Balance updated, but the reason note was not saved. Add it in History.";

jest.mock("@dashboard/graphql", () => ({
  ...jest.requireActual<object>("@dashboard/graphql"),
  useGiftCardUpdateMutation: jest.fn(() => [
    mockUpdateBalance,
    { loading: false, status: "default" },
  ]),
  useGiftCardAddNoteMutation: jest.fn(() => [mockAddNote]),
}));

jest.mock("@dashboard/hooks/useNotifier", () => ({
  useNotifier: jest.fn(() => mockNotify),
}));

jest.mock("@dashboard/giftCards/hooks/useGiftCardPermissions", () => ({
  useGiftCardPermissions: jest.fn(() => ({ canSeeCreatedBy: false })),
}));

jest.mock("../providers/GiftCardDetailsProvider/hooks/useGiftCardDetails", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    giftCard: { id: "gift-card-1", currentBalance: { amount: 100, currency: "INR" } },
  })),
}));

const TestWrapper = ({ children }: PropsWithChildren<{}>): JSX.Element => (
  <IntlProvider defaultLocale="en" locale="en">
    <ThemeProvider>{children}</ThemeProvider>
  </IntlProvider>
);

/** Let the submit finish: the update resolves, then the note is (or is not) added. */
const finishSubmit = (): Promise<void> =>
  act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));

const setBalanceWithReason = async (reason: string): Promise<void> => {
  render(
    <TestWrapper>
      <GiftCardUpdateBalanceDialog open onClose={jest.fn()} />
    </TestWrapper>,
  );
  fireEvent.change(screen.getByLabelText("Reason (saved in the history)"), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByTestId("submit"));
  await waitFor(() => expect(mockUpdateBalance).toHaveBeenCalledTimes(1));
  await finishSubmit();
};

describe("GiftCardUpdateBalanceDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not save the reason when the update request fails", async () => {
    // Arrange: a failed request resolves with no data
    const failedRequest: UpdateResult = { data: undefined };

    mockUpdateBalance.mockResolvedValue(failedRequest);

    // Act
    await setBalanceWithReason("Damaged");

    // Assert
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it("does not save the reason when Saleor returns errors", async () => {
    // Arrange
    const refused: UpdateResult = {
      data: {
        giftCardUpdate: {
          errors: [{ field: "currentBalanceAmount", code: "INVALID", message: null }],
        },
      },
    };

    mockUpdateBalance.mockResolvedValue(refused);

    // Act
    await setBalanceWithReason("Damaged");

    // Assert
    expect(mockAddNote).not.toHaveBeenCalled();
  });

  it("saves the reason once when the balance is updated", async () => {
    // Arrange
    const updated: UpdateResult = { data: { giftCardUpdate: { errors: [] } } };
    const noteSaved: NoteResult = { data: { giftCardAddNote: { errors: [] } } };

    mockUpdateBalance.mockResolvedValue(updated);
    mockAddNote.mockResolvedValue(noteSaved);

    // Act
    await setBalanceWithReason("Damaged");

    // Assert
    expect(mockAddNote).toHaveBeenCalledTimes(1);
    expect(mockAddNote).toHaveBeenCalledWith({
      variables: {
        id: "gift-card-1",
        input: { message: "Balance adjusted to 100 INR. Reason: Damaged" },
      },
    });
    expect(mockNotify).not.toHaveBeenCalledWith(expect.objectContaining({ text: reasonNotSaved }));
  });

  it("tells staff to add the reason by hand when the note fails after the update", async () => {
    // Arrange: the balance is updated, then the note request fails
    const updated: UpdateResult = { data: { giftCardUpdate: { errors: [] } } };
    const noteFailed: NoteResult = { data: undefined };

    mockUpdateBalance.mockResolvedValue(updated);
    mockAddNote.mockResolvedValue(noteFailed);

    // Act
    await setBalanceWithReason("Damaged");

    // Assert
    expect(mockNotify).toHaveBeenCalledWith({ status: "warning", text: reasonNotSaved });
  });
});
