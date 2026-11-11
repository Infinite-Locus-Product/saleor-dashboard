// TTXY-4841 — the cohort restriction is saved alongside the voucher save, and
// never breaks it (L6, L8).
import { type VoucherCohortRestrictionController } from "@dashboard/discounts/components/VoucherCohortRestrictionCard/useVoucherCohortRestriction";

import {
  COHORT_RESTRICTION_NOT_SAVED,
  createCohortRestrictionSubmitHandler,
  isVoucherSaveDisabled,
  voucherWindowFromForm,
} from "./cohortRestrictionSubmit";

const formData = {
  startDate: "2026-11-10",
  startTime: "00:00",
  endDate: "2026-11-30",
  endTime: "23:59",
  hasEndDate: true,
};

const controller = (
  over: Partial<VoucherCohortRestrictionController> = {},
): VoucherCohortRestrictionController =>
  ({
    status: "ready",
    dirty: true,
    save: jest.fn().mockResolvedValue(true),
    validate: jest.fn().mockReturnValue(true),
    ...over,
  }) as unknown as VoucherCohortRestrictionController;

describe("createCohortRestrictionSubmitHandler", () => {
  it("L8 — after a clean voucher save, a changed restriction is saved with the form's dates", async () => {
    // Arrange
    const restriction = controller();
    const submit = jest.fn().mockResolvedValue([]);
    const handler = createCohortRestrictionSubmitHandler(submit, restriction);

    // Act
    const errors = await handler(formData as never);

    // Assert
    expect(errors).toEqual([]);
    expect(submit).toHaveBeenCalledWith(formData);
    expect(restriction.save).toHaveBeenCalledWith(voucherWindowFromForm(formData as never));
  });

  it("L6 — voucher errors skip the restriction save and are returned unchanged", async () => {
    // Arrange
    const restriction = controller();
    const voucherErrors = [{ code: "INVALID", field: "name" }];
    const handler = createCohortRestrictionSubmitHandler(
      jest.fn().mockResolvedValue(voucherErrors),
      restriction,
    );

    // Act
    const errors = await handler(formData as never);

    // Assert
    expect(errors).toBe(voucherErrors);
    expect(restriction.save).not.toHaveBeenCalled();
  });

  it("L6 — an unchanged or unavailable card is never saved", async () => {
    // Arrange
    const unchanged = controller({ dirty: false });
    const unavailable = controller({ status: "unavailable" });

    // Act
    await createCohortRestrictionSubmitHandler(
      jest.fn().mockResolvedValue([]),
      unchanged,
    )(formData as never);
    await createCohortRestrictionSubmitHandler(
      jest.fn().mockResolvedValue([]),
      unavailable,
    )(formData as never);

    // Assert
    expect(unchanged.save).not.toHaveBeenCalled();
    expect(unavailable.save).not.toHaveBeenCalled();
  });

  it("C2 — a failed restriction save after a clean voucher save keeps the form dirty", async () => {
    // Arrange
    const notSaved = jest.fn();
    const restriction = controller({ save: jest.fn().mockResolvedValue(false) });
    const handler = createCohortRestrictionSubmitHandler(
      jest.fn().mockResolvedValue([]),
      restriction,
      notSaved,
    );

    // Act
    const errors = await handler(formData as never);

    // Assert — a non-empty result keeps the unsaved-changes guard on; the voucher
    // itself saved, so the only entry is the restriction marker.
    expect(errors).toEqual([COHORT_RESTRICTION_NOT_SAVED]);
    expect(notSaved).toHaveBeenCalledTimes(1);
  });

  it("C2 — a successful restriction save returns no errors (the form is marked clean)", async () => {
    // Arrange
    const handler = createCohortRestrictionSubmitHandler(
      jest.fn().mockResolvedValue([]),
      controller(),
    );

    // Act / Assert
    await expect(handler(formData as never)).resolves.toEqual([]);
  });

  it("L7 — the voucher window comes from the form; no end date means an open end", () => {
    // Arrange / Act
    const window = voucherWindowFromForm({ ...formData, hasEndDate: false } as never);

    // Assert
    expect(window.voucherStart).toMatch(/^2026-11-10T00:00:00/);
    expect(window.voucherEnd).toBeNull();
  });

  it("C5 — Save is disabled while the restriction POST is running", () => {
    // Arrange / Act / Assert
    expect(isVoucherSaveDisabled(false, controller({ saving: true }))).toBe(true);
    expect(isVoucherSaveDisabled(false, controller({ saving: false }))).toBe(false);
    expect(isVoucherSaveDisabled(true, controller({ saving: false }))).toBe(true);
    expect(isVoucherSaveDisabled(false, undefined)).toBe(false);
  });
});
