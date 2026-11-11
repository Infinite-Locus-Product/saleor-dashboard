// TTXY-4841 — campaign list (L9): GET /cohorts/campaigns, paginated, status filter.
import { ApiError } from "@dashboard/cohorts/api/apiError";
import { fetchCampaigns } from "@dashboard/cohorts/api/cohortsApi";
import { type CampaignListResponse } from "@dashboard/cohorts/types";
import Wrapper from "@test/wrapper";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { campaignSummaryFixture } from "../fixtures";
import { campaignUrl } from "../urls";
import { CampaignListView } from "./CampaignListView";

jest.mock("@dashboard/cohorts/api/cohortsApi", () => ({
  fetchCampaigns: jest.fn(),
}));

jest.mock("@dashboard/components/AppLayout", () => ({
  TopNav: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const fetchCampaignsMock = fetchCampaigns as jest.MockedFunction<typeof fetchCampaigns>;

const page = (over: Partial<CampaignListResponse> = {}): CampaignListResponse => ({
  items: [
    campaignSummaryFixture(),
    campaignSummaryFixture({
      id: 32,
      voucher_code: "VIP10",
      cohort_name: "VIP",
      status: "blocked",
      blocked_reason: "Template not approved",
    }),
  ],
  page: 1,
  pageSize: 20,
  total: 45,
  ...over,
});

const renderView = () =>
  render(
    <Wrapper>
      <MemoryRouter>
        <CampaignListView />
      </MemoryRouter>
    </Wrapper>,
  );

describe("CampaignListView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("L9 — lists campaigns with code, cohort, status, recipients, sent and holdout", async () => {
    // Arrange
    fetchCampaignsMock.mockResolvedValue(page());

    // Act
    renderView();

    // Assert
    const row = await screen.findByTestId("campaign-row-31");

    expect(fetchCampaignsMock).toHaveBeenCalledWith({ page: 1, pageSize: 20, status: undefined });
    expect(row).toHaveTextContent("LAPSED20");
    expect(row).toHaveTextContent("Lapsed buyers");
    expect(row).toHaveTextContent("1000");
    expect(row).toHaveTextContent("880");
    expect(row).toHaveTextContent("100");
    expect(screen.getByTestId("campaign-link-31")).toHaveAttribute("href", campaignUrl(31));
    expect(screen.getByTestId("campaign-row-32")).toHaveTextContent("Template not approved");
  });

  it("L9 — pages through the list and filters by status", async () => {
    // Arrange
    fetchCampaignsMock.mockResolvedValue(page());
    renderView();
    await screen.findByTestId("campaign-row-31");

    // Act
    fireEvent.click(screen.getByTestId("campaigns-next"));

    // Assert
    await waitFor(() =>
      expect(fetchCampaignsMock).toHaveBeenLastCalledWith({
        page: 2,
        pageSize: 20,
        status: undefined,
      }),
    );

    // Act
    fireEvent.change(screen.getByTestId("campaigns-status-filter"), { target: { value: "open" } });

    // Assert — a new filter starts again from page 1
    await waitFor(() =>
      expect(fetchCampaignsMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        status: "open",
      }),
    );
  });

  it("L9 — Previous is disabled on page 1 and Next on the last page", async () => {
    // Arrange
    fetchCampaignsMock.mockResolvedValue(page({ total: 2 }));

    // Act
    renderView();
    await screen.findByTestId("campaign-row-31");

    // Assert
    expect(screen.getByTestId("campaigns-previous")).toBeDisabled();
    expect(screen.getByTestId("campaigns-next")).toBeDisabled();
  });

  it("L9 — an empty list and a disabled feature are explained", async () => {
    // Arrange
    fetchCampaignsMock.mockResolvedValueOnce(page({ items: [], total: 0 }));

    // Act
    renderView();

    // Assert
    expect(await screen.findByTestId("campaigns-empty")).toBeInTheDocument();
  });

  it("L11 — a 404 (cohorts off) shows the not-enabled message", async () => {
    // Arrange
    fetchCampaignsMock.mockRejectedValue(new ApiError({ status: 404, serverMessage: null }));

    // Act
    renderView();

    // Assert
    expect(await screen.findByTestId("campaigns-error")).toHaveTextContent(
      "Cohorts are not enabled on this environment yet.",
    );
  });
});
