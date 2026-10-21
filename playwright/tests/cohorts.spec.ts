import { CohortsPage } from "@pages/cohortsPage";
import { expect, type Page, type Route } from "@playwright/test";
import { test } from "utils/testWithPermission";

// The Cohorts section is behind MANAGE_DISCOUNTS and is served by the
// TenexuBackend REST API (VITE_TENEXU_API_URL). These specs assert the
// client-rendered shell + client-side validation, which do not depend on live
// cohort data — so they stay deterministic even without seeded cohorts.
test.use({ permissionName: "admin" });

let cohortsPage: CohortsPage;

test.beforeEach(({ page }) => {
  cohortsPage = new CohortsPage(page);
});

test("Cohorts list page renders with a create action #e2e", async () => {
  // Act
  await cohortsPage.gotoListPage();

  // Assert — the page shell is present regardless of how many cohorts exist.
  await expect(cohortsPage.createCohortButton).toBeVisible();
  await expect(cohortsPage.searchInput).toBeVisible();
});

test("Create cohort form gates the save button until a name is entered #e2e", async () => {
  // Arrange
  await cohortsPage.gotoListPage();
  await cohortsPage.createCohortButton.click();
  await cohortsPage.nameInput.waitFor({ state: "visible" });

  // Assert — empty name keeps save disabled (client-side guard, no backend call).
  await expect(cohortsPage.saveButton).toBeDisabled();

  // Act
  await cohortsPage.nameInput.fill("Playwright VIP cohort");

  // Assert
  await expect(cohortsPage.saveButton).toBeEnabled();
});

// --- Detail-page specs (TTXY-4699 PR #5 C5) ---------------------------------
// These need a specific cohort state (inactive / used by a coupon). Rather than
// depend on seeded TenexuBackend data, the cohort REST calls are stubbed with
// page.route; the Saleor dashboard itself (auth, routing, layout) stays real.

const STUB_COHORT_ID = 987654;

const stubCohort = (over: Record<string, unknown> = {}) => ({
  id: STUB_COHORT_ID,
  cohort_code: "PW-STUB",
  cohort_name: "Playwright stub cohort",
  description: null,
  type: "static",
  status: true,
  created_date: "2026-10-01T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 12,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
  ...over,
});

const fulfillJson = (route: Route, data: unknown) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    },
    body: JSON.stringify({ success: true, data, error: "" }),
  });

/** Stub GET /cohorts/:id and GET /cohorts/:id/coupons on the TenexuBackend API only. */
const stubCohortApi = async (
  page: Page,
  { cohort, coupons = [] }: { cohort: ReturnType<typeof stubCohort>; coupons?: unknown[] },
) => {
  await page.route(
    url => url.pathname.endsWith(`/cohorts/${STUB_COHORT_ID}`) && !url.pathname.includes("/list/"),
    route =>
      ["fetch", "xhr"].includes(route.request().resourceType())
        ? fulfillJson(route, cohort)
        : route.fallback(),
  );
  await page.route(
    url => url.pathname.endsWith(`/cohorts/${STUB_COHORT_ID}/coupons`),
    route => fulfillJson(route, { coupons }),
  );
};

test("Sync now is visible and disabled for an inactive cohort #e2e", async ({ page }) => {
  // Arrange
  await stubCohortApi(page, { cohort: stubCohort({ status: false }) });

  // Act
  await cohortsPage.gotoDetailsPage(STUB_COHORT_ID);

  // Assert
  await expect(cohortsPage.syncNowButton).toBeVisible();
  await expect(cohortsPage.syncNowButton).toBeDisabled();
  await expect(cohortsPage.syncBlockedHelp).toBeVisible();
});

test("Delete dialog lists linked coupons and disables Confirm #e2e", async ({ page }) => {
  // Arrange
  await stubCohortApi(page, {
    cohort: stubCohort(),
    coupons: [
      { voucherId: "V1", voucherCode: "PWFLAT100", startTime: null, endTime: null },
      { voucherId: "V2", voucherCode: "PWNEW50", startTime: null, endTime: null },
    ],
  });
  await cohortsPage.gotoDetailsPage(STUB_COHORT_ID);

  // Act
  await cohortsPage.deleteButton.click();

  // Assert
  await expect(cohortsPage.deleteBlocked).toBeVisible();
  await expect(cohortsPage.deleteDialog).toContainText("PWFLAT100");
  await expect(cohortsPage.deleteDialog).toContainText("PWNEW50");
  await expect(cohortsPage.deleteConfirmButton).toBeDisabled();
});
