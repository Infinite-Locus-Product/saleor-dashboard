// TTXY-4841 — "Restrict to cohort(s)" card on the voucher page (L6, L7, L8).
// The REST client is mocked; the macaw multiselect is stubbed (it needs a real
// layout engine) but keeps its contract: search callback, options, picks.
import { ApiError } from "@dashboard/cohorts/api/apiError";
import {
  fetchCohorts,
  fetchVoucherRestriction,
  saveVoucherRestriction,
} from "@dashboard/cohorts/api/cohortsApi";
import { type Cohort, type VoucherCohortRestriction } from "@dashboard/cohorts/types";
import Wrapper from "@test/wrapper";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { type VoucherWindow } from "./model";
import { useVoucherCohortRestriction } from "./useVoucherCohortRestriction";
import { VoucherCohortRestrictionCard } from "./VoucherCohortRestrictionCard";

jest.mock("@dashboard/cohorts/api/cohortsApi", () => ({
  fetchCohorts: jest.fn(),
  fetchVoucherRestriction: jest.fn(),
  saveVoucherRestriction: jest.fn(),
}));

jest.mock("@dashboard/components/Combobox", () => ({
  Multiselect: Object.assign(
    ({
      options,
      onChange,
      value,
      fetchOptions,
      allowCustomValues,
    }: {
      options: Array<{ value: string; label: string }>;
      onChange: (event: { target: { value: unknown; name: string } }) => void;
      value: Array<{ value: string; label: string }>;
      fetchOptions: (query: string) => void;
      allowCustomValues?: boolean;
    }) => (
      <div data-test-id="cohort-picker" data-allow-custom={String(!!allowCustomValues)}>
        <input
          aria-label="search cohorts"
          data-test-id="cohort-picker-search"
          onChange={event => fetchOptions(event.target.value)}
        />
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ target: { value: [...value, option], name: "" } })}
          >
            {`pick ${option.label}`}
          </button>
        ))}
        {value.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              onChange({
                target: { value: value.filter(v => v.value !== option.value), name: "" },
              })
            }
          >
            {`unpick ${option.label}`}
          </button>
        ))}
      </div>
    ),
    { NoOptions: () => null },
  ),
}));

const fetchCohortsMock = fetchCohorts as jest.MockedFunction<typeof fetchCohorts>;
const fetchRestrictionMock = fetchVoucherRestriction as jest.MockedFunction<
  typeof fetchVoucherRestriction
>;
const saveRestrictionMock = saveVoucherRestriction as jest.MockedFunction<
  typeof saveVoucherRestriction
>;

const VOUCHER_ID = "Vm91Y2hlcjox";

const voucherWindow: VoucherWindow = {
  start: "2026-11-10T00:00:00+05:30",
  end: "2026-11-30T23:59:00+05:30",
};

const restriction: VoucherCohortRestriction = {
  voucherId: VOUCHER_ID,
  voucherCode: "FLAT100",
  startDate: voucherWindow.start,
  endDate: voucherWindow.end,
  default_template_event: "cohort_coupon_default",
  cohorts: [
    {
      cohort_id: 3,
      cohort_name: "Lapsed",
      start_time: null,
      end_time: null,
      template_event: "cohort_coupon_wa",
      holdout_pct: 20,
      repeat_window_days: 45,
    },
  ],
};

const cohort = (id: number, name: string): Cohort => ({
  id,
  cohort_code: `C${id}`,
  cohort_name: name,
  description: null,
  type: "static",
  status: true,
  created_date: "2026-11-01T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 10,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
});

let saveOutcome: boolean | null = null;

/** Mirrors VoucherDetails: validate on Save, then save the restriction. */
const Harness = () => {
  const controller = useVoucherCohortRestriction(VOUCHER_ID);

  return (
    <>
      <VoucherCohortRestrictionCard controller={controller} voucherWindow={voucherWindow} />
      <button
        type="button"
        data-test-id="harness-save"
        onClick={async () => {
          if (!controller.validate(voucherWindow)) {
            saveOutcome = false;

            return;
          }

          saveOutcome = await controller.save({
            voucherCode: null,
            voucherStart: voucherWindow.start,
            voucherEnd: voucherWindow.end,
          });
        }}
      >
        save
      </button>
    </>
  );
};

const renderCard = async () => {
  render(
    <Wrapper>
      <Harness />
    </Wrapper>,
  );
  await screen.findByTestId("voucher-cohort-card");
};

const rows = () => screen.queryAllByTestId("voucher-cohort-row");
const rowInput = (row: HTMLElement, testId: string) =>
  within(row).getByTestId(testId) as HTMLInputElement;

describe("VoucherCohortRestrictionCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    saveOutcome = null;
    fetchRestrictionMock.mockResolvedValue(restriction);
    fetchCohortsMock.mockResolvedValue({
      items: [cohort(3, "Lapsed"), cohort(8, "Jaipur repeaters")],
      limit: 20,
      offset: 0,
      total: 2,
    });
    saveRestrictionMock.mockResolvedValue({ voucherId: VOUCHER_ID, restricted: true });
  });

  it("L6 — loads the voucher's cohorts with their window, template, holdout and repeat window", async () => {
    // Arrange / Act
    await renderCard();

    // Assert
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(fetchRestrictionMock).toHaveBeenCalledWith(VOUCHER_ID);
    expect(rowInput(rows()[0], "voucher-cohort-template").value).toBe("cohort_coupon_wa");
    expect(rowInput(rows()[0], "voucher-cohort-holdout").value).toBe("20");
    expect(rowInput(rows()[0], "voucher-cohort-repeat").value).toBe("45");
    expect(rowInput(rows()[0], "voucher-cohort-start")).toHaveAttribute("type", "datetime-local");
    expect(rowInput(rows()[0], "voucher-cohort-end")).toHaveAttribute("type", "datetime-local");
  });

  it("L6 — cohorts are searched on GET /cohorts and picked from results only (no free text)", async () => {
    // Arrange
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    fireEvent.change(screen.getByTestId("cohort-picker-search"), { target: { value: "jai" } });

    // Assert
    await waitFor(() =>
      expect(fetchCohortsMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: "jai", status: true }),
      ),
    );
    expect(screen.getByTestId("cohort-picker")).toHaveAttribute("data-allow-custom", "false");

    // Act — pick one; it gets the defaults
    fireEvent.click(await screen.findByText("pick Jaipur repeaters"));

    // Assert
    expect(rows()).toHaveLength(2);
    expect(rowInput(rows()[1], "voucher-cohort-holdout").value).toBe("10");
    expect(rowInput(rows()[1], "voucher-cohort-repeat").value).toBe("30");
    expect(rowInput(rows()[1], "voucher-cohort-template").value).toBe("");
  });

  it("L7 — a per-cohort window outside the voucher dates is blocked with a message", async () => {
    // Arrange
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    fireEvent.change(rowInput(rows()[0], "voucher-cohort-start"), {
      target: { value: "2026-11-01T10:00" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(within(rows()[0]).getByTestId("voucher-cohort-start-error")).toHaveTextContent(
      "inside the voucher's dates",
    );
    expect(saveOutcome).toBe(false);
    expect(saveRestrictionMock).not.toHaveBeenCalled();
  });

  it("L6 — holdout outside 0–50 is blocked", async () => {
    // Arrange
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    fireEvent.change(rowInput(rows()[0], "voucher-cohort-holdout"), { target: { value: "60" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(within(rows()[0]).getByTestId("voucher-cohort-holdout-error")).toBeInTheDocument();
    expect(saveRestrictionMock).not.toHaveBeenCalled();
  });

  it("L8 — removing a cohort removes it on save (the POST carries the remaining list)", async () => {
    // Arrange
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    fireEvent.click(within(rows()[0]).getByTestId("voucher-cohort-remove"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(rows()).toHaveLength(0);
    expect(saveRestrictionMock).toHaveBeenCalledWith({
      voucherId: VOUCHER_ID,
      voucherCode: "FLAT100",
      voucherStart: voucherWindow.start,
      voucherEnd: voucherWindow.end,
      cohorts: [],
    });
    expect(saveOutcome).toBe(true);
  });

  it("L8 — unpicking in the multiselect also removes the cohort", async () => {
    // Arrange
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    fireEvent.click(screen.getByText("unpick Lapsed"));

    // Assert
    expect(rows()).toHaveLength(0);
  });

  it("L8 — nothing is sent when the card was not changed", async () => {
    // Arrange
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(saveRestrictionMock).not.toHaveBeenCalled();
    expect(saveOutcome).toBe(true);
  });

  it("L6 — a failed restriction save is shown on the card", async () => {
    // Arrange
    saveRestrictionMock.mockRejectedValue(
      new ApiError({ status: 400, serverMessage: "window outside voucher", code: null }),
    );
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.change(rowInput(rows()[0], "voucher-cohort-holdout"), { target: { value: "15" } });

    // Act
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(await screen.findByTestId("voucher-cohort-save-error")).toHaveTextContent(
      "window outside voucher",
    );
    expect(saveOutcome).toBe(false);
  });

  it.each([
    ["cohorts disabled (404)", new ApiError({ status: 404, serverMessage: null })],
    ["no cohort access (403)", new ApiError({ status: 403, serverMessage: null })],
    ["backend URL not configured", new Error("VITE_TENEXU_API_URL is not set")],
  ])("L6 — %s: the card says so and never blocks or posts", async (_label, failure) => {
    // Arrange
    fetchRestrictionMock.mockRejectedValue(failure);
    await renderCard();

    // Act
    await screen.findByTestId("voucher-cohort-unavailable");
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(screen.queryByTestId("cohort-picker")).not.toBeInTheDocument();
    expect(saveOutcome).toBe(true);
    expect(saveRestrictionMock).not.toHaveBeenCalled();
  });

  it("C1 — the default template is the placeholder; an untouched stored null is not pinned on save", async () => {
    // Arrange
    fetchRestrictionMock.mockResolvedValue({
      ...restriction,
      cohorts: [{ ...restriction.cohorts[0], template_event: null }],
    });
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    const template = rowInput(rows()[0], "voucher-cohort-template");

    // Assert — blank value, the default is the placeholder and the helper names it
    expect(template.value).toBe("");
    expect(template).toHaveAttribute("placeholder", "cohort_coupon_default");
    expect(within(rows()[0]).getByText(/blank uses the default \(/)).toBeInTheDocument();

    // Act — change another field only, then save
    fireEvent.change(rowInput(rows()[0], "voucher-cohort-holdout"), { target: { value: "15" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert — template_event is left out, so the backend keeps following the default
    const [[body]] = saveRestrictionMock.mock.calls;

    expect(body.cohorts[0]).not.toHaveProperty("template_event");
    expect(body.cohorts[0].holdout_pct).toBe(15);
  });

  it("C1 — clearing a stored template sends null; editing one sends the trimmed value", async () => {
    // Arrange
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    fireEvent.change(rowInput(rows()[0], "voucher-cohort-template"), { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(saveRestrictionMock.mock.calls[0][0].cohorts[0]).toHaveProperty("template_event", null);
  });

  it("C3 — an unchanged card with a stored window outside the current voucher dates blocks the save", async () => {
    // Arrange — stored start is before the voucher's (shortened) start
    fetchRestrictionMock.mockResolvedValue({
      ...restriction,
      cohorts: [{ ...restriction.cohorts[0], start_time: "2026-11-01T04:30:00Z" }],
    });
    await renderCard();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // Act
    await act(async () => {
      fireEvent.click(screen.getByTestId("harness-save"));
    });

    // Assert
    expect(within(rows()[0]).getByTestId("voucher-cohort-start-error")).toBeInTheDocument();
    expect(saveOutcome).toBe(false);
    expect(saveRestrictionMock).not.toHaveBeenCalled();
  });
});
