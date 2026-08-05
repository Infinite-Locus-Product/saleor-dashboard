import { URL_LIST } from "@data/url";
import { BasePage } from "@pages/basePage";
import { type Page } from "@playwright/test";

export class CohortsPage extends BasePage {
  constructor(
    page: Page,
    readonly createCohortButton = page.getByTestId("create-cohort"),
    readonly searchInput = page.getByTestId("cohort-search").locator("input"),
    readonly listTable = page.getByTestId("cohort-list-table"),
    readonly emptyState = page.getByTestId("cohort-list-empty"),
    readonly nameInput = page.getByTestId("cohort-name").locator("input"),
    readonly createError = page.getByTestId("cohort-create-error"),
    readonly saveButton = page.getByTestId("button-bar-confirm"),
    readonly csvInput = page.getByTestId("cohort-csv-input"),
    readonly csvSummary = page.getByTestId("cohort-csv-summary"),
    readonly deleteButton = page.getByTestId("cohort-delete"),
  ) {
    super(page);
  }

  async gotoListPage() {
    await this.page.goto(URL_LIST.cohorts);
    await this.createCohortButton.waitFor({ state: "visible" });
  }

  async gotoCreatePage() {
    await this.page.goto(URL_LIST.cohortsAdd);
    await this.nameInput.waitFor({ state: "visible" });
  }
}
