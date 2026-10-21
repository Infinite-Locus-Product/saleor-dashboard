// TTXY-6199 — the delete dialog shows the coupons that use the cohort and
// blocks the delete; an unused cohort gets a plain confirmation.
import Wrapper from "@test/wrapper";
import { render, screen } from "@testing-library/react";

import { cohortMessages } from "../messages";
import { type CohortLinkedCoupon } from "../types";
import { CohortDeleteDialog, type CohortDeleteDialogProps } from "./CohortDeleteDialog";

const baseProps: CohortDeleteDialogProps = {
  open: true,
  cohortName: "include821",
  memberCount: 12,
  coupons: [],
  lookupError: null,
  deleteError: null,
  deleting: false,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
};

const renderDialog = (over: Partial<CohortDeleteDialogProps> = {}) =>
  render(
    <Wrapper>
      <CohortDeleteDialog {...baseProps} {...over} />
    </Wrapper>,
  );

// ActionDialog's confirm button.
const confirmButton = () => screen.getByTestId("submit");

describe("CohortDeleteDialog", () => {
  it("U6 — lists the linked coupons by code and disables Confirm", () => {
    // Arrange
    const coupons: CohortLinkedCoupon[] = [
      { voucherId: "V1", voucherCode: "FLAT100", startTime: null, endTime: null },
      { voucherId: "V2", voucherCode: null, startTime: null, endTime: null },
    ];

    // Act
    renderDialog({ coupons });

    // Assert
    expect(screen.getByTestId("cohort-delete-blocked")).toBeInTheDocument();
    expect(screen.getByText("FLAT100")).toBeInTheDocument();
    expect(screen.getByText("V2")).toBeInTheDocument(); // falls back to the id
    expect(confirmButton()).toBeDisabled();
    expect(screen.queryByTestId("cohort-delete-confirm-text")).not.toBeInTheDocument();
  });

  it("U7 — an unused cohort gets a plain confirmation with Confirm enabled", () => {
    // Act
    renderDialog({ coupons: [] });

    // Assert
    // react-intl is mocked repo-wide (formatMessage returns the template), so
    // assert which message is shown; interpolation is react-intl's job.
    const text = screen.getByTestId("cohort-delete-confirm-text").textContent ?? "";

    expect(text).toBe(cohortMessages.deleteConfirm.defaultMessage);
    expect(text).not.toMatch(/coupon/i);
    expect(confirmButton()).toBeEnabled();
  });

  it("U8 — a failed coupon lookup shows the error and keeps Confirm disabled", () => {
    // Act
    renderDialog({ coupons: null, lookupError: "Network down" });

    // Assert
    expect(screen.getByText("Network down")).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("keeps Confirm disabled while the coupon lookup is still loading", () => {
    // Act
    renderDialog({ coupons: null });

    // Assert
    expect(screen.getByTestId("cohort-delete-loading")).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("shows the backend delete error", () => {
    // Act
    renderDialog({ deleteError: "Cohort is used by 1 coupon(s): FLAT100" });

    // Assert
    expect(screen.getByTestId("cohort-delete-error")).toHaveTextContent("FLAT100");
  });
});
