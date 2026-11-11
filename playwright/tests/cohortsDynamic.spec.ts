/**
 * TTXY-4841 L1–L5, L12 — dynamic cohorts: Static/Dynamic choice, the rule
 * builder driven by GET /cohorts/rule-fields, client and server rule errors,
 * and editing saved rules. TenexuBackend is stubbed (playwright/utils/tenexuStubs);
 * Saleor login and routing stay real, like playwright/tests/cohorts.spec.ts.
 */
import { CohortsPage } from "@pages/cohortsPage";
import { expect, type Page } from "@playwright/test";
import { AXE_MISSING_REASON, loadAxeBuilder, seriousViolations } from "utils/axe";
import {
  fulfillError,
  fulfillJson,
  stubTenexu,
  TENEXU_API_URL_MISSING_REASON,
} from "utils/tenexuStubs";
import { test } from "utils/testWithPermission";

test.use({ permissionName: "admin" });
test.skip(!process.env.VITE_TENEXU_API_URL, TENEXU_API_URL_MISSING_REASON);

const NUMERIC_OPS = [
  "equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "between",
];

const RULE_FIELDS = [
  { field: "city", type: "text", operators: ["equals", "includes"] },
  { field: "order_count", type: "number", operators: NUMERIC_OPS },
  { field: "gmv", type: "number", operators: NUMERIC_OPS },
  { field: "product_purchased", type: "product", operators: ["includes"] },
  { field: "category_purchased", type: "category", operators: ["includes"] },
];

const STUB_ID = 987655;

const dynamicCohort = (rules: unknown) => ({
  id: STUB_ID,
  cohort_code: "PW-DYN",
  cohort_name: "Playwright dynamic cohort",
  description: null,
  type: "dynamic",
  status: true,
  created_date: "2026-11-01T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 0,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
  rules,
});

const SAVED_RULES = {
  logic: "AND",
  conditions: [
    { field: "city", operator: "equals", value: "jaipur" },
    { field: "order_count", operator: "greater_than", value: 2 },
  ],
};

const stubCohortRoutes = (
  page: Page,
  {
    create,
    patch,
  }: {
    create?: (body: unknown) => { status: number; body: Record<string, unknown> } | null;
    patch?: (body: unknown) => { status: number; body: Record<string, unknown> } | null;
  } = {},
) =>
  stubTenexu(page, [
    ["GET", /\/cohorts\/rule-fields$/, route => fulfillJson(route, RULE_FIELDS)],
    [
      "POST",
      /\/cohorts$/,
      (route, request) => {
        const failure = create?.(request.postDataJSON());

        return failure
          ? fulfillError(route, failure.status, failure.body)
          : fulfillJson(route, dynamicCohort(request.postDataJSON().rules), 201);
      },
    ],
    [
      "GET",
      new RegExp(`/cohorts/${STUB_ID}$`),
      route => fulfillJson(route, dynamicCohort(SAVED_RULES)),
    ],
    [
      "PATCH",
      new RegExp(`/cohorts/${STUB_ID}$`),
      (route, request) => {
        const failure = patch?.(request.postDataJSON());

        return failure
          ? fulfillError(route, failure.status, failure.body)
          : fulfillJson(route, dynamicCohort(request.postDataJSON().rules ?? SAVED_RULES));
      },
    ],
    [
      "GET",
      new RegExp(`/cohorts/${STUB_ID}/coupons$`),
      route => fulfillJson(route, { coupons: [] }),
    ],
  ]);

let cohortsPage: CohortsPage;

test.beforeEach(({ page }) => {
  cohortsPage = new CohortsPage(page);
});

const chooseDynamic = async (page: Page) => {
  await page.getByTestId("cohort-type-dynamic").check();
  await expect(page.getByTestId("rule-builder")).toBeVisible();
};

test("TC: TTXY-4841 L1 Create shows Static/Dynamic; Dynamic hides the CSV hint and shows the rule builder #e2e", async ({
  page,
}) => {
  // Arrange
  const api = await stubCohortRoutes(page);

  await cohortsPage.gotoCreatePage();

  // Assert — static by default
  await expect(page.getByTestId("cohort-type-static")).toBeChecked();
  await expect(page.getByTestId("cohort-csv-hint")).toBeVisible();
  await expect(page.getByTestId("rule-builder")).toHaveCount(0);

  // Act
  await chooseDynamic(page);

  // Assert
  await expect(page.getByTestId("cohort-csv-hint")).toHaveCount(0);
  expect(api.find("GET", "/cohorts/rule-fields")).toHaveLength(1);
});

test("TC: TTXY-4841 L2 add/edit/remove conditions, nested group, AND/OR per group #e2e", async ({
  page,
}) => {
  // Arrange
  await stubCohortRoutes(page);
  await cohortsPage.gotoCreatePage();
  await chooseDynamic(page);

  // Act
  await page.getByTestId("rule-add-condition").click();
  await page.getByTestId("rule-add-condition").click();
  await page.getByTestId("rule-value").first().fill("jaipur");
  await page.getByTestId("rule-remove").nth(1).click();
  await page.getByTestId("rule-add-group").click();

  const nested = page.getByTestId("rule-group").nth(1);

  await nested.getByTestId("rule-logic").selectOption("OR");

  // Assert
  await expect(page.getByTestId("rule-condition")).toHaveCount(2);
  await expect(page.getByTestId("rule-group")).toHaveCount(2);
  await expect(page.getByTestId("rule-logic").first()).toHaveValue("AND");
  await expect(nested.getByTestId("rule-logic")).toHaveValue("OR");
});

test("TC: TTXY-4841 L3 operators follow the field; between shows min/max; numbers reject text #e2e", async ({
  page,
}) => {
  // Arrange
  await stubCohortRoutes(page);
  await cohortsPage.gotoCreatePage();
  await cohortsPage.nameInput.fill("Playwright numbers");
  await chooseDynamic(page);
  await page.getByTestId("rule-add-condition").click();

  // Assert — city operators only
  await expect(page.getByTestId("rule-operator").locator("option")).toHaveCount(2);

  // Act
  await page.getByTestId("rule-field").selectOption("order_count");

  // Assert
  await expect(page.getByTestId("rule-operator").locator("option")).toHaveCount(NUMERIC_OPS.length);

  // Act — between
  await page.getByTestId("rule-operator").selectOption("between");

  // Assert
  await expect(page.getByTestId("rule-min")).toBeVisible();
  await expect(page.getByTestId("rule-max")).toBeVisible();

  // Act — text in a numeric field, then save
  await page.getByTestId("rule-operator").selectOption("equals");
  await page.getByTestId("rule-value").fill("two");
  await cohortsPage.saveButton.click();

  // Assert
  await expect(page.getByTestId("rule-error")).toContainText("Enter a number");
});

test("TC: TTXY-4841 L4 'Add at least one rule'; server invalid_rule shown on the condition #e2e", async ({
  page,
}) => {
  // Arrange
  const api = await stubCohortRoutes(page, {
    create: () => ({
      status: 400,
      body: {
        error: "Rule is invalid",
        code: "invalid_rule",
        details: [{ path: "conditions[0].value", message: "City not recognised" }],
      },
    }),
  });

  await cohortsPage.gotoCreatePage();
  await cohortsPage.nameInput.fill("Playwright invalid");
  await chooseDynamic(page);

  // Act — no rules
  await cohortsPage.saveButton.click();

  // Assert
  await expect(page.getByText("Add at least one rule")).toBeVisible();
  expect(api.find("POST", /\/cohorts$/)).toHaveLength(0);

  // Act — a rule the server rejects
  await page.getByTestId("rule-add-condition").click();
  await page.getByTestId("rule-value").fill("atlantis");
  await cohortsPage.saveButton.click();

  // Assert
  await expect(page.getByTestId("rule-condition").getByTestId("rule-error")).toContainText(
    "City not recognised",
  );
});

test("TC: TTXY-4841 L1 saving a dynamic cohort posts type dynamic with the rule tree #e2e", async ({
  page,
}) => {
  // Arrange
  const api = await stubCohortRoutes(page);

  await cohortsPage.gotoCreatePage();
  await cohortsPage.nameInput.fill("Playwright dynamic cohort");
  await chooseDynamic(page);
  await page.getByTestId("rule-add-condition").click();
  await page.getByTestId("rule-value").fill("jaipur");

  // Act
  await cohortsPage.saveButton.click();

  // Assert
  await expect(page).toHaveURL(new RegExp(`/cohorts/list/${STUB_ID}`));

  const [create] = api.find("POST", /\/cohorts$/);

  expect(create.body).toMatchObject({
    cohort_name: "Playwright dynamic cohort",
    type: "dynamic",
    rules: { logic: "AND", conditions: [{ field: "city", operator: "equals", value: "jaipur" }] },
  });
  expect(create.headers.authorization).toMatch(/^Bearer /);
});

test("TC: TTXY-4841 L5 details page shows saved rules and saves an edit #e2e", async ({ page }) => {
  // Arrange
  const api = await stubCohortRoutes(page);

  await cohortsPage.gotoDetailsPage(STUB_ID);
  await expect(page.getByTestId("rule-condition")).toHaveCount(2);
  await expect(page.getByTestId("cohort-type-readonly")).toBeDisabled();
  await expect(cohortsPage.csvInput).toHaveCount(0);

  // Act
  await page.getByTestId("rule-value").nth(1).fill("5");
  await cohortsPage.saveButton.click();

  // Assert
  await expect.poll(() => api.find("PATCH", `/cohorts/${STUB_ID}`).length).toBe(1);
  expect(api.find("PATCH", `/cohorts/${STUB_ID}`)[0].body).toMatchObject({
    rules: {
      logic: "AND",
      conditions: [
        { field: "city", operator: "equals", value: "jaipur" },
        { field: "order_count", operator: "greater_than", value: 5 },
      ],
    },
  });
});

test("TC: TTXY-4841 L12 cohort create with the rule builder has no serious axe violations #e2e", async ({
  page,
}) => {
  const AxeBuilder = await loadAxeBuilder();

  test.skip(!AxeBuilder, AXE_MISSING_REASON);

  // Arrange
  await stubCohortRoutes(page);
  await cohortsPage.gotoCreatePage();
  await chooseDynamic(page);
  await page.getByTestId("rule-add-condition").click();

  // Act
  const violations = await seriousViolations(AxeBuilder!, page, "#cohort-create-form");

  // Assert
  expect(violations).toEqual([]);
});
