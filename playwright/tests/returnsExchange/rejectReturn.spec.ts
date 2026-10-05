/**
 * TTXY-6032 K1–K4 — Reject Return (dashboard). The TenexuBackend CX API is fully mocked with
 * page.route (see cxReturnsMock.ts); Saleor login comes from the shared admin storage state,
 * and that user must be in the "CX Returns Management" permission group.
 */
import { BasePage } from "@pages/basePage";
import { expect, type Page } from "@playwright/test";
import { test } from "utils/testWithPermission";

import { callLog, detailUrl, makeDetail, mockCxReturnsApi, REASON } from "./cxReturnsMock";

test.use({ permissionName: "admin" });

const rejectButton = (page: Page) => page.getByTestId("reject-return-button");
const dialog = (page: Page) => page.getByRole("dialog");
const reasonInput = (page: Page) => page.getByTestId("reject-reason-input");
const confirm = (page: Page) => dialog(page).getByRole("button", { name: "Reject Return" });

const rejectedDetail = () =>
  makeDetail({
    cx_status: "RETURN_REJECTED",
    auto_approval_due_at: null,
    sla_hours_remaining: null,
    rejection_reason: REASON,
    rejected_by_name: "Ravi Kumar",
    rejected_at: "2026-10-04T08:30:00Z",
    last_activity_by_name: "Ravi Kumar",
    last_activity_at: "2026-10-04T08:30:00Z",
    audit_trail: [
      {
        id: 11,
        entity_type: "cx_return_request",
        entity_id: "REQ-6120",
        actor_type: "cx_agent",
        actor_id: "VXNlcjo3",
        actor_name: "Ravi Kumar",
        action_type: "RETURN_REJECTED",
        context: { reason: REASON },
        created_at: "2026-10-04T08:30:00Z",
      },
    ],
  });

test("TC: TTXY-6032 K1 reject happy path turns the request read-only #e2e", async ({ page }) => {
  let current = makeDetail({ cx_status: "RETURN_PENDING", call_logs: [callLog(1, null)] });
  const api = await mockCxReturnsApi(page, {
    detail: () => current,
    reject: () => {
      current = rejectedDetail();

      return { status: 200, body: { ok: true, data: current } };
    },
  });

  await page.goto(detailUrl("REQ-6120"));
  await rejectButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await reasonInput(page).fill(REASON);
  await confirm(page).click();

  await expect(dialog(page)).toBeHidden();
  expect(api.rejectBodies).toEqual([{ reason: REASON }]);
  await new BasePage(page).expectSuccessBanner();
  await expect(page.getByTestId("rejected-pill")).toHaveText("Return Rejected");
  await expect(page.getByTestId("rejection-summary")).toContainText(REASON);
  await expect(page.getByTestId("rejection-summary")).toContainText("Rejected by Ravi Kumar");
  await expect(rejectButton(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Approve Return/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Log Call/ })).toHaveCount(0);
});

test("TC: TTXY-6032 K2 reason validation 9 / 10 / 501 chars #e2e", async ({ page }) => {
  await mockCxReturnsApi(page, { detail: () => makeDetail({ call_logs: [callLog(1, null)] }) });

  await page.goto(detailUrl("REQ-6120"));
  await rejectButton(page).click();

  await reasonInput(page).fill("123456789");
  await expect(page.getByTestId("reject-reason-counter")).toHaveText("9/500");
  await expect(confirm(page)).toBeDisabled();

  await reasonInput(page).fill("1234567890");
  await expect(page.getByTestId("reject-reason-counter")).toHaveText("10/500");
  await expect(confirm(page)).toBeEnabled();

  await reasonInput(page).fill("x".repeat(501));
  // Either the textarea caps input at 500 (maxLength) or confirm is disabled — 501 is never sent.
  const value = await reasonInput(page).inputValue();

  if (value.length > 500) {
    await expect(confirm(page)).toBeDisabled();
  } else {
    expect(value.length).toBe(500);
  }
});

test("TC: TTXY-6032 K3 warnings for no calls and for 'Agreed to exchange' #e2e", async ({
  page,
}) => {
  let detail = makeDetail({ call_logs: [], call_count: 0 });

  await mockCxReturnsApi(page, { detail: () => detail });

  await page.goto(detailUrl("REQ-6120"));
  await rejectButton(page).click();
  await expect(
    dialog(page).getByText("No calls have been logged with this customer."),
  ).toBeVisible();
  await expect(
    dialog(page).getByText("The customer agreed to an exchange on the last call."),
  ).toHaveCount(0);

  detail = makeDetail({
    cx_status: "CX_ACTION",
    call_logs: [callLog(1, "Agreed to exchange")],
    call_count: 1,
    last_user_action: "Agreed to exchange",
  });
  await page.reload();
  await rejectButton(page).click();
  await expect(
    dialog(page).getByText("The customer agreed to an exchange on the last call."),
  ).toBeVisible();
  await expect(dialog(page).getByText("No calls have been logged with this customer.")).toHaveCount(
    0,
  );
});

test("TC: TTXY-6032 K4 reject 409 shows an error toast and keeps the dialog open #e2e", async ({
  page,
}) => {
  await mockCxReturnsApi(page, {
    detail: () => makeDetail({ cx_status: "CX_REVIEW", call_logs: [callLog(1, null)] }),
    reject: () => ({
      status: 409,
      body: {
        ok: false,
        code: "ALREADY_CLOSED",
        message: "Return request is already closed (APPROVED)",
      },
    }),
  });

  await page.goto(detailUrl("REQ-6120"));
  await rejectButton(page).click();
  await reasonInput(page).fill(REASON);
  await confirm(page).click();

  await new BasePage(page).expectErrorBannerMessage("Return request is already closed (APPROVED)");
  await expect(dialog(page)).toBeVisible();
  await expect(reasonInput(page)).toHaveValue(REASON);
});
