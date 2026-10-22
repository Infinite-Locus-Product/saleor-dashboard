// TTXY-4699 PR #5 C3 — backend/network failures are shown as translated copy,
// never as raw server text; server text survives only as secondary detail.
import { ApiError } from "./api/apiError";
import { type CohortAction, describeCohortError } from "./errors";
import { cohortMessages } from "./messages";

describe("describeCohortError", () => {
  it("sync 409 says the cohort must be active and not past its end date", () => {
    // Arrange
    const error = new ApiError({ status: 409, serverMessage: "Cohort 7 is inactive" });

    // Act
    const view = describeCohortError("sync", error);

    // Assert
    expect(view.message).toBe(cohortMessages.syncNotAllowed);
    expect(view.detail).toBeNull();
  });

  it("delete 409 is the generic 'used by coupons' message (the dialog lists them)", () => {
    // Arrange
    const error = new ApiError({
      status: 409,
      serverMessage: "Cohort is used by 2 coupon(s): FLAT100, NEW50",
    });

    // Act
    const view = describeCohortError("delete", error);

    // Assert
    expect(view.message).toBe(cohortMessages.deleteUsedByCoupons);
    expect(view.detail).toBeNull();
  });

  it("delete 502 says some members could not be untagged and nothing was deleted", () => {
    // Arrange
    const error = new ApiError({ status: 502, serverMessage: "Shopify tag removal failed" });

    // Act
    const view = describeCohortError("delete", error);

    // Assert
    expect(view.message).toBe(cohortMessages.deleteUntagFailed);
    expect(view.detail).toBeNull();
  });

  it.each<CohortAction>(["sync", "delete", "load", "coupons", "upload"])(
    "status 0 on %s is the network error message",
    action => {
      // Arrange
      const error = new ApiError({ status: 0, serverMessage: null });

      // Act
      const view = describeCohortError(action, error);

      // Assert
      expect(view.message).toBe(cohortMessages.networkError);
      expect(view.detail).toBeNull();
    },
  );

  it.each<[CohortAction, keyof typeof cohortMessages]>([
    ["list", "loadError"],
    ["load", "loadCohortError"],
    ["create", "createError"],
    ["update", "updateError"],
    ["upload", "csvError"],
    ["sync", "syncError"],
    ["coupons", "deleteCouponsError"],
    ["delete", "deleteError"],
  ])("any other %s failure falls back to %s with the server text as detail", (action, key) => {
    // Arrange
    const error = new ApiError({ status: 500, serverMessage: "boom" });

    // Act
    const view = describeCohortError(action, error);

    // Assert
    expect(view.message).toBe(cohortMessages[key]);
    expect(view.detail).toBe("boom");
  });

  it("sync 409 is not treated as a delete conflict (mapping is per action)", () => {
    // Arrange
    const error = new ApiError({ status: 502, serverMessage: "upstream" });

    // Act
    const view = describeCohortError("sync", error);

    // Assert
    expect(view.message).toBe(cohortMessages.syncError);
    expect(view.detail).toBe("upstream");
  });

  it("a non-API error falls back to the generic message with its text as detail", () => {
    // Arrange
    const error = new Error("VITE_TENEXU_API_URL is not set");

    // Act
    const view = describeCohortError("load", error);

    // Assert
    expect(view.message).toBe(cohortMessages.loadCohortError);
    expect(view.detail).toBe("VITE_TENEXU_API_URL is not set");
  });

  it("a thrown non-Error value falls back with no detail", () => {
    // Arrange
    const error = "weird";

    // Act
    const view = describeCohortError("update", error);

    // Assert
    expect(view.message).toBe(cohortMessages.updateError);
    expect(view.detail).toBeNull();
  });

  // PR #5 C16 — the menu only checks MANAGE_DISCOUNTS; the backend also needs
  // the cohort permission group (403) and COHORT_COUPONS_ENABLED (404).
  it.each<CohortAction>(["list", "load", "create", "update", "sync", "delete"])(
    "C16 — 403 on %s says the user lacks cohort access",
    action => {
      // Arrange
      const error = new ApiError({ status: 403, serverMessage: "Forbidden" });

      // Act
      const view = describeCohortError(action, error);

      // Assert
      expect(view.message).toBe(cohortMessages.noCohortAccess);
      expect(view.detail).toBeNull();
    },
  );

  it("C16 — 404 on the list says cohorts are not enabled on this environment", () => {
    // Arrange
    const error = new ApiError({ status: 404, serverMessage: "Not found" });

    // Act
    const view = describeCohortError("list", error);

    // Assert
    expect(view.message).toBe(cohortMessages.cohortsNotEnabled);
    expect(view.detail).toBeNull();
  });

  it("C16 — 404 on a single cohort load says the cohort was not found", () => {
    // Arrange
    const error = new ApiError({ status: 404, serverMessage: "Cohort 7 not found" });

    // Act
    const view = describeCohortError("load", error);

    // Assert
    expect(view.message).toBe(cohortMessages.notFound);
    expect(view.detail).toBeNull();
  });
});
