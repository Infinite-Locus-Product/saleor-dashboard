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
