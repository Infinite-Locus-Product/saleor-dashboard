import { type Page } from "@playwright/test";

export class SetGiftCardsBalanceDialog {
  readonly page: Page;

  constructor(
    page: Page,
    readonly submitButton = page.getByTestId("submit"),
    readonly enterAmountInput = page.locator('[name="balanceAmount"]'),
    readonly reasonInput = page.locator('[name="reason"]'),
  ) {
    this.page = page;
  }

  /** A reason is required: it is saved in the card's history. */
  async setBalance(balance: string, reason: string): Promise<void> {
    await this.enterAmountInput.fill(balance);
    await this.reasonInput.fill(reason);
    await this.submitButton.click();
  }
}
