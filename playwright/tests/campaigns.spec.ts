/**
 * TTXY-4841 L9–L12 — Campaigns section: list, funnel (messaged vs holdout,
 * "Not tracked" stages), CSV export, MANAGE_DISCOUNTS gating and axe.
 * TenexuBackend campaign routes are stubbed with page.route.
 */
import { URL_LIST } from "@data/url";
import { expect, type Page, test as baseTest } from "@playwright/test";
import { AXE_MISSING_REASON, loadAxeBuilder, seriousViolations } from "utils/axe";
import {
  fulfillCsv,
  fulfillJson,
  stubTenexu,
  TENEXU_API_URL_MISSING_REASON,
} from "utils/tenexuStubs";
import { test } from "utils/testWithPermission";

const CAMPAIGN = {
  id: 31,
  voucher_code: "PWLAPSED20",
  cohort_id: 3,
  cohort_name: "PW Lapsed buyers",
  start_time: "2026-11-10T04:30:00Z",
  end_time: "2026-11-20T18:29:00Z",
  status: "open",
  blocked_reason: null,
  recipients: 1000,
  sent: 880,
  holdout: 100,
};

const FUNNEL = {
  campaign: CAMPAIGN,
  groups: {
    messaged: {
      size: 900,
      stages: {
        tagged: 900,
        sent: 880,
        delivered: null,
        clicked: 120,
        added_to_cart: 60,
        code_entered: 45,
        applied: 40,
        order_placed: 38,
        repeat_order: 9,
      },
      gmv: 45600,
    },
    holdout: {
      size: 100,
      stages: {
        tagged: 100,
        sent: null,
        delivered: null,
        clicked: null,
        added_to_cart: 4,
        code_entered: 1,
        applied: 1,
        order_placed: 2,
        repeat_order: 0,
      },
      gmv: 2100,
    },
  },
  metrics: {
    purchase_lift: 0.0222,
    repeat_lift: 0.01,
    reactivation_rate: 0.05,
    redemption_rate: 0.0455,
    incremental_gmv: 26100,
  },
  tracked: { delivered: false, clicked: true },
};

const CSV = "group,stage,count,conversion_from_previous\nmessaged,tagged,900,\n";

const stubCampaigns = (page: Page) =>
  stubTenexu(page, [
    [
      "GET",
      /\/cohorts\/campaigns$/,
      route =>
        fulfillJson(route, {
          items: [
            CAMPAIGN,
            {
              ...CAMPAIGN,
              id: 32,
              voucher_code: "PWVIP",
              status: "blocked",
              blocked_reason: "Template not approved",
            },
          ],
          page: 1,
          pageSize: 20,
          total: 2,
        }),
    ],
    ["GET", /\/cohorts\/campaigns\/31\/funnel$/, route => fulfillJson(route, FUNNEL)],
    [
      "GET",
      /\/cohorts\/campaigns\/31\/funnel\.csv$/,
      route => fulfillCsv(route, CSV, "campaign-31-funnel.csv"),
    ],
  ]);

const stageCell = (page: Page, stage: string, cell: string) =>
  page.getByTestId(`funnel-row-${stage}`).getByTestId(cell);

test.describe("with MANAGE_DISCOUNTS", () => {
  test.use({ permissionName: "admin" });
  test.skip(!process.env.VITE_TENEXU_API_URL, TENEXU_API_URL_MISSING_REASON);

  test("TC: TTXY-4841 L9 campaign list, then the funnel with messaged vs holdout and lift #e2e", async ({
    page,
  }) => {
    // Arrange
    const api = await stubCampaigns(page);

    // Act
    await page.goto(URL_LIST.campaigns);

    // Assert — list
    await expect(page.getByTestId("campaign-row-31")).toContainText("PWLAPSED20", {
      timeout: 30000,
    });
    await expect(page.getByTestId("campaign-row-32")).toContainText("Template not approved");
    expect(api.find("GET", "/cohorts/campaigns")[0].search).toContain("page=1");

    // Act — open the funnel
    await page.getByTestId("campaign-link-31").click();

    // Assert — funnel
    await expect(page.getByTestId("campaign-funnel-table")).toBeVisible();
    await expect(stageCell(page, "tagged", "funnel-messaged-count")).toHaveText("900");
    await expect(stageCell(page, "tagged", "funnel-holdout-count")).toHaveText("100");
    await expect(stageCell(page, "order_placed", "funnel-messaged-count")).toHaveText("38");
    await expect(stageCell(page, "sent", "funnel-messaged-conversion")).not.toHaveText("—");
    await expect(page.getByTestId("metric-purchase_lift")).toContainText("2.22");
    await expect(page.getByTestId("metric-incremental_gmv")).toContainText("26,100");
  });

  test("TC: TTXY-4841 L10 untracked stages show 'Not tracked', not 0 #e2e", async ({ page }) => {
    // Arrange
    await stubCampaigns(page);

    // Act
    await page.goto(`${URL_LIST.campaigns}/31`);

    // Assert
    await expect(stageCell(page, "delivered", "funnel-messaged-count")).toHaveText("Not tracked", {
      timeout: 30000,
    });
    await expect(stageCell(page, "delivered", "funnel-holdout-count")).toHaveText("Not tracked");
    await expect(stageCell(page, "sent", "funnel-holdout-count")).toHaveText("Not tracked");
    await expect(stageCell(page, "repeat_order", "funnel-holdout-count")).toHaveText("0");
  });

  test("TC: TTXY-4841 L9 Export CSV downloads funnel.csv with the session headers #e2e", async ({
    page,
  }) => {
    // Arrange
    const api = await stubCampaigns(page);

    await page.goto(`${URL_LIST.campaigns}/31`);
    await expect(page.getByTestId("campaign-export-csv")).toBeVisible({ timeout: 30000 });

    // Act
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("campaign-export-csv").click(),
    ]);

    // Assert
    expect(download.suggestedFilename()).toBe("campaign-31-funnel.csv");

    const [csvCall] = api.find("GET", "/cohorts/campaigns/31/funnel.csv");

    expect(csvCall.headers.authorization).toMatch(/^Bearer /);
    expect(csvCall.headers).toHaveProperty("x-refresh-token");
  });

  test("TC: TTXY-4841 L11 Campaigns is in the Discounts menu #e2e", async ({ page }) => {
    // Arrange
    await stubCampaigns(page);

    // Act
    await page.goto(URL_LIST.campaigns);

    // Assert
    await expect(page.getByTestId("menu-item-label-campaigns")).toBeAttached({ timeout: 30000 });
  });

  test("TC: TTXY-4841 L12 campaign pages have no serious axe violations #e2e", async ({ page }) => {
    const AxeBuilder = await loadAxeBuilder();

    test.skip(!AxeBuilder, AXE_MISSING_REASON);

    // Arrange
    await stubCampaigns(page);
    await page.goto(URL_LIST.campaigns);
    await expect(page.getByTestId("campaigns-table")).toBeVisible({ timeout: 30000 });

    // Act / Assert — list
    expect(await seriousViolations(AxeBuilder!, page, '[data-test-id="campaigns-table"]')).toEqual(
      [],
    );

    // Act / Assert — funnel
    await page.goto(`${URL_LIST.campaigns}/31`);
    await expect(page.getByTestId("campaign-funnel-table")).toBeVisible();
    expect(
      await seriousViolations(AxeBuilder!, page, '[data-test-id="campaign-funnel-table"]'),
    ).toEqual([]);
  });
});

test.describe("without MANAGE_DISCOUNTS", () => {
  test.use({ permissionName: "order" });

  test("TC: TTXY-4841 L11 a user without MANAGE_DISCOUNTS sees no Campaigns menu item #e2e", async ({
    page,
  }) => {
    // Arrange
    const api = await stubCampaigns(page);

    // Act
    await page.goto(URL_LIST.campaigns);

    // Assert — the section is not rendered and its API is never called
    await expect(page.getByTestId("menu-item-label-orders")).toBeAttached({ timeout: 30000 });
    await expect(page.getByTestId("menu-item-label-campaigns")).toHaveCount(0);
    await expect(page.getByTestId("campaigns-table")).toHaveCount(0);
    expect(api.calls).toHaveLength(0);
  });
});

baseTest.describe("logged out", () => {
  baseTest.use({ storageState: { cookies: [], origins: [] } });

  baseTest(
    "TC: TTXY-4841 L11 a logged-out user opening Campaigns goes to login #e2e",
    async ({ page }) => {
      // Arrange
      const api = await stubCampaigns(page);

      // Act
      await page.goto(URL_LIST.campaigns);

      // Assert
      await expect(page.getByTestId("email")).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId("password")).toBeVisible();
      expect(api.calls).toHaveLength(0);
    },
  );
});
