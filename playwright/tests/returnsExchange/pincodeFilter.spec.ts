/**
 * TTXY-6032 K5–K8 — Returns queue pincode column / filter. TenexuBackend CX API mocked via
 * page.route (cxReturnsMock.ts). K5–K7 need the admin storage state with the user in the
 * "CX Returns Management" group; K8 runs with an empty storage state.
 */
import { expect, test as baseTest } from "@playwright/test";
import { test } from "utils/testWithPermission";

import { makeRow, mockCxReturnsApi, QUEUE_URL } from "./cxReturnsMock";

const rows = [
  makeRow(),
  makeRow({ id: 2, request_id: "REQ-6121", pincode: null, delivery_address: null }),
];

test.describe("authenticated", () => {
  test.use({ permissionName: "admin" });

  test("TC: TTXY-6032 K5 Pincode column after Order # with — for missing #e2e", async ({
    page,
  }) => {
    await mockCxReturnsApi(page, { list: rows });

    await page.goto(QUEUE_URL);
    await expect(page.getByText("REQ-6121")).toBeVisible();

    const headers = (await page.locator("thead th").allTextContents()).map(t => t.trim());
    const orderIdx = headers.indexOf("Order #");

    expect(orderIdx).toBeGreaterThanOrEqual(0);
    expect(headers[orderIdx + 1]).toBe("Pincode");

    const pinIdx = orderIdx + 1;
    const row1 = page.getByRole("row").filter({ hasText: "REQ-6120" });
    const row2 = page.getByRole("row").filter({ hasText: "REQ-6121" });

    await expect(row1.locator("td").nth(pinIdx)).toHaveText("560001");
    await expect(row2.locator("td").nth(pinIdx)).toHaveText("—");
  });

  test("TC: TTXY-6032 K6 pincode filter: invalid, valid (page 1), no results + Clear #e2e", async ({
    page,
  }) => {
    const api = await mockCxReturnsApi(page, {
      list: qs =>
        qs.get("pincode") === "110011"
          ? { data: [], total: 0 }
          : { data: rows, total: 45 /* 3 pages */ },
    });

    await page.goto(QUEUE_URL);
    await expect(page.getByText("REQ-6120")).toBeVisible();

    // go to page 2 first
    await page.getByRole("button", { name: "Next" }).click();
    await expect.poll(() => api.listQueries.at(-1)?.get("page")).toBe("2");

    // invalid → inline message, no fetch
    const before = api.listQueries.length;

    await page.getByTestId("pincode-filter-input").fill("56000");
    await page.getByTestId("pincode-filter-apply").click();
    await expect(page.getByText("Enter a 6-digit pincode")).toBeVisible();
    expect(api.listQueries.length).toBe(before);

    // valid → refetch with pincode, page back to 1
    await page.getByTestId("pincode-filter-input").fill("560001");
    await page.getByTestId("pincode-filter-input").press("Enter");
    await expect.poll(() => api.listQueries.at(-1)?.get("pincode")).toBe("560001");
    expect(api.listQueries.at(-1)?.get("page")).toBe("1");
    await expect(page.getByText("Enter a 6-digit pincode")).toHaveCount(0);

    // no results → message + Clear pincode restores the list
    await page.getByTestId("pincode-filter-input").fill("110011");
    await page.getByTestId("pincode-filter-apply").click();
    await expect(page.getByText("No return requests for pincode 110011.")).toBeVisible();
    await page.getByRole("button", { name: "Clear pincode", exact: true }).click();
    await expect(page.getByText("REQ-6120")).toBeVisible();
    expect(api.listQueries.at(-1)?.has("pincode")).toBe(false);
  });

  test("TC: TTXY-6032 K7 pincode + status chip combine in the request query #e2e", async ({
    page,
  }) => {
    const api = await mockCxReturnsApi(page, { list: rows });

    await page.goto(QUEUE_URL);
    await expect(page.getByText("REQ-6120")).toBeVisible();

    await page.getByRole("button", { name: "Rejected", exact: true }).click();
    await expect.poll(() => api.listQueries.at(-1)?.get("status")).toBe("RETURN_REJECTED");

    await page.getByTestId("pincode-filter-input").fill("560001");
    await page.getByTestId("pincode-filter-apply").click();
    await expect.poll(() => api.listQueries.at(-1)?.get("pincode")).toBe("560001");
    expect(api.listQueries.at(-1)?.get("status")).toBe("RETURN_REJECTED");

    // reversed order: changing the status keeps the pincode
    await page.getByRole("button", { name: "Pending", exact: true }).click();
    await expect.poll(() => api.listQueries.at(-1)?.get("status")).toBe("RETURN_PENDING");
    expect(api.listQueries.at(-1)?.get("pincode")).toBe("560001");
  });
});

baseTest.describe("logged out", () => {
  baseTest.use({ storageState: { cookies: [], origins: [] } });

  baseTest(
    "TC: TTXY-6032 K8 logged-out user opening the queue goes to login #e2e",
    async ({ page }) => {
      const api = await mockCxReturnsApi(page, { list: rows });

      await page.goto(QUEUE_URL);

      await expect(page.getByTestId("email")).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId("password")).toBeVisible();
      await expect(page.getByText("REQ-6120")).toHaveCount(0);
      expect(api.listQueries.length).toBe(0);
    },
  );
});
