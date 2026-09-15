import { useUser } from "@dashboard/auth/useUser";
import { type UserFragment } from "@dashboard/graphql";
import { render, screen } from "@testing-library/react";

import { CXAccessGuard } from "./CXAccessGuard";

jest.mock("@dashboard/auth/useUser", () => ({
  useUser: jest.fn(),
}));

const makeUser = (groupNames: string[]): UserFragment => ({
  __typename: "User",
  id: "VXNlcjo3",
  email: "ravi@tenxyou.com",
  firstName: "Ravi",
  lastName: "Kumar",
  isStaff: true,
  dateJoined: "2025-01-01T00:00:00Z",
  restrictedAccessToChannels: false,
  metadata: [],
  userPermissions: [],
  permissionGroups: groupNames.map((name, i) => ({ __typename: "Group", id: `G${i}`, name })),
  avatar: null,
  accessibleChannels: null,
});

const renderGuard = () =>
  render(
    <CXAccessGuard>
      <div>protected manual returns content</div>
    </CXAccessGuard>,
  );

describe("CXAccessGuard (FE-NAV02)", () => {
  it("renders children for a CX Returns Management user", () => {
    // Arrange
    (useUser as jest.Mock).mockReturnValue({ user: makeUser(["CX Returns Management"]) });

    // Act
    renderGuard();

    // Assert
    expect(screen.getByText("protected manual returns content")).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to Manual Returns")).not.toBeInTheDocument();
  });

  it("renders an access-denied state for a staff user outside the CX group", () => {
    // Arrange
    (useUser as jest.Mock).mockReturnValue({ user: makeUser(["Full Access"]) });

    // Act
    renderGuard();

    // Assert
    expect(screen.getByText("You don't have access to Manual Returns")).toBeInTheDocument();
    expect(screen.queryByText("protected manual returns content")).not.toBeInTheDocument();
  });

  it("renders an access-denied state when there is no signed-in user", () => {
    // Arrange
    (useUser as jest.Mock).mockReturnValue({ user: null });

    // Act
    renderGuard();

    // Assert
    expect(screen.getByText("You don't have access to Manual Returns")).toBeInTheDocument();
    expect(screen.queryByText("protected manual returns content")).not.toBeInTheDocument();
  });

  it("shows a skeleton while the user is still loading", () => {
    // Arrange
    (useUser as jest.Mock).mockReturnValue({ user: undefined });

    // Act
    renderGuard();

    // Assert
    expect(screen.getByTestId("cx-access-guard-loading")).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to Manual Returns")).not.toBeInTheDocument();
    expect(screen.queryByText("protected manual returns content")).not.toBeInTheDocument();
  });
});
