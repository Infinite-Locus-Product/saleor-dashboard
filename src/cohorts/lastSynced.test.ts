// TTXY-6196 — "Last synced" shown in IST, "Never synced" when empty, and a
// failed/partial sync is never shown as if it had succeeded.
import { describeLastSync, formatIstDateTime } from "./lastSynced";
import { type Cohort } from "./types";

type SyncFields = Pick<Cohort, "last_synced_at" | "last_sync_status" | "last_sync_attempt_at">;

const fields = (over: Partial<SyncFields> = {}): SyncFields => ({
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  ...over,
});

describe("formatIstDateTime", () => {
  it("renders date and time in IST whatever the browser timezone is", () => {
    // Arrange
    const utc = "2026-10-22T05:30:00Z";

    // Act
    const text = formatIstDateTime(utc);

    // Assert — 05:30 UTC is 11:00 IST
    expect(text).toContain("22 Oct 2026");
    expect(text).toMatch(/11:00/);
    expect(text).toMatch(/IST$/);
  });
});

describe("describeLastSync", () => {
  it("U1 — never synced when there is no success and no attempt", () => {
    // Arrange / Act / Assert
    expect(describeLastSync(fields())).toEqual({ kind: "never" });
  });

  it("U2 — a successful sync shows its time", () => {
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
    // Act
    const view = describeLastSync(fields({ last_synced_at: "2026-10-01T00:00:00Z" }));

    // Assert
    expect(view.kind).toBe("success");
  });

  it.each(["failed", "partial"] as const)(
    "U3 — a %s latest attempt is shown as such, with the last success kept separate",
    status => {
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
