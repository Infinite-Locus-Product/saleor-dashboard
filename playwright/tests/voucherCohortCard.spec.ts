/**
 * TTXY-4841 L6–L8, L12 — "Restrict to cohort(s)" card on the voucher details
 * page. The voucher itself is a seeded e2e voucher on the real Saleor test
 * instance (as in vouchers.spec.ts); the TenexuBackend restriction and cohort
 * search are stubbed with page.route.
 */
import { VOUCHERS } from "@data/e2eTestData";
import { VouchersPage } from "@pages/vouchersPage";
import { expect, type Page } from "@playwright/test";
import { AXE_MISSING_REASON, loadAxeBuilder, seriousViolations } from "utils/axe";
import { fulfillJson, stubTenexu, TENEXU_API_URL_MISSING_REASON } from "utils/tenexuStubs";
import { test } from "utils/testWithPermission";

test.use({ permissionName: "admin" });
test.skip(!process.env.VITE_TENEXU_API_URL, TENEXU_API_URL_MISSING_REASON);

const VOUCHER = VOUCHERS.vouchers.voucherToBeEditedUsageLimits;

const cohortListItem = (id: number, name: string) => ({
  id,
  cohort_code: `PW${id}`,
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

const stubRestriction = (page: Page, cohorts: unknown[]) =>
  stubTenexu(page, [
    [
      "GET",
      /\/cohorts\/voucher-restriction\/.+$/,
      route =>
        fulfillJson(route, {
          voucherId: decodeURIComponent(VOUCHER.id),
          voucherCode: "PWVOUCHER",
          startDate: null,
          endDate: null,
          cohorts,
        }),
    ],
    [
      "POST",
      /\/cohorts\/voucher-restriction$/,
      (route, request) =>
        fulfillJson(route, {
          voucherId: request.postDataJSON().voucherId,
          restricted: request.postDataJSON().cohorts.length > 0,
        }),
    ],
    [
      "GET",
      /\/cohorts$/,
      route =>
        fulfillJson(route, {
          items: [cohortListItem(3, "PW Lapsed buyers"), cohortListItem(8, "PW Jaipur repeaters")],
          limit: 20,
          offset: 0,
          total: 2,
        }),
    ],
  ]);

const LAPSED = {
  cohort_id: 3,
  cohort_name: "PW Lapsed buyers",
  start_time: null,
  end_time: null,
  template_event: "cohort_coupon_wa",
  holdout_pct: 20,
  repeat_window_days: 45,
};

let vouchersPage: VouchersPage;

test.beforeEach(({ page }) => {
  vouchersPage = new VouchersPage(page);
});

const card = (page: Page) => page.getByTestId("voucher-cohort-card");
const rows = (page: Page) => page.getByTestId("voucher-cohort-row");

test("TC: TTXY-4841 L6 card lists the voucher's cohorts with window, template, holdout and repeat window #e2e", async ({
  page,
}) => {
  // Arrange
  await stubRestriction(page, [LAPSED]);

  // Act
  await vouchersPage.gotoExistingVoucherPage(VOUCHER.id);

  // Assert
  await expect(card(page)).toBeVisible({ timeout: 30000 });
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).getByTestId("voucher-cohort-template")).toHaveValue("cohort_coupon_wa");
  await expect(rows(page).getByTestId("voucher-cohort-holdout")).toHaveValue("20");
  await expect(rows(page).getByTestId("voucher-cohort-repeat")).toHaveValue("45");
  await expect(rows(page).getByTestId("voucher-cohort-start")).toHaveAttribute(
    "type",
    "datetime-local",
  );
});

test("TC: TTXY-4841 L6 cohorts are picked from GET /cohorts search results (no free text) #e2e", async ({
  page,
}) => {
  // Arrange
  const api = await stubRestriction(page, []);

  await vouchersPage.gotoExistingVoucherPage(VOUCHER.id);
  await expect(card(page)).toBeVisible({ timeout: 30000 });

  // Act
  const picker = card(page).getByTestId("voucher-cohort-picker");

  await picker.click();
  await page.keyboard.type("Jaipur");
  await page.getByRole("option", { name: "PW Jaipur repeaters" }).click();

  // Assert
  await expect.poll(() => api.find("GET", /\/cohorts$/).length).toBeGreaterThan(0);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).getByTestId("voucher-cohort-holdout")).toHaveValue("10");
  await expect(rows(page).getByTestId("voucher-cohort-repeat")).toHaveValue("30");

  // Act — free text that matches no cohort offers nothing to add
  await picker.click();
  await page.keyboard.type("not-a-cohort-xyz");

  // Assert
  await expect(page.getByRole("option", { name: "not-a-cohort-xyz" })).toHaveCount(0);
});

test("TC: TTXY-4841 L7 a cohort window outside the voucher dates blocks the save #e2e", async ({
  page,
}) => {
  // Arrange
  const api = await stubRestriction(page, [LAPSED]);

  await vouchersPage.gotoExistingVoucherPage(VOUCHER.id);
  await expect(rows(page)).toHaveCount(1, { timeout: 30000 });

  // Act — a start years before any seeded voucher's start date
  await rows(page).getByTestId("voucher-cohort-start").fill("2000-01-01T10:00");
  await vouchersPage.saveButton.click();

  // Assert
  await expect(rows(page).getByTestId("voucher-cohort-start-error")).toContainText(
    "inside the voucher's dates",
  );
  expect(api.find("POST", "/cohorts/voucher-restriction")).toHaveLength(0);
});

test("TC: TTXY-4841 L8 removing a cohort removes it on save #e2e", async ({ page }) => {
  // Arrange
  const api = await stubRestriction(page, [LAPSED]);

  await vouchersPage.gotoExistingVoucherPage(VOUCHER.id);
  await expect(rows(page)).toHaveCount(1, { timeout: 30000 });

  // Act
  await rows(page).getByTestId("voucher-cohort-remove").click();
  await vouchersPage.saveButton.click();

  // Assert
  await expect.poll(() => api.find("POST", "/cohorts/voucher-restriction").length).toBe(1);

  const [post] = api.find("POST", "/cohorts/voucher-restriction");

  expect(post.body).toMatchObject({ voucherCode: "PWVOUCHER", cohorts: [] });
  expect(post.headers.authorization).toMatch(/^Bearer /);
});

test("TC: TTXY-4841 L12 the voucher cohort card has no serious axe violations #e2e", async ({
  page,
}) => {
  const AxeBuilder = await loadAxeBuilder();

  test.skip(!AxeBuilder, AXE_MISSING_REASON);

  // Arrange
  await stubRestriction(page, [LAPSED]);
  await vouchersPage.gotoExistingVoucherPage(VOUCHER.id);
  await expect(rows(page)).toHaveCount(1, { timeout: 30000 });

  // Act
  const violations = await seriousViolations(
    AxeBuilder!,
    page,
    '[data-test-id="voucher-cohort-card"]',
  );

  // Assert
  expect(violations).toEqual([]);
});
