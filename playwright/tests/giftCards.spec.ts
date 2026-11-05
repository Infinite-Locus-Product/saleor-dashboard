import { GIFT_CARDS } from "@data/e2eTestData";
import { GiftCardsPage } from "@pages/giftCardsPage";
import { expect } from "@playwright/test";
import { test } from "utils/testWithPermission";

test.use({ permissionName: "admin" });

let giftCardsPage: GiftCardsPage;

test.beforeEach(async ({ page }) => {
  test.slow();
  giftCardsPage = new GiftCardsPage(page);
  await giftCardsPage.gotoGiftCardsListView();
  await giftCardsPage.waitForDOMToFullyLoad();
});
// Gift vouchers are issued in batches only, so "Issue card" opens the batch dialog
// (SALEOR_106, one card for a customer with an expiry date, no longer exists).
test("TC: SALEOR_105 Issue gift voucher batch, find it in Batches and download its codes #e2e #gift", async ({
  page,
}) => {
  const batchName = `e2e gift vouchers ${Date.now()}`;

  await giftCardsPage.clickIssueCardButton();
  await giftCardsPage.issueGiftVoucherBatchDialog.issueBatch({
    count: "2",
    balance: "100",
    batchName,
    prefix: "TXAUTO",
  });
  await giftCardsPage.expectSuccessBanner({ message: "2 gift cards issued" });

  // The Batches page lists the new batch with its 2 vouchers.
  await giftCardsPage.gotoGiftCardsListView();
  await giftCardsPage.batchesButton.click();
  await giftCardsPage.batchSearchInput.fill(batchName);

  const batchRow = page.getByRole("row").filter({ hasText: batchName });

  // Columns: batch tag, vouchers created, total issued, redeemed.
  await expect(batchRow.getByRole("cell").nth(1)).toHaveText("2");

  // Its summary, then its codes as a CSV file.
  await batchRow.click();
  await expect(page.getByText(`Batch ${batchName}`)).toBeVisible();

  const download = page.waitForEvent("download");

  await giftCardsPage.downloadCodesButton.click();
  expect((await download).suggestedFilename()).toBe(`${batchName}.csv`);
});
test("TC: Gift voucher batch refuses a code prefix not starting with TX #e2e #gift", async () => {
  await giftCardsPage.clickIssueCardButton();
  await giftCardsPage.issueGiftVoucherBatchDialog.issueBatch({
    count: "1",
    balance: "100",
    batchName: `e2e invalid prefix ${Date.now()}`,
    prefix: "ABCDEF",
  });
  await expect(giftCardsPage.issueGiftVoucherBatchDialog.prefixInput).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
test("TC: SALEOR_107 Resend code #e2e #gift", async () => {
  // The list shows full codes now, so open the card directly.
  await giftCardsPage.gotoExistingGiftCardView(GIFT_CARDS.giftCardToResendCode.id);
  await giftCardsPage.clickResendCodeButton();
  // This is a workaround for the issue with the dropdown focusing on dialog open
  // Dropdown can cover the resend button and cause test to fail
  await giftCardsPage.resendGiftCardCodeDialog.blur();
  await giftCardsPage.resendGiftCardCodeDialog.clickResendButton();
  await giftCardsPage.expectSuccessBanner();
});
test("TC: SALEOR_108 Deactivate gift card #e2e #gift", async () => {
  await giftCardsPage.gotoExistingGiftCardView(GIFT_CARDS.giftCardToBeDeactivated.id);
  await giftCardsPage.clickDeactivateButton();
  await giftCardsPage.expectSuccessBanner();
  await expect(giftCardsPage.pageHeader).toContainText("Disabled");
});
test("TC: SALEOR_109 Activate gift card #e2e #gift", async () => {
  await giftCardsPage.gotoExistingGiftCardView(GIFT_CARDS.giftCardToBeActivated.id);
  await giftCardsPage.clickDeactivateButton();
  await giftCardsPage.expectSuccessBanner();
  await expect(giftCardsPage.pageHeader).not.toContainText("Disabled");
});
test("TC: SALEOR_110 Edit gift card #e2e #gift", async () => {
  await giftCardsPage.gotoExistingGiftCardView(GIFT_CARDS.giftCardToBeEdited.id);
  await giftCardsPage.openTagInput();
  await giftCardsPage.selectFirstTag();
  await giftCardsPage.selectFirstTag();
  await giftCardsPage.closeTagInput();
  await giftCardsPage.clickCardExpiresCheckbox();
  await giftCardsPage.metadataSeoPage.expandAndAddAllMetadata();
  await giftCardsPage.clickSaveButton();
  await giftCardsPage.expectSuccessBanner();
});
// SALEOR_111 (bulk delete) is removed: gift vouchers are never deleted, so their history is kept.
test("TC: SALEOR_181 Set gift card balance #e2e #gift", async () => {
  await giftCardsPage.gotoExistingGiftCardView(GIFT_CARDS.giftCardToBeEdited.id);
  await giftCardsPage.clickSetBalance();
  await giftCardsPage.setGiftCardsBalanceDialog.setBalance("34", "e2e balance check");
  await giftCardsPage.expectSuccessBanner();
});
test("TC: SALEOR_182 Export gift card codes in XLSX file #e2e #gift", async () => {
  await giftCardsPage.clickShowMoreMenu();
  await giftCardsPage.clickExportGiftCards();
  await giftCardsPage.exportGiftCardsDialog.exportGiftCardCodes("XLSX");
  await giftCardsPage.exportGiftCardsBanner.waitFor({
    state: "hidden",
    timeout: 30000,
  });
});
test("TC: SALEOR_183 Export gift card codes in CSV file #e2e #gift", async () => {
  await giftCardsPage.clickShowMoreMenu();
  await giftCardsPage.clickExportGiftCards();
  await giftCardsPage.exportGiftCardsDialog.exportGiftCardCodes("CSV");
  await giftCardsPage.exportGiftCardsBanner.waitFor({
    state: "hidden",
    timeout: 30000,
  });
});
