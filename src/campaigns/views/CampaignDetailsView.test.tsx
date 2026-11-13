// TTXY-4841 — campaign funnel page (L9, L10): messaged vs holdout, conversion per
// stage, metrics, "Not tracked" stages, CSV export with the client's auth headers.
import { ApiError } from "@dashboard/cohorts/api/apiError";
import { downloadCampaignFunnelCsv, fetchCampaignFunnel } from "@dashboard/cohorts/api/cohortsApi";
import Wrapper from "@test/wrapper";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { campaignFunnelFixture } from "../fixtures";
import { CampaignDetailsView } from "./CampaignDetailsView";

jest.mock("@dashboard/cohorts/api/cohortsApi", () => ({
  fetchCampaignFunnel: jest.fn(),
  downloadCampaignFunnelCsv: jest.fn(),
}));

jest.mock("@dashboard/components/AppLayout", () => ({
  TopNav: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const fetchFunnelMock = fetchCampaignFunnel as jest.MockedFunction<typeof fetchCampaignFunnel>;
const downloadCsvMock = downloadCampaignFunnelCsv as jest.MockedFunction<
  typeof downloadCampaignFunnelCsv
>;

const renderView = async () => {
  render(
    <Wrapper>
      <CampaignDetailsView id="31" />
    </Wrapper>,
  );
  await screen.findByTestId("campaign-funnel-table");
};

const stageRow = (stage: string) => screen.getByTestId(`funnel-row-${stage}`);

describe("CampaignDetailsView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchFunnelMock.mockResolvedValue(campaignFunnelFixture());
  });

  it("L9 — shows messaged vs holdout counts per stage, with group sizes", async () => {
    // Arrange / Act
    await renderView();

    // Assert
    expect(fetchFunnelMock).toHaveBeenCalledWith("31");
    expect(within(stageRow("tagged")).getByTestId("funnel-messaged-count")).toHaveTextContent(
      "900",
    );
    expect(within(stageRow("tagged")).getByTestId("funnel-holdout-count")).toHaveTextContent("100");
    expect(within(stageRow("order_placed")).getByTestId("funnel-messaged-count")).toHaveTextContent(
      "38",
    );
    expect(screen.getByTestId("funnel-group-size-messaged")).toHaveTextContent("900");
    expect(screen.getByTestId("funnel-group-size-holdout")).toHaveTextContent("100");
  });

  it("L9 — shows a conversion per stage for each group", async () => {
    // Arrange / Act
    await renderView();

    // Assert — react-intl is mocked, so the raw rate is rendered
    expect(within(stageRow("sent")).getByTestId("funnel-messaged-conversion")).toHaveTextContent(
      String(880 / 900),
    );
    expect(within(stageRow("tagged")).getByTestId("funnel-messaged-conversion")).toHaveTextContent(
      "—",
    );
  });

  it("L10 — untracked stages read 'Not tracked', never 0", async () => {
    // Arrange / Act
    await renderView();

    // Assert
    expect(within(stageRow("delivered")).getByTestId("funnel-messaged-count")).toHaveTextContent(
      "Not tracked",
    );
    expect(within(stageRow("delivered")).getByTestId("funnel-holdout-count")).toHaveTextContent(
      "Not tracked",
    );
    expect(within(stageRow("clicked")).getByTestId("funnel-holdout-count")).toHaveTextContent(
      "Not tracked",
    );
    // a real 0 stays 0
    expect(within(stageRow("repeat_order")).getByTestId("funnel-holdout-count")).toHaveTextContent(
      "0",
    );
  });

  it("L9 — shows lift, reactivation, redemption and incremental GMV; null metrics say so", async () => {
    // Arrange
    fetchFunnelMock.mockResolvedValue(
      campaignFunnelFixture({
        metrics: {
          purchase_lift: 0.0222,
          repeat_lift: null,
          reactivation_rate: 0.05,
          redemption_rate: 0.0455,
          incremental_gmv: 26100,
        },
      }),
    );

    // Act
    await renderView();

    // Assert
    expect(screen.getByTestId("metric-purchase_lift")).toHaveTextContent("0.0222");
    expect(screen.getByTestId("metric-repeat_lift")).toHaveTextContent("Not available");
    expect(screen.getByTestId("metric-reactivation_rate")).toHaveTextContent("0.05");
    expect(screen.getByTestId("metric-redemption_rate")).toHaveTextContent("0.0455");
    expect(screen.getByTestId("metric-incremental_gmv")).toHaveTextContent("26100");
  });

  it("L9 — Export CSV downloads the funnel CSV through the API client", async () => {
    // Arrange
    const blob = new Blob(["group,stage,count,conversion_from_previous\n"], { type: "text/csv" });
    const createObjectURL = jest.fn(() => "blob:campaign-31");
    const revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    Object.assign(URL, { createObjectURL, revokeObjectURL });
    downloadCsvMock.mockResolvedValue({ blob, filename: "campaign-31-funnel.csv" });
    await renderView();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByTestId("campaign-export-csv"));
    });

    // Assert
    expect(downloadCsvMock).toHaveBeenCalledWith("31");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:campaign-31"));
    click.mockRestore();
  });

  it("L9 — a failed export is shown", async () => {
    // Arrange
    downloadCsvMock.mockRejectedValue(new ApiError({ status: 500, serverMessage: "boom" }));
    await renderView();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByTestId("campaign-export-csv"));
    });

    // Assert
    expect(await screen.findByTestId("campaign-export-error")).toHaveTextContent(
      "Couldn't export the CSV",
    );
  });

  it("L9 — an unknown campaign shows 'Campaign not found.'", async () => {
    // Arrange
    fetchFunnelMock.mockRejectedValue(new ApiError({ status: 404, serverMessage: "Not found" }));

    // Act
    render(
      <Wrapper>
        <CampaignDetailsView id="999" />
      </Wrapper>,
    );

    // Assert
    expect(await screen.findByTestId("campaign-error")).toHaveTextContent("Campaign not found.");
  });
});
