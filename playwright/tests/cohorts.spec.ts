import { CohortsPage } from "@pages/cohortsPage";
import { expect } from "@playwright/test";
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
