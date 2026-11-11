// TTXY-4841 — per-cohort restriction rows on the voucher page (L6, L7, L8; LLD §4.3).
import { type VoucherCohortRestrictionEntry } from "@dashboard/cohorts/types";

import {
  type CohortRestrictionRow,
  DEFAULT_HOLDOUT_PCT,
  DEFAULT_REPEAT_WINDOW_DAYS,
  fromRestrictionEntries,
  hasRowErrors,
  newRow,
  toIstDateTimeInput,
  toRestrictionInputs,
  validateRows,
} from "./model";

const voucherWindow = {
  start: "2026-11-10T00:00:00+05:30",
  end: "2026-11-30T23:59:00+05:30",
};

const row = (over: Partial<CohortRestrictionRow> = {}): CohortRestrictionRow => ({
  ...newRow(12, "Jaipur repeaters"),
  ...over,
});

describe("voucher cohort restriction model", () => {
  it("L6 — a newly picked cohort gets holdout 10 %, repeat window 30 days and no template", () => {
    // Arrange / Act
    const picked = newRow(5, "VIP");

    // Assert
    expect(picked).toEqual({
      cohortId: 5,
      cohortName: "VIP",
      start: "",
      end: "",
      templateEvent: "",
      storedTemplateEvent: null,
      holdoutPct: String(DEFAULT_HOLDOUT_PCT),
      repeatWindowDays: String(DEFAULT_REPEAT_WINDOW_DAYS),
    });
    expect(DEFAULT_HOLDOUT_PCT).toBe(10);
    expect(DEFAULT_REPEAT_WINDOW_DAYS).toBe(30);
  });

  it("L6 — stored entries load with their window shown in IST", () => {
    // Arrange
    const entries: VoucherCohortRestrictionEntry[] = [
      {
        cohort_id: 3,
        cohort_name: "Lapsed",
        start_time: "2026-11-12T04:30:00Z",
        end_time: null,
        template_event: "cohort_coupon_wa",
        holdout_pct: 20,
        repeat_window_days: 45,
      },
    ];

    // Act
    const [loaded] = fromRestrictionEntries(entries);

    // Assert
    expect(loaded).toEqual({
      cohortId: 3,
      cohortName: "Lapsed",
      start: "2026-11-12T10:00",
      end: "",
      templateEvent: "cohort_coupon_wa",
      storedTemplateEvent: "cohort_coupon_wa",
      holdoutPct: "20",
      repeatWindowDays: "45",
    });
    expect(toIstDateTimeInput("not a date")).toBe("");
  });

  it("L8 — rows convert to the POST shape with an explicit IST offset; a blank new template is left out", () => {
    // Arrange
    const rows = [
      row({ start: "2026-11-12T10:00", templateEvent: "  cohort_coupon_wa " }),
      row({ cohortId: 13, cohortName: "Lapsed", holdoutPct: "0", repeatWindowDays: "365" }),
    ];

    // Act
    const inputs = toRestrictionInputs(rows);

    // Assert
    expect(inputs).toEqual([
      {
        cohort_id: 12,
        cohort_name: "Jaipur repeaters",
        start_time: "2026-11-12T10:00+05:30",
        end_time: null,
        template_event: "cohort_coupon_wa",
        holdout_pct: 10,
        repeat_window_days: 30,
      },
      {
        cohort_id: 13,
        cohort_name: "Lapsed",
        start_time: null,
        end_time: null,
        holdout_pct: 0,
        repeat_window_days: 365,
      },
    ]);
  });

  it("L7 — a window inside the voucher dates is valid; blanks mean 'the voucher's dates'", () => {
    // Arrange
    const rows = [row({ start: "2026-11-12T10:00", end: "2026-11-20T18:00" }), row()];

    // Act
    const errors = validateRows(rows, voucherWindow);

    // Assert
    expect(hasRowErrors(errors)).toBe(false);
  });

  it("L7 — a start before the voucher start is blocked", () => {
    // Arrange / Act
    const errors = validateRows([row({ start: "2026-11-09T23:00" })], voucherWindow);

    // Assert
    expect(errors[12]?.start).toBe("outside_voucher");
    expect(hasRowErrors(errors)).toBe(true);
  });

  it("L7 — an end after the voucher end, or a start after it, is blocked", () => {
    // Arrange / Act
    const lateEnd = validateRows([row({ end: "2026-12-01T00:00" })], voucherWindow);
    const lateStart = validateRows([row({ start: "2026-12-02T00:00" })], voucherWindow);

    // Assert
    expect(lateEnd[12]?.end).toBe("outside_voucher");
    expect(lateStart[12]?.start).toBe("outside_voucher");
  });

  it("L7 — an end at or before the start is blocked", () => {
    // Arrange / Act
    const errors = validateRows(
      [row({ start: "2026-11-15T10:00", end: "2026-11-15T10:00" })],
      voucherWindow,
    );

    // Assert
    expect(errors[12]?.end).toBe("end_before_start");
  });

  it("L7 — a voucher without an end date leaves the cohort end open", () => {
    // Arrange / Act
    const errors = validateRows([row({ end: "2027-06-01T00:00" })], {
      start: voucherWindow.start,
      end: null,
    });

    // Assert
    expect(hasRowErrors(errors)).toBe(false);
  });

  it("L6 — template, holdout and repeat window are range-checked", () => {
    // Arrange
    const rows = [
      row({ cohortId: 1, templateEvent: "Bad-Template" }),
      row({ cohortId: 2, holdoutPct: "51" }),
      row({ cohortId: 3, holdoutPct: "4.5" }),
      row({ cohortId: 4, repeatWindowDays: "0" }),
      row({ cohortId: 5, repeatWindowDays: "366" }),
      row({ cohortId: 6, templateEvent: "x".repeat(65) }),
    ];

    // Act
    const errors = validateRows(rows, voucherWindow);

    // Assert
    expect(errors[1]?.templateEvent).toBe("invalid_template");
    expect(errors[2]?.holdoutPct).toBe("invalid_holdout");
    expect(errors[3]?.holdoutPct).toBe("invalid_holdout");
    expect(errors[4]?.repeatWindowDays).toBe("invalid_repeat");
    expect(errors[5]?.repeatWindowDays).toBe("invalid_repeat");
    expect(errors[6]?.templateEvent).toBe("invalid_template");
  });

  it("C1 — a stored null template loads blank and an unchanged one is left out of the POST", () => {
    // Arrange
    const entries: VoucherCohortRestrictionEntry[] = [
      {
        cohort_id: 3,
        cohort_name: "Lapsed",
        start_time: null,
        end_time: null,
        template_event: null,
        holdout_pct: 10,
        repeat_window_days: 30,
      },
      {
        cohort_id: 4,
        cohort_name: "VIP",
        start_time: null,
        end_time: null,
        template_event: "vip_offer",
        holdout_pct: 10,
        repeat_window_days: 30,
      },
    ];

    // Act
    const loaded = fromRestrictionEntries(entries);
    const inputs = toRestrictionInputs([loaded[0], { ...loaded[1], templateEvent: " vip_offer " }]);

    // Assert — missing key = the backend keeps the stored value (null follows the default)
    expect(loaded[0].templateEvent).toBe("");
    expect(loaded[0].storedTemplateEvent).toBeNull();
    expect(inputs[0]).not.toHaveProperty("template_event");
    expect(inputs[1]).not.toHaveProperty("template_event");
  });

  it("C1 — a changed template is sent trimmed; clearing a stored one sends null", () => {
    // Arrange
    const rows = [
      row({ cohortId: 1, storedTemplateEvent: null, templateEvent: " new_event " }),
      row({ cohortId: 2, storedTemplateEvent: "old_event", templateEvent: "other_event" }),
      row({ cohortId: 3, storedTemplateEvent: "old_event", templateEvent: "  " }),
    ];

    // Act
    const inputs = toRestrictionInputs(rows);

    // Assert
    expect(inputs[0].template_event).toBe("new_event");
    expect(inputs[1].template_event).toBe("other_event");
    expect(inputs[2]).toHaveProperty("template_event", null);
  });
});
