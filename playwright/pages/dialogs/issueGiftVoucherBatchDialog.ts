import { type Page } from "@playwright/test";

/** The batch dialog behind "Issue card": gift vouchers are only issued in batches. */
export class IssueGiftVoucherBatchDialog {
  readonly page: Page;

  constructor(
    page: Page,
    readonly cardsAmountInput = page.locator('[name="cardsAmount"]'),
    readonly balanceAmountInput = page.locator('[name="balanceAmount"]'),
    readonly batchNameInput = page.locator('[name="tags"]'),
    readonly prefixInput = page.locator('[name="prefix"]'),
    readonly issueButton = page.getByRole("button", { name: "Issue", exact: true }),
  ) {
    this.page = page;
  }

  async issueBatch({
    count,
    balance,
    batchName,
    prefix,
  }: {
    count: string;
    balance: string;
    batchName: string;
    prefix: string;
  }): Promise<void> {
    await this.cardsAmountInput.fill(count);
    await this.balanceAmountInput.fill(balance);
    await this.batchNameInput.fill(batchName);
    await this.prefixInput.fill(prefix);
    await this.issueButton.click();
  }
}
