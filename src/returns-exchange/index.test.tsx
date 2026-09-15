import { useUser } from "@dashboard/auth/useUser";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ReturnsExchangeSection from "./index";

jest.mock("@dashboard/components/Router", () => ({
  Route: jest.requireActual("react-router-dom").Route,
}));
jest.mock("@dashboard/auth/useUser", () => ({
  useUser: jest.fn(),
}));
jest.mock("./views/ManualReturnListView", () => ({
  ManualReturnListView: () => "manual-return-list-view",
}));
jest.mock("./views/ManualReturnNewView", () => ({
  ManualReturnNewView: () => "manual-return-new-view",
}));
jest.mock("./views/ManualReturnDetailView", () => ({
  ManualReturnDetailView: ({ mrId }: { mrId: string }) => `manual-return-detail-view:${mrId}`,
}));
jest.mock("./views/ManualExchangeListView", () => ({
  ManualExchangeListView: () => "manual-exchange-list-view",
}));
jest.mock("./views/ManualExchangeNewView", () => ({
  ManualExchangeNewView: () => "manual-exchange-new-view",
}));
jest.mock("./views/ManualExchangeDetailView", () => ({
  ManualExchangeDetailView: ({ mxId }: { mxId: string }) => `manual-exchange-detail-view:${mxId}`,
}));
jest.mock("./views/LogCallView", () => ({ LogCallView: () => "log-call-view" }));
jest.mock("./views/NotificationSettingsView", () => ({
  NotificationSettingsView: () => "notification-settings-view",
}));
jest.mock("./views/RequestDetailView", () => ({ RequestDetailView: () => "request-detail-view" }));
jest.mock("./views/ReturnsQueueView", () => ({ ReturnsQueueView: () => "returns-queue-view" }));
jest.mock("./views/SizeSelectionView", () => ({ SizeSelectionView: () => "size-selection-view" }));

const cxUser = { id: "VXNlcjo3", permissionGroups: [{ id: "G1", name: "CX Returns Management" }] };
const nonCxUser = { id: "VXNlcjo4", permissionGroups: [{ id: "G2", name: "Full Access" }] };

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ReturnsExchangeSection />
    </MemoryRouter>,
  );

describe("returns-exchange routes", () => {
  describe("manual returns for a CX user", () => {
    beforeEach(() => {
      (useUser as jest.Mock).mockReturnValue({ user: cxUser });
    });

    it("renders the list at /returns-exchange/manual-returns", () => {
      // Act
      renderAt("/returns-exchange/manual-returns");

      // Assert
      expect(screen.getByText("manual-return-list-view")).toBeInTheDocument();
    });

    it("matches /new before /:mrId", () => {
      // Act
      renderAt("/returns-exchange/manual-returns/new");

      // Assert
      expect(screen.getByText("manual-return-new-view")).toBeInTheDocument();
      expect(screen.queryByText(/manual-return-detail-view/)).not.toBeInTheDocument();
    });

    it("renders the detail view with the MR id from the URL", () => {
      // Act
      renderAt("/returns-exchange/manual-returns/MR-0042");

      // Assert
      expect(screen.getByText("manual-return-detail-view:MR-0042")).toBeInTheDocument();
    });
  });

  describe("FE-NAV02 manual returns for a non-CX user", () => {
    beforeEach(() => {
      (useUser as jest.Mock).mockReturnValue({ user: nonCxUser });
    });

    it.each([
      "/returns-exchange/manual-returns",
      "/returns-exchange/manual-returns/new",
      "/returns-exchange/manual-returns/MR-0042",
    ])("shows access denied on direct URL %s", path => {
      // Act
      renderAt(path);

      // Assert
      expect(screen.getByText("You don't have access to Manual Returns")).toBeInTheDocument();
      expect(screen.queryByText(/manual-return-/)).not.toBeInTheDocument();
    });
  });

  describe("manual exchange routes are unchanged", () => {
    beforeEach(() => {
      (useUser as jest.Mock).mockReturnValue({ user: cxUser });
    });

    it.each([
      ["/returns-exchange/manual", "manual-exchange-list-view"],
      ["/returns-exchange/manual/new", "manual-exchange-new-view"],
      ["/returns-exchange/manual/MX-0007", "manual-exchange-detail-view:MX-0007"],
    ])("%s renders %s", (path, text) => {
      // Act
      renderAt(path);

      // Assert
      expect(screen.getByText(text)).toBeInTheDocument();
    });
  });
});
