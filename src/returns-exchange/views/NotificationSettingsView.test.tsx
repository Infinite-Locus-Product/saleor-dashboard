import { useUser } from "@dashboard/auth/useUser";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { fetchNotificationSettings, saveNotificationSettings } from "../api/returnsApi";
import { type NotificationSettings } from "../types";
import { NotificationSettingsView } from "./NotificationSettingsView";

jest.mock("@dashboard/auth/useUser", () => ({
  useUser: jest.fn(),
}));
jest.mock("../api/returnsApi", () => ({
  fetchNotificationSettings: jest.fn(),
  saveNotificationSettings: jest.fn(),
}));

const LABEL = "Refund Failure Emails (Manual Returns)";

const settings: NotificationSettings = {
  AT_RISK_EMAILS: [],
  AT_RISK_THRESHOLD: 5,
  CRITICAL_EMAILS: [],
  CRITICAL_THRESHOLD: 2,
  ERP_SYNC_EMAILS: ["erp@example.com"],
  AUTO_APPROVAL_EMAILS: [],
  EXCHANGE_ORDER_EMAILS: [],
  WEBHOOK_FAIL_EMAILS: [],
  REFUND_FAIL_EMAILS: ["finance@example.com", "cx@example.com"],
};

describe("NotificationSettingsView — FE-SET01 refund failure emails", () => {
  beforeEach(() => {
    (useUser as jest.Mock).mockReturnValue({ user: { id: "VXNlcjo3" } });
    (fetchNotificationSettings as jest.Mock).mockReset();
    (saveNotificationSettings as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  it("renders the field in Failure Alerts seeded from saved settings", async () => {
    // Arrange
    (fetchNotificationSettings as jest.Mock).mockResolvedValue(settings);

    // Act
    render(<NotificationSettingsView />);

    // Assert
    const input = await screen.findByLabelText(LABEL);

    expect(screen.getByText(LABEL)).toBeInTheDocument();
    expect(
      screen.getByText("Notified when a manual return's refund (Easebuzz / GoKwik) fails"),
    ).toBeInTheDocument();
    expect(input).toHaveValue("finance@example.com, cx@example.com");
  });

  it("flags invalid addresses and does not save", async () => {
    // Arrange
    (fetchNotificationSettings as jest.Mock).mockResolvedValue(settings);
    render(<NotificationSettingsView />);

    const input = await screen.findByLabelText(LABEL);

    // Act
    fireEvent.change(input, { target: { value: "finance@example.com, not-an-email" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Save Settings/ })[0]);

    // Assert
    expect(screen.getByText("Invalid: not-an-email")).toBeInTheDocument();
    expect(saveNotificationSettings).not.toHaveBeenCalled();
  });

  it("saves the parsed list as REFUND_FAIL_EMAILS", async () => {
    // Arrange
    (fetchNotificationSettings as jest.Mock).mockResolvedValue(settings);
    render(<NotificationSettingsView />);

    const input = await screen.findByLabelText(LABEL);

    // Act
    fireEvent.change(input, { target: { value: " refunds@example.com ,ops@example.com, " } });
    fireEvent.click(screen.getAllByRole("button", { name: /Save Settings/ })[0]);

    // Assert
    await waitFor(() => expect(saveNotificationSettings).toHaveBeenCalledTimes(1));

    const [savedSettings, agentId] = (saveNotificationSettings as jest.Mock).mock.calls[0];

    expect(savedSettings.REFUND_FAIL_EMAILS).toEqual(["refunds@example.com", "ops@example.com"]);
    expect(savedSettings.ERP_SYNC_EMAILS).toEqual(["erp@example.com"]);
    expect(agentId).toBe("VXNlcjo3");
  });

  it("defaults to an empty list when the backend has no REFUND_FAIL_EMAILS yet", async () => {
    // Arrange
    const { REFUND_FAIL_EMAILS: _omitted, ...legacySettings } = settings;

    (fetchNotificationSettings as jest.Mock).mockResolvedValue(legacySettings);
    render(<NotificationSettingsView />);

    const input = await screen.findByLabelText(LABEL);

    // Act
    fireEvent.click(screen.getAllByRole("button", { name: /Save Settings/ })[0]);

    // Assert
    expect(input).toHaveValue("");
    await waitFor(() => expect(saveNotificationSettings).toHaveBeenCalledTimes(1));
    expect((saveNotificationSettings as jest.Mock).mock.calls[0][0].REFUND_FAIL_EMAILS).toEqual([]);
  });
});
