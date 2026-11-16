import { useUser } from "@dashboard/auth/useUser";
import { useCXPermission } from "@dashboard/returns-exchange/hooks/useCXPermission";
import { renderHook } from "@testing-library/react-hooks";

import { type SidebarMenuItem } from "../types";
import { useMenuStructure } from "./useMenuStructure";

jest.mock("@dashboard/auth/useUser", () => ({
  useUser: jest.fn(),
}));
jest.mock("@dashboard/returns-exchange/hooks/useCXPermission", () => ({
  useCXPermission: jest.fn(),
}));
jest.mock("@dashboard/extensions/components/AppAlerts/useAppsAlert", () => ({
  useAppsAlert: () => ({ handleAppsListItemClick: jest.fn(), hasProblems: false }),
}));
jest.mock("@dashboard/extensions/hooks/useExtensions", () => ({
  useExtensions: () => ({
    NAVIGATION_CATALOG: [],
    NAVIGATION_ORDERS: [],
    NAVIGATION_CUSTOMERS: [],
    NAVIGATION_DISCOUNTS: [],
    NAVIGATION_PAGES: [],
    NAVIGATION_TRANSLATIONS: [],
  }),
}));

const findReturnsGroup = (items: SidebarMenuItem[]) =>
  items.find(item => item.id === "returns-exchange");

describe("useMenuStructure — Returns & Exchange (FE-NAV01)", () => {
  beforeEach(() => {
    (useUser as jest.Mock).mockReturnValue({ user: { userPermissions: [] } });
  });

  it("shows Manual Returns between Manual Exchanges and Notification Settings for CX agents", () => {
    // Arrange
    (useCXPermission as jest.Mock).mockReturnValue(true);

    // Act
    const { result } = renderHook(() => useMenuStructure());

    // Assert
    const group = findReturnsGroup(result.current);
    const children = group?.children ?? [];

    expect(children.map(child => child.id)).toEqual([
      "returns-queue",
      "manual-exchanges",
      "manual-returns",
      "manual-refunds",
      "cx-notification-settings",
    ]);

    const manualReturns = children.find(child => child.id === "manual-returns");

    expect(manualReturns).toMatchObject({
      label: "Manual Returns",
      url: "/returns-exchange/manual-returns",
      permissions: [],
      type: "item",
    });
  });

  it("does not expose the Returns & Exchange section to non-CX users", () => {
    // Arrange
    (useCXPermission as jest.Mock).mockReturnValue(false);

    // Act
    const { result } = renderHook(() => useMenuStructure());

    // Assert
    expect(findReturnsGroup(result.current)).toBeUndefined();
  });
});

describe("useMenuStructure — Campaigns (TTXY-4841)", () => {
  beforeEach(() => {
    (useCXPermission as jest.Mock).mockReturnValue(false);
  });

  it("L11 — with MANAGE_DISCOUNTS, Campaigns sits under Discounts right after Cohorts", () => {
    // Arrange
    (useUser as jest.Mock).mockReturnValue({
      user: { userPermissions: [{ code: "MANAGE_DISCOUNTS" }] },
    });

    // Act
    const { result } = renderHook(() => useMenuStructure());

    // Assert
    const discounts = result.current.find(item => item.id === "discounts");
    const childIds = (discounts?.children ?? []).map(child => child.id);

    expect(childIds.slice(childIds.indexOf("cohorts"), childIds.indexOf("cohorts") + 2)).toEqual([
      "cohorts",
      "campaigns",
    ]);
    expect(discounts?.children?.find(child => child.id === "campaigns")).toMatchObject({
      label: "Campaigns",
      url: "/campaigns",
      type: "item",
    });
  });

  it("L11 — without MANAGE_DISCOUNTS there is no Campaigns menu item", () => {
    // Arrange
    (useUser as jest.Mock).mockReturnValue({
      user: { userPermissions: [{ code: "MANAGE_ORDERS" }] },
    });

    // Act
    const { result } = renderHook(() => useMenuStructure());

    // Assert
    const allIds = result.current.flatMap(item => [
      item.id,
      ...(item.children ?? []).map(child => child.id),
    ]);

    expect(allIds).not.toContain("campaigns");
    expect(allIds).not.toContain("discounts");
  });
});
