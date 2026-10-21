// TTXY-4699 PR #5 (C6, C7c) — list rows are keyboard reachable through a real
// link, and the cohort type is shown translated rather than as the raw value.
import Wrapper from "@test/wrapper";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { fetchCohorts } from "../api/cohortsApi";
import { cohortMessages } from "../messages";
import { type Cohort, type CohortListResponse } from "../types";
import { CohortListView } from "./CohortListView";

jest.mock("../api/cohortsApi", () => ({
  fetchCohorts: jest.fn(),
}));

jest.mock("@dashboard/hooks/useNavigator", () => ({
  __esModule: true,
  default: () => jest.fn(),
}));

jest.mock("@dashboard/components/AppLayout", () => ({
  TopNav: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const fetchCohortsMock = fetchCohorts as jest.MockedFunction<typeof fetchCohorts>;

const cohort = (over: Partial<Cohort>): Cohort => ({
  id: 7,
  cohort_code: "C7",
  cohort_name: "include821",
  description: null,
  type: "static",
  status: true,
  created_date: "2026-10-01T00:00:00Z",
  end_date: null,
  message_batch_size: 100,
  sync_frequency_hours: 1,
  member_count: 12,
  last_synced_at: null,
  last_sync_status: null,
  last_sync_attempt_at: null,
  last_sync_error: null,
  ...over,
});

const renderList = () =>
  render(
    <MemoryRouter>
      <Wrapper>
        <CohortListView />
      </Wrapper>
    </MemoryRouter>,
  );

describe("CohortListView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("C6 — renders the cohort name as a focusable link to its detail page", async () => {
    // Arrange
    const response: CohortListResponse = {
      items: [cohort({ id: 7, cohort_name: "include821" })],
      limit: 20,
      offset: 0,
      total: 1,
    };

    fetchCohortsMock.mockResolvedValue(response);

    // Act
    renderList();

    // Assert
    const link = await screen.findByRole("link", { name: "include821" });

    expect(link).toHaveAttribute("href", "/cohorts/list/7");
    link.focus();
    expect(link).toHaveFocus();
  });

  it("C7c — shows the translated cohort type instead of the raw value", async () => {
    // Arrange
    const response: CohortListResponse = {
      items: [
        cohort({ id: 1, cohort_name: "a", type: "static" }),
        cohort({ id: 2, cohort_name: "b", type: "dynamic" }),
      ],
      limit: 20,
      offset: 0,
      total: 2,
    };

    fetchCohortsMock.mockResolvedValue(response);

    // Act
    renderList();

    // Assert
    const table = await screen.findByTestId("cohort-list-table");

    expect(table).toHaveTextContent(cohortMessages.typeStatic.defaultMessage);
    expect(table).toHaveTextContent(cohortMessages.typeDynamic.defaultMessage);
    expect(table).not.toHaveTextContent(/\bstatic\b/);
    expect(table).not.toHaveTextContent(/\bdynamic\b/);
  });
});
