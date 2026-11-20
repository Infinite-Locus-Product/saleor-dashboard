import { render, screen, waitFor } from "@testing-library/react";

import { fetchList, fetchSettings } from "../api/codHoldApi";
import { type CodHoldSettings } from "../types";
import { SettingsView } from "./SettingsView";

jest.mock("../api/codHoldApi", () => ({
  fetchSettings: jest.fn(),
  saveSettings: jest.fn(),
  fetchList: jest.fn(),
  addListValue: jest.fn(),
  removeListValue: jest.fn(),
  uploadListCsv: jest.fn(),
  addAlertEmail: jest.fn(),
  removeAlertEmail: jest.fn(),
}));

const mockFetchSettings = fetchSettings as jest.Mock;
const mockFetchList = fetchList as jest.Mock;

describe("SettingsView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchList.mockResolvedValue([]);
  });

  it("TTXY-6557: does not crash when the backend response omits alertRecipients", async () => {
    // Arrange — simulate the real bug: the API response is missing the field
    // entirely rather than returning an empty array.
    const settingsMissingAlertRecipients = {
      slaOnTrackHours: 4,
      slaDelayedHours: 8,
      slaBreachedHours: 24,
      conversionHoldMinutes: 30,
    } as CodHoldSettings;

    mockFetchSettings.mockResolvedValue(settingsMissingAlertRecipients);

    // Act
    render(<SettingsView />);

    // Assert — page renders instead of throwing, and falls back to the
    // empty-state copy.
    await waitFor(() => expect(mockFetchSettings).toHaveBeenCalled());
    expect(await screen.findByText("Ops Alert Recipients")).toBeInTheDocument();
    expect(screen.getAllByText("None configured yet.").length).toBeGreaterThan(0);
  });

  it("renders configured alert recipients when present", async () => {
    // Arrange
    mockFetchSettings.mockResolvedValue({
      slaOnTrackHours: 4,
      slaDelayedHours: 8,
      slaBreachedHours: 24,
      conversionHoldMinutes: 30,
      alertRecipients: ["ops@example.com"],
    });

    // Act
    render(<SettingsView />);

    // Assert
    expect(await screen.findByText("ops@example.com")).toBeInTheDocument();
  });
});
