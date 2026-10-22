// TTXY-6196 — "Last synced" shown in IST, "Never synced" when empty, and a
// failed/partial sync is never shown as if it had succeeded.
import { type IntlShape } from "react-intl";

import { describeLastSync, formatIstDateTime, toIstDateInput } from "./lastSynced";
import { cohortMessages } from "./messages";
import { type Cohort } from "./types";

type SyncFields = Pick<Cohort, "last_synced_at" | "last_sync_status" | "last_sync_attempt_at">;

const fields = (over: Partial<SyncFields> = {}): SyncFields => ({
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  ...over,
});

// jest maps "react-intl" to __mocks__/react-intl.ts (formatDate is an identity
// there); these tests need the real formatter, which the mapper does not catch
// when the package entry file is named explicitly.
const { createIntl } = jest.requireActual<typeof import("react-intl")>("react-intl/index.js");

const realIntl = (locale = "en-IN") => createIntl({ locale, defaultLocale: locale });

describe("formatIstDateTime", () => {
  it("renders date and time in IST whatever the browser timezone is", () => {
    // Arrange
    const utc = "2026-10-22T05:30:00Z";

    // Act
    const text = formatIstDateTime(realIntl(), utc);

    // Assert — 05:30 UTC is 11:00 IST
    expect(text).toContain("22 Oct 2026");
    expect(text).toMatch(/11:00/);
    expect(text).toMatch(/IST$/);
  });

  it("C12 — follows the dashboard locale through react-intl, still in IST", () => {
    // Arrange
    const utc = "2026-10-22T05:30:00Z";

    // Act
    const text = formatIstDateTime(realIntl("en"), utc);

    // Assert — en formatting, IST wall-clock time
    expect(text).toContain("Oct 22, 2026");
    expect(text).toMatch(/11:00/);
    expect(text).toMatch(/IST$/);
  });

  it("C12 — formats through intl.formatDate with the Asia/Kolkata timezone and the IST message", () => {
    // Arrange
    const formatDate = jest.fn(() => "FORMATTED");
    const formatMessage = jest.fn(() => "MESSAGE");
    const intl: Pick<IntlShape, "formatDate" | "formatMessage"> = { formatDate, formatMessage };

    // Act
    const text = formatIstDateTime(intl, "2026-10-22T05:30:00Z");

    // Assert
    expect(formatDate).toHaveBeenCalledWith(new Date("2026-10-22T05:30:00Z"), {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
    expect(formatMessage).toHaveBeenCalledWith(cohortMessages.istDateTime, {
      dateTime: "FORMATTED",
    });
    expect(text).toBe("MESSAGE");
  });

  it("C7b — does not throw on an invalid date string and shows the raw value", () => {
    // Arrange
    const garbage = "not-a-date";

    // Act
    const text = formatIstDateTime(realIntl(), garbage);

    // Assert
    expect(text).toBe("not-a-date");
  });

  it("C7b — shows a dash for an empty string", () => {
    // Arrange
    const empty = "";

    // Act
    const text = formatIstDateTime(realIntl(), empty);

    // Assert
    expect(text).toBe("—");
  });
});

describe("describeLastSync", () => {
  it("U1 — never synced when there is no success and no attempt", () => {
    // Arrange / Act / Assert
    expect(describeLastSync(fields())).toEqual({ kind: "never" });
  });

  it("U2 — a successful sync shows its time", () => {
    // Arrange — fields are built inline
    // Act
    const view = describeLastSync(
      fields({
        last_synced_at: "2026-10-22T05:30:00Z",
        last_sync_status: "success",
        last_sync_attempt_at: "2026-10-22T05:30:00Z",
      }),
    );

    // Assert
    expect(view).toEqual({ kind: "success", at: "2026-10-22T05:30:00Z" });
  });

  it("treats a pre-fix cohort (no status column yet) with last_synced_at as success", () => {
    // Arrange — fields are built inline
    // Act
    const view = describeLastSync(fields({ last_synced_at: "2026-10-01T00:00:00Z" }));

    // Assert
    expect(view.kind).toBe("success");
  });

  it.each(["failed", "partial"] as const)(
    "U3 — a %s latest attempt is shown as such, with the last success kept separate",
    status => {
      // Arrange — fields are built inline
      // Act
      const view = describeLastSync(
        fields({
          last_synced_at: "2026-10-21T05:30:00Z",
          last_sync_status: status,
          last_sync_attempt_at: "2026-10-22T05:30:00Z",
        }),
      );

      // Assert
      expect(view).toEqual({
        kind: status,
        attemptAt: "2026-10-22T05:30:00Z",
        lastSuccessAt: "2026-10-21T05:30:00Z",
      });
    },
  );

  it("U3b — a failed first attempt has no last success", () => {
    // Arrange — fields are built inline
    // Act
    const view = describeLastSync(
      fields({ last_sync_status: "failed", last_sync_attempt_at: "2026-10-22T05:30:00Z" }),
    );

    // Assert
    expect(view).toEqual({
      kind: "failed",
      attemptAt: "2026-10-22T05:30:00Z",
      lastSuccessAt: null,
    });
  });
});

// PR #5 C17 — the end-date picker shows the stored instant as its IST calendar day.
describe("toIstDateInput", () => {
  it("returns the IST calendar day as YYYY-MM-DD (jest runs in UTC)", () => {
    // Arrange — 20:00 UTC on Dec 31 is 01:30 IST on Jan 1
    const utc = "2026-12-31T20:00:00Z";

    // Act
    const value = toIstDateInput(utc);

    // Assert
    expect(value).toBe("2027-01-01");
  });

  it("keeps an end-of-IST-day value on that day", () => {
    // Arrange — what the backend stores for a picked 2026-12-31
    const stored = "2026-12-31T18:29:59.999Z";

    // Act / Assert
    expect(toIstDateInput(stored)).toBe("2026-12-31");
  });

  it.each([null, "", "not-a-date"])("returns an empty string for %p", value => {
    // Arrange / Act / Assert
    expect(toIstDateInput(value)).toBe("");
  });
});
