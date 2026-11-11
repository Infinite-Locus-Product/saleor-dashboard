// TTXY-4841 — useVoucherCohortRestriction save guards, at hook level (PR #19 C11).
import { fetchVoucherRestriction, saveVoucherRestriction } from "@dashboard/cohorts/api/cohortsApi";
import { type VoucherCohortRestriction } from "@dashboard/cohorts/types";
import { act, renderHook } from "@testing-library/react-hooks";

import { newRow } from "./model";
import { useVoucherCohortRestriction } from "./useVoucherCohortRestriction";

jest.mock("@dashboard/cohorts/api/cohortsApi", () => ({
  fetchVoucherRestriction: jest.fn(),
  saveVoucherRestriction: jest.fn(),
}));

const fetchRestrictionMock = fetchVoucherRestriction as jest.MockedFunction<
  typeof fetchVoucherRestriction
>;
const saveRestrictionMock = saveVoucherRestriction as jest.MockedFunction<
  typeof saveVoucherRestriction
>;

const VOUCHER_ID = "Vm91Y2hlcjox";

const unreadableRestriction: VoucherCohortRestriction = {
  voucherId: VOUCHER_ID,
  voucherCode: "FLAT100",
  startDate: "2026-11-10T00:00:00+05:30",
  endDate: "2026-11-30T23:59:00+05:30",
  default_template_event: null,
  cohorts: [],
  unreadable: true,
};

const saveInput = { voucherCode: null, voucherStart: null, voucherEnd: null };

const renderLoaded = async (): Promise<{
  result: { current: ReturnType<typeof useVoucherCohortRestriction> };
}> => {
  const hook = renderHook(() => useVoucherCohortRestriction(VOUCHER_ID));

  await hook.waitFor(() => hook.result.current.status === "ready");

  return hook;
};

describe("useVoucherCohortRestriction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchRestrictionMock.mockResolvedValue(unreadableRestriction);
    saveRestrictionMock.mockResolvedValue({ voucherId: VOUCHER_ID, restricted: true });
  });

  it("C11 — an unreadable restriction is not saved after setRows() until the overwrite is confirmed", async () => {
    // Arrange
    const { result } = await renderLoaded();

    expect(result.current.unreadable).toBe(true);

    // Act
    act(() => {
      result.current.setRows([newRow(8, "Jaipur repeaters")]);
    });

    let outcome: boolean | undefined;

    await act(async () => {
      outcome = await result.current.save(saveInput);
    });

    // Assert — dirty, but nothing is sent and the voucher save is not blocked
    expect(result.current.dirty).toBe(true);
    expect(outcome).toBe(true);
    expect(saveRestrictionMock).not.toHaveBeenCalled();
  });

  it("C11 — once the overwrite is confirmed the same save is sent", async () => {
    // Arrange
    const { result } = await renderLoaded();

    act(() => {
      result.current.setRows([newRow(8, "Jaipur repeaters")]);
      result.current.confirmOverwrite();
    });

    // Act
    await act(async () => {
      await result.current.save(saveInput);
    });

    // Assert
    expect(saveRestrictionMock).toHaveBeenCalledTimes(1);
    expect(saveRestrictionMock.mock.calls[0][0].cohorts).toEqual([
      expect.objectContaining({ cohort_id: 8 }),
    ]);
    expect(result.current.unreadable).toBe(false);
  });

  it("C12 — an edit made after Save was clicked (while the voucher saves) is the one sent", async () => {
    // Arrange: a readable, empty restriction
    fetchRestrictionMock.mockResolvedValue({ ...unreadableRestriction, unreadable: false });

    const { result } = await renderLoaded();

    act(() => {
      result.current.setRows([newRow(8, "Jaipur repeaters")]);
    });

    // The submit handler keeps the controller from the click, then awaits voucherUpdate…
    const clickedController = result.current;

    // …while the user edits the card again.
    act(() => {
      result.current.setRows([newRow(8, "Jaipur repeaters"), newRow(9, "Delhi VIP")]);
    });

    // Act
    await act(async () => {
      await clickedController.save(saveInput);
    });

    // Assert
    expect(saveRestrictionMock).toHaveBeenCalledTimes(1);
    expect(saveRestrictionMock.mock.calls[0][0].cohorts.map(c => c.cohort_id)).toEqual([8, 9]);
  });
});
